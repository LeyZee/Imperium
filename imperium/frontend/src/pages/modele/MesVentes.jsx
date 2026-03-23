import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import StatCard from '../../components/StatCard.jsx';
import { CardSkeleton } from '../../components/Skeleton.jsx';
import {
  TrendingUp, TrendingDown, ShoppingBag, ChevronDown, Bot, User, Shield,
  Calendar, Clock, CheckCircle, XCircle, RotateCcw, BarChart3,
} from 'lucide-react';
import Pagination, { ITEMS_PER_PAGE } from '../../components/Pagination.jsx';
import { useToast } from '../../components/Toast.jsx';
import { CHATTEUR_COLORS } from '../../constants/colors.js';

/* --- Period helpers --- */
function getPeriodeCourante() {
  const now = new Date();
  const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0');
  const day = now.getDate();
  if (day < 15) return { debut: `${y}-${m}-01`, fin: `${y}-${m}-15` };
  const next = new Date(y, now.getMonth() + 1, 1);
  const ny = next.getFullYear(), nm = String(next.getMonth() + 1).padStart(2, '0');
  return { debut: `${y}-${m}-15`, fin: `${ny}-${nm}-01` };
}

function formatPeriodShort(debut, fin) {
  const d = new Date(debut + 'T00:00:00');
  const f = new Date(fin + 'T00:00:00');
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} → ${f.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
}

