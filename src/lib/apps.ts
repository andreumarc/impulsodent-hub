export type AppStatus = 'active' | 'beta' | 'coming_soon'

export interface AppDef {
  id: string
  name: string
  description: string
  icon: string
  color: string
  bgColor: string
  url: string
  status: AppStatus
  category: string
  badge?: string
}

export const APPS: AppDef[] = [
  {
    id: 'clinicpnl',
    name: 'ClinicPNL',
    description: 'Dashboard financiero con rentabilidad, EBITDA y KPIs por clínica.',
    icon: 'Activity',
    color: '#003A70',
    bgColor: '#e6eef7',
    url: process.env.NEXT_PUBLIC_URL_CLINICPNL || '#',
    status: 'active',
    category: 'Financiero',
  },
  {
    id: 'clinicvox',
    name: 'ClinicVox',
    description: 'Automatización de llamadas y confirmación de citas por voz.',
    icon: 'Phone',
    color: '#00A99D',
    bgColor: '#e0f7f6',
    url: process.env.NEXT_PUBLIC_URL_CLINICVOX || '#',
    status: 'active',
    category: 'Comunicación',
  },
  {
    id: 'dentalspot',
    name: 'DentalSpot',
    description: 'Gestión integral: agenda, tratamientos, presupuestos y stock.',
    icon: 'Stethoscope',
    color: '#2a6bb8',
    bgColor: '#dbeafe',
    url: process.env.NEXT_PUBLIC_URL_DENTALSPOT || '#',
    status: 'active',
    category: 'Clínica',
  },
  {
    id: 'dentalhr',
    name: 'DentalHR',
    description: 'Gestión de recursos humanos para clínicas dentales.',
    icon: 'UserCheck',
    color: '#059669',
    bgColor: '#d1fae5',
    url: process.env.NEXT_PUBLIC_URL_DENTALHR || '#',
    status: 'active',
    category: 'RRHH',
  },
  {
    id: 'fichaje',
    name: 'Fichajeshr',
    description: 'Control horario con geolocalización, kiosko y app móvil.',
    icon: 'Clock',
    color: '#16a34a',
    bgColor: '#dcfce7',
    url: process.env.NEXT_PUBLIC_URL_FICHAJE || '#',
    status: 'active',
    category: 'RRHH',
  },
  {
    id: 'spendflow',
    name: 'SpendFlow',
    description: 'Gastos corporativos, kilometraje y reembolsos tipo SAP Concur.',
    icon: 'Receipt',
    color: '#d97706',
    bgColor: '#fef3c7',
    url: process.env.NEXT_PUBLIC_URL_SPENDFLOW || '#',
    status: 'active',
    category: 'Gastos',
  },
  {
    id: 'zentrix',
    name: 'ZENTRIX',
    description: 'ERP cloud completo: facturación, contabilidad, CRM y RRHH.',
    icon: 'LayoutGrid',
    color: '#7c3aed',
    bgColor: '#ede9fe',
    url: process.env.NEXT_PUBLIC_URL_ZENTRIX || '#',
    status: 'active',
    category: 'ERP',
  },
  {
    id: 'nexuserp',
    name: 'NexusERP',
    description: 'CRM y ERP modular con ventas, compras, inventario y proyectos.',
    icon: 'Building2',
    color: '#4338ca',
    bgColor: '#e0e7ff',
    url: process.env.NEXT_PUBLIC_URL_NEXUSERP || '#',
    status: 'active',
    category: 'ERP',
  },
  {
    id: 'clinicrefunds',
    name: 'ClinicRefunds',
    description: 'Gestión de devoluciones y reembolsos para pacientes dentales.',
    icon: 'RefreshCcw',
    color: '#003A70',
    bgColor: '#e6eef7',
    url: process.env.NEXT_PUBLIC_URL_CLINICREFUNDS || '#',
    status: 'active',
    category: 'Financiero',
  },
  {
    id: 'dentalreports',
    name: 'DentalReports',
    description: 'Informes avanzados, comparativas y analítica para clínicas.',
    icon: 'BarChart3',
    color: '#0891b2',
    bgColor: '#cffafe',
    url: process.env.NEXT_PUBLIC_URL_DENTALREPORTS || '#',
    status: 'active',
    category: 'Financiero',
  },
]

export const CATEGORIES = ['Todos', ...Array.from(new Set(APPS.map((a) => a.category)))]
