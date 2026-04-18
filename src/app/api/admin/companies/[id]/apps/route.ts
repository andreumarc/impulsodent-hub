import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { setCompanyAppAccess, getCompanyAppAccess } from '@/lib/db'

async function requireSuperadmin() {
  const session = await getSession()
  if (!session || session.role !== 'superadmin') return null
  return session
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireSuperadmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const appIds = await getCompanyAppAccess(id)
  return NextResponse.json({ appIds })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireSuperadmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const { appIds } = await req.json()
  if (!Array.isArray(appIds)) return NextResponse.json({ error: 'appIds debe ser un array' }, { status: 400 })
  await setCompanyAppAccess(id, appIds)
  return NextResponse.json({ ok: true, appIds })
}
