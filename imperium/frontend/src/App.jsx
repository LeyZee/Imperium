import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
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
import KPIs from './pages/admin/KPIs.jsx';
import TelegramBot from './pages/admin/TelegramBot.jsx';
import ChatteurDashboard from './pages/chatteur/Dashboard.jsx';
import MonPlanning from './pages/chatteur/MonPlanning.jsx';
import MesFactures from './pages/chatteur/MesFactures.jsx';

function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f3ef' }}>
      <Sidebar role="admin" mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Navbar onMenuClick={() => setMobileOpen(true)} />
        <main className="main-content" style={{ flex: 1, overflowY: 'auto' }}>
          <Routes>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="paies" element={<Paies />} />
            <Route path="chatteurs" element={<Chatteurs />} />
            <Route path="plateformes" element={<Plateformes />} />
            <Route path="modeles" element={<Modeles />} />
            <Route path="shifts" element={<Shifts />} />
            <Route path="ventes" element={<Ventes />} />
            <Route path="kpis" element={<KPIs />} />
            <Route path="telegram" element={<TelegramBot />} />
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
        <main className="main-content" style={{ flex: 1, overflowY: 'auto' }}>
          <Routes>
            <Route path="dashboard" element={<ChatteurDashboard />} />
            <Route path="planning" element={<MonPlanning />} />
            <Route path="factures" element={<MesFactures />} />
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
  return <Navigate to="/chatteur/dashboard" replace />;
}

export default function App() {
  const { loading } = useAuth();
  if (loading) return <PageLoader />;

  return (
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
  );
}
