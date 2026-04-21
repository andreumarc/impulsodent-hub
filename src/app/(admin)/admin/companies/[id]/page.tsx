'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Save, RefreshCw, User, ToggleLeft, ToggleRight, Building2 } from 'lucide-react'
import { APPS } from '@/lib/apps'

interface Company { id: string; name: string; slug: string; cif: string; city: string; email: string; phone: string; address: string; active: boolean; subscription_plan: string; subscription_expires_at: string | null; max_clinics: number; max_users: number }
interface HubUser { id: string; name: string; email: string; role: string; active: boolean }
interface Clinic { id: string; external_id: string; app_id: string; name: string; company_id: string; active: boolean }

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Superadmin', admin: 'Administrador', direccion: 'Dirección',
  gerencia: 'Gerencia', rrhh: 'RRHH', empleado: 'Empleado',
}

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

  // Clinics state
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [clinicsLoading, setClinicsLoading] = useState(false)
  const [clinicsPulling, setClinicsPulling] = useState(false)
  const [newClinic, setNewClinic] = useState({ name: '' })
  const [addingClinic, setAddingClinic] = useState(false)
  const [showAddClinic, setShowAddClinic] = useState(false)

  async function loadClinics(pull = false) {
    setClinicsLoading(!pull); if (pull) setClinicsPulling(true)
    try {
      const qs = pull ? `?company_id=${id}&pull=1` : `?company_id=${id}`
      const r = await fetch(`/api/admin/clinics${qs}`)
      const d = await r.json()
      if (Array.isArray(d)) setClinics(d)
    } catch { /* non-fatal */ }
    finally { setClinicsLoading(false); setClinicsPulling(false) }
  }

  useEffect(() => {
    fetch(`/api/admin/companies/${id}`)
      .then((r) => r.json())
      .then((d) => { setCompany(d); setForm(d); setAppIds(d.appIds ?? []) })
    fetch(`/api/admin/users?companyId=${id}`)
      .then((r) => r.json())
      .then((d) => Array.isArray(d) ? setUsers(d.filter((u: HubUser) => true)) : null)
      .catch(() => null)
    loadClinics(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function addClinic() {
    if (!newClinic.name.trim()) return
    setAddingClinic(true); setError('')
    try {
      const res = await fetch('/api/admin/clinics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: id, name: newClinic.name.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al crear clínica'); return }
      // After create, refresh the full list — backend fans out to all enabled apps
      await loadClinics(false)
      setNewClinic({ name: '' })
      setShowAddClinic(false)
      setSuccess('Clínica creada y propagada a las apps activas')
      setTimeout(() => setSuccess(''), 2500)
    } finally { setAddingClinic(false) }
  }

  async function removeClinic(clinicId: string) {
    if (!confirm('¿Eliminar esta clínica del Hub? (No se borra en la sub-app)')) return
    const res = await fetch(`/api/admin/clinics/${clinicId}`, { method: 'DELETE' })
    if (res.ok) setClinics((c) => c.filter((x) => x.id !== clinicId))
  }

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
          {([
            { key: 'name',    label: 'Nombre' },
            { key: 'slug',    label: 'Slug' },
            { key: 'cif',     label: 'CIF / NIF' },
            { key: 'city',    label: 'Ciudad' },
            { key: 'email',   label: 'Email' },
            { key: 'phone',   label: 'Teléfono' },
            { key: 'address', label: 'Dirección', full: true },
          ] as { key: keyof Company; label: string; full?: boolean }[]).map(({ key, label, full }) => (
            <div key={key} className={`space-y-1.5 ${full ? 'sm:col-span-2' : ''}`}>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</label>
              <input
                value={(form[key] as string) ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
              />
            </div>
          ))}
        </div>
        {/* Subscription */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Suscripción</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">Plan</label>
              <select value={(form.subscription_plan as string) ?? 'free'}
                onChange={(e) => setForm((f) => ({ ...f, subscription_plan: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent bg-white">
                <option value="free">Free</option>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">Fecha de caducidad</label>
              <input type="date"
                value={form.subscription_expires_at ? String(form.subscription_expires_at).slice(0, 10) : ''}
                onChange={(e) => setForm((f) => ({ ...f, subscription_expires_at: e.target.value || null }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">Máx. clínicas</label>
              <input type="number" min={1}
                value={(form.max_clinics as number) ?? 5}
                onChange={(e) => setForm((f) => ({ ...f, max_clinics: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">Máx. usuarios</label>
              <input type="number" min={1}
                value={(form.max_users as number) ?? 20}
                onChange={(e) => setForm((f) => ({ ...f, max_users: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent" />
            </div>
          </div>
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

      {/* Clinics */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-800">Clínicas ({clinics.length})</h3>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => loadClinics(true)} disabled={clinicsPulling}
              className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60">
              <RefreshCw className={`w-3.5 h-3.5 ${clinicsPulling ? 'animate-spin' : ''}`} />
              {clinicsPulling ? 'Sincronizando…' : 'Pull desde apps'}
            </button>
            <button onClick={() => setShowAddClinic(!showAddClinic)}
              className="flex items-center gap-2 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5" />
              Nueva clínica
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-400 mb-3">
          Las clínicas pertenecen a la empresa. Al crearlas, se propagan automáticamente a todas las aplicaciones activas
          de la empresa. El pull importa las existentes desde cada app.
        </p>

        {showAddClinic && (
          <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Nueva clínica</p>
            {appIds.length === 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Esta empresa no tiene ninguna aplicación habilitada. Actívalas arriba antes de crear clínicas.
              </p>
            )}
            <input value={newClinic.name}
              onChange={(e) => setNewClinic((c) => ({ ...c, name: e.target.value }))}
              placeholder="Nombre de la clínica"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400" />
            <div className="flex gap-2">
              <button onClick={addClinic} disabled={addingClinic || !newClinic.name.trim() || appIds.length === 0}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60">
                {addingClinic ? 'Creando…' : 'Crear clínica'}
              </button>
              <button onClick={() => setShowAddClinic(false)}
                className="px-4 py-2 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {clinicsLoading ? (
          <div className="py-8 text-center text-gray-400 text-sm">Cargando clínicas…</div>
        ) : clinics.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">
            Aún no hay clínicas. Usa <span className="font-medium text-gray-500">Pull desde apps</span> para importarlas o <span className="font-medium text-gray-500">Nueva clínica</span> para crear una.
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(
              clinics.reduce<Record<string, Clinic[]>>((acc, c) => {
                (acc[c.app_id] ??= []).push(c); return acc
              }, {}),
            ).map(([appId, items]) => {
              const app = APPS.find((a) => a.id === appId)
              return (
                <div key={appId} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: app?.bgColor ?? '#f3f4f6' }}>
                      <span style={{ width: 10, height: 10, background: app?.color ?? '#6b7280', borderRadius: 2, display: 'inline-block' }} />
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{app?.name ?? appId}</p>
                    <span className="text-[10px] text-gray-400">{items.length}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-7">
                    {items.map((c) => (
                      <div key={c.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                          <p className="text-[10px] text-gray-400 font-mono truncate">{c.external_id}</p>
                        </div>
                        <button onClick={() => removeClinic(c.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
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
                {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
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
