// POST /api/sync/clinics — sub-apps register their clinics here
import { NextRequest, NextResponse } from 'next/server'
import { upsertClinic } from '@/lib/db'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.JWT_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || !Array.isArray(body.clinics) || !body.app_id || !body.company_slug) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }

  const company = await prisma.company.findUnique({
    where: { slug: body.company_slug },
    select: { id: true },
  })
  if (!company) return NextResponse.json({ error: 'company not found' }, { status: 404 })

  await Promise.all(
    (body.clinics as { id: string; name: string; active?: boolean }[]).map((c) =>
      upsertClinic({
        external_id: c.id,
        app_id: body.app_id,
        name: c.name,
        company_id: company.id,
        active: c.active !== false,
      }),
    ),
  )

  return NextResponse.json({ ok: true, upserted: body.clinics.length })
}
