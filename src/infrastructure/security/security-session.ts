import type { Table } from 'dexie'
import { EncryptedRecordCodec } from '../crypto/encrypted-record-codec'
import { deriveKey, encodeSalt } from '../crypto/key-derivation'
import { KDF_V1, type CryptoMetadata } from '../crypto/types'
import { aadFor, assertCryptoAvailable, decryptJson, encryptJson, randomBytes } from '../crypto/web-crypto'
import { appointmentSchema, applicationSettingsSchema, commissionRuleSchema, patientSchema, paymentMethodSchema, paymentSchema, roomSchema } from '../../domain/validation'
import type { PracticeDatabase, StoredRecord } from '../db/database'
import { LockedError } from '../db/codec'
import { LockCoordinator } from './lock-coordinator'

type SessionStatus = 'setup' | 'locked' | 'unlocked' | 'legacy'
const tables = ['patients', 'appointments', 'rooms', 'payments', 'paymentMethods', 'commissionRules', 'settings'] as const
const legacySchemas = { patients: patientSchema, appointments: appointmentSchema, rooms: roomSchema, payments: paymentSchema, paymentMethods: paymentMethodSchema, commissionRules: commissionRuleSchema, settings: applicationSettingsSchema }
const assertPasswordPolicy = (password: string): void => { if (password.length < 12 || password.length > 1024) throw new Error('A palavra-passe deve ter entre 12 e 1024 caracteres.') }
export class SecuritySession {
  private readonly db: PracticeDatabase; private key?: CryptoKey; private metadata?: CryptoMetadata; private readonly coordinator: LockCoordinator; private readonly listeners = new Set<() => void>; readonly codec: EncryptedRecordCodec
  constructor(db: PracticeDatabase, channelFactory?: (name: string) => import('./lock-coordinator').LockChannel) { this.db = db; this.codec = new EncryptedRecordCodec(() => this.key); this.coordinator = new LockCoordinator(() => this.lock(false), channelFactory) }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  private notify(): void { this.listeners.forEach(listener => listener()) }
  async status(): Promise<SessionStatus> { assertCryptoAvailable(); const metadata = await this.db.cryptoMetadata.get('crypto'); if (metadata) { this.metadata = metadata; return this.key ? 'unlocked' : 'locked' } for (const table of tables) if (await this.db.table(table).count()) return 'legacy'; return 'setup' }
  async setup(password: string): Promise<void> { assertPasswordPolicy(password); if (await this.status() !== 'setup') throw new Error('A configuração inicial não está disponível.'); const salt = encodeSalt(randomBytes(KDF_V1.saltBytes)); const key = await deriveKey(password, salt, KDF_V1); const verifier = await encryptJson(key, { kind: 'psicarol-key-verifier', version: 1 }, aadFor('cryptoMetadata', 'verifier')); const metadata: CryptoMetadata = { id: 'crypto', cryptoVersion: 1, activeGeneration: 1, kdf: KDF_V1, salt, verifier }; await this.db.cryptoMetadata.put(metadata); this.metadata = metadata; this.key = key; this.notify() }
  async unlock(password: string): Promise<void> { const metadata = await this.db.cryptoMetadata.get('crypto'); if (!metadata) throw new Error('A aplicação ainda não foi configurada.'); try { if (metadata.cryptoVersion !== 1 || !Number.isSafeInteger(metadata.activeGeneration) || metadata.activeGeneration < 1) throw new Error('invalid'); const key = await deriveKey(password, metadata.salt, metadata.kdf); const verifier = await decryptJson<{ kind: string; version: number }>(key, metadata.verifier, aadFor('cryptoMetadata', 'verifier')); if (verifier.kind !== 'psicarol-key-verifier' || verifier.version !== 1) throw new Error('invalid'); this.metadata = metadata; this.key = key; this.notify() } catch { throw new Error('Não foi possível desbloquear a aplicação.') } }
  async migrateLegacy(password: string): Promise<void> {
    assertPasswordPolicy(password)
    if (await this.status() !== 'legacy') throw new Error('Não existem dados antigos por migrar.')
    const salt = encodeSalt(randomBytes(KDF_V1.saltBytes))
    const key = await deriveKey(password, salt, KDF_V1)
    const codec = new EncryptedRecordCodec(() => key)
    const prepared: Array<{ table: Table<StoredRecord, string>; record: StoredRecord; payload: string }> = []
    try {
      for (const name of tables) {
        const table = this.db.table(name) as Table<StoredRecord, string>
        for (const record of await table.toArray()) {
          if (record.pendingPayload) throw new Error('pending')
          const legacyValue: unknown = JSON.parse(record.payload)
          if (typeof legacyValue !== 'object' || legacyValue === null || Array.isArray(legacyValue)) throw new Error('invalid')
          const value = legacySchemas[name].parse(legacyValue) as { id: string }
          const sourceKeys = Object.keys(legacyValue).sort()
          const validatedKeys = Object.keys(value).sort()
          if (record.id !== value.id || sourceKeys.length !== validatedKeys.length || sourceKeys.some((field, index) => field !== validatedKeys[index])) throw new Error('invalid')
          prepared.push({ table, record, payload: await codec.encode(value, { table: name, id: record.id }) })
        }
      }
    } catch {
      throw new Error('Não foi possível validar os dados antigos. Nenhum dado foi alterado.')
    }
    const verifier = await encryptJson(key, { kind: 'psicarol-key-verifier', version: 1 }, aadFor('cryptoMetadata', 'verifier'))
    const metadata: CryptoMetadata = { id: 'crypto', cryptoVersion: 1, activeGeneration: 1, kdf: KDF_V1, salt, verifier }
    try {
      await this.db.transaction('rw', [this.db.patients, this.db.appointments, this.db.rooms, this.db.payments, this.db.paymentMethods, this.db.commissionRules, this.db.settings, this.db.cryptoMetadata], async () => {
        if (await this.db.cryptoMetadata.get('crypto')) throw new Error('already-migrated')
        for (const item of prepared) {
          const current = await item.table.get(item.record.id)
          if (!current || current.payload !== item.record.payload) throw new Error('changed')
          await item.table.put({ id: item.record.id, payload: item.payload })
        }
        await this.db.cryptoMetadata.put(metadata)
      })
    } catch {
      throw new Error('A migração não foi concluída. Os dados permanecem inalterados.')
    }
    this.metadata = metadata
    this.key = key
    this.notify()
  }
  lock(broadcast = true): void { this.key = undefined; if (broadcast) this.coordinator.broadcastLock(); this.notify() }
  isUnlocked(): boolean { return this.key !== undefined }
  requireKey(): CryptoKey { if (!this.key) throw new LockedError(); return this.key }
  async changePassword(currentPassword: string, newPassword: string, failAt?: 'prepare' | 'activate'): Promise<void> { assertPasswordPolicy(newPassword); await this.unlock(currentPassword); this.requireKey(); const metadata = this.metadata; if (!metadata) throw new LockedError(); const salt = encodeSalt(randomBytes(KDF_V1.saltBytes)); const nextKey = await deriveKey(newPassword, salt, KDF_V1); const nextCodec = new EncryptedRecordCodec(() => nextKey); const prepared: Array<{ table: Table<StoredRecord, string>; record: StoredRecord; payload: string }> = []
    for (const name of tables) { const table = this.db.table(name) as Table<StoredRecord, string>; for (const record of await table.toArray()) { const value = await this.codec.decode<unknown>(record.payload, { table: name, id: record.id }); prepared.push({ table, record, payload: await nextCodec.encode(value, { table: name, id: record.id }) }) } }
    if (failAt === 'prepare') throw new Error('Falha simulada durante preparação.')
    for (const item of prepared) await item.table.put({ ...item.record, pendingPayload: item.payload })
    const verifier = await encryptJson(nextKey, { kind: 'psicarol-key-verifier', version: 1 }, aadFor('cryptoMetadata', 'verifier')); const nextMetadata: CryptoMetadata = { ...metadata, activeGeneration: metadata.activeGeneration + 1, salt, kdf: KDF_V1, verifier }
    await this.db.transaction('rw', [this.db.patients, this.db.appointments, this.db.rooms, this.db.payments, this.db.paymentMethods, this.db.commissionRules, this.db.settings, this.db.cryptoMetadata], async () => { if (failAt === 'activate') throw new Error('Falha simulada durante activação.'); for (const item of prepared) await item.table.put({ id: item.record.id, payload: item.payload }); await this.db.cryptoMetadata.put(nextMetadata) })
    this.metadata = nextMetadata; this.key = nextKey; this.notify() }
  dispose(): void { this.lock(false); this.coordinator.close(); this.listeners.clear() }
}
