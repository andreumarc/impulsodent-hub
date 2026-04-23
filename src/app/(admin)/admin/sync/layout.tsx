import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'

export default async function SyncLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!hasPermission(session.role, 'sync:manage')) redirect('/admin/clinics')
  return <>{children}</>
}
