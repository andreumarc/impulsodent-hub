/**
 * Hub ↔ sub-apps sync audit.
 *
 * Reads the Hub canonical state (HubUser, Company, Clinic, UserAppRole, UserCompanyAccess,
 * UserClinicAccess, CompanyAppAccess) directly via Prisma, then for each configured
 * sub-app calls the read-only sync endpoints (GET /api/sync/users, GET /api/sync/clinics)
 * with `Authorization: Bearer ${HUB_JWT_SECRET}`.
 *
 * Strict one-way contract: this audit NEVER writes back to the Hub from sub-app data
 * (see feedback memory `feedback_hub_oneway_sync.md`). Anything in a sub-app that is
 * not in the Hub is reported as `orphan_*` and must be cleaned in the sub-app, never
 * promoted to the Hub.
 *
 * Consumed by:
 *   - `scripts/audit-sync.ts`  (CLI, current)
 *   - `app/api/admin/audit`    (future Hub admin page)
 */
import { prisma } from './prisma'
import { APP_URLS } from './app-urls'

// ─── Public types ─────────────────────────────────────────────────────────────

export type FindingSeverity = 'error' | 'warning' | 'info'

export type FindingCategory =
  | 'app_unreachable'
  | 'endpoint_missing'
  | 'orphan_user'
  | 'missing_user'
  | 'role_drift'
  | 'orphan_clinic'
  | 'missing_clinic'
  | 'orphan_company'
  | 'missing_company'

export interface AuditFinding {
  severity: FindingSeverity
  app_id: string
  category: FindingCategory
  message: string
  details?: Record<string, unknown>
}

export interface HubSnapshot {
  users: Array<{
    email: string
    name: string
    role: string
    active: boolean
    clinic_access_all: boolean
    company_access_all: boolean
    company_slug: string | null
    company_slugs: string[]
  }>
  companies: Array<{ slug: string; name: string; active: boolean }>
  clinics: Array<{
    external_id: string
    app_id: string
    name: string
    company_slug: string
    active: boolean
  }>
  user_app_roles: Array<{ email: string; app_id: string; role: string }>
  company_app_access: Array<{ company_slug: string; app_id: string }>
}

export interface AppUserRow {
  email: string
  name?: string
  role?: string
  company_slug?: string | null
  active?: boolean
}

export interface AppClinicRow {
  id: string
  name: string
  active: boolean
  // Some sub-apps return `isActive` instead of (or alongside) `active`.
  isActive?: boolean
  // Canonical Hub external_id when the sub-app stores the local `id` as a
  // separate auto-generated key. The audit prefers this for matching.
  hub_clinic_id?: string | null
  hubClinicId?: string | null
}

function clinicIsActive(c: AppClinicRow): boolean {
  if (c.active === false) return false
  if (c.isActive === false) return false
  return true
}

function clinicCanonicalId(c: AppClinicRow): string {
  // Prefer the sub-app's stored Hub external_id over its local primary key.
  // Many sub-apps generate their own cuid/uuid for `id` while storing the
  // canonical Hub id under `hubClinicId` / `hub_clinic_id`.
  return c.hub_clinic_id ?? c.hubClinicId ?? c.id
}

export interface AppAuditResult {
  app_id: string
  app_url: string | null
  reachable: boolean
  users_endpoint_status: number | null
  clinics_endpoint_status: number | null
  hub_users_expected: AppUserRow[]
  app_users_returned: AppUserRow[]
  orphan_users: AppUserRow[]
  missing_users: AppUserRow[]
  role_mismatches: Array<{ email: string; hub_role: string; app_role: string }>
  hub_clinics_expected: AppClinicRow[]
  app_clinics_returned: AppClinicRow[]
  orphan_clinics: AppClinicRow[]
  missing_clinics: AppClinicRow[]
  errors: string[]
}

export interface AuditSummary {
  total_apps_configured: number
  apps_reachable: number
  apps_unreachable: number
  total_findings: number
  errors: number
  warnings: number
  infos: number
}

export interface AuditReport {
  generated_at: string
  hub: HubSnapshot
  apps: AppAuditResult[]
  findings: AuditFinding[]
  summary: AuditSummary
}

// ─── Role normalization (canonical 7) ─────────────────────────────────────────

