import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getCompany, updateCompany, deleteCompany, getCompanyAppAccess } from '@/lib/db'

async function requireSuperadmin() {
  const session = await getSession()
  if (!session || session.role !== 'superadmin') return null
  return session
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireSuperadmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const company = await getCompany(id)
  if (!company) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  const appIds = await getCompanyAppAccess(id)
  return NextResponse.json({ ...company, appIds })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireSuperadmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const body = await req.json()
  try {
    const updated = await updateCompany(id, body)
    return NextResponse.json(updated)
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireSuperadmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  try {
    await deleteCompany(id)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}
