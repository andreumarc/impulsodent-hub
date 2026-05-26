/**
 * Daily cron (~04:30 UTC) that pushes the canonical active-user list per
 * company to every sub-app with `reconcile: true` semantics. Sub-apps
 * soft-delete Hub-origin users not in the payload.
 */
import { type NextRequest, NextResponse } from 'next/server'
import { reconcileUsers } from '@/lib/reconcile'

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
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await reconcileUsers()
  console.log('[cron/reconcile-users]', {
    pairs: result.pairs, ok: result.ok, failed: result.failed, elapsedMs: result.elapsedMs,
  })
  return NextResponse.json(result)
}
