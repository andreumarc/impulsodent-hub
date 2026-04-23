import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { deleteClinic, updateClinic } from '@/lib/db'
import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/permissions'

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

async function pushDeleteToSubApp(clinic: { app_id: string; external_id: string; company_id: string }) {
  try {
    const company = await prisma.company.findUnique({ where: { id: clinic.company_id }, select: { slug: true } })
    const appUrl = APP_URLS[clinic.app_id]
    const secret = process.env.JWT_SECRET ?? ''
    if (!company?.slug || !appUrl || !secret) return
    // Best-effort real DELETE; sub-apps that don't expose it will 404/405 and we fall back to soft-delete upsert below.
    const url = `${appUrl}/api/sync/clinics/${encodeURIComponent(clinic.external_id)}?company_slug=${encodeURIComponent(company.slug)}`
    try {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(6000),
      })
      if (!res.ok && res.status !== 404 && res.status !== 405) {
        console.error('[sync] delete non-ok', { app_id: clinic.app_id, url, status: res.status })
      } else {
        console.log('[sync] delete', { app_id: clinic.app_id, url, status: res.status })
      }
    } catch (err) {
      console.error('[sync] delete failed', { app_id: clinic.app_id, url, message: (err as Error).message })
    }
  } catch { /* non-fatal */ }
}

async function pushToSubApp(clinic: { app_id: string; external_id: string; name: string; active: boolean; company_id: string }) {
  try {
    const company = await prisma.company.findUnique({ where: { id: clinic.company_id }, select: { slug: true } })
    const appUrl = APP_URLS[clinic.app_id]
    const secret = process.env.JWT_SECRET ?? ''
    if (!company?.slug || !appUrl || !secret) return
    const syncPath = '/api/sync/clinics'
    const url = `${appUrl}${syncPath}`
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
        body: JSON.stringify({
          app_id: clinic.app_id,
          company_slug: company.slug,
          clinics: [{ id: clinic.external_id, name: clinic.name, active: clinic.active }],
        }),
        signal: AbortSignal.timeout(6000),
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        console.error('[sync] non-ok response', { app_id: clinic.app_id, url, status: res.status, body: body.slice(0, 200) })
      } else {
        console.log('[sync] ok', { app_id: clinic.app_id, url })
      }
    } catch (err) {
      const e = err as { status?: number; message?: string }
      console.error('[sync] failed', { app_id: clinic.app_id, endpoint: url, status: e?.status, message: e?.message ?? String(err) })
    }
  } catch (err) {
    const e = err as { status?: number; message?: string }
    console.error('[sync] failed', { app_id: clinic.app_id, endpoint: 'pushToSubApp', status: e?.status, message: e?.message ?? String(err) })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || !hasPermission(session.role, 'clinics:manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  // Admin can only update clinics belonging to their own company
  if (session.role !== 'superadmin' && session.companyId) {
    const existing = await prisma.clinic.findUnique({ where: { id } })
    if (!existing || existing.company_id !== session.companyId) {
      return NextResponse.json({ error: 'Forbidden (cross-company)' }, { status: 403 })
    }
  }
  const body = await req.json().catch(() => ({})) as { name?: string; active?: boolean }
  const clinic = await updateClinic(id, body)
  // Propagate to sub-app
  await pushToSubApp(clinic)
  return NextResponse.json(clinic)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || !hasPermission(session.role, 'clinics:manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const existing = await prisma.clinic.findUnique({ where: { id } })
  if (!existing) {
    await deleteClinic(id).catch(() => {})
    return NextResponse.json({ ok: true })
  }
  if (session.role !== 'superadmin' && session.companyId && existing.company_id !== session.companyId) {
    return NextResponse.json({ error: 'Forbidden (cross-company)' }, { status: 403 })
  }

  // A clinic is replicated across multiple app rows sharing the same external_id.
  // Delete ALL matching rows in Hub and push deactivate to every sub-app that had it.
  const siblings = await prisma.clinic.findMany({
    where: { external_id: existing.external_id, company_id: existing.company_id },
  })

  // Try real DELETE first (sub-apps that support it), then soft-delete fallback
  await Promise.allSettled(siblings.map((s) => pushDeleteToSubApp(s)))
  await Promise.allSettled(siblings.map((s) => pushToSubApp({ ...s, active: false })))
  await prisma.clinic.deleteMany({
    where: { external_id: existing.external_id, company_id: existing.company_id },
  })

  return NextResponse.json({ ok: true, deleted: siblings.length })
}
