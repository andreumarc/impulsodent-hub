/**
 * Grants every superadmin user access to ALL companies and ALL clinics in the Hub.
 *
 * Effects per superadmin user:
 *  - Sets `clinic_access_all = true`
 *  - Inserts a UserClinicAccess row for every existing clinic (idempotent — skips existing pairs)
 *
 * Run: `npx tsx scripts/grant-superadmin-access.ts` from the Hub root with .env.local pointing to the
 * production Neon DATABASE_URL.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const supers = await prisma.hubUser.findMany({ where: { role: "superadmin" } });
  if (supers.length === 0) {
    console.log("No superadmin users found.");
    return;
  }

  const clinics = await prisma.clinic.findMany({ select: { id: true, name: true, company_id: true } });
  const companies = await prisma.company.findMany({ select: { id: true, name: true } });
  console.log(`Superadmins: ${supers.length} · Companies: ${companies.length} · Clinics: ${clinics.length}`);

  for (const u of supers) {
    console.log(`\n→ ${u.email}`);

    await prisma.hubUser.update({
      where: { id: u.id },
      data: { clinic_access_all: true, active: true },
    });

    // Idempotent inserts: skip duplicates
    const existing = await prisma.userClinicAccess.findMany({
      where: { user_id: u.id },
      select: { clinic_id: true },
    });
    const have = new Set(existing.map((e) => e.clinic_id));
    const toCreate = clinics.filter((c) => !have.has(c.id));

    if (toCreate.length === 0) {
      console.log("  Already linked to every clinic. clinic_access_all=true.");
    } else {
      await prisma.userClinicAccess.createMany({
        data: toCreate.map((c) => ({ user_id: u.id, clinic_id: c.id })),
        skipDuplicates: true,
      });
      console.log(`  + linked ${toCreate.length} new clinics (${have.size} were already linked)`);
    }

    // Sanity report per company
    const accessByCompany = await prisma.userClinicAccess.findMany({
      where: { user_id: u.id },
      include: { clinic: { select: { company_id: true } } },
    });
    const byCompany = new Map<string, number>();
    for (const a of accessByCompany) {
      byCompany.set(a.clinic.company_id, (byCompany.get(a.clinic.company_id) ?? 0) + 1);
    }
    for (const c of companies) {
      const count = byCompany.get(c.id) ?? 0;
      const total = clinics.filter((k) => k.company_id === c.id).length;
      console.log(`    · ${c.name}: ${count}/${total} clínicas`);
    }
  }

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
