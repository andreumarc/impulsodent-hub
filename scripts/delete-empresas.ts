/**
 * Delete specific empresas from Hub. Propagates `active: false` to sub-apps
 * before the local cascade-delete so each sub-app can soft-deactivate the
 * matching company by slug.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/delete-empresas.ts <slug1> <slug2> ...
 */
import { prisma } from '../src/lib/prisma'
import { pushCompanyToApps } from '../src/lib/sync'
import { deleteCompany } from '../src/lib/db'

async function main() {
  const slugs = process.argv.slice(2).filter(Boolean)
  if (slugs.length === 0) {
    console.error('Usage: npx tsx scripts/delete-empresas.ts <slug1> <slug2> ...')
    process.exit(1)
  }
  console.log(`[delete-empresas] target slugs:`, slugs)

  for (const slug of slugs) {
    const company = await prisma.company.findUnique({ where: { slug } })
    if (!company) {
      console.log(`[delete-empresas] '${slug}' not found in Hub — skipping`)
      continue
    }

    // Propagate active=false to sub-apps first.
    console.log(`[delete-empresas] pushing active=false for '${slug}' (id=${company.id})…`)
    await pushCompanyToApps({
      id: company.id,
      slug: company.slug,
      name: company.name,
      taxId: company.cif,
      email: company.email,
      phone: company.phone,
      address: company.address,
      subscription_plan: company.subscription_plan,
      subscription_expires_at: company.subscription_expires_at?.toISOString() ?? null,
      max_clinics: company.max_clinics,
      max_users: company.max_users,
      active: false,
    })

    // Cascade-delete from Hub (Clinic, UserCompanyAccess, CompanyAppAccess
    // all CASCADE, HubUser.company_id SET NULL).
    await deleteCompany(company.id)
    console.log(`[delete-empresas] deleted '${slug}' from Hub`)
  }

  await prisma.$disconnect()
  console.log('[delete-empresas] done')
}

void main().catch((e) => { console.error(e); process.exit(1) })
