import Link from 'next/link'
import { Building2, Plus, Users, LayoutGrid } from 'lucide-react'
import { listCompanies } from '@/lib/db'

export default async function CompaniesPage() {
  let companies: Awaited<ReturnType<typeof listCompanies>> = []
  try { companies = await listCompanies() } catch { /* no DB */ }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Empresas</h1>
          <p className="text-sm text-gray-500 mt-1">{companies.length} empresa{companies.length !== 1 ? 's' : ''} registrada{companies.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/admin/companies/new"
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva empresa
        </Link>
      </div>

      {companies.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-card p-12 text-center">
          <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">Aún no hay empresas</p>
          <p className="text-gray-400 text-xs mt-1 mb-4">Crea la primera empresa para comenzar</p>
          <Link href="/admin/companies/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-semibold rounded-lg hover:bg-brand-600 transition-colors">
            <Plus className="w-4 h-4" />
            Crear empresa
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs text-gray-400 font-semibold px-5 py-3">Empresa</th>
                <th className="text-left text-xs text-gray-400 font-semibold px-5 py-3 hidden md:table-cell">Slug</th>
                <th className="text-left text-xs text-gray-400 font-semibold px-5 py-3 hidden lg:table-cell">Email</th>
                <th className="text-left text-xs text-gray-400 font-semibold px-5 py-3">Estado</th>
                <th className="text-left text-xs text-gray-400 font-semibold px-5 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {companies.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-brand-50 flex-shrink-0">
                        <Building2 className="w-4 h-4 text-brand-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                        {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 hidden md:table-cell">
                    <code className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{c.slug}</code>
                  </td>
                  <td className="px-5 py-3 hidden lg:table-cell">
                    <span className="text-sm text-gray-600">{c.email || '—'}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${c.active ? 'text-green-700 bg-green-50' : 'text-gray-500 bg-gray-100'}`}>
                      {c.active ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/companies/${c.id}`}
                        className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium">
                        <Users className="w-3.5 h-3.5" />
                        Gestionar
                      </Link>
                      <span className="text-gray-200">|</span>
                      <Link href={`/admin/companies/${c.id}#apps`}
                        className="flex items-center gap-1.5 text-xs text-accent-600 hover:text-accent-700 font-medium">
                        <LayoutGrid className="w-3.5 h-3.5" />
                        Apps
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
