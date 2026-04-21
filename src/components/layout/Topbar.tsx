'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, LogOut, ShieldCheck } from 'lucide-react'
import { BrandLogo } from '@/components/common/BrandLogo'
import type { SessionUser } from '@/lib/auth'

interface TopbarProps {
  user: SessionUser
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Superadministrador',
  admin: 'Administrador',
  director: 'Director/a',
  user: 'Usuario',
}

export default function Topbar({ user }: TopbarProps) {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 sm:px-6 gap-3 flex-shrink-0 z-10">
      {/* Brand wordmark */}
      <Link href="/" className="mr-4 flex-shrink-0">
        <BrandLogo variant="dark" size="md" />
      </Link>

      <div className="flex-1" />

      {/* Admin panel link (superadmin + admin) */}
      {(user.role === 'superadmin' || user.role === 'admin') && (
        <Link
          href="/admin"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Admin
        </Link>
      )}

      {/* Bell */}
      <button className="relative p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
        <Bell className="w-5 h-5" />
        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white" />
      </button>

      {/* Divider */}
      <div className="h-8 w-px bg-gray-200" />

      {/* User — links to profile */}
      <Link href="/admin/profile" className="flex items-center gap-2.5 rounded-lg px-1 py-1 hover:bg-gray-50 transition-colors">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
          style={{ background: '#0d9488' }}
        >
          {user.initials}
        </div>
        <div className="hidden md:block leading-none">
          <p className="text-sm font-semibold text-gray-900">{user.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">{ROLE_LABELS[user.role] ?? user.role}</p>
        </div>
      </Link>

      {/* Divider */}
      <div className="h-8 w-px bg-gray-200" />

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
      >
        <LogOut className="w-4 h-4" />
        <span className="hidden sm:inline font-medium">Salir</span>
      </button>
    </header>
  )
}
