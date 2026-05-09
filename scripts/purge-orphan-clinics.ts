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
import { prisma } from '../src/lib/prisma'

interface PurgeResult {
  ok: boolean
  status: number
  body: string
}

async function deactivateClinicWithSlug(
  appUrl: string,
  appId: string,
  secret: string,
  companySlug: string,
  hubCompanyId: string | null,
  clinic: AppClinicRow,
): Promise<PurgeResult> {
  try {
    const res = await fetch(`${appUrl}/api/sync/clinics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({
        // Send every alias variant — sub-apps validate against subsets of the
        // canonical contract; sending all is harmless for the strict ones and
        // ignored by the lax ones.
        app_id: appId,
        company_slug: companySlug,
        company_name: companySlug,
        ...(hubCompanyId ? { hub_company_id: hubCompanyId, hubCompanyId } : {}),
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
  appId: string,
  secret: string,
  candidates: { slug: string; hubCompanyId: string | null }[],
  clinic: AppClinicRow,
): Promise<PurgeResult> {
  let last: PurgeResult = { ok: false, status: 0, body: 'no candidates' }
  for (const { slug, hubCompanyId } of candidates) {
    const r = await deactivateClinicWithSlug(appUrl, appId, secret, slug, hubCompanyId, clinic)
    if (r.ok) return r
    last = r
    // For 404/400 keep trying. For 401/403/500 stop early.
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

  // Build candidate slugs from current Hub state. Real Hub empresas first
  // (so strict sub-apps find a matching Company AND a matching hub_company_id);
  // placeholder last for apps that auto-create on the fly.
  const realCompanies = await prisma.company.findMany({ select: { id: true, slug: true } })
  const candidates: { slug: string; hubCompanyId: string | null }[] = [
    ...realCompanies.map((c) => ({ slug: c.slug, hubCompanyId: c.id })),
    { slug: 'hub-orphan-purge', hubCompanyId: null },
  ]
  console.log(`[purge-clinics] candidates: ${candidates.map((c) => c.slug).join(', ')}`)

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
      const res = await deactivateClinic(app.app_url, app.app_id, secret, candidates, c)
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
