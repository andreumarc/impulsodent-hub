'use client'

import { useState, useMemo } from 'react'
import { X, ChevronDown, AlertTriangle } from 'lucide-react'
import { APPS } from '@/lib/apps'
import { APP_ROLES } from '@/lib/roles'

interface SelectedUser {
  id: string
  name: string
  role: string
  app_roles?: Array<{ app_id: string; role: string }>
}

interface ApplyResult {
  granted: number
  skipped_same_role: number
  conflicts_resolved: number
  skipped_no_company_access: { user_id: string; app_id: string }[]
  skipped_cross_company: string[]
}

interface BulkAddAppsModalProps {
  users: SelectedUser[]
  onClose: () => void
  onApplied: (result: ApplyResult) => void
}

interface Conflict {
  user_id: string
  user_name: string
  app_id: string
  app_name: string
  current_role: string
  new_role: string
}

const PUBLIC_APPS = APPS.filter((a) => !a.internal)
const DEFAULT_BULK_ROLE = APP_ROLES.find((r) => r.value === 'admin')?.value ?? APP_ROLES[0].value

export function BulkAddAppsModal({ users, onClose, onApplied }: BulkAddAppsModalProps) {
  const [selection, setSelection] = useState<Record<string, string>>({}) // app_id -> role
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null)

  function toggle(appId: string, role: string) {
    setSelection((prev) => {
      const next = { ...prev }
      if (!role) delete next[appId]
      else next[appId] = role
      return next
    })
  }

  // Client-side optimistic preview based on data we already loaded for the list
  const preview = useMemo(() => {
    const entries = Object.entries(selection).filter(([, role]) => role)
    let toGrant = 0, sameRole = 0, conflict = 0
    for (const u of users) {
      if (u.role === 'superadmin') { sameRole += entries.length; continue }
      const existing = new Map((u.app_roles ?? []).map((r) => [r.app_id, r.role]))
      for (const [appId, role] of entries) {
        const cur = existing.get(appId)
        if (!cur) toGrant++
        else if (cur === role) sameRole++
        else conflict++
      }
    }
    return { toGrant, sameRole, conflict, hasSelection: entries.length > 0 }
  }, [selection, users])

  async function submit(on_conflict?: 'skip' | 'overwrite') {
    setSubmitting(true); setError('')
    const app_roles = Object.entries(selection)
      .filter(([, role]) => role)
      .map(([app_id, role]) => ({ app_id, role }))
    const body: Record<string, unknown> = {
      user_ids: users.map((u) => u.id),
      app_roles,
    }
    if (on_conflict) body.on_conflict = on_conflict

    try {
      const res = await fetch('/api/admin/users/bulk/apps/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error en la operación')
        return
      }
      if (data.status === 'conflicts_pending') {
        setConflicts(data.conflicts)
        return
      }
      // applied
      onApplied(data as ApplyResult)
      onClose()
    } catch {
      setError('Error de conexión')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Conflict sub-modal ─────────────────────────────────────────────────────
  if (conflicts) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md mx-4 p-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-bold text-gray-900">Conflictos de rol</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {conflicts.length} {conflicts.length === 1 ? 'usuario tiene' : 'usuarios tienen'} acceso con un rol distinto.
              </p>
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50/40 p-3 mb-4 text-xs space-y-1.5">
            {conflicts.map((c) => (
              <div key={`${c.user_id}|${c.app_id}`} className="text-gray-700">
                <span className="font-medium">{c.user_name}</span>
                {' — '}
                <span className="font-medium">{c.app_name}</span>
                {': tiene '}
                <code className="px-1 py-0.5 bg-white rounded text-[11px]">{c.current_role}</code>
                {', le darías '}
                <code className="px-1 py-0.5 bg-white rounded text-[11px]">{c.new_role}</code>
              </div>
            ))}
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200 mb-3">{error}</p>}

          <div className="flex flex-col gap-2">
            <button
              onClick={() => submit('skip')}
              disabled={submitting}
              className="w-full py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              Mantener su rol actual
            </button>
            <button
              onClick={() => submit('overwrite')}
              disabled={submitting}
              className="w-full py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
            >
              Sobrescribir con el rol nuevo
            </button>
            <button
              onClick={() => { setConflicts(null) }}
              disabled={submitting}
              className="w-full py-2 text-gray-500 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Main modal ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">Añadir apps a {users.length} usuario{users.length !== 1 ? 's' : ''}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Selecciona las apps y el rol que tendrán todos los usuarios.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
          {PUBLIC_APPS.map((app) => {
            const role = selection[app.id]
            const enabled = !!role
            return (
              <div
                key={app.id}
                className={`flex items-center gap-3 py-2 px-3 rounded-lg border transition-colors ${enabled ? 'border-brand-200 bg-brand-50/30' : 'border-gray-100'}`}
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => toggle(app.id, e.target.checked ? (role || DEFAULT_BULK_ROLE) : '')}
                  className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400 cursor-pointer"
                />
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                  style={{ background: app.bgColor, color: app.color }}
                >
                  {app.name.slice(0, 2).toUpperCase()}
                </div>
                <span className="flex-1 text-sm font-medium text-gray-800 truncate">{app.name}</span>
                <div className="relative">
                  <select
                    value={role ?? ''}
                    onChange={(e) => toggle(app.id, e.target.value)}
                    disabled={!enabled}
                    className="appearance-none text-sm border border-gray-200 rounded-lg px-3 py-1.5 pr-7 focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white min-w-[140px] disabled:opacity-50"
                  >
                    <option value="">— Sin acceso —</option>
                    {APP_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                </div>
              </div>
            )
          })}
        </div>

        {/* Live preview */}
        {preview.hasSelection && (
          <div className="mt-4 px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-100 text-xs text-gray-600 space-y-0.5">
            <div className="font-semibold text-gray-700 mb-1">Vista previa</div>
            <div>• {preview.toGrant} {preview.toGrant === 1 ? 'asignación nueva' : 'asignaciones nuevas'}</div>
            <div>• {preview.sameRole} {preview.sameRole === 1 ? 'asignación' : 'asignaciones'} ya {preview.sameRole === 1 ? 'existente con el mismo rol (skip)' : 'existentes con el mismo rol (skip)'}</div>
            {preview.conflict > 0 && (
              <div className="text-amber-600">• {preview.conflict} {preview.conflict === 1 ? 'conflicto' : 'conflictos'} de rol (se preguntará)</div>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">{error}</p>}

        <div className="flex gap-2 mt-5">
          <button
            onClick={() => submit()}
            disabled={!preview.hasSelection || submitting}
            className="flex-1 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
          >
            {submitting ? 'Procesando…' : `Añadir apps`}
          </button>
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
