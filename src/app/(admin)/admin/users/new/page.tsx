'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Eye, EyeOff, ChevronDown, Building2, RefreshCw, Stethoscope } from 'lucide-react'
import { APPS } from '@/lib/apps'
import { APP_ROLES, HUB_ROLES } from '@/lib/roles'

interface Company { id: string; name: string }
interface HubClinic { id: string; external_id: string; app_id: string; name: string }

export default function NewUserPage() {
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [clinics, setClinics] = useState<HubClinic[]>([])
  const [loadingClinics, setLoadingClinics] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'admin', company_id: '', subscription_plan: 'free', subscription_expires_at: '', max_clinics: 5 })
  const [appRoles, setAppRoles] = useState<Record<string, string>>({})
  const [clinicAccessAll, setClinicAccessAll] = useState(true)
  const [selectedExternalIds, setSelectedExternalIds] = useState<string[]>([])
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
    if (!form.company_id) { setClinics([]); return }
    ;(async () => {
      await fetchClinics(form.company_id)
      await fetchClinics(form.company_id, true)
    })()
  }, [form.company_id, fetchClinics])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      // Map selected external_ids → hub clinic ids per app
      const app_roles = Object.entries(appRoles)
        .filter(([, role]) => role)
        .map(([app_id, role]) => {
          const clinicIdsForApp = clinicAccessAll
            ? []
            : clinics
                .filter((c) => c.app_id === app_id && selectedExternalIds.includes(c.external_id))
                .map((c) => c.id)
          return { app_id, role, clinic_access_all: clinicAccessAll, clinic_ids: clinicIdsForApp }
        })

      // Legacy global fields: all hub ids matching any selected external_id
      const globalClinicIds = clinicAccessAll
        ? []
        : clinics.filter((c) => selectedExternalIds.includes(c.external_id)).map((c) => c.id)

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          company_id: form.company_id || null,
          app_roles,
          clinic_access_all: clinicAccessAll,
          clinic_ids: globalClinicIds,
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
          <p className="text-sm text-gray-500 mt-0.5">Crea un usuario, asigna empresa, clínicas y acceso por aplicación</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
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

        <ClinicsSection
          companyId={form.company_id}
          clinics={clinics}
          loadingClinics={loadingClinics}
          onSync={() => fetchClinics(form.company_id, true)}
          accessAll={clinicAccessAll}
          setAccessAll={setClinicAccessAll}
          selectedExternalIds={selectedExternalIds}
          setSelectedExternalIds={setSelectedExternalIds}
        />

        <AppsSection appRoles={appRoles} setAppRoles={setAppRoles} />

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

// ─── Global clinics section ────────────────────────────────────────────────────

