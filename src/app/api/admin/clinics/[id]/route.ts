import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { deleteClinic, updateClinic } from '@/lib/db'
import { prisma } from '@/lib/prisma'

const APP_URLS: Record<string, string | undefined> = {
  clinicpnl:     process.env.NEXT_PUBLIC_URL_CLINICPNL,
  dentalhr:      process.env.NEXT_PUBLIC_URL_DENTALHR,
  dentalreports: process.env.NEXT_PUBLIC_URL_DENTALREPORTS,
  nexora:        process.env.NEXT_PUBLIC_URL_NEXORA,
  fichaje:       process.env.NEXT_PUBLIC_URL_FICHAJE,
  zentrix:       process.env.NEXT_PUBLIC_URL_ZENTRIX,
  spendflow:     process.env.NEXT_PUBLIC_URL_SPENDFLOW,
  clinicvox:     process.env.NEXT_PUBLIC_URL_CLINICVOX,
}

async function pushToSubApp(clinic: { app_id: string; external_id: string; name: string; active: boolean; company_id: string }) {
  try {
    const company = await prisma.company.findUnique({ where: { id: clinic.company_id }, select: { slug: true } })
    const appUrl = APP_URLS[clinic.app_id]
    const secret = process.env.JWT_SECRET ?? ''
    if (!company?.slug || !appUrl || !secret) return
    const syncPath = '/api/sync/clinics'
    await fetch(`${appUrl}${syncPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({
        app_id: clinic.app_id,
        company_slug: company.slug,
        clinics: [{ id: clinic.external_id, name: clinic.name, active: clinic.active }],
      }),
      signal: AbortSignal.timeout(6000),
    }).catch(() => {})
  } catch { /* non-fatal */ }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const body = await req.json().catch(() => ({})) as { name?: string; active?: boolean }
  const clinic = await updateClinic(id, body)
  // Propagate to sub-app
  await pushToSubApp(clinic)
  return NextResponse.json(clinic)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  // Read before delete, then notify sub-app to deactivate
  const existing = await prisma.clinic.findUnique({ where: { id } })
  if (existing) {
    await pushToSubApp({ ...existing, active: false })
  }
  await deleteClinic(id)
  return NextResponse.json({ ok: true })
}
