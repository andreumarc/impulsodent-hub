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

export const APP_URLS: Record<string, string | undefined> = {
  clinicpnl:          process.env.NEXT_PUBLIC_URL_CLINICPNL,
  clinicvox:          process.env.NEXT_PUBLIC_URL_CLINICVOX,
  // dentalspot removed from Hub catalog (2026-04-26)
  spendflow:          process.env.NEXT_PUBLIC_URL_SPENDFLOW,
  fichaje:            process.env.NEXT_PUBLIC_URL_FICHAJE,
  zentrix:            process.env.NEXT_PUBLIC_URL_ZENTRIX,
  dentalhr:           process.env.NEXT_PUBLIC_URL_DENTALHR,
  dentalreports:      process.env.NEXT_PUBLIC_URL_DENTALREPORTS,
  clinicrefunds:      process.env.NEXT_PUBLIC_URL_CLINICREFUNDS,
  nexora:             process.env.NEXT_PUBLIC_URL_NEXORA,
  clinicstock:        process.env.NEXT_PUBLIC_URL_CLINICSTOCK,
  // clinicflow excluded from Hub user-sync (manual auth, no SSO)
  // dentalspot excluded (removed from Hub catalog 2026-04-26)
  // nexuserp excluded (separate project, not in Hub)
  'impulsodent-crm':  process.env.NEXT_PUBLIC_URL_IMPULSODENT_CRM,
  // Alias keys to match catalog ids (lib/apps.ts uses 'talent' & 'crm')
  // NEXT_PUBLIC_URL_TALENT is the primary var; NEXT_PUBLIC_URL_IMPULSODENT_TALENT is the legacy alias
  talent:             process.env.NEXT_PUBLIC_URL_TALENT ?? process.env.NEXT_PUBLIC_URL_IMPULSODENT_TALENT,
  'impulsodent-talent': process.env.NEXT_PUBLIC_URL_TALENT ?? process.env.NEXT_PUBLIC_URL_IMPULSODENT_TALENT,
  crm:                process.env.NEXT_PUBLIC_URL_IMPULSODENT_CRM,
  clinicnps:          process.env.NEXT_PUBLIC_URL_CLINICNPS,
  clinicleads:        process.env.NEXT_PUBLIC_URL_CLINICLEADS,
  'sync-adapter':     process.env.NEXT_PUBLIC_URL_SYNC_ADAPTER,
  duediligence:       process.env.NEXT_PUBLIC_URL_DUEDILIGENCE ?? 'https://due.impulsodent.com',
  ddc:                process.env.NEXT_PUBLIC_URL_DDC ?? 'https://ddc.impulsodent.com',
  historiales:        process.env.NEXT_PUBLIC_URL_HISTORIALES ?? 'https://historiales.impulsodent.com',
}

/**
 * Apps that have a real `Clinic` model in their database. spendflow / nexora /
 * impulsodent-talent / clinicleads / clinicnps are company-scoped
 * (no per-clinic entity) — pushing a clinic to them is a no-op.
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
  'nexora',
  'spendflow',
  'talent',
  'impulsodent-talent',
  'historiales',
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
}

/** Convenience helper: filter to entries that have a non-empty URL configured. */
export function configuredEntries(): [string, string][] {
  return Object.entries(APP_URLS)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
}
