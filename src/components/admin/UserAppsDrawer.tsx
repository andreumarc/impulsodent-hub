'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { X, ExternalLink, LayoutGrid } from 'lucide-react'
import { AppsSection } from '@/components/admin/AppsSection'

interface UserAppsDrawerProps {
  /** When set, drawer is open and shows this user. null = closed. */
  userId: string | null
  /** Header data; pulled from the users list to avoid an extra fetch. */
  userName: string
  userEmail: string
  /** Called when user saves successfully. Receives the new app_roles list so the parent can update its local state optimistically. */
  onSave: (userId: string, appRoles: Array<{ app_id: string; role: string }>) => void
  /** Called when drawer should close (X, ESC, backdrop, switch). */
  onClose: () => void
}

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase() || '?'
}

export function UserAppsDrawer({
  userId, userName, userEmail, onSave, onClose,
}: UserAppsDrawerProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [appRoles, setAppRoles] = useState<Record<string, string>>({})
  const [initialAppRoles, setInitialAppRoles] = useState<Record<string, string>>({})

  const isDirty = JSON.stringify(appRoles) !== JSON.stringify(initialAppRoles)
  const isDirtyRef = useRef(isDirty)
  isDirtyRef.current = isDirty
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load user detail when userId changes
  useEffect(() => {
    if (!userId) {
      setAppRoles({})
      setInitialAppRoles({})
      setError('')
      setSuccess(false)
      return
    }
    const controller = new AbortController()
    setLoading(true); setError(''); setSuccess(false)
    fetch(`/api/admin/users/${userId}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error('load_failed')
        return r.json()
      })
      .then((u: { app_roles?: Array<{ app_id: string; role: string }> }) => {
        const initial: Record<string, string> = {}
        for (const r of u.app_roles ?? []) initial[r.app_id] = r.role
        setAppRoles(initial)
        setInitialAppRoles(initial)
      })
      .catch((err: Error) => { if (err.name !== 'AbortError') setError('Error cargando usuario') })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [userId])

  const requestClose = useCallback(() => {
    if (isDirtyRef.current && !window.confirm('Tienes cambios sin guardar. ¿Descartar?')) return
    onClose()
  }, [onClose])

  // ESC key closes (with dirty check)
  useEffect(() => {
    if (!userId) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [userId, requestClose])

  // Clean up the auto-close timer on unmount
  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
  }, [])

  async function handleSave() {
    if (!userId) return
    setSaving(true); setError('')
    const app_roles = Object.entries(appRoles)
      .filter(([, role]) => role)
      .map(([app_id, role]) => ({ app_id, role }))

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_roles }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Error al guardar')
        return
      }
      const savedSnapshot = Object.fromEntries(app_roles.map(({ app_id, role }) => [app_id, role]))
      setInitialAppRoles(savedSnapshot)
      setSuccess(true)
      onSave(userId, app_roles)
      closeTimerRef.current = setTimeout(() => onClose(), 1200)
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  if (!userId) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={requestClose}
        aria-hidden="true"
      />
      {/* Drawer */}
      <aside
        className="fixed top-0 right-0 z-50 h-full w-full sm:w-[420px] bg-white shadow-xl border-l border-gray-100 flex flex-col"
        role="dialog"
        aria-label={`Apps de ${userName}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ background: '#0d9488' }}
            >
              {getInitials(userName)}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-gray-900 truncate flex items-center gap-1.5">
                <LayoutGrid className="w-4 h-4 text-brand-500" />
                Apps · {userName}
              </h2>
              <p className="text-xs text-gray-400 truncate">{userEmail}</p>
              <Link
                href={`/admin/users/${userId}`}
                className="inline-flex items-center gap-1 mt-1 text-[11px] font-medium text-brand-600 hover:underline"
              >
                Editar usuario completo <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="text-center text-sm text-gray-400 py-10">Cargando…</div>
          ) : (
            <>
              <AppsSection appRoles={appRoles} setAppRoles={setAppRoles} />
              <p className="mt-3 text-[11px] text-gray-400 px-1">
                ⓘ Las clínicas globales se editan desde Editar usuario completo.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 p-4 flex flex-col gap-2">
          {error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
              {error}
            </p>
          )}
          {success ? (
            <div className="py-2 text-center text-sm font-semibold text-green-600">
              ✓ Apps actualizadas
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving || loading || !isDirty}
                className="flex-1 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
              >
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
              <button
                onClick={requestClose}
                className="flex-1 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
