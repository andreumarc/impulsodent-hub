'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Save, RefreshCw, User, ToggleLeft, ToggleRight } from 'lucide-react'
import { APPS } from '@/lib/apps'

interface Company { id: string; name: string; slug: string; email: string; phone: string; address: string; active: boolean }
interface HubUser { id: string; name: string; email: string; role: string; active: boolean }

const ROLE_LABELS: Record<string, string> = { superadmin: 'Superadmin', admin: 'Administrador', user: 'Usuario' }

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [company, setCompany] = useState<Company | null>(null)
  const [form, setForm] = useState<Partial<Company>>({})
  const [users, setUsers] = useState<HubUser[]>([])
  const [appIds, setAppIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [savingApps, setSavingApps] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'admin' })
  const [addingUser, setAddingUser] = useState(false)
  const [showAddUser, setShowAddUser] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/companies/${id}`)
      .then((r) => r.json())
      .then((d) => { setCompany(d); setForm(d); setAppIds(d.appIds ?? []) })
    fetch(`/api/admin/users?companyId=${id}`)
      .then((r) => r.json())
      .then((d) => Array.isArray(d) ? setUsers(d.filter((u: HubUser) => true)) : null)
      .catch(() => null)
  }, [id])

  async function saveCompany() {
    setSaving(true); setError(''); setSuccess('')
    const res = await fetch(`/api/admin/companies/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error); return }
    setCompany(data); setSuccess('Empresa actualizada')
    setTimeout(() => setSuccess(''), 3000)
  }

  async function saveApps() {
    setSavingApps(true); setError('')
    const res = await fetch(`/api/admin/companies/${id}/apps`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appIds }) })
    setSavingApps(false)
    if (!res.ok) { setError('Error al guardar permisos'); return }
    setSuccess('Permisos guardados'); setTimeout(() => setSuccess(''), 3000)
  }

  function toggleApp(appId: string) {
    setAppIds((prev) => prev.includes(appId) ? prev.filter((a) => a !== appId) : [...prev, appId])
  }

  async function addUser() {
    if (!newUser.email || !newUser.password || !newUser.name) return
    setAddingUser(true); setError('')
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newUser, company_id: id }),
    })
    const data = await res.json()
    setAddingUser(false)
    if (!res.ok) { setError(data.error); return }
    setUsers((u) => [...u, data]); setNewUser({ name: '', email: '', password: '', role: 'admin' }); setShowAddUser(false)
  }

  async function removeUser(userId: string) {
    if (!confirm('¿Eliminar este usuario?')) return
    await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
    setUsers((u) => u.filter((x) => x.id !== userId))
  }

  async function syncCompany() {
    setSyncing(true)
    await fetch('/api/admin/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId: id }) })
    setSyncing(false)
    setSuccess('Sincronización enviada'); setTimeout(() => setSuccess(''), 4000)
  }

  async function deleteCompany() {
    if (!confirm(`¿Eliminar la empresa "${company?.name}"? Esta acción no se puede deshacer.`)) return
    await fetch(`/api/admin/companies/${id}`, { method: 'DELETE' })
    router.push('/admin/companies')
  }

  if (!company) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="animate-fade-in max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/companies" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5"><code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{company.slug}</code></p>
          </div>
        </div>
        <button onClick={syncCompany} disabled={syncing}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60">
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          Sincronizar
        </button>
      </div>

      {/* Alerts */}
      {error && <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
      {success && <div className="px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{success}</div>}

      {/* Company form */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-card p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Datos de la empresa</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(['name','slug','email','phone','address'] as const).map((field) => (
            <div key={field} className={`space-y-1.5 ${field === 'address' ? 'sm:col-span-2' : ''}`}>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">{field}</label>
              <input
                value={(form[field] as string) ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
              />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
          <label className="flex items-center gap-2 cursor-pointer">
            <button type="button" onClick={() => setForm((f) => ({ ...f, active: !f.active }))}>
              {form.active
                ? <ToggleRight className="w-6 h-6 text-green-500" />
                : <ToggleLeft className="w-6 h-6 text-gray-400" />}
            </button>
            <span className="text-sm font-medium text-gray-600">Empresa {form.active ? 'activa' : 'inactiva'}</span>
          </label>
          <button onClick={saveCompany} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
            <Save className="w-4 h-4" />
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {/* App permissions */}
      <div id="apps" className="bg-white rounded-xl border border-gray-100 shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-800">Acceso a aplicaciones</h3>
          <button onClick={saveApps} disabled={savingApps}
            className="flex items-center gap-2 px-3 py-1.5 bg-accent-500 hover:bg-accent-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60">
            <Save className="w-3.5 h-3.5" />
            {savingApps ? 'Guardando…' : 'Guardar permisos'}
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {APPS.map((app) => {
            const granted = appIds.includes(app.id)
            return (
              <button key={app.id} onClick={() => toggleApp(app.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                  granted ? 'border-green-400 bg-green-50' : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                }`}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: app.bgColor }}>
                  <span style={{ fontSize: 16 }}>
                    {granted
                      ? <span className="text-green-600 text-sm font-bold">✓</span>
                      : <span style={{ width: 16, height: 16, background: app.color, borderRadius: 4, display: 'inline-block' }} />}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-semibold truncate ${granted ? 'text-green-700' : 'text-gray-600'}`}>{app.name}</p>
                  <p className="text-[10px] text-gray-400">{app.category}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Users */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-800">Usuarios ({users.length})</h3>
          <button onClick={() => setShowAddUser(!showAddUser)}
            className="flex items-center gap-2 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg transition-colors">
            <Plus className="w-3.5 h-3.5" />
            Añadir usuario
          </button>
        </div>

        {/* Add user form */}
        {showAddUser && (
          <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Nuevo usuario</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input value={newUser.name} onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))}
                placeholder="Nombre completo" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400" />
              <input type="email" value={newUser.email} onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
                placeholder="email@ejemplo.com" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400" />
              <input type="password" value={newUser.password} onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
                placeholder="Contraseña" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400" />
              <select value={newUser.role} onChange={(e) => setNewUser((u) => ({ ...u, role: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white">
                <option value="admin">Administrador</option>
                <option value="user">Usuario</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={addUser} disabled={addingUser}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60">
                {addingUser ? 'Creando…' : 'Crear usuario'}
              </button>
              <button onClick={() => setShowAddUser(false)}
                className="px-4 py-2 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {users.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">No hay usuarios en esta empresa</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs text-gray-400 font-semibold pb-2">Usuario</th>
                <th className="text-left text-xs text-gray-400 font-semibold pb-2 hidden sm:table-cell">Email</th>
                <th className="text-left text-xs text-gray-400 font-semibold pb-2">Rol</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: '#0d9488' }}>
                        {u.name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-800">{u.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 hidden sm:table-cell">
                    <span className="text-sm text-gray-500">{u.email}</span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md text-blue-700 bg-blue-50">
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <button onClick={() => removeUser(u.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Danger zone */}
      <div className="bg-white rounded-xl border border-red-100 shadow-card p-5">
        <h3 className="text-sm font-semibold text-red-700 mb-3">Zona de peligro</h3>
        <p className="text-xs text-gray-500 mb-3">Eliminar la empresa borrará todos sus usuarios y permisos. Esta acción no se puede deshacer.</p>
        <button onClick={deleteCompany}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors">
          Eliminar empresa
        </button>
      </div>
    </div>
  )
}