const ROLE_ALIASES: Record<string, string> = {
  // canonical
  SUPERADMIN: 'SUPERADMIN',
  ADMIN: 'ADMIN',
  DIRECCION_GENERAL: 'DIRECCION_GENERAL',
  DIRECCION_CLINICA: 'DIRECCION_CLINICA',
  RRHH: 'RRHH',
  ODONTOLOGO: 'ODONTOLOGO',
  AUXILIAR: 'AUXILIAR',
  DEMO: 'DEMO',
  // common aliases / fossils we accept as equivalent for the purpose of drift detection
  SUPER_ADMIN: 'SUPERADMIN',
  OWNER: 'SUPERADMIN',
  COMPANY_ADMIN: 'ADMIN',
  ORG_ADMIN: 'ADMIN',
  HR: 'RRHH',
  MANAGER: 'DIRECCION_CLINICA',
  EMPLOYEE: 'AUXILIAR',
  USER: 'AUXILIAR',
  STAFF: 'AUXILIAR',
}

function normalizeRole(raw: string | null | undefined): string {
  if (!raw) return 'UNKNOWN'
  const upper = raw.toUpperCase().trim()
  return ROLE_ALIASES[upper] ?? upper
}

// Some sub-apps don't have a dedicated 'DEMO' or 'VIEWER' value in their role
// enum and legitimately store the demo/superadmin user as the lowest-privilege
// canonical (AUXILIAR). When the Hub says role X but the sub-app reports a role
// in this app's accepted-fallback set, the audit treats it as expected mapping
// rather than drift. Keys are the Hub canonical (UPPERCASE), values are the
// app-side canonicals that we accept as equivalent.
const ROLE_FALLBACK_ACCEPT: Record<string, Set<string>> = {
  // DEMO doesn't exist in most sub-app enums — accept all reasonable mappings.
  DEMO: new Set([
    'AUXILIAR', 'VIEWER', 'EMPLEADO', 'EMPLOYEE', 'STAFF', 'USER',
    'DIRECCION', 'DIRECCION_GENERAL', 'DIRECCION_CLINICA', 'GESTOR',
    'RECEPTION',
  ]),
  // SUPERADMIN: some sub-apps (dental-hr, ddc) collapse to ADMIN/AUXILIAR/OWNER.
  SUPERADMIN: new Set(['AUXILIAR', 'ADMIN', 'OWNER']),
  // DIRECCION_CLINICA: apps with simpler role enums collapse this into a
  // generic 'DIRECCION', 'DIRECTOR' or 'DIRECCION_GENERAL'. Some legacy
  // schemas use 'DIRECCIÓN' (with accent). Accept the wide set as expected
  // mapping rather than drift.
  DIRECCION_CLINICA: new Set([
    'DIRECCION', 'DIRECTOR', 'DIRECCION_GENERAL', 'DIRECCIÓN',
    'GESTOR', 'MANAGER', 'CLINIC_ADMIN', 'CLINIC_DIRECTOR',
    'EMPLEADO', 'EMPLOYEE', 'AUXILIAR', // some apps collapse all "non-admin" to lowest
  ]),
  // DIRECCION_GENERAL: same shape but at the company level.
  DIRECCION_GENERAL: new Set([
    'DIRECCION', 'DIRECTOR', 'DIRECCION_CLINICA', 'DIRECCIÓN',
    'GESTOR', 'MANAGER', 'OWNER', 'ADMIN',
  ]),
  // RRHH: apps without a dedicated HR role tend to collapse to AUXILIAR or
  // a generic "RECEPTION".
  RRHH: new Set(['HR', 'AUXILIAR', 'RECEPTION', 'EMPLEADO', 'EMPLOYEE']),
  // ODONTOLOGO: apps without dentist-specific role tend to put them in
  // AUXILIAR / DENTIST.
  ODONTOLOGO: new Set(['DENTIST', 'DOCTOR', 'AUXILIAR', 'EMPLEADO']),
}

function rolesMatch(hubRole: string, appRole: string): boolean {
  const h = normalizeRole(hubRole)
  const a = normalizeRole(appRole)
  if (h === a) return true
  return ROLE_FALLBACK_ACCEPT[h]?.has(a) ?? false
}

