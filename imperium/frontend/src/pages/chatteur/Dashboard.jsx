import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import StatCard from '../../components/StatCard.jsx';
import { CardSkeleton } from '../../components/Skeleton.jsx';
import { Trophy, TrendingUp, Euro, AlertTriangle, Target, Pencil, Check, Clock, Calendar, ChevronRight } from 'lucide-react';
import DonutChart from '../../components/DonutChart.jsx';
import { useNavigate } from 'react-router-dom';

const medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];

function getMessage(rang, nbChatteurs) {
  if (!rang || rang <= 0) return { text: 'Pas encore de classement pour cette période.', color: '#64748b' };
  if (rang === 1) return { text: "Tu es en tête de l'équipe, continue comme ça !", color: '#f59e0b' };
  if (rang <= 3) return { text: 'Tu es dans le top 3, encore un effort !', color: '#10b981' };
  if (rang <= Math.ceil((nbChatteurs || 10) / 2)) return { text: 'Tu es dans la première moitié, pousse encore !', color: '#3b82f6' };
  return { text: 'Continue à donner le meilleur de toi-même !', color: '#6366f1' };
}

function getPeriodeCourante() {
  const now = new Date();
  const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0');
  const day = now.getDate();
  if (day < 15) return { debut: `${y}-${m}-01`, fin: `${y}-${m}-15` };
  const next = new Date(y, now.getMonth() + 1, 1);
  const ny = next.getFullYear(), nm = String(next.getMonth() + 1).padStart(2, '0');
  return { debut: `${y}-${m}-15`, fin: `${ny}-${nm}-01` };
}

function getPeriodePrecedente(periode) {
  const d = new Date(periode.debut + 'T00:00:00');
  if (d.getDate() === 15) {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0');
    return { debut: `${y}-${m}-01`, fin: `${y}-${m}-15` };
  }
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 15);
  const end = new Date(d.getFullYear(), d.getMonth(), 1);
  const py = prev.getFullYear(), pm = String(prev.getMonth() + 1).padStart(2, '0');
  const ey = end.getFullYear(), em = String(end.getMonth() + 1).padStart(2, '0');
  return { debut: `${py}-${pm}-15`, fin: `${ey}-${em}-01` };
}

