import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getCompany, updateCompany, deleteCompany, getCompanyAppAccess } from '@/lib/db'
import { pushCompanyToApps } from '@/lib/sync'
import { hasPermission } from '@/lib/permissions'

async function requireCompaniesManage() {
  const session = await getSession()
  if (!session || !hasPermission(session.role, 'companies:manage')) return null
  return session
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireCompaniesManage()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const company = await getCompany(id)
  if (!company) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  const appIds = await getCompanyAppAccess(id)
  return NextResponse.json({ ...company, appIds })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireCompaniesManage()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const body = await req.json()
  try {
    const updated = await updateCompany(id, body)
    pushCompanyToApps({
      slug: updated.slug,
      name: updated.name,
      taxId: updated.cif,
      email: updated.email,
      phone: updated.phone,
      address: updated.address,
      subscription_plan: updated.subscription_plan,
      subscription_expires_at: updated.subscription_expires_at,
      max_clinics: updated.max_clinics,
      max_users: updated.max_users,
      active: updated.active,
    }).catch(() => {})
    return NextResponse.json(updated)
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireCompaniesManage()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  try {
    await deleteCompany(id)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}
