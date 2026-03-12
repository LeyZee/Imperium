import { useState, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { ToastProvider } from './components/Toast.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import PageLoader from './components/PageLoader.jsx';
import Navbar from './components/Navbar.jsx';
import Sidebar from './components/Sidebar.jsx';

// Lazy-loaded pages — code splitting
const Login = lazy(() => import('./pages/Login.jsx'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard.jsx'));
const Paies = lazy(() => import('./pages/admin/Paies.jsx'));
const Chatteurs = lazy(() => import('./pages/admin/Chatteurs.jsx'));
const Plateformes = lazy(() => import('./pages/admin/Plateformes.jsx'));
const Modeles = lazy(() => import('./pages/admin/Modeles.jsx'));
const Shifts = lazy(() => import('./pages/admin/Shifts.jsx'));
const Ventes = lazy(() => import('./pages/admin/Ventes.jsx'));
const TelegramBot = lazy(() => import('./pages/admin/TelegramBot.jsx'));
const FacturationModeles = lazy(() => import('./pages/admin/FacturationModeles.jsx'));
const Settings = lazy(() => import('./pages/admin/Settings.jsx'));
const ActivityLog = lazy(() => import('./pages/admin/ActivityLog.jsx'));
const MalusPage = lazy(() => import('./pages/admin/Malus.jsx'));
const Objectifs = lazy(() => import('./pages/admin/Objectifs.jsx'));
const ChatteurDetail = lazy(() => import('./pages/admin/ChatteurDetail.jsx'));
const ChatteurDashboard = lazy(() => import('./pages/chatteur/Dashboard.jsx'));
const MonPlanning = lazy(() => import('./pages/chatteur/MonPlanning.jsx'));
const PlanningGeneral = lazy(() => import('./pages/chatteur/PlanningGeneral.jsx'));
const MesFactures = lazy(() => import('./pages/chatteur/MesFactures.jsx'));
const MaPerformance = lazy(() => import('./pages/chatteur/MaPerformance.jsx'));
const MonProfil = lazy(() => import('./pages/chatteur/MonProfil.jsx'));

function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f3ef' }}>
      <Sidebar role="admin" mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Navbar onMenuClick={() => setMobileOpen(true)} />
        <main id="main-content" role="main" className="main-content" style={{ flex: 1, overflowY: 'auto' }}>
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="paies" element={<Paies />} />
                <Route path="chatteurs" element={<Chatteurs />} />
                <Route path="chatteurs/:id" element={<ChatteurDetail />} />
                <Route path="plateformes" element={<Plateformes />} />
                <Route path="modeles" element={<Modeles />} />
                <Route path="shifts" element={<Shifts />} />
                <Route path="ventes" element={<Ventes />} />
                <Route path="telegram" element={<TelegramBot />} />
                <Route path="facturation-modeles" element={<FacturationModeles />} />
                <Route path="malus" element={<MalusPage />} />
                <Route path="objectifs" element={<Objectifs />} />
                <Route path="journal" element={<ActivityLog />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="dashboard" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function ChatteurLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f3ef' }}>
      <Sidebar role="chatteur" mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Navbar onMenuClick={() => setMobileOpen(true)} />
        <main id="main-content" role="main" className="main-content" style={{ flex: 1, overflowY: 'auto' }}>
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="dashboard" element={<ChatteurDashboard />} />
                <Route path="planning" element={<MonPlanning />} />
                <Route path="planning-general" element={<PlanningGeneral />} />
                <Route path="factures" element={<MesFactures />} />
                <Route path="performance" element={<MaPerformance />} />
                <Route path="profil" element={<MonProfil />} />
                <Route path="*" element={<Navigate to="dashboard" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function ManagerLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f3ef' }}>
      <Sidebar role="manager" mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Navbar onMenuClick={() => setMobileOpen(true)} />
        <main id="main-content" role="main" className="main-content" style={{ flex: 1, overflowY: 'auto' }}>
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="chatteurs" element={<Chatteurs />} />
                <Route path="chatteurs/:id" element={<ChatteurDetail />} />
                <Route path="shifts" element={<Shifts />} />
                <Route path="ventes" element={<Ventes />} />
                <Route path="paies" element={<Paies />} />
                <Route path="facturation-modeles" element={<FacturationModeles />} />
                <Route path="malus" element={<MalusPage />} />
                <Route path="objectifs" element={<Objectifs />} />
                <Route path="journal" element={<ActivityLog />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="dashboard" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  if (user.role === 'manager') return <Navigate to="/manager/dashboard" replace />;
  return <Navigate to="/chatteur/dashboard" replace />;
}

export default function App() {
  const { loading } = useAuth();
  if (loading) return <PageLoader />;

  return (
    <ToastProvider>
      <a href="#main-content" className="skip-link">Aller au contenu principal</a>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute role="admin">
                <AdminLayout />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/*"
            element={
              <ProtectedRoute role="manager">
                <ManagerLayout />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chatteur/*"
            element={
              <ProtectedRoute role="chatteur">
                <ChatteurLayout />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ToastProvider>
  );
}
