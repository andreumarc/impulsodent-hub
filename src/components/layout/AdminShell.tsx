'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import AdminSidebar from './AdminSidebar'
import { BrandLogo } from '@/components/common/BrandLogo'

/**
 * Responsive admin shell.
 * - `lg+`: sidebar is a static column, no topbar.
 * - `<lg`: sidebar becomes a slide-in drawer toggled from a mobile topbar.
 */
export default function AdminShell({ children, role }: { children: React.ReactNode; role?: string }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  // Close the drawer on any route change — covers sidebar nav links,
  // the "Volver al hub" link and any programmatic navigation.
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Close the drawer with the Escape key.
  useEffect(() => {
    if (!mobileOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <AdminSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        role={role}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <header className="lg:hidden flex items-center gap-3 h-14 px-3 bg-white border-b border-gray-200 flex-shrink-0">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
            aria-expanded={mobileOpen}
            className="p-2 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <BrandLogo variant="dark" size="sm" subtitle="Panel Admin" />
        </header>

        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
