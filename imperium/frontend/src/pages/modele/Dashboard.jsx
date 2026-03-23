import { useState, useEffect, useRef } from 'react';
import api from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import StatCard from '../../components/StatCard.jsx';
import DonutChart from '../../components/DonutChart.jsx';
import { CardSkeleton } from '../../components/Skeleton.jsx';
import { useToast } from '../../components/Toast.jsx';
import {
  Euro, TrendingUp, ShoppingCart, Calendar, ChevronDown,
  LayoutDashboard, Users, BarChart3, Wallet, Clock,
} from 'lucide-react';
import ShiftsAujourdhui from '../../components/ShiftsAujourdhui.jsx';

/* ─── Period generator (same pattern as FacturationModeles) ─── */
const APP_START_DATE = '2026-03-01';

function generatePeriods() {
  const periods = [];
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  let isFirstHalf = now.getDate() < 15;

  for (let i = 0; i < 24; i++) {
    const m = String(month + 1).padStart(2, '0');
    const monthName = new Date(year, month, 1).toLocaleDateString('fr-FR', { month: 'long' });
    const cap = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    let debut, fin, label;
    if (isFirstHalf) {
      debut = `${year}-${m}-01`;
      fin = `${year}-${m}-15`;
      label = `1 – 15 ${cap} ${year}`;
      isFirstHalf = false;
      month--;
      if (month < 0) { month = 11; year--; }
    } else {
      const next = new Date(year, month + 1, 1);
      const ny = next.getFullYear();
      const nm = String(next.getMonth() + 1).padStart(2, '0');
      const nextMonth = next.toLocaleDateString('fr-FR', { month: 'long' });
      const capNext = nextMonth.charAt(0).toUpperCase() + nextMonth.slice(1);
      debut = `${year}-${m}-15`;
      fin = `${ny}-${nm}-01`;
      label = `15 ${cap} – 1 ${capNext} ${ny}`;
      isFirstHalf = true;
    }

    if (debut < APP_START_DATE) break;
    periods.push({ debut, fin, label });
  }
  return periods;
}

