/**
 * One-shot resync of the superadmin user to every sub-app.
 *
 * Why we need this: `scripts/cron/resync-users` (Vercel cron) EXCLUDES
 * superadmin via `where: { role: { not: 'superadmin' } }`. So drift
 * affecting the superadmin's role in any sub-app is never auto-corrected
 * by the nightly job. This script pushes the superadmin manually so the
 * sub-apps update their stored role to canonical SUPERADMIN.
 *
 * Note: some sub-apps (notably dental-hr) intentionally REJECT
 * `role=superadmin` from sync and require their own admin UI to assign
 * it. Those will return 403 and the drift will persist by design.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/force-push-superadmin.ts
 */
import { prisma } from '../src/lib/prisma'
import { pushUserToApps } from '../src/lib/sync'

async function main() {
  const u = await prisma.hubUser.findUnique({
    where: { email: 'marcandreuguerao@gmail.com' },
  })
  if (!u) {
    console.error('Superadmin not found in Hub')
    process.exit(1)
  }
  console.log('[force-push] pushing superadmin to all configured sub-apps…')
  await pushUserToApps({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    companyId: u.company_id,
    subscription_plan: u.subscription_plan,
    subscription_expires_at: u.subscription_expires_at?.toISOString() ?? null,
    max_clinics: u.max_clinics,
    active: u.active,
    password_hash: u.password_hash,
  })
  console.log('[force-push] done. Re-run the audit to verify.')
  await prisma.$disconnect()
}

void main().catch((e) => { console.error(e); process.exit(1) })
