'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Power, Pencil, Trash2, RefreshCw, Building2, ChevronRight, LayoutGrid } from 'lucide-react'
import { APPS } from '@/lib/apps'

const PLAN_LABELS: Record<string, string> = { free: 'Free', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' }
const PLAN_COLORS: Record<string, string> = {
  free:       'bg-gray-100 text-gray-500',
  starter:    'bg-blue-50 text-blue-600',
  pro:        'bg-purple-50 text-purple-600',
  enterprise: 'bg-amber-50 text-amber-600',
}

interface CompanyWithStats {
  id: string; name: string; slug: string; cif: string | null; city: string | null
  email: string | null; phone: string | null; active: boolean; created_at: string
  appIds: string[]; userCount: number
  subscription_plan: string; subscription_expires_at: string | null
}

function getInitials(name: string): string {
  const stop = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 's.a.', 's.l.', 'sl', 'sa'])
  const words = name.split(/\s+/).filter((w) => !stop.has(w.toLowerCase()))
  return words.slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanyWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [pulling, setPulling] = useState(false)
  const [pullSummary, setPullSummary] = useState<{ app_id: string; ok: boolean; created: number; updated: number; error?: string }[] | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  function loadCompanies() {
    return fetch('/api/admin/companies').then((r) => r.json()).then(setCompanies).catch(() => null)
  }

  useEffect(() => { loadCompanies().finally(() => setLoading(false)) }, [])

  async function handlePull() {
    setPulling(true); setPullSummary(null)
    try {
      const r = await fetch('/api/admin/companies?pull=1')
      const d = await r.json() as { pull?: typeof pullSummary; companies?: CompanyWithStats[] }
      if (Array.isArray(d.companies)) setCompanies(d.companies)
      if (Array.isArray(d.pull)) setPullSummary(d.pull)
    } catch { /* non-fatal */ }
    finally { setPulling(false) }
  }

  const tabs = useMemo(() => [
    { value: 'all',      label: 'Todas',    count: companies.length },
    { value: 'active',   label: 'Activas',  count: companies.filter((c) => c.active).length },
    { value: 'inactive', label: 'Inactivas', count: companies.filter((c) => !c.active).length },
  ], [companies])

  const filtered = useMemo(() =>
    statusFilter === 'all' ? companies :
    companies.filter((c) => statusFilter === 'active' ? c.active : !c.active),
    [companies, statusFilter]
  )

  async function toggleActive(c: CompanyWithStats) {
    await fetch(`/api/admin/companies/${c.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !c.active }),
    })
    setCompanies((prev) => prev.map((x) => x.id === c.id ? { ...x, active: !x.active } : x))
  }

  async function handleDelete(c: CompanyWithStats) {
    if (!confirm(`¿Eliminar "${c.name}"? Esta acción no se puede deshacer.`)) return
    const res = await fetch(`/api/admin/companies/${c.id}`, { method: 'DELETE' })
    if (res.ok) setCompanies((prev) => prev.filter((x) => x.id !== c.id))
  }

  async function handleBulkDelete() {
    if (!confirm(`¿Eliminar ${selected.size} empresa${selected.size !== 1 ? 's' : ''}? Esta acción no se puede deshacer.`)) return
    setDeleting(true)
    try {
      await Promise.all([...selected].map((id) => fetch(`/api/admin/companies/${id}`, { method: 'DELETE' })))
      setCompanies((prev) => prev.filter((c) => !selected.has(c.id)))
      setSelected(new Set())
    } finally { setDeleting(false) }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  function toggleAll() {
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((c) => c.id)))
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Empresas</h1>
          <p className="text-sm text-gray-500 mt-0.5">{companies.length} empresa{companies.length !== 1 ? 's' : ''} registrada{companies.length !== 1 ? 's' : ''} en el sistema</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePull}
            disabled={pulling}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 bg-white text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${pulling ? 'animate-spin' : ''}`} />
            {pulling ? 'Sincronizando…' : 'Pull desde apps'}
          </button>
          <Link href="/admin/companies/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
            Nueva Empresa
          </Link>
        </div>
      </div>

      {pullSummary && (
        <div className="mb-5 rounded-xl border border-gray-100 bg-white p-3 text-xs text-gray-600">
          <div className="font-semibold text-gray-700 mb-1.5">Resultado de la sincronización</div>
          <div className="flex flex-wrap gap-2">
            {pullSummary.map((s) => (
              <span
                key={s.app_id}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border ${
                  s.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'
                }`}
                title={s.error}
              >
                <span className="font-semibold uppercase tracking-wide">{s.app_id}</span>
                {s.ok ? <span>+{s.created} nuevos · {s.updated} actualizados</span> : <span>{s.error || 'error'}</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Status tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
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

        {selected.size > 0 && (
          <button
            onClick={handleBulkDelete}
            disabled={deleting}
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-60"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? 'Eliminando…' : `Eliminar seleccionadas (${selected.size})`}
          </button>
        )}
      </div>

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-card p-12 text-center">
          <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">
            {statusFilter !== 'all' ? 'Sin resultados' : 'Aún no hay empresas'}
          </p>
          {statusFilter === 'all' && (
            <Link href="/admin/companies/new"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-semibold rounded-lg hover:bg-brand-600 transition-colors">
              <Plus className="w-4 h-4" />
              Crear empresa
            </Link>
          )}
        </div>
      )}

      {/* Table */}
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
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Empresa</th>
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 hidden md:table-cell">CIF / Ciudad</th>
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">Apps activas</th>
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Estado</th>
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 hidden xl:table-cell">Plan</th>
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 hidden xl:table-cell">Alta</th>
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((c) => {
                const initials = getInitials(c.name)
                const activeApps = APPS.filter((a) => c.appIds.includes(a.id))
                return (
                  <tr key={c.id} className={`transition-colors hover:bg-gray-50/60 ${selected.has(c.id) ? 'bg-brand-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)}
                        className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400 cursor-pointer" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: '#e6eef7', color: '#003A70' }}>
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-semibold text-gray-900 block truncate">{c.name}</span>
                          <span className="text-[11px] text-gray-400 font-mono">{c.slug}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-gray-500">
                        {[c.cif, c.city].filter(Boolean).join(' · ') || <span className="italic text-gray-300">—</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {activeApps.length === 0 ? (
                        <span className="text-xs text-gray-300 italic">Sin apps</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {activeApps.slice(0, 3).map((a) => (
                            <span key={a.id} className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                              style={{ background: a.bgColor, color: a.color }}>
                              {a.name.slice(0, 3).toUpperCase()}
                            </span>
                          ))}
                          {activeApps.length > 3 && (
                            <span className="text-[10px] text-gray-400 font-medium">+{activeApps.length - 3}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.active ? 'text-green-700 bg-green-50' : 'text-gray-500 bg-gray-100'}`}>
                        {c.active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${PLAN_COLORS[c.subscription_plan] ?? PLAN_COLORS.free}`}>
                        {PLAN_LABELS[c.subscription_plan] ?? c.subscription_plan}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <span className="text-xs text-gray-500">{formatDate(c.created_at)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => toggleActive(c)}
                          className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            c.active ? 'text-orange-500 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'
                          }`}>
                          <Power className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{c.active ? 'Desactivar' : 'Activar'}</span>
                        </button>
                        <button onClick={() => handleDelete(c)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Eliminar</span>
                        </button>
                        <Link href={`/admin/companies/${c.id}`}
                          className="p-1.5 text-gray-400 hover:text-brand-500 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Editar empresa">
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
