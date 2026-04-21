import { Building2, Users, LayoutGrid, RefreshCw, Stethoscope } from 'lucide-react'
import { getAdminStats } from '@/lib/db'
import { getSession } from '@/lib/auth'
import Link from 'next/link'

export default async function AdminDashboardPage() {
  const session = await getSession()
  const isSuperadmin = session?.role === 'superadmin'
  let stats = { companies: 0, users: 0, appAccess: 0 }
  try { stats = await getAdminStats() } catch { /* Supabase not configured yet */ }

  const allCards = [
    { label: 'Empresas', value: stats.companies, icon: Building2, color: '#003A70', bg: '#e6eef7', href: '/admin/companies', superadminOnly: true },
    { label: 'Usuarios', value: stats.users, icon: Users, color: '#00A99D', bg: '#e0f7f6', href: '/admin/users' },
    { label: 'Permisos activos', value: stats.appAccess, icon: LayoutGrid, color: '#7c3aed', bg: '#ede9fe', href: '/admin/companies', superadminOnly: true },
  ]
  const cards = allCards.filter((c) => isSuperadmin || !c.superadminOnly)

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Panel de Administración</h1>
        <p className="text-sm text-gray-500 mt-1">Gestiona empresas, usuarios y acceso a aplicaciones</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="bg-white rounded-xl border border-gray-100 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all p-5 flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: card.bg }}>
              <card.icon style={{ width: 22, height: 22, color: card.color }} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-sm text-gray-500">{card.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-card p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Acciones rápidas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {isSuperadmin && (
            <Link href="/admin/companies/new"
              className="flex items-center gap-3 px-4 py-3 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors">
              <Building2 className="w-4 h-4" />
              Nueva empresa
            </Link>
          )}
          <Link href="/admin/users/new"
            className="flex items-center gap-3 px-4 py-3 bg-accent-500 text-white rounded-lg text-sm font-medium hover:bg-accent-600 transition-colors">
            <Users className="w-4 h-4" />
            Nuevo usuario
          </Link>
          <Link href="/admin/clinics"
            className="flex items-center gap-3 px-4 py-3 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
            <Stethoscope className="w-4 h-4" />
            Gestionar clínicas
          </Link>
          {isSuperadmin && (
            <>
              <Link href="/admin/apps"
                className="flex items-center gap-3 px-4 py-3 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                <LayoutGrid className="w-4 h-4" />
                Configurar apps
              </Link>
              <Link href="/admin/sync"
                className="flex items-center gap-3 px-4 py-3 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                <RefreshCw className="w-4 h-4" />
                Sincronizar apps
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Setup notice */}
      {!process.env.DATABASE_URL && (
        <div className="mt-6 flex items-start gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
          <span className="font-semibold">⚠️ Base de datos no configurada.</span>
          <span>Añade la variable <code className="font-mono bg-amber-100 px-1 rounded">DATABASE_URL</code> con tu cadena de conexión de Neon para activar la gestión de empresas y usuarios.</span>
        </div>
      )}
    </div>
  )
}