function formatPeriod(debut, fin) {
  const d = new Date(debut + 'T00:00:00');
  const f = new Date(fin + 'T00:00:00');
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} \u2192 ${f.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

/* ── Delta Badge ── */
function DeltaBadge({ current, previous, inverse = false }) {
  if (previous == null || previous === 0) {
    if (current > 0) return <span style={{ fontSize: '0.7rem', color: '#3b82f6', fontWeight: 600 }}>Nouveau !</span>;
    return null;
  }
  if (current === previous) return null;
  const delta = ((current - previous) / Math.abs(previous)) * 100;
  const isPositive = inverse ? delta < 0 : delta > 0;
  const arrow = isPositive ? '\u2191' : '\u2193';
  const color = isPositive ? '#10b981' : '#ef4444';
  return (
    <span style={{
      fontSize: '0.7rem', fontWeight: 600, color,
      display: 'inline-flex', alignItems: 'center', gap: '0.15rem',
      background: `${color}12`, padding: '0.1rem 0.4rem', borderRadius: '8px',
    }}>
      {arrow} {Math.abs(delta).toFixed(0)}%
    </span>
  );
}


/* ── Objectif Widget (enrichi, persisté DB) ── */
function ObjectifWidget({ totalBrut, devise, chatteurId, periode }) {
  const [objectif, setObjectif] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chatteurId || !periode) return;
    setLoading(true);
    Promise.all([
      api.get(`/api/objectifs/mon-objectif?periode_debut=${periode.debut}&periode_fin=${periode.fin}`).catch(() => ({ data: null })),
      api.get(`/api/objectifs/suggestions?chatteur_id=${chatteurId}`).catch(() => ({ data: null })),
    ]).then(([objRes, sugRes]) => {
      const obj = objRes.data;
      setObjectif(obj);
      setSuggestions(sugRes.data);
      if (!obj) setEditing(true);
      else setInputVal(obj.montant_cible?.toString() || '');
    }).finally(() => setLoading(false));
  }, [chatteurId, periode?.debut, periode?.fin]);

  const handleSave = async () => {
    const montant = parseFloat(inputVal);
    if (!montant || montant <= 0) return;
    try {
      await api.post('/api/objectifs/mon-objectif', {
        montant_cible: montant,
        periode_debut: periode.debut,
        periode_fin: periode.fin,
      });
      setObjectif({ montant_cible: montant });
      setEditing(false);
    } catch { /* ignore */ }
  };

  const handleClear = async () => {
    try {
      await api.delete(`/api/objectifs/mon-objectif?periode_debut=${periode.debut}&periode_fin=${periode.fin}`);
    } catch { /* ignore */ }
    setObjectif(null);
    setInputVal('');
    setEditing(true);
  };

  if (loading) return null;

  const sym = (devise || 'USD') === 'USD' ? '$' : '\u20ac';
  const montantCible = objectif?.montant_cible || 0;
  const pct = montantCible > 0 ? Math.min((totalBrut / montantCible) * 100, 100) : 0;
  const atteint = montantCible > 0 && totalBrut >= montantCible;
  const depassement = atteint ? totalBrut - montantCible : 0;

  // Feasibility analysis from suggestions
  const moyenne = suggestions?.moyenne || 0;
  const meilleure = suggestions?.meilleure || 0;
  const tendance = suggestions?.tendance || 0;

  // Compute pace: how much per day based on period progress
  const now = new Date();
  const periodeStart = new Date(periode.debut + 'T00:00:00');
  const periodeEnd = new Date(periode.fin + 'T00:00:00');
  const totalDays = Math.max(1, (periodeEnd - periodeStart) / 86400000);
  const elapsedDays = Math.max(1, (now - periodeStart) / 86400000);
  const remainingDays = Math.max(0, (periodeEnd - now) / 86400000);
  const dailyPace = totalBrut / elapsedDays;
  const projected = dailyPace * totalDays;
  const neededDaily = montantCible > 0 && remainingDays > 0 ? Math.max(0, (montantCible - totalBrut) / remainingDays) : 0;

  let feasibility = null;
  if (montantCible > 0 && !atteint && suggestions) {
    if (projected >= montantCible) feasibility = { text: 'En bonne voie !', color: '#10b981', emoji: '\uD83D\uDE80' };
    else if (projected >= montantCible * 0.8) feasibility = { text: 'Réalisable avec un petit effort', color: '#f59e0b', emoji: '\uD83D\uDCAA' };
    else if (montantCible <= meilleure) feasibility = { text: 'Ambitieux — ton record le permet', color: '#6366f1', emoji: '\uD83C\uDFAF' };
    else feasibility = { text: 'Très challengeant — dépasse tes limites !', color: '#ef4444', emoji: '\uD83D\uDD25' };
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', border: '2px solid rgba(245,183,49,0.25)', background: 'linear-gradient(135deg, rgba(245,183,49,0.04), rgba(245,183,49,0.01))' }}>
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(245,183,49,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(245,183,49,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Target size={18} color="#f5b731" />
          <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1b2e4b', letterSpacing: '0.02em', margin: 0 }}>
            MON OBJECTIF
          </h2>
        </div>
        {objectif && !editing && (
          <button
            onClick={() => { setEditing(true); setInputVal(montantCible.toString()); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', borderRadius: '6px' }}
            title="Modifier"
          >
            <Pencil size={14} color="#94a3b8" />
          </button>
        )}
      </div>
      <div style={{ padding: '1rem 1.25rem' }}>
        {editing ? (
          <div>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.75rem' }}>
              Combien veux-tu vendre cette période ?
            </p>
            {/* Suggestion chips */}
            {suggestions && suggestions.suggestions && (
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                {[
                  { label: 'Réaliste', value: suggestions.suggestions.realiste, color: '#10b981' },
                  { label: 'Ambitieux', value: suggestions.suggestions.ambitieux, color: '#f59e0b' },
                  { label: 'Challenge', value: suggestions.suggestions.challenge, color: '#ef4444' },
                ].filter(s => s.value > 0).map(s => (
                  <button
                    key={s.label}
                    className="haptic"
                    onClick={() => setInputVal(s.value.toString())}
                    style={{
                      padding: '0.3rem 0.65rem', borderRadius: '20px', cursor: 'pointer',
                      border: `1.5px solid ${s.color}30`, background: `${s.color}08`,
                      fontSize: '0.72rem', fontWeight: 600, color: s.color,
                      transition: 'all 200ms ease',
                    }}
                  >
                    {s.label}: {s.value.toLocaleString('fr-FR')} {sym}
                  </button>
                ))}
              </div>
            )}
            {suggestions && moyenne > 0 && (
              <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                Ta moyenne : {moyenne.toLocaleString('fr-FR')} {sym} · Record : {meilleure.toLocaleString('fr-FR')} {sym}
                {tendance !== 0 && <span style={{ color: tendance > 0 ? '#10b981' : '#ef4444' }}> · Tendance {tendance > 0 ? '+' : ''}{tendance}%</span>}
              </p>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="number"
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                placeholder="Ex: 500"
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                style={{
                  flex: 1, padding: '0.5rem 0.75rem', borderRadius: '8px',
                  border: '1px solid #e2e8f0', fontSize: '0.88rem', outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>{sym}</span>
              <button
                onClick={handleSave}
                style={{
                  background: '#f5b731', color: '#fff', border: 'none', borderRadius: '8px',
                  padding: '0.5rem 0.75rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem',
                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                }}
              >
                <Check size={14} /> OK
              </button>
            </div>
            {objectif && (
              <button onClick={handleClear} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.5rem', padding: 0,
                textDecoration: 'underline',
              }}>
                Supprimer l'objectif
              </button>
            )}
          </div>
        ) : objectif ? (
          <div>
            {/* Progress */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1b2e4b' }}>
                {totalBrut.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} {sym}
                <span style={{ fontSize: '0.78rem', fontWeight: 400, color: '#94a3b8' }}> / {montantCible.toLocaleString('fr-FR')} {sym}</span>
              </span>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: atteint ? '#10b981' : '#f5b731' }}>
                {pct.toFixed(0)}%
              </span>
            </div>
            <div style={{ height: 12, borderRadius: 6, background: '#f1f5f9', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 6,
                width: `${pct}%`,
                background: atteint ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #f5b731, #f0c75e)',
                transition: 'width 600ms ease',
              }} />
            </div>
            {atteint ? (
              <p style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 600, marginTop: '0.5rem' }}>
                {"\uD83C\uDF89"} Objectif atteint !{depassement > 0 ? ` Dépassé de ${depassement.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${sym} !` : ''}
              </p>
            ) : (
              <div style={{ marginTop: '0.6rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.72rem', color: '#64748b' }}>
                  <span>Reste : <strong style={{ color: '#1b2e4b' }}>{(montantCible - totalBrut).toLocaleString('fr-FR', { minimumFractionDigits: 0 })} {sym}</strong></span>
                  {remainingDays > 0 && <span>Rythme nécessaire : <strong style={{ color: '#1b2e4b' }}>{neededDaily.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} {sym}/jour</strong></span>}
                  <span>Projection : <strong style={{ color: projected >= montantCible ? '#10b981' : '#f59e0b' }}>{projected.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} {sym}</strong></span>
                </div>
                {feasibility && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                    marginTop: '0.5rem', padding: '0.35rem 0.65rem', borderRadius: '8px',
                    background: `${feasibility.color}10`, border: `1px solid ${feasibility.color}20`,
                  }}>
                    <span>{feasibility.emoji}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: feasibility.color }}>{feasibility.text}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ── Prochain Shift Widget ── */
function ProchainShift({ chatteurId }) {
  const [shift, setShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!chatteurId) return;
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    api.get(`/api/shifts/semaine?date=${dateStr}`).then(({ data }) => {
      const all = data.shifts || data;
      if (!Array.isArray(all)) { setLoading(false); return; }
      const myShifts = all.filter(s => s.chatteur_id === chatteurId && s.date >= dateStr);
      myShifts.sort((a, b) => a.date.localeCompare(b.date) || a.creneau - b.creneau);
      setShift(myShifts[0] || null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [chatteurId]);

  if (loading || !shift) return null;

  const CRENEAU_LABELS = { 1: '08h-14h', 2: '14h-20h', 3: '20h-02h', 4: '02h-08h' };
  const shiftDate = new Date(shift.date + 'T00:00:00');
  const isToday = shiftDate.toDateString() === new Date().toDateString();

  return (
    <div
      className="card card-clickable haptic"
      onClick={() => navigate('/chatteur/planning')}
      style={{
        padding: 0, overflow: 'hidden',
        borderLeft: '3px solid #f5b731',
        transition: 'transform 150ms ease',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '0.6rem 1rem',
        background: isToday ? 'rgba(245,183,49,0.08)' : '#fafaf8',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={14} color="#f5b731" />
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>
            {isToday ? "TON SHIFT AUJOURD'HUI" : 'TON PROCHAIN SHIFT'}
          </span>
        </div>
        <ChevronRight size={14} color="#94a3b8" />
      </div>
      {/* Content */}
      <div style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {/* Date block */}
        <div style={{
          width: 44, height: 44, borderRadius: '10px', flexShrink: 0,
          background: isToday ? '#f5b731' : '#1b2e4b',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', lineHeight: 1 }}>
            {shiftDate.getDate()}
          </span>
          <span style={{ fontSize: '0.55rem', fontWeight: 600, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase' }}>
            {shiftDate.toLocaleDateString('fr-FR', { month: 'short' })}
          </span>
        </div>
        {/* Details */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1b2e4b', marginBottom: '0.3rem' }}>
            {shiftDate.toLocaleDateString('fr-FR', { weekday: 'long' })}
            <span style={{ fontWeight: 400, color: '#64748b', marginLeft: '0.35rem' }}>
              {CRENEAU_LABELS[shift.creneau] || '?'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            {shift.plateforme_nom && (
              <span style={{
                fontSize: '0.68rem', fontWeight: 600, padding: '0.15rem 0.45rem', borderRadius: '6px',
                background: shift.plateforme_couleur_fond || '#1b2e4b',
                color: shift.plateforme_couleur_texte || '#fff',
              }}>
                {shift.plateforme_nom}
              </span>
            )}
            {shift.modele_pseudo && (
              <span style={{
                fontSize: '0.68rem', fontWeight: 600, padding: '0.15rem 0.45rem', borderRadius: '99px',
                background: shift.modele_couleur_fond || '#f1f5f9',
                color: shift.modele_couleur_texte || '#475569',
              }}>
                {shift.modele_pseudo}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Dashboard ── */
export default function ChatteurDashboard() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState(null);
  const [prevKpis, setPrevKpis] = useState(null);
  const [ventes, setVentes] = useState([]);
  const [ventesParModele, setVentesParModele] = useState([]);
  const [objectifsProgress, setObjectifsProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const periode = getPeriodeCourante();
  const prevPeriode = useMemo(() => getPeriodePrecedente(periode), [periode.debut, periode.fin]);

  const fetchData = useCallback(() => {
    if (!user?.chatteur_id) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    Promise.all([
      api.get(`/api/chatteurs/${user.chatteur_id}/kpis?periode_debut=${periode.debut}&periode_fin=${periode.fin}`, { signal: controller.signal }),
      api.get(`/api/ventes?chatteur_id=${user.chatteur_id}&periode_debut=${periode.debut}&periode_fin=${periode.fin}`, { signal: controller.signal })
        .catch(() => ({ data: [] })),
      api.get(`/api/chatteurs/${user.chatteur_id}/kpis?periode_debut=${prevPeriode.debut}&periode_fin=${prevPeriode.fin}`, { signal: controller.signal })
        .catch(() => ({ data: null })),
      api.get(`/api/ventes/par-modele?periode_debut=${periode.debut}&periode_fin=${periode.fin}`, { signal: controller.signal })
        .catch(() => ({ data: [] })),
      api.get(`/api/objectifs/progress?periode_debut=${periode.debut}&periode_fin=${periode.fin}`, { signal: controller.signal }).catch(() => ({ data: [] })),
    ]).then(([k, v, pk, vm, objP]) => {
      setKpis(k.data);
      setPrevKpis(pk.data);
      const ventesData = v.data?.ventes || v.data || [];
      setVentes(Array.isArray(ventesData) ? ventesData.slice(0, 5) : []);
      setVentesParModele(Array.isArray(vm.data) ? vm.data : []);
      setObjectifsProgress(Array.isArray(objP.data) ? objP.data : []);
    })
    .catch(() => { if (!controller.signal.aborted) setError('Impossible de charger les données.'); })
    .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user?.chatteur_id, periode.debut, periode.fin, prevPeriode.debut, prevPeriode.fin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sum ALL paies for the current period (may have multiple platforms)
  // Match by periode_debut only — periode_fin can vary (e.g. "2026-02-28" vs "2026-03-01")
  const currentPaies = (kpis?.paies || []).filter(p => p.periode_debut === periode.debut);
  const paieEstimee = currentPaies.reduce((s, p) => s + (p.total_chatteur || 0), 0);
  const rang = kpis?.rang || 0;
  const nbChatteurs = kpis?.nb_chatteurs || 0;
  const totalBrut = (kpis?.ventes || []).reduce((s, v) => s + (v.total_brut || 0), 0);
  const devise = kpis?.ventes?.[0]?.devise || 'USD';

  const prevCurrentPaies = (prevKpis?.paies || []).filter(p => p.periode_debut === prevPeriode.debut);
  const prevPaie = prevCurrentPaies.reduce((s, p) => s + (p.total_chatteur || 0), 0);
  const prevRang = prevKpis?.rang || 0;
  const prevBrut = (prevKpis?.ventes || []).reduce((s, v) => s + (v.total_brut || 0), 0);

  const msg = getMessage(rang, nbChatteurs);

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header */}
      <div>
        <h1 className="text-navy" style={{ fontWeight: 700 }}>Bonjour {user?.prenom || 'toi'} {"\uD83D\uDC4B"}</h1>
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
          {formatPeriod(periode.debut, periode.fin)}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.75rem 1rem', borderRadius: '10px',
          background: '#fef2f2', border: '1px solid #fecaca',
        }}>
          <AlertTriangle size={18} color="#dc2626" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.82rem', color: '#991b1b' }}>{error}</span>
          <button onClick={fetchData} className="btn-ghost" style={{ marginLeft: '1rem', fontSize: '0.8rem' }}>Réessayer</button>
        </div>
      )}

      {/* Message d'encouragement */}
      {!loading && (
        <div className="card" style={{ borderLeft: `3px solid ${msg.color}`, padding: '0.85rem 1.25rem' }}>
          <p style={{ fontWeight: 500, color: msg.color, fontSize: '0.9rem', margin: 0 }}>
            {rang > 0 && <span style={{ marginRight: '0.4rem' }}>{medals[rang - 1] || `#${rang}`}</span>}
            {msg.text}
          </p>
        </div>
      )}

      {/* OBJECTIF — remonté en position 2, bien visible */}
      {!loading && user?.chatteur_id && (
        <ObjectifWidget totalBrut={totalBrut} devise={devise} chatteurId={user.chatteur_id} periode={periode} />
      )}

      {/* Stats with deltas */}
      {loading ? (
        <CardSkeleton count={3} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }} className="stagger-children">
          <StatCard
            title="Ma paie estimée"
            value={`${paieEstimee.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} \u20ac`}
            subtitle={<span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>Période en cours <DeltaBadge current={paieEstimee} previous={prevPaie} /></span>}
            icon={Euro}
            color="#f5b731"
          />
          <StatCard
            title="Mon rang"
            value={rang > 0 ? (medals[rang - 1] || `#${rang}`) : '\u2014'}
            subtitle={<span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>{nbChatteurs > 0 ? `sur ${nbChatteurs} chatteurs` : 'Aucun classement'} <DeltaBadge current={rang} previous={prevRang} inverse /></span>}
            icon={Trophy}
            color="#1b2e4b"
          />
          <StatCard
            title="Ventes (période)"
            value={`${totalBrut.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${devise === 'USD' ? '$' : '\u20ac'}`}
            subtitle={<span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>Montant brut <DeltaBadge current={totalBrut} previous={prevBrut} /></span>}
            icon={TrendingUp}
            color="#10b981"
          />
        </div>
      )}

      {/* Prochain shift */}
      {!loading && <ProchainShift chatteurId={user?.chatteur_id} />}


      {/* Objectifs admin progression */}
      {!loading && objectifsProgress.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Target size={16} color="#f5b731" />
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)' }}>Mes Objectifs</h3>
          </div>
          <div style={{ padding: '0.75rem 1.25rem', display: 'grid', gap: '0.75rem' }}>
            {objectifsProgress.map(obj => {
              const pctObj = obj.progress;
              const color = pctObj >= 100 ? '#f5b731' : pctObj >= 80 ? '#22c55e' : pctObj >= 50 ? '#f59e0b' : '#ef4444';
              const restant = obj.montant_cible - obj.actual;
              const motivMsg = pctObj >= 100 ? 'Objectif atteint ! 🎉'
                : pctObj >= 80 ? `Presque ! Plus que ${restant.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} € !`
                : pctObj >= 50 ? 'Tu es sur la bonne voie !'
                : 'Continue comme ça !';
              return (
                <div key={obj.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.8rem' }}>
                    <span style={{ fontWeight: 600, color: '#1a1f2e' }}>
                      {obj.chatteur_prenom || 'Global'}{obj.modele_pseudo ? ` (${obj.modele_pseudo})` : ''}
                    </span>
                    <span style={{ fontWeight: 700, color }}>{pctObj}%</span>
                  </div>
                  <div style={{ background: '#f1f5f9', borderRadius: '999px', height: '8px' }}>
                    <div style={{ width: `${Math.min(pctObj, 100)}%`, height: '100%', background: color, borderRadius: '999px', transition: 'width 500ms ease' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginTop: '0.15rem' }}>
                    <span style={{ color: '#94a3b8' }}>{obj.actual.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} € / {obj.montant_cible.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</span>
                    <span style={{ fontWeight: 600, color, fontSize: '0.68rem' }}>{motivMsg}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Donut Chart — Ventes par modèle */}
      {!loading && <DonutChart
        data={ventesParModele.map(d => ({ label: d.pseudo || 'N/A', value: d.total_brut || 0, color: d.couleur_fond }))}
        title="Ventes par modèle"
        valueLabel="$"
        emptyText="Tes ventes par modèle apparaîtront ici."
        maxLegend={5}
      />}

      {/* Dernières ventes */}
      {!loading && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', letterSpacing: '0.05em', margin: 0 }}>
              MES DERNIÈRES VENTES
            </h2>
          </div>
          <div style={{ padding: '0 1.25rem' }}>
            {ventes.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '2rem 0', textAlign: 'center' }}>
                Aucune vente enregistrée pour cette période
              </p>
            ) : (
              <div>
                {ventes.map(v => (
                  <div key={v.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.75rem 0', borderBottom: '1px solid #f1f5f9',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.85rem' }}>
                        {v.created_at ? new Date(v.created_at).toLocaleDateString('fr-FR') : '\u2014'}
                      </span>
                      {v.modele_pseudo && (
                        <span className="badge" style={{
                          fontSize: '0.68rem', padding: '1px 7px', borderRadius: '99px', fontWeight: 600,
                          background: v.modele_couleur_fond || '#f1f5f9',
                          color: v.modele_couleur_texte || '#475569',
                        }}>{v.modele_pseudo}</span>
                      )}
                    </div>
                    <span style={{ fontWeight: 700, color: '#f5b731' }}>
                      {(v.montant_brut || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} $
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
