const { Client } = require("pg");
const HUB = "postgresql://neondb_owner:npg_0FqHflC9EthB@ep-fancy-union-al2mgakg-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&channel_binding=require";

(async () => {
  const c = new Client({ connectionString: HUB });
  await c.connect();
  const u = await c.query(
    `SELECT id, email, name, role, company_id, active FROM hub_users WHERE LOWER(email) LIKE '%maia%' OR LOWER(name) LIKE '%maia%' OR LOWER(name) LIKE '%cortes%'`,
  );
  console.log("Hub matches:", u.rows);
  if (u.rows.length === 0) { await c.end(); return; }
  for (const x of u.rows) {
    const ar = await c.query(
      `SELECT app_id, role, clinic_access_all, clinic_ids FROM user_app_roles WHERE user_id = $1`,
      [x.id],
    );
    console.log(`\n  app_roles for ${x.email}:`, ar.rows);
    const co = await c.query(`SELECT slug, name, active FROM companies WHERE id = $1`, [x.company_id]);
    console.log(`  company:`, co.rows);
  }
  await c.end();
})();
