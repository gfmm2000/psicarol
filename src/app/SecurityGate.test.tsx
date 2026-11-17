import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { SecurityGate } from './SecurityGate'
import { database } from '../infrastructure/db/database'
import { defaultSettings } from '../infrastructure/db/factories'
import { PracticeRepositories } from '../infrastructure/db/repositories'
import { SecuritySession } from '../infrastructure/security/security-session'

const password = 'palavra-passe-ficticia-segura'
const originalHidden = document.hidden

async function prepareGate(lockOnPageHidden: boolean): Promise<void> {
  await database.delete()
  await database.open()
  const session = new SecuritySession(database)
  await session.setup(password)
  const repositories = new PracticeRepositories(database, session.codec)
  await repositories.settings.put({ ...defaultSettings(), security: { autoLockMinutes: 10, lockOnPageHidden } })
  session.dispose()
}

afterEach(async () => {
  cleanup()
  Object.defineProperty(document, 'hidden', { configurable: true, value: originalHidden })
  await database.delete()
})

test.each([
  { lockOnPageHidden: true, shouldLock: true },
  { lockOnPageHidden: false, shouldLock: false },
])('respeita a definição de bloqueio ao ocultar a página: $lockOnPageHidden', async ({ lockOnPageHidden, shouldLock }) => {
  await prepareGate(lockOnPageHidden)
  render(<SecurityGate><p>Conteúdo protegido</p></SecurityGate>)
  fireEvent.change(await screen.findByLabelText('Palavra-passe'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Desbloquear' }))
  expect(await screen.findByText('Conteúdo protegido')).toBeInTheDocument()

  Object.defineProperty(document, 'hidden', { configurable: true, value: true })
  fireEvent(document, new Event('visibilitychange'))

  if (shouldLock) expect(await screen.findByRole('heading', { name: 'Desbloquear aplicação' })).toBeInTheDocument()
  else expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument()
})