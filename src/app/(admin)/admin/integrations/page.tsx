'use client'

import React, { useEffect, useState } from 'react'
import { Plug, CheckCircle2, XCircle, Loader2, ExternalLink, RefreshCw } from 'lucide-react'
import { APPS } from '@/lib/apps'

interface HealthResult {
  app_id: string
  name: string
  url: string
  reachable: boolean
  status?: number
  latency_ms?: number
  error?: string
}

export default function IntegrationsPage() {
  const [results, setResults] = useState<HealthResult[]>([])
  const [checking, setChecking] = useState(false)

  async function runHealthcheck() {
    setChecking(true)
    try {
      const res = await fetch('/api/admin/integrations/healthcheck', { method: 'POST' })
      const data = await res.json()
      setResults(data.results ?? [])
    } catch {
      setResults([])
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => { runHealthcheck() }, [])

  const externalApps = APPS.filter((a) => !a.internal && a.url !== '#')

  return (
    <div className="animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: '#ccfbf1' }}
        >
          <Plug style={{ width: 22, height: 22, color: '#0d9488' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Integraciones</h1>
          <p className="text-sm text-gray-500 mt-1">
            Conectores, endpoints de sincronización y salud de cada sub-aplicativo.
          </p>
        </div>
      </div>

      {/* Sync endpoints healthcheck */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-card p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Salud de endpoints /api/sync/*</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Verifica que cada sub-aplicativo responde al contrato de sincronización con el Hub.
            </p>
          </div>
          <button
            onClick={runHealthcheck}
            disabled={checking}
            className="flex items-center gap-2 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Comprobando…' : 'Re-verificar'}
          </button>
        </div>

        <div className="divide-y divide-gray-100">
          {externalApps.map((app) => {
            const r = results.find((x) => x.app_id === app.id)
            const loading = checking && !r
            return (
              <div key={app.id} className="flex items-center gap-3 py-2.5">
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                  style={{ background: app.bgColor, color: app.color }}
                >
                  {app.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{app.name}</div>
                  <div className="text-[11px] text-gray-400 truncate">{app.url}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {loading ? (
                    <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Comprobando
                    </span>
                  ) : r?.reachable ? (
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-md">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {r.status}{typeof r.latency_ms === 'number' ? ` · ${r.latency_ms}ms` : ''}
                    </span>
                  ) : r ? (
                    <span
                      className="flex items-center gap-1.5 text-[11px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-md"
                      title={r.error ?? ''}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      {r.status ?? 'error'}
                    </span>
                  ) : (
                    <span className="text-[11px] text-gray-400">—</span>
                  )}
                  <a
                    href={app.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-300 hover:text-brand-500 transition-colors"
                    title="Abrir aplicativo"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Sync contract doc */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-card p-5 mb-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Contrato de sincronización</h2>
        <ul className="space-y-2 text-[13px] text-gray-600">
          <li className="flex items-start gap-2">
            <code className="px-1.5 py-0.5 bg-gray-50 rounded text-[11px] font-mono text-brand-700 flex-shrink-0">POST</code>
            <div>
              <code className="font-mono text-gray-800">/api/sync/user</code> — alta/actualización de usuario + asignación de clínicas
            </div>
          </li>
          <li className="flex items-start gap-2">
            <code className="px-1.5 py-0.5 bg-gray-50 rounded text-[11px] font-mono text-brand-700 flex-shrink-0">GET</code>
            <div>
              <code className="font-mono text-gray-800">/api/sync/clinics</code> — el Hub importa las clínicas/centros del sub-aplicativo
            </div>
          </li>
          <li className="flex items-start gap-2">
            <code className="px-1.5 py-0.5 bg-gray-50 rounded text-[11px] font-mono text-brand-700 flex-shrink-0">POST</code>
            <div>
              <code className="font-mono text-gray-800">/api/sync/clinics</code> — el Hub propaga alta/edición/borrado de clínicas
            </div>
          </li>
          <li className="flex items-start gap-2">
            <code className="px-1.5 py-0.5 bg-gray-50 rounded text-[11px] font-mono text-brand-700 flex-shrink-0">POST</code>
            <div>
              <code className="font-mono text-gray-800">/api/sync/company</code> — alta/actualización de empresa
            </div>
          </li>
        </ul>
        <p className="text-[11px] text-gray-400 mt-3">
          Autenticación: <code className="font-mono">Bearer HUB_JWT_SECRET</code> compartido entre Hub y cada sub-aplicativo.
        </p>
      </section>

      {/* Future connectors */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-card p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-1">Conectores externos</h2>
        <p className="text-xs text-gray-500 mb-4">
          Integraciones con servicios de terceros. Próximamente.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {['Stripe', 'Holded', 'Sage', 'Gesden', 'Odontonet', 'Google Workspace'].map((name) => (
            <div
              key={name}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-100 bg-gray-50"
            >
              <div className="w-8 h-8 rounded-md bg-white border border-gray-200 flex items-center justify-center text-[11px] font-bold text-gray-400">
                {name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-700 truncate">{name}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Próximamente</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
