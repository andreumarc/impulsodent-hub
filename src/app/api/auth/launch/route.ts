import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { getSession } from '@/lib/auth'
import { getUserAppRoles, getCompany } from '@/lib/db'

const APP_URLS: Record<string, string | undefined> = {
  clinicpnl:          process.env.NEXT_PUBLIC_URL_CLINICPNL,
  clinicvox:          process.env.NEXT_PUBLIC_URL_CLINICVOX,
  dentalspot:         process.env.NEXT_PUBLIC_URL_DENTALSPOT,
  spendflow:          process.env.NEXT_PUBLIC_URL_SPENDFLOW,
  fichaje:            process.env.NEXT_PUBLIC_URL_FICHAJE,
  zentrix:            process.env.NEXT_PUBLIC_URL_ZENTRIX,
  nexuserp:           process.env.NEXT_PUBLIC_URL_NEXUSERP,
  dentalhr:           process.env.NEXT_PUBLIC_URL_DENTALHR,
  dentalreports:      process.env.NEXT_PUBLIC_URL_DENTALREPORTS,
  clinicrefunds:      process.env.NEXT_PUBLIC_URL_CLINICREFUNDS,
  nexora:             process.env.NEXT_PUBLIC_URL_NEXORA,
  clinicstock:        process.env.NEXT_PUBLIC_URL_CLINICSTOCK,
  'impulsodent-crm':  process.env.NEXT_PUBLIC_URL_IMPULSODENT_CRM,
}

// Each app's SSO receiver path
const APP_SSO_PATHS: Record<string, string> = {
  clinicpnl:          '/api/auth/hub-sso',  // Supabase
  clinicvox:          '/api/auth/hub-sso',  // NextAuth
  dentalspot:         '/api/auth/hub-sso',  // NextAuth
  spendflow:          '/sso',               // NestJS — needs client-side localStorage
  fichaje:            '/sso',               // NestJS — needs client-side localStorage
  zentrix:            '/api/auth/hub-sso',  // NextAuth
  nexuserp:           '/sso',               // NestJS
  dentalhr:           '/api/auth/hub-sso',  // Custom Prisma
  dentalreports:      '/api/auth/hub-sso',  // Supabase
  clinicrefunds:      '/api/auth/hub-sso',  // NextAuth
  nexora:             '/api/auth/hub-sso',  // NextAuth
  clinicstock:        '/api/auth/hub-sso',  // NextAuth
  'impulsodent-crm':  '/api/auth/hub-sso',  // NextAuth v5
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

  // Look up company slug for cross-app tenant filtering
  let companySlug: string | null = null
  if (session.companyId) {
    const company = await getCompany(session.companyId)
    companySlug = company?.slug ?? null
  }

  // Get user's role for this specific app
  let appRole = session.role === 'superadmin' ? 'superadmin' : ''
  if (session.role !== 'superadmin') {
    const appRoles = await getUserAppRoles(session.id)
    appRole = appRoles.find((r) => r.app_id === appId)?.role ?? session.role
  }

  const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
  const token = await new SignJWT({
    sub:        session.id,
    email:      session.email,
    name:       session.name,
    hub_role:   session.role,
    app_role:   appRole,
    app_id:     appId,
    company_id:   session.companyId ?? null,
    company_slug: companySlug,
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
