/**
 * Daily cron (~04:00 UTC) that pushes the canonical clinic list to every
 * sub-app for every company, with `reconcile: true`. Sub-apps soft-delete
 * any local clinic for that company that's no longer in Hub.
 *
 * Auth: Bearer CRON_SECRET (Vercel auto-provisioned) or JWT_SECRET fallback
 * (same convention as /api/cron/resync-users).
 */
import { type NextRequest, NextResponse } from 'next/server'
import { reconcileClinics } from '@/lib/reconcile'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
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

  const result = await reconcileClinics()
  console.log('[cron/reconcile-clinics]', {
    pairs: result.pairs, ok: result.ok, failed: result.failed, skipped: result.skipped, elapsedMs: result.elapsedMs,
  })
  return NextResponse.json(result)
}
