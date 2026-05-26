/**
 * Single source of truth for sub-app URLs known to the Hub.
 *
 * - `APP_URLS`           → all apps known by the Hub (catalog match in `lib/apps.ts`).
 * - `APP_URLS_WITH_SYNC` → subset that exposes `/api/sync/{user,company,clinics}` endpoints.
 * - `APP_URLS_WITH_CLINICS` → subset that has a real `Clinic` model (push of clinic creates).
 * - `APP_SSO_PATHS`      → SSO receiver path on each sub-app, used by `/api/auth/launch`.
 *
 * Internal/admin-only apps (`sync-adapter`, `integrations`) are NOT included here — they
 * are launched directly from the catalog or live inside the Hub itself.
 *
 * Whenever a new sub-app is added, update this file ONCE and all five consumers
 * (`lib/sync.ts`, `api/auth/launch`, `api/admin/users`, `api/admin/companies`,
 * `api/admin/clinics`) automatically pick it up.
 */

// Empty Vercel env values get loaded as `""` (not undefined), and `"" ?? fallback`
// returns `""` — so without this coercion, every sub-app with an empty env var
// silently bypasses its hardcoded fallback URL and ends up filtered out of the
// reconcile sweep entirely. Treat empty strings as missing.
const e = (v: string | undefined): string | undefined => (v && v.length > 0 ? v : undefined)

export const APP_URLS: Record<string, string | undefined> = {
  clinicpnl:          e(process.env.NEXT_PUBLIC_URL_CLINICPNL)     ?? 'https://clinicpnl.impulsodent.com',
  clinicvox:          e(process.env.NEXT_PUBLIC_URL_CLINICVOX)     ?? 'https://clinicvox.impulsodent.com',
  // dentalspot removed from Hub catalog (2026-04-26)
  spendflow:          e(process.env.NEXT_PUBLIC_URL_SPENDFLOW)     ?? 'https://spendflow.impulsodent.com',
  fichaje:            e(process.env.NEXT_PUBLIC_URL_FICHAJE)       ?? 'https://fichajeshr.impulsodent.com',
  zentrix:            e(process.env.NEXT_PUBLIC_URL_ZENTRIX)       ?? 'https://zentrix.impulsodent.com',
  dentalhr:           e(process.env.NEXT_PUBLIC_URL_DENTALHR)      ?? 'https://dentalhr.impulsodent.com',
  dentalreports:      e(process.env.NEXT_PUBLIC_URL_DENTALREPORTS) ?? 'https://dentalreports.impulsodent.com',
  clinicrefunds:      e(process.env.NEXT_PUBLIC_URL_CLINICREFUNDS) ?? 'https://clinicrefunds.impulsodent.com',
  nexora:             e(process.env.NEXT_PUBLIC_URL_NEXORA)        ?? 'https://nexora.impulsodent.com',
  clinicstock:        e(process.env.NEXT_PUBLIC_URL_CLINICSTOCK)   ?? 'https://clinicstock.impulsodent.com',
  // clinicflow excluded from Hub user-sync (manual auth, no SSO)
  // dentalspot excluded (removed from Hub catalog 2026-04-26)
  // nexuserp excluded (separate project, not in Hub)
  'impulsodent-crm':  e(process.env.NEXT_PUBLIC_URL_IMPULSODENT_CRM) ?? 'https://crm.impulsodent.com',
  // Alias keys to match catalog ids (lib/apps.ts uses 'talent' & 'crm')
  // NEXT_PUBLIC_URL_TALENT is the primary var; NEXT_PUBLIC_URL_IMPULSODENT_TALENT is the legacy alias
  talent:             e(process.env.NEXT_PUBLIC_URL_TALENT) ?? e(process.env.NEXT_PUBLIC_URL_IMPULSODENT_TALENT) ?? 'https://talent.impulsodent.com',
  'impulsodent-talent': e(process.env.NEXT_PUBLIC_URL_TALENT) ?? e(process.env.NEXT_PUBLIC_URL_IMPULSODENT_TALENT) ?? 'https://talent.impulsodent.com',
  crm:                e(process.env.NEXT_PUBLIC_URL_IMPULSODENT_CRM) ?? 'https://crm.impulsodent.com',
  clinicnps:          e(process.env.NEXT_PUBLIC_URL_CLINICNPS)    ?? 'https://clinicnps.impulsodent.com',
  clinicleads:        e(process.env.NEXT_PUBLIC_URL_CLINICLEADS)  ?? 'https://clinicleads.impulsodent.com',
  'sync-adapter':     e(process.env.NEXT_PUBLIC_URL_SYNC_ADAPTER) ?? 'https://syncadapter.impulsodent.com',
  duediligence:       e(process.env.NEXT_PUBLIC_URL_DUEDILIGENCE) ?? 'https://due.impulsodent.com',
  ddc:                e(process.env.NEXT_PUBLIC_URL_DDC)          ?? 'https://ddc.impulsodent.com',
  historiales:        e(process.env.NEXT_PUBLIC_URL_HISTORIALES)  ?? 'https://historiales.impulsodent.com',
  'casos-clinicos':   e(process.env.NEXT_PUBLIC_URL_CASOSCLINICOS) ?? 'https://casos-clinicos.impulsodent.com',
  helpdesk:           e(process.env.NEXT_PUBLIC_URL_HELPDESK)     ?? 'https://helpdesk.impulsodent.com',
  pedistock:          e(process.env.NEXT_PUBLIC_URL_PEDISTOCK)    ?? 'https://pedistock.impulsodent.com',
  margincall:         e(process.env.NEXT_PUBLIC_URL_MARGINCALL)   ?? 'https://margincall.impulsodent.com',
  competidor:         e(process.env.NEXT_PUBLIC_URL_COMPETIDOR)   ?? 'https://competidor.impulsodent.com',
}

