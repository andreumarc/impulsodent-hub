'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Power, KeyRound, ChevronRight, Users, X, Eye, EyeOff } from 'lucide-react'
import { HUB_ROLES, getRoleStyle } from '@/lib/roles'

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-gray-100 text-gray-500',
  starter: 'bg-blue-50 text-blue-600',
  pro: 'bg-purple-50 text-purple-600',
  enterprise: 'bg-amber-50 text-amber-600',
}

interface HubUser {
  id: string; name: string; email: string; role: string; active: boolean
  created_at: string; company: { id: string; name: string; slug: string } | null
  subscription_plan: string; subscription_expires_at: string | null
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function PasswordModal({ user, onClose }: { user: HubUser; onClose: () => void }) {
  const [pwd, setPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSave() {
    if (!pwd) { setError('Introduce una contraseña'); return }
    if (pwd.length < 8) { setError('Mínimo 8 caracteres'); return }
    if (pwd !== confirm) { setError('Las contraseñas no coinciden'); return }
    setError(''); setLoading(true)
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd }),
    })
    setLoading(false)
    if (res.ok) { setSuccess(true); setTimeout(onClose, 1200) }
    else setError('Error al guardar')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">Cambiar contraseña</h3>
            <p className="text-xs text-gray-400 mt-0.5">{user.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="py-4 text-center text-sm font-semibold text-green-600">✓ Contraseña actualizada</div>
        ) : (
          <div className="space-y-3">
            {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">{error}</p>}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Nueva contraseña</label>
              <div className="relative">
                <input type={show ? 'text' : 'password'} value={pwd} onChange={(e) => setPwd(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full px-3 py-2 pr-9 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400" />
                <button type="button" onClick={() => setShow(!show)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                  {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Confirmar contraseña</label>
              <input type={show ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repite la contraseña"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleSave} disabled={loading}
                className="flex-1 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
                {loading ? 'Guardando…' : 'Guardar'}
              </button>
              <button onClick={onClose}
                className="flex-1 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function UsersPage() {
  const [users, setUsers] = useState<HubUser[]>([])
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pwdUser, setPwdUser] = useState<HubUser | null>(null)

  useEffect(() => {
    fetch('/api/admin/users').then((r) => r.json()).then(setUsers).catch(() => null).finally(() => setLoading(false))
  }, [])

  const tabs = useMemo(() => {
    const counts: Record<string, number> = { all: users.length }
    for (const u of users) counts[u.role] = (counts[u.role] ?? 0) + 1
    const roles = HUB_ROLES.filter((r) => counts[r.value])
    return [{ value: 'all', label: 'Todos', count: users.length }, ...roles.map((r) => ({ value: r.value, label: r.label, count: counts[r.value] ?? 0 }))]
  }, [users])

  const filtered = useMemo(() =>
    roleFilter === 'all' ? users : users.filter((u) => u.role === roleFilter),
    [users, roleFilter]
  )

  async function toggleActive(u: HubUser) {
    await fetch(`/api/admin/users/${u.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !u.active }),
    })
    setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, active: !x.active } : x))
  }

  function toggleSelect(id: string) {
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  function toggleAll() {
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((u) => u.id)))
  }

  return (
    <div className="animate-fade-in">
      {pwdUser && <PasswordModal user={pwdUser} onClose={() => setPwdUser(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''} en el sistema</p>
        </div>
        <Link href="/admin/users/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          Nuevo Usuario
        </Link>
      </div>

      {/* Role tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {tabs.map((tab) => (
          <button key={tab.value} onClick={() => setRoleFilter(tab.value)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              roleFilter === tab.value
                ? 'bg-brand-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-300'
            }`}>
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-md font-bold ${
              roleFilter === tab.value ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
            }`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-card p-12 text-center">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">Sin usuarios en este rol</p>
          <Link href="/admin/users/new"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-semibold rounded-lg hover:bg-brand-600 transition-colors">
            <Plus className="w-4 h-4" />
            Crear usuario
          </Link>
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400 cursor-pointer" />
                </th>
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Usuario</th>
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 hidden md:table-cell">Email</th>
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Rol</th>
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">Empresa</th>
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Estado</th>
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 hidden xl:table-cell">Suscripción</th>
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 hidden xl:table-cell">Alta</th>
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((u) => {
                const role = getRoleStyle(u.role, HUB_ROLES)
                return (
                  <tr key={u.id} className={`transition-colors hover:bg-gray-50/60 ${selected.has(u.id) ? 'bg-brand-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleSelect(u.id)}
                        className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400 cursor-pointer" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background: '#0d9488' }}>
                          {getInitials(u.name)}
                        </div>
                        <span className="text-sm font-semibold text-gray-900 truncate">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-gray-500">{u.email}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md"
                        style={{ color: role.color, background: role.bg }}>
                        {role.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {u.company ? (
                        <Link href={`/admin/companies/${u.company.id}`}
                          className="text-sm text-brand-600 hover:underline font-medium">
                          {u.company.name}
                        </Link>
                      ) : <span className="text-sm text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${u.active ? 'text-green-700 bg-green-50' : 'text-gray-500 bg-gray-100'}`}>
                        {u.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${PLAN_COLORS[u.subscription_plan] ?? PLAN_COLORS.free}`}>
                          {u.subscription_plan ?? 'free'}
                        </span>
                        {u.subscription_expires_at && (() => {
                          const exp = new Date(u.subscription_expires_at)
                          const daysLeft = Math.ceil((exp.getTime() - Date.now()) / 86400000)
                          const expired = daysLeft < 0
                          const soon = !expired && daysLeft <= 30
                          return (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${expired ? 'bg-red-50 text-red-600' : soon ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-400'}`}>
                              {expired ? 'Caducado' : `${daysLeft}d`}
                            </span>
                          )
                        })()}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <span className="text-xs text-gray-500">{formatDate(u.created_at)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => setPwdUser(u)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-brand-600 hover:bg-gray-100 rounded-lg transition-colors">
                          <KeyRound className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Contraseña</span>
                        </button>
                        <button onClick={() => toggleActive(u)}
                          className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            u.active ? 'text-orange-500 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'
                          }`}>
                          <Power className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{u.active ? 'Desactivar' : 'Activar'}</span>
                        </button>
                        <Link href={`/admin/users/${u.id}`}
                          className="p-1.5 text-gray-400 hover:text-brand-500 hover:bg-gray-100 rounded-lg transition-colors">
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
