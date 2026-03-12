import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { ToastProvider } from './components/Toast.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import PageLoader from './components/PageLoader.jsx';
import Navbar from './components/Navbar.jsx';
import Sidebar from './components/Sidebar.jsx';

// Pages
import Login from './pages/Login.jsx';
import AdminDashboard from './pages/admin/Dashboard.jsx';
import Paies from './pages/admin/Paies.jsx';
import Chatteurs from './pages/admin/Chatteurs.jsx';
import Plateformes from './pages/admin/Plateformes.jsx';
import Modeles from './pages/admin/Modeles.jsx';
import Shifts from './pages/admin/Shifts.jsx';
import Ventes from './pages/admin/Ventes.jsx';
import TelegramBot from './pages/admin/TelegramBot.jsx';
import FacturationModeles from './pages/admin/FacturationModeles.jsx';
import Settings from './pages/admin/Settings.jsx';
import ActivityLog from './pages/admin/ActivityLog.jsx';
import MalusPage from './pages/admin/Malus.jsx';
import Annonces from './pages/admin/Annonces.jsx';
import DemandesAdmin from './pages/admin/Demandes.jsx';
import Objectifs from './pages/admin/Objectifs.jsx';
import ChatteurDetail from './pages/admin/ChatteurDetail.jsx';
import ChatteurDashboard from './pages/chatteur/Dashboard.jsx';
import MonPlanning from './pages/chatteur/MonPlanning.jsx';
import PlanningGeneral from './pages/chatteur/PlanningGeneral.jsx';
import MesFactures from './pages/chatteur/MesFactures.jsx';
import MaPerformance from './pages/chatteur/MaPerformance.jsx';
import MonProfil from './pages/chatteur/MonProfil.jsx';
import MesDemandes from './pages/chatteur/MesDemandes.jsx';

function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f3ef' }}>
      <Sidebar role="admin" mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Navbar onMenuClick={() => setMobileOpen(true)} />
        <main id="main-content" role="main" className="main-content" style={{ flex: 1, overflowY: 'auto' }}>
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
            <Route path="annonces" element={<Annonces />} />
            <Route path="demandes" element={<DemandesAdmin />} />
            <Route path="objectifs" element={<Objectifs />} />
            <Route path="journal" element={<ActivityLog />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes>
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
          <Routes>
            <Route path="dashboard" element={<ChatteurDashboard />} />
            <Route path="planning" element={<MonPlanning />} />
            <Route path="planning-general" element={<PlanningGeneral />} />
            <Route path="factures" element={<MesFactures />} />
            <Route path="performance" element={<MaPerformance />} />
            <Route path="demandes" element={<MesDemandes />} />
            <Route path="profil" element={<MonProfil />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes>
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
          <Routes>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="chatteurs" element={<Chatteurs />} />
            <Route path="chatteurs/:id" element={<ChatteurDetail />} />
            <Route path="shifts" element={<Shifts />} />
            <Route path="ventes" element={<Ventes />} />
            <Route path="paies" element={<Paies />} />
            <Route path="facturation-modeles" element={<FacturationModeles />} />
            <Route path="malus" element={<MalusPage />} />
            <Route path="annonces" element={<Annonces />} />
            <Route path="demandes" element={<DemandesAdmin />} />
            <Route path="objectifs" element={<Objectifs />} />
            <Route path="journal" element={<ActivityLog />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes>
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
    </ToastProvider>
  );
}
