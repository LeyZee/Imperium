import { useState, useEffect, useMemo } from 'react';
import api from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import StatCard from '../../components/StatCard.jsx';
import { CardSkeleton } from '../../components/Skeleton.jsx';
import { Trophy, TrendingUp, Euro, AlertTriangle, Target, Pencil, Check, BarChart3, Megaphone } from 'lucide-react';

const medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];

function getMessage(rang, nbChatteurs) {
  if (!rang || rang <= 0) return { text: 'Pas encore de classement pour cette p\u00e9riode.', color: '#64748b' };
  if (rang === 1) return { text: "Tu es en t\u00eate de l'\u00e9quipe, continue comme \u00e7a !", color: '#f59e0b' };
  if (rang <= 3) return { text: 'Tu es dans le top 3, encore un effort !', color: '#10b981' };
  if (rang <= Math.ceil((nbChatteurs || 10) / 2)) return { text: 'Tu es dans la premi\u00e8re moiti\u00e9, pousse encore !', color: '#3b82f6' };
  return { text: 'Continue \u00e0 donner le meilleur de toi-m\u00eame !', color: '#6366f1' };
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
    // Current is 15-end → previous is 1-15 same month
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0');
    return { debut: `${y}-${m}-01`, fin: `${y}-${m}-15` };
  }
  // Current is 1-15 → previous is 15-end of prev month
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

/* ── Feature 1: Delta Badge ── */
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