function formatCreatedAt(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) +
    ` ${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
}

const CRENEAUX_LABELS = { 1: '08h-14h', 2: '14h-20h', 3: '20h-02h', 4: '02h-08h' };

const SOURCE_CONFIG = {
  telegram: { label: 'Telegram', icon: Bot, color: '#059669', bg: 'rgba(16,185,129,0.1)' },
  chatteur: { label: 'Chatteur', icon: User, color: '#1e40af', bg: '#dbeafe' },
  manager:  { label: 'Manager', icon: Shield, color: '#b45309', bg: '#fef3c7' },
  admin:    { label: 'Directeur', icon: Shield, color: '#6366f1', bg: '#ede9fe' },
};

function getSource(vente) {
  if (vente.source) return vente.source;
  return 'admin';
}

export default function ModeleMesVentes() {
  const { user } = useAuth();
  const toast = useToast();
  const [ventes, setVentes] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  /* Period selection */
  const [periode, setPeriode] = useState(getPeriodeCourante);
  const [periods, setPeriods] = useState([]);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

  /* Filters */
  const [plateformeFilter, setPlateformeFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statutFilter, setStatutFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  /* Exchange rate */
  const [tauxChange, setTauxChange] = useState(0.92);

  const [fetchError, setFetchError] = useState('');

  /* --- Fetch ventes --- */
  const fetchVentes = useCallback(async (p) => {
    const per = p || periode;
    try {
      setFetchError('');
      const params = new URLSearchParams({ periode_debut: per.debut, periode_fin: per.fin });
      const { data } = await api.get(`/api/modele/ventes?${params}`);
      setVentes(data.ventes || []);
      setSummary(data.summary || null);
      if (data.taux_change) setTauxChange(data.taux_change);
    } catch { setFetchError('Impossible de charger les ventes.'); }
  }, [periode]);

  /* --- Build periods --- */
  const fetchPeriods = useCallback(() => {
    const APP_START_DATE = '2026-03-01';
    const ps = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      d.setMonth(d.getMonth() - Math.floor(i / 2));
      const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0');
      let debut, fin;
      if (i % 2 === 0) {
        const next = new Date(y, d.getMonth() + 1, 1);
        debut = `${y}-${m}-15`;
        fin = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
      } else {
        debut = `${y}-${m}-01`;
        fin = `${y}-${m}-15`;
      }
      if (debut < APP_START_DATE) break;
      ps.push({ debut, fin });
    }
    const seen = new Set();
    const unique = ps.filter(p => {
      const key = `${p.debut}-${p.fin}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    setPeriods(unique);
  }, []);

  useEffect(() => {
    fetchPeriods();
    fetchVentes().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchVentes();
  }, [periode]);

  /* --- Unique plateformes from ventes --- */
  const plateformes = useMemo(() => {
    const map = new Map();
    ventes.forEach(v => {
      if (v.plateforme_id && !map.has(v.plateforme_id)) {
        map.set(v.plateforme_id, {
          id: v.plateforme_id,
          nom: v.plateforme_nom,
          couleur_fond: v.plateforme_couleur_fond,
          couleur_texte: v.plateforme_couleur_texte,
        });
      }
    });
    return Array.from(map.values());
  }, [ventes]);

  /* --- Filtered ventes --- */
  const filteredVentes = useMemo(() => ventes.filter(v => {
    if (plateformeFilter !== 'all' && v.plateforme_id !== Number(plateformeFilter)) return false;
    if (sourceFilter !== 'all' && getSource(v) !== sourceFilter) return false;
    if (statutFilter !== 'all' && v.statut !== statutFilter) return false;
    return true;
  }), [ventes, plateformeFilter, sourceFilter, statutFilter]);

  useEffect(() => { setCurrentPage(1); }, [plateformeFilter, sourceFilter, statutFilter, periode]);

  const totalPages = Math.ceil(filteredVentes.length / ITEMS_PER_PAGE);
  const paginatedVentes = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredVentes.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredVentes, currentPage]);

  /* --- Stats --- */
  const { totalEur, nbVentes } = useMemo(() => {
    const total = filteredVentes.reduce((s, v) => {
      const eur = v.devise === 'USD' ? v.montant_brut * tauxChange : v.montant_brut;
      return s + eur;
    }, 0);
    return { totalEur: total, nbVentes: filteredVentes.length };
  }, [filteredVentes, tauxChange]);

  /* --- Counts for filter labels --- */
  const { sourceCounts, statutCounts, plateformeCounts } = useMemo(() => {
    const sc = { telegram: 0, chatteur: 0, manager: 0, admin: 0 };
    const stc = { en_attente: 0, 'validée': 0, 'rejetée': 0 };
    const pc = {};
    ventes.forEach(v => {
      sc[getSource(v)]++;
      if (v.statut) stc[v.statut]++;
      pc[v.plateforme_id] = (pc[v.plateforme_id] || 0) + 1;
    });
    return { sourceCounts: sc, statutCounts: stc, plateformeCounts: pc };
  }, [ventes]);

  if (loading) return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <CardSkeleton /><CardSkeleton /><CardSkeleton />
      </div>
    </div>
  );

  const trend = summary?.trend ?? 0;

  return (
    <div style={{ padding: '1.5rem', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1b2e4b', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={22} color="#f5b731" /> Mes Ventes
          </h1>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.25rem 0 0' }}>
            Historique de vos ventes par période
          </p>
        </div>

        {/* Period selector */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', padding: '0.5rem 1rem' }}
          >
            <Calendar size={14} />
            {formatPeriodShort(periode.debut, periode.fin)}
            <ChevronDown size={14} style={{ transition: 'transform 200ms', transform: showPeriodDropdown ? 'rotate(180deg)' : 'none' }} />
          </button>
          {showPeriodDropdown && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowPeriodDropdown(false)} />
              <div style={{
                position: 'absolute', right: 0, top: '100%', marginTop: '0.35rem',
                background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
                zIndex: 50, minWidth: '220px', overflow: 'hidden',
                animation: 'modalCardIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                maxHeight: 300, overflowY: 'auto',
              }}>
                {periods.map((p, i) => {
                  const isActive = p.debut === periode.debut && p.fin === periode.fin;
                  return (
                    <button
                      key={i}
                      onClick={() => { setPeriode(p); setShowPeriodDropdown(false); }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '0.6rem 1rem', border: 'none', cursor: 'pointer',
                        background: isActive ? 'rgba(245,183,49,0.1)' : 'transparent',
                        color: isActive ? '#f5b731' : 'var(--text-primary)',
                        fontWeight: isActive ? 600 : 400, fontSize: '0.8rem',
                        borderLeft: isActive ? '3px solid #f5b731' : '3px solid transparent',
                        transition: 'background 150ms',
                      }}
                      className={!isActive ? 'hover-row' : ''}
                    >
                      {formatPeriodShort(p.debut, p.fin)}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Fetch error */}
      {fetchError && (
        <div className="alert alert-error" role="alert" style={{ marginBottom: '1rem' }}>
          {fetchError}
          <button onClick={() => fetchVentes()} className="btn-ghost" style={{ marginLeft: '1rem', fontSize: '0.8rem' }}>Réessayer</button>
        </div>
      )}

      {/* Filter Bar */}
      {ventes.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
          padding: '0.6rem 0.85rem', marginBottom: '1rem',
          background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
        }}>
          {plateformes.length > 1 && (
            <select
              className="input-field"
              value={plateformeFilter}
              onChange={e => setPlateformeFilter(e.target.value)}
              style={{ width: 'auto', minWidth: '150px', fontSize: '0.8rem' }}
            >
              <option value="all">Toutes les plateformes</option>
              {plateformes.map(p => <option key={p.id} value={String(p.id)}>{p.nom} ({plateformeCounts[p.id] || 0})</option>)}
            </select>
          )}
          <select
            className="input-field"
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            style={{ width: 'auto', minWidth: '150px', fontSize: '0.8rem' }}
          >
            <option value="all">Toutes les sources</option>
            <option value="telegram">Telegram ({sourceCounts.telegram})</option>
            <option value="chatteur">Chatteur ({sourceCounts.chatteur})</option>
            <option value="manager">Manager ({sourceCounts.manager})</option>
            <option value="admin">Directeur ({sourceCounts.admin})</option>
          </select>
          <select
            className="input-field"
            value={statutFilter}
            onChange={e => setStatutFilter(e.target.value)}
            style={{ width: 'auto', minWidth: '150px', fontSize: '0.8rem' }}
          >
            <option value="all">Tous les statuts</option>
            <option value="en_attente">En attente ({statutCounts.en_attente})</option>
            <option value="validée">Validée ({statutCounts['validée']})</option>
            <option value="rejetée">Rejetée ({statutCounts['rejetée']})</option>
          </select>

          {(plateformeFilter !== 'all' || sourceFilter !== 'all' || statutFilter !== 'all') && (
            <button
              onClick={() => { setPlateformeFilter('all'); setSourceFilter('all'); setStatutFilter('all'); }}
              className="btn-ghost"
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <RotateCcw size={12} /> Reset
            </button>
          )}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <StatCard icon={TrendingUp} title="CA brut total" value={`${totalEur.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`} color="#1b2e4b" />
        <StatCard icon={ShoppingBag} title="Nombre de ventes" value={nbVentes} color="#f5b731" />
        <StatCard
          icon={trend >= 0 ? TrendingUp : TrendingDown}
          title="Tendance"
          value={
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {trend > 0 ? '+' : ''}{trend}%
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 20, height: 20, borderRadius: '50%',
                background: trend > 0 ? 'rgba(16,185,129,0.15)' : trend < 0 ? 'rgba(239,68,68,0.15)' : 'rgba(148,163,184,0.15)',
              }}>
                {trend > 0 ? <TrendingUp size={12} color="#059669" /> : trend < 0 ? <TrendingDown size={12} color="#ef4444" /> : <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>—</span>}
              </span>
            </span>
          }
          color={trend > 0 ? '#059669' : trend < 0 ? '#ef4444' : '#94a3b8'}
        />
      </div>

      {/* Per-platform breakdown */}
      {summary?.parPlateforme && summary.parPlateforme.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
          marginBottom: '1.5rem', padding: '0.5rem 0.75rem',
          background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0',
        }}>
          <BarChart3 size={14} color="#94a3b8" />
          {summary.parPlateforme.map((p, i) => (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              fontSize: '0.75rem', fontWeight: 600,
            }}>
              <span style={{
                padding: '0.15rem 0.4rem', borderRadius: 5, fontSize: '0.65rem', fontWeight: 600,
                background: p.couleur_fond || '#e2e8f0', color: p.couleur_texte || '#475569',
              }}>
                {p.plateforme}
              </span>
              <span style={{ color: '#1b2e4b' }}>
                {p.totalEur.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
              </span>
              <span style={{ color: '#94a3b8', fontSize: '0.65rem' }}>({p.nb})</span>
              {i < summary.parPlateforme.length - 1 && <span style={{ color: '#cbd5e1' }}>·</span>}
            </span>
          ))}
        </div>
      )}

      {/* Ventes list */}
      {filteredVentes.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '3rem 1rem', background: '#fff',
          borderRadius: 16, border: '1px solid #e2e8f0',
        }}>
          <ShoppingBag size={40} color="#cbd5e1" style={{ marginBottom: '0.75rem' }} />
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
            {sourceFilter !== 'all' || statutFilter !== 'all' || plateformeFilter !== 'all'
              ? 'Aucun résultat avec ces filtres pour cette période'
              : 'Aucune vente pour cette période'}
          </p>
        </div>
      ) : (
        <>
          {/* Table header - hidden on mobile */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1rem',
            fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase',
            letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', marginBottom: '0.35rem',
          }}>
            <div style={{ minWidth: 70 }}>Date</div>
            <div style={{ minWidth: 80 }}>Chatteur</div>
            <div style={{ minWidth: 70 }}>Plateforme</div>
            <div className="hide-mobile" style={{ minWidth: 60 }}>Créneau</div>
            <div style={{ flex: 1, textAlign: 'right' }}>Montant</div>
            <div className="hide-mobile" style={{ minWidth: 70 }}>Source</div>
            <div style={{ minWidth: 65 }}>Statut</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {paginatedVentes.map(v => {
              const source = getSource(v);
              const chatteurColor = CHATTEUR_COLORS[v.chatteur_couleur] || null;
              return (
                <div
                  key={v.id}
                  style={{
                    background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
                    padding: '0.875rem 1rem', display: 'flex', alignItems: 'center',
                    gap: '0.75rem', flexWrap: 'wrap',
                  }}
                >
                  {/* Date */}
                  <div style={{ fontSize: '0.75rem', color: '#64748b', minWidth: 70, fontWeight: 500 }}>
                    {formatCreatedAt(v.created_at)}
                  </div>

                  {/* Chatteur badge */}
                  <div style={{ minWidth: 80 }}>
                    {v.chatteur_prenom ? (
                      <span style={{
                        display: 'inline-block', padding: '0.15rem 0.45rem', borderRadius: 6,
                        fontSize: '0.65rem', fontWeight: 600,
                        background: chatteurColor?.bg || '#f1f5f9',
                        color: chatteurColor?.text || '#475569',
                        border: `1px solid ${chatteurColor?.border || '#e2e8f0'}`,
                      }}>
                        {v.chatteur_prenom}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>—</span>
                    )}
                  </div>

                  {/* Platform badge */}
                  <div style={{
                    padding: '0.2rem 0.5rem', borderRadius: 6, fontSize: '0.65rem', fontWeight: 600,
                    background: v.plateforme_couleur_fond || '#e2e8f0',
                    color: v.plateforme_couleur_texte || '#475569',
                    minWidth: 70,
                  }}>
                    {v.plateforme_nom}
                  </div>

                  {/* Créneau badge - hidden on mobile */}
                  <div className="hide-mobile" style={{ minWidth: 60 }}>
                    {v.shift_creneau ? (
                      <span style={{
                        display: 'inline-block', padding: '0.1rem 0.35rem', borderRadius: 5,
                        fontSize: '0.6rem', fontWeight: 600,
                        background: 'rgba(245,183,49,0.12)', color: '#b45309',
                      }}>
                        {CRENEAUX_LABELS[v.shift_creneau] || v.shift_creneau}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>—</span>
                    )}
                  </div>

                  {/* Amount */}
                  <div style={{ flex: 1, textAlign: 'right', fontWeight: 700, fontSize: '0.95rem', color: '#1b2e4b' }}>
                    {v.montant_brut.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {v.devise === 'USD' ? '$' : '€'}
                  </div>

                  {/* Source badge - hidden on mobile */}
                  <div className="hide-mobile">
                    {(() => {
                      const cfg = SOURCE_CONFIG[source] || SOURCE_CONFIG.admin;
                      const Icon = cfg.icon;
                      return (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '0.25rem',
                          padding: '0.15rem 0.5rem', borderRadius: 6, fontSize: '0.6rem', fontWeight: 600,
                          background: cfg.bg, color: cfg.color, minWidth: 70,
                        }}>
                          <Icon size={10} /> {cfg.label}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Statut badge */}
                  {v.statut && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '0.2rem',
                      padding: '0.15rem 0.4rem', borderRadius: 6, fontSize: '0.6rem', fontWeight: 600,
                      background: v.statut === 'validée' ? 'rgba(16,185,129,0.1)' : v.statut === 'en_attente' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                      color: v.statut === 'validée' ? '#059669' : v.statut === 'en_attente' ? '#f59e0b' : '#ef4444',
                      minWidth: 65,
                    }}>
                      {v.statut === 'validée' ? <CheckCircle size={10} /> : v.statut === 'en_attente' ? <Clock size={10} /> : <XCircle size={10} />}
                      {v.statut === 'validée' ? 'Validée' : v.statut === 'en_attente' ? 'En attente' : 'Rejetée'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <Pagination page={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

      {/* Responsive: hide columns on mobile */}
      <style>{`
        @media (max-width: 640px) {
          .hide-mobile { display: none !important; }
        }
      `}</style>
    </div>
  );
}
