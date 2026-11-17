import Dexie from 'dexie'
import { afterEach, describe, expect, test } from 'vitest'
import { paymentSummary } from '../../domain/financial'
import { createAppointment, createPatient, createPayment, createRoom } from './factories'
import { PracticeDatabase } from './database'
import { PracticeRepositories } from './repositories'
import type { RecordCodec } from './codec'

const databases: PracticeDatabase[] = []
const testCodec: RecordCodec = { async encode(value) { return JSON.stringify(value) }, async decode<T>(payload: string) { return JSON.parse(payload) as T } }
const newRepositories = () => { const db = new PracticeDatabase(`test-${crypto.randomUUID()}`); databases.push(db); return new PracticeRepositories(db, testCodec) }
afterEach(async () => { await Promise.all(databases.splice(0).map(async db => { const name = db.name; db.close(); await Dexie.delete(name) })) })

describe('repositórios IndexedDB', () => {
  test('cria e lê um utente fictício', async () => {
    const repositories = newRepositories(); const patient = createPatient({ name: 'Utente de Demonstração', phone: '910000000' })
    await repositories.patients.put(patient)
    await expect(repositories.patients.get(patient.id)).resolves.toEqual(patient)
  })
  test('mantém relações entre utente, sala, consulta e pagamentos parciais', async () => {
    const repositories = newRepositories(); const patient = createPatient({ name: 'Utente de Teste', phone: '911111111' }); const room = createRoom({ name: 'Sala de teste', status: 'active' })
    await repositories.patients.put(patient); await repositories.rooms.put(room)
    const appointment = createAppointment({ patientId: patient.id, roomId: room.id, startsAt: '2026-11-17T09:00:00.000Z', durationMinutes: 50, modality: 'in_person', status: 'scheduled', agreedPriceCents: 6000, psychologistCommissionBps: 7000, clinicCommissionBps: 3000 })
    await repositories.putAppointment(appointment); await repositories.putPayment(createPayment({ appointmentId: appointment.id, amountCents: 2500, paidAt: '2026-11-17T10:00:00.000Z', paymentMethodId: crypto.randomUUID() }))
    await expect(repositories.appointmentsForPatient(patient.id)).resolves.toEqual([appointment])
    const payments = await repositories.paymentsForAppointment(appointment.id); expect(paymentSummary(appointment.agreedPriceCents, payments.map(payment => payment.amountCents))).toEqual({ receivedCents: 2500, outstandingCents: 3500, status: 'partial' })
  })
})

test('rejeita uma comissão cuja soma não é 100%', async () => {
  const repositories = newRepositories(); const appointment = createAppointment({ patientId: crypto.randomUUID(), startsAt: '2026-11-17T09:00:00.000Z', durationMinutes: 50, modality: 'online', status: 'scheduled', agreedPriceCents: 6000, psychologistCommissionBps: 7000, clinicCommissionBps: 2000 })
  await expect(repositories.putAppointment(appointment)).rejects.toThrow('100%')
})

test('migra uma base versão 1 e cria a tabela de definições da versão 2', async () => {
  const name = `migration-${crypto.randomUUID()}`; const legacy = new Dexie(name); legacy.version(1).stores({ patients: '&id', appointments: '&id, patientId, roomId', rooms: '&id', payments: '&id, appointmentId', paymentMethods: '&id', commissionRules: '&id' }); await legacy.open(); await legacy.table('patients').put({ id: crypto.randomUUID(), payload: '{}' }); legacy.close()
  const migrated = new PracticeDatabase(name); await migrated.open(); expect(migrated.verno).toBe(3); await migrated.settings.put({ id: 'application', payload: '{}' }); expect(await migrated.settings.count()).toBe(1); migrated.close(); await Dexie.delete(name)
})
