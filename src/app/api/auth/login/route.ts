import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createSessionToken, COOKIE_NAME } from '@/lib/auth'
import { getInitials } from '@/lib/utils'
import { getUserByEmail } from '@/lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { email, password } = body as { email?: string; password?: string }

  if (!email || !password) {
    return NextResponse.json({ error: 'Credenciales requeridas' }, { status: 400 })
  }

  let sessionUser = null

  // 1. Check env-var superadmin (always available, no DB needed)
  const adminEmail = process.env.HUB_ADMIN_EMAIL
  const adminPassword = process.env.HUB_ADMIN_PASSWORD
  const adminName = process.env.HUB_ADMIN_NAME || 'Administrador'

  if (adminEmail && adminPassword && email === adminEmail && password === adminPassword) {
    sessionUser = {
      id: 'superadmin',
      email,
      name: adminName,
      role: 'superadmin',
      initials: getInitials(adminName),
      companyId: null as string | null,
    }
  }

  // 2. Check Supabase DB users (if not matched by env-var)
  if (!sessionUser && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const dbUser = await getUserByEmail(email)
      if (dbUser && dbUser.active) {
        const passwordMatch = await bcrypt.compare(password, dbUser.password_hash)
        if (passwordMatch) {
          sessionUser = {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name,
            role: dbUser.role,
            initials: getInitials(dbUser.name),
            companyId: dbUser.company_id,
          }
        }
      }
    } catch {
      // Supabase not configured yet — skip DB check
    }
  }

  if (!sessionUser) {
    return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 })
  }

  const token = await createSessionToken(sessionUser)

  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
    path: '/',
  })

  return res
}
