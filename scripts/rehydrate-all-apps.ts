/**
 * Pushes ALL Hub data to every sub-app, in the correct order:
 *   1. Companies → /api/sync/company
 *   2. Clinics  → /api/sync/clinics  (per company, batched)
 *   3. Users    → /api/sync/user     (with their app role + clinic_ids)
 *
 * Idempotent — every endpoint upserts. Use to backfill empty sub-app DBs
 * (e.g. after onboarding a new app or fixing a sync regression).
 *
 * Run:  JWT_SECRET=... npx tsx scripts/rehydrate-all-apps.ts
 */

import { Client } from 'pg'
import * as fs from 'fs'
import * as path from 'path'

// Load Hub env
const envPath = path.join(__dirname, '..', '.env.production.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}

const HUB_DB = 'postgresql://neondb_owner:npg_0FqHflC9EthB@ep-fancy-union-al2mgakg-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&channel_binding=require'

const APP_URLS: Record<string, string> = {
  clinicpnl:          'https://clinicpnl.impulsodent.com',
  clinicvox:          'https://clinicvox.impulsodent.com',
  spendflow:          'https://spendflow.impulsodent.com',
  fichaje:            'https://fichajeshr.impulsodent.com',
  zentrix:            'https://zentrix.impulsodent.com',
  dentalhr:           'https://dentalhr.impulsodent.com',
  dentalreports:      'https://dentalreports.impulsodent.com',
  clinicrefunds:      'https://clinicrefunds.impulsodent.com',
  nexora:             'https://nexora.impulsodent.com',
  clinicstock:        'https://clinicstock.impulsodent.com',
  'impulsodent-crm':  'https://crm.impulsodent.com',
  talent:             'https://talent.impulsodent.com',
  clinicnps:          'https://clinicnps.impulsodent.com',
  clinicleads:        'https://clinicleads.impulsodent.com',
  duediligence:       'https://due.impulsodent.com',
  ddc:                'https://ddc.impulsodent.com',
}

const APPS_WITH_CLINICS = new Set([
  'clinicpnl','clinicvox','fichaje','zentrix','dentalhr','dentalreports',
  'clinicrefunds','clinicstock','impulsodent-crm','duediligence',
  'nexora','spendflow','talent',
])

async function post(url: string, body: unknown, secret: string): Promise<{ status: number; body: string }> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 15000)
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    clearTimeout(t)
    const txt = await res.text().catch(() => '')
    return { status: res.status, body: txt.slice(0, 120) }
  } catch (err) {
    return { status: -1, body: (err as Error).message.slice(0, 80) }
  }
}

