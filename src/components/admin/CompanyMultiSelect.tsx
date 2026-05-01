'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Building2, Check, ChevronDown, Search, X } from 'lucide-react'

export interface CompanyOption {
  id: string
  name: string
}

interface Props {
  companies: CompanyOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  accessAll: boolean
  onAccessAllChange: (v: boolean) => void
  disabled?: boolean
}

/**
 * Multi-select with chip preview + dropdown checklist.
 * Shows a "Todas las empresas" toggle that, when enabled, auto-selects every company.
 */
export function CompanyMultiSelect({ companies, selectedIds, onChange, accessAll, onAccessAllChange, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function close(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return companies
    return companies.filter((c) => c.name.toLowerCase().includes(q))
  }, [query, companies])

  const selectedSet = new Set(selectedIds)
  const allSelected = accessAll || (companies.length > 0 && selectedSet.size === companies.length)

  function toggle(id: string) {
    if (accessAll) {
      // Switching to manual selection — clamp to just this one.
      onAccessAllChange(false)
      onChange([id])
      return
    }
    onChange(
      selectedSet.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id],
    )
  }

  function selectAll() {
    onChange(companies.map((c) => c.id))
  }

  function clearAll() {
    onAccessAllChange(false)
    onChange([])
  }

  const visibleSelected = accessAll
    ? [{ id: '__all', name: `Todas las empresas (${companies.length})` }]
    : companies.filter((c) => selectedSet.has(c.id))

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="w-full min-h-[42px] flex items-center gap-1.5 flex-wrap pl-2.5 pr-9 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white disabled:opacity-60"
      >
        {visibleSelected.length === 0 ? (
          <span className="text-gray-400 px-1">Sin empresa</span>
        ) : (
          visibleSelected.map((c) => (
            <span
              key={c.id}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${
                accessAll ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-700'
              }`}
            >
              <Building2 className="w-3 h-3" />
              {c.name}
              {!accessAll && (
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggle(c.id)
                  }}
                  className="ml-0.5 opacity-60 hover:opacity-100"
                >
                  <X className="w-3 h-3" />
                </span>
              )}
            </span>
          ))
        )}
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onAccessAllChange(!accessAll)}
              className={`relative w-9 h-5 rounded-full transition-colors ${accessAll ? 'bg-brand-500' : 'bg-gray-200'}`}
              aria-label="Todas las empresas"
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  accessAll ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">Todas las empresas</p>
              <p className="text-[11px] text-gray-400">
                {accessAll ? `Acceso global · ${companies.length} empresas` : 'Selecciona manualmente abajo'}
              </p>
            </div>
            {!accessAll && (
              <div className="flex gap-2 text-[11px]">
                <button type="button" onClick={selectAll} className="text-brand-500 hover:underline">
                  Marcar todas
                </button>
                <span className="text-gray-300">·</span>
                <button type="button" onClick={clearAll} className="text-gray-400 hover:underline">
                  Limpiar
                </button>
              </div>
            )}
          </div>

          <div className="px-3 py-2 border-b border-gray-100 relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar empresa…"
              className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-100 rounded-md focus:outline-none focus:border-brand-300"
            />
          </div>

          <ul className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-xs text-gray-400 text-center">Sin resultados</li>
            ) : (
              filtered.map((c) => {
                const checked = allSelected || selectedSet.has(c.id)
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => toggle(c.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 ${
                        checked ? 'text-brand-600 font-medium' : 'text-gray-700'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center ${
                          checked ? 'border-brand-500 bg-brand-500 text-white' : 'border-gray-300'
                        }`}
                      >
                        {checked && <Check className="w-3 h-3" />}
                      </span>
                      <Building2 className="w-3.5 h-3.5 text-gray-400" />
                      <span className="flex-1 text-left truncate">{c.name}</span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
