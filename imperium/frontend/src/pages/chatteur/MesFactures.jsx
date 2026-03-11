import { useState, useEffect } from 'react';
import api from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { TableSkeleton } from '../../components/Skeleton.jsx';
import { Download, FileText, AlertTriangle, ChevronDown, ChevronUp, Calculator } from 'lucide-react';

const STATUT_STYLES = {
  'calculé': { background: 'rgba(245,183,49,0.12)', color: '#b8860b' },
  'validé': { background: 'rgba(27,46,75,0.1)', color: '#1b2e4b' },
  'payé': { background: 'rgba(16,185,129,0.1)', color: '#059669' },
};

function formatPeriod(debut, fin) {
  const d = new Date(debut + 'T00:00:00');
  const f = new Date(fin + 'T00:00:00');
  const dStr = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const fStr = f.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${dStr} → ${fStr}`;
}

function fmt(n) {
  return (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(n) {
  return (n * 100).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Full breakdown detail for a single paie row */
function PaieDetail({ paie, tauxCommission, malusForPeriod }) {
  const isUSD = paie.devise === 'USD';
  return (
    <tr style={{ animation: 'expandIn 300ms ease forwards' }}>
      <td colSpan={6} style={{ padding: 0, background: '#fafaf8' }}>
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px dashed #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Calculator size={14} color="#64748b" />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', letterSpacing: '0.05em' }}>
              {"D\u00c9TAIL DU CALCUL"} — {paie.plateforme_nom || 'Global'}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '0.5rem' }}>
            {/* Left column: conversion chain */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <Step label="Ventes brutes" value={`${fmt(paie.ventes_brutes)} ${isUSD ? '$' : '\u20ac'}`} />
              {isUSD && (
                <Step label={`Taux de change (\u00d7${paie.taux_change})`} value={`${fmt(paie.ventes_ttc_eur)} \u20ac`} op={"\u00d7"} />
              )}
              <Step label={`TVA (${pct(paie.tva_rate || 0)}%)`} value={`${fmt(paie.ventes_ht_eur)} \u20ac HT`} op={"\u00f7"} />
              <Step label={`Commission plateforme (${pct(paie.commission_rate || 0)}%)`} value={`${fmt(paie.net_ht_eur)} \u20ac net`} op={"\u2212"} />
            </div>
            {/* Right column: commission details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <Step label={`Ta commission (${pct(tauxCommission)}%)`} value={`${fmt(paie.commission_chatteur)} \u20ac`} highlight />
              {(paie.prime || 0) > 0 && (
                <Step label={"Prime top 3 \uD83C\uDFC6"} value={`+${fmt(paie.prime)} \u20ac`} color="#10b981" />
              )}
              {(paie.malus_total || 0) > 0 && (
                malusForPeriod.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#ef4444', padding: '0.15rem 0.5rem' }}>Malus :</span>
                    {malusForPeriod.map(m => (
                      <div key={m.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.2rem 0.5rem 0.2rem 1rem',
                      }}>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{m.raison || 'Malus'}</span>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#ef4444', whiteSpace: 'nowrap' }}>{`\u2212${fmt(m.montant)} \u20ac`}</span>
                      </div>
                    ))}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.25rem 0.5rem', borderTop: '1px dashed rgba(239,68,68,0.3)', marginTop: '0.1rem',
                    }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ef4444' }}>Total malus</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#ef4444' }}>{`\u2212${fmt(paie.malus_total)} \u20ac`}</span>
                    </div>
                  </div>
                ) : (
                  <Step label="Malus" value={`\u2212${fmt(paie.malus_total)} \u20ac`} color="#ef4444" />
                )
              )}
              <div style={{
                borderTop: '2px solid #1b2e4b', paddingTop: '0.4rem', marginTop: '0.2rem',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontWeight: 700, color: '#1b2e4b', fontSize: '0.85rem' }}>Total</span>
                <span style={{ fontWeight: 700, color: '#f5b731', fontSize: '1rem' }}>{fmt(paie.total_chatteur)} {"\u20ac"}</span>
              </div>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

function Step({ label, value, op, highlight, color }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '0.3rem 0.5rem', borderRadius: '6px',
      background: highlight ? 'rgba(245,183,49,0.08)' : 'transparent',
    }}>
      <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        {op && <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.7rem' }}>{op}</span>}
        {label}
      </span>
      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: color || (highlight ? '#b8860b' : '#334155'), whiteSpace: 'nowrap' }}>
        {value}
      </span>
    </div>
  );
}

export default function MesFactures() {
  const { user } = useAuth();
  const [paies, setPaies] = useState([]);
  const [tauxCommission, setTauxCommission] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [malusList, setMalusList] = useState([]);
  const [downloadingPeriod, setDownloadingPeriod] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/api/paies/mes-paies'),
      api.get('/api/malus').catch(() => ({ data: [] })),
    ]).then(([paiesRes, malusRes]) => {
      const data = paiesRes.data;
      setPaies(Array.isArray(data.paies) ? data.paies : Array.isArray(data) ? data : []);
      setTauxCommission(data.taux_commission || 0);
      setMalusList(Array.isArray(malusRes.data) ? malusRes.data : []);
    })
    .catch(() => setError('Impossible de charger les factures.'))
    .finally(() => setLoading(false));
  }, [user]);

  async function handleDownloadPdf(paie) {
    const key = `${paie.periode_debut}-${paie.periode_fin}`;
    setDownloadingPeriod(key);
    try {
      const resp = await api.get(
        `/api/paies/facture?chatteur_id=${user.chatteur_id}&debut=${paie.periode_debut}&fin=${paie.periode_fin}`,
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Facture_${paie.periode_debut}_${paie.periode_fin}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors du t\u00e9l\u00e9chargement de la facture');
    } finally {
      setDownloadingPeriod(null);
    }
  }

  const totalPaye = paies.filter(p => p.statut === 'payé').reduce((sum, p) => sum + (p.total_chatteur || 0), 0);
  const enAttente = paies.filter(p => p.statut !== 'payé').length;

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        <div>
          <h1 className="text-navy" style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Mes Factures</h1>
          {!loading && paies.length > 0 && (
            <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
              {totalPaye > 0 && `${fmt(totalPaye)} € perçus`}
              {totalPaye > 0 && enAttente > 0 && ' · '}
              {enAttente > 0 && `${enAttente} en attente`}
              {' · '} Commission : {pct(tauxCommission)}%
            </p>
          )}
        </div>
      </div>

      {/* Info */}
      {!loading && paies.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.6rem 1rem', borderRadius: '10px', marginBottom: '1rem',
          background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)',
        }}>
          <Calculator size={16} color="#6366f1" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.78rem', color: '#4338ca' }}>
            Clique sur une ligne pour voir le détail complet du calcul.
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1rem',
          background: '#fef2f2', border: '1px solid #fecaca',
        }}>
          <AlertTriangle size={18} color="#dc2626" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.82rem', color: '#991b1b' }}>{error}</span>
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : paies.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <FileText size={40} color="#cbd5e1" style={{ margin: '0 auto 0.75rem' }} />
          <p style={{ fontWeight: 600, color: 'var(--navy)', marginBottom: '0.25rem' }}>Aucune facture</p>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
            Tes factures apparaîtront ici une fois tes paies calculées.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Période</th>
                  <th>Plateforme</th>
                  <th style={{ textAlign: 'right' }}>Ventes brutes</th>
                  <th style={{ textAlign: 'right' }}>Ma paie</th>
                  <th>Statut</th>
                  <th style={{ textAlign: 'center', width: '50px' }}>PDF</th>
                </tr>
              </thead>
              <tbody className="stagger-rows">
                {paies.map((p) => {
                  const statutStyle = STATUT_STYLES[p.statut] || STATUT_STYLES['calculé'];
                  const isExpanded = expandedId === p.id;
                  const malusForPeriod = malusList.filter(m => m.periode >= p.periode_debut && m.periode <= p.periode_fin);
                  return [
                    <tr
                      key={p.id}
                      onClick={() => setExpandedId(isExpanded ? null : p.id)}
                      style={{ cursor: 'pointer', background: isExpanded ? 'rgba(245,183,49,0.04)' : undefined }}
                    >
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {isExpanded ? <ChevronUp size={14} color="#94a3b8" /> : <ChevronDown size={14} color="#94a3b8" />}
                          {formatPeriod(p.periode_debut, p.periode_fin)}
                        </div>
                      </td>
                      <td>
                        <span className="badge" style={{
                          fontSize: '0.72rem',
                          background: p.couleur_fond || '#1b2e4b',
                          color: p.couleur_texte || '#ffffff',
                        }}>
                          {p.plateforme_nom || '—'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {fmt(p.ventes_brutes)} {p.devise === 'USD' ? '$' : '€'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#f5b731' }}>
                        {fmt(p.total_chatteur)} €
                      </td>
                      <td>
                        <span style={{
                          ...statutStyle,
                          padding: '0.2rem 0.6rem', borderRadius: '20px',
                          fontSize: '0.72rem', fontWeight: 600, textTransform: 'capitalize',
                        }}>
                          {p.statut}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="haptic"
                          onClick={(e) => { e.stopPropagation(); handleDownloadPdf(p); }}
                          disabled={downloadingPeriod === `${p.periode_debut}-${p.periode_fin}`}
                          title="Télécharger la facture PDF"
                          style={{
                            background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)',
                            borderRadius: '8px', padding: '0.35rem', cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 200ms ease',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.16)'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.08)'; e.currentTarget.style.transform = 'scale(1)'; }}
                        >
                          {downloadingPeriod === `${p.periode_debut}-${p.periode_fin}`
                            ? <span className="spinner" style={{ width: 14, height: 14 }} />
                            : <Download size={14} color="#6366f1" />}
                        </button>
                      </td>
                    </tr>,
                    isExpanded && (
                      <PaieDetail key={`detail-${p.id}`} paie={p} tauxCommission={tauxCommission} malusForPeriod={malusForPeriod} />
                    ),
                  ];
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
