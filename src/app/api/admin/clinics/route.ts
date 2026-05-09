import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getSession } from '@/lib/auth'
import { createClinic, listClinicsByCompany, listAllClinics, getCompanyAppAccess } from '@/lib/db'
import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/permissions'
import { APP_URLS, APP_IDS_WITH_CLINICS } from '@/lib/app-urls'

// Only push clinic creates to apps that have a real Clinic model.
const CLINIC_APP_URLS: Record<string, string | undefined> = Object.fromEntries(
  APP_IDS_WITH_CLINICS.map((id) => [id, APP_URLS[id]]),
)

// GET /api/admin/clinics?company_id=X  — list Hub-known clinics for company
// One-way sync rule: data flows Hub → sub-apps. Pulling clinics from sub-apps
// is forbidden (see feedback_hub_oneway_sync.md).
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || !hasPermission(session.role, 'clinics:manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let company_id = req.nextUrl.searchParams.get('company_id')

  // No company_id:
  //   - superadmin → list across all companies (top-level /admin/clinics)
  //   - admin      → scope to their own company
  if (!company_id) {
    if (session.role === 'superadmin') {
      const all = await listAllClinics({ active_only: false })
      return NextResponse.json(all)
    }
    if (session.companyId) {
      company_id = session.companyId
    } else {
      return NextResponse.json([], { status: 200 })
    }
  }

  // Non-superadmin roles cannot inspect other companies' clinics
  if (session.role !== 'superadmin' && session.companyId && company_id !== session.companyId) {
    return NextResponse.json({ error: 'Forbidden (cross-company)' }, { status: 403 })
  }

  const clinics = await listClinicsByCompany(company_id)
  return NextResponse.json(clinics)
}

// POST /api/admin/clinics  — superadmin/admin creates a clinic in Hub + fans out to ALL
// sub-apps enabled for that company. Clinics are company-scoped (not app-scoped).
// Body: { company_id, name, external_id? }
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !hasPermission(session.role, 'clinics:manage')) {
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
  if (session.role !== 'superadmin' && session.companyId && session.companyId !== company_id) {
    return NextResponse.json({ error: 'Forbidden (cross-company)' }, { status: 403 })
  }

  const trimmedName = name.trim()
  const external_id = body.external_id ?? `hub_${randomBytes(8).toString('hex')}`

  // Apps enabled for this company
  const enabledApps = (await getCompanyAppAccess(company_id)).filter((a) => a in CLINIC_APP_URLS)

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
    const company = await prisma.company.findUnique({ where: { id: company_id }, select: { id: true, slug: true, name: true } })
    const secret = process.env.JWT_SECRET ?? ''
    if (company?.slug && secret && targetApps.length > 0) {
      await Promise.allSettled(targetApps.map(async (app_id) => {
        const appUrl = CLINIC_APP_URLS[app_id]
        if (!appUrl) return
        await fetch(`${appUrl}/api/sync/clinics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
          body: JSON.stringify({
            app_id,
            company_slug: company.slug,
            company_name: company.name,
            hub_company_id: company.id,
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
