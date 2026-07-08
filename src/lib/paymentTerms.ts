import type { Approval, Payment } from '../types'

function addPeriod(base: Date, unit: 'day' | 'week' | 'month', count: number): Date {
  const result = new Date(base)
  if (unit === 'day') result.setDate(result.getDate() + count)
  else if (unit === 'week') result.setDate(result.getDate() + count * 7)
  else result.setMonth(result.getMonth() + count)
  return result
}

/** The first payment due date — one cadence period after the deal was approved. */
export function estimatedEndDate(
  a: Pick<Approval, 'decided_at' | 'payment_period_unit' | 'payment_period_count'>
): Date | null {
  if (!a.decided_at || !a.payment_period_unit || !a.payment_period_count) return null
  return addPeriod(new Date(a.decided_at), a.payment_period_unit, a.payment_period_count)
}

/**
 * The next payment due date, given the deal's recurring cadence and any
 * payments already recorded — one cadence period after the most recent
 * payment, or after the approval date if nothing's been paid yet.
 */
export function nextDueDate(
  a: Pick<Approval, 'decided_at' | 'payment_period_unit' | 'payment_period_count'>,
  payments: Pick<Payment, 'paid_at'>[]
): Date | null {
  if (!a.decided_at || !a.payment_period_unit || !a.payment_period_count) return null

  const lastPaidAt = payments.length
    ? new Date(Math.max(...payments.map((p) => new Date(p.paid_at).getTime())))
    : new Date(a.decided_at)

  return addPeriod(lastPaidAt, a.payment_period_unit, a.payment_period_count)
}

export function formatPaymentTerms(
  a: Pick<Approval, 'payment_period_unit' | 'payment_period_count'>
): string | null {
  if (!a.payment_period_unit || !a.payment_period_count) return null
  return `Every ${a.payment_period_count} ${a.payment_period_unit}${a.payment_period_count === 1 ? '' : 's'}`
}
