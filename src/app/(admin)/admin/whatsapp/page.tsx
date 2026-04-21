'use client'

import { useEffect, useState } from 'react'
import {
  MessageCircle, Save, Plus, Trash2, Loader2, CheckCircle2, ExternalLink,
  MessageSquare, Users, Webhook, Settings,
} from 'lucide-react'

type AppSource =
  | 'LANDING' | 'HUB' | 'CLINICPNL' | 'ZENTRIX' | 'DENTAL_REPORTS' | 'DENTALHR'
  | 'SPENDFLOW' | 'FICHAJES' | 'CLINICFIX' | 'CLINICSTOCK' | 'CLINICVOX' | 'CLINICREFUNDS' | 'OTHER'

interface QuickReply { label: string; payload: string; order?: number }
interface WidgetConfig {
  id?: string
  appSource: AppSource
  enabled: boolean
  welcomeMessage: string
  whatsappNumber?: string | null
  legalNoticeUrl?: string | null
  quickReplies: QuickReply[]
}
interface ConversationRow {
  id: string
  appSource: AppSource
  status: string
  type: string
  priority: string
  messageCount: number
  needsHuman: boolean
  intentDetected: string | null
  contact: { name?: string | null; email?: string | null; phone?: string | null } | null
  createdAt: string
}

const APP_SOURCES: AppSource[] = ['LANDING', 'HUB', 'ZENTRIX', 'CLINICVOX', 'CLINICREFUNDS', 'CLINICSTOCK', 'SPENDFLOW', 'FICHAJES', 'DENTALHR', 'DENTAL_REPORTS', 'CLINICPNL', 'CLINICFIX', 'OTHER']
const DEFAULT_CONFIG = (app: AppSource): WidgetConfig => ({
  appSource: app,
  enabled: app === 'LANDING',
  welcomeMessage: '¡Hola! Soy el asistente de ImpulsoDent. ¿En qué podemos ayudarte?',
  whatsappNumber: '',
  legalNoticeUrl: '/legal/privacidad',
  quickReplies: [
    { label: 'Quiero una demo', payload: 'demo' },
    { label: 'Información comercial', payload: 'comercial' },
    { label: 'Tengo una incidencia', payload: 'incidencia' },
    { label: 'Hablar con una persona', payload: 'humano' },
  ],
})

