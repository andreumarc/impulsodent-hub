import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://app.impulsodent.com'),
  applicationName: 'ImpulsoDent Hub',
  title: {
    default: 'ImpulsoDent Hub — Portal central de la suite dental',
    template: '%s | ImpulsoDent Hub',
  },
  description:
    'Accede a toda la suite ImpulsoDent desde un único portal SSO. ClinicPNL, Dental Report, DentalHR, Fichajes y más — un solo login para todas tus herramientas de gestión dental.',
  keywords: [
    'ImpulsoDent hub',
    'portal gestión dental',
    'SSO clínica dental',
    'suite dental ImpulsoDent',
    'acceso aplicaciones dentales',
    'software dental España',
    'ImpulsoDent',
  ],
  authors: [{ name: 'ImpulsoDent', url: 'https://impulsodent.com' }],
  creator: 'ImpulsoDent',
  robots: { index: false, follow: false },
  icons: { icon: '/favicon.ico' },
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    siteName: 'ImpulsoDent Hub',
    title: 'ImpulsoDent Hub — Portal central de la suite dental',
    description:
      'Un solo login para acceder a ClinicPNL, Dental Report, DentalHR, Fichajes y toda la suite de gestión dental ImpulsoDent.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'ImpulsoDent Hub — Portal central de aplicaciones dentales',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ImpulsoDent Hub — Portal central dental',
    description: 'Un solo login para toda la suite de gestión dental ImpulsoDent.',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
