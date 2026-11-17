import type { Table } from 'dexie'
import type { z } from 'zod'
import type { Appointment, ApplicationSettings, CommissionRule, EntityId, Patient, Payment, PaymentMethod, Room } from '../../domain/models'
import { appointmentSchema, applicationSettingsSchema, commissionRuleSchema, patientSchema, paymentMethodSchema, paymentSchema, roomSchema } from '../../domain/validation'
import type { RecordCodec, RecordContext } from './codec'
import type { PracticeDatabase, StoredRecord } from './database'
import { EncryptedBackupService } from './encrypted-backup'
type Schema<T> = z.ZodType<T>
class EntityRepository<T extends { id: string }> {
  private readonly table: Table<StoredRecord, string>; private readonly schema: Schema<T>; private readonly codec: RecordCodec; private readonly tableName: string
  constructor(table: Table<StoredRecord, string>, schema: Schema<T>, codec: RecordCodec, tableName: string) { this.table = table; this.schema = schema; this.codec = codec; this.tableName = tableName }
  private context(id: string): RecordContext { return { table: this.tableName, id } }
  async put(entity: T): Promise<void> { const value = this.schema.parse(entity); await this.table.put({ id: value.id, payload: await this.codec.encode(value, this.context(value.id)) }) }
  async get(id: EntityId): Promise<T | undefined> { const record = await this.table.get(id); return record ? this.schema.parse(await this.codec.decode<T>(record.payload, this.context(id))) : undefined }
  async all(): Promise<T[]> { return Promise.all((await this.table.toArray()).map(async record => this.schema.parse(await this.codec.decode<T>(record.payload, this.context(record.id))))) }
}
export class PracticeRepositories {
  readonly patients: EntityRepository<Patient>; readonly rooms: EntityRepository<Room>; readonly paymentMethods: EntityRepository<PaymentMethod>; readonly commissionRules: EntityRepository<CommissionRule>; readonly settings: EntityRepository<ApplicationSettings>; readonly backups: EncryptedBackupService; private readonly db: PracticeDatabase; private readonly codec: RecordCodec
  constructor(db: PracticeDatabase, codec: RecordCodec) { this.db = db; this.codec = codec; this.patients = new EntityRepository(db.patients, patientSchema, codec, 'patients'); this.rooms = new EntityRepository(db.rooms, roomSchema, codec, 'rooms'); this.paymentMethods = new EntityRepository(db.paymentMethods, paymentMethodSchema, codec, 'paymentMethods'); this.commissionRules = new EntityRepository(db.commissionRules, commissionRuleSchema, codec, 'commissionRules'); this.settings = new EntityRepository(db.settings, applicationSettingsSchema, codec, 'settings'); this.backups = new EncryptedBackupService(db, codec) }
  async putAppointment(appointment: Appointment): Promise<void> { const value = appointmentSchema.parse(appointment); await this.db.appointments.put({ id: value.id, payload: await this.codec.encode(value, { table: 'appointments', id: value.id }) }) }
  async getAppointment(id: EntityId): Promise<Appointment | undefined> { const record = await this.db.appointments.get(id); return record ? appointmentSchema.parse(await this.codec.decode<Appointment>(record.payload, { table: 'appointments', id })) : undefined }
  async allAppointments(): Promise<Appointment[]> { return Promise.all((await this.db.appointments.toArray()).map(async record => appointmentSchema.parse(await this.codec.decode<Appointment>(record.payload, { table: 'appointments', id: record.id })))) }
  async appointmentsForPatient(patientId: EntityId): Promise<Appointment[]> { return (await this.allAppointments()).filter(appointment => appointment.patientId === patientId) }
  async putPayment(payment: Payment): Promise<void> { const value = paymentSchema.parse(payment); await this.db.payments.put({ id: value.id, payload: await this.codec.encode(value, { table: 'payments', id: value.id }) }) }
  async allPayments(): Promise<Payment[]> { return Promise.all((await this.db.payments.toArray()).map(async record => paymentSchema.parse(await this.codec.decode<Payment>(record.payload, { table: 'payments', id: record.id })))) }
  async paymentsForAppointment(appointmentId: EntityId): Promise<Payment[]> { return (await this.allPayments()).filter(payment => payment.appointmentId === appointmentId) }
}
