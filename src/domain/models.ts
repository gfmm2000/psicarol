export type EntityId = string
export type IsoDateTime = string
export type PatientStatus = 'active' | 'archived'
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'
export type AppointmentModality = 'in_person' | 'online'
export type RoomStatus = 'active' | 'inactive'
export type PaymentMethodStatus = 'active' | 'inactive'

export interface Patient { id: EntityId; name: string; phone: string; email?: string; status: PatientStatus; createdAt: IsoDateTime; updatedAt: IsoDateTime }
export interface Appointment { id: EntityId; patientId: EntityId; roomId?: EntityId; startsAt: IsoDateTime; durationMinutes: number; modality: AppointmentModality; status: AppointmentStatus; agreedPriceCents: number; psychologistCommissionBps: number; clinicCommissionBps: number; createdAt: IsoDateTime; updatedAt: IsoDateTime }
export interface Room { id: EntityId; name: string; description?: string; status: RoomStatus }
export interface Payment { id: EntityId; appointmentId: EntityId; amountCents: number; paidAt: IsoDateTime; paymentMethodId: EntityId; administrativeNotes?: string }
export interface PaymentMethod { id: EntityId; name: string; status: PaymentMethodStatus }
export interface CommissionRule { id: EntityId; psychologistCommissionBps: number; clinicCommissionBps: number; validFrom: IsoDateTime; status: 'active' | 'inactive' }
export interface ApplicationSettings { id: 'application'; currency: 'EUR'; timeZone: 'Europe/Lisbon'; general: { defaultAppointmentDurationMinutes: number }; security: { autoLockMinutes: number; lockOnPageHidden: boolean } }

export interface AppointmentPaymentSummary { receivedCents: number; outstandingCents: number; status: 'unpaid' | 'partial' | 'paid' | 'overpaid' }
