import { z } from 'zod'

const id = z.string().uuid()
const isoDateTime = z.string().datetime({ offset: true })
const cents = z.number().int().nonnegative()
const commissionBps = z.number().int().min(0).max(10_000)
const commissionRule = z.object({ psychologistCommissionBps: commissionBps, clinicCommissionBps: commissionBps }).refine(value => value.psychologistCommissionBps + value.clinicCommissionBps === 10_000, { message: 'As percentagens de comissão devem totalizar 100%.', path: ['clinicCommissionBps'] })

export const patientSchema = z.object({ id, name: z.string().trim().min(1).max(200), phone: z.string().trim().min(1).max(50), email: z.email().max(254).optional(), status: z.enum(['active', 'archived']), createdAt: isoDateTime, updatedAt: isoDateTime })
export const appointmentSchema = z.object({ id, patientId: id, roomId: id.optional(), startsAt: isoDateTime, durationMinutes: z.number().int().positive().max(480), modality: z.enum(['in_person', 'online']), status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']), agreedPriceCents: cents, createdAt: isoDateTime, updatedAt: isoDateTime }).and(commissionRule)
export const roomSchema = z.object({ id, name: z.string().trim().min(1).max(100), description: z.string().trim().max(500).optional(), status: z.enum(['active', 'inactive']) })
export const paymentSchema = z.object({ id, appointmentId: id, amountCents: cents.refine(value => value > 0, 'O pagamento deve ser superior a zero.'), paidAt: isoDateTime, paymentMethodId: id, administrativeNotes: z.string().trim().max(1000).optional() })
export const paymentMethodSchema = z.object({ id, name: z.string().trim().min(1).max(100), status: z.enum(['active', 'inactive']) })
export const commissionRuleSchema = z.object({ id, validFrom: isoDateTime, status: z.enum(['active', 'inactive']) }).and(commissionRule)
export const applicationSettingsSchema = z.object({ id: z.literal('application'), currency: z.literal('EUR'), timeZone: z.literal('Europe/Lisbon'), general: z.object({ defaultAppointmentDurationMinutes: z.number().int().positive().max(480) }), security: z.object({ autoLockMinutes: z.number().int().min(1).max(240), lockOnPageHidden: z.boolean() }) })
