import type { Table } from 'dexie'
import { z } from 'zod'
import type { Appointment, Payment } from '../../domain/models'
import { appointmentSchema, applicationSettingsSchema, commissionRuleSchema, patientSchema, paymentMethodSchema, paymentSchema, roomSchema } from '../../domain/validation'
import { deriveKey, encodeSalt, validKdfParameters } from '../crypto/key-derivation'
import { KDF_V1, type EncryptedPayloadV1 } from '../crypto/types'
import { aadFor, decryptJson, encryptJson, randomBytes } from '../crypto/web-crypto'
import type { RecordCodec } from './codec'
import type { PracticeDatabase, StoredRecord } from './database'

const format = 'psicarol-encrypted-backup'
const tableNames = ['patients', 'appointments', 'rooms', 'payments', 'paymentMethods', 'commissionRules', 'settings'] as const
type DataTable = typeof tableNames[number]
type BackupRecord = { id: string; value: unknown }
type BackupRecords = Record<DataTable, BackupRecord[]>
const schemas = { patients: patientSchema, appointments: appointmentSchema, rooms: roomSchema, payments: paymentSchema, paymentMethods: paymentMethodSchema, commissionRules: commissionRuleSchema, settings: applicationSettingsSchema }
const idSchema = z.string().uuid()
const maxRecordsPerTable = 50_000
const backupAad = aadFor('backups', 'v1')

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isEncryptedPayload(value: unknown): value is EncryptedPayloadV1 {
  return isObject(value) && value.cryptoVersion === 1 && typeof value.iv === 'string' && typeof value.ciphertext === 'string'
}

function assertPassphrase(value: string): void {
  if (value.length < 12 || value.length > 1024) throw new Error('A palavra-passe do backup deve ter entre 12 e 1024 caracteres.')
}

function validateRelations(records: BackupRecords): void {
  const patientIds = new Set(records.patients.map(record => record.id))
  const roomIds = new Set(records.rooms.map(record => record.id))
  const appointmentIds = new Set(records.appointments.map(record => record.id))
  const methodIds = new Set(records.paymentMethods.map(record => record.id))
  for (const record of records.appointments) {
    const appointment = record.value as Appointment
    if (!patientIds.has(appointment.patientId) || (appointment.roomId && !roomIds.has(appointment.roomId))) throw new Error('O backup contém referências inválidas.')
  }
  for (const record of records.payments) {
    const payment = record.value as Payment
    if (!appointmentIds.has(payment.appointmentId) || !methodIds.has(payment.paymentMethodId)) throw new Error('O backup contém referências inválidas.')
  }
}

function parseRecords(value: unknown): BackupRecords {
  if (!isObject(value) || Object.keys(value).length !== tableNames.length) throw new Error('Estrutura de backup inválida.')
  const result = {} as BackupRecords
  for (const tableName of tableNames) {
    const entries = value[tableName]
    if (!Array.isArray(entries) || entries.length > maxRecordsPerTable) throw new Error('Estrutura de backup inválida.')
    const seen = new Set<string>()
    result[tableName] = entries.map(entry => {
      if (!isObject(entry) || Object.keys(entry).length !== 2 || typeof entry.id !== 'string' || !('value' in entry)) throw new Error('Estrutura de backup inválida.')
      const id = idSchema.parse(entry.id)
      if (seen.has(id)) throw new Error('O backup contém identificadores repetidos.')
      seen.add(id)
      const entity = schemas[tableName].parse(entry.value) as { id: string }
      if (entity.id !== id) throw new Error('O backup contém registos inconsistentes.')
      const originalKeys = Object.keys(entry.value as object).sort()
      const validatedKeys = Object.keys(entity).sort()
      if (originalKeys.length !== validatedKeys.length || originalKeys.some((key, index) => key !== validatedKeys[index])) throw new Error('O backup contém campos não suportados.')
      return { id, value: entity }
    })
  }
  validateRelations(result)
  return result
}

export class EncryptedBackupService {
  private readonly db: PracticeDatabase
  private readonly codec: RecordCodec

  constructor(db: PracticeDatabase, codec: RecordCodec) { this.db = db; this.codec = codec }

  async create(passphrase: string): Promise<string> {
    assertPassphrase(passphrase)
    const salt = encodeSalt(randomBytes(KDF_V1.saltBytes))
    const key = await deriveKey(passphrase, salt, KDF_V1)
    const records = {} as BackupRecords
    for (const tableName of tableNames) {
      const table = this.db.table(tableName) as Table<StoredRecord, string>
      records[tableName] = await Promise.all((await table.toArray()).map(async record => {
        const value = schemas[tableName].parse(await this.codec.decode<unknown>(record.payload, { table: tableName, id: record.id })) as { id: string }
        if (value.id !== record.id) throw new Error('Registo inconsistente.')
        return { id: record.id, value }
      }))
    }
    validateRelations(records)
    const encrypted = await encryptJson(key, { createdAt: new Date().toISOString(), records }, backupAad)
    const serialized = JSON.stringify({ format, version: 1, kdf: KDF_V1, salt, payload: encrypted })
    if (serialized.length > 20 * 1024 * 1024) throw new Error('O backup excede o limite de 20 MB.')
    return serialized
  }

  async restore(serialized: string, passphrase: string): Promise<void> {
    assertPassphrase(passphrase)
    if (serialized.length > 20 * 1024 * 1024) throw new Error('O ficheiro de backup é demasiado grande.')
    try {
      const envelope: unknown = JSON.parse(serialized)
      if (!isObject(envelope) || envelope.format !== format || envelope.version !== 1 || !validKdfParameters(envelope.kdf) || typeof envelope.salt !== 'string' || !isEncryptedPayload(envelope.payload)) throw new Error('Formato inválido.')
      const key = await deriveKey(passphrase, envelope.salt, envelope.kdf)
      const decoded = await decryptJson<unknown>(key, envelope.payload, backupAad)
      if (!isObject(decoded) || typeof decoded.createdAt !== 'string' || !Number.isFinite(Date.parse(decoded.createdAt))) throw new Error('Conteúdo inválido.')
      const records = parseRecords(decoded.records)
      const prepared = {} as Record<DataTable, StoredRecord[]>
      for (const tableName of tableNames) {
        prepared[tableName] = await Promise.all(records[tableName].map(async record => ({ id: record.id, payload: await this.codec.encode(record.value, { table: tableName, id: record.id }) })))
      }
      await this.db.transaction('rw', [this.db.patients, this.db.appointments, this.db.rooms, this.db.payments, this.db.paymentMethods, this.db.commissionRules, this.db.settings], async () => {
        for (const tableName of tableNames) {
          const table = this.db.table(tableName) as Table<StoredRecord, string>
          await table.clear()
          await table.bulkPut(prepared[tableName])
        }
      })
    } catch {
      throw new Error('Não foi possível validar ou restaurar o backup. Os dados atuais não foram alterados.')
    }
  }
}