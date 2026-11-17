import type { AppointmentPaymentSummary } from './models'

export function paymentSummary(agreedPriceCents: number, paymentCents: number[]): AppointmentPaymentSummary {
  const receivedCents = paymentCents.reduce((total, amount) => total + amount, 0)
  const outstandingCents = Math.max(0, agreedPriceCents - receivedCents)
  return { receivedCents, outstandingCents, status: receivedCents === 0 ? 'unpaid' : receivedCents < agreedPriceCents ? 'partial' : receivedCents === agreedPriceCents ? 'paid' : 'overpaid' }
}
