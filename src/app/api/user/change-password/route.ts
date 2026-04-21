import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as {
    currentPassword?: string
    newPassword?: string
  }

  const { currentPassword, newPassword } = body

  if (!currentPassword) {
    return NextResponse.json({ error: 'Debes introducir la contraseña actual' }, { status: 400 })
  }

  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json(
      { error: 'La nueva contraseña debe tener mínimo 8 caracteres' },
      { status: 400 },
    )
  }

  const user = await prisma.hubUser.findUnique({
    where: { id: session.id },
    select: { password_hash: true },
  })

  if (!user?.password_hash) {
    return NextResponse.json({ error: 'Error al obtener datos del usuario' }, { status: 400 })
  }

  const valid = await bcrypt.compare(currentPassword, user.password_hash)
  if (!valid) {
    return NextResponse.json({ error: 'La contraseña actual es incorrecta' }, { status: 400 })
  }

  const hashed = await bcrypt.hash(newPassword, 12)
  await prisma.hubUser.update({
    where: { id: session.id },
    data: { password_hash: hashed },
  })

  return NextResponse.json({ ok: true })
}
