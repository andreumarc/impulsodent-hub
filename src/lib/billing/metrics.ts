import type Stripe from 'stripe'
import { stripe } from './stripe'

export interface BillingMetrics {
  activeSubscriptions: number
  trialingSubscriptions: number
  pastDueSubscriptions: number
  canceledThisMonth: number
  mrrCents: number
  arrCents: number
  currency: string
  paidInvoicesLast30dCents: number
  failedInvoicesLast30d: number
}

interface SubRow {
  id: string
  customer: { id: string; email: string | null; name: string | null }
  status: Stripe.Subscription.Status
  planKey: string
  interval: 'monthly' | 'yearly' | 'unknown'
  amountCents: number
  currency: string
  currentPeriodEnd: number | null
  cancelAtPeriodEnd: boolean
  createdAt: number
}

interface InvoiceRow {
  id: string
  number: string | null
  status: Stripe.Invoice.Status | 'open'
  amountPaidCents: number
  amountDueCents: number
  currency: string
  customerEmail: string | null
  customerId: string | null
  hostedInvoiceUrl: string | null
  invoicePdf: string | null
  created: number
}

const monthlyFactor = (interval: Stripe.Price.Recurring['interval']) => {
  switch (interval) {
    case 'month':
      return 1
    case 'year':
      return 1 / 12
    case 'week':
      return 52 / 12
    case 'day':
      return 365 / 12
    default:
      return 1
  }
}

async function listAllSubscriptions(): Promise<Stripe.Subscription[]> {
  const all: Stripe.Subscription[] = []
  let starting_after: string | undefined
  for (let i = 0; i < 20; i++) {
    const page = await stripe.subscriptions.list({
      status: 'all',
      limit: 100,
      starting_after,
      expand: ['data.customer'],
    })
    all.push(...page.data)
    if (!page.has_more) break
    starting_after = page.data[page.data.length - 1]?.id
  }
  return all
}

export function toSubRow(sub: Stripe.Subscription): SubRow {
  const item = sub.items.data[0]
  const price = item?.price
  const recurring = price?.recurring
  const amount = (price?.unit_amount ?? 0) * (item?.quantity ?? 1)
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const customerObj = typeof sub.customer === 'string' ? null : (sub.customer as Stripe.Customer)
  const interval: SubRow['interval'] =
    recurring?.interval === 'month'
      ? 'monthly'
      : recurring?.interval === 'year'
      ? 'yearly'
      : 'unknown'
  return {
    id: sub.id,
    customer: {
      id: customerId,
      email: customerObj?.email ?? null,
      name: customerObj?.name ?? null,
    },
    status: sub.status,
    planKey: (sub.metadata?.planKey as string) ?? (price?.nickname ?? 'n/a'),
    interval,
    amountCents: amount,
    currency: (price?.currency ?? 'eur').toLowerCase(),
    currentPeriodEnd: (item as any)?.current_period_end ?? null,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    createdAt: sub.created,
  }
}

export async function getBillingOverview(): Promise<{
  metrics: BillingMetrics
  subscriptions: SubRow[]
  invoices: InvoiceRow[]
}> {
  const subs = await listAllSubscriptions()
  const now = Date.now() / 1000
  const thirtyDays = 30 * 24 * 60 * 60
  const startOfMonth = new Date()
  startOfMonth.setUTCDate(1)
  startOfMonth.setUTCHours(0, 0, 0, 0)
  const startOfMonthSec = Math.floor(startOfMonth.getTime() / 1000)

  let mrrCents = 0
  let active = 0
  let trialing = 0
  let pastDue = 0
  let canceledThisMonth = 0

  for (const sub of subs) {
    if (sub.status === 'active' || sub.status === 'trialing') {
      for (const item of sub.items.data) {
        const rec = item.price.recurring
        if (!rec) continue
        const perMonth = (item.price.unit_amount ?? 0) * (item.quantity ?? 1) * monthlyFactor(rec.interval)
        mrrCents += perMonth
      }
    }
    if (sub.status === 'active') active++
    else if (sub.status === 'trialing') trialing++
    else if (sub.status === 'past_due' || sub.status === 'unpaid') pastDue++
    if (sub.canceled_at && sub.canceled_at >= startOfMonthSec) canceledThisMonth++
  }

  const invoicePage = await stripe.invoices.list({
    limit: 50,
    created: { gte: Math.floor(now - thirtyDays) },
    expand: ['data.customer'],
  })

  let paidInvoicesLast30dCents = 0
  let failedInvoicesLast30d = 0
  const invoices: InvoiceRow[] = invoicePage.data.map((inv) => {
    if (inv.status === 'paid') paidInvoicesLast30dCents += inv.amount_paid ?? 0
    if (inv.status === 'uncollectible' || inv.status === 'open' && (inv as any).attempt_count > 0) {
      // heuristic for failed
    }
    const cust = typeof inv.customer === 'string' ? null : (inv.customer as Stripe.Customer | null)
    return {
      id: inv.id!,
      number: inv.number ?? null,
      status: inv.status ?? 'open',
      amountPaidCents: inv.amount_paid ?? 0,
      amountDueCents: inv.amount_due ?? 0,
      currency: (inv.currency ?? 'eur').toLowerCase(),
      customerEmail: cust?.email ?? inv.customer_email ?? null,
      customerId: typeof inv.customer === 'string' ? inv.customer : cust?.id ?? null,
      hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
      invoicePdf: inv.invoice_pdf ?? null,
      created: inv.created,
    }
  })
  failedInvoicesLast30d = invoices.filter((i) => i.status === 'open' || i.status === 'uncollectible').length

  const metrics: BillingMetrics = {
    activeSubscriptions: active,
    trialingSubscriptions: trialing,
    pastDueSubscriptions: pastDue,
    canceledThisMonth,
    mrrCents: Math.round(mrrCents),
    arrCents: Math.round(mrrCents * 12),
    currency: 'eur',
    paidInvoicesLast30dCents,
    failedInvoicesLast30d,
  }

  const subscriptions = subs
    .map(toSubRow)
    .sort((a, b) => b.createdAt - a.createdAt)

  return { metrics, subscriptions, invoices }
}
