import { useState, useEffect, useCallback } from 'react';
import { Target, Plus, Edit2, Trash2, Trophy } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast.jsx';
import ConfirmModal from '../../components/ConfirmModal.jsx';

function getPeriode() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  if (now.getDate() < 15) {
    return { debut: `${y}-${m}-01`, fin: `${y}-${m}-15` };
  }
  const next = new Date(y, now.getMonth() + 1, 1);
  const ny = next.getFullYear(), nm = String(next.getMonth() + 1).padStart(2, '0');
  return { debut: `${y}-${m}-15`, fin: `${ny}-${nm}-01` };
}

const DEFAULT_PALIERS = [
  { seuil_pct: 100, bonus_par_chatteur: 20, label: 'Objectif', emoji: '\uD83C\uDFAF' },
];

export default function Objectifs() {
  const [periode, setPeriode] = useState(getPeriode);
  const [collectif, setCollectif] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [collectifModal, setCollectifModal] = useState(null);
  const [deleteCollectif, setDeleteCollectif] = useState(false);
  const toast = useToast();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const colRes = await api.get(`/api/objectifs/collectif?periode_debut=${periode.debut}&periode_fin=${periode.fin}`);
      setCollectif(colRes.data);
    } catch {
      setFetchError('Impossible de charger les données.');
    }
    setLoading(false);
  }, [periode]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSaveCollectif = async (form) => {
    try {
      if (form.id) {
        await api.put(`/api/objectifs/collectif/${form.id}`, {
          montant_cible: form.montant_cible,
          description: form.description,
          paliers: form.paliers,
        });
        toast('Objectif collectif mis à jour', 'success');
      } else {
        await api.post('/api/objectifs/collectif', {
          montant_cible: form.montant_cible,
          periode_debut: form.periode_debut,
          periode_fin: form.periode_fin,
          description: form.description,
          paliers: form.paliers,
        });
        toast('Objectif collectif créé', 'success');
        // Update periode to match the new objective so fetchAll loads it
        setPeriode({ debut: form.periode_debut, fin: form.periode_fin });
      }
      setCollectifModal(null);
      fetchAll();
    } catch (err) {
      toast(err.response?.data?.error || 'Erreur', 'error');
    }
  };

  const handleDeleteCollectif = async () => {
    try {
      await api.delete(`/api/objectifs/collectif/${collectif.id}`);
      toast('Objectif collectif supprimé', 'success');
      setDeleteCollectif(false);
      fetchAll();
    } catch (err) {
      toast(err.response?.data?.error || 'Erreur', 'error');
    }
  };

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 style={{ fontWeight: 700, color: '#1a1f2e', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Target size={24} color="#f5b731" /> Objectifs
        </h1>
      </div>

      {fetchError ? (
        <div className="alert alert-error" role="alert" style={{ marginBottom: '1rem' }}>
          {fetchError}
          <button onClick={fetchAll} className="btn-ghost" style={{ marginLeft: '1rem', fontSize: '0.8rem' }}>Réessayer</button>
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" /></div>
      ) : (
        <>
          {/* ========== OBJECTIF COLLECTIF ========== */}
          <CollectifSection
            collectif={collectif}
            onEdit={() => setCollectifModal(collectif || {})}
            onDelete={() => setDeleteCollectif(true)}
          />
        </>
      )}

      {collectifModal && (
        <CollectifModal data={collectifModal}
          onClose={() => setCollectifModal(null)} onSave={handleSaveCollectif} />
      )}

      {deleteCollectif && (
        <ConfirmModal message="Supprimer l'objectif collectif ?" onConfirm={handleDeleteCollectif} onCancel={() => setDeleteCollectif(false)} />
      )}
    </div>
  );
}

/* ─── Tier colors now come from DB via shared utility ─── */

/* ========== COLLECTIF SECTION ========== */

