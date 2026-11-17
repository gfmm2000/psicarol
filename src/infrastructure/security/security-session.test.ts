import Dexie from 'dexie'
import { afterEach, expect, test } from 'vitest'
import { createPatient } from '../db/factories'
import { PracticeDatabase } from '../db/database'
import { PracticeRepositories } from '../db/repositories'
import { SecuritySession } from './security-session'
import type { LockChannel } from './lock-coordinator'

const databases: PracticeDatabase[] = []
async function secured() { const db = new PracticeDatabase(`secure-${crypto.randomUUID()}`); databases.push(db); const session = new SecuritySession(db); await session.setup('uma-palavra-passe-ficticia'); return { db, session, repositories: new PracticeRepositories(db, session.codec) } }
afterEach(async () => { await Promise.all(databases.splice(0).map(async db => { const name = db.name; db.close(); await Dexie.delete(name) })) })

test('persiste dados cifrados, recusa palavra-passe errada e bloqueia leituras', async () => {
  const { db, session, repositories } = await secured(); const patient = createPatient({ name: 'Utente Fictício', phone: '919000000' }); await repositories.patients.put(patient)
  const raw = await db.patients.get(patient.id); expect(raw?.payload).not.toContain(patient.name); expect(raw?.payload).toContain('ciphertext')
  session.lock(); await expect(repositories.patients.get(patient.id)).rejects.toThrow('bloqueada'); await expect(repositories.patients.put(createPatient({ name: 'Escrita bloqueada', phone: '915000000' }))).rejects.toThrow('bloqueada'); await expect(session.unlock('palavra-errada')).rejects.toThrow('Não foi possível')
  await session.unlock('uma-palavra-passe-ficticia'); await expect(repositories.patients.get(patient.id)).resolves.toEqual(patient)
})
test('migra registos antigos cifrando-os numa operação validada', async () => {
  const db = new PracticeDatabase(`legacy-${crypto.randomUUID()}`); databases.push(db); const session = new SecuritySession(db); const patient = createPatient({ name: 'Utente legado fictício', phone: '916000000' })
  await db.patients.put({ id: patient.id, payload: JSON.stringify(patient) })
  expect(await session.status()).toBe('legacy')
  await session.migrateLegacy('palavra-passe-nova-ficticia')
  const raw = await db.patients.get(patient.id)
  expect(raw?.payload).not.toContain(patient.name)
  expect(await session.status()).toBe('unlocked')
  await expect(new PracticeRepositories(db, session.codec).patients.get(patient.id)).resolves.toEqual(patient)
})
test('recusa migração inválida sem alterar dados ou criar metadados', async () => {
  const db = new PracticeDatabase(`invalid-legacy-${crypto.randomUUID()}`); databases.push(db); const session = new SecuritySession(db)
  await db.patients.put({ id: 'bad-record', payload: '{not-json' })
  const before = await db.patients.get('bad-record')
  await expect(session.migrateLegacy('palavra-passe-nova-ficticia')).rejects.toThrow('Nenhum dado foi alterado')
  expect(await db.patients.get('bad-record')).toEqual(before)
  expect(await db.cryptoMetadata.get('crypto')).toBeUndefined()
})
test('aplica política de palavra-passe também na camada de sessão', async () => {
  const db = new PracticeDatabase(`password-policy-${crypto.randomUUID()}`); databases.push(db); const session = new SecuritySession(db)
  await expect(session.setup('curta')).rejects.toThrow('12 e 1024')
  expect(await session.status()).toBe('setup')
})
test('rejeita parâmetros KDF adulterados antes de derivar a chave', async () => {
  const { db, session } = await secured(); const metadata = await db.cryptoMetadata.get('crypto')
  await db.cryptoMetadata.put({ ...metadata!, kdf: { ...metadata!.kdf, iterations: Number.MAX_SAFE_INTEGER } })
  session.lock()
  await expect(session.unlock('uma-palavra-passe-ficticia')).rejects.toThrow('Não foi possível desbloquear')
})
test('detecta adulteração e usa IVs diferentes', async () => {
  const { db, repositories } = await secured(); const one = createPatient({ name: 'Dado Fictício A', phone: '918000001' }); const two = { ...one, id: crypto.randomUUID() }; await repositories.patients.put(one); await repositories.patients.put(two); const first = await db.patients.get(one.id); const second = await db.patients.get(two.id); expect(first?.payload).not.toEqual(second?.payload); await db.patients.put({ ...first!, payload: first!.payload.slice(0, -2) + 'xx' }); await expect(repositories.patients.get(one.id)).rejects.toThrow()
})
test('autentica o contexto do registo e rejeita IV adulterado', async () => {
  const { db, repositories } = await secured(); const patient = createPatient({ name: 'Contexto fictício', phone: '914000000' }); await repositories.patients.put(patient); const raw = await db.patients.get(patient.id)
  const copiedId = crypto.randomUUID(); await db.patients.put({ id: copiedId, payload: raw!.payload })
  await expect(repositories.patients.get(copiedId)).rejects.toThrow()
  const encrypted = JSON.parse(raw!.payload) as { cryptoVersion: number; iv: string; ciphertext: string }; const iv = Uint8Array.from(atob(encrypted.iv), character => character.charCodeAt(0)); iv[0] ^= 1; encrypted.iv = btoa(String.fromCharCode(...iv))
  await db.patients.put({ ...raw!, payload: JSON.stringify(encrypted) })
  await expect(repositories.patients.get(patient.id)).rejects.toThrow()
})
test('roda a palavra-passe sem perder dados e mantém a geração antiga após falha', async () => {
  const { session, repositories } = await secured(); const patient = createPatient({ name: 'Utente Rotação', phone: '917000000' }); await repositories.patients.put(patient); await expect(session.changePassword('uma-palavra-passe-ficticia', 'outra-palavra-passe-ficticia', 'activate')).rejects.toThrow(); session.lock(); await session.unlock('uma-palavra-passe-ficticia'); await expect(repositories.patients.get(patient.id)).resolves.toEqual(patient); await session.changePassword('uma-palavra-passe-ficticia', 'outra-palavra-passe-ficticia'); session.lock(); await expect(session.unlock('uma-palavra-passe-ficticia')).rejects.toThrow(); await session.unlock('outra-palavra-passe-ficticia'); await expect(repositories.patients.get(patient.id)).resolves.toEqual(patient)
})
test('coordena bloqueio sem transmitir segredos', async () => {
  const channels: LockChannel[] = []; const factory = (): LockChannel => { const channel: LockChannel = { onmessage: null, postMessage(message) { channels.forEach(target => target.onmessage?.({ data: message } as MessageEvent<{ type: 'lock' }>)) }, close() {} }; channels.push(channel); return channel }; const db = new PracticeDatabase(`tabs-${crypto.randomUUID()}`); databases.push(db); const first = new SecuritySession(db, factory); const second = new SecuritySession(db, factory); await first.setup('uma-palavra-passe-ficticia'); await second.unlock('uma-palavra-passe-ficticia'); first.lock(); expect(second.isUnlocked()).toBe(false)
})
