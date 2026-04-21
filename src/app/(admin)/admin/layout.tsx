import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import AdminShell from '@/components/layout/AdminShell'

export const metadata = { title: 'Admin — ImpulsoDent Hub' }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  // Both admin and superadmin can enter the admin panel.
  // Page-level gates restrict superadmin-only sections (companies, apps, sync, integrations).
  if (session.role !== 'superadmin' && session.role !== 'admin') redirect('/')

  return <AdminShell role={session.role}>{children}</AdminShell>
}
