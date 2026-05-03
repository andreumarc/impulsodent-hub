import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { getSession } from '@/lib/auth'
import { getUserAppRoles, getCompany } from '@/lib/db'
import { APP_URLS, APP_SSO_PATHS } from '@/lib/app-urls'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const appId = req.nextUrl.searchParams.get('appId')
  if (!appId) return NextResponse.json({ error: 'appId requerido' }, { status: 400 })

  const appUrl = APP_URLS[appId]
  if (!appUrl || appUrl === '#') {
    return NextResponse.json({ error: 'Aplicación no configurada' }, { status: 404 })
  }

  // Look up company slug + name for cross-app tenant filtering / JIT company creation
  let companySlug: string | null = null
  let companyName: string | null = null
  if (session.companyId) {
    const company = await getCompany(session.companyId)
    companySlug = company?.slug ?? null
    companyName = company?.name ?? null
  }

  // Get user's role and clinic access for this specific app.
  // ENFORCE: si no hay app_role para esta app o el rol está vacío
  // ('Sin acceso'), denegar el launch — antes hacíamos fallback a
  // session.role global, lo que dejaba entrar al usuario en TODAS
  // las apps independientemente de los toggles "Sin acceso" del admin.
  let appRole = session.role === 'superadmin' ? 'superadmin' : ''
  let clinicIds: string[] | 'ALL' = 'ALL'
  if (session.role !== 'superadmin') {
    const appRoles = await getUserAppRoles(session.id)
    const appRoleRow = appRoles.find((r) => r.app_id === appId)
    if (!appRoleRow || !appRoleRow.role || appRoleRow.role.trim() === '') {
      // Redirigir al hub con un flash de error en query param.
      const hubUrl = new URL('/dashboard', req.url)
      hubUrl.searchParams.set('error', 'no_app_access')
      hubUrl.searchParams.set('app', appId)
      return NextResponse.redirect(hubUrl)
    }
    appRole = appRoleRow.role
    clinicIds = appRoleRow.clinic_access_all ? 'ALL' : (appRoleRow.clinic_ids ?? [])
  }

  // Audit 2026-05 — assert secret strength. An empty/short JWT_SECRET would
  // produce HS256 tokens accepted by every sub-app (they verify with the same
  // env var), so misconfigured deploys must fail loudly here.
  const rawSecret = process.env.JWT_SECRET ?? ''
  if (rawSecret.length < 32) {
    return NextResponse.json(
      { error: 'JWT_SECRET missing or too short (min 32 chars)' },
      { status: 500 },
    )
  }
  const secret = new TextEncoder().encode(rawSecret)
  const token = await new SignJWT({
    sub:          session.id,
    email:        session.email,
    name:         session.name,
    hub_role:     session.role,
    app_role:     appRole,
    app_id:       appId,
    company_id:   session.companyId ?? null,
    company_slug: companySlug,
    company_name: companyName,
    clinic_ids:   clinicIds,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('60s')
    .setIssuer('impulsodent-hub')
    .sign(secret)

  const ssoPath = APP_SSO_PATHS[appId] ?? '/api/auth/hub-sso'
  const target = new URL(ssoPath, appUrl)
  target.searchParams.set('hub_token', token)
  return NextResponse.redirect(target)
}
