import { SignJWT } from 'jose'
import { prisma } from './prisma'
import { APP_URLS } from './app-urls'

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

  // Hub stores one Clinic row per (name, app_id). The user form picks ONE
  // representative row per name (`listClinicsByCompany` dedupes by name) so
  // when we resolve "the user's clinic_ids" we must look up by NAME within
  // the same company and then map to each app's specific external_id.
  const allPickedIds = Array.from(
    new Set(appRoles.flatMap((r) => (r.clinic_access_all ? [] : r.clinic_ids ?? []))),
  )
  const pickedRows = allPickedIds.length
    ? await prisma.clinic.findMany({
        where: { id: { in: allPickedIds } },
        select: { name: true, company_id: true },
      })
    : []
  // Build the (company_id, name) set for the picked clinics, then fetch every
  // sibling row across apps so we can hand each sub-app its own external_id.
  const namesByCompany = new Map<string, Set<string>>()
  for (const r of pickedRows) {
    if (!namesByCompany.has(r.company_id)) namesByCompany.set(r.company_id, new Set())
    namesByCompany.get(r.company_id)!.add(r.name)
  }
  const siblingRows = namesByCompany.size
    ? await prisma.clinic.findMany({
        where: {
          OR: Array.from(namesByCompany.entries()).map(([company_id, names]) => ({
            company_id, name: { in: Array.from(names) },
          })),
        },
        select: { app_id: true, name: true, external_id: true, company_id: true },
      })
    : []
  // appId -> Set<external_id> of clinics the user has access to
  const externalsByApp = new Map<string, Set<string>>()
  // Also remember which (company, name) pairs each picked id resolves to
  const namesPicked = new Set(pickedRows.map((r) => `${r.company_id}|${r.name}`))
  for (const sib of siblingRows) {
    if (!namesPicked.has(`${sib.company_id}|${sib.name}`)) continue
    if (!externalsByApp.has(sib.app_id)) externalsByApp.set(sib.app_id, new Set())
    externalsByApp.get(sib.app_id)!.add(sib.external_id)
  }

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
      result[appId] = Array.from(externalsByApp.get(appId) ?? [])
    }
  }
  return result
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
  /** Already-hashed bcrypt password from Hub — sub-apps store as-is. Used as fallback when plaintext isn't available (e.g. existing users). */
  password_hash?: string
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

  // Resolve the per-user picked Hub Clinic rows once so we can also send the
  // clinic *names* along with the per-app external_ids. Sub-apps that don't
  // have an app_id row in the Hub Clinic table can match by (company, name).
  const userAppRolesAll = await prisma.userAppRole.findMany({
    where: { user_id: user.id },
    select: { clinic_access_all: true, clinic_ids: true },
  })
  const pickedClinicIds = Array.from(new Set(
    userAppRolesAll.flatMap((r) => (r.clinic_access_all ? [] : r.clinic_ids ?? []))
  ))
  const pickedClinicRows = pickedClinicIds.length
    ? await prisma.clinic.findMany({
        where: { id: { in: pickedClinicIds } },
        select: { name: true, company_id: true },
      })
    : []
  const pickedClinicNames = Array.from(new Set(pickedClinicRows.map((r) => r.name)))

  await Promise.allSettled(
    appEntries.map(async ([appId, appUrl]) => {
        // Use app-specific role if set, otherwise fall back to hub role
        const appRole = appRoles.find((r) => r.app_id === appId)?.role ?? user.role
        // SUPERADMIN always gets full access to ALL clinics in every app
        const isSuperadmin = user.role === 'superadmin' || appRole === 'superadmin'
        const clinicIds: string[] | 'ALL' = isSuperadmin ? 'ALL' : (clinicIdsByApp[appId] ?? 'ALL')

        // All sub-apps (including fichaje, now Next.js on Vercel) use /api/sync/user.
        const syncPath = '/api/sync/user'
        const url = `${appUrl}${syncPath}`
        // Some sub-app schemas (DueDiligence, Nexora) treat .optional() as
        // "field absent" only — passing null fails validation. Omit null/undefined.
        const payload: Record<string, unknown> = {
          email:        user.email,
          name:         user.name,
          role:         appRole,
          company_slug: companySlug,
          clinic_ids:   clinicIds,
          // Companion list of clinic names — sub-apps fall back to this when
          // their local clinic.code (= one app's external_id) doesn't match
          // the per-app external_id sent in `clinic_ids`.
          clinic_names: clinicIds === 'ALL' ? 'ALL' : pickedClinicNames,
          hub_token:    token,
        }
        if (user.subscription_plan != null)       payload.subscription_plan       = user.subscription_plan
        if (user.subscription_expires_at != null) payload.subscription_expires_at = user.subscription_expires_at
        if (user.max_clinics != null)             payload.max_clinics             = user.max_clinics
        if (user.active != null)                  payload.active                  = user.active
        if (user.password)                        payload.password                = user.password
        if (user.password_hash && !user.password) payload.password_hash           = user.password_hash
        // Retry con backoff exponencial: 3 intentos. Cubre los casos típicos
        // en los que el sub-app está deployando o reiniciando un instante,
        // y la network falla transitoriamente. Si los 3 intentos fallan,
        // el resync masivo (rehydrate-all-apps) es el fallback definitivo.
        const attempts = 3
        const delays = [0, 1000, 4000]
        let lastErr: string | null = null
        for (let i = 0; i < attempts; i++) {
          if (delays[i]) await new Promise((r) => setTimeout(r, delays[i]))
          try {
            const res = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${secret}`,
              },
              body: JSON.stringify(payload),
              // 8s hard cap to avoid blocking.
              signal: AbortSignal.timeout(8000),
            })
            if (res.ok) {
              if (i > 0) console.log('[sync] ok-after-retry', { app_id: appId, attempt: i + 1 })
              else console.log('[sync] ok', { app_id: appId, url })
              lastErr = null
              break
            }
            const body = await res.text().catch(() => '')
            lastErr = `${res.status} ${body.slice(0, 150)}`
            // 4xx (auth, bad request) → no reintentar
            if (res.status >= 400 && res.status < 500) {
              console.error('[sync] 4xx, no retry', { app_id: appId, status: res.status, body: lastErr })
              break
            }
          } catch (err) {
            const e = err as { name?: string; message?: string }
            lastErr = `${e?.name ?? 'err'}: ${e?.message ?? String(err)}`
          }
        }
        if (lastErr) {
          console.error('[sync] FAILED after retries', { app_id: appId, endpoint: url, lastErr })
        }
      }),
  )
}

export async function pushCompanyToApps(company: {
  id?: string
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

  // Canonical payload — includes both `slug` and `hub_company_id`/`hubCompanyId`
  // so downstream sub-apps that key on either can resolve the row.
  const payload = {
    ...company,
    hub_company_id: company.id,
    hubCompanyId:   company.id,
    isActive:       company.active,
  }

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
          body: JSON.stringify(payload),
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
