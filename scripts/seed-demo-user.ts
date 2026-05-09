/**
 * Create / refresh the demo user in the Hub and push to every sub-app.
 *
 * Credentials (canonical, see memory `project_demo_user.md`):
 *   email:    demo@impulsodent.com
 *   password: Demo2026!
 *   role:     demo (read-only across all apps)
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/seed-demo-user.ts
 */
import bcrypt from 'bcryptjs'
import { prisma } from '../src/lib/prisma'
import { pushUserToApps } from '../src/lib/sync'

const EMAIL = 'demo@impulsodent.com'
const PASSWORD = 'Demo2026!'
const NAME = 'Demo ImpulsoDent'

async function main() {
  const password_hash = await bcrypt.hash(PASSWORD, 12)
  const existing = await prisma.hubUser.findUnique({ where: { email: EMAIL } })

  const user = existing
    ? await prisma.hubUser.update({
        where: { email: EMAIL },
        data: {
          name: NAME,
          role: 'demo',
          active: true,
          clinic_access_all: true,
          company_access_all: true,
          password_hash,
        },
      })
    : await prisma.hubUser.create({
        data: {
          email: EMAIL,
          password_hash,
          name: NAME,
          role: 'demo',
          active: true,
          clinic_access_all: true,
          company_access_all: true,
          subscription_plan: 'demo',
          max_clinics: 100,
        },
      })

  console.log(existing ? '[seed-demo] updated existing user' : '[seed-demo] created new user', { id: user.id, email: user.email })

  // Push to all sub-apps so the demo can SSO everywhere immediately.
  console.log('[seed-demo] pushing to all configured sub-apps…')
  await pushUserToApps({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companyId: user.company_id,
    subscription_plan: user.subscription_plan,
    subscription_expires_at: user.subscription_expires_at?.toISOString() ?? null,
    max_clinics: user.max_clinics,
    active: user.active,
    password: PASSWORD, // plaintext so each sub-app can hash with its own bcrypt rounds
    password_hash: user.password_hash,
  })
  console.log('[seed-demo] done. Demo user is in Hub and pushed to sub-apps.')
  await prisma.$disconnect()
}

void main().catch((e) => { console.error(e); process.exit(1) })
