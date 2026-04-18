import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getSession } from '@/lib/auth'
import { listUsers, createUser, getUserByEmail, setUserAppRoles } from '@/lib/db'
import { getInitials } from '@/lib/utils'

async function requireSuperadmin() {
  const session = await getSession()
  if (!session || session.role !== 'superadmin') return null
  return session
}

export async function GET(req: NextRequest) {
  if (!await requireSuperadmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const companyId = req.nextUrl.searchParams.get('companyId')
  const all = await listUsers()
  const users = companyId ? all.filter((u) => u.company_id === companyId) : all
  return NextResponse.json(users.map((u) => ({ ...u, password_hash: undefined })))
}

export async function POST(req: NextRequest) {
  if (!await requireSuperadmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { email, password, name, role, company_id, app_roles } = body

  if (!email || !password || !name || !role) {
    return NextResponse.json({ error: 'email, password, name y role son obligatorios' }, { status: 400 })
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
  })

  if (Array.isArray(app_roles) && app_roles.length > 0) {
    await setUserAppRoles(user.id, app_roles.filter((r: { app_id: string; role: string }) => r.role))
  }

  return NextResponse.json(
    { ...user, password_hash: undefined, initials: getInitials(user.name) },
    { status: 201 },
  )
}
