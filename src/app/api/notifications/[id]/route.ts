export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH /api/notifications/[id]   body: { read?: boolean }
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({} as { read?: boolean }))
  const read = body.read !== false

  const updated = await prisma.notification.updateMany({
    where: { id, user_id: session.id },
    data: { read, read_at: read ? new Date() : null },
  })
  if (updated.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/notifications/[id]
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  await prisma.notification.deleteMany({ where: { id, user_id: session.id } })
  return NextResponse.json({ ok: true })
}
