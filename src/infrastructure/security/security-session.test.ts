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
  session.lock(); await expect(repositories.patients.get(patient.id)).rejects.toThrow('bloqueada'); await expect(session.unlock('palavra-errada')).rejects.toThrow('Não foi possível')
  await session.unlock('uma-palavra-passe-ficticia'); await expect(repositories.patients.get(patient.id)).resolves.toEqual(patient)
})
test('detecta adulteração e usa IVs diferentes', async () => {
  const { db, repositories } = await secured(); const one = createPatient({ name: 'Dado Fictício A', phone: '918000001' }); const two = { ...one, id: crypto.randomUUID() }; await repositories.patients.put(one); await repositories.patients.put(two); const first = await db.patients.get(one.id); const second = await db.patients.get(two.id); expect(first?.payload).not.toEqual(second?.payload); await db.patients.put({ ...first!, payload: first!.payload.slice(0, -2) + 'xx' }); await expect(repositories.patients.get(one.id)).rejects.toThrow()
})
test('roda a palavra-passe sem perder dados e mantém a geração antiga após falha', async () => {
  const { session, repositories } = await secured(); const patient = createPatient({ name: 'Utente Rotação', phone: '917000000' }); await repositories.patients.put(patient); await expect(session.changePassword('uma-palavra-passe-ficticia', 'outra-palavra-passe-ficticia', 'activate')).rejects.toThrow(); session.lock(); await session.unlock('uma-palavra-passe-ficticia'); await expect(repositories.patients.get(patient.id)).resolves.toEqual(patient); await session.changePassword('uma-palavra-passe-ficticia', 'outra-palavra-passe-ficticia'); session.lock(); await expect(session.unlock('uma-palavra-passe-ficticia')).rejects.toThrow(); await session.unlock('outra-palavra-passe-ficticia'); await expect(repositories.patients.get(patient.id)).resolves.toEqual(patient)
})
test('coordena bloqueio sem transmitir segredos', async () => {
  const channels: LockChannel[] = []; const factory = (): LockChannel => { const channel: LockChannel = { onmessage: null, postMessage(message) { channels.forEach(target => target.onmessage?.({ data: message } as MessageEvent<{ type: 'lock' }>)) }, close() {} }; channels.push(channel); return channel }; const db = new PracticeDatabase(`tabs-${crypto.randomUUID()}`); databases.push(db); const first = new SecuritySession(db, factory); const second = new SecuritySession(db, factory); await first.setup('uma-palavra-passe-ficticia'); await second.unlock('uma-palavra-passe-ficticia'); first.lock(); expect(second.isUnlocked()).toBe(false)
})
