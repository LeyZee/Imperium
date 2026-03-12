import { useState, useEffect, useCallback } from 'react';
import { Target, Plus, Edit2, Trash2 } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast.jsx';
import ConfirmModal from '../../components/ConfirmModal.jsx';

function getPeriode() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  if (now.getDate() <= 15) {
    return { debut: `${y}-${m}-01`, fin: `${y}-${m}-15` };
  }
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return { debut: `${y}-${m}-16`, fin: `${y}-${m}-${lastDay}` };
}

function progressColor(pct) {
  if (pct >= 100) return '#f5b731';
  if (pct >= 80) return '#22c55e';
  if (pct >= 50) return '#f59e0b';
  return '#ef4444';
}

export default function Objectifs() {
  const [periode, setPeriode] = useState(getPeriode);
  const [objectifs, setObjectifs] = useState([]);
  const [progress, setProgress] = useState([]);
  const [chatteurs, setChatteurs] = useState([]);
  const [modeles, setModeles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const { addToast } = useToast();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [oRes, pRes, cRes, mRes] = await Promise.all([
        api.get(`/api/objectifs?periode_debut=${periode.debut}&periode_fin=${periode.fin}`),
        api.get(`/api/objectifs/progress?periode_debut=${periode.debut}&periode_fin=${periode.fin}`),
        api.get('/api/chatteurs'),
        api.get('/api/modeles'),
      ]);
      setObjectifs(oRes.data);
      setProgress(pRes.data);
      setChatteurs(cRes.data);
      setModeles(mRes.data);
    } catch { /* empty */ }
    setLoading(false);
  }, [periode]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSave = async (form) => {
    try {
      if (form.id) {
        await api.put(`/api/objectifs/${form.id}`, { montant_cible: form.montant_cible });
        addToast('Objectif mis à jour', 'success');
      } else {
        await api.post('/api/objectifs', form);
        addToast('Objectif créé', 'success');
      }
      setModal(null);
      fetchAll();
    } catch (err) {
      addToast(err.response?.data?.error || 'Erreur', 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/api/objectifs/${deleteId}`);
      addToast('Objectif supprimé', 'success');
      setDeleteId(null);
      fetchAll();
    } catch (err) {
      addToast(err.response?.data?.error || 'Erreur', 'error');
    }
  };

  return (
    <div className="page-enter" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1f2e', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Target size={24} color="#f5b731" /> Objectifs
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input type="date" value={periode.debut} onChange={e => setPeriode(p => ({ ...p, debut: e.target.value }))}
            className="input-field" style={{ width: 'auto' }} />
          <span style={{ color: '#94a3b8' }}>→</span>
          <input type="date" value={periode.fin} onChange={e => setPeriode(p => ({ ...p, fin: e.target.value }))}
            className="input-field" style={{ width: 'auto' }} />
          <button onClick={() => setModal({})} className="btn-primary haptic">
            <Plus size={16} /> Ajouter
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" /></div>
      ) : progress.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
          Aucun objectif pour cette période
        </div>
      ) : (
        <div className="stagger-children" style={{ display: 'grid', gap: '1rem' }}>
          {progress.map(obj => {
            const color = progressColor(obj.progress);
            return (
              <div key={obj.id} className="card hover-lift">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div>
                    <span style={{ fontWeight: 700, color: '#1a1f2e', fontSize: '0.95rem' }}>
                      {obj.chatteur_prenom || 'Global'}
                    </span>
                    {obj.modele_pseudo && (
                      <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                        ({obj.modele_pseudo})
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 700, color, fontSize: '1.1rem' }}>{obj.progress}%</span>
                    <button onClick={() => setModal(obj)} className="icon-btn" title="Modifier"><Edit2 size={14} /></button>
                    <button onClick={() => setDeleteId(obj.id)} className="icon-btn" style={{ color: '#ef4444' }} title="Supprimer"><Trash2 size={14} /></button>
                  </div>
                </div>

                <div style={{ background: '#f1f5f9', borderRadius: '999px', height: '10px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(obj.progress, 100)}%`, height: '100%',
                    background: color, borderRadius: '999px', transition: 'width 500ms ease',
                  }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
                  <span>Réalisé: {obj.actual.toFixed(2)} €</span>
                  <span>Objectif: {obj.montant_cible.toFixed(2)} €</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <ObjectifModal data={modal} chatteurs={chatteurs} modeles={modeles} periode={periode}
          onClose={() => setModal(null)} onSave={handleSave} />
      )}

      {deleteId && (
        <ConfirmModal message="Supprimer cet objectif ?" onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />
      )}
    </div>
  );
}

function ObjectifModal({ data, chatteurs, modeles, periode, onClose, onSave }) {
  const isEdit = !!data.id;
  const [form, setForm] = useState({
    chatteur_id: data.chatteur_id || '',
    modele_id: data.modele_id || '',
    montant_cible: data.montant_cible || '',
    periode_debut: data.periode_debut || periode.debut,
    periode_fin: data.periode_fin || periode.fin,
    ...(isEdit ? { id: data.id } : {}),
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
          {isEdit ? 'Modifier' : 'Nouvel'} objectif
        </h2>

        {!isEdit && (
          <>
            <label className="label">Chatteur (vide = global)</label>
            <select value={form.chatteur_id} onChange={e => setForm(f => ({ ...f, chatteur_id: e.target.value }))}
              className="input-field">
              <option value="">Global (tous)</option>
              {chatteurs.map(c => <option key={c.id} value={c.id}>{c.prenom}</option>)}
            </select>

            <label className="label" style={{ marginTop: '0.75rem' }}>Modèle (optionnel)</label>
            <select value={form.modele_id} onChange={e => setForm(f => ({ ...f, modele_id: e.target.value }))}
              className="input-field">
              <option value="">Tous les modèles</option>
              {modeles.map(m => <option key={m.id} value={m.id}>{m.pseudo}</option>)}
            </select>
          </>
        )}

        <label className="label" style={{ marginTop: '0.75rem' }}>Montant cible (€)</label>
        <input type="number" step="0.01" value={form.montant_cible}
          onChange={e => setForm(f => ({ ...f, montant_cible: e.target.value }))}
          className="input-field" />

        {!isEdit && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <div style={{ flex: 1 }}>
              <label className="label">Début</label>
              <input type="date" value={form.periode_debut}
                onChange={e => setForm(f => ({ ...f, periode_debut: e.target.value }))} className="input-field" />
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">Fin</label>
              <input type="date" value={form.periode_fin}
                onChange={e => setForm(f => ({ ...f, periode_fin: e.target.value }))} className="input-field" />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-secondary">Annuler</button>
          <button onClick={() => onSave(form)} className="btn-primary haptic">{isEdit ? 'Modifier' : 'Créer'}</button>
        </div>
      </div>
    </div>
  );
}