/**
 * Apps that have a real `Clinic` model in their database. Hub fans clinic
 * creates out to every app in this list (intersected with the company's
 * granted apps). Apps without a Clinic model — historically commented out —
 * are intentionally absent so the fan-out doesn't error.
 *
 * All apps in this list have been verified to (a) declare a Clinic model in
 * their prisma schema and (b) implement POST /api/sync/clinics that honors
 * the canonical `{ company_slug, clinics: [{ id, name, active }] }` payload
 * (or accept `hub_company_id` as an alias).
 */
export const APP_IDS_WITH_CLINICS: ReadonlyArray<string> = [
  'clinicpnl',
  'clinicvox',
  'fichaje',
  'zentrix',
  'dentalhr',
  'dentalreports',
  'clinicrefunds',
  'clinicstock',
  'impulsodent-crm',
  'duediligence',
  'ddc',
  'nexora',
  'spendflow',
  'talent',
  'impulsodent-talent',
  'historiales',
  'casos-clinicos',
  'clinicleads',
  'clinicnps',
  'sync-adapter',
  'helpdesk',
  'pedistock',
  'competidor',
]

/**
 * Map appId → sub-app SSO receiver path (used by /api/auth/launch).
 * Default for unlisted apps is `/api/auth/hub-sso` (NextAuth-style).
 */
export const APP_SSO_PATHS: Record<string, string> = {
  clinicpnl:           '/api/auth/hub-sso',  // Supabase
  clinicvox:           '/api/auth/hub-sso',  // NextAuth
  spendflow:           '/sso',               // NestJS — needs client-side localStorage
  fichaje:             '/sso',               // NestJS — needs client-side localStorage
  zentrix:             '/api/auth/hub-sso',  // NextAuth
  dentalhr:            '/api/auth/hub-sso',  // Custom Prisma
  dentalreports:       '/api/auth/hub-sso',  // Supabase
  clinicrefunds:       '/api/auth/hub-sso',  // NextAuth
  nexora:              '/api/auth/hub-sso',  // NextAuth
  clinicstock:         '/api/sso',           // NextAuth v5 — outside [...nextauth] catch-all
  clinicflow:          '/api/sso',           // NextAuth v5 — outside [...nextauth] catch-all
  'impulsodent-crm':   '/api/sso',           // NextAuth v5 — outside [...nextauth] catch-all
  crm:                 '/api/sso',           // alias used by launcher (appId='crm')
  'impulsodent-talent':'/api/sso',           // NextAuth v5 — outside [...nextauth] catch-all
  talent:              '/api/sso',           // alias used by launcher (appId='talent')
  clinicnps:           '/api/sso',           // NextAuth v5 — outside [...nextauth] catch-all
  clinicleads:         '/api/sso',           // NextAuth v5 — outside [...nextauth] catch-all
  'sync-adapter':      '/api/sso',           // NextAuth v5 — outside [...nextauth] catch-all
  duediligence:        '/api/sso',           // NextAuth v5 — outside [...nextauth] catch-all
  historiales:         '/api/sso',           // NextAuth v5 — outside [...nextauth] catch-all
  'casos-clinicos':    '/api/sso',           // NextAuth v5 — outside [...nextauth] catch-all
  helpdesk:            '/api/auth/hub-sso',  // NextAuth v5 — credentials hub flow
  pedistock:           '/api/sso',           // NextAuth v5 — outside [...nextauth] catch-all
  margincall:          '/api/sso',           // NextAuth v5 — outside [...nextauth] catch-all
  competidor:          '/api/sso',           // NextAuth v5 — outside [...nextauth] catch-all
}

/** Convenience helper: filter to entries that have a non-empty URL configured. */
export function configuredEntries(): [string, string][] {
  return Object.entries(APP_URLS)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
}
