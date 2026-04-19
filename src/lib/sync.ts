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

export async function pushUserToApps(user: {
  id: string
  email: string
  name: string
  role: string
  companyId?: string | null
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
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: user.email,
          name: user.name,
          role: user.role,
          hub_token: token,
        }),
      }).catch(() => {}),
    ),
  )
}
