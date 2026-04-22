import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getSession } from '@/lib/auth'
import { createClinic, listClinicsByCompany, listAllClinics, upsertClinic, getCompanyAppAccess } from '@/lib/db'
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
// Both superadmin and admin can list clinics.
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || (session.role !== 'superadmin' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let company_id = req.nextUrl.searchParams.get('company_id')
  const pull = req.nextUrl.searchParams.get('pull') === '1'
  const secret = process.env.JWT_SECRET ?? ''

  // No company_id:
  //   - superadmin → list across all companies (top-level /admin/clinics)
  //   - admin      → scope to their own company
  if (!company_id) {
    if (session.role === 'superadmin') {
      const all = await listAllClinics({ active_only: false })
      return NextResponse.json(all)
    }
    if (session.role === 'admin' && session.companyId) {
      company_id = session.companyId
    } else {
      return NextResponse.json([], { status: 200 })
    }
  }

  // Admin cannot inspect other companies' clinics
  if (session.role === 'admin' && session.companyId && company_id !== session.companyId) {
    return NextResponse.json({ error: 'Forbidden (cross-company)' }, { status: 403 })
  }

  if (pull) {
    // Pull clinics from all sub-apps for this company
    await Promise.allSettled(
      Object.entries(APP_URLS)
        .filter((e): e is [string, string] => Boolean(e[1]))
        .map(async ([appId, appUrl]) => {
          try {
            const syncPath = '/api/sync/clinics'
            const r = await fetch(`${appUrl}${syncPath}?company_id=${company_id}`, {
              headers: { Authorization: `Bearer ${secret}` },
            })
            if (!r.ok) return
            const data = await r.json() as { id: string; name: string; active?: boolean }[]
            await Promise.all(
              data
                // Skip inactive/deleted clinics from sub-apps so deletes in Hub don't bounce back
                .filter((c) => c.active !== false)
                .map((c) =>
                  upsertClinic({
                    external_id: c.id,
                    app_id: appId,
                    name: c.name,
                    company_id,
                    active: true,
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

// POST /api/admin/clinics  — superadmin/admin creates a clinic in Hub + fans out to ALL
// sub-apps enabled for that company. Clinics are company-scoped (not app-scoped).
// Body: { company_id, name, external_id? }
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || (session.role !== 'superadmin' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as {
    company_id?: string; name?: string; external_id?: string
    app_ids?: string[] | 'ALL'
  }
  const { company_id, name } = body
  if (!company_id || !name) {
    return NextResponse.json({ error: 'company_id, name required' }, { status: 400 })
  }

  // Admin is scoped to their own company
  if (session.role === 'admin' && session.companyId && session.companyId !== company_id) {
    return NextResponse.json({ error: 'Forbidden (cross-company)' }, { status: 403 })
  }

  const trimmedName = name.trim()
  const external_id = body.external_id ?? `hub_${randomBytes(8).toString('hex')}`

  // Apps enabled for this company
  const enabledApps = (await getCompanyAppAccess(company_id)).filter((a) => a in APP_URLS)

  // Resolve target apps for this clinic:
  //  - body.app_ids = 'ALL' or missing  → all enabled apps
  //  - body.app_ids = string[]          → intersection with enabled apps
  let targetApps: string[]
  if (body.app_ids && body.app_ids !== 'ALL' && Array.isArray(body.app_ids)) {
    targetApps = body.app_ids.filter((a) => enabledApps.includes(a))
    if (targetApps.length === 0) {
      return NextResponse.json({ error: 'No valid app_ids (none enabled for company)' }, { status: 400 })
    }
  } else {
    targetApps = enabledApps.length > 0 ? enabledApps : ['clinicpnl']
  }

  // Create one Hub record per target app so the grouping / external_id mapping works
  // across the sync layer. The UI deduplicates by name.
  const created: Awaited<ReturnType<typeof createClinic>>[] = []
  for (const app_id of targetApps) {
    const clinic = await createClinic({
      external_id,
      app_id,
      name: trimmedName,
      company_id,
      active: true,
    })
    created.push(clinic)
  }

  // Best-effort fan-out to each selected sub-app
  try {
    const company = await prisma.company.findUnique({ where: { id: company_id }, select: { slug: true } })
    const secret = process.env.JWT_SECRET ?? ''
    if (company?.slug && secret && targetApps.length > 0) {
      await Promise.allSettled(targetApps.map(async (app_id) => {
        const appUrl = APP_URLS[app_id]
        if (!appUrl) return
        await fetch(`${appUrl}/api/sync/clinics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
          body: JSON.stringify({
            app_id,
            company_slug: company.slug,
            clinics: [{ id: external_id, name: trimmedName, active: true }],
          }),
          signal: AbortSignal.timeout(6000),
        }).catch(() => {})
      }))
    }
  } catch { /* non-fatal */ }

  // Return the first record (UI only needs one representative)
  return NextResponse.json(created[0], { status: 201 })
}
