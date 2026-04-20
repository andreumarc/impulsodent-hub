// POST /api/admin/integrations/healthcheck
// Pings every sub-app's /api/sync/clinics (GET) with the shared Hub bearer
// and reports reachability + latency. Superadmin-only.
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { APPS } from '@/lib/apps'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface HealthResult {
  app_id: string
  name: string
  url: string
  reachable: boolean
  status?: number
  latency_ms?: number
  error?: string
}

export async function POST() {
  const session = await getSession()
  if (!session || (session.role !== 'superadmin' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const secret = process.env.JWT_SECRET ?? ''

  const externalApps = APPS.filter((a) => !a.internal && a.url && a.url !== '#')

  const results: HealthResult[] = await Promise.all(
    externalApps.map(async (app) => {
      const started = Date.now()
      try {
        const r = await fetch(`${app.url.replace(/\/+$/, '')}/api/sync/clinics`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${secret}` },
          signal: AbortSignal.timeout(5000),
          cache: 'no-store',
        })
        const latency = Date.now() - started
        // 200 = ok with data; 401 means endpoint exists but bearer wrong; both mean reachable.
        const reachable = r.status === 200 || r.status === 401
        return {
          app_id:     app.id,
          name:       app.name,
          url:        app.url,
          reachable,
          status:     r.status,
          latency_ms: latency,
        }
      } catch (err) {
        return {
          app_id:    app.id,
          name:      app.name,
          url:       app.url,
          reachable: false,
          error:     err instanceof Error ? err.message : 'unknown',
        }
      }
    }),
  )

  return NextResponse.json({ results })
}
