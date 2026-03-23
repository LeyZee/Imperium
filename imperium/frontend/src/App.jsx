import { useState, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { ToastProvider } from './components/Toast.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import PageLoader from './components/PageLoader.jsx';
import FloatingContact from './components/FloatingContact.jsx';
import Navbar from './components/Navbar.jsx';
import Sidebar from './components/Sidebar.jsx';

// Lazy-loaded pages — code splitting
const AgencyHome = lazy(() => import('./pages/AgencyHome.jsx'));
const TeamPage = lazy(() => import('./pages/TeamPage.jsx'));
const ImperiumPage = lazy(() => import('./pages/ImperiumPage.jsx'));
const ContactPage = lazy(() => import('./pages/ContactPage.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const SetupPassword = lazy(() => import('./pages/SetupPassword.jsx'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail.jsx'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard.jsx'));
const Paies = lazy(() => import('./pages/admin/Paies.jsx'));
const Parametres = lazy(() => import('./pages/admin/Parametres.jsx'));
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
const Annonces = lazy(() => import('./pages/admin/Annonces.jsx'));
const ChatteurDetail = lazy(() => import('./pages/admin/ChatteurDetail.jsx'));
const ChatteurDashboard = lazy(() => import('./pages/chatteur/Dashboard.jsx'));
const MonPlanning = lazy(() => import('./pages/chatteur/MonPlanning.jsx'));
const PlanningGeneral = lazy(() => import('./pages/chatteur/PlanningGeneral.jsx'));
const MesFactures = lazy(() => import('./pages/chatteur/MesFactures.jsx'));
const MaPerformance = lazy(() => import('./pages/chatteur/MaPerformance.jsx'));
const MonProfil = lazy(() => import('./pages/chatteur/MonProfil.jsx'));
const MesVentes = lazy(() => import('./pages/chatteur/MesVentes.jsx'));
const ModeleDashboard = lazy(() => import('./pages/modele/Dashboard.jsx'));
const ModeleFacturation = lazy(() => import('./pages/modele/Facturation.jsx'));
const ModeleProfil = lazy(() => import('./pages/modele/Profil.jsx'));
const ModeleMesVentes = lazy(() => import('./pages/modele/MesVentes.jsx'));
const ModeleMonPlanning = lazy(() => import('./pages/modele/MonPlanning.jsx'));

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
                <Route path="parametres" element={<Parametres />} />
                <Route path="chatteurs/:id" element={<ChatteurDetail />} />
                <Route path="chatteurs" element={<Navigate to="/admin/parametres?tab=equipe" replace />} />
                <Route path="modeles" element={<Navigate to="/admin/parametres?tab=modeles" replace />} />
                <Route path="plateformes" element={<Navigate to="/admin/parametres?tab=plateformes" replace />} />
                <Route path="shifts" element={<Shifts />} />
                <Route path="ventes" element={<Ventes />} />
                <Route path="telegram" element={<Navigate to="/admin/parametres?tab=telegram" replace />} />
                <Route path="facturation-modeles" element={<FacturationModeles />} />
                <Route path="malus" element={<MalusPage />} />
                <Route path="objectifs" element={<Objectifs />} />
                <Route path="annonces" element={<Annonces />} />
                <Route path="journal" element={<Navigate to="/admin/parametres?tab=journal" replace />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
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
                <Route path="mes-ventes" element={<MesVentes />} />
                <Route path="factures" element={<MesFactures />} />
                <Route path="performance" element={<MaPerformance />} />
                <Route path="profil" element={<MonProfil />} />
                <Route path="*" element={<Navigate to="/chatteur/dashboard" replace />} />
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
                <Route path="parametres" element={<Parametres />} />
                <Route path="chatteurs/:id" element={<ChatteurDetail />} />
                <Route path="chatteurs" element={<Navigate to="/manager/parametres?tab=equipe" replace />} />
                <Route path="shifts" element={<Shifts />} />
                <Route path="ventes" element={<Ventes />} />
                <Route path="paies" element={<Paies />} />
                <Route path="facturation-modeles" element={<FacturationModeles />} />
                <Route path="malus" element={<MalusPage />} />
                <Route path="objectifs" element={<Objectifs />} />
                <Route path="annonces" element={<Annonces />} />
                <Route path="journal" element={<Navigate to="/manager/parametres?tab=journal" replace />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/manager/dashboard" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function ModeleLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f3ef' }}>
      <Sidebar role="modele" mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Navbar onMenuClick={() => setMobileOpen(true)} />
        <main id="main-content" role="main" className="main-content" style={{ flex: 1, overflowY: 'auto' }}>
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="dashboard" element={<ModeleDashboard />} />
                <Route path="planning" element={<ModeleMonPlanning />} />
                <Route path="mes-ventes" element={<ModeleMesVentes />} />
                <Route path="facturation" element={<ModeleFacturation />} />
                <Route path="profil" element={<ModeleProfil />} />
                <Route path="*" element={<Navigate to="/modele/dashboard" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', fontWeight: 700, color: '#1b2e4b' }}>404</div>
        <p style={{ color: '#64748b', margin: '0.5rem 0 1.5rem' }}>Page introuvable</p>
        <a href="/" style={{ color: '#f5b731', fontWeight: 600, textDecoration: 'none' }}>Retour à l'accueil</a>
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
  if (user.role === 'modele') return <Navigate to="/modele/dashboard" replace />;
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
          <Route path="/setup-password/:token" element={<SetupPassword />} />
          <Route path="/verify-email/:token" element={<VerifyEmail />} />
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
            path="/modele/*"
            element={
              <ProtectedRoute role="modele">
                <ModeleLayout />
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
          <Route path="/" element={<AgencyHome />} />
          <Route path="/equipe" element={<TeamPage />} />
          <Route path="/imperium" element={<ImperiumPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/dashboard" element={<RootRedirect />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <FloatingContact />
    </ToastProvider>
  );
}
