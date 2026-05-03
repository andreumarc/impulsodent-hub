const { PrismaClient } = require("@prisma/client");
const { Client } = require("pg");
const HUB = "postgresql://neondb_owner:npg_0FqHflC9EthB@ep-fancy-union-al2mgakg-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&channel_binding=require";
const DH = "postgresql://neondb_owner:npg_S8fKp1xIsJBT@ep-little-surf-alfrjqa3-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

(async () => {
  const hub = new Client({ connectionString: HUB });
  await hub.connect();
  const r1 = await hub.query("SELECT email, name, role, active, company_id FROM hub_users WHERE LOWER(name) LIKE '%lorena%' OR LOWER(email) LIKE '%lorena%'");
  console.log("Hub users:", JSON.stringify(r1.rows, null, 2));

  if (r1.rows.length > 0) {
    for (const u of r1.rows) {
      const ar = await hub.query("SELECT app_id, role, clinic_access_all, clinic_ids FROM user_app_roles WHERE user_id = (SELECT id FROM hub_users WHERE email=$1)", [u.email]);
      console.log("App roles for", u.email, ":", ar.rows);
    }
  }

  const dh = new Client({ connectionString: DH });
  await dh.connect();
  const r2 = await dh.query("SELECT email, \"firstName\", \"lastName\", status FROM \"User\" WHERE LOWER(email) LIKE '%lorena%' OR LOWER(\"firstName\") LIKE '%lorena%'");
  console.log("Dental-hr users:", JSON.stringify(r2.rows, null, 2));

  await hub.end();
  await dh.end();
})();
