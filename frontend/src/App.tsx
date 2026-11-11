import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SearchProvider } from './context/SearchContext';
import { ArchivePage } from './pages/ArchivePage';
import { AssessmentsPage } from './pages/AssessmentsPage';
import { CasesPage } from './pages/CasesPage';
import { DashboardPage } from './pages/DashboardPage';
import { GraduatesPage } from './pages/GraduatesPage';
import { LearnersPage } from './pages/LearnersPage';
import { LoginPage } from './pages/LoginPage';
import { ParentsPage } from './pages/ParentsPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';

function AppRoutes() {
  const { isPasswordRecovery } = useAuth();

  if (isPasswordRecovery) {
    return <ResetPasswordPage />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="learners" element={<LearnersPage />} />
        <Route path="assessments" element={<AssessmentsPage />} />
        <Route path="cases" element={<CasesPage />} />
        <Route path="graduates" element={<GraduatesPage />} />
        <Route path="parents" element={<ParentsPage />} />
        <Route path="archive" element={<ArchivePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SearchProvider>
          <AppRoutes />
        </SearchProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

