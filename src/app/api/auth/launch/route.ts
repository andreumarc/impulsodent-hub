import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { getSession } from '@/lib/auth'
import { getUserAppRoles } from '@/lib/db'

const APP_URLS: Record<string, string | undefined> = {
  clinicpnl:     process.env.NEXT_PUBLIC_URL_CLINICPNL,
  clinicvox:     process.env.NEXT_PUBLIC_URL_CLINICVOX,
  dentalspot:    process.env.NEXT_PUBLIC_URL_DENTALSPOT,
  spendflow:     process.env.NEXT_PUBLIC_URL_SPENDFLOW,
  fichaje:       process.env.NEXT_PUBLIC_URL_FICHAJE,
  zentrix:       process.env.NEXT_PUBLIC_URL_ZENTRIX,
  nexuserp:      process.env.NEXT_PUBLIC_URL_NEXUSERP,
  dentalhr:      process.env.NEXT_PUBLIC_URL_DENTALHR,
  dentalreports: process.env.NEXT_PUBLIC_URL_DENTALREPORTS,
  clinicrefunds: process.env.NEXT_PUBLIC_URL_CLINICREFUNDS,
}

// Path where each app's SSO receiver lives
const APP_SSO_PATHS: Record<string, string> = {
  clinicpnl:     '/api/auth/hub-sso',
  clinicvox:     '/sso',
  dentalspot:    '/sso',
  spendflow:     '/sso',
  fichaje:       '/sso',
  zentrix:       '/sso',
  nexuserp:      '/sso',
  dentalhr:      '/api/auth/hub-sso',
  dentalreports: '/api/auth/hub-sso',
  clinicrefunds: '/sso',
}

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

  // Get user's specific role for this app
  let appRole = session.role === 'superadmin' ? 'superadmin' : ''
  if (session.id !== 'superadmin' && session.role !== 'superadmin') {
    const appRoles = await getUserAppRoles(session.id)
    appRole = appRoles.find((r) => r.app_id === appId)?.role ?? ''
  }

  // Sign a short-lived launch token (60s) with full user context
  const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
  const token = await new SignJWT({
    sub:        session.id,
    email:      session.email,
    name:       session.name,
    hub_role:   session.role,
    app_role:   appRole,
    app_id:     appId,
    company_id: session.companyId ?? null,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('60s')
    .setIssuer('impulsodent-hub')
    .sign(secret)

  // Redirect to app's SSO receiver with token
  const ssoPath = APP_SSO_PATHS[appId] ?? '/sso'
  const target = new URL(ssoPath, appUrl)
  target.searchParams.set('hub_token', token)
  return NextResponse.redirect(target)
}