async function main() {
  const secret = process.env.JWT_SECRET ?? ''
  if (!secret) { console.error('JWT_SECRET missing'); return }

  const hub = new Client({ connectionString: HUB_DB })
  await hub.connect()

  const { rows: companies } = await hub.query<{
    id: string; slug: string; name: string; cif: string | null; email: string | null
    phone: string | null; address: string | null; active: boolean
  }>(
    `SELECT id, slug, name, cif, email, phone, address, active FROM companies WHERE active = true ORDER BY name`
  )

  const { rows: clinics } = await hub.query<{
    id: string; external_id: string; name: string; company_id: string; active: boolean; app_id: string
  }>(
    `SELECT id, external_id, name, company_id, active, app_id FROM clinics WHERE active = true`
  )

  const { rows: users } = await hub.query<{
    id: string; email: string; name: string; role: string; company_id: string | null; active: boolean; password_hash: string | null
  }>(
    `SELECT id, email, name, role, company_id, active, password_hash FROM hub_users WHERE active = true`
  )

  console.log(`Hub: ${companies.length} companies, ${clinics.length} clinics, ${users.length} users`)
  console.log(`Pushing to ${Object.keys(APP_URLS).length} sub-apps...\n`)

  // PHASE 1 — companies
  console.log('=== PHASE 1: companies ===')
  for (const co of companies) {
    const payload = {
      id:             co.id,
      hub_company_id: co.id,
      hubCompanyId:   co.id,
      slug:           co.slug,
      name:           co.name,
      taxId:          co.cif,
      email:          co.email,
      phone:          co.phone,
      address:        co.address,
      active:         co.active,
      isActive:       co.active,
    }
    const results = await Promise.all(
      Object.entries(APP_URLS).map(async ([app, url]) => {
        const r = await post(`${url}/api/sync/company`, payload, secret)
        return { app, ...r }
      }),
    )
    const okCount = results.filter((r) => r.status === 200 || r.status === 201).length
    const fails = results.filter((r) => r.status !== 200 && r.status !== 201)
    console.log(`  ${co.slug.padEnd(30)} ${okCount}/${results.length} OK${fails.length ? ` — fails: ${fails.map((f) => `${f.app}(${f.status})`).join(', ')}` : ''}`)
  }

  // PHASE 2 — clinics, batched per company
  console.log('\n=== PHASE 2: clinics ===')
  // Dedup by (company_id, name): Hub stores one Clinic row per app, so a single
  // physical clinic appears N times (once per app it's registered in). Sub-apps
  // only need one logical clinic per name. Keep the oldest external_id so Hub
  // and sub-apps converge on the same canonical ID for future pushes.
  const clinicsByCompany = new Map<string, { id: string; name: string; active: boolean }[]>()
  const sortedClinics = [...clinics].sort((a, b) => a.external_id.localeCompare(b.external_id))
  for (const cl of sortedClinics) {
    const list = clinicsByCompany.get(cl.company_id) ?? []
    if (!list.some((x) => x.name === cl.name)) {
      list.push({ id: cl.external_id, name: cl.name, active: cl.active })
    }
    clinicsByCompany.set(cl.company_id, list)
  }
  const companyById = new Map(companies.map((c) => [c.id, c]))

  for (const [companyId, clinicList] of clinicsByCompany) {
    const co = companyById.get(companyId)
    if (!co) continue
    const payload = {
      company_slug:   co.slug,
      company_name:   co.name,
      hub_company_id: co.id,
      clinics:        clinicList,
    }
    const results = await Promise.all(
      Object.entries(APP_URLS)
        .filter(([app]) => APPS_WITH_CLINICS.has(app))
        .map(async ([app, url]) => {
          const r = await post(`${url}/api/sync/clinics`, payload, secret)
          return { app, ...r }
        }),
    )
    const okCount = results.filter((r) => r.status === 200 || r.status === 201).length
    const fails = results.filter((r) => r.status !== 200 && r.status !== 201)
    console.log(`  ${co.slug.padEnd(30)} ${clinicList.length} clinic(s) → ${okCount}/${results.length} OK${fails.length ? ` — fails: ${fails.map((f) => `${f.app}(${f.status})`).join(', ')}` : ''}`)
  }

  // PHASE 3 — users with their resolved clinic_ids per app
  console.log('\n=== PHASE 3: users ===')
  for (const user of users) {
    const co = user.company_id ? companyById.get(user.company_id) : null
    // Resolve user's per-app clinic access from user_app_roles table
    const { rows: appRoles } = await hub.query<{ app_id: string; role: string; clinic_access_all: boolean; clinic_ids: string[] | null }>(
      `SELECT app_id, role, clinic_access_all, clinic_ids FROM user_app_roles WHERE user_id = $1`,
      [user.id],
    )
    const { rows: hubUserRow } = await hub.query<{ clinic_access_all: boolean }>(
      `SELECT clinic_access_all FROM hub_users WHERE id = $1`, [user.id]
    )
    const globalAll = hubUserRow[0]?.clinic_access_all !== false

    let okTotal = 0, totalApps = 0
    const appResults: { app: string; status: number | string }[] = []
    for (const [app, url] of Object.entries(APP_URLS)) {
      const appRole = appRoles.find((r) => r.app_id === app)
      const role = appRole?.role ?? user.role
      const isSuperadmin = user.role === 'superadmin' || role === 'superadmin'
      let clinicIds: string[] | 'ALL'
      if (isSuperadmin) {
        clinicIds = 'ALL'
      } else if (appRole) {
        if (appRole.clinic_access_all) clinicIds = 'ALL'
        else {
          // Resolve hub clinic ids → external_ids scoped to this app
          if (!appRole.clinic_ids || appRole.clinic_ids.length === 0) {
            clinicIds = []
          } else {
            const { rows: appClinics } = await hub.query<{ external_id: string }>(
              `SELECT external_id FROM clinics WHERE id = ANY($1::text[]) AND app_id = $2`,
              [appRole.clinic_ids, app],
            )
            clinicIds = appClinics.map((c) => c.external_id)
          }
        }
      } else {
        clinicIds = globalAll ? 'ALL' : []
      }

      const payload: Record<string, unknown> = {
        email:        user.email,
        name:         user.name,
        role,
        company_slug: co?.slug ?? null,
        clinic_ids:   clinicIds,
      }
      // Forward bcrypt hash so sub-apps inherit working credentials.
      // Both Hub and sub-apps use bcryptjs → hashes are interchangeable.
      if (user.password_hash && /^\$2[aby]\$/.test(user.password_hash)) {
        payload.password_hash = user.password_hash
      }
      const r = await post(`${url}/api/sync/user`, payload, secret)
      appResults.push({ app, status: r.status })
      totalApps++
      if (r.status === 200 || r.status === 201) okTotal++
    }
    const fails = appResults.filter((r) => r.status !== 200 && r.status !== 201)
    console.log(`  ${user.email.padEnd(40)} ${okTotal}/${totalApps} OK${fails.length ? ` — fails: ${fails.map((f) => `${f.app}(${f.status})`).join(', ')}` : ''}`)
  }

  await hub.end()
  console.log('\nDone.')
}

main().catch(console.error)
