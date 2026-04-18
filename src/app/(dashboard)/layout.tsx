import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import HubShell from '@/components/layout/HubShell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  return <HubShell user={session}>{children}</HubShell>
}
