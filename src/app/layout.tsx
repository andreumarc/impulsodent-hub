import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ImpulsoDent — Suite de Aplicaciones',
  description: 'Portal central de acceso a todas las aplicaciones de la suite ImpulsoDent.',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
