import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { listClinicsByCompany, upsertClinic } from '@/lib/db'

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
