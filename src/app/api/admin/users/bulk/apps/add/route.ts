import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { pushUserToApps } from '@/lib/sync'

interface AppRoleInput {
  app_id: string
  role: string
}

interface BulkAddBody {
  user_ids: string[]
  app_roles: AppRoleInput[]
  on_conflict?: 'skip' | 'overwrite'
}

interface Conflict {
  user_id: string
  user_name: string
  app_id: string
  app_name: string
  current_role: string
  new_role: string
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !hasPermission(session.role, 'users:manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: BulkAddBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const userIds = Array.isArray(body.user_ids) ? body.user_ids.filter((x) => typeof x === 'string') : []
  const appRoles = Array.isArray(body.app_roles)
    ? body.app_roles.filter((r): r is AppRoleInput => typeof r?.app_id === 'string' && typeof r?.role === 'string' && r.role.length > 0)
    : []
  if (userIds.length === 0 || appRoles.length === 0) {
    return NextResponse.json({ error: 'user_ids y app_roles son obligatorios y no pueden estar vacíos' }, { status: 400 })
  }

  // Load target users + their existing app_roles
  const users = await prisma.hubUser.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true, name: true, role: true, company_id: true,
      appRoles: { select: { app_id: true, role: true } },
    },
  })

  // Cross-company scoping for non-superadmin
  const skipped_cross_company: string[] = []
  const allowed = users.filter((u) => {
    if (session.role === 'superadmin') return true
    if (!session.companyId) { skipped_cross_company.push(u.id); return false }
    if (u.company_id !== session.companyId) { skipped_cross_company.push(u.id); return false }
    return true
  })

  // Load CompanyAppAccess once for all distinct companies in the allowed set
  const companyIds = Array.from(new Set(allowed.map((u) => u.company_id).filter((c): c is string => Boolean(c))))
  const companyAccessRows = await prisma.companyAppAccess.findMany({
    where: { company_id: { in: companyIds }, app_id: { in: appRoles.map((r) => r.app_id) } },
    select: { company_id: true, app_id: true },
  })
  const companyHasApp = new Set(companyAccessRows.map((r) => `${r.company_id}|${r.app_id}`))

  // App name lookup (for nicer conflict messages)
  const { APPS } = await import('@/lib/apps')
  const appNameById = new Map(APPS.map((a) => [a.id, a.name]))

  // Categorize each (user, app)
  const conflicts: Conflict[] = []
  const skipped_no_company_access: { user_id: string; app_id: string }[] = []
  type Action = { user_id: string; app_id: string; role: string; was_existing: boolean }
  const grants: Action[] = []
  const overwrites: Action[] = []
  let skipped_same_role = 0

  for (const u of allowed) {
    const existingByApp = new Map(u.appRoles.map((r) => [r.app_id, r.role]))
    for (const ar of appRoles) {
      // Superadmin user: skip — already implicit access
      if (u.role === 'superadmin') {
        skipped_same_role++
        continue
      }
      // CompanyAppAccess check (only if user has a company)
      if (u.company_id && !companyHasApp.has(`${u.company_id}|${ar.app_id}`)) {
        skipped_no_company_access.push({ user_id: u.id, app_id: ar.app_id })
        continue
      }
      // No company at all: also skip
      if (!u.company_id) {
        skipped_no_company_access.push({ user_id: u.id, app_id: ar.app_id })
        continue
      }
      const current = existingByApp.get(ar.app_id)
      if (!current) {
        grants.push({ user_id: u.id, app_id: ar.app_id, role: ar.role, was_existing: false })
      } else if (current === ar.role) {
        skipped_same_role++
      } else {
        // Conflict
        conflicts.push({
          user_id: u.id,
          user_name: u.name,
          app_id: ar.app_id,
          app_name: appNameById.get(ar.app_id) ?? ar.app_id,
          current_role: current,
          new_role: ar.role,
        })
        if (body.on_conflict === 'overwrite') {
          overwrites.push({ user_id: u.id, app_id: ar.app_id, role: ar.role, was_existing: true })
        }
      }
    }
  }

  // If conflicts and no on_conflict decision yet → return for client to ask
  if (conflicts.length > 0 && !body.on_conflict) {
    return NextResponse.json({
      status: 'conflicts_pending',
      conflicts,
      preview: {
        to_grant: grants.length,
        same_role: skipped_same_role,
        no_company_access: skipped_no_company_access.length,
        cross_company: skipped_cross_company.length,
      },
    })
  }

  // Apply: grants always; overwrites only if on_conflict === 'overwrite'
  const writes = [...grants, ...overwrites]
  if (writes.length > 0) {
    await Promise.all(writes.map((w) =>
      prisma.userAppRole.upsert({
        where: { user_id_app_id: { user_id: w.user_id, app_id: w.app_id } },
        create: { user_id: w.user_id, app_id: w.app_id, role: w.role },
        update: { role: w.role },
      })
    ))
  }

  // Sync affected users to sub-apps
  const affectedUserIds = Array.from(new Set(writes.map((w) => w.user_id)))
  if (affectedUserIds.length > 0) {
    const affectedUsers = await prisma.hubUser.findMany({
      where: { id: { in: affectedUserIds } },
    })
    await Promise.allSettled(affectedUsers.map((u) =>
      pushUserToApps({
        id: u.id, email: u.email, name: u.name, role: u.role,
        companyId: u.company_id,
        subscription_plan: u.subscription_plan,
        subscription_expires_at: u.subscription_expires_at?.toISOString() ?? null,
        max_clinics: u.max_clinics,
        active: u.active,
        password_hash: u.password_hash,
      })
    ))
  }

  return NextResponse.json({
    status: 'applied',
    granted: grants.length,
    skipped_same_role,
    conflicts_resolved: body.on_conflict === 'overwrite' ? conflicts.length : (body.on_conflict === 'skip' ? conflicts.length : 0),
    skipped_no_company_access,
    skipped_cross_company,
  })
}
