'use client'

import { useState } from 'react'
import {
  User, Lock, Stethoscope, Building2, LayoutGrid,
  Eye, EyeOff, CheckCircle, AlertCircle, ExternalLink,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileClinic {
  id: string
  name: string
  app_id: string
  active: boolean
}

interface ProfileAppRole {
  app_id: string
  role: string
}

interface ProfileCompany {
  id: string
  name: string
  slug: string
  city: string | null
  email: string | null
  phone: string | null
}

interface ProfileUser {
  id: string
  name: string
  email: string
  role: string
  active: boolean
  clinic_access_all: boolean
  subscription_plan: string
  created_at: Date | string
  company: ProfileCompany | null
  clinicAccess: { clinic: ProfileClinic }[]
  appRoles: ProfileAppRole[]
}

interface ProfileTabsProps {
  user: ProfileUser
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'datos', label: 'Datos', icon: User },
  { key: 'password', label: 'Contraseña', icon: Lock },
  { key: 'clinicas', label: 'Clínicas', icon: Stethoscope },
  { key: 'empresa', label: 'Empresa', icon: Building2 },
  { key: 'apps', label: 'Aplicaciones', icon: LayoutGrid },
] as const

type TabKey = (typeof TABS)[number]['key']

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Superadministrador',
  admin: 'Administrador',
  director: 'Director/a',
  user: 'Usuario',
}

const APP_ID_LABELS: Record<string, string> = {
  clinicpnl: 'ClinicPNL',
  clinicvox: 'ClinicVox',
  dentalspot: 'DentalSpot',
  dentalhr: 'DentalHR',
  fichaje: 'Fichajeshr',
  spendflow: 'SpendFlow',
  zentrix: 'ZENTRIX',
  nexuserp: 'NexusERP',
  clinicrefunds: 'ClinicRefunds',
  dentalreports: 'DentalReports',
  nexora: 'Nexora',
  integrations: 'Integraciones',
}

