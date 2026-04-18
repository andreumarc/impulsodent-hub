'use client'

import { useState, useEffect } from 'react'
import { Save, ToggleLeft, ToggleRight } from 'lucide-react'
import { APPS } from '@/lib/apps'

interface AppReg {
  id: string; app_id: string; name: string
  sync_url: string | null; api_secret: string | null
  sync_enabled: boolean; last_sync_at: string | null
}

export default function AppsRegistrationsPage() {
  const [regs, setRegs] = useState<AppReg[]>([])
  const [saving, setSaving] = useState<string | null>(null)
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetch('/api/admin/apps').then((r) => r.json()).then(setRegs).catch(() => null)
  }, [])

  function updateReg(appId: string, field: keyof AppReg, value: unknown) {
    setRegs((prev) => prev.map((r) => r.app_id === appId ? { ...r, [field]: value } : r))
  }

  async function saveReg(appId: string) {
    setSaving(appId)
    const reg = regs.find((r) => r.app_id === appId)
    if (!reg) return
    await fetch(`/api/admin/apps/${appId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sync_url: reg.sync_url, api_secret: reg.api_secret, sync_enabled: reg.sync_enabled }),
    })
    setSaving(null)
    setSuccess(`${reg.name} guardado`)
    setTimeout(() => setSuccess(''), 3000)
  }

  const appDefs = Object.fromEntries(APPS.map((a) => [a.id, a]))

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Registro de aplicaciones</h1>
        <p className="text-sm text-gray-500 mt-1">Configura la URL de sync y el secreto de cada app de la suite</p>
      </div>

      {success && <div className="mb-4 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{success}</div>}

      <div className="space-y-3">
        {regs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-card p-10 text-center text-gray-400 text-sm">
            Cargando registros…
          </div>
        ) : regs.map((reg) => {
          const def = appDefs[reg.app_id]
          return (
            <div key={reg.app_id} className="bg-white rounded-xl border border-gray-100 shadow-card p-5">
              <div className="flex items-center gap-3 mb-4">
                {def && (
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: def.bgColor }}>
                    <div style={{ width: 20, height: 20, background: def.color, borderRadius: 4 }} />
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{reg.name}</p>
                  <p className="text-xs text-gray-400">{reg.app_id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateReg(reg.app_id, 'sync_enabled', !reg.sync_enabled)}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-500"
                >
                  {reg.sync_enabled
                    ? <><ToggleRight className="w-5 h-5 text-green-500" /> <span className="text-green-600">Sync activo</span></>
                    : <><ToggleLeft className="w-5 h-5 text-gray-400" /> <span>Sync inactivo</span></>}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">URL de sync</label>
                  <input
                    value={reg.sync_url ?? ''}
                    onChange={(e) => updateReg(reg.app_id, 'sync_url', e.target.value)}
                    placeholder="https://app.ejemplo.com/api/hub/sync"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">API Secret</label>
                  <input
                    type="password"
                    value={reg.api_secret ?? ''}
                    onChange={(e) => updateReg(reg.app_id, 'api_secret', e.target.value)}
                    placeholder="••••••••••••••••"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  {reg.last_sync_at ? `Último sync: ${new Date(reg.last_sync_at).toLocaleString('es-ES')}` : 'Sin sincronizaciones'}
                </p>
                <button onClick={() => saveReg(reg.app_id)} disabled={saving === reg.app_id}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60">
                  <Save className="w-3.5 h-3.5" />
                  {saving === reg.app_id ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
