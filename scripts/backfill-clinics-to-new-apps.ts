/**
 * Backfill existing Hub clinics into apps that were just added to
 * `APP_IDS_WITH_CLINICS` (clinicleads, clinicnps, sync-adapter, ddc).
 *
 * For each Hub Clinic row that doesn't yet have a sibling row for these
 * new app_ids, create one (sharing the same `external_id` so the canonical
 * external id stays consistent across apps), then POST /api/sync/clinics
 * to the sub-app to actually create the Clinic row server-side.
 *
 * Idempotent: re-running won't duplicate (uses `upsertClinic` keyed on
 * `(app_id, external_id)`).
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/backfill-clinics-to-new-apps.ts
 */
import { prisma } from '../src/lib/prisma'
import { upsertClinic } from '../src/lib/db'
import { APP_URLS } from '../src/lib/app-urls'

const NEW_APPS = ['clinicleads', 'clinicnps', 'sync-adapter', 'ddc']

async function main() {
  const secret = process.env.HUB_JWT_SECRET ?? process.env.JWT_SECRET ?? ''
  if (!secret) throw new Error('HUB_JWT_SECRET / JWT_SECRET not configured')

  // For every existing Hub Clinic (group by physical clinic — same name+company),
  // make sure each NEW_APPS has a sibling row.
  const existing = await prisma.clinic.findMany({
    select: { external_id: true, app_id: true, name: true, company_id: true, active: true,
              company: { select: { slug: true, id: true } } },
  })
  // Pick one representative (canonical external_id) per (company_id, name).
  const byKey = new Map<string, typeof existing[number]>()
  for (const c of existing) {
    const key = `${c.company_id}|${c.name}`
    if (!byKey.has(key)) byKey.set(key, c)
  }
  console.log(`[backfill] ${byKey.size} unique (company,name) clinics in Hub to backfill`)

  let created = 0
  let pushed = 0
  let pushFailed = 0

  for (const c of byKey.values()) {
    for (const newAppId of NEW_APPS) {
      // Hub-side: ensure a Clinic row exists for this (newAppId, external_id).
      await upsertClinic({
        external_id: c.external_id,
        app_id: newAppId,
        name: c.name,
        company_id: c.company_id,
        active: c.active,
      })
      created++

      // Sub-app side: push via POST /api/sync/clinics.
      const appUrl = APP_URLS[newAppId]
      if (!appUrl) {
        console.log(`  [${newAppId}] no URL configured — skipping push`)
        continue
      }
      try {
        const company = c.company
        const res = await fetch(`${appUrl}/api/sync/clinics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
          body: JSON.stringify({
            app_id: newAppId,
            hub_company_id: company.id,
            hubCompanyId: company.id,
            company_slug: company.slug,
            company_name: company.slug,
            clinics: [{ id: c.external_id, name: c.name, active: c.active }],
          }),
          signal: AbortSignal.timeout(8_000),
        })
        const body = await res.text().catch(() => '')
        if (res.ok) {
          pushed++
          console.log(`  ✓ [${newAppId}] ${c.name} → 200`)
        } else {
          pushFailed++
          console.log(`  ✗ [${newAppId}] ${c.name} → ${res.status} ${body.slice(0, 120)}`)
        }
      } catch (err) {
        pushFailed++
        console.log(`  ✗ [${newAppId}] ${c.name} → ${(err as Error).message}`)
      }
    }
  }
  console.log(`\n[backfill] done — Hub rows ensured: ${created}, sub-app push ok: ${pushed}, failed: ${pushFailed}`)
  await prisma.$disconnect()
}

void main().catch((e) => { console.error(e); process.exit(1) })
