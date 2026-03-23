import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { TableSkeleton } from '../../components/Skeleton.jsx';
import { FileText, AlertTriangle, ChevronDown, ChevronUp, Calculator, BookOpen, ArrowLeftRight, Euro, TrendingUp, CreditCard } from 'lucide-react';

const STATUT_STYLES = {
  'estimé': { background: 'rgba(148,163,184,0.12)', color: '#64748b' },
  'calculé': { background: 'rgba(249,115,22,0.1)', color: '#c2410c' },
  'validé': { background: 'rgba(59,130,246,0.1)', color: '#1d4ed8' },
  'payé': { background: 'rgba(16,185,129,0.1)', color: '#059669' },
};

function getPeriodeCourante() {
  const now = new Date();
  const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0');
  const day = now.getDate();
  if (day < 15) return { debut: `${y}-${m}-01`, fin: `${y}-${m}-15` };
  const next = new Date(y, now.getMonth() + 1, 1);
  const ny = next.getFullYear(), nm = String(next.getMonth() + 1).padStart(2, '0');
  return { debut: `${y}-${m}-15`, fin: `${ny}-${nm}-01` };
}

function formatPeriod(debut, fin) {
  const d = new Date(debut + 'T00:00:00');
  const f = new Date(fin + 'T00:00:00');
  const dStr = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const fStr = f.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${dStr} \u2192 ${fStr}`;
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
      <td colSpan={5} style={{ padding: 0, background: '#fafaf8' }}>
        <div style={{ padding: '0.75rem 0.75rem', borderTop: '1px dashed #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
            <Calculator size={14} color="#64748b" />
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', letterSpacing: '0.05em' }}>
              {"D\u00c9TAIL DU CALCUL"} — {paie.plateforme_nom || 'Global'}
            </span>
          </div>
          {/* Single column layout — works on all screen sizes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {/* Conversion chain */}
            <Step label="Ventes brutes" value={`${fmt(paie.ventes_brutes)} ${isUSD ? '$' : '\u20ac'}`} />
            {isUSD && (
              <Step label={`Change (\u00d7${paie.taux_change})`} value={`${fmt(paie.ventes_ttc_eur)} \u20ac`} op={"\u00d7"} />
            )}
            <Step label={`TVA (${pct(paie.tva_rate || 0)}%)`} value={`${fmt(paie.ventes_ht_eur)} \u20ac HT`} op={"\u00f7"} />
            <Step label={`Com. plateforme (${pct(paie.commission_rate || 0)}%)`} value={`${fmt(paie.net_ht_eur)} \u20ac net`} op={"\u2212"} />

            {/* Separator */}
            <div style={{ borderTop: '1px dashed #e2e8f0', margin: '0.25rem 0' }} />

            {/* Commission details */}
            <Step label={`Ta commission (${pct(tauxCommission)}%)`} value={`${fmt(paie.commission_chatteur)} \u20ac`} highlight />
            {(paie.prime || 0) > 0 && (
              <Step label={"Prime \uD83C\uDFC6"} value={`+${fmt(paie.prime)} \u20ac`} color="#10b981" />
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
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{m.raison || 'Malus'}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ef4444', whiteSpace: 'nowrap' }}>
                        {m.type_malus === 'pourcentage' ? `\u2212${fmt(m.montant)}%` : `\u2212${fmt(m.montant)} \u20ac`}
                      </span>
                    </div>
                  ))}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.25rem 0.5rem', borderTop: '1px dashed rgba(239,68,68,0.3)', marginTop: '0.1rem',
                  }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#ef4444' }}>Total malus</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ef4444' }}>{`\u2212${fmt(paie.malus_total)} \u20ac`}</span>
                  </div>
                </div>
              ) : (
                <Step label="Malus" value={`\u2212${fmt(paie.malus_total)} \u20ac`} color="#ef4444" />
              )
            )}

            {/* Total */}
            <div style={{
              borderTop: '2px solid #1b2e4b', paddingTop: '0.4rem', marginTop: '0.2rem',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontWeight: 700, color: '#1b2e4b', fontSize: '0.85rem' }}>Total</span>
              <span style={{ fontWeight: 700, color: '#f5b731', fontSize: '1rem' }}>{fmt(paie.total_chatteur)} {"\u20ac"}</span>
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
      padding: '0.25rem 0.4rem', borderRadius: '6px',
      background: highlight ? 'rgba(245,183,49,0.08)' : 'transparent',
      gap: '0.5rem',
    }}>
      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem', minWidth: 0 }}>
        {op && <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.65rem', flexShrink: 0 }}>{op}</span>}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      </span>
      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: color || (highlight ? '#b8860b' : '#334155'), whiteSpace: 'nowrap', flexShrink: 0 }}>
        {value}
      </span>
    </div>
  );
}

function MalusHistory({ malusList }) {
  const [expanded, setExpanded] = useState(false);
  const totalMalus = malusList.reduce((sum, m) => sum + (m.type_malus === 'montant' ? m.montant : 0), 0);

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <button
        className="haptic"
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem',
          padding: '0.75rem 1.25rem', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600, color: '#1b2e4b' }}>
          Historique des malus
        </span>
        <span style={{
          fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.5rem',
          borderRadius: 20, background: 'rgba(239,68,68,0.1)', color: '#ef4444',
        }}>
          {malusList.length}
        </span>
        {expanded ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
      </button>
      {expanded && (
        <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Période</th>
                  <th>Raison</th>
                  <th style={{ textAlign: 'right' }}>Montant</th>
                </tr>
              </thead>
              <tbody>
                {malusList
                  .sort((a, b) => (b.periode || '').localeCompare(a.periode || ''))
                  .map(m => (
                    <tr key={m.id}>
                      <td style={{ fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {m.periode ? new Date(m.periode + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '\u2014'}
                      </td>
                      <td style={{ fontSize: '0.82rem', color: '#1b2e4b' }}>
                        {m.raison || 'Non précisé'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#ef4444', whiteSpace: 'nowrap' }}>
                        {m.type_malus === 'pourcentage' ? `\u2212${fmt(m.montant)}%` : `\u2212${fmt(m.montant)} \u20ac`}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {totalMalus > 0 && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.6rem 1.25rem', borderTop: '1px solid rgba(0,0,0,0.06)',
              background: 'rgba(239,68,68,0.03)',
            }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b' }}>Total malus fixes</span>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ef4444' }}>{`\u2212${fmt(totalMalus)} \u20ac`}</span>
            </div>
          )}
        </div>
      )}
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
  const [showExplain, setShowExplain] = useState(false);
  const [tauxChange, setTauxChange] = useState(null);

  const periodeCourante = useMemo(() => getPeriodeCourante(), []);

  const fetchPaies = useCallback(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    Promise.all([
      api.get('/api/paies/mes-paies', { signal: controller.signal }),
      api.get('/api/malus', { signal: controller.signal }).catch(() => ({ data: [] })),
      api.get('/api/taux/current?from=USD&to=EUR', { signal: controller.signal }).catch(() => ({ data: null })),
    ]).then(([paiesRes, malusRes, tauxRes]) => {
      setTauxChange(tauxRes.data?.taux || null);
      const data = paiesRes.data;
      setPaies(Array.isArray(data.paies) ? data.paies : Array.isArray(data) ? data : []);
      setTauxCommission(data.taux_commission || 0);
      setMalusList(Array.isArray(malusRes.data) ? malusRes.data : []);
    })
    .catch(() => { if (!controller.signal.aborted) setError('Impossible de charger les paies.'); })
    .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user]);

  useEffect(() => {
    fetchPaies();
  }, [fetchPaies]);

  // Group paies by period
  const groupedPaies = useMemo(() => {
    const groups = {};
    paies.forEach(p => {
      const key = `${p.periode_debut}|${p.periode_fin}`;
      if (!groups[key]) groups[key] = { debut: p.periode_debut, fin: p.periode_fin, paies: [], total: 0 };
      groups[key].paies.push(p);
      groups[key].total += (p.total_chatteur || 0);
    });
    // Sort descending by debut date (most recent first)
    return Object.values(groups).sort((a, b) => b.debut.localeCompare(a.debut));
  }, [paies]);

  const totalPaye = paies.filter(p => p.statut === 'payé').reduce((sum, p) => sum + (p.total_chatteur || 0), 0);
  const currentGroup = groupedPaies.find(g => g.debut === periodeCourante.debut && g.fin === periodeCourante.fin);
  const currentTotal = currentGroup?.total || 0;

  return (
    <div className="page-enter">
      <div style={{ marginBottom: '1rem' }}>
        <h1 className="text-navy" style={{ fontWeight: 700, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CreditCard size={22} color="#f5b731" /> Mes Paies</h1>
        {!loading && paies.length > 0 && (
          <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Commission : {pct(tauxCommission)}%
          </p>
        )}
      </div>

      {/* Summary cards */}
      {!loading && paies.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
          <div className="card" style={{
            padding: '1rem 1.25rem',
            borderLeft: '3px solid #f5b731',
          }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', letterSpacing: '0.03em', marginBottom: '0.35rem' }}>
              PÉRIODE EN COURS
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f5b731' }}>
              {fmt(currentTotal)} {"€"}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.15rem' }}>
              {formatPeriod(periodeCourante.debut, periodeCourante.fin)}
            </div>
          </div>
          <div className="card" style={{
            padding: '1rem 1.25rem',
            borderLeft: '3px solid #10b981',
          }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', letterSpacing: '0.03em', marginBottom: '0.35rem' }}>
              TOTAL PERÇU
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>
              {fmt(totalPaye)} {"€"}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.15rem' }}>
              {paies.filter(p => p.statut === 'payé').length} paie{paies.filter(p => p.statut === 'payé').length > 1 ? 's' : ''} valid{paies.filter(p => p.statut === 'payé').length > 1 ? 'ées' : 'ée'}
            </div>
          </div>
        </div>
      )}

      {/* Taux de change */}
      {!loading && tauxChange && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.6rem 1rem', borderRadius: '10px', marginBottom: '0.5rem',
          background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.1)',
        }}>
          <ArrowLeftRight size={14} color="#6366f1" />
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
            Taux de change actuel : <strong style={{ color: '#1b2e4b' }}>1 $ = {tauxChange.toFixed(4)} {"€"}</strong>
          </span>
        </div>
      )}

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

      {/* Pedagogical explanation */}
      {!loading && (
        <div style={{
          borderRadius: '10px', marginBottom: '1rem', overflow: 'hidden',
          border: '1px solid rgba(99,102,241,0.15)', background: '#fff',
        }}>
          <button
            className="haptic"
            onClick={() => setShowExplain(!showExplain)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem',
              padding: '0.7rem 1rem', background: 'none', border: 'none',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <BookOpen size={16} color="#6366f1" style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 600, color: '#1b2e4b' }}>
              Comment est calculée ta paie ?
            </span>
            {showExplain ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
          </button>
          {showExplain && (
            <div style={{
              padding: '0 1rem 1rem', borderTop: '1px solid rgba(99,102,241,0.1)',
              display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingTop: '0.75rem',
            }}>
              {[
                { num: '1', title: 'Ventes brutes', desc: 'Le total que tu génères sur la plateforme (OnlyFans en USD, Reveal en EUR).' },
                { num: '2', title: 'Conversion devise', desc: 'Si la plateforme est en USD, on convertit en euros au taux du jour.' },
                { num: '3', title: 'Déductions', desc: 'On retire la TVA (20%) puis la commission plateforme (20%) pour obtenir le « Net HT ».' },
                { num: '4', title: 'Ta commission', desc: `Tu reçois ${pct(tauxCommission)}% du Net HT. C\u2019est ton taux de commission personnel.` },
                { num: '5', title: 'Primes & Malus', desc: "En atteignant des paliers de Net HT individuel, tu débloques des primes fixes. Un bonus d'équipe collectif peut aussi s'ajouter. Les malus éventuels sont soustraits." },
              ].map(step => (
                <div key={step.num} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(99,102,241,0.1)', color: '#6366f1',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', fontWeight: 700, marginTop: '0.1rem',
                  }}>{step.num}</span>
                  <div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1b2e4b' }}>{step.title}</span>
                    <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.1rem 0 0', lineHeight: 1.4 }}>{step.desc}</p>
                  </div>
                </div>
              ))}
              <div style={{
                marginTop: '0.25rem', padding: '0.5rem 0.75rem', borderRadius: '8px',
                background: 'rgba(245,183,49,0.08)', border: '1px solid rgba(245,183,49,0.15)',
              }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1b2e4b', margin: 0 }}>
                  Formule finale : Total = (Net HT {"\u00d7"} ton taux) + Prime {"\u2212"} Malus
                </p>
              </div>
            </div>
          )}
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
          <button onClick={fetchPaies} className="btn-ghost" style={{ marginLeft: '1rem', fontSize: '0.8rem' }}>Réessayer</button>
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : paies.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <FileText size={40} color="#cbd5e1" style={{ margin: '0 auto 0.75rem' }} />
          <p style={{ fontWeight: 600, color: 'var(--navy)', marginBottom: '0.25rem' }}>Aucune paie</p>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
            Tes paies apparaîtront ici une fois calculées.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Malus history section */}
          {malusList.length > 0 && (
            <MalusHistory malusList={malusList} />
          )}

          {groupedPaies.map(group => {
            const isCurrent = group.debut === periodeCourante.debut && group.fin === periodeCourante.fin;
            const isEstimated = group.paies.some(p => p.statut === 'estimé');
            return (
              <div
                key={`${group.debut}-${group.fin}`}
                className="card"
                style={{
                  padding: 0, overflow: 'hidden',
                  border: isEstimated ? '2px solid rgba(14,165,233,0.3)' : isCurrent ? '2px solid rgba(245,183,49,0.4)' : undefined,
                }}
              >
                {/* Period header */}
                <div style={{
                  padding: '0.75rem 1.25rem',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: isEstimated ? 'rgba(14,165,233,0.04)' : isCurrent ? 'rgba(245,183,49,0.06)' : '#fafaf8',
                  borderBottom: '1px solid rgba(0,0,0,0.06)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1b2e4b' }}>
                      {formatPeriod(group.debut, group.fin)}
                    </span>
                    {isEstimated ? (
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.5rem',
                        borderRadius: '20px', background: '#0284c7', color: '#fff',
                        letterSpacing: '0.03em',
                      }}>
                        ESTIMATION
                      </span>
                    ) : isCurrent && (
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.5rem',
                        borderRadius: '20px', background: '#f5b731', color: '#fff',
                        letterSpacing: '0.03em',
                      }}>
                        EN COURS
                      </span>
                    )}
                  </div>
                  <span style={{
                    fontSize: '1rem', fontWeight: 700,
                    color: isEstimated ? '#0284c7' : isCurrent ? '#f5b731' : '#1b2e4b',
                  }}>
                    {isEstimated ? '~' : ''}{fmt(group.total)} {"€"}
                  </span>
                </div>
                {isEstimated && (
                  <div style={{
                    padding: '0.5rem 1.25rem', fontSize: '0.75rem', color: '#0369a1',
                    background: 'rgba(14,165,233,0.06)', borderBottom: '1px solid rgba(14,165,233,0.1)',
                  }}>
                    Estimation basée sur tes ventes en cours, le montant définitif sera calculé après validation.
                  </div>
                )}

                {/* Paies table for this period */}
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ minWidth: '460px' }}>
                    <thead>
                      <tr>
                        <th>Plateforme</th>
                        <th style={{ textAlign: 'right' }}>Ventes brutes</th>
                        <th style={{ textAlign: 'right' }}>Ma paie</th>
                        <th style={{ whiteSpace: 'nowrap' }}>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.paies.map((p) => {
                        const statutStyle = STATUT_STYLES[p.statut] || STATUT_STYLES['calculé'];
                        const pKey = p.id || `est-${p.periode_debut}-${p.plateforme_id}`;
                        const isExpanded = expandedId === pKey;
                        const malusForPeriod = malusList.filter(m => m.periode >= p.periode_debut && m.periode <= p.periode_fin);
                        return [
                          <tr
                            key={pKey}
                            onClick={() => setExpandedId(isExpanded ? null : pKey)}
                            style={{ cursor: 'pointer', background: isExpanded ? 'rgba(245,183,49,0.04)' : undefined }}
                          >
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                {isExpanded ? <ChevronUp size={14} color="#94a3b8" /> : <ChevronDown size={14} color="#94a3b8" />}
                                <span className="badge" style={{
                                  fontSize: '0.72rem',
                                  background: p.couleur_fond || '#1b2e4b',
                                  color: p.couleur_texte || '#ffffff',
                                }}>
                                  {p.plateforme_nom || '\u2014'}
                                </span>
                              </div>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {fmt(p.ventes_brutes)} {p.devise === 'USD' ? '$' : '€'}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#f5b731' }}>
                              {fmt(p.total_chatteur)} {"€"}
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <span style={{
                                ...statutStyle,
                                padding: '0.2rem 0.6rem', borderRadius: '20px',
                                fontSize: '0.72rem', fontWeight: 600, textTransform: 'capitalize',
                                whiteSpace: 'nowrap',
                              }}>
                                {p.statut}
                              </span>
                            </td>
                          </tr>,
                          isExpanded && (
                            <PaieDetail key={`detail-${pKey}`} paie={p} tauxCommission={tauxCommission} malusForPeriod={malusForPeriod} />
                          ),
                        ];
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
