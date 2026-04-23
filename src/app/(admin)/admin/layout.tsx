import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { canAccessAdmin } from '@/lib/permissions'
import AdminShell from '@/components/layout/AdminShell'

export const metadata = { title: 'Admin — ImpulsoDent Hub' }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  // Anyone with at least one admin-panel permission can enter.
  // Page-level gates restrict each section to its allowed roles (see lib/permissions.ts).
  if (!canAccessAdmin(session.role)) redirect('/')

  return <AdminShell role={session.role}>{children}</AdminShell>
}
