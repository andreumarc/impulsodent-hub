import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { listCompanies, listAppRegistrations, listCompanyUsers, getCompanyAppAccess, createSyncLog } from '@/lib/db'

async function requireSuperadmin() {
  const session = await getSession()
  if (!session || session.role !== 'superadmin') return null
  return session
}

async function logSync(payload: {
  app_id: string
  company_id: string
  event: string
  status: string
  response_code?: number
  error_message?: string
}) {
  try {
    await createSyncLog(payload)
  } catch { /* ignore log errors */ }
}

export async function POST(req: NextRequest) {
  if (!await requireSuperadmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { companyId, appId } = body as { companyId?: string; appId?: string }

  const apps = await listAppRegistrations()
  const companies = await listCompanies()

  const targetApps = appId ? apps.filter((a) => a.app_id === appId && a.sync_enabled) : apps.filter((a) => a.sync_enabled)
  const targetCompanies = companyId ? companies.filter((c) => c.id === companyId) : companies

  const results: { app_id: string; company: string; status: string; code?: number }[] = []

  for (const company of targetCompanies) {
    const users = await listCompanyUsers(company.id)
    const grantedApps = await getCompanyAppAccess(company.id)

    for (const app of targetApps) {
      if (!grantedApps.includes(app.app_id)) continue
      if (!app.sync_url) {
        results.push({ app_id: app.app_id, company: company.name, status: 'skipped_no_url' })
        continue
      }

      const payload = {
        event: 'company.sync',
        company: { id: company.id, name: company.name, slug: company.slug },
        users: users.map((u) => ({
          id: u.id, email: u.email, name: u.name, role: u.role,
        })),
      }

      try {
        const res = await fetch(app.sync_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(app.api_secret ? { 'X-ImpulsoDent-Secret': app.api_secret } : {}),
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        })
        results.push({ app_id: app.app_id, company: company.name, status: res.ok ? 'success' : 'error', code: res.status })
        await logSync({ app_id: app.app_id, company_id: company.id, event: 'company.sync', status: res.ok ? 'success' : 'failed', response_code: res.status })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'timeout'
        results.push({ app_id: app.app_id, company: company.name, status: 'failed' })
        await logSync({ app_id: app.app_id, company_id: company.id, event: 'company.sync', status: 'failed', error_message: msg })
      }
    }
  }

  return NextResponse.json({ ok: true, results })
}
