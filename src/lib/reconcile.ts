/**
 * Hub → sub-apps reconciliation push.
 *
 * Sends the canonical full clinic list per (company, app) with
 * `reconcile: true`. Sub-app handlers honoring the flag will soft-delete
 * any local clinic for that company NOT present in the payload.
 *
 * Why: the existing `pushClinicCreate` only fans new/changed clinics out;
 * deletions in Hub previously left orphan rows in sub-apps (see Badalona
 * audit 2026-05-09). Reconcile closes that gap.
 *
 * Triggered by:
 *   - POST /api/admin/reconcile/clinics  (manual, admin auth)
 *   - GET  /api/cron/reconcile-clinics   (Vercel cron, daily)
 */
import { prisma } from './prisma'
import { APP_URLS, APP_IDS_WITH_CLINICS, configuredEntries } from './app-urls'

export type ReconcileClinicsResult = {
  startedAt: string
  elapsedMs: number
  pairs: number
  ok: number
  failed: number
  skipped: number
  details: Array<{
    company_slug: string
    app_id: string
    clinics_sent: number
    status: 'ok' | 'failed' | 'skipped'
    soft_deleted?: number
    error?: string
  }>
}

export async function reconcileClinics(opts: { companySlug?: string } = {}): Promise<ReconcileClinicsResult> {
  const startedAt = new Date().toISOString()
  const t0 = Date.now()
  const secret = process.env.HUB_JWT_SECRET ?? process.env.JWT_SECRET ?? ''
  if (!secret) throw new Error('HUB_JWT_SECRET (or JWT_SECRET) not configured')

  const companies = await prisma.company.findMany({
    where: opts.companySlug ? { slug: opts.companySlug } : {},
    select: { id: true, slug: true },
  })

  const result: ReconcileClinicsResult = {
    startedAt, elapsedMs: 0, pairs: 0, ok: 0, failed: 0, skipped: 0, details: [],
  }

  for (const company of companies) {
    for (const appId of APP_IDS_WITH_CLINICS) {
      const appUrl = APP_URLS[appId]
      if (!appUrl) {
        result.skipped++
        result.details.push({
          company_slug: company.slug, app_id: appId, clinics_sent: 0,
          status: 'skipped', error: 'app url not configured',
        })
        continue
      }
      result.pairs++

      const rows = await prisma.clinic.findMany({
        where: { company_id: company.id, app_id: appId, active: true },
        select: { external_id: true, name: true },
        orderBy: { name: 'asc' },
      })

      const payload = {
        company_slug: company.slug,
        app_id: appId,
        clinics: rows.map((r) => ({ id: r.external_id, name: r.name, active: true })),
        reconcile: true,
      }

      try {
        const res = await fetch(`${appUrl}/api/sync/clinics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${(data as { error?: string }).error ?? 'unknown'}`)
        result.ok++
        result.details.push({
          company_slug: company.slug, app_id: appId, clinics_sent: rows.length,
          status: 'ok', soft_deleted: typeof (data as { soft_deleted?: number }).soft_deleted === 'number'
            ? (data as { soft_deleted: number }).soft_deleted : undefined,
        })
      } catch (e) {
        result.failed++
        result.details.push({
          company_slug: company.slug, app_id: appId, clinics_sent: rows.length,
          status: 'failed', error: (e as Error).message,
        })
      }
    }
  }

  result.elapsedMs = Date.now() - t0
  return result
}

export type ReconcileGenericResult = {
  startedAt: string
  elapsedMs: number
  pairs: number
  ok: number
  failed: number
  details: Array<{
    app_id: string
    company_slug?: string
    keys_sent: number
    status: 'ok' | 'failed'
    soft_deleted?: number
    error?: string
  }>
}

/**
 * Push canonical active-user list per (company, app). Sub-apps soft-delete
 * Hub-origin users not in `active_emails`.
 */
export async function reconcileUsers(opts: { companySlug?: string } = {}): Promise<ReconcileGenericResult> {
  const startedAt = new Date().toISOString()
  const t0 = Date.now()
  const secret = process.env.HUB_JWT_SECRET ?? process.env.JWT_SECRET ?? ''
  if (!secret) throw new Error('HUB_JWT_SECRET (or JWT_SECRET) not configured')

  const companies = await prisma.company.findMany({
    where: opts.companySlug ? { slug: opts.companySlug } : {},
    select: { id: true, slug: true },
  })

  const apps = configuredEntries()
  const result: ReconcileGenericResult = { startedAt, elapsedMs: 0, pairs: 0, ok: 0, failed: 0, details: [] }

  for (const company of companies) {
    const users = await prisma.hubUser.findMany({
      where: { company_id: company.id, active: true },
      select: { email: true },
    })
    const emails = users.map((u) => u.email)

    for (const [appId, appUrl] of apps) {
      result.pairs++
      try {
        const res = await fetch(`${appUrl}/api/sync/users/reconcile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
          body: JSON.stringify({ company_slug: company.slug, active_emails: emails }),
          signal: AbortSignal.timeout(10000),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${(data as { error?: string }).error ?? 'unknown'}`)
        result.ok++
        result.details.push({
          app_id: appId, company_slug: company.slug, keys_sent: emails.length,
          status: 'ok', soft_deleted: typeof (data as { soft_deleted?: number }).soft_deleted === 'number'
            ? (data as { soft_deleted: number }).soft_deleted : undefined,
        })
      } catch (e) {
        result.failed++
        result.details.push({
          app_id: appId, company_slug: company.slug, keys_sent: emails.length,
          status: 'failed', error: (e as Error).message,
        })
      }
    }
  }

  result.elapsedMs = Date.now() - t0
  return result
}

/**
 * Push canonical active-company list to every sub-app. Sub-apps soft-delete
 * tenants/companies whose slug is NOT in `active_slugs`.
 */
export async function reconcileCompanies(): Promise<ReconcileGenericResult> {
  const startedAt = new Date().toISOString()
  const t0 = Date.now()
  const secret = process.env.HUB_JWT_SECRET ?? process.env.JWT_SECRET ?? ''
  if (!secret) throw new Error('HUB_JWT_SECRET (or JWT_SECRET) not configured')

  const companies = await prisma.company.findMany({
    where: { active: true },
    select: { slug: true },
  })
  const slugs = companies.map((c) => c.slug)

  const apps = configuredEntries()
  const result: ReconcileGenericResult = { startedAt, elapsedMs: 0, pairs: 0, ok: 0, failed: 0, details: [] }

  for (const [appId, appUrl] of apps) {
    result.pairs++
    try {
      const res = await fetch(`${appUrl}/api/sync/companies/reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
        body: JSON.stringify({ active_slugs: slugs }),
        signal: AbortSignal.timeout(10000),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(data as { error?: string }).error ?? 'unknown'}`)
      result.ok++
      result.details.push({
        app_id: appId, keys_sent: slugs.length,
        status: 'ok', soft_deleted: typeof (data as { soft_deleted?: number }).soft_deleted === 'number'
          ? (data as { soft_deleted: number }).soft_deleted : undefined,
      })
    } catch (e) {
      result.failed++
      result.details.push({
        app_id: appId, keys_sent: slugs.length,
        status: 'failed', error: (e as Error).message,
      })
    }
  }

  result.elapsedMs = Date.now() - t0
  return result
}
