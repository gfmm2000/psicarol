import { useEffect, useRef, useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import { database } from '../infrastructure/db/database'
import { defaultSettings } from '../infrastructure/db/factories'
import { PracticeRepositories } from '../infrastructure/db/repositories'
import { AutoLockController } from '../infrastructure/security/auto-lock-controller'
import { SecuritySession } from '../infrastructure/security/security-session'
import { PracticeRepositoriesContext } from './repositories-context'

export function SecurityGate({ children }: { children: React.ReactNode }) {
  const [session] = useState(() => new SecuritySession(database))
  const [repositories] = useState(() => new PracticeRepositories(database, session.codec))
  const [status, setStatus] = useState<'loading' | 'setup' | 'locked' | 'unlocked' | 'legacy' | 'error'>('loading')
  useEffect(() => {
    let active = true
    let lockOnPageHidden = defaultSettings().security.lockOnPageHidden
    const autoLock = new AutoLockController(() => session.lock())
    const refresh = async () => {
      try {
        const value = await session.status()
        if (value === 'unlocked') {
          const settings = await repositories.settings.get('application')
          if (!active || !session.isUnlocked()) return
          const defaults = defaultSettings()
          lockOnPageHidden = settings?.security.lockOnPageHidden ?? defaults.security.lockOnPageHidden
          autoLock.configure(settings?.security.autoLockMinutes ?? defaults.security.autoLockMinutes)
        } else autoLock.stop()
        if (active) setStatus(value)
      } catch {
        autoLock.stop()
        if (active) setStatus('error')
      }
    }
    const touch = () => { if (session.isUnlocked()) autoLock.touch() }
    const onVisibilityChange = () => { if (document.hidden && lockOnPageHidden && session.isUnlocked()) session.lock() }
    const onSecuritySettingsUpdated = () => { void refresh() }
    void refresh()
    const unsubscribe = session.subscribe(() => { void refresh() })
    window.addEventListener('pointerdown', touch)
    window.addEventListener('keydown', touch)
    window.addEventListener('security-settings-updated', onSecuritySettingsUpdated)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      active = false
      unsubscribe()
      autoLock.stop()
      window.removeEventListener('pointerdown', touch)
      window.removeEventListener('keydown', touch)
      window.removeEventListener('security-settings-updated', onSecuritySettingsUpdated)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      session.dispose()
    }
  }, [repositories, session])
  if (status === 'loading') return <Screen><p>A preparar protecção local…</p></Screen>
  if (status === 'legacy') return <PasswordScreen mode="legacy" session={session} />
  if (status === 'error') return <Screen><h1>Não foi possível verificar a segurança</h1><p>Os dados permanecem bloqueados. Verifique o armazenamento local e tente novamente.</p></Screen>
  if (status !== 'unlocked') return <PasswordScreen mode={status} session={session} />
  return <PracticeRepositoriesContext.Provider value={repositories}>{children}<button type="button" aria-label="Bloquear aplicação" onClick={() => session.lock()} className="fixed bottom-4 right-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-lg hover:bg-slate-700"><LockKeyhole size={16} />Bloquear</button></PracticeRepositoriesContext.Provider>
}
function Screen({ children }: { children: React.ReactNode }) { return <main className="grid min-h-screen place-items-center bg-slate-50 p-5"><section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-7 shadow-sm">{children}</section></main> }
function PasswordScreen({ mode, session }: { mode: 'setup' | 'locked' | 'legacy'; session: SecuritySession }) {
  const password = useRef<HTMLInputElement>(null)
  const confirmation = useRef<HTMLInputElement>(null)
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    const value = password.current?.value ?? ''
    try {
      if (mode !== 'locked') {
        if (value.length < 12 || value !== confirmation.current?.value) throw new Error('Verifique a palavra-passe e a confirmação.')
        if (mode === 'legacy' && !consent) throw new Error('Confirme a migração dos dados locais.')
        if (mode === 'legacy') await session.migrateLegacy(value)
        else await session.setup(value)
      } else await session.unlock(value)
      if (password.current) password.current.value = ''
      if (confirmation.current) confirmation.current.value = ''
    } catch {
      setError(mode === 'legacy' ? 'A migração não foi concluída. Os dados continuam bloqueados; confirme a palavra-passe e tente novamente.' : 'Não foi possível concluir a operação. Verifique a palavra-passe e tente novamente.')
    }
  }
  const title = mode === 'setup' ? 'Proteger a aplicação' : mode === 'legacy' ? 'Cifrar dados existentes' : 'Desbloquear aplicação'
  const description = mode === 'setup' ? 'Crie uma palavra-passe principal. Sem ela, os dados não poderão ser recuperados.' : mode === 'legacy' ? 'Foram encontrados dados locais antigos. Serão validados e cifrados numa única operação; se a validação falhar, os dados não são alterados. Sem esta palavra-passe não será possível recuperá-los.' : 'Introduza a palavra-passe principal para aceder aos dados locais.'
  return <Screen><div className="mb-5 grid h-11 w-11 place-items-center rounded-xl bg-teal-50 text-teal-700"><LockKeyhole /></div><h1 className="text-xl font-semibold text-slate-900">{title}</h1><p className="mt-2 text-sm text-slate-600">{description}</p><form className="mt-6 space-y-4" onSubmit={submit}><label className="block text-sm font-medium text-slate-700">Palavra-passe<input ref={password} required minLength={12} maxLength={1024} type="password" autoComplete={mode === 'locked' ? 'current-password' : 'new-password'} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>{mode !== 'locked' && <label className="block text-sm font-medium text-slate-700">Confirmar palavra-passe<input ref={confirmation} required maxLength={1024} type="password" autoComplete="new-password" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>}{mode === 'legacy' && <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /><span>Compreendo que a palavra-passe é necessária para aceder aos dados após a migração.</span></label>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<button className="w-full rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">{mode === 'setup' ? 'Criar protecção' : mode === 'legacy' ? 'Cifrar e proteger dados' : 'Desbloquear'}</button></form></Screen>
}
