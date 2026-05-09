/**
 * Link the cross-company canonical users (superadmin + demo) to every empresa
 * in Hub via UserCompanyAccess, then re-push them to all sub-apps so each
 * sub-app creates a Membership row per company.
 *
 * Why: nexora and clinicstock's GET /api/sync/users only return users that
 * have at least one Membership. Cross-company users with company_slug=null
 * have no memberships → they don't appear in those GETs (M-u:1 in audit).
 * Linking explicitly + re-pushing creates one membership per (user × company).
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/link-cross-company-users.ts
 */
import { prisma } from '../src/lib/prisma'
import { setUserCompanyAccess } from '../src/lib/db'
import { pushUserToApps } from '../src/lib/sync'

async function main() {
  const companies = await prisma.company.findMany({ select: { id: true, slug: true } })
  if (companies.length === 0) {
    console.log('[link] no empresas in Hub — run scripts/seed-empresas-inferred.ts first')
    return
  }
  const companyIds = companies.map((c) => c.id)
  console.log(`[link] ${companies.length} empresas:`, companies.map((c) => c.slug).join(', '))

  // Pick the cross-company users (canonical: superadmin + demo).
  const users = await prisma.hubUser.findMany({
    where: { OR: [{ role: 'superadmin' }, { role: 'demo' }], active: true },
    select: { id: true, email: true, name: true, role: true, company_id: true, password_hash: true, subscription_plan: true, subscription_expires_at: true, max_clinics: true },
  })
  console.log(`[link] users to link:`, users.map((u) => `${u.email}(${u.role})`).join(', '))

  for (const u of users) {
    await setUserCompanyAccess(u.id, companyIds)
    console.log(`[link] ${u.email} → linked to ${companyIds.length} empresas`)

    // Re-push to all sub-apps. Hub's pushUserToApps iterates each app and
    // attaches the user to every (user × company) tuple it knows about
    // through the per-app role + clinic_ids logic. For M-u apps this will
    // now create the Membership/UserTenantRole rows.
    await pushUserToApps({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      companyId: u.company_id,
      subscription_plan: u.subscription_plan,
      subscription_expires_at: u.subscription_expires_at?.toISOString() ?? null,
      max_clinics: u.max_clinics,
      active: true,
      password_hash: u.password_hash,
    })
  }
  console.log('[link] done. Re-run the audit to verify M-u counts dropped.')
  await prisma.$disconnect()
}

void main().catch((e) => { console.error(e); process.exit(1) })
