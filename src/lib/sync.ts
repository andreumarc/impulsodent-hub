import { SignJWT } from 'jose'
import { prisma } from './prisma'

// Build per-app clinic_ids for a user from UserAppRole (per-app scope).
// Returns 'ALL' when that app's role has clinic_access_all=true, else the
// list of external_ids resolved from the stored hub clinic ids for that app.
async function buildClinicIdsForApps(
  userId: string,
  appIds: string[],
): Promise<Record<string, string[] | 'ALL'>> {
  const [user, appRoles] = await Promise.all([
    prisma.hubUser.findUnique({
      where: { id: userId },
      select: { clinic_access_all: true },
    }),
    prisma.userAppRole.findMany({
      where: { user_id: userId },
      select: { app_id: true, clinic_access_all: true, clinic_ids: true },
    }),
  ])
  const globalAll = user?.clinic_access_all !== false
  const byApp = new Map(appRoles.map((r) => [r.app_id, r]))

  // Resolve hub clinic ids -> external_ids (scoped to app)
  const allHubClinicIds = Array.from(
    new Set(appRoles.flatMap((r) => (r.clinic_access_all ? [] : r.clinic_ids ?? []))),
  )
  const clinicRows = allHubClinicIds.length
    ? await prisma.clinic.findMany({
        where: { id: { in: allHubClinicIds } },
        select: { id: true, app_id: true, external_id: true },
      })
    : []
  const clinicById = new Map(clinicRows.map((c) => [c.id, c]))

  const result: Record<string, string[] | 'ALL'> = {}
  for (const appId of appIds) {
    const r = byApp.get(appId)
    if (!r) {
      // No app role set: fall back to global (legacy users pre-migration)
      result[appId] = globalAll ? 'ALL' : []
      continue
    }
    if (r.clinic_access_all) {
      result[appId] = 'ALL'
    } else {
      result[appId] = (r.clinic_ids ?? [])
        .map((hid) => clinicById.get(hid))
        .filter((c): c is { id: string; app_id: string; external_id: string } => !!c && c.app_id === appId)
        .map((c) => c.external_id)
    }
  }
  return result
}

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
  clinicstock:   process.env.NEXT_PUBLIC_URL_CLINICSTOCK,
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
  /** Plain password — sent only when creating the user or changing password. Sub-apps hash locally with their own bcrypt rounds. */
  password?: string
  active?: boolean
}): Promise<void> {
  let token: string
  try {
    token = await makeHubJwt()
  } catch {
    return
  }

  // Look up company slug for cross-app tenant filtering
  let companySlug: string | null = null
  if (user.companyId) {
    try {
      const company = await prisma.company.findUnique({
        where: { id: user.companyId },
        select: { slug: true },
      })
      companySlug = company?.slug ?? null
    } catch { /* non-fatal */ }
  }

  // Look up per-app roles for this user
  let appRoles: { app_id: string; role: string }[] = []
  try {
    appRoles = await prisma.userAppRole.findMany({ where: { user_id: user.id } })
  } catch { /* non-fatal */ }

  const secret = getJwtSecret()
  const appEntries = Object.entries(APP_URLS).filter((entry): entry is [string, string] => Boolean(entry[1]))
  const clinicIdsByApp = await buildClinicIdsForApps(user.id, appEntries.map(([id]) => id))

  await Promise.allSettled(
    appEntries.map(async ([appId, appUrl]) => {
        // Use app-specific role if set, otherwise fall back to hub role
        const appRole = appRoles.find((r) => r.app_id === appId)?.role ?? user.role

        // All sub-apps (including fichaje, now Next.js on Vercel) use /api/sync/user.
        const syncPath = '/api/sync/user'
        const url = `${appUrl}${syncPath}`
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${secret}`,
            },
            body: JSON.stringify({
              email:                   user.email,
              name:                    user.name,
              role:                    appRole,
              company_slug:            companySlug,
              clinic_ids:              clinicIdsByApp[appId] ?? 'ALL',
              subscription_plan:       user.subscription_plan,
              subscription_expires_at: user.subscription_expires_at,
              max_clinics:             user.max_clinics,
              active:                  user.active,
              password:                user.password,
              hub_token:               token,
            }),
          })
          if (!res.ok) {
            const body = await res.text().catch(() => '')
            console.error('[sync] non-ok response', { app_id: appId, url, status: res.status, body: body.slice(0, 200) })
          } else {
            console.log('[sync] ok', { app_id: appId, url })
          }
        } catch (err) {
          const e = err as { status?: number; message?: string }
          console.error('[sync] failed', { app_id: appId, endpoint: url, status: e?.status, message: e?.message ?? String(err) })
        }
      }),
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
    urls.map(async (appUrl) => {
      const url = `${appUrl}/api/sync/company`
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${secret}`,
          },
          body: JSON.stringify(company),
        })
        if (!res.ok) {
          const body = await res.text().catch(() => '')
          console.error('[sync] non-ok response', { app_id: appUrl, url, status: res.status, body: body.slice(0, 200) })
        } else {
          console.log('[sync] ok', { app_id: appUrl, url })
        }
      } catch (err) {
        const e = err as { status?: number; message?: string }
        console.error('[sync] failed', { app_id: appUrl, endpoint: url, status: e?.status, message: e?.message ?? String(err) })
      }
    }),
  )
}
