import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getSession } from '@/lib/auth'
import { createClinic, listClinicsByCompany, upsertClinic } from '@/lib/db'
import { prisma } from '@/lib/prisma'

const APP_URLS: Record<string, string | undefined> = {
  clinicpnl:     process.env.NEXT_PUBLIC_URL_CLINICPNL,
  dentalhr:      process.env.NEXT_PUBLIC_URL_DENTALHR,
  dentalreports: process.env.NEXT_PUBLIC_URL_DENTALREPORTS,
  nexora:        process.env.NEXT_PUBLIC_URL_NEXORA,
  fichaje:       process.env.NEXT_PUBLIC_URL_FICHAJE,
  zentrix:       process.env.NEXT_PUBLIC_URL_ZENTRIX,
  spendflow:     process.env.NEXT_PUBLIC_URL_SPENDFLOW,
}

// GET /api/admin/clinics?company_id=X  — list Hub-known clinics for company
// GET /api/admin/clinics?company_id=X&pull=1  — pull fresh from sub-apps first
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const company_id = req.nextUrl.searchParams.get('company_id')
  if (!company_id) return NextResponse.json([], { status: 200 })

  const pull = req.nextUrl.searchParams.get('pull') === '1'
  const secret = process.env.JWT_SECRET ?? ''

  if (pull) {
    // Pull clinics from all sub-apps for this company
    await Promise.allSettled(
      Object.entries(APP_URLS)
        .filter((e): e is [string, string] => Boolean(e[1]))
        .map(async ([appId, appUrl]) => {
          try {
            const syncPath = appId === 'fichaje' ? '/api/v1/sync/clinics' : '/api/sync/clinics'
            const r = await fetch(`${appUrl}${syncPath}?company_id=${company_id}`, {
              headers: { Authorization: `Bearer ${secret}` },
            })
            if (!r.ok) return
            const data = await r.json() as { id: string; name: string; active?: boolean }[]
            await Promise.all(
              data.map((c) =>
                upsertClinic({
                  external_id: c.id,
                  app_id: appId,
                  name: c.name,
                  company_id,
                  active: c.active !== false,
                }),
              ),
            )
          } catch { /* non-fatal */ }
        }),
    )
  }

  const clinics = await listClinicsByCompany(company_id)
  return NextResponse.json(clinics)
}

// POST /api/admin/clinics  — superadmin creates a clinic in Hub + pushes to sub-app
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as {
    company_id?: string; app_id?: string; name?: string; external_id?: string
  }
  const { company_id, app_id, name } = body
  if (!company_id || !app_id || !name) {
    return NextResponse.json({ error: 'company_id, app_id, name required' }, { status: 400 })
  }
  if (!(app_id in APP_URLS)) {
    return NextResponse.json({ error: `unknown app_id: ${app_id}` }, { status: 400 })
  }

  // Generate a stable external_id if not provided
  const external_id = body.external_id ?? `hub_${randomBytes(8).toString('hex')}`

  const clinic = await createClinic({
    external_id,
    app_id,
    name: name.trim(),
    company_id,
    active: true,
  })

  // Best-effort push to the sub-app (if it supports POST /api/sync/clinics upsert)
  try {
    const company = await prisma.company.findUnique({ where: { id: company_id }, select: { slug: true } })
    const appUrl = APP_URLS[app_id]
    const secret = process.env.JWT_SECRET ?? ''
    if (company?.slug && appUrl && secret) {
      const syncPath = app_id === 'fichaje' ? '/api/v1/sync/clinics' : '/api/sync/clinics'
      await fetch(`${appUrl}${syncPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
        body: JSON.stringify({
          app_id,
          company_slug: company.slug,
          clinics: [{ id: external_id, name: clinic.name, active: true }],
        }),
        signal: AbortSignal.timeout(6000),
      }).catch(() => {})
    }
  } catch { /* non-fatal */ }

  return NextResponse.json(clinic, { status: 201 })
}
