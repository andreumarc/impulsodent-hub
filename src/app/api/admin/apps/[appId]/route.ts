import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { updateAppRegistration } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ appId: string }> }) {
  const session = await getSession()
  if (!session || !hasPermission(session.role, 'apps:manage')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { appId } = await params
  const body = await req.json()
  const { sync_url, api_secret, sync_enabled } = body

  try {
    const updated = await updateAppRegistration(appId, { sync_url, api_secret, sync_enabled })
    return NextResponse.json(updated)
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}
