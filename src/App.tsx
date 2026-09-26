import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ClinicProvider } from './context/ClinicContext'
import { ClinicScopeProvider } from './context/ClinicScopeContext'
import { AppLayout } from './components/layout/AppLayout'
import { PatientLayout } from './components/layout/PatientLayout'
import { RequirePatient, RequireStaff } from './components/RequireAuth'
import { LoginPage } from './pages/LoginPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { DashboardPage } from './pages/DashboardPage'
import { PatientsPage } from './pages/PatientsPage'
import { PatientDetailPage } from './pages/PatientDetailPage'
import { AgendaPage } from './pages/AgendaPage'
import { PhotosPage } from './pages/PhotosPage'
import { ConsentsPage } from './pages/ConsentsPage'
import { ContractsPage } from './pages/ContractsPage'
import { BudgetsPage } from './pages/BudgetsPage'
import { CrmPage } from './pages/CrmPage'
import { PatientConsentsPage } from './pages/patient/PatientConsentsPage'
import { SignConsentPage } from './pages/patient/SignConsentPage'
import { PatientContractsPage } from './pages/patient/PatientContractsPage'

export default function App() {
  return (
    <AuthProvider>
      <ClinicScopeProvider>
        <ClinicProvider>
          <BrowserRouter basename="/evelynclinica">
            <Routes>
              <Route path="login" element={<LoginPage />} />
              <Route path="recuperar-senha" element={<ForgotPasswordPage />} />

              <Route element={<RequireStaff />}>
                <Route element={<AppLayout />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="crm" element={<CrmPage />} />
                  <Route path="pacientes" element={<PatientsPage />} />
                  <Route path="pacientes/:id" element={<PatientDetailPage />} />
                  <Route path="agenda" element={<AgendaPage />} />
                  <Route path="fotos" element={<PhotosPage />} />
                  <Route path="termos" element={<ConsentsPage />} />
                  <Route path="contratos" element={<ContractsPage />} />
                  <Route path="orcamentos" element={<BudgetsPage />} />
                </Route>
              </Route>

              <Route element={<RequirePatient />}>
                <Route path="portal" element={<PatientLayout />}>
                  <Route index element={<PatientConsentsPage />} />
                  <Route path="termos/:id" element={<SignConsentPage />} />
                  <Route path="contratos" element={<PatientContractsPage />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </BrowserRouter>
        </ClinicProvider>
      </ClinicScopeProvider>
    </AuthProvider>
  )
}
