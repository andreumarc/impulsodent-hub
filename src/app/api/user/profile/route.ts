import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/user/profile — datos del usuario logueado
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.hubUser.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      clinic_access_all: true,
      subscription_plan: true,
      created_at: true,
      company: {
        select: { id: true, name: true, slug: true, city: true, email: true, phone: true },
      },
      clinicAccess: {
        select: {
          clinic: {
            select: { id: true, name: true, app_id: true, external_id: true, active: true },
          },
        },
      },
      appRoles: {
        select: { app_id: true, role: true },
      },
    },
  })

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  return NextResponse.json(user)
}

// PUT /api/user/profile — actualizar nombre propio
export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { name?: string }

  if (!body.name || body.name.trim().length < 2) {
    return NextResponse.json({ error: 'El nombre debe tener al menos 2 caracteres' }, { status: 400 })
  }

  await prisma.hubUser.update({
    where: { id: session.id },
    data: { name: body.name.trim() },
  })

  return NextResponse.json({ ok: true })
}
