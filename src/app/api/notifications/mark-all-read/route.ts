export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await prisma.notification.updateMany({
    where: { user_id: session.id, read: false },
    data: { read: true, read_at: new Date() },
  })
  return NextResponse.json({ ok: true, count: result.count })
}
