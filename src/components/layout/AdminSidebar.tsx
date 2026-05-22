'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Building2, Users, LayoutGrid, RefreshCw, Plug,
  ChevronLeft, ChevronRight, ArrowLeft, Stethoscope, MessageCircle, UserCircle, CreditCard, X,
} from 'lucide-react'
import { BrandLogo } from '@/components/common/BrandLogo'

const SIDEBAR_BG    = '#0b1929'
const ACTIVE_BG     = '#22c55e'
const INACTIVE_TEXT = '#8ba8c0'
const GROUP_LABEL   = '#3d5a75'
const HOVER_BG      = 'rgba(255,255,255,0.07)'
const BORDER_COLOR  = 'rgba(255,255,255,0.08)'
const LOGO_ICON_BG  = '#0d9488'

import { hasPermission, type HubPermission } from '@/lib/permissions'

type NavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  exact?: boolean
  /** Required permission to see this item; omit to show to everyone in admin */
  perm?: HubPermission
  superadminOnly?: boolean
}

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'GESTIÓN',
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      { href: '/admin/companies', label: 'Empresas', icon: Building2, perm: 'companies:manage' },
      { href: '/admin/clinics', label: 'Clínicas', icon: Stethoscope, perm: 'clinics:manage' },
      { href: '/admin/users', label: 'Usuarios', icon: Users, perm: 'users:manage' },
    ],
  },
  {
    title: 'APLICACIONES',
    items: [
      { href: '/admin/apps', label: 'Registros', icon: LayoutGrid, perm: 'apps:manage' },
      { href: '/admin/sync', label: 'Sincronización', icon: RefreshCw, perm: 'sync:manage' },
      { href: '/admin/integrations', label: 'Integraciones', icon: Plug, superadminOnly: true },
      { href: '/admin/whatsapp', label: 'WhatsApp', icon: MessageCircle, superadminOnly: true },
    ],
  },
  {
    title: 'FACTURACIÓN',
    items: [
      { href: '/admin/billing', label: 'Suscripciones', icon: CreditCard, superadminOnly: true },
    ],
  },
]

interface AdminSidebarProps {
  collapsed: boolean
  onToggle: () => void
  role?: string
  /** Whether the mobile drawer is open (ignored at `lg+`). */
  mobileOpen?: boolean
  /** Closes the mobile drawer — called on navigation / backdrop / X. */
  onMobileClose?: () => void
}

/** True when the viewport is at the `lg` breakpoint (1024px) or wider. */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const sync = () => setIsDesktop(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return isDesktop
}

export default function AdminSidebar({ collapsed: collapsedProp, onToggle, role, mobileOpen = false, onMobileClose }: AdminSidebarProps) {
  const isDesktop = useIsDesktop()
  // Collapsed (icon-only) mode is a desktop-only affordance — the mobile
  // drawer always renders full width with labels.
  const collapsed = collapsedProp && isDesktop
  const isSuperadmin = role === 'superadmin'
  const VISIBLE_GROUPS = NAV_GROUPS
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => {
        if (it.superadminOnly) return isSuperadmin
        if (it.perm) return hasPermission(role, it.perm)
        return true
      }),
    }))
    .filter((g) => g.items.length > 0)
  const pathname = usePathname()
  const [hoveredHref, setHoveredHref] = useState<string | null>(null)

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside
      className={`flex flex-col h-screen flex-shrink-0 fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-200 ease-in-out lg:static lg:z-auto lg:h-full lg:translate-x-0 lg:transition-all ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'lg:w-16' : 'lg:w-64'}`}
      style={{ background: SIDEBAR_BG }}
    >
      {/* Logo */}
      <div
        className="flex items-center px-4 py-4 gap-3 flex-shrink-0"
        style={{ borderBottom: `1px solid ${BORDER_COLOR}` }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: LOGO_ICON_BG }}
        >
          <LayoutDashboard style={{ width: 18, height: 18, color: '#fff' }} />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <BrandLogo variant="light" size="sm" subtitle="Panel Admin" />
          </div>
        )}
        {/* Mobile close */}
        <button
          type="button"
          onClick={onMobileClose}
          aria-label="Cerrar menú"
          className="ml-auto lg:hidden p-1.5 rounded-lg transition-colors"
          style={{ color: INACTIVE_TEXT }}
          onMouseEnter={(e) => { e.currentTarget.style.background = HOVER_BG; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = INACTIVE_TEXT }}
        >
          <X style={{ width: 18, height: 18 }} />
        </button>
      </div>

      {/* Back to hub */}
      {!collapsed && (
        <Link
          href="/"
          onClick={onMobileClose}
          className="flex items-center gap-2 mx-2 mt-3 px-3 py-2 rounded-lg text-xs font-medium transition-all"
          style={{ color: INACTIVE_TEXT }}
          onMouseEnter={(e) => { e.currentTarget.style.background = HOVER_BG; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = INACTIVE_TEXT }}
        >
          <ArrowLeft style={{ width: 14, height: 14 }} />
          <span>Volver al hub</span>
        </Link>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-5 overflow-y-auto sidebar-scroll">
        {VISIBLE_GROUPS.map((group) => (
          <div key={group.title}>
            {!collapsed && (
              <p
                className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: GROUP_LABEL }}
              >
                {group.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href, item.exact)
                const hovered = hoveredHref === item.href
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onMobileClose}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150"
                      style={{
                        background: active ? ACTIVE_BG : hovered ? HOVER_BG : 'transparent',
                        color: active ? '#fff' : INACTIVE_TEXT,
                      }}
                      onMouseEnter={() => setHoveredHref(item.href)}
                      onMouseLeave={() => setHoveredHref(null)}
                      title={collapsed ? item.label : undefined}
                    >
                      <item.icon style={{ width: 18, height: 18, color: active ? '#fff' : INACTIVE_TEXT, flexShrink: 0 }} />
                      {!collapsed && <span className="truncate flex-1">{item.label}</span>}
                      {!collapsed && active && (
                        <ChevronRight style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.7)' }} />
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Profile link */}
      <div style={{ borderTop: `1px solid ${BORDER_COLOR}` }}>
        <Link
          href="/admin/profile"
          onClick={onMobileClose}
          className="flex items-center gap-3 mx-2 my-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150"
          style={{
            color: INACTIVE_TEXT,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = HOVER_BG
            e.currentTarget.style.color = '#fff'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = INACTIVE_TEXT
          }}
          title={collapsed ? 'Mi perfil' : undefined}
        >
          <UserCircle style={{ width: 18, height: 18, flexShrink: 0 }} />
          {!collapsed && <span className="truncate flex-1">Mi perfil</span>}
        </Link>
      </div>

      {/* Collapse toggle */}
      <div style={{ borderTop: `1px solid ${BORDER_COLOR}` }}>
        <button
          onClick={onToggle}
          className="hidden lg:flex items-center gap-2 w-full px-4 py-3 text-sm transition-all"
          style={{ color: INACTIVE_TEXT }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#fff' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = INACTIVE_TEXT }}
        >
          {collapsed
            ? <ChevronRight style={{ width: 16, height: 16 }} />
            : <><ChevronLeft style={{ width: 16, height: 16 }} /><span>Colapsar</span></>
          }
        </button>
      </div>
    </aside>
  )
}
