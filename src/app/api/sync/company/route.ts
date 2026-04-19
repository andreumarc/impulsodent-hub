import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function verifyBearer(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  return token === process.env.JWT_SECRET
}

export async function POST(req: NextRequest) {
  if (!verifyBearer(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    slug?: string; name?: string; taxId?: string | null
    email?: string | null; phone?: string | null; address?: string | null
    active?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { slug, name, taxId, email, phone, address, active } = body
  if (!slug || !name) {
    return NextResponse.json({ error: 'slug y name son obligatorios' }, { status: 400 })
  }

  await prisma.company.upsert({
    where: { slug },
    update: {
      name,
      cif: taxId ?? undefined,
      email: email ?? undefined,
      phone: phone ?? undefined,
      address: address ?? undefined,
      active: active ?? true,
    },
    create: {
      slug,
      name,
      cif: taxId ?? null,
      email: email ?? null,
      phone: phone ?? null,
      address: address ?? null,
      active: active ?? true,
    },
  })

  return NextResponse.json({ ok: true })
}