function CollectifSection({ collectif, onEdit, onDelete }) {
  if (!collectif) {
    return (
      <div className="card" style={{
        padding: '2rem', textAlign: 'center',
        background: 'linear-gradient(135deg, #fefce8 0%, #fff7ed 100%)',
        border: '1px solid rgba(245,183,49,0.2)',
      }}>
        <Trophy size={32} color="#f5b731" style={{ margin: '0 auto 0.75rem' }} />
        <p style={{ fontWeight: 600, color: '#1a1f2e', marginBottom: '0.5rem' }}>
          Objectif collectif
        </p>
        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
          {`D\u00e9finissez un objectif de chiffre d'affaires Net HT pour toute l'\u00e9quipe. Quand l'objectif est atteint, chaque chatteur re\u00e7oit un bonus.`}
        </p>
        <button onClick={onEdit} className="btn-primary haptic">
          <Plus size={14} /> {`Cr\u00e9er un objectif collectif`}
        </button>
      </div>
    );
  }

  const { actual_net_ht = 0, montant_cible = 1, progress_pct = 0, palier_atteint, description, paliers = [] } = collectif;
  const reached = progress_pct >= 100;
  const bonus = paliers.length > 0 ? paliers[paliers.length - 1].bonus_par_chatteur : 0;
  const barPct = Math.min(100, progress_pct);

  return (
    <div className="card" style={{
      background: 'linear-gradient(135deg, #fefce8 0%, #fff7ed 100%)',
      border: '1px solid rgba(245,183,49,0.2)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ animation: reached ? 'trophyBounce 1.5s ease-in-out infinite' : 'none', display: 'inline-flex' }}>
            <Trophy size={20} color="#f5b731" />
          </span>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a1f2e', margin: 0 }}>
            Objectif collectif
          </h2>
          {reached && (
            <span style={{
              fontSize: '0.7rem', padding: '2px 10px', borderRadius: '99px', fontWeight: 600,
              background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.3)',
            }}>
              {'\u2705'} Atteint !
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={onEdit} className="icon-btn" title="Modifier" aria-label="Modifier l'objectif collectif"><Edit2 size={14} /></button>
          <button onClick={onDelete} className="icon-btn" style={{ color: '#ef4444' }} title="Supprimer" aria-label="Supprimer l'objectif collectif"><Trash2 size={14} /></button>
        </div>
      </div>

      <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.75rem' }}>
        {`Quand l'\u00e9quipe atteint l'objectif de CA Net HT, chaque chatteur re\u00e7oit `}
        <strong style={{ color: '#10b981' }}>+{bonus}{'\u20ac'}</strong> de bonus.
      </p>

      {description && (
        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem', fontStyle: 'italic' }}>
          {description}
        </p>
      )}

      {/* Progress numbers */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1f2e' }}>
          {actual_net_ht.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} {'\u20ac'}
        </span>
        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
          / {montant_cible.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} {'\u20ac'} ({progress_pct.toFixed(1)}%)
        </span>
      </div>

      {/* Thermometer */}
      <div style={{ position: 'relative', marginBottom: '1rem' }}>
        <div style={{
          background: '#e2e8f0', borderRadius: '999px', height: '16px', overflow: 'hidden',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)',
          position: 'relative',
        }}>
          <div style={{
            width: `${barPct}%`, height: '100%', borderRadius: '999px',
            background: reached
              ? 'linear-gradient(90deg, #f5b731cc, #f5b731)'
              : 'linear-gradient(90deg, #94a3b8, #64748b)',
            transition: 'width 800ms ease',
            animation: reached ? 'glowPulseGold 2s ease-in-out infinite' : 'none',
          }} />
          {reached && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              borderRadius: '999px',
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 2s linear infinite',
              pointerEvents: 'none',
            }} />
          )}
        </div>

        {/* Target marker at 100% */}
        <div style={{
          position: 'absolute', right: 0, top: '-5px',
          transform: 'translateX(50%)',
        }}>
          <div style={{
            width: '26px', height: '26px', borderRadius: '50%',
            background: reached ? '#f5b731' : '#cbd5e1',
            border: `2.5px solid ${reached ? '#f5b731' : '#fff'}`,
            boxShadow: reached ? '0 3px 10px rgba(245,183,49,0.4)' : '0 1px 3px rgba(0,0,0,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.7rem', fontWeight: 700,
          }}>
            {reached ? '\uD83C\uDFC6' : '\uD83C\uDFAF'}
          </div>
        </div>
      </div>

      {/* Bonus card */}
      <div style={{
        padding: '0.75rem 1rem', borderRadius: '10px',
        background: reached ? 'rgba(16,185,129,0.08)' : '#f8fafc',
        border: `1px solid ${reached ? 'rgba(16,185,129,0.2)' : '#e2e8f0'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1a1f2e' }}>
            {reached ? 'Bonus collectif activ\u00e9 !' : `Objectif : ${montant_cible.toLocaleString('fr-FR')} \u20ac Net HT`}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.15rem' }}>
            {reached ? 'Chaque chatteur re\u00e7oit le bonus' : `Il reste ${Math.max(0, montant_cible - actual_net_ht).toLocaleString('fr-FR')} \u20ac \u00e0 atteindre`}
          </div>
        </div>
        <div style={{
          padding: '0.4rem 0.8rem', borderRadius: '20px',
          background: reached ? 'rgba(16,185,129,0.15)' : 'rgba(245,183,49,0.1)',
          fontSize: '1rem', fontWeight: 800,
          color: reached ? '#059669' : '#f5b731',
        }}>
          +{bonus}{'\u20ac'}
        </div>
      </div>
    </div>
  );
}

/* ========== COLLECTIF MODAL ========== */

/* ─── Duration helpers for collective objective ─── */
function computePeriodDates(duree) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed
  const mStr = String(m + 1).padStart(2, '0');

  if (duree === 'periode') {
    // Current quinzaine
    if (now.getDate() < 15) {
      return { debut: `${y}-${mStr}-01`, fin: `${y}-${mStr}-15` };
    }
    const next = new Date(y, m + 1, 1);
    return { debut: `${y}-${mStr}-15`, fin: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01` };
  }
  if (duree === 'mois') {
    const last = new Date(y, m + 1, 0).getDate();
    return { debut: `${y}-${mStr}-01`, fin: `${y}-${mStr}-${last}` };
  }
  // annee
  return { debut: `${y}-01-01`, fin: `${y}-12-31` };
}

function dureeLabel(duree) {
  const dates = computePeriodDates(duree);
  const fmt = d => new Date(d + 'T00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${fmt(dates.debut)} — ${fmt(dates.fin)}`;
}

const DUREE_OPTIONS = [
  { value: 'periode', label: 'Quinzaine', desc: 'Période de paie en cours' },
  { value: 'mois', label: 'Mois', desc: 'Mois calendaire en cours' },
  { value: 'annee', label: 'Ann\u00e9e', desc: 'Ann\u00e9e en cours' },
];

function CollectifModal({ data, onClose, onSave }) {
  const isEdit = !!data.id;
  const existingBonus = (data.paliers && data.paliers.length > 0) ? data.paliers[data.paliers.length - 1].bonus_par_chatteur : '';
  const [form, setForm] = useState({
    id: data.id || null,
    montant_cible: data.montant_cible || '',
    description: data.description || '',
    bonus: existingBonus,
    duree: 'periode',
  });
  const [suggestions, setSuggestions] = useState(null);

  useEffect(() => {
    if (isEdit) return;
    api.get('/api/objectifs/suggestions')
      .then(res => setSuggestions(res.data))
      .catch(() => {});
  }, [isEdit]);

  const handleSubmit = () => {
    const dates = computePeriodDates(form.duree);
    const parsed = {
      ...form,
      montant_cible: parseFloat(form.montant_cible),
      periode_debut: dates.debut,
      periode_fin: dates.fin,
      paliers: [{
        seuil_pct: 100,
        bonus_par_chatteur: parseFloat(form.bonus),
        label: 'Objectif',
        emoji: '\uD83C\uDFAF',
      }],
    };
    onSave(parsed);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Trophy size={18} color="#f5b731" />
          {isEdit ? 'Modifier' : 'Nouvel'} objectif collectif
        </h2>

        <p style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '1rem' }}>
          {`D\u00e9finissez un objectif de chiffre d'affaires Net HT pour l'\u00e9quipe. Quand l'objectif est atteint, chaque chatteur actif re\u00e7oit le bonus.`}
        </p>

        {/* Duration selector — only for creation */}
        {!isEdit && (
          <>
            <label className="label">{`Dur\u00e9e`}</label>
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
              {DUREE_OPTIONS.map(opt => {
                const active = form.duree === opt.value;
                return (
                  <button key={opt.value}
                    onClick={() => setForm(f => ({ ...f, duree: opt.value }))}
                    style={{
                      flex: 1, padding: '0.5rem 0.4rem', borderRadius: '10px',
                      border: `2px solid ${active ? '#f5b731' : '#e2e8f0'}`,
                      background: active ? 'rgba(245,183,49,0.08)' : '#fff',
                      cursor: 'pointer', textAlign: 'center',
                      transition: 'all 200ms ease',
                    }}
                    className="hover-lift"
                  >
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: active ? '#92400e' : '#1a1f2e' }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.1rem' }}>
                      {opt.desc}
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
              {dureeLabel(form.duree)}
            </div>
          </>
        )}

        <label className="label">Objectif CA Net HT ({'\u20ac'})</label>
        <input type="number" step="0.01" value={form.montant_cible}
          onChange={e => setForm(f => ({ ...f, montant_cible: e.target.value }))}
          className="input-field" placeholder="Ex: 10000" />

        {/* Suggestions — scaled by duration (API returns quinzaine-based values) */}
        {!isEdit && suggestions && suggestions.periodes?.length > 0 && (() => {
          const mult = form.duree === 'annee' ? 24 : form.duree === 'mois' ? 2 : 1;
          const scale = v => Math.round(v * mult);
          return (
          <div style={{
            marginTop: '0.5rem', display: 'flex', gap: '0.4rem',
          }}>
            {[
              { label: 'R\u00e9aliste', value: scale(suggestions.suggestions.realiste), color: '#10b981' },
              { label: 'Ambitieux', value: scale(suggestions.suggestions.ambitieux), color: '#f59e0b' },
              { label: 'Challenge', value: scale(suggestions.suggestions.challenge), color: '#ef4444' },
            ].map(s => (
              <button key={s.label}
                onClick={() => setForm(f => ({ ...f, montant_cible: s.value }))}
                style={{
                  flex: 1, padding: '0.35rem', borderRadius: '8px',
                  border: `1px solid ${s.color}30`, background: `${s.color}08`,
                  cursor: 'pointer', textAlign: 'center',
                }}
                className="hover-lift"
              >
                <p style={{ fontSize: '0.6rem', color: s.color, fontWeight: 600, margin: 0, textTransform: 'uppercase' }}>
                  {s.label}
                </p>
                <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1a1f2e', margin: '0.1rem 0 0' }}>
                  {s.value.toLocaleString('fr-FR')} {'\u20ac'}
                </p>
              </button>
            ))}
          </div>
          );
        })()}

        <label className="label" style={{ marginTop: '0.75rem' }}>Bonus par chatteur ({'\u20ac'})</label>
        <input type="number" step="0.01" value={form.bonus}
          onChange={e => setForm(f => ({ ...f, bonus: e.target.value }))}
          className="input-field" placeholder="Ex: 10" />
        <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.15rem', display: 'block' }}>
          Montant en {'\u20ac'} que chaque chatteur recevra quand l'objectif est atteint
        </span>

        <label className="label" style={{ marginTop: '0.75rem' }}>Description (optionnel)</label>
        <input type="text" value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          className="input-field" placeholder={`Message motivant pour l'\u00e9quipe...`} />

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-secondary">Annuler</button>
          <button onClick={handleSubmit} className="btn-primary haptic">{isEdit ? 'Modifier' : 'Cr\u00e9er'}</button>
        </div>
      </div>
    </div>
  );
}