// ─── Hub snapshot ─────────────────────────────────────────────────────────────

async function readHubSnapshot(): Promise<HubSnapshot> {
  const [users, companies, clinics, userAppRoles, companyAppAccess] = await Promise.all([
    prisma.hubUser.findMany({
      where: { active: true },
      include: {
        company: { select: { slug: true } },
        companyAccess: { include: { company: { select: { slug: true } } } },
      },
      orderBy: { email: 'asc' },
    }),
    prisma.company.findMany({ orderBy: { slug: 'asc' } }),
    prisma.clinic.findMany({
      where: { active: true },
      include: { company: { select: { slug: true } } },
      orderBy: [{ app_id: 'asc' }, { name: 'asc' }],
    }),
    prisma.userAppRole.findMany({
      include: { user: { select: { email: true } } },
    }),
    prisma.companyAppAccess.findMany({
      include: { company: { select: { slug: true } } },
    }),
  ])

  return {
    users: users.map((u) => ({
      email: u.email,
      name: u.name,
      role: u.role,
      active: u.active,
      clinic_access_all: u.clinic_access_all,
      company_access_all: u.company_access_all,
      company_slug: u.company?.slug ?? null,
      company_slugs: u.companyAccess.length > 0
        ? u.companyAccess.map((ca) => ca.company.slug)
        : (u.company ? [u.company.slug] : []),
    })),
    companies: companies.map((c) => ({ slug: c.slug, name: c.name, active: c.active })),
    clinics: clinics.map((c) => ({
      external_id: c.external_id,
      app_id: c.app_id,
      name: c.name,
      company_slug: c.company.slug,
      active: c.active,
    })),
    user_app_roles: userAppRoles.map((r) => ({
      email: r.user.email,
      app_id: r.app_id,
      role: r.role,
    })),
    company_app_access: companyAppAccess.map((a) => ({
      company_slug: a.company.slug,
      app_id: a.app_id,
    })),
  }
}

// ─── Sub-app fetchers ─────────────────────────────────────────────────────────

interface FetchedList<T> {
  status: number | null
  data: T[]
  error?: string
}

async function fetchSubAppList<T>(url: string, secret: string): Promise<FetchedList<T>> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { status: res.status, data: [], error: body.slice(0, 200) }
    }
    const json = (await res.json()) as unknown
    return { status: res.status, data: Array.isArray(json) ? (json as T[]) : [] }
  } catch (err) {
    const e = err as { name?: string; message?: string }
    return { status: null, data: [], error: `${e?.name ?? 'err'}: ${e?.message ?? String(err)}` }
  }
}

// ─── Per-app audit ────────────────────────────────────────────────────────────

function expectedUsersForApp(snap: HubSnapshot, appId: string): AppUserRow[] {
  // A user should be in app A's user list if:
  //   - they are in a company that has CompanyAppAccess for A, OR
  //   - they have a UserAppRole for A explicitly, OR
  //   - they have company_access_all (cross-company: superadmin / demo / etc.)
  const accessByCompany = new Map<string, Set<string>>()
  for (const a of snap.company_app_access) {
    if (!accessByCompany.has(a.app_id)) accessByCompany.set(a.app_id, new Set())
    accessByCompany.get(a.app_id)!.add(a.company_slug)
  }
  const explicitAppRoles = new Map<string, string>()
  for (const r of snap.user_app_roles) {
    if (r.app_id === appId) explicitAppRoles.set(r.email, r.role)
  }
  const companiesWithApp = accessByCompany.get(appId) ?? new Set<string>()

  const result: AppUserRow[] = []
  for (const u of snap.users) {
    const hasExplicit = explicitAppRoles.has(u.email)
    const hasCompanyAccess = u.company_slugs.some((s) => companiesWithApp.has(s))
    const isCrossCompany = u.company_access_all
    if (!hasExplicit && !hasCompanyAccess && !isCrossCompany) continue
    const role = explicitAppRoles.get(u.email) ?? u.role
    result.push({
      email: u.email,
      name: u.name,
      role,
      company_slug: u.company_slug,
    })
  }
  return result
}

function expectedClinicsForApp(snap: HubSnapshot, appId: string): AppClinicRow[] {
  return snap.clinics
    .filter((c) => c.app_id === appId)
    .map((c) => ({ id: c.external_id, name: c.name, active: c.active }))
}

