/**
 * Re-pushes every Hub user to every sub-app via pushUserToApps.
 * Use after fixing user→company assignments in the Hub when sub-apps
 * are out of sync (e.g. ClinicPNL muestra 'Sin empresa asignada').
 *
 * Run:
 *   set -a && . ./.env.local && set +a && npx tsx scripts/resync-all-users.ts
 */
import { PrismaClient } from "@prisma/client";
import { pushUserToApps } from "../src/lib/sync";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.hubUser.findMany({ orderBy: { name: "asc" } });
  console.log(`Re-syncing ${users.length} users to all sub-apps…\n`);

  for (const u of users) {
    process.stdout.write(`→ ${u.email} (company_id=${u.company_id ?? "null"}) … `);
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
      // password omitted — sub-apps already have their hashed password
    });
    process.stdout.write("done\n");
  }

  console.log("\nDone. Revisa logs de Vercel de cada sub-app para ver respuestas.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
