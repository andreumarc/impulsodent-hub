'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, Users, Shield, TrendingUp, Eye, EyeOff } from 'lucide-react'
import { BrandLogo } from '@/components/common/BrandLogo'

const FEATURES = [
  { icon: BarChart3, label: 'Analítica financiera en tiempo real' },
  { icon: Users, label: 'Gestión centralizada de equipos' },
  { icon: Shield, label: 'Acceso seguro y con roles' },
  { icon: TrendingUp, label: 'KPIs y reportes automáticos' },
]

export default function LoginPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    startTransition(async () => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
        const data = await res.json()

        if (!res.ok) {
          setError(data.error || 'Error al iniciar sesión')
          return
        }

        router.push('/')
        router.refresh()
      } catch {
        setError('Error de conexión. Inténtalo de nuevo.')
      }
    })
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ─────────────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-10 relative overflow-hidden"
        style={{ background: '#003A70' }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }} />
        <div className="absolute -bottom-32 -right-16 w-[500px] h-[500px] rounded-full" style={{ background: 'rgba(255,255,255,0.03)' }} />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 rounded-full" style={{ background: 'rgba(0,169,157,0.08)' }} />

        {/* Brand logo */}
        <div className="relative z-10">
          <BrandLogo variant="light" size="lg" subtitle="Suite de Aplicaciones" />
        </div>

        {/* Headline */}
        <div className="relative z-10 space-y-4">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Toda tu clínica,<br />
            <span style={{ color: '#26c6bf' }}>en un solo lugar.</span>
          </h1>
          <p className="text-base" style={{ color: '#8ba8c0' }}>
            Accede a todas las herramientas de la suite ImpulsoDent desde un único panel.
          </p>

          {/* Feature cards */}
          <div className="grid grid-cols-2 gap-3 mt-6">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="rounded-xl px-4 py-3 flex items-center gap-3"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', backdropFilter: 'blur(4px)' }}
              >
                <Icon style={{ width: 18, height: 18, color: '#26c6bf', flexShrink: 0 }} />
                <span className="text-white text-xs font-medium leading-tight">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs relative z-10" style={{ color: '#3d5a75' }}>
          © {new Date().getFullYear()} ImpulsoDent · Todos los derechos reservados
        </p>
      </div>

      {/* ── Right panel ────────────────────────────────────────────── */}
      <div className="flex-1 bg-white flex flex-col items-center justify-center p-6 sm:p-10">
        {/* Mobile logo */}
        <div className="flex lg:hidden mb-8">
          <BrandLogo variant="dark" size="lg" />
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold" style={{ color: '#003A70' }}>Iniciar sesión</h2>
            <p className="text-sm text-gray-500 mt-1">Accede a la suite de aplicaciones ImpulsoDent</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent bg-white transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700" htmlFor="password">Contraseña</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 pr-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent bg-white transition-colors"
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2.5 px-4 text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              style={{ background: '#003A70' }}
              onMouseEnter={(e) => { if (!isPending) e.currentTarget.style.background = '#003263' }}
              onMouseLeave={(e) => { if (!isPending) e.currentTarget.style.background = '#003A70' }}
            >
              {isPending ? 'Iniciando sesión…' : 'Iniciar sesión'}
            </button>
          </form>

          <p className="text-xs text-gray-400 mt-8 text-center">
            ¿Problemas para acceder?{' '}
            <a href="mailto:soporte@impulsodent.com" className="text-brand-500 hover:underline font-medium">
              Contacta con soporte
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
