import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getSession } from '@/lib/auth'
import { getUser, updateUser, deleteUser, getUserAppRoles, setUserAppRoles } from '@/lib/db'

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
  const appRoles = await getUserAppRoles(id)
  return NextResponse.json({ ...user, password_hash: undefined, app_roles: appRoles })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireSuperadmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const body = await req.json()
  const { password, app_roles, ...rest } = body

  const update: Record<string, unknown> = { ...rest }
  if (password) update.password_hash = await bcrypt.hash(password, 10)

  try {
    const updated = await updateUser(id, update)
    if (Array.isArray(app_roles)) {
      await setUserAppRoles(id, app_roles.filter((r: { app_id: string; role: string }) => r.role))
    }
    const appRoles = await getUserAppRoles(id)
    return NextResponse.json({ ...updated, password_hash: undefined, app_roles: appRoles })
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
