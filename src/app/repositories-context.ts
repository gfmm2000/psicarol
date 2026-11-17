import { createContext, useContext } from 'react'
import type { PracticeRepositories } from '../infrastructure/db/repositories'

export const PracticeRepositoriesContext = createContext<PracticeRepositories | null>(null)

export function usePracticeRepositories(): PracticeRepositories {
  const repositories = useContext(PracticeRepositoriesContext)
  if (!repositories) throw new Error('Os repositórios só estão disponíveis com a sessão desbloqueada.')
  return repositories
}