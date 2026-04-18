import Link from 'next/link'
import { Users, Plus } from 'lucide-react'
import { listUsers } from '@/lib/db'

export default async function UsersPage() {
  let users: Awaited<ReturnType<typeof listUsers>> = []
  try { users = await listUsers() } catch { /* no DB */ }

  const ROLE_STYLES: Record<string, string> = {
    superadmin: 'text-purple-700 bg-purple-50',
    admin:      'text-blue-700 bg-blue-50',
    user:       'text-gray-600 bg-gray-100',
  }
  const ROLE_LABELS: Record<string, string> = {
    superadmin: 'Superadmin', admin: 'Administrador', user: 'Usuario',
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-sm text-gray-500 mt-1">{users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/admin/users/new"
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          Nuevo usuario
        </Link>
      </div>

      {users.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-card p-12 text-center">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">Aún no hay usuarios</p>
          <p className="text-gray-400 text-xs mt-1 mb-4">Crea el primer usuario de empresa</p>
          <Link href="/admin/users/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-semibold rounded-lg hover:bg-brand-600 transition-colors">
            <Plus className="w-4 h-4" />
            Crear usuario
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs text-gray-400 font-semibold px-5 py-3">Usuario</th>
                <th className="text-left text-xs text-gray-400 font-semibold px-5 py-3 hidden md:table-cell">Email</th>
                <th className="text-left text-xs text-gray-400 font-semibold px-5 py-3">Rol</th>
                <th className="text-left text-xs text-gray-400 font-semibold px-5 py-3 hidden lg:table-cell">Empresa</th>
                <th className="text-left text-xs text-gray-400 font-semibold px-5 py-3">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/60 transition-colors group">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0" style={{ background: '#0d9488' }}>
                        {u.name.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()}
                      </div>
                      <Link href={`/admin/users/${u.id}`} className="text-sm font-medium text-gray-900 hover:text-brand-600 hover:underline">
                        {u.name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-5 py-3 hidden md:table-cell">
                    <span className="text-sm text-gray-500">{u.email}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${ROLE_STYLES[u.role] ?? 'text-gray-600 bg-gray-100'}`}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3 hidden lg:table-cell">
                    {u.company ? (
                      <Link href={`/admin/companies/${u.company.id}`} className="text-sm text-brand-600 hover:underline font-medium">
                        {u.company.name}
                      </Link>
                    ) : <span className="text-sm text-gray-400">—</span>}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${u.active ? 'text-green-700 bg-green-50' : 'text-gray-500 bg-gray-100'}`}>
                      {u.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/admin/users/${u.id}`}
                      className="text-xs text-gray-400 hover:text-brand-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Editar
                    </Link>
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
