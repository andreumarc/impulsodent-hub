import Stripe from 'stripe'

const g = globalThis as unknown as { stripe?: Stripe }

export function getStripe(): Stripe {
  if (g.stripe) return g.stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY no está definida (hub)')
  const s = new Stripe(key, {
    apiVersion: '2026-03-25.dahlia',
    typescript: true,
    appInfo: { name: 'ImpulsoDent Hub Admin', version: '1.0.0' },
  })
  if (process.env.NODE_ENV !== 'production') g.stripe = s
  return s
}
