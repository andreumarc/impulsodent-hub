import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getCompany, updateCompany, deleteCompany, getCompanyAppAccess, setCompanyAppAccess } from '@/lib/db'
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
  // Strip non-Company columns the GET added (appIds is a join-table projection)
  // and immutable fields the form re-sends.
  const { appIds, id: _bodyId, created_at, updated_at, users, appAccess, syncLogs, clinics, userAccess, ...companyFields } = body as Record<string, unknown>
  void _bodyId; void created_at; void updated_at; void users; void appAccess; void syncLogs; void clinics; void userAccess
  try {
    const updated = await updateCompany(id, companyFields)
    if (Array.isArray(appIds)) {
      await setCompanyAppAccess(id, appIds.filter((x): x is string => typeof x === 'string'))
    }
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
