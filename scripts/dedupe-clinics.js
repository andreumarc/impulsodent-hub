/**
 * Limpia duplicados en hub.clinics:
 *   - Por cada grupo (company_id, name, app_id) con >1 fila, mantiene la
 *     más antigua (canonical) y borra el resto.
 *   - user_app_roles.clinic_ids es TEXT[] de IDs de clinics: reemplazo
 *     duplicates → canonical y deduplico el array antes de update.
 *   - hub_users.clinic_ids: idem.
 *
 * Idempotente (re-ejecutable). DRY-RUN por defecto: pasar --apply para escribir.
 *
 * Run: node scripts/dedupe-clinics.js [--apply]
 */
const { Client } = require("pg");
const HUB = "postgresql://neondb_owner:npg_0FqHflC9EthB@ep-fancy-union-al2mgakg-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&channel_binding=require";

const APPLY = process.argv.includes("--apply");

(async () => {
  const c = new Client({ connectionString: HUB });
  await c.connect();
  console.log(APPLY ? "▶ APPLY MODE — escribirá cambios" : "👀 DRY-RUN — sin cambios. Pasa --apply para escribir.\n");

  // 1. Obtener grupos duplicados (>1 fila por company+name+app_id)
  const { rows: groups } = await c.query(`
    SELECT company_id, name, app_id,
           ARRAY_AGG(id ORDER BY created_at) AS ids
    FROM clinics
    GROUP BY company_id, name, app_id
    HAVING COUNT(*) > 1
  `);

  console.log(`Grupos duplicados: ${groups.length}`);
  let totalToDelete = 0;
  const idMapping = new Map(); // old_id → canonical_id
  for (const g of groups) {
    const [canonical, ...dupes] = g.ids;
    totalToDelete += dupes.length;
    for (const d of dupes) idMapping.set(d, canonical);
  }
  console.log(`Filas duplicadas a eliminar: ${totalToDelete}`);
  console.log(`Canonical clinic_ids: ${groups.length}`);

  if (totalToDelete === 0) {
    console.log("No hay nada que hacer.");
    await c.end();
    return;
  }

  if (!APPLY) {
    console.log("\n(dry-run) Sample mappings:");
    let i = 0;
    for (const [from, to] of idMapping) {
      console.log(`  ${from}  →  ${to}`);
      if (++i >= 10) break;
    }
    await c.end();
    return;
  }

  // 2. user_app_roles.clinic_ids contiene IDs de clínicas. Reemplazo.
  console.log("\n→ Limpiando user_app_roles.clinic_ids…");
  const { rows: uarRows } = await c.query(`SELECT user_id, app_id, clinic_ids FROM user_app_roles WHERE clinic_ids IS NOT NULL AND array_length(clinic_ids, 1) > 0`);
  let uarUpdates = 0;
  for (const r of uarRows) {
    const newIds = Array.from(new Set((r.clinic_ids || []).map((id) => idMapping.get(id) ?? id)));
    const oldSet = new Set(r.clinic_ids);
    const changed = newIds.length !== oldSet.size || newIds.some((x) => !oldSet.has(x));
    if (changed) {
      await c.query(`UPDATE user_app_roles SET clinic_ids = $1 WHERE user_id = $2 AND app_id = $3`, [newIds, r.user_id, r.app_id]);
      uarUpdates++;
    }
  }
  console.log(`  user_app_roles: ${uarUpdates} filas remapped.`);

  // 3. hub_users no tiene columna clinic_ids — solo el legacy clinic_id (sin -s)?
  // Comprobamos columnas dinámicamente.
  const { rows: hubUserCols } = await c.query(`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'hub_users'
  `);
  const cols = new Set(hubUserCols.map((r) => r.column_name));
  if (cols.has("clinic_id")) {
    console.log("\n→ Limpiando hub_users.clinic_id (singular)…");
    let huUpdates = 0;
    for (const [oldId, newId] of idMapping) {
      const r = await c.query(`UPDATE hub_users SET clinic_id = $1 WHERE clinic_id = $2`, [newId, oldId]);
      huUpdates += r.rowCount;
    }
    console.log(`  hub_users: ${huUpdates} filas remapped.`);
  } else {
    console.log("\n(sin columna clinic_ids/clinic_id en hub_users — saltado)");
  }

  // 4. Borrar las filas duplicadas
  const idsToDelete = Array.from(idMapping.keys());
  console.log(`\n→ Borrando ${idsToDelete.length} filas duplicadas…`);
  // Borrar en lotes para no superar limites de query length
  const batchSize = 200;
  for (let i = 0; i < idsToDelete.length; i += batchSize) {
    const batch = idsToDelete.slice(i, i + batchSize);
    await c.query(`DELETE FROM clinics WHERE id = ANY($1::text[])`, [batch]);
  }
  console.log("  ✓ Hecho.");

  // 5. Verificación final
  const after = await c.query(`SELECT COUNT(*)::int AS total FROM clinics`);
  console.log(`\nFilas tras limpieza: ${after.rows[0].total}`);

  await c.end();
})().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
