/**
 * POST /api/admin/reconcile/companies
 *
 * Admin-only manual trigger for the company reconciliation sweep.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { reconcileCompanies } from '@/lib/reconcile'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest) {
  const session = await getSession()
  if (!session || !hasPermission(session.role, 'sync:manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const result = await reconcileCompanies()
  return NextResponse.json(result)
}
