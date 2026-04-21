import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

export default async function SuperadminOnlyLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'superadmin' && session.role !== 'admin') redirect('/admin/clinics')
  return <>{children}</>
}
