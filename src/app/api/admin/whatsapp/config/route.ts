import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

const LANDING_URL = process.env.LANDING_URL ?? 'https://impulsodent.com'
const TOKEN = process.env.WHATSAPP_ADMIN_TOKEN ?? ''

async function guard() {
  const session = await getSession()
  if (!session || session.role !== 'superadmin') return null
  return session
}

export async function GET(req: NextRequest) {
  if (!(await guard())) return new NextResponse('forbidden', { status: 403 })
  const app = req.nextUrl.searchParams.get('app') ?? 'LANDING'
  const res = await fetch(`${LANDING_URL}/api/whatsapp/admin/config?app=${app}`, {
    headers: { authorization: `Bearer ${TOKEN}` },
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}

export async function PUT(req: NextRequest) {
  if (!(await guard())) return new NextResponse('forbidden', { status: 403 })
  const body = await req.text()
  const res = await fetch(`${LANDING_URL}/api/whatsapp/admin/config`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body,
  })
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
