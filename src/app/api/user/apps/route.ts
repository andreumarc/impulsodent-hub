import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getUser, getUserAppRoles, getCompanyAppAccess } from '@/lib/db'
import { APPS } from '@/lib/apps'

const ALL_APP_IDS = APPS.map((a) => a.id)

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Superadmin has access to everything
  if (session.role === 'superadmin') {
    return NextResponse.json({ appIds: ALL_APP_IDS })
  }

  // Get user app roles + company app access
  const [userRoles, fullUser] = await Promise.all([
    getUserAppRoles(session.id),
    getUser(session.id),
  ])

  const accessible = new Set<string>(userRoles.map((r) => r.app_id))

  if (fullUser?.company_id) {
    const companyApps = await getCompanyAppAccess(fullUser.company_id)
    companyApps.forEach((id) => accessible.add(id))
  }

  return NextResponse.json({ appIds: Array.from(accessible) })
}
