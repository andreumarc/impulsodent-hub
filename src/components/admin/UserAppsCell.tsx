import { APPS, type AppDef } from '@/lib/apps'

interface UserAppsCellProps {
  user: {
    id: string
    role: string
    app_roles?: Array<{ app_id: string; role: string }>
  }
  /** Optional click handler to open the drawer for this user. If absent, chips are passive. */
  onOpenDrawer?: (userId: string) => void
}

const PUBLIC_APPS = APPS.filter((a) => !a.internal)
const APP_BY_ID = new Map<string, AppDef>(PUBLIC_APPS.map((a) => [a.id, a]))

function abbrev(app: AppDef): string {
  return app.name.slice(0, 2).toUpperCase()
}

function sortApps(appIds: string[]): AppDef[] {
  const apps = appIds
    .map((id) => APP_BY_ID.get(id))
    .filter((a): a is AppDef => Boolean(a))
  return apps.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category)
    return a.name.localeCompare(b.name)
  })
}

function Chip({
  app, role, onClick,
}: {
  app: AppDef
  role?: string
  onClick?: () => void
}) {
  return (
    <span
      onClick={onClick}
      title={role ? `${app.name} · ${role}` : app.name}
      style={{
        width: 24, height: 24, background: app.bgColor, color: app.color,
      }}
      className={`inline-flex items-center justify-center rounded-md text-[10px] font-bold flex-shrink-0 ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
    >
      {abbrev(app)}
    </span>
  )
}

export function UserAppsCell({ user, onOpenDrawer }: UserAppsCellProps) {
  // Superadmin: implicit access to ALL non-internal apps
  if (user.role === 'superadmin') {
    return (
      <button
        type="button"
        onClick={() => onOpenDrawer?.(user.id)}
        title={`Acceso a todas las apps (rol superadmin)`}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-brand-100 text-brand-700 hover:bg-brand-200 transition-colors"
      >
        Todas
        <span className="opacity-60">({PUBLIC_APPS.length})</span>
      </button>
    )
  }

  const roles = user.app_roles ?? []
  if (roles.length === 0) {
    return <span className="text-sm text-gray-400">—</span>
  }

  const sorted = sortApps(roles.map((r) => r.app_id))
  const roleByApp = new Map(roles.map((r) => [r.app_id, r.role]))

  const visible = sorted.slice(0, 4)
  const overflow = sorted.slice(4)

  const overflowTitle = overflow
    .map((a) => `${a.name} · ${roleByApp.get(a.id) ?? ''}`)
    .join('\n')

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visible.map((app) => (
        <Chip
          key={app.id}
          app={app}
          role={roleByApp.get(app.id)}
          onClick={onOpenDrawer ? () => onOpenDrawer(user.id) : undefined}
        />
      ))}
      {overflow.length > 0 && (
        <span
          title={overflowTitle}
          onClick={onOpenDrawer ? () => onOpenDrawer(user.id) : undefined}
          className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-bold bg-gray-100 text-gray-500 ${onOpenDrawer ? 'cursor-pointer hover:bg-gray-200' : ''}`}
        >
          +{overflow.length}
        </span>
      )}
    </div>
  )
}
