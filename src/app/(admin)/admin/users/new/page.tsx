'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Eye, EyeOff, ChevronDown, Building2, RefreshCw } from 'lucide-react'
import { APPS } from '@/lib/apps'
import { APP_ROLES, HUB_ROLES } from '@/lib/roles'

interface Company { id: string; name: string }
interface HubClinic { id: string; external_id: string; app_id: string; name: string }
type AppRoleMap = Record<string, string>

export default function NewUserPage() {
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [clinics, setClinics] = useState<HubClinic[]>([])
  const [loadingClinics, setLoadingClinics] = useState(false)
  const [clinicAccessAll, setClinicAccessAll] = useState(true)
  const [selectedClinicIds, setSelectedClinicIds] = useState<string[]>([])
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'admin', company_id: '', subscription_plan: 'free', subscription_expires_at: '', max_clinics: 5 })
  const [appRoles, setAppRoles] = useState<AppRoleMap>({})
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/admin/companies').then((r) => r.json()).then(setCompanies).catch(() => null)
  }, [])

  const fetchClinics = useCallback(async (company_id: string, pull = false) => {
    if (!company_id) { setClinics([]); return }
    setLoadingClinics(true)
    try {
      const url = `/api/admin/clinics?company_id=${company_id}${pull ? '&pull=1' : ''}`
      const data = await fetch(url).then((r) => r.json())
      setClinics(Array.isArray(data) ? data : [])
    } finally {
      setLoadingClinics(false)
    }
  }, [])

  useEffect(() => {
    if (form.company_id) fetchClinics(form.company_id)
    else setClinics([])
    setSelectedClinicIds([])
  }, [form.company_id, fetchClinics])

  function setRole(appId: string, role: string) {
    setAppRoles((prev) => ({ ...prev, [appId]: role }))
  }

  function toggleClinic(id: string) {
    setSelectedClinicIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const app_roles = Object.entries(appRoles)
        .filter(([, role]) => role)
        .map(([app_id, role]) => ({ app_id, role }))

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          company_id: form.company_id || null,
          app_roles,
          clinic_access_all: clinicAccessAll,
          clinic_ids: clinicAccessAll ? [] : selectedClinicIds,
          subscription_expires_at: form.subscription_expires_at || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al crear usuario'); return }
      router.push('/admin/users')
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/users" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nuevo usuario</h1>
          <p className="text-sm text-gray-500 mt-0.5">Crea un usuario y asigna su rol en cada aplicación</p>
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
              placeholder="María García López"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Email *</label>
            <input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="maria@clinica.com"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Contraseña *</label>
            <div className="relative">
              <input required type={showPwd ? 'text' : 'password'} value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Mínimo 8 caracteres"
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

        {/* Clinic access */}
        {form.company_id && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">Acceso a clínicas</h2>
                <p className="text-xs text-gray-400 mt-0.5">Selecciona las clínicas a las que tiene acceso este usuario</p>
              </div>
              <button type="button" onClick={() => fetchClinics(form.company_id, true)}
                className="flex items-center gap-1.5 text-xs text-brand-500 hover:text-brand-700 transition-colors">
                <RefreshCw className={`w-3 h-3 ${loadingClinics ? 'animate-spin' : ''}`} />
                Sincronizar
              </button>
            </div>

            {/* All clinics toggle */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
              <button type="button" onClick={() => setClinicAccessAll((v) => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors ${clinicAccessAll ? 'bg-brand-500' : 'bg-gray-200'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${clinicAccessAll ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-sm text-gray-700 font-medium">Todas las clínicas</span>
              {clinicAccessAll && <span className="text-xs text-gray-400">(acceso completo)</span>}
            </div>

            {/* Clinic list */}
            {!clinicAccessAll && (
              <div className="space-y-1.5">
                {loadingClinics && (
                  <p className="text-xs text-gray-400 text-center py-4">Cargando clínicas…</p>
                )}
                {!loadingClinics && clinics.length === 0 && (
                  <div className="text-center py-6 text-gray-400">
                    <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs">No hay clínicas registradas. Pulsa Sincronizar para importarlas.</p>
                  </div>
                )}
                {clinics.map((c) => {
                  const checked = selectedClinicIds.includes(c.id)
                  return (
                    <label key={c.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${checked ? 'border-brand-300 bg-brand-50' : 'border-gray-100 hover:border-gray-200'}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleClinic(c.id)}
                        className="w-4 h-4 rounded text-brand-500 border-gray-300 focus:ring-brand-400" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-800">{c.name}</span>
                        <span className="ml-2 text-[10px] uppercase font-semibold text-gray-400 tracking-wider">{c.app_id}</span>
                      </div>
                    </label>
                  )
                })}
                {!loadingClinics && clinics.length > 0 && (
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => setSelectedClinicIds(clinics.map((c) => c.id))}
                      className="text-xs text-brand-500 hover:underline">Seleccionar todas</button>
                    <span className="text-xs text-gray-300">·</span>
                    <button type="button" onClick={() => setSelectedClinicIds([])}
                      className="text-xs text-gray-400 hover:underline">Deseleccionar</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
                  {/* App icon */}
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                    style={{ background: app.bgColor, color: app.color }}>
                    {app.name.slice(0, 2).toUpperCase()}
                  </div>
                  {/* App name */}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-800">{app.name}</span>
                    <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{app.category}</span>
                  </div>
                  {/* Role badge */}
                  {roleInfo && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                      style={{ color: roleInfo.color, background: roleInfo.bg }}>
                      {roleInfo.label}
                    </span>
                  )}
                  {/* Role select */}
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

        <div className="flex gap-3">
          <button type="submit" disabled={loading}
            className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
            {loading ? 'Creando…' : 'Crear usuario'}
          </button>
          <Link href="/admin/users"
            className="px-5 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