export function ClinicsSection(props: {
  companyId: string
  clinics: HubClinic[]
  loadingClinics: boolean
  onSync: () => void
  accessAll: boolean
  setAccessAll: (v: boolean) => void
  selectedExternalIds: string[]
  setSelectedExternalIds: (ids: string[] | ((prev: string[]) => string[])) => void
}) {
  const { companyId, clinics, loadingClinics, onSync, accessAll, setAccessAll, selectedExternalIds, setSelectedExternalIds } = props

  // Deduplicate clinics by external_id (one clinic replicated per app_id)
  const uniqueClinics = useMemo(() => {
    const map = new Map<string, { external_id: string; name: string; apps: string[] }>()
    for (const c of clinics) {
      const existing = map.get(c.external_id)
      if (existing) {
        if (!existing.apps.includes(c.app_id)) existing.apps.push(c.app_id)
      } else {
        map.set(c.external_id, { external_id: c.external_id, name: c.name, apps: [c.app_id] })
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [clinics])

  function toggle(extId: string) {
    setSelectedExternalIds((prev) =>
      prev.includes(extId) ? prev.filter((x) => x !== extId) : [...prev, extId],
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-card p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-gray-800">Clínicas asignadas</h2>
        {companyId && (
          <button type="button" onClick={onSync}
            className="flex items-center gap-1.5 text-xs text-brand-500 hover:text-brand-700 transition-colors">
            <RefreshCw className={`w-3 h-3 ${loadingClinics ? 'animate-spin' : ''}`} />
            Sincronizar clínicas
          </button>
        )}
      </div>
      <p className="text-xs text-gray-400 mb-4">Estas clínicas se aplicarán a todas las aplicaciones a las que tenga acceso el usuario.</p>

      {!companyId && (
        <div className="px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 text-xs">
          Selecciona primero una empresa para ver sus clínicas.
        </div>
      )}

      {companyId && (
        <>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100 mb-3">
            <button type="button" onClick={() => setAccessAll(!accessAll)}
              className={`relative w-10 h-5 rounded-full transition-colors ${accessAll ? 'bg-brand-500' : 'bg-gray-200'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${accessAll ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">Todas las clínicas de la empresa</p>
              <p className="text-[11px] text-gray-400">{accessAll ? 'Acceso completo a toda la empresa' : 'Selecciona manualmente abajo'}</p>
            </div>
          </div>

          {!accessAll && (
            <div className="space-y-1.5">
              {loadingClinics && (
                <p className="text-xs text-gray-400 text-center py-3">Cargando clínicas…</p>
              )}
              {!loadingClinics && uniqueClinics.length === 0 && (
                <div className="text-center py-6 text-gray-400 border border-dashed border-gray-200 rounded-lg">
                  <Building2 className="w-7 h-7 mx-auto mb-1.5 opacity-40" />
                  <p className="text-[11px]">Esta empresa no tiene clínicas. Pulsa «Sincronizar» o créalas en <Link href="/admin/clinicas" className="underline">/admin/clinicas</Link>.</p>
                </div>
              )}
              {uniqueClinics.map((c) => {
                const checked = selectedExternalIds.includes(c.external_id)
                return (
                  <label key={c.external_id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${checked ? 'border-brand-300 bg-brand-50' : 'border-gray-100 hover:border-gray-200'}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggle(c.external_id)}
                      className="w-4 h-4 rounded text-brand-500 border-gray-300 focus:ring-brand-400" />
                    <Stethoscope className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-800 flex-1 min-w-0 truncate">{c.name}</span>
                    <span className="text-[10px] text-gray-400">{c.apps.length} app{c.apps.length === 1 ? '' : 's'}</span>
                  </label>
                )
              })}
              {!loadingClinics && uniqueClinics.length > 0 && (
                <div className="flex gap-2 pt-1">
                  <button type="button"
                    onClick={() => setSelectedExternalIds(uniqueClinics.map((c) => c.external_id))}
                    className="text-[11px] text-brand-500 hover:underline">Seleccionar todas</button>
                  <span className="text-[11px] text-gray-300">·</span>
                  <button type="button"
                    onClick={() => setSelectedExternalIds([])}
                    className="text-[11px] text-gray-400 hover:underline">Deseleccionar</button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Apps section (roles only, no clinics) ─────────────────────────────────────

export function AppsSection(props: {
  appRoles: Record<string, string>
  setAppRoles: (fn: (prev: Record<string, string>) => Record<string, string>) => void
}) {
  const { appRoles, setAppRoles } = props

  function setRole(appId: string, role: string) {
    setAppRoles((prev) => {
      const next = { ...prev }
      if (!role) delete next[appId]
      else next[appId] = role
      return next
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-card p-6">
      <h2 className="text-sm font-semibold text-gray-800 mb-1">Acceso a aplicaciones</h2>
      <p className="text-xs text-gray-400 mb-4">Elige el rol del usuario en cada aplicativo. Las clínicas asignadas arriba aplicarán a todos.</p>

      <div className="space-y-2">
        {APPS.filter((a) => !a.internal).map((app) => {
          const role = appRoles[app.id]
          const enabled = !!role
          const roleInfo = role ? APP_ROLES.find((r) => r.value === role) : undefined

          return (
            <div key={app.id}
              className={`flex items-center gap-3 py-2.5 px-3 rounded-lg border transition-colors ${enabled ? 'border-brand-200 bg-brand-50/30' : 'border-gray-100'}`}>
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
                <select value={role ?? ''} onChange={(e) => setRole(app.id, e.target.value)}
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
  )
}
