'use client'

import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import AppCard from '@/components/launcher/AppCard'
import { APPS, CATEGORIES } from '@/lib/apps'
import { getGreeting } from '@/lib/utils'
import { useUser } from '@/components/layout/HubShell'

export default function LauncherPage() {
  const user = useUser()
  const [selectedCategory, setSelectedCategory] = useState('Todos')
  const [query, setQuery] = useState('')
  const [accessibleApps, setAccessibleApps] = useState<Set<string> | null>(null)

  const firstName = user?.name.split(' ')[0] ?? 'Usuario'
  const greeting = getGreeting()

  useEffect(() => {
    fetch('/api/user/apps')
      .then((r) => r.json())
      .then((d) => setAccessibleApps(new Set(d.appIds ?? [])))
      .catch(() => setAccessibleApps(new Set()))
  }, [])

  const filtered = APPS.filter((app) => {
    const matchCat = selectedCategory === 'Todos' || app.category === selectedCategory
    const matchQ =
      !query ||
      app.name.toLowerCase().includes(query.toLowerCase()) ||
      app.description.toLowerCase().includes(query.toLowerCase())
    return matchCat && matchQ
  })

  return (
    <div className="max-w-6xl mx-auto p-6 sm:p-8 animate-fade-in">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {greeting}, {firstName} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Selecciona una aplicación para comenzar
        </p>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar aplicación…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent bg-white transition-colors"
          />
        </div>

        {/* Category pills */}
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${
                selectedCategory === cat
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* App grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((app) => {
            const locked =
              accessibleApps !== null &&
              app.status !== 'coming_soon' &&
              app.url !== '#' &&
              !accessibleApps.has(app.id)
            return <AppCard key={app.id} app={app} locked={locked} />
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-400 text-sm">No se encontraron aplicaciones para «{query}»</p>
        </div>
      )}

      {/* Footer */}
      <p className="text-xs text-gray-300 text-center mt-12">
        ImpulsoDent Suite · {new Date().getFullYear()}
      </p>
    </div>
  )
}
