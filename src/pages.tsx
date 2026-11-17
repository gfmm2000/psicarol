import { Archive, ArchiveRestore, Pencil, Plus, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Button, Card, PageHeader, Status } from './components/ui'
import type { Patient } from './domain/models'
import { patientSchema } from './domain/validation'
import { createPatient } from './infrastructure/db/factories'
import { usePracticeRepositories } from './app/repositories-context'

function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) { return <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{headers.map(h => <th className="px-5 py-3 font-medium" key={h}>{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row, i) => <tr className="text-slate-600" key={i}>{row.map((cell, j) => <td className="whitespace-nowrap px-5 py-4" key={j}>{cell}</td>)}</tr>)}</tbody></table></div> }
export function PatientsPage() {
	const repositories = usePracticeRepositories()
	const [patients, setPatients] = useState<Patient[]>([])
	const [search, setSearch] = useState('')
	const [statusFilter, setStatusFilter] = useState<'all' | Patient['status']>('active')
	const [reloadKey, setReloadKey] = useState(0)
	const [showForm, setShowForm] = useState(false)
	const [editing, setEditing] = useState<Patient | null>(null)
	const [draft, setDraft] = useState({ name: '', phone: '', email: '' })
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState('')

	useEffect(() => {
		let active = true
		void repositories.patients.all().then(records => {
			if (active) setPatients(records.sort((left, right) => left.name.localeCompare(right.name, 'pt-PT')))
		}).catch(() => {
			if (active) setError('Não foi possível carregar os utentes.')
		}).finally(() => {
			if (active) setLoading(false)
		})
		return () => { active = false }
	}, [repositories, reloadKey])

	const openCreate = () => {
		setEditing(null)
		setDraft({ name: '', phone: '', email: '' })
		setError('')
		setShowForm(true)
	}
	const openEdit = (patient: Patient) => {
		setEditing(patient)
		setDraft({ name: patient.name, phone: patient.phone, email: patient.email ?? '' })
		setError('')
		setShowForm(true)
	}
	const savePatient = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setError('')
		const email = draft.email.trim()
		const patient = editing
			? { ...editing, name: draft.name, phone: draft.phone, email: email || undefined, updatedAt: new Date().toISOString() }
			: createPatient({ name: draft.name, phone: draft.phone, ...(email ? { email } : {}) })
		const result = patientSchema.safeParse(patient)
		if (!result.success) {
			setError(result.error.issues[0]?.message ?? 'Verifique os dados introduzidos.')
			return
		}
		setSaving(true)
		try {
			await repositories.patients.put(result.data)
			setShowForm(false)
			setLoading(true)
			setReloadKey(value => value + 1)
		} catch {
			setError('Não foi possível guardar o utente. Verifique a sessão e tente novamente.')
		} finally {
			setSaving(false)
		}
	}
	const toggleArchive = async (patient: Patient) => {
		setError('')
		try {
			await repositories.patients.put({ ...patient, status: patient.status === 'active' ? 'archived' : 'active', updatedAt: new Date().toISOString() })
			setLoading(true)
			setReloadKey(value => value + 1)
		} catch {
			setError('Não foi possível atualizar o estado do utente.')
		}
	}

	const query = search.trim().toLocaleLowerCase('pt-PT')
	const filteredPatients = patients.filter(patient => (statusFilter === 'all' || patient.status === statusFilter) && (!query || `${patient.name} ${patient.phone} ${patient.email ?? ''}`.toLocaleLowerCase('pt-PT').includes(query)))
	const rows = filteredPatients.map(patient => [
		<span className="font-medium text-slate-800">{patient.name}</span>,
		<span>{patient.phone}{patient.email && <span className="block text-xs text-slate-400">{patient.email}</span>}</span>,
		<Status tone={patient.status === 'active' ? 'success' : 'neutral'}>{patient.status === 'active' ? 'Ativo' : 'Arquivado'}</Status>,
		<div className="flex items-center justify-end gap-1">
			<button type="button" aria-label={`Editar ${patient.name}`} title="Editar" onClick={() => openEdit(patient)} className="rounded p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><Pencil size={16} /></button>
			<button type="button" aria-label={patient.status === 'active' ? `Arquivar ${patient.name}` : `Reativar ${patient.name}`} title={patient.status === 'active' ? 'Arquivar' : 'Reativar'} onClick={() => void toggleArchive(patient)} className="rounded p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">{patient.status === 'active' ? <Archive size={16} /> : <ArchiveRestore size={16} />}</button>
		</div>,
	])

	return <>
		<PageHeader title="Utentes" description="Contactos administrativos dos utentes." action={<Button type="button" onClick={openCreate}><Plus size={17} className="mr-2" />Novo utente</Button>} />
		{showForm && <Card className="mb-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">{editing ? 'Editar utente' : 'Novo utente'}</h2><button type="button" aria-label="Fechar formulário" onClick={() => setShowForm(false)} className="rounded p-2 text-slate-500 hover:bg-slate-100"><X size={17} /></button></div><form className="space-y-4" onSubmit={event => void savePatient(event)}><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">Nome completo<input autoFocus required maxLength={200} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2" /></label><label className="text-sm font-medium text-slate-700">Telefone<input required maxLength={50} value={draft.phone} onChange={event => setDraft({ ...draft, phone: event.target.value })} className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2" /></label><label className="text-sm font-medium text-slate-700 sm:col-span-2">Email (opcional)<input type="email" maxLength={254} value={draft.email} onChange={event => setDraft({ ...draft, email: event.target.value })} className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2" /></label></div>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex flex-wrap gap-2"><Button type="submit" disabled={saving}>{saving ? 'A guardar…' : 'Guardar utente'}</Button><button type="button" onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancelar</button></div></form></Card>}
		{error && !showForm && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
		<Card className="overflow-hidden p-0"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row"><input type="search" aria-label="Pesquisar utentes" value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquisar por nome, telefone ou email" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-700" /><select aria-label="Filtrar estado" value={statusFilter} onChange={event => setStatusFilter(event.target.value as 'all' | Patient['status'])} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="active">Ativos</option><option value="archived">Arquivados</option><option value="all">Todos</option></select></div>{loading ? <p className="p-5 text-sm text-slate-500">A carregar utentes…</p> : filteredPatients.length ? <Table headers={['Nome', 'Contacto', 'Estado', 'Ações']} rows={rows} /> : <p className="p-5 text-sm text-slate-500">{patients.length ? 'Não foram encontrados utentes para estes critérios.' : 'Ainda não existem utentes.'}</p>}</Card>
	</>
}
export { DashboardPage, CalendarPage, RoomsPage, PaymentsPage, ReportsPage, SettingsPage } from './pages/ManagementPages'
