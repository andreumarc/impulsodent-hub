import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getSession } from '@/lib/auth'
import { getUser, updateUser, deleteUser, getUserAppRoles, setUserAppRoles, getUserClinicAccess, setUserClinicAccess, setUserClinicAccessAll } from '@/lib/db'
import { pushUserToApps } from '@/lib/sync'

async function requireSuperadmin() {
  const session = await getSession()
  if (!session || session.role !== 'superadmin') return null
  return session
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireSuperadmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const user = await getUser(id)
  if (!user) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  const [appRoles, clinics] = await Promise.all([getUserAppRoles(id), getUserClinicAccess(id)])
  return NextResponse.json({ ...user, password_hash: undefined, app_roles: appRoles, clinic_ids: clinics.map((c) => c.id) })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireSuperadmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const body = await req.json()
  const { password, app_roles, clinic_access_all, clinic_ids, ...rest } = body

  const update: Record<string, unknown> = { ...rest }
  if (password) update.password_hash = await bcrypt.hash(password, 10)
  if (typeof clinic_access_all === 'boolean') update.clinic_access_all = clinic_access_all

  try {
    const updated = await updateUser(id, update)

    if (Array.isArray(app_roles)) {
      await setUserAppRoles(id, app_roles.filter((r: { app_id: string; role: string }) => r.role))
    }

    // Update clinic access
    if (typeof clinic_access_all === 'boolean') {
      await setUserClinicAccessAll(id, clinic_access_all)
    }
    if (clinic_access_all === false && Array.isArray(clinic_ids)) {
      await setUserClinicAccess(id, clinic_ids)
    }

    const [appRoles, clinics] = await Promise.all([getUserAppRoles(id), getUserClinicAccess(id)])

    // Re-sync to all apps with updated clinic access
    pushUserToApps({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      companyId: updated.company_id,
      subscription_plan: updated.subscription_plan,
      subscription_expires_at: updated.subscription_expires_at,
      max_clinics: updated.max_clinics,
    }).catch(() => {})

    return NextResponse.json({ ...updated, password_hash: undefined, app_roles: appRoles, clinic_ids: clinics.map((c) => c.id) })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireSuperadmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  await deleteUser(id)
  return NextResponse.json({ ok: true })
}
