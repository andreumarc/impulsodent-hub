'use client'

import { useState } from 'react'
import AdminSidebar from './AdminSidebar'

export default function AdminShell({ children, role }: { children: React.ReactNode; role?: string }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} role={role} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
