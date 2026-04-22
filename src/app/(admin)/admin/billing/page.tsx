'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CreditCard, Users, AlertTriangle, TrendingUp, RefreshCw,
  ExternalLink, FileText, ChevronDown, Search, Loader2,
} from 'lucide-react'

type SubStatus =
  | 'active' | 'trialing' | 'past_due' | 'canceled'
  | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'paused'

interface Metrics {
  activeSubscriptions: number
  trialingSubscriptions: number
  pastDueSubscriptions: number
  canceledThisMonth: number
  mrrCents: number
  arrCents: number
  currency: string
  paidInvoicesLast30dCents: number
  failedInvoicesLast30d: number
}
interface Sub {
  id: string
  customer: { id: string; email: string | null; name: string | null }
  status: SubStatus
  planKey: string
  interval: 'monthly' | 'yearly' | 'unknown'
  amountCents: number
  currency: string
  currentPeriodEnd: number | null
  cancelAtPeriodEnd: boolean
  createdAt: number
}
interface Invoice {
  id: string
  number: string | null
  status: string
  amountPaidCents: number
  amountDueCents: number
  currency: string
  customerEmail: string | null
  customerId: string | null
  hostedInvoiceUrl: string | null
  invoicePdf: string | null
  created: number
}
interface Overview { metrics: Metrics; subscriptions: Sub[]; invoices: Invoice[] }

const STATUS_STYLE: Record<SubStatus | 'default', { bg: string; fg: string; label: string }> = {
  active:             { bg: 'rgba(34,197,94,0.12)', fg: '#22c55e', label: 'Activa' },
  trialing:           { bg: 'rgba(59,130,246,0.12)', fg: '#3b82f6', label: 'Trial' },
  past_due:           { bg: 'rgba(245,158,11,0.14)', fg: '#f59e0b', label: 'Impago' },
  unpaid:             { bg: 'rgba(239,68,68,0.14)', fg: '#ef4444', label: 'No pagada' },
  canceled:           { bg: 'rgba(148,163,184,0.14)', fg: '#94a3b8', label: 'Cancelada' },
  incomplete:         { bg: 'rgba(148,163,184,0.14)', fg: '#94a3b8', label: 'Incompleta' },
  incomplete_expired: { bg: 'rgba(148,163,184,0.14)', fg: '#94a3b8', label: 'Expirada' },
  paused:             { bg: 'rgba(148,163,184,0.14)', fg: '#94a3b8', label: 'Pausada' },
  default:            { bg: 'rgba(148,163,184,0.14)', fg: '#94a3b8', label: 'Desconocido' },
}

