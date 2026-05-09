'use client'

import { useState, useMemo } from 'react'
import { X, Trash2 } from 'lucide-react'
import { APPS } from '@/lib/apps'

interface SelectedUser {
  id: string
  name: string
  role: string
  app_roles?: Array<{ app_id: string; role: string }>
}

interface ApplyResult {
  revoked: number
  skipped_not_assigned: number
  skipped_cross_company: string[]
}

interface BulkRemoveAppsModalProps {
  users: SelectedUser[]
  onClose: () => void
  onApplied: (result: ApplyResult) => void
}

const APP_BY_ID = new Map(APPS.map((a) => [a.id, a]))

export function BulkRemoveAppsModal({ users, onClose, onApplied }: BulkRemoveAppsModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Apps that at least one selected user has assigned (deduped, with usage count)
  const candidates = useMemo(() => {
    const counts = new Map<string, number>()
    for (const u of users) {
      if (u.role === 'superadmin') continue // superadmin has no UserAppRole rows to remove
      for (const r of u.app_roles ?? []) {
        counts.set(r.app_id, (counts.get(r.app_id) ?? 0) + 1)
      }
    }
    return Array.from(counts.entries())
      .map(([appId, count]) => ({ app: APP_BY_ID.get(appId), count, app_id: appId }))
      .filter((c): c is { app: NonNullable<typeof c.app>; count: number; app_id: string } => Boolean(c.app))
      .sort((a, b) => a.app.name.localeCompare(b.app.name))
  }, [users])

  const willRevoke = useMemo(() => {
    let total = 0
    for (const c of candidates) if (selected.has(c.app_id)) total += c.count
    return total
  }, [selected, candidates])

  function toggle(appId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(appId)) next.delete(appId)
      else next.add(appId)
      return next
    })
  }

  async function submit() {
    if (selected.size === 0) return
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/admin/users/bulk/apps/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_ids: users.map((u) => u.id),
          app_ids: Array.from(selected),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error en la operación')
        return
      }
      onApplied(data as ApplyResult)
      onClose()
    } catch {
      setError('Error de conexión')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">Quitar apps a {users.length} usuario{users.length !== 1 ? 's' : ''}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Solo se muestran apps que al menos uno de los usuarios tiene asignadas.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {candidates.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-500">Ningún usuario tiene apps asignadas.</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {candidates.map((c) => (
                <label
                  key={c.app_id}
                  className={`flex items-center gap-3 py-2 px-3 rounded-lg border transition-colors cursor-pointer ${selected.has(c.app_id) ? 'border-red-200 bg-red-50/40' : 'border-gray-100 hover:bg-gray-50/50'}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(c.app_id)}
                    onChange={() => toggle(c.app_id)}
                    className="w-4 h-4 rounded border-gray-300 text-red-500 focus:ring-red-400 cursor-pointer"
                  />
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                    style={{ background: c.app.bgColor, color: c.app.color }}
                  >
                    {c.app.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm font-medium text-gray-800 truncate">{c.app.name}</span>
                  <span className="text-[11px] text-gray-500">
                    {c.count} {c.count === 1 ? 'usuario la tiene' : 'usuarios la tienen'}
                  </span>
                </label>
              ))}
            </div>

            {selected.size > 0 && (
              <div className="mt-4 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                <div className="font-semibold mb-0.5">Vista previa</div>
                <div>• {willRevoke} {willRevoke === 1 ? 'asignación será revocada' : 'asignaciones serán revocadas'}</div>
                <div className="opacity-80">• Esta acción no se puede deshacer</div>
              </div>
            )}

            {error && <p className="mt-3 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">{error}</p>}

            <div className="flex gap-2 mt-5">
              <button
                onClick={submit}
                disabled={selected.size === 0 || submitting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
              >
                <Trash2 className="w-4 h-4" />
                {submitting ? 'Procesando…' : 'Quitar apps'}
              </button>
              <button
                onClick={onClose}
                disabled={submitting}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
