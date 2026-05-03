/**
 * Re-sync de un usuario concreto del Hub a todas sus app_roles.
 * Útil cuando el sync fire-and-forget original falló.
 *
 * Run: node scripts/resync-user.js <email>
 */
const { Client } = require("pg");
const HUB = "postgresql://neondb_owner:npg_0FqHflC9EthB@ep-fancy-union-al2mgakg-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&channel_binding=require";

const APP_URLS = {
  dentalhr: "https://dentalhr.impulsodent.com",
  clinicpnl: "https://clinicpnl.impulsodent.com",
  clinicvox: "https://clinicvox.impulsodent.com",
  spendflow: "https://spendflow.impulsodent.com",
  fichaje: "https://fichajeshr.impulsodent.com",
  zentrix: "https://zentrix.impulsodent.com",
  dentalreports: "https://dentalreports.impulsodent.com",
  clinicrefunds: "https://clinicrefunds.impulsodent.com",
  nexora: "https://nexora.impulsodent.com",
  clinicstock: "https://clinicstock.impulsodent.com",
  "impulsodent-crm": "https://crm.impulsodent.com",
  talent: "https://talent.impulsodent.com",
  duediligence: "https://due.impulsodent.com",
  ddc: "https://ddc.impulsodent.com",
};

(async () => {
  const email = process.argv[2];
  if (!email) {
    console.error("Uso: node scripts/resync-user.js <email>");
    process.exit(1);
  }
  const secret = process.env.JWT_SECRET ?? "";
  if (!secret) {
    console.error("JWT_SECRET missing — exporta primero la var del Hub.");
    process.exit(1);
  }

  const c = new Client({ connectionString: HUB });
  await c.connect();
  const { rows: users } = await c.query(
    `SELECT id, email, name, role, company_id, password_hash FROM hub_users WHERE LOWER(email) = LOWER($1)`,
    [email],
  );
  if (!users[0]) { console.error("User not found"); await c.end(); return; }
  const u = users[0];
  const co = u.company_id ? (await c.query(`SELECT slug FROM companies WHERE id = $1`, [u.company_id])).rows[0] : null;
  const { rows: appRoles } = await c.query(
    `SELECT app_id, role, clinic_access_all, clinic_ids FROM user_app_roles WHERE user_id = $1`,
    [u.id],
  );
  console.log(`Re-sync ${u.email} (company=${co?.slug}) → ${appRoles.length} app(s)`);

  for (const ar of appRoles) {
    const url = APP_URLS[ar.app_id];
    if (!url) { console.log(`  ${ar.app_id} → skip (no URL)`); continue; }
    let clinicIds = "ALL";
    if (!ar.clinic_access_all && Array.isArray(ar.clinic_ids)) {
      // Map hub clinic ids → external_ids per app
      const { rows: clinics } = await c.query(
        `SELECT external_id FROM clinics WHERE id = ANY($1::text[]) AND app_id = $2`,
        [ar.clinic_ids, ar.app_id],
      );
      clinicIds = clinics.map((c) => c.external_id);
    }
    const payload = {
      email: u.email,
      name: u.name,
      role: ar.role,
      company_slug: co?.slug ?? null,
      clinic_ids: clinicIds,
    };
    if (u.password_hash && /^\$2[aby]\$/.test(u.password_hash)) payload.password_hash = u.password_hash;
    try {
      const res = await fetch(`${url}/api/sync/user`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
        body: JSON.stringify(payload),
      });
      const txt = await res.text();
      console.log(`  ${ar.app_id} → ${res.status} ${txt.slice(0, 100)}`);
    } catch (e) {
      console.log(`  ${ar.app_id} → ERR ${e.message}`);
    }
  }
  await c.end();
})();
