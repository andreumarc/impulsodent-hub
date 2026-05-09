/**
 * Purga clínicas huérfanas en cada sub-app.
 *
 * "Huérfana" = clínica en sub-app cuyo `id` (external_id) NO existe en la
 * tabla `Clinic` del Hub. Como el Hub está casi vacío (0 clínicas), TODAS
 * las clínicas de los sub-apps son huérfanas en este momento.
 *
 * Estrategia: usar el endpoint canónico `POST /api/sync/clinics` con
 * `{ company_slug, clinics: [{id, name, active: false}] }` para soft-deletar
 * cada clínica. Para resolver `company_slug` por clínica:
 *   1. Si la app responde a `GET /api/sync/clinics?company_id=<slug>` y soporta
 *      filtro, agrupamos por empresa.
 *   2. Si no, usamos un slug placeholder (`hub-orphan-purge`) que el handler
 *      auto-creará si no existe. Esto deja una empresa fantasma en el sub-app
 *      que el usuario puede limpiar después; el side-effect es aceptable porque
 *      ya estamos limpiando data no canónica.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/purge-orphan-clinics.ts            # dry-run
 *   npx tsx --env-file=.env.local scripts/purge-orphan-clinics.ts --apply    # destructivo
 */
import { runAudit } from '../src/lib/audit-sync'
import type { AppClinicRow } from '../src/lib/audit-sync'

interface PurgeResult {
  ok: boolean
  status: number
  body: string
}

async function deactivateClinicWithSlug(
  appUrl: string,
  secret: string,
  companySlug: string,
  clinic: AppClinicRow,
): Promise<PurgeResult> {
  try {
    const res = await fetch(`${appUrl}/api/sync/clinics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({
        company_slug: companySlug,
        company_name: companySlug,
        clinics: [{ id: clinic.id, name: clinic.name, active: false }],
      }),
      signal: AbortSignal.timeout(10_000),
    })
    const body = await res.text().catch(() => '')
    return { ok: res.ok, status: res.status, body: body.slice(0, 200) }
  } catch (err) {
    const e = err as { message?: string }
    return { ok: false, status: 0, body: e?.message ?? String(err) }
  }
}

/**
 * Try a list of candidate company_slugs until one succeeds. Some sub-apps
 * auto-create the Company (any slug works); strict ones require an existing
 * Company row, so we try the real Hub-pushed empresas first before falling
 * back to a placeholder.
 */
async function deactivateClinic(
  appUrl: string,
  secret: string,
  candidates: string[],
  clinic: AppClinicRow,
): Promise<PurgeResult> {
  let last: PurgeResult = { ok: false, status: 0, body: 'no candidates' }
  for (const slug of candidates) {
    const r = await deactivateClinicWithSlug(appUrl, secret, slug, clinic)
    if (r.ok) return r
    last = r
    // For 404 (Company not found) keep trying. For 401/403/500 stop early.
    if (r.status !== 404 && r.status !== 400) break
  }
  return last
}

async function main() {
  const apply = process.argv.includes('--apply')
  const secret = process.env.HUB_JWT_SECRET ?? process.env.JWT_SECRET ?? ''
  if (!secret) throw new Error('HUB_JWT_SECRET / JWT_SECRET not configured')

  console.log(`[purge-clinics] mode = ${apply ? 'APPLY (destructive)' : 'DRY-RUN'}`)
  const report = await runAudit()
  let totalOrphans = 0
  let totalSucceeded = 0
  let totalFailed = 0

  // Candidate company_slugs to try, in order. Real Hub-pushed empresas first
  // (so strict sub-apps find a matching Company); placeholder last for apps
  // that auto-create on the fly.
  const SLUG_CANDIDATES = ['vidental', 'viadental', 'impulsodent', 'impladent', 'hub-orphan-purge']

  for (const app of report.apps) {
    if (!app.app_url || app.orphan_clinics.length === 0) continue
    totalOrphans += app.orphan_clinics.length
    console.log(`\n[${app.app_id}] ${app.orphan_clinics.length} orphan clinics:`)

    if (!apply) {
      for (const c of app.orphan_clinics) {
        console.log(`  · ${c.name} (id=${c.id}) — would deactivate`)
      }
      continue
    }

    for (const c of app.orphan_clinics) {
      const res = await deactivateClinic(app.app_url, secret, SLUG_CANDIDATES, c)
      if (res.ok) {
        totalSucceeded++
        console.log(`  ✓ ${c.name} → ${res.status}`)
      } else {
        totalFailed++
        console.log(`  ✗ ${c.name} → ${res.status} ${res.body.slice(0, 120)}`)
      }
    }
  }
  console.log(`\n[purge-clinics] done — ${totalOrphans} orphan clinics across all apps`)
  if (apply) {
    console.log(`  succeeded: ${totalSucceeded}, failed: ${totalFailed}`)
  } else {
    console.log('Re-run with --apply to actually deactivate.')
  }
}

void main().catch((e) => { console.error(e); process.exit(1) })
