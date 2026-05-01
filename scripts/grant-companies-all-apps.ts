/**
 * Grants every Company access to every catalog app (CompanyAppAccess).
 * Idempotent — `skipDuplicates` keeps existing rows untouched.
 *
 * Run:
 *   set -a && . ./.env.local && set +a && npx tsx scripts/grant-companies-all-apps.ts
 */
import { PrismaClient } from "@prisma/client";
import { APPS } from "../src/lib/apps";

const prisma = new PrismaClient();

async function main() {
  const appIds = APPS.filter((a) => !a.internal).map((a) => a.id);
  const companies = await prisma.company.findMany({ select: { id: true, name: true } });
  console.log(`Companies: ${companies.length} · Apps: ${appIds.length}`);

  for (const c of companies) {
    const existing = await prisma.companyAppAccess.findMany({
      where: { company_id: c.id },
      select: { app_id: true },
    });
    const have = new Set(existing.map((e) => e.app_id));
    const missing = appIds.filter((a) => !have.has(a));
    if (missing.length === 0) {
      console.log(`✓ ${c.name}: ya tiene los ${appIds.length} aplicativos`);
      continue;
    }
    await prisma.companyAppAccess.createMany({
      data: missing.map((app_id) => ({ company_id: c.id, app_id })),
      skipDuplicates: true,
    });
    console.log(`+ ${c.name}: añadidos ${missing.length} (${have.size} ya tenía)`);
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