function fmtEur(n) {
  if (n == null) return '—';
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export default function ModeleDashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const periods = generatePeriods();
  const [selectedPeriod, setSelectedPeriod] = useState(periods[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedPeriod]);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: result } = await api.get(
        `/api/modele/dashboard?debut=${selectedPeriod.debut}&fin=${selectedPeriod.fin}`
      );
      setData(result);
    } catch (err) {
      toast(err.response?.data?.error || 'Erreur chargement', 'error');
    } finally {
      setLoading(false);
    }
  }

  const tendance = data?.tendance ?? null;
  const evolution = data?.evolution || [];
  const activite = data?.activite || {};
  const maxEvo = evolution.length > 0 ? Math.max(...evolution.map(e => e.brut_eur || e.value || 0), 1) : 1;

  const donutData = (data?.ventesParPlateforme || []).map((p, i) => ({
    label: p.plateforme || p.label,
    value: p.total || p.value || 0,
    color: p.couleur_fond || p.color || ['#f5b731', '#1b2e4b', '#6366f1', '#10b981'][i % 4],
  }));

  return (
    <div className="page-enter">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 className="text-navy" style={{ fontWeight: 700, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <LayoutDashboard size={22} color="#f5b731" /> Dashboard
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Vue d'ensemble de vos performances
            {!loading && tendance != null && tendance !== 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                fontSize: '0.72rem', fontWeight: 600,
                padding: '0.2rem 0.6rem', borderRadius: '20px',
                background: tendance > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                color: tendance > 0 ? '#10b981' : '#ef4444',
              }}>
                {tendance > 0 ? '↗️' : '↘️'} {tendance > 0 ? '+' : ''}{tendance.toFixed(0)}%
              </span>
            )}
          </p>
        </div>

        {/* Period selector */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', padding: '0.5rem 1rem' }}
          >
            <Calendar size={14} />
            {selectedPeriod.label}
            <ChevronDown size={14} style={{ transition: 'transform 200ms', transform: dropdownOpen ? 'rotate(180deg)' : 'none' }} />
          </button>
          {dropdownOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setDropdownOpen(false)} />
              <div style={{
                position: 'absolute', right: 0, top: '100%', marginTop: '0.35rem',
                background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
                zIndex: 50, minWidth: '240px', maxHeight: '320px', overflowY: 'auto',
                animation: 'modalCardIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)', overflow: 'hidden',
              }}>
                {periods.map((p, i) => {
                  const isActive = p.debut === selectedPeriod.debut;
                  return (
                    <button
                      key={i}
                      onClick={() => { setSelectedPeriod(p); setDropdownOpen(false); }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '0.6rem 1rem', border: 'none', cursor: 'pointer',
                        background: isActive ? 'rgba(245,183,49,0.1)' : 'transparent',
                        color: isActive ? '#f5b731' : 'var(--text-primary)',
                        fontWeight: isActive ? 600 : 400, fontSize: '0.82rem',
                        borderLeft: isActive ? '3px solid #f5b731' : '3px solid transparent',
                        transition: 'background 150ms',
                      }}
                      className={!isActive ? 'hover-row' : ''}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <>
          {/* StatCards */}
          <div className="stagger-children" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <StatCard title="CA Brut" value={fmtEur(data?.totalBrutEur || 0)} icon={Euro} color="#f5b731" />
            <StatCard title="Net HT" value={fmtEur(data?.totalNetHt || 0)} icon={TrendingUp} color="#1b2e4b" />
            <StatCard title="Part Agence" value={fmtEur(data?.partAgence || 0)} icon={Wallet} color="#10b981" subtitle={`${((data?.partAgence || 0) / (data?.totalNetHt || 1) * 100).toFixed(0)}% du Net HT`} />
            <StatCard title="Nb Ventes" value={data?.nbVentes ?? 0} icon={ShoppingCart} color="#6366f1" />
          </div>

          {/* Row 2: Shifts aujourd'hui + Activité */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {/* Shifts widget */}
            <ShiftsAujourdhui shifts={data?.shiftsAujourdhui || []} />

            {/* Activité card */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1b2e4b', margin: 0 }}>Activité sur la période</h3>
              </div>
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '10px', background: 'rgba(245,183,49,0.04)' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'rgba(27,46,75,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Calendar size={18} color="#1b2e4b" />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500, marginBottom: '0.1rem' }}>Shifts programmés</p>
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1b2e4b' }}>{activite.shifts ?? 0}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '10px', background: 'rgba(245,183,49,0.04)' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'rgba(27,46,75,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Users size={18} color="#1b2e4b" />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500, marginBottom: '0.1rem' }}>Chatteurs actifs</p>
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1b2e4b' }}>{activite.chatteurs ?? 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Donut + Evolution */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            <DonutChart
              data={donutData}
              title="Répartition par plateforme"
              valueLabel="€"
              emptyText="Aucune vente pour cette période"
            />

            {evolution.length > 0 && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1b2e4b', margin: 0 }}>Évolution des ventes</h3>
                </div>
                <div style={{ padding: '1.25rem', display: 'flex', alignItems: 'flex-end', gap: '0.5rem', minHeight: '160px' }}>
                  {evolution.map((e, i) => {
                    const pct = ((e.brut_eur || e.value || 0) / maxEvo) * 100;
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#64748b' }}>
                          {fmtEur(e.brut_eur || e.value || 0)}
                        </span>
                        <div style={{
                          width: '100%', maxWidth: '48px', borderRadius: '6px 6px 0 0',
                          height: `${Math.max(pct, 4)}%`, minHeight: '4px',
                          background: i === evolution.length - 1
                            ? 'linear-gradient(180deg, #f5b731, #fcd34d)'
                            : 'linear-gradient(180deg, #1b2e4b, #334155)',
                          transition: 'height 600ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                        }} />
                        <span style={{ fontSize: '0.6rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>{e.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
