import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { listAppRegistrations } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const regs = await listAppRegistrations()
    return NextResponse.json(regs)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
