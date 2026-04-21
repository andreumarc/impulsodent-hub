import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

const LANDING_URL = process.env.LANDING_URL ?? 'https://impulsodent.com'
const TOKEN = process.env.WHATSAPP_ADMIN_TOKEN ?? ''

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'superadmin') return new NextResponse('forbidden', { status: 403 })
  const limit = req.nextUrl.searchParams.get('limit') ?? '50'
  const res = await fetch(`${LANDING_URL}/api/whatsapp/admin/conversations?limit=${limit}`, {
    headers: { authorization: `Bearer ${TOKEN}` },
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
