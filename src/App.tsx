import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ClinicProvider } from './context/ClinicContext'
import { AppLayout } from './components/layout/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { PatientsPage } from './pages/PatientsPage'
import { PatientDetailPage } from './pages/PatientDetailPage'
import { AgendaPage } from './pages/AgendaPage'
import { PhotosPage } from './pages/PhotosPage'
import { ConsentsPage } from './pages/ConsentsPage'
import { ContractsPage } from './pages/ContractsPage'
import { BudgetsPage } from './pages/BudgetsPage'

export default function App() {
  return (
    <ClinicProvider>
      <BrowserRouter basename="/evelynclinica">
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="pacientes" element={<PatientsPage />} />
            <Route path="pacientes/:id" element={<PatientDetailPage />} />
            <Route path="agenda" element={<AgendaPage />} />
            <Route path="fotos" element={<PhotosPage />} />
            <Route path="termos" element={<ConsentsPage />} />
            <Route path="contratos" element={<ContractsPage />} />
            <Route path="orcamentos" element={<BudgetsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ClinicProvider>
  )
}