/* ── Feature 2: Ventes par modèle ── */
function VentesParModele({ data }) {
  if (!data || data.length === 0) return (
    <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
      <BarChart3 size={28} color="#cbd5e1" style={{ margin: '0 auto 0.5rem' }} />
      <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>{"Tes ventes par mod\u00e8le appara\u00eetront ici."}</p>
    </div>
  );

  const top5 = data.slice(0, 5);
  const maxBrut = Math.max(...top5.map(d => d.total_brut));
  const barColors = ['#f5b731', '#f0c75e', '#e6d48a', '#d4c89a', '#c8c0a8'];

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', letterSpacing: '0.05em', margin: 0 }}>
          {"VENTES PAR MOD\u00c8LE"}
        </h2>
      </div>
      <div style={{ padding: '0.75rem 1.25rem' }}>
        {top5.map((item, i) => {
          const pct = maxBrut > 0 ? (item.total_brut / maxBrut) * 100 : 0;
          return (
            <div key={item.pseudo || i} style={{ marginBottom: i < top5.length - 1 ? '0.6rem' : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#1b2e4b' }}>{item.pseudo || 'Non assign\u00e9'}</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f5b731' }}>
                  {(item.total_brut || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} $
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: '#f1f5f9', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 3, width: `${pct}%`,
                  background: barColors[i] || '#d4c89a',
                  transition: 'width 600ms ease',
                }} />
              </div>
              <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{item.nb_ventes} vente{item.nb_ventes > 1 ? 's' : ''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Feature 5: Objectif widget ── */
function ObjectifWidget({ totalBrut, devise, chatteurId }) {
  const storageKey = `imperium_objectif_${chatteurId}`;
  const [objectif, setObjectif] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [editing, setEditing] = useState(!objectif);
  const [inputVal, setInputVal] = useState(objectif?.montant?.toString() || '');

  const handleSave = () => {
    const montant = parseFloat(inputVal);
    if (!montant || montant <= 0) return;
    const obj = { montant, devise: devise || 'USD' };
    localStorage.setItem(storageKey, JSON.stringify(obj));
    setObjectif(obj);
    setEditing(false);
  };

  const handleClear = () => {
    localStorage.removeItem(storageKey);
    setObjectif(null);
    setInputVal('');
    setEditing(true);
  };

  const pct = objectif ? Math.min((totalBrut / objectif.montant) * 100, 100) : 0;
  const atteint = objectif && totalBrut >= objectif.montant;
  const depassement = atteint ? totalBrut - objectif.montant : 0;
  const sym = (devise || 'USD') === 'USD' ? '$' : '\u20ac';

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Target size={16} color="#f5b731" />
          <h2 style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', letterSpacing: '0.05em', margin: 0 }}>
            MON OBJECTIF
          </h2>
        </div>
        {objectif && !editing && (
          <button
            onClick={() => { setEditing(true); setInputVal(objectif.montant.toString()); }}
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
              {"Combien veux-tu vendre cette p\u00e9riode ?"}
            </p>
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
                {"Supprimer l'objectif"}
              </button>
            )}
          </div>
        ) : objectif ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1b2e4b' }}>
                {totalBrut.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {sym} / {objectif.montant.toLocaleString('fr-FR')} {sym}
              </span>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: atteint ? '#10b981' : '#f5b731' }}>
                {pct.toFixed(0)}%
              </span>
            </div>
            <div style={{ height: 10, borderRadius: 5, background: '#f1f5f9', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 5,
                width: `${pct}%`,
                background: atteint ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #f5b731, #f0c75e)',
                transition: 'width 600ms ease',
              }} />
            </div>
            {atteint ? (
              <p style={{ fontSize: '0.82rem', color: '#10b981', fontWeight: 600, marginTop: '0.5rem' }}>
                {"\uD83C\uDF89"} Objectif atteint !{depassement > 0 ? ` D\u00e9pass\u00e9 de ${depassement.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${sym} !` : ''}
              </p>
            ) : (
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.4rem' }}>
                Plus que {(objectif.montant - totalBrut).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {sym} pour atteindre ton objectif !
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function ChatteurDashboard() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState(null);
  const [prevKpis, setPrevKpis] = useState(null);
  const [ventes, setVentes] = useState([]);
  const [ventesParModele, setVentesParModele] = useState([]);
  const [annonces, setAnnonces] = useState([]);
  const [objectifsProgress, setObjectifsProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const periode = getPeriodeCourante();
  const prevPeriode = useMemo(() => getPeriodePrecedente(periode), [periode.debut, periode.fin]);

  useEffect(() => {
    if (!user?.chatteur_id) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    Promise.all([
      api.get(`/api/chatteurs/${user.chatteur_id}/kpis?periode_debut=${periode.debut}&periode_fin=${periode.fin}`, { signal: controller.signal }),
      api.get(`/api/ventes?chatteur_id=${user.chatteur_id}&periode_debut=${periode.debut}&periode_fin=${periode.fin}`, { signal: controller.signal })
        .catch(() => ({ data: [] })),
      api.get(`/api/chatteurs/${user.chatteur_id}/kpis?periode_debut=${prevPeriode.debut}&periode_fin=${prevPeriode.fin}`, { signal: controller.signal })
        .catch(() => ({ data: null })),
      api.get(`/api/ventes/par-modele?periode_debut=${periode.debut}&periode_fin=${periode.fin}`, { signal: controller.signal })
        .catch(() => ({ data: [] })),
      api.get('/api/annonces', { signal: controller.signal }).catch(() => ({ data: [] })),
      api.get(`/api/objectifs/progress?periode_debut=${periode.debut}&periode_fin=${periode.fin}`, { signal: controller.signal }).catch(() => ({ data: [] })),
    ]).then(([k, v, pk, vm, ann, objP]) => {
      setKpis(k.data);
      setPrevKpis(pk.data);
      const ventesData = v.data?.ventes || v.data || [];
      setVentes(Array.isArray(ventesData) ? ventesData.slice(0, 5) : []);
      setVentesParModele(Array.isArray(vm.data) ? vm.data : []);
      setAnnonces(Array.isArray(ann.data) ? ann.data.filter(a => a.actif) : []);
      setObjectifsProgress(Array.isArray(objP.data) ? objP.data : []);
    })
    .catch(() => { if (!controller.signal.aborted) setError('Impossible de charger les donn\u00e9es.'); })
    .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user?.chatteur_id, periode.debut, periode.fin, prevPeriode.debut, prevPeriode.fin]);

  const paieEstimee = kpis?.paies?.[0]?.total_chatteur || 0;
  const rang = kpis?.rang || 0;
  const nbChatteurs = kpis?.nb_chatteurs || 0;
  const totalBrut = kpis?.ventes?.[0]?.total_brut || 0;
  const devise = kpis?.ventes?.[0]?.devise || 'USD';

  // Previous period values for deltas
  const prevPaie = prevKpis?.paies?.[0]?.total_chatteur || 0;
  const prevRang = prevKpis?.rang || 0;
  const prevBrut = prevKpis?.ventes?.[0]?.total_brut || 0;

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

      {/* Stats with deltas */}
      {loading ? (
        <CardSkeleton count={3} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }} className="stagger-children">
          <StatCard
            title={"Ma paie estim\u00e9e"}
            value={`${paieEstimee.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} \u20ac`}
            subtitle={<span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>{"P\u00e9riode en cours"} <DeltaBadge current={paieEstimee} previous={prevPaie} /></span>}
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
            title={"Ventes (p\u00e9riode)"}
            value={`${totalBrut.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${devise === 'USD' ? '$' : '\u20ac'}`}
            subtitle={<span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>Montant brut <DeltaBadge current={totalBrut} previous={prevBrut} /></span>}
            icon={TrendingUp}
            color="#10b981"
          />
        </div>
      )}

      {/* Annonces */}
      {!loading && annonces.length > 0 && (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {annonces.map(a => (
            <div key={a.id} style={{
              background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
              borderRadius: '12px', padding: '1rem 1.25rem',
              border: '1px solid rgba(245,183,49,0.3)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                <Megaphone size={16} color="#b8860b" />
                <span style={{ fontWeight: 700, color: '#92400e', fontSize: '0.9rem' }}>{a.title}</span>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#78350f', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>{a.content}</p>
              <p style={{ fontSize: '0.65rem', color: '#a16207', marginTop: '0.35rem' }}>
                {a.author_prenom || ''} · {new Date(a.created_at).toLocaleDateString('fr-FR')}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Objectifs progression */}
      {!loading && objectifsProgress.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Target size={16} color="#f5b731" />
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)' }}>Mes Objectifs</h3>
          </div>
          <div style={{ padding: '0.75rem 1.25rem', display: 'grid', gap: '0.75rem' }}>
            {objectifsProgress.map(obj => {
              const pct = obj.progress;
              const color = pct >= 100 ? '#f5b731' : pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
              return (
                <div key={obj.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.8rem' }}>
                    <span style={{ fontWeight: 600, color: '#1a1f2e' }}>
                      {obj.chatteur_prenom || 'Global'}{obj.modele_pseudo ? ` (${obj.modele_pseudo})` : ''}
                    </span>
                    <span style={{ fontWeight: 700, color }}>{pct}%</span>
                  </div>
                  <div style={{ background: '#f1f5f9', borderRadius: '999px', height: '8px' }}>
                    <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: '999px', transition: 'width 500ms ease' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                    <span>{obj.actual.toFixed(0)} €</span>
                    <span>{obj.montant_cible.toFixed(0)} €</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ventes par modèle (Feature 2) */}
      {!loading && <VentesParModele data={ventesParModele} />}

      {/* Dernières ventes */}
      {!loading && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid rgba(0,0,0,0.06)',
          }}>
            <h2 style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', letterSpacing: '0.05em', margin: 0 }}>
              {"MES DERNI\u00c8RES VENTES"}
            </h2>
          </div>
          <div style={{ padding: '0 1.25rem' }}>
            {ventes.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '2rem 0', textAlign: 'center' }}>
                {"Aucune vente enregistr\u00e9e pour cette p\u00e9riode"}
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
                        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{"\u00b7"} {v.modele_pseudo}</span>
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

      {/* Objectif personnel (Feature 5) */}
      {!loading && user?.chatteur_id && (
        <ObjectifWidget totalBrut={totalBrut} devise={devise} chatteurId={user.chatteur_id} />
      )}
    </div>
  );
}
