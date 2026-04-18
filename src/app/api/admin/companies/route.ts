import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { listCompanies, createCompany } from '@/lib/db'

async function requireSuperadmin() {
  const session = await getSession()
  if (!session || session.role !== 'superadmin') return null
  return session
}

export async function GET() {
  if (!await requireSuperadmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const companies = await listCompanies()
  return NextResponse.json(companies)
}

export async function POST(req: NextRequest) {
  if (!await requireSuperadmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { name, slug, email, phone, address } = body

  if (!name || !slug) return NextResponse.json({ error: 'name y slug son obligatorios' }, { status: 400 })

  try {
    const company = await createCompany({ name, slug: slug.toLowerCase().replace(/\s+/g, '-'), email, phone, address })
    return NextResponse.json(company, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al crear empresa'
    if (msg.includes('unique')) return NextResponse.json({ error: 'El slug ya existe' }, { status: 409 })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
