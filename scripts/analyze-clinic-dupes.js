/**
 * Analiza duplicados en hub.clinics:
 *  - Filas legítimas: 1 por (clinic_name, company_id, app_id) — cada app usa la suya.
 *  - Duplicados reales: 2+ con misma (company_id, name, app_id) → a fusionar.
 *  - Apps faltantes para alguna clínica.
 */
const { Client } = require("pg");
const HUB = "postgresql://neondb_owner:npg_0FqHflC9EthB@ep-fancy-union-al2mgakg-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&channel_binding=require";

(async () => {
  const c = new Client({ connectionString: HUB });
  await c.connect();

  console.log("━━━ TOP-LEVEL ━━━");
  const total = await c.query(`SELECT COUNT(*)::int FROM clinics`);
  console.log("Filas totales clinics:", total.rows[0].count);

  const apps = await c.query(`SELECT app_id, COUNT(*)::int FROM clinics GROUP BY app_id ORDER BY app_id`);
  console.log("\nFilas por app:");
  apps.rows.forEach((r) => console.log("  ", r.app_id, "→", r.count));

  console.log("\n━━━ DUPLICADOS REALES (mismo company_id + name + app_id) ━━━");
  const dupes = await c.query(`
    SELECT company_id, name, app_id, COUNT(*)::int AS n,
           ARRAY_AGG(id ORDER BY created_at) AS ids,
           ARRAY_AGG(external_id ORDER BY created_at) AS ext_ids,
           ARRAY_AGG(created_at ORDER BY created_at) AS created_dates
    FROM clinics
    GROUP BY company_id, name, app_id
    HAVING COUNT(*) > 1
    ORDER BY company_id, name, app_id
  `);
  console.log("Grupos duplicados:", dupes.rows.length);
  for (const d of dupes.rows) {
    console.log(`  ${d.name.padEnd(20)} app=${d.app_id.padEnd(20)} ×${d.n}`);
    console.log(`    ids:      ${d.ids.join(", ")}`);
    console.log(`    ext_ids:  ${d.ext_ids.join(", ")}`);
  }

  console.log("\n━━━ NO-DUPES (mismo nombre + empresa pero distintos external_id) ━━━");
  const sameName = await c.query(`
    SELECT company_id, LOWER(TRIM(name)) AS name_norm, COUNT(DISTINCT external_id)::int AS distinct_extids,
           COUNT(*)::int AS rows
    FROM clinics
    GROUP BY company_id, LOWER(TRIM(name))
    HAVING COUNT(DISTINCT external_id) > 1
    ORDER BY name_norm
    LIMIT 20
  `);
  console.log(`Casos con name=name_norm pero distintos external_ids: ${sameName.rows.length}`);
  for (const r of sameName.rows) {
    console.log(`  ${r.name_norm.padEnd(20)} company=${r.company_id} extids=${r.distinct_extids} rows=${r.rows}`);
  }

  await c.end();
})();
