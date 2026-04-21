import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getSession } from '@/lib/auth'
import {
  listUsers, createUser, getUserByEmail,
  setUserAppRoles, setUserClinicAccess, setUserClinicAccessAll,
  upsertExternalUser,
} from '@/lib/db'
import { getInitials } from '@/lib/utils'
import { pushUserToApps } from '@/lib/sync'

const APP_URLS: Record<string, string | undefined> = {
  clinicpnl:     process.env.NEXT_PUBLIC_URL_CLINICPNL,
  dentalhr:      process.env.NEXT_PUBLIC_URL_DENTALHR,
  dentalreports: process.env.NEXT_PUBLIC_URL_DENTALREPORTS,
  nexora:        process.env.NEXT_PUBLIC_URL_NEXORA,
  fichaje:       process.env.NEXT_PUBLIC_URL_FICHAJE,
  zentrix:       process.env.NEXT_PUBLIC_URL_ZENTRIX,
  spendflow:     process.env.NEXT_PUBLIC_URL_SPENDFLOW,
  clinicvox:     process.env.NEXT_PUBLIC_URL_CLINICVOX,
  dentalspot:    process.env.NEXT_PUBLIC_URL_DENTALSPOT,
  clinicrefunds: process.env.NEXT_PUBLIC_URL_CLINICREFUNDS,
  clinicstock:   process.env.NEXT_PUBLIC_URL_CLINICSTOCK,
}

async function requireSuperadmin() {
  const session = await getSession()
  if (!session || session.role !== 'superadmin') return null
  return session
}

async function requireAdmin() {
  const session = await getSession()
  if (!session || (session.role !== 'superadmin' && session.role !== 'admin')) return null
  return session
}

export async function GET(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let companyId = req.nextUrl.searchParams.get('companyId')
  const pull      = req.nextUrl.searchParams.get('pull') === '1'
  const onlyApp   = req.nextUrl.searchParams.get('app_id') ?? undefined

  // Admin is scoped to their own company
  if (session.role === 'admin') {
    if (!session.companyId) return NextResponse.json([], { status: 200 })
    if (companyId && companyId !== session.companyId) {
      return NextResponse.json({ error: 'Forbidden (cross-company)' }, { status: 403 })
    }
    companyId = session.companyId
  }

  if (pull) {
    const secret = process.env.JWT_SECRET ?? ''
    const summary: { app_id: string; ok: boolean; created: number; updated: number; error?: string }[] = []

    await Promise.allSettled(
      Object.entries(APP_URLS)
        .filter((e): e is [string, string] => Boolean(e[1]))
        .filter(([appId]) => !onlyApp || onlyApp === appId)
        .map(async ([appId, appUrl]) => {
          try {
            const qs = companyId ? `?company_id=${encodeURIComponent(companyId)}` : ''
            const r = await fetch(`${appUrl.replace(/\/$/, '')}/api/sync/users${qs}`, {
              headers: { Authorization: `Bearer ${secret}` },
              signal: AbortSignal.timeout(15000),
            })
            if (!r.ok) {
              summary.push({ app_id: appId, ok: false, created: 0, updated: 0, error: `HTTP ${r.status}` })
              return
            }
            const data = await r.json() as Array<{
              email: string; name?: string; role?: string; company_slug?: string | null
            }>
            let created = 0, updated = 0
            for (const u of data) {
              if (!u?.email) continue
              try {
                const res = await upsertExternalUser({
                  email:        u.email,
                  name:         u.name || u.email,
                  role:         (u.role || 'admin').toLowerCase(),
                  company_slug: u.company_slug ?? null,
                  app_id:       appId,
                  app_role:     u.role,
                })
                if (res.created) created++; else updated++
              } catch { /* row-level errors are non-fatal */ }
            }
            summary.push({ app_id: appId, ok: true, created, updated })
          } catch (err) {
            summary.push({
              app_id: appId, ok: false, created: 0, updated: 0,
              error: err instanceof Error ? err.message : 'unknown',
            })
          }
        }),
    )

    const all = await listUsers()
    const users = companyId ? all.filter((u) => u.company_id === companyId) : all
    return NextResponse.json({
      pull: summary,
      users: users.map((u) => ({ ...u, password_hash: undefined })),
    })
  }

  const all = await listUsers()
  const users = companyId ? all.filter((u) => u.company_id === companyId) : all
  return NextResponse.json(users.map((u) => ({ ...u, password_hash: undefined })))
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  let { company_id } = body
  const { email, password, name, role, app_roles, subscription_plan, subscription_expires_at, max_clinics, clinic_access_all, clinic_ids } = body

  if (!email || !password || !name || !role) {
    return NextResponse.json({ error: 'email, password, name y role son obligatorios' }, { status: 400 })
  }

  // Admin is scoped to their own company and cannot create superadmins
  if (session.role === 'admin') {
    if (!session.companyId) return NextResponse.json({ error: 'Admin sin empresa asignada' }, { status: 403 })
    if (company_id && company_id !== session.companyId) {
      return NextResponse.json({ error: 'Forbidden (cross-company)' }, { status: 403 })
    }
    if (role === 'superadmin') {
      return NextResponse.json({ error: 'No puedes crear usuarios superadmin' }, { status: 403 })
    }
    company_id = session.companyId
  }

  const existing = await getUserByEmail(email)
  if (existing) return NextResponse.json({ error: 'El email ya está en uso' }, { status: 409 })

  const password_hash = await bcrypt.hash(password, 10)

  const user = await createUser({
    email,
    password_hash,
    name,
    role,
    company_id: company_id || null,
    subscription_plan: subscription_plan ?? 'free',
    subscription_expires_at: subscription_expires_at || null,
    max_clinics: max_clinics ?? 5,
    clinic_access_all: clinic_access_all !== false,
  })

  // Set clinic access
  const accessAll = clinic_access_all !== false
  await setUserClinicAccessAll(user.id, accessAll)
  if (!accessAll && Array.isArray(clinic_ids) && clinic_ids.length > 0) {
    await setUserClinicAccess(user.id, clinic_ids)
  }

  if (Array.isArray(app_roles) && app_roles.length > 0) {
    await setUserAppRoles(user.id, app_roles.filter((r: { app_id: string; role: string }) => r.role))
  }

  // fire-and-forget sync to all apps
  pushUserToApps({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companyId: user.company_id,
    subscription_plan: user.subscription_plan,
    subscription_expires_at: user.subscription_expires_at,
    max_clinics: user.max_clinics,
  }).catch(() => {})

  return NextResponse.json(
    { ...user, password_hash: undefined, initials: getInitials(user.name) },
    { status: 201 },
  )
}
