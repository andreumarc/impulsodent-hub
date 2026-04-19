import {
  Activity, Phone, Stethoscope, UserCheck, Clock, Receipt,
  LayoutGrid, Building2, BarChart3, MessageSquare, ArrowUpRight,
} from 'lucide-react'
import type { AppDef } from '@/lib/apps'

const ICON_MAP: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  Activity,
  Phone,
  Stethoscope,
  UserCheck,
  Clock,
  Receipt,
  LayoutGrid,
  Building2,
  BarChart3,
  MessageSquare,
}

interface AppCardProps {
  app: AppDef
}

const STATUS_STYLES: Record<string, string> = {
  active:      'text-green-700 bg-green-50',
  beta:        'text-amber-700 bg-amber-50',
  coming_soon: 'text-gray-600 bg-gray-100',
}

const STATUS_LABELS: Record<string, string> = {
  active:      'Activo',
  beta:        'Beta',
  coming_soon: 'Próximamente',
}

export default function AppCard({ app }: AppCardProps) {
  const Icon = ICON_MAP[app.icon] ?? Activity
  const isDisabled = app.status === 'coming_soon' || app.url === '#'

  const cardContent = (
    <>
      {/* Icon */}
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: app.bgColor }}
      >
        <Icon style={{ width: 24, height: 24, color: app.color }} />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-sm font-semibold text-gray-900 truncate">{app.name}</h3>
          {!isDisabled && (
            <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-brand-500 transition-colors flex-shrink-0 mt-0.5" />
          )}
        </div>
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{app.description}</p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          {app.category}
        </span>
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${STATUS_STYLES[app.status]}`}
        >
          {STATUS_LABELS[app.status]}
        </span>
      </div>
    </>
  )

  if (isDisabled) {
    return (
      <div className="group bg-white rounded-xl border border-gray-100 shadow-card p-5 flex flex-col gap-3 opacity-60 cursor-not-allowed">
        {cardContent}
      </div>
    )
  }

  return (
    <a
      href={app.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group bg-white rounded-xl border border-gray-100 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 p-5 flex flex-col gap-3 cursor-pointer"
    >
      {cardContent}
    </a>
  )
}
