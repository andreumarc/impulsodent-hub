/**
 * POST /api/admin/reconcile/users
 *
 * Admin-only manual trigger for the user reconciliation sweep.
 * Optional body: `{ companySlug?: string }` to scope to one tenant.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { reconcileUsers } from '@/lib/reconcile'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !hasPermission(session.role, 'sync:manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({})) as { companySlug?: string }
  const result = await reconcileUsers({ companySlug: body.companySlug })
  return NextResponse.json(result)
}
