import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pushUserToApps } from '@/lib/sync'

/**
 * Cron diario (03:00 UTC) que reenvía cada `hub_user` activo a todas las
 * sub-apps. Compensa cualquier sync fire-and-forget que se haya perdido por
 * deploys solapados, fallos de red transitorios o JWT en rotación.
 *
 * Idempotente: cada sub-app upserta por email y los datos no cambian si ya
 * estaban al día. Se apoya en el retry exponencial de pushUserToApps (3
 * intentos con backoff). Total cost por noche: ~30s para una decena de
 * usuarios × 14 sub-apps.
 *
 * Vercel Cron envía: `Authorization: Bearer <CRON_SECRET>`
 *   - CRON_SECRET es una env var auto-provisionada por Vercel cuando
 *     defines un cron en vercel.json. Si no existe (entornos preview),
 *     aceptamos JWT_SECRET como fallback para poder triggerearlo manualmente.
 */
export async function GET(request: NextRequest) {
  // Aceptamos cualquiera de los dos: CRON_SECRET (Vercel auto-provisioned)
  // o JWT_SECRET (mismo secret que firma los SSO tokens; práctico para
  // triggers manuales con el Bearer que ya conocen las sub-apps).
  const cronSecret = process.env.CRON_SECRET ?? ''
  const jwtSecret = process.env.JWT_SECRET ?? ''
  if (!cronSecret && !jwtSecret) {
    return NextResponse.json({ error: 'No auth secret configured' }, { status: 500 })
  }
  const auth = request.headers.get('authorization')
  const ok =
    (cronSecret && auth === `Bearer ${cronSecret}`) ||
    (jwtSecret && auth === `Bearer ${jwtSecret}`)
  if (!ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()
  const users = await prisma.hubUser.findMany({
    where: { active: true, role: { not: 'superadmin' } },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      company_id: true,
      subscription_plan: true,
      subscription_expires_at: true,
      max_clinics: true,
      active: true,
      password_hash: true,
    },
  })

  const summary = { total: users.length, ok: 0, failed: 0, errors: [] as string[] }
  for (const u of users) {
    try {
      await pushUserToApps({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        companyId: u.company_id ?? null,
        subscription_plan: u.subscription_plan ?? undefined,
        subscription_expires_at: u.subscription_expires_at?.toISOString() ?? null,
        max_clinics: u.max_clinics ?? undefined,
        active: u.active,
        // password_hash actúa como fallback cuando el sub-app no tiene la
        // contraseña aún (login directo sin haber pasado por SSO).
        password_hash: u.password_hash ?? undefined,
      })
      summary.ok++
    } catch (e) {
      summary.failed++
      summary.errors.push(`${u.email}: ${(e as Error).message}`)
    }
  }

  const elapsedMs = Date.now() - start
  console.log('[cron/resync-users]', { ...summary, elapsedMs })
  return NextResponse.json({ ...summary, elapsedMs })
}
