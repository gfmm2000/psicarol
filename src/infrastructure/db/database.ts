import Dexie, { type Table } from 'dexie'
import type { CryptoMetadata } from '../crypto/types'

export interface StoredRecord { id: string; payload: string; pendingPayload?: string }
export interface StoredAppointment extends StoredRecord { patientId: string; roomId?: string }
export interface StoredPayment extends StoredRecord { appointmentId: string }

export class PracticeDatabase extends Dexie {
  patients!: Table<StoredRecord, string>
  appointments!: Table<StoredAppointment, string>
  rooms!: Table<StoredRecord, string>
  payments!: Table<StoredPayment, string>
  paymentMethods!: Table<StoredRecord, string>
  commissionRules!: Table<StoredRecord, string>
  settings!: Table<StoredRecord, string>
  cryptoMetadata!: Table<CryptoMetadata, 'crypto'>

  constructor(name = 'psicarol') {
    super(name)
    this.version(1).stores({ patients: '&id', appointments: '&id, patientId, roomId', rooms: '&id', payments: '&id, appointmentId', paymentMethods: '&id', commissionRules: '&id' })
    this.version(2).stores({ patients: '&id', appointments: '&id, patientId, roomId', rooms: '&id', payments: '&id, appointmentId', paymentMethods: '&id', commissionRules: '&id', settings: '&id' })
    this.version(3).stores({ patients: '&id', appointments: '&id, patientId, roomId', rooms: '&id', payments: '&id, appointmentId', paymentMethods: '&id', commissionRules: '&id', settings: '&id', cryptoMetadata: '&id' })
  }
}

export const database = new PracticeDatabase()
