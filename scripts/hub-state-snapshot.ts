import { prisma } from '../src/lib/prisma'

async function main() {
  const [users, companies, clinics, userAppRoles, companyAppAccess, userClinicAccess] = await Promise.all([
    prisma.hubUser.findMany({
      select: { email: true, name: true, role: true, active: true, company_id: true, clinic_access_all: true, company_access_all: true },
      orderBy: { email: 'asc' },
    }),
    prisma.company.findMany({ select: { slug: true, name: true, active: true } }),
    prisma.clinic.findMany({ select: { app_id: true, name: true, active: true } }),
    prisma.userAppRole.findMany({ include: { user: { select: { email: true } } } }),
    prisma.companyAppAccess.count(),
    prisma.userClinicAccess.count(),
  ])
  console.log('=== Users (ALL, including inactive) ===')
  console.log(JSON.stringify(users, null, 2))
  console.log(`Total: ${users.length} (active: ${users.filter((u) => u.active).length})`)
  console.log()
  console.log('=== Companies ===')
  console.log(`Total: ${companies.length}`)
  for (const c of companies) console.log(` - ${c.slug} (${c.name}) active=${c.active}`)
  console.log()
  console.log('=== Clinics ===')
  console.log(`Total: ${clinics.length}`)
  console.log()
  console.log('=== UserAppRole rows ===')
  console.log(`Total: ${userAppRoles.length}`)
  for (const r of userAppRoles) console.log(` - ${r.user.email} → ${r.app_id} = ${r.role}`)
  console.log()
  console.log('=== CompanyAppAccess rows ===', companyAppAccess)
  console.log('=== UserClinicAccess rows ===', userClinicAccess)
  await prisma.$disconnect()
}

void main().catch((e) => { console.error(e); process.exit(1) })
