'use client'

import { ChevronDown } from 'lucide-react'
import { APPS } from '@/lib/apps'
import { APP_ROLES } from '@/lib/roles'

export function AppsSection(props: {
  appRoles: Record<string, string>
  setAppRoles: (fn: (prev: Record<string, string>) => Record<string, string>) => void
}) {
  const { appRoles, setAppRoles } = props

  function setRole(appId: string, role: string) {
    setAppRoles((prev) => {
      const next = { ...prev }
      if (!role) delete next[appId]
      else next[appId] = role
      return next
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-card p-6">
      <h2 className="text-sm font-semibold text-gray-800 mb-1">Acceso a aplicaciones</h2>
      <p className="text-xs text-gray-400 mb-4">Elige el rol del usuario en cada aplicativo. Las clínicas asignadas arriba aplicarán a todos.</p>

      <div className="space-y-2">
        {APPS.filter((a) => !a.internal).map((app) => {
          const role = appRoles[app.id]
          const enabled = !!role
          const roleInfo = role ? APP_ROLES.find((r) => r.value === role) : undefined

          return (
            <div key={app.id}
              className={`flex items-center gap-3 py-2.5 px-3 rounded-lg border transition-colors ${enabled ? 'border-brand-200 bg-brand-50/30' : 'border-gray-100'}`}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                style={{ background: app.bgColor, color: app.color }}>
                {app.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-800">{app.name}</span>
                <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{app.category}</span>
              </div>
              {roleInfo && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                  style={{ color: roleInfo.color, background: roleInfo.bg }}>
                  {roleInfo.label}
                </span>
              )}
              <div className="relative">
                <select value={role ?? ''} onChange={(e) => setRole(app.id, e.target.value)}
                  className="appearance-none text-sm border border-gray-200 rounded-lg px-3 py-1.5 pr-7 focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white min-w-[140px]">
                  <option value="">— Sin acceso —</option>
                  {APP_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
