export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/notifications/push  (sub-app → Hub)
 *
 * Auth: Authorization: Bearer <HUB_JWT_SECRET>  (same shared secret as /api/sync/*)
 *
 * Body — choose ONE of:
 *  { user_email, ...notification }                   → single user lookup by email
 *  { user_emails: string[], ...notification }        → fan-out to many users
 *  { company_slug, ...notification }                 → all users of a company
 *  { broadcast: true, ...notification }              → ALL active users (use sparingly)
 *  { app_id_audience, ...notification }              → all users with access to that app
 *
 * Notification fields:
 *  { app_id?, kind?, title, body?, link?, icon? }
 */

type PushBody = {
  user_email?: string
  user_emails?: string[]
  company_slug?: string
  broadcast?: boolean
  app_id_audience?: string
  app_id?: string
  kind?: 'app_update' | 'user_message' | 'data_change' | 'system' | 'info' | 'warning'
  title: string
  body?: string
  link?: string
  icon?: string
}

function authorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') ?? ''
  const secret = process.env.JWT_SECRET ?? process.env.HUB_JWT_SECRET
  return Boolean(secret && auth === `Bearer ${secret}`)
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = (await req.json().catch(() => null)) as PushBody | null
  if (!data?.title) return NextResponse.json({ error: 'title required' }, { status: 400 })

  // Resolve audience
  let userIds: string[] = []
  if (data.user_email) {
    const u = await prisma.hubUser.findUnique({ where: { email: data.user_email.toLowerCase() }, select: { id: true } })
    if (u) userIds = [u.id]
  } else if (data.user_emails?.length) {
    const us = await prisma.hubUser.findMany({
      where: { email: { in: data.user_emails.map((e) => e.toLowerCase()) }, active: true },
      select: { id: true },
    })
    userIds = us.map((u) => u.id)
  } else if (data.company_slug) {
    const company = await prisma.company.findUnique({ where: { slug: data.company_slug }, select: { id: true } })
    if (company) {
      const us = await prisma.hubUser.findMany({ where: { company_id: company.id, active: true }, select: { id: true } })
      userIds = us.map((u) => u.id)
    }
  } else if (data.app_id_audience) {
    const roles = await prisma.userAppRole.findMany({
      where: { app_id: data.app_id_audience },
      select: { user_id: true },
    })
    userIds = roles.map((r) => r.user_id)
  } else if (data.broadcast) {
    const us = await prisma.hubUser.findMany({ where: { active: true }, select: { id: true } })
    userIds = us.map((u) => u.id)
  } else {
    return NextResponse.json({ error: 'audience required (user_email | user_emails | company_slug | app_id_audience | broadcast)' }, { status: 400 })
  }

  if (userIds.length === 0) return NextResponse.json({ ok: true, count: 0 })

  await prisma.notification.createMany({
    data: userIds.map((user_id) => ({
      user_id,
      app_id: data.app_id ?? null,
      kind: data.kind ?? 'info',
      title: data.title,
      body: data.body ?? null,
      link: data.link ?? null,
      icon: data.icon ?? null,
    })),
  })

  return NextResponse.json({ ok: true, count: userIds.length })
}
