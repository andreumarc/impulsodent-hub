import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getUserByEmail, createUser, updateUser } from '@/lib/db'

function verifyBearer(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  return token === process.env.JWT_SECRET
}

export async function POST(req: NextRequest) {
  if (!verifyBearer(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { email?: string; name?: string; role?: string; company_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { email, name, role, company_id, subscription_plan, subscription_expires_at, max_clinics } = body

  if (!email || !name) {
    return NextResponse.json({ error: 'email y name son obligatorios' }, { status: 400 })
  }

  const existing = await getUserByEmail(email)

  if (!existing) {
    const password_hash = randomBytes(32).toString('hex')
    await createUser({
      email,
      password_hash,
      name,
      role: role ?? 'admin',
      company_id: company_id ?? null,
      subscription_plan: subscription_plan ?? 'free',
      subscription_expires_at: subscription_expires_at ?? null,
      max_clinics: max_clinics ?? 5,
    })
  } else {
    await updateUser(existing.id, {
      name,
      ...(subscription_plan ? { subscription_plan } : {}),
      ...(subscription_expires_at !== undefined ? { subscription_expires_at } : {}),
      ...(max_clinics !== undefined ? { max_clinics } : {}),
    })
  }

  return NextResponse.json({ ok: true })
}
