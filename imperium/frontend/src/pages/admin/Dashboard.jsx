import { useState, useEffect } from 'react';
import { Euro, Building2, Users, Trophy } from 'lucide-react';
import api from '../../api/index.js';
import StatCard from '../../components/StatCard.jsx';

function getCurrentPeriodLabel() {
  const now = new Date();
  const day = now.getDate();
  const month = now.toLocaleDateString('fr-FR', { month: 'long' });
  const cap = month.charAt(0).toUpperCase() + month.slice(1);
  const year = now.getFullYear();
  if (day < 15) {
    return `Période: 1-15 ${cap} ${year}`;
  }
  const next = new Date(year, now.getMonth() + 1, 1);
  const nextMonth = next.toLocaleDateString('fr-FR', { month: 'long' });
  const capNext = nextMonth.charAt(0).toUpperCase() + nextMonth.slice(1);
  return `Période: 15 ${cap} - 1 ${capNext} ${next.getFullYear()}`;
}

const DEMO_VENTES = [
  { id: 1, date: '09/03/2026', chatteur: 'Lucas M.', modele: 'Jade', plateforme: 'OnlyFans', montant: '1 240 €' },
  { id: 2, date: '09/03/2026', chatteur: 'Emma R.', modele: 'Lysa', plateforme: 'Fansly', montant: '870 €' },
  { id: 3, date: '08/03/2026', chatteur: 'Nathan B.', modele: 'Chloe', plateforme: 'OnlyFans', montant: '2 100 €' },
  { id: 4, date: '08/03/2026', chatteur: 'Lucas M.', modele: 'Jade', plateforme: 'OnlyFans', montant: '660 €' },
  { id: 5, date: '07/03/2026', chatteur: 'Sofia K.', modele: 'Nina', plateforme: 'Fansly', montant: '1 450 €' },
];

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await api.get('/api/dashboard');
        setData(res.data);
      } catch {
        setError('Impossible de charger les données du dashboard.');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const stats = data
    ? [
        {
          title: 'Total Ventes',
          value: `${(data.total_ventes || 0).toLocaleString('fr-FR')} €`,
          subtitle: 'Période en cours',
          icon: Euro,
          color: '#c9a84c',
        },
        {
          title: 'Net Agence',
          value: `${(data.net_agence || 0).toLocaleString('fr-FR')} €`,
          subtitle: 'Après commissions',
          icon: Building2,
          color: '#10b981',
        },
        {
          title: 'Chatteurs actifs',
          value: data.nb_chatteurs_actifs ?? '—',
          subtitle: 'Sur la période',
          icon: Users,
          color: '#6366f1',
        },
        {
          title: 'Top Chatteur',
          value: data.top_chatteur || '—',
          subtitle: data.top_chatteur_montant ? `${data.top_chatteur_montant.toLocaleString('fr-FR')} €` : '',
          icon: Trophy,
          color: '#f59e0b',
        },
      ]
    : null;

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="page-subtitle">Vue d'ensemble de l'agence</p>
        </div>
        <span className="badge badge-gold" style={{ fontSize: '0.75rem', padding: '0.375rem 0.875rem' }}>
          {getCurrentPeriodLabel()}
        </span>
      </div>

      {/* Error */}
      {error && <div className="error-box" style={{ marginBottom: '1.5rem' }}>{error}</div>}

      {/* Stats */}
      {loading ? (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="card"
              style={{ flex: 1, height: '100px', animation: 'pulse 1.5s ease infinite', opacity: 0.5 }}
            />
          ))}
        </div>
      ) : stats ? (
        <div className="stats-grid">
          {stats.map((s) => (
            <StatCard key={s.title} {...s} />
          ))}
        </div>
      ) : null}

      {/* Recent sales table */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Dernières ventes</h3>
          <span style={{ fontSize: '0.75rem', color: '#9aa5b4' }}>5 dernières entrées</span>
        </div>
        <div className="table-wrapper" style={{ borderRadius: 0, border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Chatteur</th>
                <th>Modèle</th>
                <th>Plateforme</th>
                <th style={{ textAlign: 'right' }}>Montant</th>
              </tr>
            </thead>
            <tbody>
              {(data?.dernieres_ventes || DEMO_VENTES).map((v) => (
                <tr key={v.id}>
                  <td style={{ color: '#9aa5b4', fontSize: '0.8rem' }}>{v.date}</td>
                  <td style={{ fontWeight: 500 }}>{v.chatteur}</td>
                  <td style={{ color: '#9aa5b4' }}>{v.modele}</td>
                  <td>
                    <span className="badge badge-gold">{v.plateforme}</span>
                  </td>
                  <td style={{ textAlign: 'right', color: '#c9a84c', fontWeight: 700 }}>
                    {v.montant}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
