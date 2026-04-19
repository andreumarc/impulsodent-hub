'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Eye, EyeOff, ChevronDown, Trash2 } from 'lucide-react'
import { APPS } from '@/lib/apps'
import { APP_ROLES, HUB_ROLES } from '@/lib/roles'

interface Company { id: string; name: string }
type AppRoleMap = Record<string, string>

export default function EditUserPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [companies, setCompanies] = useState<Company[]>([])
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'admin', company_id: '', active: true, subscription_plan: 'free', subscription_expires_at: '', max_clinics: 5 })
  const [appRoles, setAppRoles] = useState<AppRoleMap>({})
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/companies').then((r) => r.json()),
      fetch(`/api/admin/users/${id}`).then((r) => r.json()),
    ]).then(([companies, user]) => {
      if (user.error) { setNotFound(true); return }
      setCompanies(companies)
      setForm({ name: user.name, email: user.email, password: '', role: user.role, company_id: user.company_id ?? '', active: user.active, subscription_plan: user.subscription_plan ?? 'free', subscription_expires_at: user.subscription_expires_at ? String(user.subscription_expires_at).slice(0, 10) : '', max_clinics: user.max_clinics ?? 5 })
      const roleMap: AppRoleMap = {}
      for (const r of user.app_roles ?? []) roleMap[r.app_id] = r.role
      setAppRoles(roleMap)
    }).catch(() => setNotFound(true))
  }, [id])

  function setRole(appId: string, role: string) {
    setAppRoles((prev) => ({ ...prev, [appId]: role }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const app_roles = Object.entries(appRoles)
        .filter(([, role]) => role)
        .map(([app_id, role]) => ({ app_id, role }))

      const body: Record<string, unknown> = {
        name: form.name, email: form.email, role: form.role,
        company_id: form.company_id || null, active: form.active, app_roles,
        subscription_plan: form.subscription_plan,
        subscription_expires_at: form.subscription_expires_at || null,
        max_clinics: form.max_clinics,
      }
      if (form.password) body.password = form.password

      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al guardar'); return }
      router.push('/admin/users')
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar este usuario permanentemente?')) return
    setDeleting(true)
    await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    router.push('/admin/users')
  }

  if (notFound) return (
    <div className="animate-fade-in text-center py-20">
      <p className="text-gray-500 text-sm">Usuario no encontrado</p>
      <Link href="/admin/users" className="mt-3 inline-block text-brand-500 text-sm hover:underline">Volver</Link>
    </div>
  )

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/users" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Editar usuario</h1>
          <p className="text-sm text-gray-500 mt-0.5">{form.email}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic info */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800">Datos del usuario</h2>
          {error && <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Nombre completo *</label>
            <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Email *</label>
            <input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Nueva contraseña <span className="text-gray-400 font-normal">(dejar vacío para no cambiar)</span></label>
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent" />
              <button type="button" onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Rol en el Hub *</label>
              <div className="relative">
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full appearance-none px-3 py-2 pr-8 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white">
                  {HUB_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Empresa</label>
              <div className="relative">
                <select value={form.company_id} onChange={(e) => setForm((f) => ({ ...f, company_id: e.target.value }))}
                  className="w-full appearance-none px-3 py-2 pr-8 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white">
                  <option value="">Sin empresa</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button type="button" onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.active ? 'bg-green-500' : 'bg-gray-200'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm text-gray-700">Usuario {form.active ? 'activo' : 'inactivo'}</span>
          </div>
        </div>

        {/* Subscription */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800">Suscripción</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Plan</label>
              <select value={form.subscription_plan} onChange={(e) => setForm((f) => ({ ...f, subscription_plan: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white">
                <option value="free">Free</option>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Fecha de caducidad</label>
              <input type="date" value={form.subscription_expires_at}
                onChange={(e) => setForm((f) => ({ ...f, subscription_expires_at: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Máx. clínicas</label>
              <input type="number" min={1} value={form.max_clinics}
                onChange={(e) => setForm((f) => ({ ...f, max_clinics: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
          </div>
        </div>

        {/* Per-app roles */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-card p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-1">Roles por aplicación</h2>
          <p className="text-xs text-gray-400 mb-4">Deja en blanco para no dar acceso a esa aplicación</p>

          <div className="space-y-2">
            {APPS.map((app) => {
              const selected = appRoles[app.id] || ''
              const roleInfo = APP_ROLES.find((r) => r.value === selected)
              return (
                <div key={app.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
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
                    <select value={selected} onChange={(e) => setRole(app.id, e.target.value)}
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

        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            <button type="submit" disabled={loading}
              className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
              {loading ? 'Guardando…' : 'Guardar cambios'}
            </button>
            <Link href="/admin/users"
              className="px-5 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
              Cancelar
            </Link>
          </div>
          <button type="button" onClick={handleDelete} disabled={deleting}
            className="flex items-center gap-2 px-4 py-2.5 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-60">
            <Trash2 className="w-4 h-4" />
            {deleting ? 'Eliminando…' : 'Eliminar usuario'}
          </button>
        </div>
      </form>
    </div>
  )
}
