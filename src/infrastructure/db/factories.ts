import type { Appointment, ApplicationSettings, CommissionRule, EntityId, Patient, Payment, PaymentMethod, Room } from '../../domain/models'

export const newId = (): EntityId => crypto.randomUUID()
const now = () => new Date().toISOString()
export function createPatient(input: Pick<Patient, 'name' | 'phone'> & Partial<Pick<Patient, 'email' | 'status'>>): Patient { const timestamp = now(); return { id: newId(), name: input.name, phone: input.phone, ...(input.email ? { email: input.email } : {}), status: input.status ?? 'active', createdAt: timestamp, updatedAt: timestamp } }
export function createAppointment(input: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>): Appointment { const timestamp = now(); return { ...input, id: newId(), createdAt: timestamp, updatedAt: timestamp } }
export function createRoom(input: Omit<Room, 'id'>): Room { return { ...input, id: newId() } }
export function createPayment(input: Omit<Payment, 'id'>): Payment { return { ...input, id: newId() } }
export function createPaymentMethod(input: Omit<PaymentMethod, 'id'>): PaymentMethod { return { ...input, id: newId() } }
export function createCommissionRule(input: Omit<CommissionRule, 'id'>): CommissionRule { return { ...input, id: newId() } }
export const defaultSettings = (): ApplicationSettings => ({ id: 'application', currency: 'EUR', timeZone: 'Europe/Lisbon', general: { defaultAppointmentDurationMinutes: 50 }, security: { autoLockMinutes: 10, lockOnPageHidden: true } })
