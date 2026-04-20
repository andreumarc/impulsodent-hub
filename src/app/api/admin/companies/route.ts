import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { listCompaniesWithStats, createCompany, upsertExternalCompany } from '@/lib/db'
import { pushCompanyToApps } from '@/lib/sync'

const APP_URLS: Record<string, string | undefined> = {
  clinicpnl:     process.env.NEXT_PUBLIC_URL_CLINICPNL,
  dentalhr:      process.env.NEXT_PUBLIC_URL_DENTALHR,
  dentalreports: process.env.NEXT_PUBLIC_URL_DENTALREPORTS,
  nexora:        process.env.NEXT_PUBLIC_URL_NEXORA,
  fichaje:       process.env.NEXT_PUBLIC_URL_FICHAJE,
  zentrix:       process.env.NEXT_PUBLIC_URL_ZENTRIX,
  spendflow:     process.env.NEXT_PUBLIC_URL_SPENDFLOW,
  clinicvox:     process.env.NEXT_PUBLIC_URL_CLINICVOX,
  dentalspot:    process.env.NEXT_PUBLIC_URL_DENTALSPOT,
  clinicrefunds: process.env.NEXT_PUBLIC_URL_CLINICREFUNDS,
  clinicstock:   process.env.NEXT_PUBLIC_URL_CLINICSTOCK,
}

async function requireSuperadmin() {
  const session = await getSession()
  if (!session || session.role !== 'superadmin') return null
  return session
}

export async function GET(req: NextRequest) {
  if (!await requireSuperadmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const pull = req.nextUrl.searchParams.get('pull') === '1'
  const onlyApp = req.nextUrl.searchParams.get('app_id') ?? undefined

  if (pull) {
    const secret = process.env.JWT_SECRET ?? ''
    const summary: { app_id: string; ok: boolean; created: number; updated: number; error?: string }[] = []

    await Promise.allSettled(
      Object.entries(APP_URLS)
        .filter((e): e is [string, string] => Boolean(e[1]))
        .filter(([appId]) => !onlyApp || onlyApp === appId)
        .map(async ([appId, appUrl]) => {
          try {
            const r = await fetch(`${appUrl.replace(/\/$/, '')}/api/sync/companies`, {
              headers: { Authorization: `Bearer ${secret}` },
              signal: AbortSignal.timeout(15000),
            })
            if (!r.ok) {
              summary.push({ app_id: appId, ok: false, created: 0, updated: 0, error: `HTTP ${r.status}` })
              return
            }
            const data = await r.json() as Array<{
              name: string; slug: string; cif?: string | null; city?: string | null
              email?: string | null; phone?: string | null
            }>
            let created = 0, updated = 0
            for (const c of data) {
              if (!c?.slug || !c?.name) continue
              try {
                const res = await upsertExternalCompany({
                  name:  c.name,
                  slug:  c.slug,
                  cif:   c.cif   ?? null,
                  city:  c.city  ?? null,
                  email: c.email ?? null,
                  phone: c.phone ?? null,
                })
                if (res.created) created++; else updated++
              } catch { /* non-fatal */ }
            }
            summary.push({ app_id: appId, ok: true, created, updated })
          } catch (err) {
            summary.push({
              app_id: appId, ok: false, created: 0, updated: 0,
              error: err instanceof Error ? err.message : 'unknown',
            })
          }
        }),
    )

    const companies = await listCompaniesWithStats()
    return NextResponse.json({ pull: summary, companies })
  }

  const companies = await listCompaniesWithStats()
  return NextResponse.json(companies)
}

export async function POST(req: NextRequest) {
  if (!await requireSuperadmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { name, slug, cif, city, email, phone, address, subscription_plan, subscription_expires_at, max_clinics, max_users } = body

  if (!name || !slug) return NextResponse.json({ error: 'name y slug son obligatorios' }, { status: 400 })

  try {
    const company = await createCompany({
      name,
      slug: slug.toLowerCase().replace(/\s+/g, '-'),
      cif,
      city,
      email,
      phone,
      address,
      subscription_plan,
      subscription_expires_at,
      max_clinics,
      max_users,
    })
    pushCompanyToApps({
      slug: company.slug,
      name: company.name,
      taxId: company.cif,
      email: company.email,
      phone: company.phone,
      address: company.address,
      subscription_plan: company.subscription_plan,
      subscription_expires_at: company.subscription_expires_at,
      max_clinics: company.max_clinics,
      max_users: company.max_users,
      active: company.active,
    }).catch(() => {})
    return NextResponse.json(company, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al crear empresa'
    if (msg.includes('unique')) return NextResponse.json({ error: 'El slug ya existe' }, { status: 409 })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