export default function WhatsAppAdminPage() {
  const [selectedApp, setSelectedApp] = useState<AppSource>('LANDING')
  const [config, setConfig] = useState<WidgetConfig>(DEFAULT_CONFIG('LANDING'))
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [totals, setTotals] = useState<{ conversations: number; leads: number } | null>(null)
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [error, setError] = useState<string | null>(null)

  async function loadConfig(app: AppSource) {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/admin/whatsapp/config?app=${app}`, { cache: 'no-store' })
      const data = await res.json()
      if (data.config) {
        setConfig({
          id: data.config.id,
          appSource: app,
          enabled: data.config.enabled,
          welcomeMessage: data.config.welcomeMessage,
          whatsappNumber: data.config.whatsappNumber ?? '',
          legalNoticeUrl: data.config.legalNoticeUrl ?? '',
          quickReplies: data.config.quickReplies?.map((q: { label: string; payload: string; order: number }) => ({
            label: q.label, payload: q.payload, order: q.order,
          })) ?? [],
        })
      } else {
        setConfig(DEFAULT_CONFIG(app))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando configuración')
    } finally {
      setLoading(false)
    }
  }

  async function loadConversations() {
    try {
      const res = await fetch('/api/admin/whatsapp/conversations?limit=20', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setTotals(data.totals ?? null)
      setConversations(data.items ?? [])
    } catch { /* ignore */ }
  }

  useEffect(() => { loadConfig(selectedApp) }, [selectedApp])
  useEffect(() => { loadConversations() }, [])

  async function save() {
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/admin/whatsapp/config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setSavedAt(Date.now())
      setTimeout(() => setSavedAt(null), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error guardando')
    } finally {
      setSaving(false)
    }
  }

  function updateReply(i: number, patch: Partial<QuickReply>) {
    setConfig((c) => ({
      ...c,
      quickReplies: c.quickReplies.map((q, idx) => (idx === i ? { ...q, ...patch } : q)),
    }))
  }
  function addReply() {
    setConfig((c) => ({ ...c, quickReplies: [...c.quickReplies, { label: '', payload: '' }] }))
  }
  function removeReply(i: number) {
    setConfig((c) => ({ ...c, quickReplies: c.quickReplies.filter((_, idx) => idx !== i) }))
  }

  return (
    <div className="animate-fade-in max-w-5xl">
      <div className="mb-6 flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#dcfce7' }}>
          <MessageCircle style={{ width: 22, height: 22, color: '#16a34a' }} />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp</h1>
          <p className="text-sm text-gray-500 mt-1">
            Capa transversal de mensajería. Configura proveedor, widget, plantillas y monitoriza conversaciones.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <KpiCard icon={MessageSquare} label="Conversaciones" value={totals?.conversations ?? '—'} color="#16a34a" bg="#dcfce7" />
        <KpiCard icon={Users} label="Leads capturados" value={totals?.leads ?? '—'} color="#0d9488" bg="#ccfbf1" />
        <KpiCard icon={Webhook} label="Webhook" value="Activo" color="#6366f1" bg="#e0e7ff" />
      </div>

      {/* Provider + webhook info */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-card p-5 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Settings className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-800">Proveedor y conexión API</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[13px]">
          <Field label="Proveedor activo" value={<code className="text-xs bg-gray-50 px-2 py-1 rounded">WHATSAPP_PROVIDER</code>} hint="Definido en Vercel env (meta / twilio / mock)" />
          <Field label="Webhook URL (inbound)" value={
            <code className="text-xs bg-gray-50 px-2 py-1 rounded select-all break-all">
              https://impulsodent.com/api/whatsapp/webhook
            </code>
          } hint="Configura esta URL en Meta Business / Twilio" />
          <Field label="Meta credentials" value={<code className="text-xs bg-gray-50 px-2 py-1 rounded">META_WABA_ID · META_PHONE_NUMBER_ID · META_ACCESS_TOKEN · META_APP_SECRET · META_VERIFY_TOKEN</code>} hint="Variables de entorno Vercel" />
          <Field label="Twilio credentials" value={<code className="text-xs bg-gray-50 px-2 py-1 rounded">TWILIO_ACCOUNT_SID · TWILIO_AUTH_TOKEN · TWILIO_WHATSAPP_FROM</code>} hint="Variables de entorno Vercel" />
        </div>
        <p className="text-[11px] text-gray-400 mt-3">
          Las credenciales se gestionan como variables de entorno en Vercel para mantener la separación de secretos.
        </p>
      </section>

      {/* Widget config per app */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-card p-5 mb-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Configuración del widget</h2>
            <p className="text-xs text-gray-500 mt-0.5">Por aplicación. Sólo la landing renderiza el widget público.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedApp}
              onChange={(e) => setSelectedApp(e.target.value as AppSource)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
            >
              {APP_SOURCES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <button
              onClick={save}
              disabled={saving || loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            {savedAt && (
              <span className="flex items-center gap-1 text-[11px] text-green-700">
                <CheckCircle2 className="w-3.5 h-3.5" /> Guardado
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-8 flex items-center justify-center text-gray-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Cargando…
          </div>
        ) : (
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="rounded"
              />
              Widget habilitado para <strong>{selectedApp}</strong>
            </label>

            <TextField
              label="Mensaje de bienvenida"
              value={config.welcomeMessage}
              onChange={(v) => setConfig({ ...config, welcomeMessage: v })}
              multiline
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <TextField
                label="Número de WhatsApp (E.164)"
                placeholder="+34600000000"
                value={config.whatsappNumber ?? ''}
                onChange={(v) => setConfig({ ...config, whatsappNumber: v })}
              />
              <TextField
                label="URL aviso legal"
                placeholder="/legal/privacidad"
                value={config.legalNoticeUrl ?? ''}
                onChange={(v) => setConfig({ ...config, legalNoticeUrl: v })}
              />
            </div>

            {/* Quick replies */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Plantillas / Respuestas rápidas</h3>
                  <p className="text-[11px] text-gray-400">Botones mostrados al abrir el widget.</p>
                </div>
                <button
                  onClick={addReply}
                  className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" /> Añadir
                </button>
              </div>
              <div className="space-y-2">
                {config.quickReplies.map((q, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5"
                      placeholder="Etiqueta (visible)"
                      value={q.label}
                      onChange={(e) => updateReply(i, { label: e.target.value })}
                    />
                    <input
                      className="w-40 text-sm border border-gray-200 rounded-lg px-2 py-1.5 font-mono text-xs"
                      placeholder="payload"
                      value={q.payload}
                      onChange={(e) => updateReply(i, { payload: e.target.value })}
                    />
                    <button
                      onClick={() => removeReply(i)}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {config.quickReplies.length === 0 && (
                  <p className="text-[11px] text-gray-400 italic">Sin respuestas rápidas.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Recent conversations */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Conversaciones recientes</h2>
            <p className="text-xs text-gray-500 mt-0.5">Últimas 20 conversaciones en todo el ecosistema.</p>
          </div>
          <button
            onClick={loadConversations}
            className="text-xs text-brand-600 hover:text-brand-700 font-semibold"
          >
            Refrescar
          </button>
        </div>
        <div className="divide-y divide-gray-100">
          {conversations.length === 0 && (
            <p className="py-6 text-center text-xs text-gray-400">Sin conversaciones todavía.</p>
          )}
          {conversations.map((c) => (
            <div key={c.id} className="py-2.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-green-50 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-4 h-4 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">
                  {c.contact?.name || c.contact?.email || c.contact?.phone || 'Anónimo'}
                  <span className="ml-2 text-[10px] font-bold text-gray-400 uppercase">{c.appSource}</span>
                  {c.needsHuman && (
                    <span className="ml-2 text-[10px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded">HANDOFF</span>
                  )}
                </div>
                <div className="text-[11px] text-gray-400 truncate">
                  {c.intentDetected ? `intent: ${c.intentDetected} · ` : ''}
                  {c.messageCount} msgs · {new Date(c.createdAt).toLocaleString('es-ES')}
                </div>
              </div>
              <span className="text-[10px] font-bold text-gray-500 bg-gray-50 px-2 py-0.5 rounded">{c.status}</span>
            </div>
          ))}
        </div>
        <a
          href="https://impulsodent.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-brand-600"
        >
          <ExternalLink className="w-3 h-3" /> Ver widget en landing
        </a>
      </section>
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, color, bg }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string; value: string | number; color: string; bg: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-card p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
        <Icon style={{ width: 20, height: 20, color }} />
      </div>
      <div>
        <div className="text-xl font-bold text-gray-900">{value}</div>
        <div className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</div>
      </div>
    </div>
  )
}

function Field({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      <div>{value}</div>
      {hint && <div className="text-[10px] text-gray-400 mt-1">{hint}</div>}
    </div>
  )
}

function TextField({ label, value, onChange, multiline, placeholder }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</label>
      {multiline ? (
        <textarea
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 min-h-[64px]"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  )
}
