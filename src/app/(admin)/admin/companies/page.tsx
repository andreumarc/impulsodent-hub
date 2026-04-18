'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Search, Pencil, Power, Trash2, LayoutGrid, Building2, ChevronDown } from 'lucide-react'
import { APPS } from '@/lib/apps'

interface CompanyWithStats {
  id: string; name: string; slug: string; cif: string | null; city: string | null
  email: string | null; phone: string | null; active: boolean; created_at: string
  appIds: string[]; userCount: number
}

function getInitials(name: string): string {
  const stop = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 's.a.', 's.l.', 'sl', 'sa', 'slu', 'slu.'])
  const words = name.split(/\s+/).filter((w) => !stop.has(w.toLowerCase()))
  return words.slice(0, 3).map((w) => w[0]).join('').toUpperCase()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanyWithStats[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/companies')
      .then((r) => r.json())
      .then(setCompanies)
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return companies.filter((c) => {
      const matchSearch = !q ||
        c.name.toLowerCase().includes(q) ||
        (c.cif?.toLowerCase().includes(q) ?? false) ||
        (c.city?.toLowerCase().includes(q) ?? false) ||
        c.slug.toLowerCase().includes(q)
      const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? c.active : !c.active)
      return matchSearch && matchStatus
    })
  }, [companies, search, statusFilter])

  async function toggleActive(c: CompanyWithStats) {
    await fetch(`/api/admin/companies/${c.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !c.active }),
    })
    setCompanies((prev) => prev.map((x) => x.id === c.id ? { ...x, active: !x.active } : x))
  }

  async function handleDelete(c: CompanyWithStats) {
    if (!confirm(`¿Eliminar "${c.name}" permanentemente? Esta acción no se puede deshacer.`)) return
    const res = await fetch(`/api/admin/companies/${c.id}`, { method: 'DELETE' })
    if (res.ok) setCompanies((prev) => prev.filter((x) => x.id !== c.id))
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Empresas</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {companies.length} empresa{companies.length !== 1 ? 's' : ''} registrada{companies.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/admin/companies/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          Nueva Empresa
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre, CIF, ciudad..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white" />
        </div>
        <div className="relative">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none text-sm border border-gray-200 rounded-lg px-3 py-2 pr-8 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400">
            <option value="all">Todos los estados</option>
            <option value="active">Activas</option>
            <option value="inactive">Inactivas</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-card p-12 text-center">
          <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">
            {search || statusFilter !== 'all' ? 'Sin resultados' : 'Aún no hay empresas'}
          </p>
          {!search && statusFilter === 'all' && (
            <Link href="/admin/companies/new"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-semibold rounded-lg hover:bg-brand-600 transition-colors">
              <Plus className="w-4 h-4" />
              Crear empresa
            </Link>
          )}
        </div>
      )}

      {/* Cards */}
      <div className="space-y-3">
        {filtered.map((c) => {
          const initials = getInitials(c.name)
          const activeApps = APPS.filter((a) => c.appIds.includes(a.id))

          return (
            <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-card overflow-hidden">
              {/* Card body */}
              <div className="flex items-start gap-4 p-5">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: '#e6eef7' }}>
                  <span className="text-sm font-bold" style={{ color: '#003A70' }}>{initials}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-base font-bold text-gray-900">{c.name}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 tracking-wide">
                      {initials}
                    </span>
                    <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${c.active ? 'text-green-700 bg-green-50' : 'text-gray-500 bg-gray-100'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${c.active ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {c.active ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">
                    {[c.cif, c.city].filter(Boolean).join(' · ') || <span className="italic">Sin CIF ni ciudad</span>}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    Alta <span className="font-semibold text-gray-600">{formatDate(c.created_at)}</span>
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <Link href={`/admin/companies/${c.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-brand-600 hover:bg-gray-50 rounded-lg transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                    Editar
                  </Link>
                  <button onClick={() => toggleActive(c)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      c.active ? 'text-orange-500 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'
                    }`}>
                    <Power className="w-3.5 h-3.5" />
                    {c.active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button onClick={() => handleDelete(c)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                    Eliminar
                  </button>
                </div>
              </div>

              {/* Apps section */}
              <div className="border-t border-gray-50 bg-gray-50/50 px-5 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex-shrink-0">
                    Apps activas ({activeApps.length})
                  </span>
                  {activeApps.length === 0 ? (
                    <span className="text-xs text-gray-400">Sin aplicaciones asignadas</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {activeApps.map((a) => (
                        <span key={a.id} className="text-[11px] font-medium px-2 py-0.5 rounded-md"
                          style={{ background: a.bgColor, color: a.color }}>
                          {a.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <Link href={`/admin/companies/${c.id}#apps`}
                  className="flex items-center gap-1.5 text-xs font-semibold text-brand-500 hover:text-brand-700 transition-colors flex-shrink-0">
                  <LayoutGrid className="w-3.5 h-3.5" />
                  + Configurar acceso
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
