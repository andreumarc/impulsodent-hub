'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Bell, X, CheckCheck, Sparkles, MessageCircle,
  RefreshCw, AlertTriangle, Info, Wrench,
} from 'lucide-react'

type NotificationItem = {
  id: string
  app_id: string | null
  kind: string
  title: string
  body: string | null
  link: string | null
  icon: string | null
  read: boolean
  created_at: string
}

const KIND_ICON: Record<string, typeof Bell> = {
  app_update:   Sparkles,
  user_message: MessageCircle,
  data_change:  RefreshCw,
  system:       Wrench,
  warning:      AlertTriangle,
  info:         Info,
}

const KIND_COLOR: Record<string, string> = {
  app_update:   '#7c3aed',
  user_message: '#0d9488',
  data_change:  '#0891b2',
  system:       '#d97706',
  warning:      '#dc2626',
  info:         '#003A70',
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 1)   return 'ahora'
  if (min < 60)  return `${min} min`
  const hr = Math.floor(min / 60)
  if (hr < 24)   return `${hr} h`
  const d = Math.floor(hr / 24)
  if (d < 30)    return `${d} d`
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=20', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { items: NotificationItem[]; unreadCount: number }
      setItems(data.items)
      setUnread(data.unreadCount)
    } catch {
      // network blip — keep current state
    }
  }, [])

  // Initial fetch + 60s polling
  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, 60_000)
    return () => clearInterval(id)
  }, [fetchAll])

  // Re-fetch when popover opens
  useEffect(() => { if (open) fetchAll() }, [open, fetchAll])

  // Click outside to close
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  async function markRead(id: string) {
    setItems((cur) => cur.map((n) => (n.id === id ? { ...n, read: true } : n)))
    setUnread((c) => Math.max(0, c - 1))
    await fetch(`/api/notifications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: true }),
    }).catch(() => undefined)
  }

  async function markAllRead() {
    setLoading(true)
    setItems((cur) => cur.map((n) => ({ ...n, read: true })))
    setUnread(0)
    await fetch('/api/notifications/mark-all-read', { method: 'POST' }).catch(() => undefined)
    setLoading(false)
  }

  async function dismiss(id: string) {
    setItems((cur) => cur.filter((n) => n.id !== id))
    await fetch(`/api/notifications/${id}`, { method: 'DELETE' }).catch(() => undefined)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        className="relative p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full border border-white flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-[380px] max-w-[calc(100vw-32px)] bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Notificaciones</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {unread > 0 ? `${unread} sin leer` : 'Todo al día'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={loading}
                  className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:bg-brand-50 px-2 py-1 rounded transition-colors disabled:opacity-50"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Marcar todas
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No tienes notificaciones</p>
                <p className="text-xs text-gray-400 mt-1">Te avisaremos de novedades, mensajes y actualizaciones</p>
              </div>
            ) : (
              items.map((n) => {
                const Icon = KIND_ICON[n.kind] ?? Info
                const color = KIND_COLOR[n.kind] ?? '#003A70'
                return (
                  <div
                    key={n.id}
                    className={`group flex gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors ${n.read ? '' : 'bg-blue-50/40'}`}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: color + '18' }}
                    >
                      <Icon className="w-4 h-4" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      {n.link ? (
                        <a
                          href={n.link}
                          onClick={() => markRead(n.id)}
                          className="block"
                          target={n.link.startsWith('http') ? '_blank' : undefined}
                          rel={n.link.startsWith('http') ? 'noopener noreferrer' : undefined}
                        >
                          <p className={`text-sm leading-snug ${n.read ? 'text-gray-700' : 'text-gray-900 font-semibold'}`}>{n.title}</p>
                          {n.body && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{n.body}</p>}
                        </a>
                      ) : (
                        <button onClick={() => markRead(n.id)} className="block text-left w-full">
                          <p className={`text-sm leading-snug ${n.read ? 'text-gray-700' : 'text-gray-900 font-semibold'}`}>{n.title}</p>
                          {n.body && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{n.body}</p>}
                        </button>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[11px] text-gray-400">{timeAgo(n.created_at)}</span>
                        {n.app_id && <span className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">{n.app_id}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => dismiss(n.id)}
                      className="opacity-0 group-hover:opacity-100 self-start p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                      aria-label="Descartar"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
