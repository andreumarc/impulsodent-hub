export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/notifications?limit=20&unreadOnly=1
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? '20'), 100)
  const unreadOnly = req.nextUrl.searchParams.get('unreadOnly') === '1'

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { user_id: session.id, ...(unreadOnly ? { read: false } : {}) },
      orderBy: { created_at: 'desc' },
      take: limit,
    }),
    prisma.notification.count({ where: { user_id: session.id, read: false } }),
  ])

  return NextResponse.json({ items, unreadCount })
}
