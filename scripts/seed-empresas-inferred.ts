/**
 * Seed empresas reales inferidas a partir de los emails huérfanos detectados
 * en la auditoría 2026-05-09. Las inferencias se basan en dominios de email
 * que aparecen en sub-apps (vidental.com, viadental.com, impladent, etc).
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/seed-empresas-inferred.ts
 *
 * El script:
 *   1. Crea/upserta cada empresa en Hub via prisma.company (con auto-grant
 *      de todas las apps no-internal y auto-link de superadmin via createCompany).
 *   2. Propaga al sub-app via pushCompanyToApps().
 *
 * Idempotente: re-correr no duplica nada (slug es UNIQUE).
 */
import { prisma } from '../src/lib/prisma'
import { createCompany } from '../src/lib/db'
import { pushCompanyToApps } from '../src/lib/sync'

interface Seed {
  slug: string
  name: string
  cif?: string | null
  city?: string | null
}

// Inferidos del audit 2026-05-09 — ajusta si los nombres oficiales son distintos.
const EMPRESAS: Seed[] = [
  { slug: 'vidental',     name: 'Vidental' },
  { slug: 'viadental',    name: 'Viadental' },
  { slug: 'impulsodent',  name: 'ImpulsoDent' },
  { slug: 'impladent',    name: 'Impladent' },
]

async function main() {
  for (const e of EMPRESAS) {
    const existing = await prisma.company.findUnique({ where: { slug: e.slug } })
    let company
    if (existing) {
      console.log(`[seed-empresas] '${e.slug}' already exists (id=${existing.id}) — skipping create`)
      company = existing
    } else {
      company = await createCompany({
        name: e.name,
        slug: e.slug,
        cif: e.cif ?? undefined,
        city: e.city ?? undefined,
      })
      console.log(`[seed-empresas] created '${e.slug}' (id=${company.id})`)
    }
    // Push to sub-apps so each one upserts its own Company row by slug.
    await pushCompanyToApps({
      id: company.id,
      slug: company.slug,
      name: company.name,
      taxId: company.cif ?? null,
      email: company.email ?? null,
      phone: company.phone ?? null,
      address: company.address ?? null,
      subscription_plan: company.subscription_plan,
      subscription_expires_at:
        typeof company.subscription_expires_at === 'string'
          ? company.subscription_expires_at
          : (company.subscription_expires_at as unknown as Date | null)?.toISOString() ?? null,
      max_clinics: company.max_clinics,
      max_users: company.max_users,
      active: company.active,
    })
  }
  console.log('[seed-empresas] done. Re-run the audit to verify.')
  await prisma.$disconnect()
}

void main().catch((e) => { console.error(e); process.exit(1) })
