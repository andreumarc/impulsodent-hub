import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import AdminShell from '@/components/layout/AdminShell'

export const metadata = { title: 'Admin — ImpulsoDent Hub' }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'superadmin') redirect('/')

  return <AdminShell>{children}</AdminShell>
}
