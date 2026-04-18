import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const APPS = [
  { app_id: 'clinicpnl',     name: 'ClinicPNL' },
  { app_id: 'clinicvox',     name: 'ClinicVox' },
  { app_id: 'dentalspot',    name: 'DentalSpot' },
  { app_id: 'spendflow',     name: 'SpendFlow' },
  { app_id: 'fichaje',       name: 'Fichaje' },
  { app_id: 'zentrix',       name: 'Zentrix' },
  { app_id: 'nexuserp',      name: 'NexusERP' },
  { app_id: 'dentalhr',      name: 'DentalHR' },
  { app_id: 'dentalreports', name: 'DentalReports' },
]

async function main() {
  for (const app of APPS) {
    await prisma.appRegistration.upsert({
      where:  { app_id: app.app_id },
      update: { name: app.name },
      create: { app_id: app.app_id, name: app.name, sync_enabled: false },
    })
  }
  console.log(`Seeded ${APPS.length} app registrations.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