// Apps shown in the grid (Tab Aplicaciones), matching APPS in lib/apps.ts
const IMPULSODENT_APPS = [
  { id: 'clinicpnl',     name: 'ClinicPNL',      desc: 'Dashboard financiero con rentabilidad y KPIs',       color: '#003A70', bg: '#e6eef7', urlEnv: 'NEXT_PUBLIC_URL_CLINICPNL' },
  { id: 'clinicvox',     name: 'ClinicVox',       desc: 'Automatización de llamadas y citas por voz',        color: '#00A99D', bg: '#e0f7f6', urlEnv: 'NEXT_PUBLIC_URL_CLINICVOX' },
  { id: 'dentalspot',    name: 'DentalSpot',      desc: 'Agenda, tratamientos, presupuestos y stock',        color: '#2a6bb8', bg: '#dbeafe', urlEnv: 'NEXT_PUBLIC_URL_DENTALSPOT' },
  { id: 'dentalhr',      name: 'DentalHR',        desc: 'Recursos humanos para clínicas dentales',           color: '#059669', bg: '#d1fae5', urlEnv: 'NEXT_PUBLIC_URL_DENTALHR' },
  { id: 'fichaje',       name: 'Fichajeshr',      desc: 'Control horario con geolocalización y app móvil',   color: '#16a34a', bg: '#dcfce7', urlEnv: 'NEXT_PUBLIC_URL_FICHAJE' },
  { id: 'spendflow',     name: 'SpendFlow',       desc: 'Gastos corporativos y reembolsos tipo SAP Concur',  color: '#d97706', bg: '#fef3c7', urlEnv: 'NEXT_PUBLIC_URL_SPENDFLOW' },
  { id: 'zentrix',       name: 'ZENTRIX',         desc: 'ERP cloud: facturación, contabilidad y CRM',        color: '#7c3aed', bg: '#ede9fe', urlEnv: 'NEXT_PUBLIC_URL_ZENTRIX' },
  { id: 'nexuserp',      name: 'NexusERP',        desc: 'CRM y ERP modular con ventas e inventario',         color: '#4338ca', bg: '#e0e7ff', urlEnv: 'NEXT_PUBLIC_URL_NEXUSERP' },
  { id: 'clinicrefunds', name: 'ClinicRefunds',   desc: 'Gestión de devoluciones y reembolsos dentales',     color: '#003A70', bg: '#e6eef7', urlEnv: 'NEXT_PUBLIC_URL_CLINICREFUNDS' },
  { id: 'dentalreports', name: 'DentalReports',   desc: 'Informes avanzados y analítica para clínicas',      color: '#0891b2', bg: '#cffafe', urlEnv: 'NEXT_PUBLIC_URL_DENTALREPORTS' },
  { id: 'nexora',        name: 'Nexora',          desc: 'Comunicación interna: chat, anuncios y documentos', color: '#7c3aed', bg: '#ede9fe', urlEnv: 'NEXT_PUBLIC_URL_NEXORA' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

function formatDate(dateVal: Date | string): string {
  const d = new Date(dateVal)
  return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Alert({ type, message }: { type: 'success' | 'error'; message: string }) {
  return (
    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-lg text-sm border ${
      type === 'success'
        ? 'bg-green-50 border-green-200 text-green-700'
        : 'bg-red-50 border-red-200 text-red-700'
    }`}>
      {type === 'success'
        ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
        : <AlertCircle className="w-4 h-4 flex-shrink-0" />
      }
      {message}
    </div>
  )
}

// ─── Tab: Datos ───────────────────────────────────────────────────────────────

function TabDatos({ user }: { user: ProfileUser }) {
  const [name, setName] = useState(user.name)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setFeedback(null)
    setLoading(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFeedback({ type: 'error', msg: data.error || 'Error al guardar' })
      } else {
        setFeedback({ type: 'success', msg: 'Nombre actualizado correctamente' })
      }
    } catch {
      setFeedback({ type: 'error', msg: 'Error de conexión' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {feedback && <Alert type={feedback.type} message={feedback.msg} />}

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Nombre completo</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-400 focus:border-transparent"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Email</label>
        <input
          type="email"
          value={user.email}
          disabled
          className="w-full px-3 py-2 text-sm border border-gray-100 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed"
        />
        <p className="text-xs text-gray-400">El email no se puede cambiar desde aquí.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Rol</label>
          <div className="flex items-center h-9">
            <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-md bg-brand-50 text-brand-700 uppercase tracking-wide">
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Estado</label>
          <div className="flex items-center h-9 gap-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${user.active ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span className="text-sm text-gray-700">{user.active ? 'Activo' : 'Inactivo'}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Plan de suscripción</label>
          <div className="flex items-center h-9">
            <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-md bg-accent-50 text-accent-700 capitalize">
              {user.subscription_plan}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Miembro desde</label>
          <div className="flex items-center h-9">
            <span className="text-sm text-gray-600">{formatDate(user.created_at)}</span>
          </div>
        </div>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
        >
          {loading ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}

// ─── Tab: Contraseña ─────────────────────────────────────────────────────────

function TabPassword() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFeedback(null)

    if (form.newPassword !== form.confirmPassword) {
      setFeedback({ type: 'error', msg: 'Las contraseñas nuevas no coinciden' })
      return
    }
    if (form.newPassword.length < 8) {
      setFeedback({ type: 'error', msg: 'La nueva contraseña debe tener mínimo 8 caracteres' })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFeedback({ type: 'error', msg: data.error || 'Error al cambiar la contraseña' })
      } else {
        setFeedback({ type: 'success', msg: 'Contraseña actualizada correctamente' })
        setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      }
    } catch {
      setFeedback({ type: 'error', msg: 'Error de conexión' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      {feedback && <Alert type={feedback.type} message={feedback.msg} />}

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Contraseña actual *</label>
        <div className="relative">
          <input
            required
            type={showCurrent ? 'text' : 'password'}
            value={form.currentPassword}
            onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
            placeholder="••••••••"
            className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-400 focus:border-transparent"
          />
          <button
            type="button"
            onClick={() => setShowCurrent(!showCurrent)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Nueva contraseña *</label>
        <div className="relative">
          <input
            required
            type={showNew ? 'text' : 'password'}
            value={form.newPassword}
            onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
            placeholder="Mínimo 8 caracteres"
            className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-400 focus:border-transparent"
          />
          <button
            type="button"
            onClick={() => setShowNew(!showNew)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Confirmar nueva contraseña *</label>
        <input
          required
          type="password"
          value={form.confirmPassword}
          onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
          placeholder="Repite la nueva contraseña"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-400 focus:border-transparent"
        />
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
        >
          {loading ? 'Actualizando…' : 'Cambiar contraseña'}
        </button>
      </div>
    </form>
  )
}

// ─── Tab: Clínicas ────────────────────────────────────────────────────────────

function TabClinicas({ user }: { user: ProfileUser }) {
  const clinics = user.clinicAccess.map((ca) => ca.clinic)

  if (user.clinic_access_all) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-md bg-green-50 text-green-700">
            Acceso a todas las clínicas
          </span>
        </div>
        <p className="text-sm text-gray-500">
          Tu cuenta tiene acceso completo a todas las clínicas de tu empresa.
        </p>
      </div>
    )
  }

  if (clinics.length === 0) {
    return (
      <div className="text-center py-10">
        <Stethoscope className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <p className="text-sm font-medium text-gray-500">Sin clínicas asignadas</p>
        <p className="text-xs text-gray-400 mt-1">
          Contacta con tu administrador para que te asigne acceso a clínicas.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400 mb-3">
        Clínicas a las que tienes acceso ({clinics.length})
      </p>
      {clinics.map((clinic) => (
        <div
          key={clinic.id}
          className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-100 bg-white hover:border-gray-200 transition-colors"
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: '#e0f7f6' }}
          >
            <Stethoscope className="w-4 h-4" style={{ color: '#00A99D' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{clinic.name}</p>
            <p className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">
              {APP_ID_LABELS[clinic.app_id] ?? clinic.app_id}
            </p>
          </div>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${clinic.active ? 'bg-green-400' : 'bg-gray-300'}`} />
        </div>
      ))}
    </div>
  )
}