async function auditApp(
  appId: string,
  appUrl: string | undefined,
  secret: string,
  snap: HubSnapshot,
): Promise<AppAuditResult> {
  const result: AppAuditResult = {
    app_id: appId,
    app_url: appUrl ?? null,
    reachable: false,
    users_endpoint_status: null,
    clinics_endpoint_status: null,
    hub_users_expected: [],
    app_users_returned: [],
    orphan_users: [],
    missing_users: [],
    role_mismatches: [],
    hub_clinics_expected: [],
    app_clinics_returned: [],
    orphan_clinics: [],
    missing_clinics: [],
    errors: [],
  }

  if (!appUrl) {
    result.errors.push('No URL configured (NEXT_PUBLIC_URL_* missing)')
    return result
  }

  const [usersResp, clinicsResp] = await Promise.all([
    fetchSubAppList<AppUserRow>(`${appUrl}/api/sync/users`, secret),
    fetchSubAppList<AppClinicRow>(`${appUrl}/api/sync/clinics`, secret),
  ])

  result.users_endpoint_status = usersResp.status
  result.clinics_endpoint_status = clinicsResp.status
  result.reachable = usersResp.status !== null || clinicsResp.status !== null
  if (usersResp.error) result.errors.push(`users: ${usersResp.error}`)
  if (clinicsResp.error) result.errors.push(`clinics: ${clinicsResp.error}`)

  result.hub_users_expected = expectedUsersForApp(snap, appId)
  result.app_users_returned = usersResp.data

  const expectedByEmail = new Map(result.hub_users_expected.map((u) => [u.email.toLowerCase(), u]))
  const returnedByEmail = new Map<string, AppUserRow>()
  for (const u of result.app_users_returned) {
    if (u.email) returnedByEmail.set(u.email.toLowerCase(), u)
  }

  // Orphan users (in sub-app, not in Hub). Skip rows that the sub-app already
  // reports as inactive — they're orphans-but-deactivated and pose no real
  // contract risk. Only ACTIVE rows that aren't in Hub deserve a finding.
  for (const [email, u] of returnedByEmail) {
    if (u.active === false) continue
    if (!expectedByEmail.has(email)) {
      result.orphan_users.push(u)
    }
  }
  // Missing users (in Hub-expected, not in sub-app response) — only valid if endpoint
  // responded successfully; skip if endpoint missing/erroring to avoid noise.
  if (result.users_endpoint_status === 200) {
    for (const [email, u] of expectedByEmail) {
      if (!returnedByEmail.has(email)) result.missing_users.push(u)
    }
    // Role drift among users present in both sides — accept declared
    // app-side fallbacks (e.g. demo → auxiliar in apps without a DEMO enum).
    for (const [email, expected] of expectedByEmail) {
      const got = returnedByEmail.get(email)
      if (!got) continue
      if (!rolesMatch(expected.role ?? '', got.role ?? '')) {
        result.role_mismatches.push({
          email,
          hub_role: expected.role ?? '',
          app_role: got.role ?? '',
        })
      }
    }
  }

  result.hub_clinics_expected = expectedClinicsForApp(snap, appId)
  result.app_clinics_returned = clinicsResp.data

  const expectedClinicByExternalId = new Map(
    result.hub_clinics_expected.map((c) => [c.id, c]),
  )
  const returnedClinicById = new Map(
    // Match by canonical Hub external_id if the sub-app exposes one;
    // otherwise fall back to the local id.
    result.app_clinics_returned.map((c) => [clinicCanonicalId(c), c]),
  )
  for (const [id, c] of returnedClinicById) {
    if (!clinicIsActive(c)) continue // sub-app reports it as inactive — not orphan
    if (!expectedClinicByExternalId.has(id)) {
      result.orphan_clinics.push(c)
    }
  }
  if (result.clinics_endpoint_status === 200) {
    for (const [id, c] of expectedClinicByExternalId) {
      if (!returnedClinicById.has(id)) result.missing_clinics.push(c)
    }
  }

  return result
}

// ─── Findings derivation ──────────────────────────────────────────────────────

