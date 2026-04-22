import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getBillingOverview } from '@/lib/billing/metrics'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'superadmin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  try {
    const data = await getBillingOverview()
    return NextResponse.json(data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown_error'
    console.error('[admin/billing] error', msg)
    return NextResponse.json({ error: 'stripe_fetch_failed', message: msg }, { status: 500 })
  }
}
