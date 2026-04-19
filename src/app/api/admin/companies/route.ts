import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { listCompaniesWithStats, createCompany } from '@/lib/db'
import { pushCompanyToApps } from '@/lib/sync'

async function requireSuperadmin() {
  const session = await getSession()
  if (!session || session.role !== 'superadmin') return null
  return session
}

export async function GET() {
  if (!await requireSuperadmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
