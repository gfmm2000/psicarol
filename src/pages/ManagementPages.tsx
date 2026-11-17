import { useEffect, useState, type ReactNode } from 'react'
import { ArrowUpRight, CalendarDays, Euro, Plus, Users } from 'lucide-react'
import { Button, Card, PageHeader, Status } from '../components/ui'
import type { Appointment, AppointmentStatus, Patient, Payment, PaymentMethod, Room } from '../domain/models'
import { appointmentSchema, applicationSettingsSchema, commissionRuleSchema, paymentSchema, roomSchema } from '../domain/validation'
import { createAppointment, createPayment, createPaymentMethod, createRoom, defaultSettings } from '../infrastructure/db/factories'
import { paymentSummary } from '../domain/financial'
import { usePracticeRepositories } from '../app/repositories-context'
import { formatEuro } from '../lib/format'

const DEFAULT_SETTINGS = defaultSettings()

function DataTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{headers.map(header => <th className="px-4 py-3 font-medium" key={header}>{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row, index) => <tr className="text-slate-700" key={index}>{row.map((cell, cellIndex) => <td className="px-4 py-3" key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <Card><div className="flex items-center justify-between"><span className="text-sm text-slate-500">{label}</span><span className="text-teal-700">{icon}</span></div><p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p></Card>
}

function dateTime(value: string): string {
  return new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Lisbon' }).format(new Date(value))
}

function localDateTimeInput(value = new Date()): string {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function statusLabel(status: AppointmentStatus): string {
  return { scheduled: 'Agendada', completed: 'Concluída', cancelled: 'Cancelada', no_show: 'Falta' }[status]
}

export function DashboardPage() {
  const repositories = usePracticeRepositories()
  const [stats, setStats] = useState({ today: 0, patients: 0, received: 0, outstanding: 0 })
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([])
  const [patientNames, setPatientNames] = useState<Record<string, string>>({})
  useEffect(() => {
    let active = true
    void Promise.all([repositories.allAppointments(), repositories.patients.all(), repositories.allPayments()]).then(([appointments, patients, payments]) => {
      if (!active) return
      const now = new Date()
      const today = appointments.filter(appointment => new Date(appointment.startsAt).toDateString() === now.toDateString() && appointment.status !== 'cancelled')
      const monthPayments = payments.filter(payment => { const date = new Date(payment.paidAt); return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear() })
      const received = monthPayments.reduce((total, payment) => total + payment.amountCents, 0)
      const outstanding = appointments.filter(appointment => appointment.status !== 'cancelled' && appointment.status !== 'no_show').reduce((total, appointment) => total + paymentSummary(appointment.agreedPriceCents, payments.filter(payment => payment.appointmentId === appointment.id).map(payment => payment.amountCents)).outstandingCents, 0)
      setStats({ today: today.length, patients: patients.filter(patient => patient.status === 'active').length, received, outstanding })
      setTodayAppointments(today.sort((left, right) => left.startsAt.localeCompare(right.startsAt)))
      setPatientNames(Object.fromEntries(patients.map(patient => [patient.id, patient.name])))
    }).catch(() => undefined)
    return () => { active = false }
  }, [repositories])
  return <><PageHeader title="Resumo" description="Indicadores calculados a partir dos registos locais." /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={<CalendarDays />} label="Consultas hoje" value={String(stats.today)} /><Metric icon={<Users />} label="Utentes ativos" value={String(stats.patients)} /><Metric icon={<Euro />} label="Recebido este mês" value={formatEuro(stats.received)} /><Metric icon={<ArrowUpRight />} label="Por receber" value={formatEuro(stats.outstanding)} /></div><Card className="mt-6"><h2 className="font-semibold">Agenda de hoje</h2>{todayAppointments.length ? <div className="mt-3 divide-y divide-slate-100">{todayAppointments.map(appointment => <div className="flex flex-wrap items-center gap-3 py-3" key={appointment.id}><time className="w-28 text-sm text-slate-500">{dateTime(appointment.startsAt)}</time><span className="flex-1 font-medium">{patientNames[appointment.patientId] ?? 'Utente arquivado'}</span><Status>{statusLabel(appointment.status)}</Status></div>)}</div> : <p className="mt-3 text-sm text-slate-500">Sem consultas para hoje.</p>}</Card></>
}

export function CalendarPage() {
  const repositories = usePracticeRepositories()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [commission, setCommission] = useState({ psychologist: 7000, clinic: 3000 })
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [visible, setVisible] = useState(false)
  const [reload, setReload] = useState(0)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState({ patientId: '', roomId: '', startsAt: localDateTimeInput(), duration: '50', modality: 'in_person' as 'in_person' | 'online', price: '60', status: 'scheduled' as AppointmentStatus })
  useEffect(() => {
    let active = true
    void Promise.all([repositories.allAppointments(), repositories.patients.all(), repositories.rooms.all(), repositories.commissionRules.all()]).then(([appointments, patients, rooms, rules]) => {
      if (!active) return
      setAppointments(appointments.sort((left, right) => left.startsAt.localeCompare(right.startsAt)))
      setPatients(patients)
      setRooms(rooms)
      const now = new Date().toISOString()
      const current = rules.filter(rule => rule.status === 'active' && rule.validFrom <= now).sort((left, right) => right.validFrom.localeCompare(left.validFrom))[0]
      if (current) setCommission({ psychologist: current.psychologistCommissionBps, clinic: current.clinicCommissionBps })
    }).catch(() => { if (active) setError('Não foi possível carregar a agenda.') })
    return () => { active = false }
  }, [repositories, reload])
  const openNew = () => { setEditing(null); setDraft({ patientId: patients.find(patient => patient.status === 'active')?.id ?? '', roomId: '', startsAt: localDateTimeInput(), duration: '50', modality: 'in_person', price: '60', status: 'scheduled' }); setError(''); setVisible(true) }
  const edit = (appointment: Appointment) => { setEditing(appointment); setDraft({ patientId: appointment.patientId, roomId: appointment.roomId ?? '', startsAt: localDateTimeInput(new Date(appointment.startsAt)), duration: String(appointment.durationMinutes), modality: appointment.modality, price: (appointment.agreedPriceCents / 100).toFixed(2), status: appointment.status }); setError(''); setVisible(true) }
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('')
    const start = new Date(draft.startsAt)
    if (!Number.isFinite(start.getTime())) { setError('Indique uma data e hora válidas.'); return }
    const values = { patientId: draft.patientId, ...(draft.roomId ? { roomId: draft.roomId } : {}), startsAt: start.toISOString(), durationMinutes: Number(draft.duration), modality: draft.modality, status: draft.status, agreedPriceCents: Math.round(Number(draft.price) * 100), psychologistCommissionBps: editing?.psychologistCommissionBps ?? commission.psychologist, clinicCommissionBps: editing?.clinicCommissionBps ?? commission.clinic }
    const appointment = editing ? { ...editing, ...values, updatedAt: new Date().toISOString() } : createAppointment(values)
    const parsed = appointmentSchema.safeParse(appointment)
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Verifique os dados da consulta.'); return }
    const end = start.getTime() + parsed.data.durationMinutes * 60_000
    const conflict = parsed.data.status === 'scheduled' && appointments.some(existing => existing.id !== parsed.data.id && existing.status === 'scheduled' && start.getTime() < new Date(existing.startsAt).getTime() + existing.durationMinutes * 60_000 && end > new Date(existing.startsAt).getTime())
    if (conflict) { setError('Já existe uma consulta agendada neste horário.'); return }
    try { await repositories.putAppointment(parsed.data); setVisible(false); setReload(value => value + 1) } catch { setError('Não foi possível guardar a consulta.') }
  }
  const names = Object.fromEntries(patients.map(patient => [patient.id, patient.name]))
  const roomNames = Object.fromEntries(rooms.map(room => [room.id, room.name]))
  const rows = appointments.map(appointment => [dateTime(appointment.startsAt), names[appointment.patientId] ?? 'Utente arquivado', appointment.roomId ? roomNames[appointment.roomId] ?? 'Sala indisponível' : appointment.modality === 'online' ? 'Online' : 'Sem sala', formatEuro(appointment.agreedPriceCents), <Status tone={appointment.status === 'scheduled' ? 'success' : 'neutral'}>{statusLabel(appointment.status)}</Status>, <button type="button" onClick={() => edit(appointment)} className="text-sm font-medium text-teal-800 hover:underline">Editar</button>])
  return <><PageHeader title="Agenda" description="Consultas locais, com deteção básica de sobreposição." action={<Button type="button" onClick={openNew}><Plus size={17} className="mr-2" />Nova consulta</Button>} />{visible && <Card className="mb-5"><h2 className="mb-4 font-semibold">{editing ? 'Editar consulta' : 'Nova consulta'}</h2><form className="grid gap-4 sm:grid-cols-2" onSubmit={event => void save(event)}><label className="text-sm font-medium">Utente<select required value={draft.patientId} onChange={event => setDraft({ ...draft, patientId: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-200 p-2">{patients.filter(patient => patient.status === 'active' || patient.id === editing?.patientId).map(patient => <option value={patient.id} key={patient.id}>{patient.name}</option>)}</select></label><label className="text-sm font-medium">Início<input required type="datetime-local" value={draft.startsAt} onChange={event => setDraft({ ...draft, startsAt: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-200 p-2" /></label><label className="text-sm font-medium">Duração (minutos)<input required type="number" min="1" max="480" value={draft.duration} onChange={event => setDraft({ ...draft, duration: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-200 p-2" /></label><label className="text-sm font-medium">Preço (€)<input required type="number" min="0" step="0.01" value={draft.price} onChange={event => setDraft({ ...draft, price: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-200 p-2" /></label><label className="text-sm font-medium">Modalidade<select value={draft.modality} onChange={event => setDraft({ ...draft, modality: event.target.value as 'in_person' | 'online' })} className="mt-1 block w-full rounded-lg border border-slate-200 p-2"><option value="in_person">Presencial</option><option value="online">Online</option></select></label><label className="text-sm font-medium">Sala (opcional)<select value={draft.roomId} onChange={event => setDraft({ ...draft, roomId: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-200 p-2"><option value="">Sem sala</option>{rooms.filter(room => room.status === 'active' || room.id === editing?.roomId).map(room => <option value={room.id} key={room.id}>{room.name}</option>)}</select></label>{editing && <label className="text-sm font-medium">Estado<select value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value as AppointmentStatus })} className="mt-1 block w-full rounded-lg border border-slate-200 p-2">{(['scheduled', 'completed', 'cancelled', 'no_show'] as const).map(status => <option value={status} key={status}>{statusLabel(status)}</option>)}</select></label>}{error && <p role="alert" className="sm:col-span-2 text-sm text-red-700">{error}</p>}<div className="flex gap-2 sm:col-span-2"><Button type="submit">Guardar consulta</Button><button type="button" onClick={() => setVisible(false)} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancelar</button></div></form></Card>}{error && !visible && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}<Card className="overflow-hidden p-0">{rows.length ? <DataTable headers={['Data e hora', 'Utente', 'Local', 'Preço', 'Estado', '']} rows={rows} /> : <p className="p-5 text-sm text-slate-500">Ainda não existem consultas.</p>}</Card></>
}

export function RoomsPage() {
  const repositories = usePracticeRepositories()
  const [rooms, setRooms] = useState<Room[]>([])
  const [editing, setEditing] = useState<Room | null>(null)
  const [visible, setVisible] = useState(false)
  const [reload, setReload] = useState(0)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { let active = true; void repositories.rooms.all().then(value => { if (active) setRooms(value.sort((left, right) => left.name.localeCompare(right.name, 'pt-PT'))) }).catch(() => { if (active) setError('Não foi possível carregar as salas.') }); return () => { active = false } }, [repositories, reload])
  const open = (room?: Room) => { setEditing(room ?? null); setName(room?.name ?? ''); setDescription(room?.description ?? ''); setError(''); setVisible(true) }
  const save = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const result = roomSchema.safeParse(editing ? { ...editing, name, description: description || undefined } : createRoom({ name, description: description || undefined, status: 'active' })); if (!result.success) { setError(result.error.issues[0]?.message ?? 'Verifique os dados da sala.'); return } try { await repositories.rooms.put(result.data); setVisible(false); setReload(value => value + 1) } catch { setError('Não foi possível guardar a sala.') } }
  const toggle = async (room: Room) => {
    setError('')
    if (room.status === 'active') {
      const appointments = await repositories.allAppointments()
      if (appointments.some(appointment => appointment.roomId === room.id && appointment.status === 'scheduled' && new Date(appointment.startsAt) > new Date())) { setError('A sala tem consultas futuras. Altere-as antes de a desativar.'); return }
    }
    try { await repositories.rooms.put({ ...room, status: room.status === 'active' ? 'inactive' : 'active' }); setReload(value => value + 1) } catch { setError('Não foi possível atualizar a sala.') }
  }
  const rows = rooms.map(room => [room.name, room.description || '—', <Status tone={room.status === 'active' ? 'success' : 'neutral'}>{room.status === 'active' ? 'Ativa' : 'Inativa'}</Status>, <div className="flex gap-3"><button type="button" onClick={() => open(room)} className="font-medium text-teal-800 hover:underline">Editar</button><button type="button" onClick={() => void toggle(room)} className="font-medium text-slate-600 hover:underline">{room.status === 'active' ? 'Desativar' : 'Ativar'}</button></div>])
  return <><PageHeader title="Salas" description="Salas disponíveis para consultas presenciais." action={<Button type="button" onClick={() => open()}><Plus size={17} className="mr-2" />Nova sala</Button>} />{visible && <Card className="mb-5"><h2 className="mb-4 font-semibold">{editing ? 'Editar sala' : 'Nova sala'}</h2><form className="grid gap-4 sm:grid-cols-2" onSubmit={event => void save(event)}><label className="text-sm font-medium">Nome<input required maxLength={100} value={name} onChange={event => setName(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 p-2" /></label><label className="text-sm font-medium">Descrição (opcional)<input maxLength={500} value={description} onChange={event => setDescription(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 p-2" /></label>{error && <p role="alert" className="sm:col-span-2 text-sm text-red-700">{error}</p>}<div className="flex gap-2 sm:col-span-2"><Button type="submit">Guardar sala</Button><button type="button" onClick={() => setVisible(false)} className="px-4 py-2 text-sm text-slate-600">Cancelar</button></div></form></Card>}{error && !visible && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}<Card className="overflow-hidden p-0">{rows.length ? <DataTable headers={['Sala', 'Descrição', 'Estado', 'Ações']} rows={rows} /> : <p className="p-5 text-sm text-slate-500">Ainda não existem salas.</p>}</Card></>
}

export function PaymentsPage() {
  const repositories = usePracticeRepositories()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [visible, setVisible] = useState(false)
  const [reload, setReload] = useState(0)
  const [error, setError] = useState('')
  const [appointmentId, setAppointmentId] = useState('')
  const [amount, setAmount] = useState('')
  const [methodId, setMethodId] = useState('')
  useEffect(() => {
    let active = true
    void (async () => {
      const [appointments, patients, payments] = await Promise.all([repositories.allAppointments(), repositories.patients.all(), repositories.allPayments()])
      let methods = await repositories.paymentMethods.all()
      if (!methods.length) {
        for (const name of ['Transferência', 'Numerário']) await repositories.paymentMethods.put(createPaymentMethod({ name, status: 'active' }))
        methods = await repositories.paymentMethods.all()
      }
      if (active) { setAppointments(appointments); setPatients(patients); setPayments(payments); setMethods(methods); setMethodId(methods.find(method => method.status === 'active')?.id ?? '') }
    })().catch(() => { if (active) setError('Não foi possível carregar os pagamentos.') })
    return () => { active = false }
  }, [repositories, reload])
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('')
    const payment = paymentSchema.safeParse(createPayment({ appointmentId, amountCents: Math.round(Number(amount) * 100), paidAt: new Date().toISOString(), paymentMethodId: methodId }))
    if (!payment.success) { setError(payment.error.issues[0]?.message ?? 'Verifique o pagamento.'); return }
    try { await repositories.putPayment(payment.data); setVisible(false); setAmount(''); setReload(value => value + 1) } catch { setError('Não foi possível registar o pagamento.') }
  }
  const patientNames = Object.fromEntries(patients.map(patient => [patient.id, patient.name]))
  const rows = appointments.filter(appointment => appointment.status !== 'cancelled' && appointment.status !== 'no_show').map(appointment => {
    const summary = paymentSummary(appointment.agreedPriceCents, payments.filter(payment => payment.appointmentId === appointment.id).map(payment => payment.amountCents))
    const label = { unpaid: 'Por pagar', partial: 'Parcial', paid: 'Pago', overpaid: 'Excedente' }[summary.status]
    return [patientNames[appointment.patientId] ?? 'Utente arquivado', dateTime(appointment.startsAt), formatEuro(appointment.agreedPriceCents), formatEuro(summary.receivedCents), formatEuro(summary.outstandingCents), <Status tone={summary.status === 'paid' ? 'success' : summary.status === 'overpaid' ? 'warning' : 'neutral'}>{label}</Status>]
  })
  const payable = appointments.filter(appointment => appointment.status !== 'cancelled' && appointment.status !== 'no_show')
  return <><PageHeader title="Pagamentos" description="Registe pagamentos totais ou parciais." action={<Button type="button" onClick={() => { setVisible(value => !value); setError('') }}><Plus size={17} className="mr-2" />Registar pagamento</Button>} />{visible && <Card className="mb-5"><h2 className="mb-4 font-semibold">Novo pagamento</h2><form className="grid gap-4 sm:grid-cols-3" onSubmit={event => void save(event)}><label className="text-sm font-medium">Consulta<select required value={appointmentId} onChange={event => setAppointmentId(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 p-2"><option value="">Selecionar consulta</option>{payable.map(appointment => <option value={appointment.id} key={appointment.id}>{patientNames[appointment.patientId] ?? 'Utente'} · {dateTime(appointment.startsAt)} · {formatEuro(appointment.agreedPriceCents)}</option>)}</select></label><label className="text-sm font-medium">Valor (€)<input required type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 p-2" /></label><label className="text-sm font-medium">Método<select required value={methodId} onChange={event => setMethodId(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 p-2">{methods.filter(method => method.status === 'active').map(method => <option value={method.id} key={method.id}>{method.name}</option>)}</select></label>{error && <p role="alert" className="sm:col-span-3 text-sm text-red-700">{error}</p>}<div className="flex gap-2 sm:col-span-3"><Button type="submit">Guardar pagamento</Button><button type="button" onClick={() => setVisible(false)} className="px-4 py-2 text-sm text-slate-600">Cancelar</button></div></form></Card>}{error && !visible && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}<Card className="overflow-hidden p-0">{rows.length ? <DataTable headers={['Utente', 'Consulta', 'Acordado', 'Recebido', 'Em falta', 'Estado']} rows={rows} /> : <p className="p-5 text-sm text-slate-500">Ainda não existem consultas para cobrar.</p>}</Card></>
}

export function ReportsPage() {
  const repositories = usePracticeRepositories()
  const [stats, setStats] = useState({ received: 0, outstanding: 0, completed: 0 })
  useEffect(() => { let active = true; void Promise.all([repositories.allAppointments(), repositories.allPayments()]).then(([appointments, payments]) => { if (!active) return; const now = new Date(); const received = payments.filter(payment => { const date = new Date(payment.paidAt); return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear() }).reduce((sum, payment) => sum + payment.amountCents, 0); const outstanding = appointments.filter(appointment => appointment.status !== 'cancelled' && appointment.status !== 'no_show').reduce((sum, appointment) => sum + paymentSummary(appointment.agreedPriceCents, payments.filter(payment => payment.appointmentId === appointment.id).map(payment => payment.amountCents)).outstandingCents, 0); const completed = appointments.filter(appointment => appointment.status === 'completed' && new Date(appointment.startsAt).getMonth() === now.getMonth() && new Date(appointment.startsAt).getFullYear() === now.getFullYear()).length; setStats({ received, outstanding, completed }) }).catch(() => undefined); return () => { active = false } }, [repositories])
  return <><PageHeader title="Relatórios" description="Resumo financeiro do mês atual, calculado localmente." /><div className="grid gap-4 sm:grid-cols-3"><Metric icon={<Euro />} label="Recebido este mês" value={formatEuro(stats.received)} /><Metric icon={<ArrowUpRight />} label="Por receber" value={formatEuro(stats.outstanding)} /><Metric icon={<CalendarDays />} label="Consultas concluídas" value={String(stats.completed)} /></div><p className="mt-4 text-xs text-slate-500">Os valores recebidos são somados pela data do pagamento; consultas canceladas e faltas não contam como dívida.</p></>
}

export function SettingsPage() {
  const repositories = usePracticeRepositories()
  const [duration, setDuration] = useState(String(DEFAULT_SETTINGS.general.defaultAppointmentDurationMinutes))
  const [autoLock, setAutoLock] = useState(String(DEFAULT_SETTINGS.security.autoLockMinutes))
  const [lockOnHide, setLockOnHide] = useState(DEFAULT_SETTINGS.security.lockOnPageHidden)
  const [psychologistPercent, setPsychologistPercent] = useState('70')
  const [clinicPercent, setClinicPercent] = useState('30')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [backupPassword, setBackupPassword] = useState('')
  const [restorePassword, setRestorePassword] = useState('')
  const [backupFile, setBackupFile] = useState<File | null>(null)
  const [backupMessage, setBackupMessage] = useState('')
  const [backupError, setBackupError] = useState('')
  useEffect(() => { let active = true; void Promise.all([repositories.settings.get('application'), repositories.commissionRules.all()]).then(([settings, rules]) => { if (!active) return; const rule = rules.filter(item => item.status === 'active').sort((left, right) => right.validFrom.localeCompare(left.validFrom))[0]; const value = settings ?? DEFAULT_SETTINGS; setDuration(String(value.general.defaultAppointmentDurationMinutes)); setAutoLock(String(value.security.autoLockMinutes)); setLockOnHide(value.security.lockOnPageHidden); if (rule) { setPsychologistPercent(String(rule.psychologistCommissionBps / 100)); setClinicPercent(String(rule.clinicCommissionBps / 100)) } }).catch(() => { if (active) setError('Não foi possível carregar as definições.') }); return () => { active = false } }, [repositories])
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setNotice(''); setError('')
    const psychologistBps = Math.round(Number(psychologistPercent) * 100)
    const clinicBps = Math.round(Number(clinicPercent) * 100)
    const rule = commissionRuleSchema.safeParse({ id: crypto.randomUUID(), psychologistCommissionBps: psychologistBps, clinicCommissionBps: clinicBps, validFrom: new Date().toISOString(), status: 'active' })
    const settings = applicationSettingsSchema.safeParse({ ...DEFAULT_SETTINGS, general: { defaultAppointmentDurationMinutes: Number(duration) }, security: { autoLockMinutes: Number(autoLock), lockOnPageHidden: lockOnHide } })
    if (!settings.success) { setError(settings.error.issues[0]?.message ?? 'Verifique as definições.'); return }
    if (!rule.success) { setError(rule.error.issues[0]?.message ?? 'As comissões têm de totalizar 100%.'); return }
    try {
      const existing = await repositories.commissionRules.all()
      await repositories.settings.put(settings.data)
      await repositories.commissionRules.put(rule.data)
      for (const oldRule of existing.filter(item => item.status === 'active')) await repositories.commissionRules.put({ ...oldRule, status: 'inactive' })
      window.dispatchEvent(new Event('security-settings-updated'))
      setNotice('Definições guardadas. As novas comissões aplicam-se apenas a consultas futuras.')
    } catch { setError('Não foi possível guardar as definições.') }
  }
  const exportBackup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBackupMessage(''); setBackupError('')
    try {
      const serialized = await repositories.backups.create(backupPassword)
      const url = URL.createObjectURL(new Blob([serialized], { type: 'application/json' }))
      const link = document.createElement('a'); link.href = url; link.download = `psicarol-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url)
      setBackupPassword(''); setBackupMessage('Backup cifrado criado.')
    } catch (reason) { setBackupError(reason instanceof Error ? reason.message : 'Não foi possível criar o backup.') }
  }
  const importBackup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBackupMessage(''); setBackupError('')
    if (!backupFile) { setBackupError('Selecione um ficheiro de backup.'); return }
    if (backupFile.size > 20 * 1024 * 1024) { setBackupError('O ficheiro de backup é demasiado grande.'); return }
    if (!window.confirm('O restauro substitui os dados locais atuais. Confirma que pretende continuar?')) return
    try {
      await repositories.backups.restore(await backupFile.text(), restorePassword)
      window.location.reload()
    } catch (reason) { setBackupError(reason instanceof Error ? reason.message : 'Não foi possível restaurar o backup.') }
  }
  return <><PageHeader title="Definições" description="Preferências locais, comissões e cópias de segurança." /><Card className="mb-5 max-w-2xl"><form className="space-y-5" onSubmit={event => void save(event)}><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Duração predefinida (minutos)<input type="number" min="1" max="480" value={duration} onChange={event => setDuration(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 p-2" /></label><label className="text-sm font-medium">Bloqueio automático (minutos)<input type="number" min="1" max="240" value={autoLock} onChange={event => setAutoLock(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 p-2" /></label></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={lockOnHide} onChange={event => setLockOnHide(event.target.checked)} />Bloquear ao ocultar a página</label><div className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2"><label className="text-sm font-medium">Percentagem da psicóloga<input type="number" min="0" max="100" step="0.01" value={psychologistPercent} onChange={event => setPsychologistPercent(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 p-2" /></label><label className="text-sm font-medium">Percentagem da clínica<input type="number" min="0" max="100" step="0.01" value={clinicPercent} onChange={event => setClinicPercent(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 p-2" /></label></div>{notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<Button type="submit">Guardar definições</Button></form></Card><Card className="mb-5 max-w-2xl"><h2 className="font-semibold">Backup cifrado</h2><p className="mt-1 text-sm text-slate-500">O ficheiro é cifrado com uma palavra-passe própria. Guarda-a separadamente; sem ela, não é possível restaurar o backup.</p><form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={event => void exportBackup(event)}><label className="flex-1 text-sm font-medium">Palavra-passe do backup<input required minLength={12} maxLength={1024} type="password" value={backupPassword} onChange={event => setBackupPassword(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 p-2" /></label><Button type="submit" className="self-end">Exportar backup</Button></form><form className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2" onSubmit={event => void importBackup(event)}><label className="text-sm font-medium">Ficheiro de backup<input required type="file" accept="application/json,.json" onChange={event => setBackupFile(event.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm" /></label><label className="text-sm font-medium">Palavra-passe do backup<input required minLength={12} maxLength={1024} type="password" value={restorePassword} onChange={event => setRestorePassword(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 p-2" /></label><Button type="submit" className="sm:col-span-2">Validar e restaurar</Button></form>{backupMessage && <p role="status" className="mt-3 text-sm text-emerald-700">{backupMessage}</p>}{backupError && <p role="alert" className="mt-3 text-sm text-red-700">{backupError}</p>}</Card></>
}