// ─── Tab: Empresa ─────────────────────────────────────────────────────────────

function TabEmpresa({ company }: { company: ProfileCompany | null }) {
  if (!company) {
    return (
      <div className="text-center py-10">
        <Building2 className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <p className="text-sm font-medium text-gray-500">Sin empresa asignada</p>
        <p className="text-xs text-gray-400 mt-1">
          Contacta con tu administrador para que te asigne a una empresa.
        </p>
      </div>
    )
  }

  const fields = [
    { label: 'Nombre', value: company.name },
    { label: 'Identificador', value: company.slug },
    { label: 'Ciudad', value: company.city },
    { label: 'Email de contacto', value: company.email },
    { label: 'Teléfono', value: company.phone },
  ]

  return (
    <div className="space-y-3">
      {fields.map((f) => (
        <div key={f.label} className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-4 py-2.5 border-b border-gray-50 last:border-0">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider sm:w-36 flex-shrink-0">
            {f.label}
          </span>
          <span className="text-sm text-gray-800">{f.value ?? <span className="text-gray-300 italic">—</span>}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Tab: Aplicaciones ────────────────────────────────────────────────────────

function TabApps({ appRoles }: { appRoles: ProfileAppRole[] }) {
  const roleMap = Object.fromEntries(appRoles.map((r) => [r.app_id, r.role]))

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {IMPULSODENT_APPS.map((app) => {
        const myRole = roleMap[app.id]
        return (
          <div
            key={app.id}
            className="flex flex-col gap-3 p-4 rounded-xl border border-gray-100 bg-white hover:border-gray-200 hover:shadow-card transition-all"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
                style={{ background: app.bg, color: app.color }}
              >
                {app.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{app.name}</p>
                {myRole ? (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: app.bg, color: app.color }}>
                    {myRole}
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-400">Sin acceso</span>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed flex-1">{app.desc}</p>
            <a
              href={`/api/auth/launch?app=${app.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                myRole
                  ? 'text-white hover:opacity-90'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none'
              }`}
              style={myRole ? { background: app.color } : undefined}
            >
              <ExternalLink className="w-3 h-3" />
              {myRole ? 'Abrir' : 'Sin acceso'}
            </a>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProfileTabs({ user }: ProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('datos')

  return (
    <div className="animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
          style={{ background: '#00A99D' }}
        >
          {getInitials(user.name)}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
          <p className="text-sm text-gray-500">{user.email}</p>
          <span className="inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-brand-50 text-brand-700">
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
        </div>
      </div>

      {/* Tab pills */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-brand-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-300 hover:text-brand-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-card p-6">
        {activeTab === 'datos' && <TabDatos user={user} />}
        {activeTab === 'password' && <TabPassword />}
        {activeTab === 'clinicas' && <TabClinicas user={user} />}
        {activeTab === 'empresa' && <TabEmpresa company={user.company} />}
        {activeTab === 'apps' && <TabApps appRoles={user.appRoles} />}
      </div>
    </div>
  )
}
