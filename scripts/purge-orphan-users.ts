/**
 * Purge orphan USERS from sub-apps.
 *
 * "Orphan" = a user that exists in a sub-app but NOT in the Hub. These should
 * never be promoted to the Hub (one-way rule); instead we deactivate them in
 * each sub-app using the canonical `POST /api/sync/user` with `active: false`.
 *
 * The script does NOT physically delete rows. Sub-apps decide whether to
 * deactivate (status=INACTIVE / isActive=false) or soft-delete (deletedAt).
 *
 * Strategy:
 *   1. Run `runAudit()` (no DB writes — read-only).
 *   2. For each app, for each `orphan_users[i]`, POST to that sub-app:
 *      `{ email, active: false, role: 'auxiliar' }`
 *   3. Print a per-app summary.
 *
 * Safety:
 *   - Dry-run by default. Pass `--apply` to actually deactivate.
 *   - Skips emails matching the configured allow-list (e.g. demo, superadmin).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/purge-orphan-users.ts            # dry-run
 *   npx tsx --env-file=.env.local scripts/purge-orphan-users.ts --apply    # destructive
 */
import { runAudit } from '../src/lib/audit-sync'
import { APP_URLS } from '../src/lib/app-urls'

// Emails that, even if "orphan" relative to the Hub right now, must not be
// touched. Add legitimate cross-company users that pre-date the Hub.
const ALLOWLIST = new Set<string>([
  // No exclusions by default — Hub is the only source of truth.
])

async function deactivate(appUrl: string, email: string, secret: string): Promise<{ ok: boolean; status: number; body: string }> {
  const url = `${appUrl}/api/sync/user`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({
        email,
        name: email,
        role: 'auxiliar',
        active: false,
        clinic_ids: 'ALL',
      }),
      signal: AbortSignal.timeout(8_000),
    })
    const body = await res.text().catch(() => '')
    return { ok: res.ok, status: res.status, body: body.slice(0, 200) }
  } catch (err) {
    const e = err as { message?: string }
    return { ok: false, status: 0, body: e?.message ?? String(err) }
  }
}

async function main() {
  const apply = process.argv.includes('--apply')
  const secret = process.env.HUB_JWT_SECRET ?? process.env.JWT_SECRET ?? ''
  if (!secret) throw new Error('HUB_JWT_SECRET / JWT_SECRET not configured')

  console.log(`[purge] mode = ${apply ? 'APPLY (destructive)' : 'DRY-RUN'}`)
  const report = await runAudit()
  let totalOrphans = 0
  let totalSkipped = 0

  for (const app of report.apps) {
    if (!app.app_url || app.orphan_users.length === 0) continue
    const targets = app.orphan_users.filter((u) => u.email && !ALLOWLIST.has(u.email.toLowerCase()))
    const skipped = app.orphan_users.length - targets.length
    totalOrphans += targets.length
    totalSkipped += skipped
    console.log(`\n[${app.app_id}] ${targets.length} orphan users to deactivate (${skipped} on allowlist):`)
    for (const u of targets) {
      if (apply) {
        const res = await deactivate(app.app_url, u.email, secret)
        console.log(`  ${res.ok ? '✓' : '✗'} ${u.email} → ${res.status} ${res.ok ? '' : res.body}`)
      } else {
        console.log(`  · ${u.email} (would deactivate)`)
      }
    }
  }
  console.log(`\n[purge] done — ${totalOrphans} orphans across all apps, ${totalSkipped} skipped via allowlist.`)
  if (!apply) console.log('Re-run with --apply to actually deactivate.')
}

void main().catch((e) => { console.error(e); process.exit(1) })
