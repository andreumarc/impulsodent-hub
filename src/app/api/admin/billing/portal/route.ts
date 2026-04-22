import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getStripe } from '@/lib/billing/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session || session.role !== 'superadmin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const body = (await req.json().catch(() => ({}))) as { customerId?: string }
  if (!body.customerId?.startsWith('cus_')) {
    return NextResponse.json({ error: 'invalid_customer' }, { status: 400 })
  }
  try {
    const returnUrl = (process.env.NEXT_PUBLIC_HUB_URL ?? 'http://localhost:3000') + '/admin/billing'
    const s = await getStripe().billingPortal.sessions.create({
      customer: body.customerId,
      return_url: returnUrl,
    })
    return NextResponse.json({ url: s.url })
  } catch (err) {
    return NextResponse.json(
      { error: 'portal_failed', message: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    )
  }
}
