'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Stethoscope, Trash2, RefreshCw, Building2, ChevronDown, X } from 'lucide-react'
import { APPS } from '@/lib/apps'

interface Clinic {
  id: string
  external_id: string
  app_id: string
  name: string
  company_id: string
  active: boolean
  created_at: string
}

interface Company {
  id: string
  name: string
  slug: string
  active: boolean
  appIds: string[]
}

// Hub-internal apps aren't sync targets
const SYNCABLE_APPS = APPS.filter((a) => !a.internal)

// Group clinic rows (one per app) by company + clinic name
interface ClinicGroup {
  key: string
  company_id: string
  name: string
  external_id: string
  apps: { app_id: string; active: boolean; row_id: string }[]
}

function groupClinics(rows: Clinic[]): ClinicGroup[] {
  const map = new Map<string, ClinicGroup>()
  for (const r of rows) {
    const key = `${r.company_id}::${r.external_id}`
    const existing = map.get(key)
    if (existing) {
      existing.apps.push({ app_id: r.app_id, active: r.active, row_id: r.id })
    } else {
      map.set(key, {
        key,
        company_id: r.company_id,
        name: r.name,
        external_id: r.external_id,
        apps: [{ app_id: r.app_id, active: r.active, row_id: r.id }],
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export default function ClinicsPage() {
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState<string>('all')
  const [appFilter, setAppFilter] = useState<string>('all')
  const [pulling, setPulling] = useState(false)

  // Modal state
  const [openNew, setOpenNew] = useState(false)
  const [newCompanyId, setNewCompanyId] = useState('')
  const [newName, setNewName] = useState('')
  const [newAppIds, setNewAppIds] = useState<string[]>([])
  const [newAllApps, setNewAllApps] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function loadClinics() {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/clinics')
      const d = await r.json()
      setClinics(Array.isArray(d) ? d : [])
    } catch { setClinics([]) }
    finally { setLoading(false) }
  }

  async function loadCompanies() {
    try {
      const r = await fetch('/api/admin/companies')
      const d = await r.json()
      setCompanies(Array.isArray(d) ? d : [])
    } catch { setCompanies([]) }
  }

  useEffect(() => { loadClinics(); loadCompanies() }, [])

  const companyById = useMemo(() => {
    const m = new Map<string, Company>()
    for (const c of companies) m.set(c.id, c)
    return m
  }, [companies])

  const selectedCompany = companies.find((c) => c.id === newCompanyId)
  const selectedCompanyApps = selectedCompany
    ? SYNCABLE_APPS.filter((a) => selectedCompany.appIds.includes(a.id))
    : []

  const groups = useMemo(() => groupClinics(clinics), [clinics])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return groups.filter((g) => {
      if (companyFilter !== 'all' && g.company_id !== companyFilter) return false
      if (appFilter !== 'all' && !g.apps.some((a) => a.app_id === appFilter)) return false
      if (q) {
        const company = companyById.get(g.company_id)
        const hay = `${g.name} ${company?.name ?? ''} ${company?.slug ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [groups, search, companyFilter, appFilter, companyById])

  async function handlePull() {
    if (companyFilter === 'all') {
      alert('Selecciona una empresa primero para traer sus clínicas desde los sub-aplicativos.')
      return
    }
    setPulling(true)
    try {
      await fetch(`/api/admin/clinics?company_id=${encodeURIComponent(companyFilter)}&pull=1`)
      await loadClinics()
    } finally { setPulling(false) }
  }

  function openNewModal() {
    setNewCompanyId('')
    setNewName('')
    setNewAppIds([])
    setNewAllApps(true)
    setFormError(null)
    setOpenNew(true)
  }

  function toggleAppSelection(appId: string) {
    setNewAppIds((prev) =>
      prev.includes(appId) ? prev.filter((x) => x !== appId) : [...prev, appId],
    )
  }

  async function handleCreate() {
    setFormError(null)
    if (!newCompanyId) { setFormError('Selecciona una empresa'); return }
    if (!newName.trim()) { setFormError('Introduce un nombre'); return }
    if (!newAllApps && newAppIds.length === 0) {
      setFormError('Selecciona al menos un aplicativo o marca "Todos"')
      return
    }
    setSubmitting(true)
    try {
      const body: { company_id: string; name: string; app_ids?: string[] | 'ALL' } = {
        company_id: newCompanyId,
        name: newName.trim(),
      }
      if (newAllApps) body.app_ids = 'ALL'
      else body.app_ids = newAppIds

      const r = await fetch('/api/admin/clinics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setFormError(d.error || `Error HTTP ${r.status}`)
        return
      }
      setOpenNew(false)
      await loadClinics()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(row_id: string, name: string) {
    if (!confirm(`¿Eliminar la clínica "${name}" de este aplicativo? También se desactivará en el sub-aplicativo.`)) return
    const r = await fetch(`/api/admin/clinics/${row_id}`, { method: 'DELETE' })
    if (r.ok) setClinics((prev) => prev.filter((x) => x.id !== row_id))
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-start gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: '#e6eef7' }}
          >
            <Stethoscope style={{ width: 22, height: 22, color: '#003A70' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Clínicas</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {groups.length} clínica{groups.length !== 1 ? 's' : ''} registrada{groups.length !== 1 ? 's' : ''} · {clinics.length} presencia{clinics.length !== 1 ? 's' : ''} en sub-aplicativos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePull}
            disabled={pulling || companyFilter === 'all'}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 bg-white text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
            title={companyFilter === 'all' ? 'Selecciona una empresa para sincronizar sus clínicas' : 'Traer clínicas desde los sub-aplicativos'}
          >
            <RefreshCw className={`w-4 h-4 ${pulling ? 'animate-spin' : ''}`} />
            {pulling ? 'Sincronizando…' : 'Pull desde apps'}
          </button>
          <button
            onClick={openNewModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva clínica
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre, empresa…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
          />
        </div>
        <div className="relative">
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="appearance-none text-sm border border-gray-200 rounded-lg px-3 py-2 pr-8 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <option value="all">Todas las empresas</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={appFilter}
            onChange={(e) => setAppFilter(e.target.value)}
            className="appearance-none text-sm border border-gray-200 rounded-lg px-3 py-2 pr-8 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <option value="all">Todos los aplicativos</option>
            {SYNCABLE_APPS.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-card p-12 text-center">
          <Stethoscope className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">
            {search || companyFilter !== 'all' || appFilter !== 'all' ? 'Sin resultados' : 'Aún no hay clínicas registradas'}
          </p>
          {!search && companyFilter === 'all' && appFilter === 'all' && (
            <button
              onClick={openNewModal}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-semibold rounded-lg hover:bg-brand-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Crear clínica
            </button>
          )}
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {filtered.map((g) => {
          const company = companyById.get(g.company_id)
          const appsInGroup = SYNCABLE_APPS.filter((a) => g.apps.some((x) => x.app_id === a.id))
          return (
            <div key={g.key} className="bg-white rounded-xl border border-gray-100 shadow-card overflow-hidden">
              <div className="flex items-start gap-4 p-5">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: '#e6eef7' }}
                >
                  <Stethoscope style={{ width: 20, height: 20, color: '#003A70' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-base font-bold text-gray-900">{g.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                      {g.external_id}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{company?.name ?? g.company_id}</span>
                    {company?.slug && (
                      <span className="text-[11px] text-gray-400">· {company.slug}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-50 bg-gray-50/50 px-5 py-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Presencia en aplicativos ({appsInGroup.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5 flex-1">
                    {appsInGroup.map((a) => {
                      const record = g.apps.find((x) => x.app_id === a.id)!
                      return (
                        <span
                          key={a.id}
                          className="group inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md"
                          style={{ background: a.bgColor, color: a.color }}
                        >
                          {a.name}
                          {!record.active && <span className="opacity-60">(inactiva)</span>}
                          <button
                            onClick={() => handleDelete(record.row_id, g.name)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-800"
                            title={`Eliminar de ${a.name}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal: Nueva clínica */}
      {openNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Nueva clínica</h2>
              <button onClick={() => setOpenNew(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Empresa</label>
                <select
                  value={newCompanyId}
                  onChange={(e) => { setNewCompanyId(e.target.value); setNewAppIds([]) }}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
                >
                  <option value="">— Selecciona empresa —</option>
                  {companies.filter((c) => c.active).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nombre de la clínica</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej. Clínica Dental Centro"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-gray-600">Aplicativos a los que dar de alta</label>
                  <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newAllApps}
                      onChange={(e) => setNewAllApps(e.target.checked)}
                      className="rounded border-gray-300 text-brand-500 focus:ring-brand-400"
                    />
                    Todos los habilitados de la empresa
                  </label>
                </div>

                {!newCompanyId ? (
                  <div className="text-xs text-gray-400 italic px-3 py-3 bg-gray-50 rounded-lg">
                    Selecciona una empresa para ver sus aplicativos habilitados.
                  </div>
                ) : selectedCompanyApps.length === 0 ? (
                  <div className="text-xs text-orange-600 px-3 py-3 bg-orange-50 rounded-lg">
                    Esta empresa no tiene aplicativos habilitados. Configúralos desde <em>Empresas → Configurar acceso</em>.
                  </div>
                ) : (
                  <div className={`grid grid-cols-2 gap-2 ${newAllApps ? 'opacity-50 pointer-events-none' : ''}`}>
                    {selectedCompanyApps.map((a) => {
                      const checked = newAppIds.includes(a.id)
                      return (
                        <label
                          key={a.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                            checked ? 'border-brand-400 bg-brand-50/40' : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAppSelection(a.id)}
                            className="rounded border-gray-300 text-brand-500 focus:ring-brand-400"
                          />
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{ background: a.bgColor, color: a.color }}
                          >
                            {a.name.slice(0, 2).toUpperCase()}
                          </span>
                          <span className="text-sm text-gray-700 truncate">{a.name}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              {formError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {formError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50/50">
              <button
                onClick={() => setOpenNew(false)}
                disabled={submitting}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
              >
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {submitting ? 'Creando…' : 'Crear y sincronizar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
