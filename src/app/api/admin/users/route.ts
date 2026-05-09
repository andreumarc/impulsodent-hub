import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getSession } from '@/lib/auth'
import {
  listUsers, createUser, getUserByEmail,
  setUserAppRoles, setUserClinicAccess, setUserClinicAccessAll,
  setUserCompanyAccess, setUserCompanyAccessAll,
} from '@/lib/db'
import { getInitials } from '@/lib/utils'
import { pushUserToApps } from '@/lib/sync'
import { hasPermission, canCreateRole, type HubRole } from '@/lib/permissions'

async function requireSuperadmin() {
  const session = await getSession()
  if (!session || session.role !== 'superadmin') return null
  return session
}

async function requireAdmin() {
  const session = await getSession()
  if (!session || !hasPermission(session.role, 'users:manage')) return null
  return session
}

// One-way sync rule: data flows Hub → sub-apps. Pulling users from sub-apps
// into the Hub is forbidden (see feedback_hub_oneway_sync.md).
export async function GET(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let companyId = req.nextUrl.searchParams.get('companyId')

  // Admin is scoped to their own company
  if (session.role === 'admin') {
    if (!session.companyId) return NextResponse.json([], { status: 200 })
    if (companyId && companyId !== session.companyId) {
      return NextResponse.json({ error: 'Forbidden (cross-company)' }, { status: 403 })
    }
    companyId = session.companyId
  }

  const all = await listUsers()
  const users = companyId ? all.filter((u) => u.company_id === companyId) : all
  return NextResponse.json(users.map((u) => ({ ...u, password_hash: undefined })))
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  let { company_id } = body
  const { email, password, name, role, app_roles, subscription_plan, subscription_expires_at, max_clinics, clinic_access_all, clinic_ids, company_ids, company_access_all } = body

  if (!email || !password || !name || !role) {
    return NextResponse.json({ error: 'email, password, name y role son obligatorios' }, { status: 400 })
  }

  // Role-escalation guard: actors can only create roles at or below their own level
  if (!canCreateRole(session.role, role as HubRole)) {
    return NextResponse.json({ error: `No puedes crear usuarios con rol ${role}` }, { status: 403 })
  }

  // Resolve final companies: prefer multi (`company_ids` + `company_access_all`),
  // fall back to legacy single `company_id` for older clients.
  let finalCompanyIds: string[] = Array.isArray(company_ids)
    ? company_ids.filter((x: unknown): x is string => typeof x === 'string' && x.length > 0)
    : (company_id ? [company_id] : [])
  const finalCompanyAccessAll = company_access_all === true

  // Non-superadmin actors are scoped to their own company
  if (session.role !== 'superadmin') {
    if (!session.companyId) return NextResponse.json({ error: 'Usuario sin empresa asignada' }, { status: 403 })
    const cross = finalCompanyIds.some((c) => c !== session.companyId)
    if (cross || finalCompanyAccessAll) {
      return NextResponse.json({ error: 'Forbidden (cross-company)' }, { status: 403 })
    }
    finalCompanyIds = [session.companyId]
    company_id = session.companyId
  } else {
    // Primary company_id stored on the user row = first selected (for legacy joins).
    company_id = finalCompanyIds[0] || null
  }

  const existing = await getUserByEmail(email)
  if (existing) return NextResponse.json({ error: 'El email ya está en uso' }, { status: 409 })

  const password_hash = await bcrypt.hash(password, 10)

  const user = await createUser({
    email,
    password_hash,
    name,
    role,
    company_id: company_id || null,
    subscription_plan: subscription_plan ?? 'free',
    subscription_expires_at: subscription_expires_at || null,
    max_clinics: max_clinics ?? 5,
    clinic_access_all: clinic_access_all !== false,
  })

  // Normalize app_roles: new shape carries per-app clinic_access_all + clinic_ids;
  // if body only has the legacy global fields, fan them out to every provided app.
  type AppRoleInput = { app_id: string; role: string; clinic_access_all?: boolean; clinic_ids?: string[] }
  const rawAppRoles: AppRoleInput[] = Array.isArray(app_roles) ? app_roles : []
  const legacyAll = clinic_access_all !== false
  const legacyIds = Array.isArray(clinic_ids) ? clinic_ids : []
  const normalized = rawAppRoles
    .filter((r) => r.role)
    .map((r) => ({
      app_id: r.app_id,
      role: r.role,
      clinic_access_all: typeof r.clinic_access_all === 'boolean' ? r.clinic_access_all : legacyAll,
      clinic_ids: Array.isArray(r.clinic_ids) ? r.clinic_ids : legacyIds,
    }))

  // Persist multi-company access
  if (finalCompanyAccessAll) {
    await setUserCompanyAccessAll(user.id, true)
  } else {
    await setUserCompanyAccessAll(user.id, false)
    if (finalCompanyIds.length > 0) await setUserCompanyAccess(user.id, finalCompanyIds)
  }

  // Persist per-app roles + clinic scope
  if (normalized.length > 0) await setUserAppRoles(user.id, normalized)

  // Maintain legacy global fields for back-compat with code still reading them.
  const anyRestricted = normalized.some((r) => !r.clinic_access_all)
  await setUserClinicAccessAll(user.id, !anyRestricted)
  if (anyRestricted) {
    const union = Array.from(new Set(normalized.filter((r) => !r.clinic_access_all).flatMap((r) => r.clinic_ids)))
    if (union.length > 0) await setUserClinicAccess(user.id, union)
  }

  // fire-and-forget sync to all apps
  pushUserToApps({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companyId: user.company_id,
    subscription_plan: user.subscription_plan,
    subscription_expires_at: user.subscription_expires_at,
    max_clinics: user.max_clinics,
    active: user.active,
    password, // plain password — sub-apps hash locally
    password_hash: user.password_hash, // fallback if plaintext absent (re-sync of existing users)
  }).catch(err => console.error('[sync] failed', { app_id: 'pushUserToApps', endpoint: 'users.POST', status: err?.status, message: err?.message ?? String(err) }))

  return NextResponse.json(
    { ...user, password_hash: undefined, initials: getInitials(user.name) },
    { status: 201 },
  )
}
