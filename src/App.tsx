import { HashRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './app/AppShell'
import { CalendarPage, DashboardPage, PatientsPage, PaymentsPage, ReportsPage, RoomsPage, SettingsPage } from './pages'
import { SecurityGate } from './app/SecurityGate'

export default function App() {
  return <SecurityGate><HashRouter><Routes><Route element={<AppShell />}><Route index element={<DashboardPage />} /><Route path="utentes" element={<PatientsPage />} /><Route path="agenda" element={<CalendarPage />} /><Route path="salas" element={<RoomsPage />} /><Route path="pagamentos" element={<PaymentsPage />} /><Route path="relatorios" element={<ReportsPage />} /><Route path="definicoes" element={<SettingsPage />} /></Route></Routes></HashRouter></SecurityGate>
}