function money(cents: number, currency = 'eur') {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 0 })
    .format(cents / 100)
}
function moneyPrecise(cents: number, currency = 'eur') {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100)
}
function fmtDate(sec: number | null) {
  if (!sec) return '—'
  return new Date(sec * 1000).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function BillingAdminPage() {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | SubStatus>('all')
  const [search, setSearch] = useState('')
  const [portalLoading, setPortalLoading] = useState<string | null>(null)

  async function fetchData(silent = false) {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/billing', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.message ?? json?.error ?? 'fetch_failed')
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const filteredSubs = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    return data.subscriptions.filter((s) => {
      if (filter !== 'all' && s.status !== filter) return false
      if (!q) return true
      return (
        s.customer.email?.toLowerCase().includes(q) ||
        s.customer.name?.toLowerCase().includes(q) ||
        s.planKey.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
      )
    })
  }, [data, filter, search])

  async function openPortal(customerId: string) {
    setPortalLoading(customerId)
    try {
      const res = await fetch('/api/admin/billing/portal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ customerId }),
      })
      const json = await res.json()
      if (!res.ok || !json.url) throw new Error(json?.message ?? 'portal_failed')
      window.open(json.url, '_blank', 'noopener')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo abrir el portal')
    } finally {
      setPortalLoading(null)
    }
  }

  const m = data?.metrics

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-teal-600" />
            Suscripciones y pagos
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Panel de control de Stripe — facturación, suscripciones activas e incidencias.
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing || loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">No se pudo cargar información de Stripe</p>
            <p className="mt-0.5">{error}</p>
            <p className="mt-1 text-xs text-red-600">
              Revisa que <code>STRIPE_SECRET_KEY</code> esté configurada en el Hub.
            </p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="MRR"
          value={m ? money(m.mrrCents, m.currency) : '—'}
          sub={m ? `ARR ${money(m.arrCents, m.currency)}` : ''}
          accent="#0d9488"
          loading={loading}
        />
        <KpiCard
          icon={<Users className="w-5 h-5" />}
          label="Suscripciones activas"
          value={m ? String(m.activeSubscriptions + m.trialingSubscriptions) : '—'}
          sub={m ? `${m.activeSubscriptions} activas · ${m.trialingSubscriptions} en trial` : ''}
          accent="#3b82f6"
          loading={loading}
        />
        <KpiCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Impagos"
          value={m ? String(m.pastDueSubscriptions) : '—'}
          sub={m ? `${m.failedInvoicesLast30d} facturas sin cobrar 30d` : ''}
          accent="#f59e0b"
          loading={loading}
        />
        <KpiCard
          icon={<FileText className="w-5 h-5" />}
          label="Cobrado últimos 30d"
          value={m ? money(m.paidInvoicesLast30dCents, m.currency) : '—'}
          sub={m ? `${m.canceledThisMonth} cancelaciones este mes` : ''}
          accent="#8b5cf6"
          loading={loading}
        />
      </div>

      {/* Subscriptions */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3 justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Suscripciones</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {filteredSubs.length} de {data?.subscriptions.length ?? 0}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Email, plan, ID…"
                className="pl-9 pr-3 py-2 rounded-lg text-sm border border-slate-200 bg-white w-56 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div className="relative">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="appearance-none pl-3 pr-8 py-2 rounded-lg text-sm border border-slate-200 bg-white focus:outline-none focus:border-teal-500"
              >
                <option value="all">Todas</option>
                <option value="active">Activas</option>
                <option value="trialing">En trial</option>
                <option value="past_due">Impago</option>
                <option value="canceled">Canceladas</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-16 flex items-center justify-center text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" /> <span className="ml-2 text-sm">Cargando desde Stripe…</span>
          </div>
        ) : filteredSubs.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No hay suscripciones que coincidan.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold">Cliente</th>
                  <th className="text-left px-3 py-3 font-semibold">Plan</th>
                  <th className="text-left px-3 py-3 font-semibold">Importe</th>
                  <th className="text-left px-3 py-3 font-semibold">Estado</th>
                  <th className="text-left px-3 py-3 font-semibold">Renueva</th>
                  <th className="text-right px-5 py-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSubs.map((s) => {
                  const style = STATUS_STYLE[s.status] ?? STATUS_STYLE.default
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="font-medium text-slate-900">
                          {s.customer.name || s.customer.email || s.customer.id}
                        </div>
                        {s.customer.name && s.customer.email && (
                          <div className="text-xs text-slate-500">{s.customer.email}</div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-800 capitalize">{s.planKey}</div>
                        <div className="text-xs text-slate-500">{s.interval === 'yearly' ? 'Anual' : s.interval === 'monthly' ? 'Mensual' : '—'}</div>
                      </td>
                      <td className="px-3 py-3 text-slate-800 font-medium">
                        {moneyPrecise(s.amountCents, s.currency)}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ background: style.bg, color: style.fg }}
                        >
                          {style.label}
                          {s.cancelAtPeriodEnd && s.status === 'active' && ' · cancelada al final'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{fmtDate(s.currentPeriodEnd)}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => openPortal(s.customer.id)}
                          disabled={portalLoading === s.customer.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-teal-50 text-teal-700 hover:bg-teal-100 disabled:opacity-50"
                        >
                          {portalLoading === s.customer.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ExternalLink className="w-3.5 h-3.5" />
                          )}
                          Portal
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoices */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Facturas recientes (30 días)</h2>
          <p className="text-xs text-slate-500 mt-0.5">{data?.invoices.length ?? 0} facturas</p>
        </div>
        {loading ? (
          <div className="py-12 flex items-center justify-center text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : !data || data.invoices.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">No hay facturas en los últimos 30 días.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold">Nº</th>
                  <th className="text-left px-3 py-3 font-semibold">Cliente</th>
                  <th className="text-left px-3 py-3 font-semibold">Importe</th>
                  <th className="text-left px-3 py-3 font-semibold">Estado</th>
                  <th className="text-left px-3 py-3 font-semibold">Fecha</th>
                  <th className="text-right px-5 py-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.invoices.map((inv) => {
                  const paid = inv.status === 'paid'
                  const style = paid
                    ? { bg: 'rgba(34,197,94,0.12)', fg: '#22c55e', label: 'Pagada' }
                    : inv.status === 'open'
                    ? { bg: 'rgba(245,158,11,0.14)', fg: '#f59e0b', label: 'Pendiente' }
                    : inv.status === 'uncollectible'
                    ? { bg: 'rgba(239,68,68,0.14)', fg: '#ef4444', label: 'Incobrable' }
                    : inv.status === 'void'
                    ? { bg: 'rgba(148,163,184,0.14)', fg: '#94a3b8', label: 'Anulada' }
                    : { bg: 'rgba(148,163,184,0.14)', fg: '#94a3b8', label: inv.status }
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-mono text-xs text-slate-700">{inv.number || inv.id.slice(0, 10)}</td>
                      <td className="px-3 py-3 text-slate-700">{inv.customerEmail || '—'}</td>
                      <td className="px-3 py-3 font-medium text-slate-900">
                        {moneyPrecise(paid ? inv.amountPaidCents : inv.amountDueCents, inv.currency)}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ background: style.bg, color: style.fg }}
                        >
                          {style.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{fmtDate(inv.created)}</td>
                      <td className="px-5 py-3 text-right">
                        {inv.hostedInvoiceUrl && (
                          <a
                            href={inv.hostedInvoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Ver
                          </a>
                        )}
                        {inv.invoicePdf && (
                          <a
                            href={inv.invoicePdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            <FileText className="w-3.5 h-3.5" /> PDF
                          </a>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({
  icon, label, value, sub, accent, loading,
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent: string; loading?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider">
        <span style={{ color: accent }}>{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
        {loading ? <span className="inline-block w-20 h-7 bg-slate-100 rounded animate-pulse" /> : value}
      </div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  )
}
