'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, RefreshCw, Building2, ChevronDown, X, Stethoscope, Pencil, Save, LayoutGrid, Check, Minus } from 'lucide-react'
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

const SYNCABLE_APPS = APPS.filter((a) => !a.internal)

interface AppEntry {
  app_id: string
  active: boolean
  /** Every Hub row that maps this app to this physical clinic. Usually 1, can
   *  be >1 when legacy onboardings created the same (company, name, app) under
   *  different external_ids. All of them are deleted when the app is toggled off. */
  row_ids: string[]
}

interface ClinicGroup {
  key: string
  company_id: string
  name: string
  /** All sibling external_ids for this physical clinic (deduped by lowercase name). */
  external_ids: string[]
  /** Canonical external_id for new operations (alphabetically smallest sibling). */
  external_id: string
  /** Total number of underlying Hub rows in this group (sum of row_ids across apps). */
  raw_row_count: number
  apps: AppEntry[]
}

function normalizeName(name: string) {
  return name.trim().toLowerCase()
}

function groupClinics(rows: Clinic[]): ClinicGroup[] {
  // Group by (company_id, normalized name) — collapses legacy duplicate
  // external_ids that all represent the same physical clinic.
  const map = new Map<string, {
    name: string
    company_id: string
    external_ids: Set<string>
    /** app_id → AppEntry */
    apps: Map<string, AppEntry>
    raw_row_count: number
  }>()

  for (const r of rows) {
    const key = `${r.company_id}::${normalizeName(r.name)}`
    let g = map.get(key)
    if (!g) {
      g = {
        name: r.name,
        company_id: r.company_id,
        external_ids: new Set(),
        apps: new Map(),
        raw_row_count: 0,
      }
      map.set(key, g)
    }
    g.external_ids.add(r.external_id)
    g.raw_row_count++
    const existing = g.apps.get(r.app_id)
    if (existing) {
      existing.row_ids.push(r.id)
      // If any sibling row is active, surface as active
      if (r.active) existing.active = true
    } else {
      g.apps.set(r.app_id, { app_id: r.app_id, active: r.active, row_ids: [r.id] })
    }
  }

  return Array.from(map.entries())
    .map(([key, g]) => {
      const sortedExternalIds = Array.from(g.external_ids).sort()
      return {
        key,
        company_id: g.company_id,
        name: g.name,
        external_ids: sortedExternalIds,
        external_id: sortedExternalIds[0],
        raw_row_count: g.raw_row_count,
        apps: Array.from(g.apps.values()),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export default function ClinicsPage() {
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [companyFilter, setCompanyFilter] = useState<string>('all')
  const [appFilter, setAppFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  // Modal state (Nueva)
  const [openNew, setOpenNew] = useState(false)
  const [newCompanyId, setNewCompanyId] = useState('')
  const [newName, setNewName] = useState('')
  const [newAppIds, setNewAppIds] = useState<string[]>([])
  const [newAllApps, setNewAllApps] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Modal state (Editar)
  const [editGroup, setEditGroup] = useState<ClinicGroup | null>(null)
  const [editName, setEditName] = useState('')
  const [editActive, setEditActive] = useState(true)
  const [editAppIds, setEditAppIds] = useState<string[]>([])
  const [editError, setEditError] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  // Inline single-app toggles (per clinic+app)
  const [togglingCells, setTogglingCells] = useState<Set<string>>(new Set())

  // Bulk apply modal state
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkAppIds, setBulkAppIds] = useState<Set<string>>(new Set())
  const [bulkRemovedIds, setBulkRemovedIds] = useState<Set<string>>(new Set())
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [bulkScope, setBulkScope] = useState<'selected' | 'visible'>('selected')

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

  // Tabs: status (all / active / inactive)
  const tabs = useMemo(() => {
    const active   = groups.filter((g) => g.apps.every((a) => a.active)).length
    const inactive = groups.filter((g) => !g.apps.every((a) => a.active)).length
    return [
      { value: 'all',      label: 'Todas',    count: groups.length },
      { value: 'active',   label: 'Activas',  count: active },
      { value: 'inactive', label: 'Inactivas', count: inactive },
    ]
  }, [groups])

  const filtered = useMemo(() => {
    return groups.filter((g) => {
      if (companyFilter !== 'all' && g.company_id !== companyFilter) return false
      if (appFilter    !== 'all' && !g.apps.some((a) => a.app_id === appFilter)) return false
      if (statusFilter === 'active'   && !g.apps.every((a) => a.active)) return false
      if (statusFilter === 'inactive' &&  g.apps.every((a) => a.active)) return false
      return true
    })
  }, [groups, companyFilter, appFilter, statusFilter])

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
      setFormError('Selecciona al menos un aplicativo o marca "Todos"'); return
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
    } finally { setSubmitting(false) }
  }

  function openEditModal(g: ClinicGroup) {
    setEditGroup(g)
    setEditName(g.name)
    setEditActive(g.apps.every((a) => a.active))
    setEditAppIds(g.apps.map((a) => a.app_id))
    setEditError(null)
  }

  function toggleEditApp(appId: string) {
    setEditAppIds((prev) =>
      prev.includes(appId) ? prev.filter((x) => x !== appId) : [...prev, appId],
    )
  }

  async function handleSaveEdit() {
    if (!editGroup) return
    setEditError(null)
    const trimmed = editName.trim()
    if (!trimmed) { setEditError('El nombre no puede estar vacío'); return }
    if (editAppIds.length === 0) { setEditError('Selecciona al menos un aplicativo'); return }

    setEditSaving(true)
    try {
      const currentApps = editGroup.apps.map((a) => a.app_id)
      const toAdd    = editAppIds.filter((a) => !currentApps.includes(a))
      const toRemove = editGroup.apps.filter((a) => !editAppIds.includes(a.app_id))

      // 1) PATCH every sibling row of every kept app with new name + active
      const keptRows = editGroup.apps.filter((a) => editAppIds.includes(a.app_id))
      const patchRowIds = keptRows.flatMap((a) => a.row_ids)
      await Promise.all(patchRowIds.map((id) =>
        fetch(`/api/admin/clinics/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed, active: editActive }),
        }),
      ))

      // 2) DELETE every sibling row of removed apps (single-row deletes)
      const removeRowIds = toRemove.flatMap((a) => a.row_ids)
      await Promise.all(removeRowIds.map((id) =>
        fetch(`/api/admin/clinics/${id}?only=1`, { method: 'DELETE' }),
      ))

      // 3) POST to add new apps (reusing external_id)
      if (toAdd.length > 0) {
        await fetch('/api/admin/clinics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company_id: editGroup.company_id,
            name: trimmed,
            external_id: editGroup.external_id,
            app_ids: toAdd,
          }),
        })
      }

      setEditGroup(null)
      await loadClinics()
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDeleteGroup(g: ClinicGroup) {
    if (!confirm(`¿Eliminar "${g.name}" de todos los aplicativos?`)) return
    const rowIds = g.apps.flatMap((a) => a.row_ids)
    await Promise.all(rowIds.map((id) => fetch(`/api/admin/clinics/${id}`, { method: 'DELETE' })))
    const deleted = new Set(rowIds)
    setClinics((prev) => prev.filter((x) => !deleted.has(x.id)))
    setSelected((prev) => { const s = new Set(prev); s.delete(g.key); return s })
  }

  async function handleBulkDelete() {
    const toDelete = filtered.filter((g) => selected.has(g.key))
    if (!confirm(`¿Eliminar ${toDelete.length} clínica${toDelete.length !== 1 ? 's' : ''} de todos los aplicativos?`)) return
    setDeleting(true)
    try {
      const allRowIds = toDelete.flatMap((g) => g.apps.flatMap((a) => a.row_ids))
      await Promise.all(allRowIds.map((id) => fetch(`/api/admin/clinics/${id}`, { method: 'DELETE' })))
      const deletedRowIds = new Set(allRowIds)
      const deletedKeys   = new Set(toDelete.map((g) => g.key))
      setClinics((prev) => prev.filter((x) => !deletedRowIds.has(x.id)))
      setSelected((prev) => { const s = new Set(prev); for (const k of deletedKeys) s.delete(k); return s })
    } finally { setDeleting(false) }
  }

  function toggleSelect(key: string) {
    setSelected((prev) => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s })
  }

  function toggleAll() {
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((g) => g.key)))
  }

  // Inline toggle: add or remove a single app from a single clinic.
  // Optimistic update + reload on completion.
  async function toggleAppInline(g: ClinicGroup, appId: string) {
    const cellKey = `${g.key}::${appId}`
    if (togglingCells.has(cellKey)) return
    const company = companyById.get(g.company_id)
    if (!company || !company.appIds.includes(appId)) return

    setTogglingCells((prev) => { const s = new Set(prev); s.add(cellKey); return s })
    const existing = g.apps.find((a) => a.app_id === appId)
    try {
      if (existing) {
        // Remove this app from this physical clinic — delete every sibling row
        // (legacy duplicates may have stored the same app under multiple external_ids)
        await Promise.all(existing.row_ids.map((id) =>
          fetch(`/api/admin/clinics/${id}?only=1`, { method: 'DELETE' }),
        ))
      } else {
        // Add this app to this clinic, reusing external_id
        await fetch('/api/admin/clinics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company_id: g.company_id,
            name: g.name,
            external_id: g.external_id,
            app_ids: [appId],
          }),
        })
      }
      await loadClinics()
    } finally {
      setTogglingCells((prev) => { const s = new Set(prev); s.delete(cellKey); return s })
    }
  }

  // Resolve which clinic groups the bulk modal targets.
  function getBulkTargets() {
    return bulkScope === 'visible'
      ? filtered
      : filtered.filter((g) => selected.has(g.key))
  }

  // Compute pre-selected state for bulk modal: apps assigned to ALL target clinics.
  function openBulkModal(scope: 'selected' | 'visible') {
    const targets = scope === 'visible'
      ? filtered
      : filtered.filter((g) => selected.has(g.key))
    if (targets.length === 0) return
    const counts = new Map<string, number>()
    for (const g of targets) {
      for (const a of g.apps) counts.set(a.app_id, (counts.get(a.app_id) ?? 0) + 1)
    }
    const allTargetsHave = new Set<string>()
    for (const [appId, n] of counts) {
      if (n === targets.length) allTargetsHave.add(appId)
    }
    setBulkScope(scope)
    setBulkAppIds(allTargetsHave)
    setBulkRemovedIds(new Set())
    setBulkError(null)
    setBulkOpen(true)
  }

  function bulkToggleApp(appId: string, currentlyChecked: boolean) {
    setBulkAppIds((prev) => {
      const s = new Set(prev)
      if (currentlyChecked) s.delete(appId)
      else s.add(appId)
      return s
    })
    // Track explicit removals (so partial-state apps that user un-checks are also removed)
    setBulkRemovedIds((prev) => {
      const s = new Set(prev)
      if (currentlyChecked) s.add(appId)
      else s.delete(appId)
      return s
    })
  }

  async function applyBulk() {
    setBulkError(null)
    const targets = getBulkTargets()
    if (targets.length === 0) { setBulkOpen(false); return }
    setBulkSaving(true)
    try {
      const requests: Promise<unknown>[] = []
      for (const g of targets) {
        const company = companyById.get(g.company_id)
        if (!company) continue
        const enabledForCompany = new Set(company.appIds)
        const currentApps = new Set(g.apps.map((a) => a.app_id))

        // Apps to add: in bulkAppIds, enabled for company, not already on clinic
        for (const appId of bulkAppIds) {
          if (!enabledForCompany.has(appId)) continue
          if (currentApps.has(appId)) continue
          requests.push(fetch('/api/admin/clinics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              company_id: g.company_id,
              name: g.name,
              external_id: g.external_id,
              app_ids: [appId],
            }),
          }))
        }

        // Apps to remove: explicitly un-checked AND currently on clinic.
        // Delete every sibling row for that app_id (legacy duplicates).
        for (const appId of bulkRemovedIds) {
          if (!currentApps.has(appId)) continue
          if (bulkAppIds.has(appId)) continue
          const entry = g.apps.find((a) => a.app_id === appId)
          if (!entry) continue
          for (const id of entry.row_ids) {
            requests.push(fetch(`/api/admin/clinics/${id}?only=1`, { method: 'DELETE' }))
          }
        }
      }
      await Promise.allSettled(requests)
      await loadClinics()
      setBulkOpen(false)
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setBulkSaving(false)
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Header — identical structure to Empresas / Usuarios */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Clínicas</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {groups.length} clínica{groups.length !== 1 ? 's' : ''} registrada{groups.length !== 1 ? 's' : ''} en el sistema
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openNewModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva clínica
          </button>
        </div>
      </div>

      {/* Tabs row — identical to Empresas / Usuarios */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        {tabs.map((tab) => (
          <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              statusFilter === tab.value
                ? 'bg-brand-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-300'
            }`}>
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-md font-bold ${
              statusFilter === tab.value ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
            }`}>{tab.count}</span>
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          {filtered.length > 0 && selected.size === 0 && (
            <button
              onClick={() => openBulkModal('visible')}
              title={
                companyFilter !== 'all' || appFilter !== 'all' || statusFilter !== 'all'
                  ? `Aplicar a las ${filtered.length} clínicas filtradas`
                  : `Aplicar a las ${filtered.length} clínicas visibles (sin filtros)`
              }
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-brand-500 hover:bg-brand-600 text-white transition-colors"
            >
              <LayoutGrid className="w-4 h-4" />
              Aplicar apps a todas ({filtered.length})
            </button>
          )}
          {selected.size > 0 && (
            <>
              <button
                onClick={() => openBulkModal('selected')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100 transition-colors"
              >
                <LayoutGrid className="w-4 h-4" />
                Asignar apps ({selected.size})
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-60"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Eliminando…' : `Eliminar (${selected.size})`}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Secondary filters (empresa + app) — compact row under tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="relative">
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="appearance-none text-sm border border-gray-200 rounded-lg px-3 py-2 pr-8 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400 text-gray-600"
          >
            <option value="all">Todas las empresas</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={appFilter}
            onChange={(e) => setAppFilter(e.target.value)}
            className="appearance-none text-sm border border-gray-200 rounded-lg px-3 py-2 pr-8 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400 text-gray-600"
          >
            <option value="all">Todos los aplicativos</option>
            {SYNCABLE_APPS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-card p-12 text-center">
          <Stethoscope className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">
            {companyFilter !== 'all' || appFilter !== 'all' || statusFilter !== 'all'
              ? 'Sin resultados para los filtros aplicados'
              : 'Aún no hay clínicas registradas'}
          </p>
          {companyFilter === 'all' && appFilter === 'all' && statusFilter === 'all' && (
            <button onClick={openNewModal}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-semibold rounded-lg hover:bg-brand-600 transition-colors">
              <Plus className="w-4 h-4" />
              Crear clínica
            </button>
          )}
        </div>
      )}

      {/* Table — same structure as Empresas / Usuarios */}
      {filtered.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="px-4 py-3 w-10">
                  <input type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400 cursor-pointer" />
                </th>
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Clínica</th>
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 hidden md:table-cell">Empresa</th>
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Aplicativos</th>
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Estado</th>
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((g) => {
                const company   = companyById.get(g.company_id)
                const companyApps = company
                  ? SYNCABLE_APPS.filter((a) => company.appIds.includes(a.id))
                  : SYNCABLE_APPS.filter((a) => g.apps.some((x) => x.app_id === a.id))
                const allActive = g.apps.length > 0 && g.apps.every((a) => a.active)
                return (
                  <tr key={g.key} className={`transition-colors hover:bg-gray-50/60 ${selected.has(g.key) ? 'bg-brand-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(g.key)} onChange={() => toggleSelect(g.key)}
                        className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400 cursor-pointer" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: '#e6eef7' }}>
                          <Stethoscope style={{ width: 16, height: 16, color: '#003A70' }} />
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-semibold text-gray-900 block truncate">{g.name}</span>
                          <span className="text-[11px] text-gray-400 font-mono flex items-center gap-1.5">
                            <span className="truncate">{g.external_id}</span>
                            {g.external_ids.length > 1 && (
                              <span
                                className="inline-flex items-center text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 flex-shrink-0"
                                title={`Esta clínica está duplicada en Hub bajo ${g.external_ids.length} external_ids: ${g.external_ids.join(', ')}. Las operaciones se aplican a todas.`}
                              >
                                +{g.external_ids.length - 1}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                        <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{company?.name ?? g.company_id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {companyApps.length === 0 ? (
                        <span className="text-xs text-gray-300 italic">Empresa sin apps</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {companyApps.map((a) => {
                            const record = g.apps.find((x) => x.app_id === a.id)
                            const assigned = Boolean(record)
                            const cellKey = `${g.key}::${a.id}`
                            const busy = togglingCells.has(cellKey)
                            return (
                              <button
                                key={a.id}
                                onClick={() => toggleAppInline(g, a.id)}
                                disabled={busy}
                                title={assigned ? `Quitar ${a.name}` : `Añadir ${a.name}`}
                                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md border transition-all disabled:opacity-50 ${
                                  assigned
                                    ? 'shadow-sm hover:shadow hover:scale-105'
                                    : 'border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600 bg-white'
                                }`}
                                style={assigned ? { background: a.bgColor, color: a.color, borderColor: 'transparent' } : undefined}
                              >
                                {busy ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : (
                                  assigned
                                    ? <Check className="w-2.5 h-2.5" />
                                    : <Plus className="w-2.5 h-2.5" />
                                )}
                                {a.name.slice(0, 3).toUpperCase()}
                                {assigned && record && !record.active && <span className="opacity-60 text-[9px]">off</span>}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        allActive ? 'text-green-700 bg-green-50' : 'text-orange-600 bg-orange-50'
                      }`}>
                        {allActive ? 'Activa' : 'Parcial'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEditModal(g)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Editar</span>
                        </button>
                        <button onClick={() => handleDeleteGroup(g)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Eliminar</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

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
                <select value={newCompanyId}
                  onChange={(e) => { setNewCompanyId(e.target.value); setNewAppIds([]) }}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400">
                  <option value="">— Selecciona empresa —</option>
                  {companies.filter((c) => c.active).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nombre de la clínica</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej. Clínica Dental Centro"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-gray-600">Aplicativos</label>
                  <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={newAllApps}
                      onChange={(e) => setNewAllApps(e.target.checked)}
                      className="rounded border-gray-300 text-brand-500 focus:ring-brand-400" />
                    Todos los habilitados
                  </label>
                </div>
                {!newCompanyId ? (
                  <div className="text-xs text-gray-400 italic px-3 py-3 bg-gray-50 rounded-lg">
                    Selecciona una empresa para ver sus aplicativos.
                  </div>
                ) : selectedCompanyApps.length === 0 ? (
                  <div className="text-xs text-orange-600 px-3 py-3 bg-orange-50 rounded-lg">
                    Esta empresa no tiene aplicativos habilitados.
                  </div>
                ) : (
                  <div className={`grid grid-cols-2 gap-2 ${newAllApps ? 'opacity-50 pointer-events-none' : ''}`}>
                    {selectedCompanyApps.map((a) => {
                      const checked = newAppIds.includes(a.id)
                      return (
                        <label key={a.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                            checked ? 'border-brand-400 bg-brand-50/40' : 'border-gray-200 hover:bg-gray-50'
                          }`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleAppSelection(a.id)}
                            className="rounded border-gray-300 text-brand-500 focus:ring-brand-400" />
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{ background: a.bgColor, color: a.color }}>
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
                <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{formError}</div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50/50">
              <button onClick={() => setOpenNew(false)} disabled={submitting}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-60">
                Cancelar
              </button>
              <button onClick={handleCreate} disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {submitting ? 'Creando…' : 'Crear y sincronizar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar clínica */}
      {editGroup && (() => {
        const editCompany = companyById.get(editGroup.company_id)
        const availableApps = editCompany
          ? SYNCABLE_APPS.filter((a) => editCompany.appIds.includes(a.id))
          : SYNCABLE_APPS.filter((a) => editGroup.apps.some((x) => x.app_id === a.id))
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Editar clínica</h2>
                  <p className="text-[11px] text-gray-400 mt-0.5 font-mono">{editGroup.external_id}</p>
                </div>
                <button onClick={() => setEditGroup(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Empresa</label>
                  <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    <Building2 className="w-3.5 h-3.5 text-gray-400" />
                    {editCompany?.name ?? editGroup.company_id}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nombre de la clínica</label>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)}
                      className="rounded border-gray-300 text-brand-500 focus:ring-brand-400" />
                    <span className="text-sm text-gray-700">Activa</span>
                    <span className="text-[11px] text-gray-400 ml-1">
                      (desactivar sincroniza como inactiva en todos los sub-aplicativos)
                    </span>
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2">Aplicativos asignados</label>
                  {availableApps.length === 0 ? (
                    <div className="text-xs text-orange-600 px-3 py-3 bg-orange-50 rounded-lg">
                      No hay aplicativos disponibles para esta empresa.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {availableApps.map((a) => {
                        const checked = editAppIds.includes(a.id)
                        const wasAssigned = editGroup.apps.some((x) => x.app_id === a.id)
                        return (
                          <label key={a.id}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                              checked ? 'border-brand-400 bg-brand-50/40' : 'border-gray-200 hover:bg-gray-50'
                            }`}>
                            <input type="checkbox" checked={checked} onChange={() => toggleEditApp(a.id)}
                              className="rounded border-gray-300 text-brand-500 focus:ring-brand-400" />
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                              style={{ background: a.bgColor, color: a.color }}>
                              {a.name.slice(0, 2).toUpperCase()}
                            </span>
                            <span className="text-sm text-gray-700 truncate flex-1">{a.name}</span>
                            {wasAssigned && !checked && (
                              <span className="text-[9px] font-bold text-red-500 uppercase">quitar</span>
                            )}
                            {!wasAssigned && checked && (
                              <span className="text-[9px] font-bold text-green-600 uppercase">añadir</span>
                            )}
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
                {editError && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{editError}</div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50/50">
                <button onClick={() => setEditGroup(null)} disabled={editSaving}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-60">
                  Cancelar
                </button>
                <button onClick={handleSaveEdit} disabled={editSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
                  {editSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editSaving ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal: Bulk apply apps to target clinics (selected OR all visible) */}
      {bulkOpen && (() => {
        const targets = bulkScope === 'visible' ? filtered : filtered.filter((g) => selected.has(g.key))
        // Compute union of company-enabled apps across all target clinics
        const enabledUnion = new Set<string>()
        for (const g of targets) {
          const company = companyById.get(g.company_id)
          if (!company) continue
          for (const id of company.appIds) enabledUnion.add(id)
        }
        const availableApps = SYNCABLE_APPS.filter((a) => enabledUnion.has(a.id))
        // Per-app counts: how many target clinics currently have this app
        const counts = new Map<string, number>()
        for (const g of targets) {
          for (const a of g.apps) counts.set(a.app_id, (counts.get(a.app_id) ?? 0) + 1)
        }
        // Distinct companies in scope (used to warn when they have different app catalogs)
        const distinctCompanies = new Set(targets.map((g) => g.company_id))
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Asignar aplicativos</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {bulkScope === 'visible' ? 'Aplicar a todas las visibles · ' : ''}
                    {targets.length} clínica{targets.length !== 1 ? 's' : ''}
                    {distinctCompanies.size > 1 ? ` · ${distinctCompanies.size} empresas` : ''}
                  </p>
                </div>
                <button onClick={() => setBulkOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                  <span className="inline-flex items-center gap-1.5"><Check className="w-3 h-3 text-green-600" /> añadir a las que no la tengan</span>
                  <span className="mx-2">·</span>
                  <span className="inline-flex items-center gap-1.5"><Minus className="w-3 h-3 text-orange-500" /> mixto (algunas sí, algunas no)</span>
                  <span className="mx-2">·</span>
                  <span className="text-gray-400">vacío = quitar de todas</span>
                </div>
                {availableApps.length === 0 ? (
                  <div className="text-xs text-orange-600 px-3 py-3 bg-orange-50 rounded-lg">
                    Las empresas seleccionadas no tienen aplicativos habilitados.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {availableApps.map((a) => {
                      const n = counts.get(a.id) ?? 0
                      const total = targets.length
                      const isFull = n === total
                      const isPartial = n > 0 && n < total
                      const checked = bulkAppIds.has(a.id)
                      return (
                        <button
                          key={a.id}
                          onClick={() => bulkToggleApp(a.id, checked)}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-colors text-left ${
                            checked
                              ? 'border-brand-400 bg-brand-50/60'
                              : isPartial
                                ? 'border-orange-300 bg-orange-50/40 hover:bg-orange-50'
                                : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                            checked
                              ? 'bg-brand-500 border-brand-500'
                              : isPartial
                                ? 'bg-white border-orange-400'
                                : 'bg-white border-gray-300'
                          }`}>
                            {checked && <Check className="w-3 h-3 text-white" />}
                            {!checked && isPartial && <Minus className="w-2.5 h-2.5 text-orange-500" />}
                          </div>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{ background: a.bgColor, color: a.color }}>
                            {a.name.slice(0, 3).toUpperCase()}
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-700 block truncate">{a.name}</span>
                            <span className="text-[10px] text-gray-400">{n}/{total} clínicas</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
                {bulkError && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{bulkError}</div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50/50">
                <button onClick={() => setBulkOpen(false)} disabled={bulkSaving}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-60">
                  Cancelar
                </button>
                <button onClick={applyBulk} disabled={bulkSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
                  {bulkSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {bulkSaving ? 'Aplicando…' : `Aplicar a ${targets.length}`}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
