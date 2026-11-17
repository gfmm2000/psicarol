import Dexie from 'dexie'
import { afterEach, expect, test } from 'vitest'
import { createPatient } from './factories'
import { PracticeDatabase } from './database'
import { PracticeRepositories } from './repositories'
import { SecuritySession } from '../security/security-session'

const databases: PracticeDatabase[] = []
afterEach(async () => { await Promise.all(databases.splice(0).map(async database => { const name = database.name; database.close(); await Dexie.delete(name) })) })

test('exporta e restaura um backup cifrado sem alterar dados quando a validação falha', async () => {
  const database = new PracticeDatabase(`backup-${crypto.randomUUID()}`); databases.push(database)
  const session = new SecuritySession(database); await session.setup('palavra-passe-principal-ficticia')
  const repositories = new PracticeRepositories(database, session.codec)
  const original = createPatient({ name: 'Utente de Backup Fictício', phone: '910000005' })
  const extra = createPatient({ name: 'Utente Posterior Fictício', phone: '910000006' })
  await repositories.patients.put(original)
  const backup = await repositories.backups.create('palavra-passe-backup-ficticia')
  expect(backup).not.toContain(original.name)
  await repositories.patients.put(extra)

  await expect(repositories.backups.restore(backup, 'palavra-passe-errada-ficticia')).rejects.toThrow('Não foi possível')
  const tampered = JSON.parse(backup) as { payload: { ciphertext: string } }
  tampered.payload.ciphertext = `${tampered.payload.ciphertext.slice(0, -4)}AAAA`
  await expect(repositories.backups.restore(JSON.stringify(tampered), 'palavra-passe-backup-ficticia')).rejects.toThrow('Não foi possível')
  await expect(repositories.patients.get(extra.id)).resolves.toEqual(extra)

  await repositories.backups.restore(backup, 'palavra-passe-backup-ficticia')
  await expect(repositories.patients.get(original.id)).resolves.toEqual(original)
  await expect(repositories.patients.get(extra.id)).resolves.toBeUndefined()
})