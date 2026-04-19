import { SignJWT } from 'jose'

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
  nexora:        process.env.NEXT_PUBLIC_URL_NEXORA,
}

async function makeHubJwt(): Promise<string> {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? '')
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('impulsodent-hub')
    .setIssuedAt()
    .setExpirationTime('60s')
    .sign(secret)
}

function getJwtSecret(): string {
  return process.env.JWT_SECRET ?? ''
}

export async function pushUserToApps(user: {
  id: string
  email: string
  name: string
  role: string
  companyId?: string | null
  subscription_plan?: string
  subscription_expires_at?: string | null
  max_clinics?: number
}): Promise<void> {
  let token: string
  try {
    token = await makeHubJwt()
  } catch {
    return
  }

  const urls = Object.values(APP_URLS).filter((u): u is string => Boolean(u))

  await Promise.allSettled(
    urls.map((appUrl) =>
      fetch(`${appUrl}/api/sync/user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getJwtSecret()}`,
        },
        body: JSON.stringify({
          email: user.email,
          name: user.name,
          role: user.role,
          subscription_plan: user.subscription_plan,
          subscription_expires_at: user.subscription_expires_at,
          max_clinics: user.max_clinics,
          hub_token: token,
        }),
      }).catch(() => {}),
    ),
  )
}

export async function pushCompanyToApps(company: {
  slug: string
  name: string
  taxId?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  subscription_plan?: string
  subscription_expires_at?: string | null
  max_clinics?: number
  max_users?: number
  active?: boolean
}): Promise<void> {
  const secret = getJwtSecret()
  if (!secret) return

  const urls = Object.values(APP_URLS).filter((u): u is string => Boolean(u))

  await Promise.allSettled(
    urls.map((appUrl) =>
      fetch(`${appUrl}/api/sync/company`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify(company),
      }).catch(() => {}),
    ),
  )
}