function deriveFindings(snap: HubSnapshot, apps: AppAuditResult[]): AuditFinding[] {
  const out: AuditFinding[] = []

  for (const a of apps) {
    if (!a.app_url) {
      out.push({
        severity: 'warning',
        app_id: a.app_id,
        category: 'app_unreachable',
        message: 'No URL configured for this app',
      })
      continue
    }
    if (!a.reachable) {
      out.push({
        severity: 'error',
        app_id: a.app_id,
        category: 'app_unreachable',
        message: `App not reachable: ${a.errors.join('; ')}`,
        details: { url: a.app_url },
      })
      continue
    }
    if (a.users_endpoint_status !== 200) {
      out.push({
        severity: 'warning',
        app_id: a.app_id,
        category: 'endpoint_missing',
        message: `GET /api/sync/users returned ${a.users_endpoint_status} (${a.errors.find((e) => e.startsWith('users:')) ?? 'no body'})`,
      })
    }
    if (a.clinics_endpoint_status !== 200) {
      out.push({
        severity: 'warning',
        app_id: a.app_id,
        category: 'endpoint_missing',
        message: `GET /api/sync/clinics returned ${a.clinics_endpoint_status} (${a.errors.find((e) => e.startsWith('clinics:')) ?? 'no body'})`,
      })
    }
    for (const u of a.orphan_users) {
      out.push({
        severity: 'error',
        app_id: a.app_id,
        category: 'orphan_user',
        message: `Orphan user in sub-app (not in Hub): ${u.email}`,
        details: { user: u },
      })
    }
    for (const u of a.missing_users) {
      out.push({
        severity: 'error',
        app_id: a.app_id,
        category: 'missing_user',
        message: `Hub user not propagated to sub-app: ${u.email}`,
        details: { user: u },
      })
    }
    for (const m of a.role_mismatches) {
      out.push({
        severity: 'warning',
        app_id: a.app_id,
        category: 'role_drift',
        message: `Role drift for ${m.email}: Hub=${m.hub_role}, app=${m.app_role}`,
        details: m,
      })
    }
    for (const c of a.orphan_clinics) {
      out.push({
        severity: 'error',
        app_id: a.app_id,
        category: 'orphan_clinic',
        message: `Orphan clinic in sub-app (not in Hub): ${c.name} (${c.id})`,
        details: { clinic: c },
      })
    }
    for (const c of a.missing_clinics) {
      out.push({
        severity: 'error',
        app_id: a.app_id,
        category: 'missing_clinic',
        message: `Hub clinic not propagated to sub-app: ${c.name} (${c.id})`,
        details: { clinic: c },
      })
    }
  }

  return out
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function runAudit(): Promise<AuditReport> {
  const secret = process.env.HUB_JWT_SECRET ?? process.env.JWT_SECRET ?? ''
  if (!secret) {
    throw new Error('HUB_JWT_SECRET / JWT_SECRET not configured — cannot authenticate against sub-apps')
  }

  const snap = await readHubSnapshot()
  // Dedupe APP_URLS by URL: 'crm' and 'impulsodent-crm' (and 'talent' /
  // 'impulsodent-talent') are catalog aliases pointing to the same deployment.
  // Auditing twice produces duplicate findings without any added information.
  const seenUrls = new Set<string>()
  const appEntries = Object.entries(APP_URLS).filter(([, url]) => {
    if (!url) return true // keep no-url entries so user sees they're missing
    if (seenUrls.has(url)) return false
    seenUrls.add(url)
    return true
  })
  const apps = await Promise.all(
    appEntries.map(([appId, appUrl]) => auditApp(appId, appUrl, secret, snap)),
  )
  const findings = deriveFindings(snap, apps)

  const reachable = apps.filter((a) => a.reachable).length
  const errors = findings.filter((f) => f.severity === 'error').length
  const warnings = findings.filter((f) => f.severity === 'warning').length
  const infos = findings.filter((f) => f.severity === 'info').length

  return {
    generated_at: new Date().toISOString(),
    hub: snap,
    apps,
    findings,
    summary: {
      total_apps_configured: appEntries.length,
      apps_reachable: reachable,
      apps_unreachable: appEntries.length - reachable,
      total_findings: findings.length,
      errors,
      warnings,
      infos,
    },
  }
}
