/**
 * One-shot script: grant `helpdesk` app access to all active companies
 * and create UserAppRole entries for admin-tier users so they see the
 * Helpdesk card in the Hub launcher.
 *
 * Run: npx tsx scripts/grant-helpdesk-access.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const APP_ID = 'helpdesk'

async function main() {
  console.log(`[grant-helpdesk] Starting…`)

  const companies = await prisma.company.findMany({
    where: { active: true },
    select: { id: true, slug: true, name: true },
  })
  console.log(`[grant-helpdesk] Found ${companies.length} active companies`)

  let companyAccessGranted = 0
  for (const c of companies) {
    const existing = await prisma.companyAppAccess.findUnique({
      where: { company_id_app_id: { company_id: c.id, app_id: APP_ID } },
    })
    if (existing) continue
    await prisma.companyAppAccess.create({
      data: { company_id: c.id, app_id: APP_ID },
    })
    companyAccessGranted++
    console.log(`[grant-helpdesk]   + CompanyAppAccess  ${c.slug}`)
  }
  console.log(`[grant-helpdesk] Granted access to ${companyAccessGranted} new companies`)

  // Grant to ALL active hub users so Helpdesk appears in launcher.
  // Role inside helpdesk is decided by user.role (canonical) — this just exposes
  // the launcher card. Users without a clinic context still get a record.
  const users = await prisma.hubUser.findMany({
    where: { active: true },
    select: { id: true, email: true, role: true },
  })
  console.log(`[grant-helpdesk] Found ${users.length} active hub users`)

  let userRolesCreated = 0
  for (const u of users) {
    const existing = await prisma.userAppRole.findUnique({
      where: { user_id_app_id: { user_id: u.id, app_id: APP_ID } },
    })
    if (existing) continue
    await prisma.userAppRole.create({
      data: {
        user_id: u.id,
        app_id: APP_ID,
        role: u.role ?? 'auxiliar',
        clinic_access_all: true,
        clinic_ids: [],
      },
    })
    userRolesCreated++
  }
  console.log(`[grant-helpdesk] Created ${userRolesCreated} new UserAppRole entries`)

  console.log(`[grant-helpdesk] Done.`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
