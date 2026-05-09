import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { pushUserToApps } from '@/lib/sync'

interface BulkRemoveBody {
  user_ids: string[]
  app_ids: string[]
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !hasPermission(session.role, 'users:manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: BulkRemoveBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const userIds = Array.isArray(body.user_ids) ? body.user_ids.filter((x) => typeof x === 'string') : []
  const appIds = Array.isArray(body.app_ids) ? body.app_ids.filter((x) => typeof x === 'string') : []
  if (userIds.length === 0 || appIds.length === 0) {
    return NextResponse.json({ error: 'user_ids y app_ids son obligatorios y no pueden estar vacíos' }, { status: 400 })
  }

  // Cross-company scoping
  const users = await prisma.hubUser.findMany({
    where: { id: { in: userIds } },
    select: { id: true, company_id: true },
  })
  const skipped_cross_company: string[] = []
  const allowedUserIds = users
    .filter((u) => {
      if (session.role === 'superadmin') return true
      if (!session.companyId || u.company_id !== session.companyId) {
        skipped_cross_company.push(u.id)
        return false
      }
      return true
    })
    .map((u) => u.id)

  if (allowedUserIds.length === 0) {
    return NextResponse.json({
      revoked: 0,
      skipped_not_assigned: 0,
      skipped_cross_company,
    })
  }

  // Find existing assignments so we can compute counts and identify affected users
  const existingPairs = await prisma.userAppRole.findMany({
    where: { user_id: { in: allowedUserIds }, app_id: { in: appIds } },
    select: { user_id: true, app_id: true },
  })
  const revoked = existingPairs.length
  const skipped_not_assigned = (allowedUserIds.length * appIds.length) - revoked

  if (revoked > 0) {
    await prisma.userAppRole.deleteMany({
      where: { user_id: { in: allowedUserIds }, app_id: { in: appIds } },
    })
  }

  // Sync affected users (only those that actually had any of the apps)
  const affectedUserIds = Array.from(new Set(existingPairs.map((p) => p.user_id)))
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
    revoked,
    skipped_not_assigned,
    skipped_cross_company,
  })
}
