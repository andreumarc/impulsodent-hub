'use client'

import React, { useState, useEffect } from 'react'
import { RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { APPS } from '@/lib/apps'

interface Company { id: string; name: string }
interface SyncResult { app_id: string; company: string; status: string; code?: number }

export default function SyncPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompany, setSelectedCompany] = useState('')
  const [selectedApp, setSelectedApp] = useState('')
  const [results, setResults] = useState<SyncResult[]>([])
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    fetch('/api/admin/companies').then((r) => r.json()).then(setCompanies).catch(() => null)
  }, [])

  async function runSync() {
    setSyncing(true); setResults([])
    const res = await fetch('/api/admin/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: selectedCompany || undefined,
        appId: selectedApp || undefined,
      }),
    })
    const data = await res.json()
    setSyncing(false)
    setResults(data.results ?? [])
  }

  const STATUS_ICON: Record<string, React.ReactElement> = {
    success:        <CheckCircle2 className="w-4 h-4 text-green-500" />,
    failed:         <XCircle className="w-4 h-4 text-red-500" />,
    error:          <XCircle className="w-4 h-4 text-red-500" />,
    skipped_no_url: <Clock className="w-4 h-4 text-gray-400" />,
  }

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sincronización</h1>
        <p className="text-sm text-gray-500 mt-1">Envía datos de empresas y usuarios a cada aplicativo de la suite</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-card p-5 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Empresa <span className="text-gray-400 font-normal">(opcional)</span></label>
            <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white">
              <option value="">Todas las empresas</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Aplicación <span className="text-gray-400 font-normal">(opcional)</span></label>
            <select value={selectedApp} onChange={(e) => setSelectedApp(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white">
              <option value="">Todas las aplicaciones</option>
              {APPS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <button onClick={runSync} disabled={syncing}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Sincronizando…' : 'Iniciar sincronización'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-card p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Resultados</h3>
          <div className="space-y-2">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                {STATUS_ICON[r.status] ?? <Clock className="w-4 h-4 text-gray-400" />}
                <span className="text-sm font-medium text-gray-800">{r.company}</span>
                <span className="text-xs text-gray-400">→</span>
                <span className="text-sm text-gray-600">{r.app_id}</span>
                <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-md ${
                  r.status === 'success' ? 'text-green-700 bg-green-50' :
                  r.status === 'skipped_no_url' ? 'text-gray-500 bg-gray-100' :
                  'text-red-700 bg-red-50'
                }`}>
                  {r.status === 'skipped_no_url' ? 'sin URL' : r.status}
                  {r.code ? ` (${r.code})` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
