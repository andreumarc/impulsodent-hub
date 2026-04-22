import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getSession } from '@/lib/auth'
import { getUser, updateUser, deleteUser, getUserAppRoles, setUserAppRoles, getUserClinicAccess, setUserClinicAccess, setUserClinicAccessAll } from '@/lib/db'
import { pushUserToApps } from '@/lib/sync'

async function requireUserAccess(id: string) {
  const session = await getSession()
  if (!session) return null
  if (session.role === 'superadmin') return session
  if (session.role !== 'admin') return null
  const target = await getUser(id)
  if (!target) return null
  if (!session.companyId || target.company_id !== session.companyId) return null
  if (target.role === 'superadmin') return null
  return session
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!await requireUserAccess(id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const user = await getUser(id)
  if (!user) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  const [appRoles, clinics] = await Promise.all([getUserAppRoles(id), getUserClinicAccess(id)])
  return NextResponse.json({
    ...user,
    password_hash: undefined,
    app_roles: appRoles.map((r) => ({
      app_id: r.app_id,
      role: r.role,
      clinic_access_all: r.clinic_access_all !== false,
      clinic_ids: r.clinic_ids ?? [],
    })),
    clinic_ids: clinics.map((c) => c.id),
  })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireUserAccess(id)
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json()
  const { password, app_roles, clinic_access_all, clinic_ids, ...rest } = body

  // Admin cannot escalate role to superadmin or reassign company
  if (session.role === 'admin') {
    if (rest.role === 'superadmin') {
      return NextResponse.json({ error: 'No puedes asignar rol superadmin' }, { status: 403 })
    }
    if (rest.company_id && rest.company_id !== session.companyId) {
      return NextResponse.json({ error: 'Forbidden (cross-company)' }, { status: 403 })
    }
    delete rest.company_id
  }

  const update: Record<string, unknown> = { ...rest }
  if (password) update.password_hash = await bcrypt.hash(password, 10)
  if (typeof clinic_access_all === 'boolean') update.clinic_access_all = clinic_access_all

  try {
    const updated = await updateUser(id, update)

    type AppRoleInput = { app_id: string; role: string; clinic_access_all?: boolean; clinic_ids?: string[] }
    const legacyAll = clinic_access_all !== false
    const legacyIds = Array.isArray(clinic_ids) ? clinic_ids : []

    if (Array.isArray(app_roles)) {
      const normalized = (app_roles as AppRoleInput[])
        .filter((r) => r.role)
        .map((r) => ({
          app_id: r.app_id,
          role: r.role,
          clinic_access_all: typeof r.clinic_access_all === 'boolean' ? r.clinic_access_all : legacyAll,
          clinic_ids: Array.isArray(r.clinic_ids) ? r.clinic_ids : legacyIds,
        }))
      await setUserAppRoles(id, normalized)

      // Legacy mirror for back-compat
      const anyRestricted = normalized.some((r) => !r.clinic_access_all)
      await setUserClinicAccessAll(id, !anyRestricted)
      if (anyRestricted) {
        const union = Array.from(new Set(normalized.filter((r) => !r.clinic_access_all).flatMap((r) => r.clinic_ids)))
        await setUserClinicAccess(id, union)
      }
    } else {
      // Legacy shape only
      if (typeof clinic_access_all === 'boolean') {
        await setUserClinicAccessAll(id, clinic_access_all)
      }
      if (clinic_access_all === false && Array.isArray(clinic_ids)) {
        await setUserClinicAccess(id, clinic_ids)
      }
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
    }).catch(err => console.error('[sync] failed', { app_id: 'pushUserToApps', endpoint: 'users[id].PUT', status: err?.status, message: err?.message ?? String(err) }))

    return NextResponse.json({ ...updated, password_hash: undefined, app_roles: appRoles, clinic_ids: clinics.map((c) => c.id) })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!await requireUserAccess(id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await deleteUser(id)
  return NextResponse.json({ ok: true })
}
