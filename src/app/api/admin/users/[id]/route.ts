import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getSession } from '@/lib/auth'
import { getUser, updateUser, deleteUser } from '@/lib/db'

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
  return NextResponse.json({ ...user, password_hash: undefined })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireSuperadmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const body = await req.json()
  const { password, ...rest } = body

  const update: Record<string, unknown> = { ...rest }
  if (password) update.password_hash = await bcrypt.hash(password, 10)

  try {
    const updated = await updateUser(id, update)
    return NextResponse.json({ ...updated, password_hash: undefined })
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
