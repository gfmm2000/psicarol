import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import Dexie from 'dexie'
import { afterEach, expect, test } from 'vitest'
import { PracticeRepositoriesContext } from '../app/repositories-context'
import { PracticeDatabase } from '../infrastructure/db/database'
import { PracticeRepositories } from '../infrastructure/db/repositories'
import { createPatient } from '../infrastructure/db/factories'
import type { RecordCodec } from '../infrastructure/db/codec'
import { PatientsPage } from '../pages'

const databases: PracticeDatabase[] = []
const codec: RecordCodec = { async encode(value) { return JSON.stringify(value) }, async decode<T>(payload: string) { return JSON.parse(payload) as T } }
function createRepositories() {
  const database = new PracticeDatabase(`patients-ui-${crypto.randomUUID()}`)
  databases.push(database)
  return new PracticeRepositories(database, codec)
}
function renderPage(repositories = createRepositories()) {
  return { repositories, ...render(<PracticeRepositoriesContext.Provider value={repositories}><PatientsPage /></PracticeRepositoriesContext.Provider>) }
}

afterEach(async () => {
  cleanup()
  await Promise.all(databases.splice(0).map(async database => { const name = database.name; database.close(); await Dexie.delete(name) }))
})

test('cria e pesquisa um utente sem dados demonstrativos', async () => {
  renderPage()
  expect(await screen.findByText('Ainda não existem utentes.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Novo utente' }))
  fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'Utente Fictício de Teste' } })
  fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '910000001' } })
  fireEvent.change(screen.getByLabelText('Email (opcional)'), { target: { value: 'teste@example.invalid' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar utente' }))
  expect(await screen.findByText('Utente Fictício de Teste')).toBeInTheDocument()

  fireEvent.change(screen.getByRole('searchbox', { name: 'Pesquisar utentes' }), { target: { value: '910000001' } })
  expect(screen.getByText('Utente Fictício de Teste')).toBeInTheDocument()
  fireEvent.change(screen.getByRole('searchbox', { name: 'Pesquisar utentes' }), { target: { value: 'inexistente' } })
  expect(screen.getByText('Não foram encontrados utentes para estes critérios.')).toBeInTheDocument()
})

test('mantém utentes homónimos como registos distintos', async () => {
  const repositories = createRepositories()
  await repositories.patients.put(createPatient({ name: 'Utente Homónimo de Teste', phone: '910000003' }))
  await repositories.patients.put(createPatient({ name: 'Utente Homónimo de Teste', phone: '910000004' }))
  renderPage(repositories)
  expect(await screen.findAllByRole('row', { name: /Utente Homónimo de Teste/ })).toHaveLength(2)
})

test('valida campos, edita, arquiva e reativa sem apagar o registo', async () => {
  const repositories = createRepositories()
  const patient = { id: crypto.randomUUID(), name: 'Utente Arquivado de Teste', phone: '910000002', status: 'active' as const, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  await repositories.patients.put(patient)
  renderPage(repositories)
  const row = await screen.findByRole('row', { name: /Utente Arquivado de Teste/ })
  fireEvent.click(within(row).getByRole('button', { name: 'Editar Utente Arquivado de Teste' }))
  fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: '   ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar utente' }))
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'Utente Atualizado de Teste' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar utente' }))
  const updatedRow = await screen.findByRole('row', { name: /Utente Atualizado de Teste/ })
  fireEvent.click(within(updatedRow).getByRole('button', { name: 'Arquivar Utente Atualizado de Teste' }))
  fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar estado' }), { target: { value: 'archived' } })
  const archivedRow = await screen.findByRole('row', { name: /Utente Atualizado de Teste/ })
  expect(within(archivedRow).getByText('Arquivado')).toBeInTheDocument()
  fireEvent.click(within(archivedRow).getByRole('button', { name: 'Reativar Utente Atualizado de Teste' }))
  await waitFor(async () => expect(await repositories.patients.get(patient.id)).toMatchObject({ name: 'Utente Atualizado de Teste', status: 'active' }))
})