import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { ProfileTabs } from './_components/ProfileTabs'

export const metadata = { title: 'Mi perfil — ImpulsoDent Hub' }

export default async function ProfilePage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const user = await prisma.hubUser.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      clinic_access_all: true,
      subscription_plan: true,
      created_at: true,
      company: {
        select: { id: true, name: true, slug: true, city: true, email: true, phone: true },
      },
      clinicAccess: {
        select: {
          clinic: {
            select: { id: true, name: true, app_id: true, active: true },
          },
        },
      },
      appRoles: {
        select: { app_id: true, role: true },
      },
    },
  })

  if (!user) redirect('/login')

  return <ProfileTabs user={user} />
}
