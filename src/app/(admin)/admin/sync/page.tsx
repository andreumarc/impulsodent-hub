'use client'

import React, { useState, useEffect } from 'react'
import { RefreshCw, CheckCircle2, XCircle, Building2, Users, Stethoscope } from 'lucide-react'

interface Company { id: string; name: string; slug: string }

interface ReconcileDetail {
  app_id: string
  company_slug?: string
  keys_sent: number
  status: 'ok' | 'failed'
  soft_deleted?: number
  error?: string
}

interface ReconcileResult {
  startedAt: string
  elapsedMs: number
  pairs: number
  ok: number
  failed: number
  details: ReconcileDetail[]
}

type SweepKind = 'companies' | 'users' | 'clinics'

const SWEEP_LABELS: Record<SweepKind, { title: string; subtitle: string; Icon: typeof Building2 }> = {
  companies: { title: 'Empresas',  subtitle: 'Marca como inactivas en cada sub-app las empresas que ya no existen en el Hub', Icon: Building2 },
  users:     { title: 'Usuarios',  subtitle: 'Marca como inactivos los usuarios huérfanos por empresa',                    Icon: Users },
  clinics:   { title: 'Clínicas',  subtitle: 'Marca como inactivas las clínicas que ya no existen en el Hub',              Icon: Stethoscope },
}

export default function SyncPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [companySlug, setCompanySlug] = useState('')
  const [running, setRunning] = useState<SweepKind | null>(null)
  const [result, setResult] = useState<{ kind: SweepKind; data: ReconcileResult } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/companies').then((r) => r.json()).then(setCompanies).catch(() => null)
  }, [])

  async function runSweep(kind: SweepKind) {
    setRunning(kind); setResult(null); setError(null)
    try {
      const body = kind === 'companies' ? {} : (companySlug ? { companySlug } : {})
      const res = await fetch(`/api/admin/reconcile/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? `HTTP ${res.status}`)
      } else {
        setResult({ kind, data })
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sincronización (reconcile)</h1>
        <p className="text-sm text-gray-500 mt-1">
          Dispara el barrido de reconciliación a cada aplicativo de la suite. Las sub-apps marcan como inactivos los registros que ya no existen en el Hub. Auth via <code className="text-xs px-1 py-0.5 rounded bg-gray-100">HUB_JWT_SECRET</code>.
        </p>
      </div>

      {/* Optional company filter (applies only to users/clinics) */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-card p-5 mb-4">
        <label className="text-sm font-medium text-gray-700">
          Empresa <span className="text-gray-400 font-normal">(opcional, solo aplica a Usuarios y Clínicas)</span>
        </label>
        <select
          value={companySlug}
          onChange={(e) => setCompanySlug(e.target.value)}
          className="mt-1.5 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
        >
          <option value="">Todas las empresas</option>
          {companies.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
        </select>
      </div>

      {/* Sweep buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {(Object.keys(SWEEP_LABELS) as SweepKind[]).map((kind) => {
          const { title, subtitle, Icon } = SWEEP_LABELS[kind]
          const active = running === kind
          return (
            <button
              key={kind}
              onClick={() => runSweep(kind)}
              disabled={running !== null}
              className="text-left bg-white rounded-xl border border-gray-100 shadow-card p-5 hover:border-brand-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-2 mb-2">
                {active ? <RefreshCw className="w-5 h-5 text-brand-500 animate-spin" /> : <Icon className="w-5 h-5 text-brand-500" />}
                <span className="text-sm font-semibold text-gray-900">{title}</span>
              </div>
              <p className="text-xs text-gray-500">{subtitle}</p>
            </button>
          )
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">
              Resultados — {SWEEP_LABELS[result.kind].title}
            </h3>
            <span className="text-xs text-gray-500">
              {result.data.ok} OK · {result.data.failed} fallidos · {result.data.elapsedMs} ms
            </span>
          </div>
          {result.data.details.length === 0 ? (
            <p className="text-xs text-gray-400">Sin resultados (no hay aplicativos configurados o no hay empresas activas).</p>
          ) : (
            <div className="space-y-1.5">
              {result.data.details.map((d, i) => (
                <div key={i} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0 text-sm">
                  {d.status === 'ok' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                  )}
                  <span className="font-medium text-gray-800 min-w-[10ch]">{d.app_id}</span>
                  {d.company_slug && (
                    <span className="text-xs text-gray-400">· {d.company_slug}</span>
                  )}
                  <span className="text-xs text-gray-500">
                    {d.keys_sent} enviadas
                    {typeof d.soft_deleted === 'number' && ` · ${d.soft_deleted} desactivadas`}
                  </span>
                  {d.status === 'failed' && d.error && (
                    <span className="ml-auto text-xs text-red-600 truncate max-w-[40ch]" title={d.error}>{d.error}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
