'use client'

import { createContext, useContext } from 'react'
import Topbar from './Topbar'
import type { SessionUser } from '@/lib/auth'

const UserContext = createContext<SessionUser | null>(null)

export function useUser(): SessionUser | null {
  return useContext(UserContext)
}

interface HubShellProps {
  user: SessionUser
  children: React.ReactNode
}

export default function HubShell({ user, children }: HubShellProps) {
  return (
    <UserContext.Provider value={user}>
      <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
        <Topbar user={user} />
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          {children}
        </main>
      </div>
    </UserContext.Provider>
  )
}
