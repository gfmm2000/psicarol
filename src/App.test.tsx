import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from './App'

test('apresenta a protecção inicial em português', async () => {
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Proteger a aplicação' })).toBeInTheDocument()
})
