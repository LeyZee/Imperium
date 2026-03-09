import { useState, useEffect } from 'react';
import api from '../../api/index';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

const CRENEAUX = [
  { id: 1, label: '08h – 14h' },
  { id: 2, label: '14h – 20h' },
  { id: 3, label: '20h – 02h' },
  { id: 4, label: '02h – 08h' },
];

const COLORS = ['#1b2e4b','#3b82f6','#10b981','#f5b731','#8b5cf6','#ec4899','#ef4444','#06b6d4'];

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff); d.setHours(0,0,0,0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date); d.setDate(d.getDate() + n); return d;
}

function toISO(date) { return date.toISOString().split('T')[0]; }

export default function Shifts() {
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [shifts, setShifts] = useState([]);
  const [chatteurs, setChatteurs] = useState([]);
  const [modeles, setModeles] = useState([]);
  const [modal, setModal] = useState(null);
  const [selChatteur, setSelChatteur] = useState('');
  const [selModele, setSelModele] = useState('');
  const [existingShift, setExistingShift] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/api/chatteurs'), api.get('/api/modeles')]).then(([c, m]) => {
      setChatteurs(c.data); setModeles(m.data);
    });
  }, []);

  useEffect(() => { fetchShifts(); }, [weekStart]);

  async function fetchShifts() {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/shifts/semaine?date=${toISO(weekStart)}`);
      setShifts(data.shifts || []);
    } finally { setLoading(false); }
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const jours = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  function getShift(date, creneau) {
    return shifts.find(s => s.date === toISO(date) && s.creneau === creneau);
  }

  function getChatteurColor(id) {
    return COLORS[id % COLORS.length];
  }

  function openModal(date, creneau) {
    const existing = getShift(date, creneau);
    setExistingShift(existing || null);
    setSelChatteur(existing?.chatteur_id?.toString() || '');
    setSelModele(existing?.modele_id?.toString() || '');
    setModal({ date: toISO(date), creneau });
  }

  async function handleAssign() {
    if (!selChatteur) return;
    try {
      if (existingShift) await api.delete(`/api/shifts/${existingShift.id}`);
      await api.post('/api/shifts', { chatteur_id: parseInt(selChatteur), modele_id: selModele ? parseInt(selModele) : null, date: modal.date, creneau: modal.creneau });
      setModal(null); fetchShifts();
    } catch (err) { console.error(err); }
  }

  async function handleDelete() {
    if (!existingShift) return;
    await api.delete(`/api/shifts/${existingShift.id}`);
    setModal(null); fetchShifts();
  }

  const getChatteurName = id => { const c = chatteurs.find(c => c.id == id); return c ? `${c.prenom}` : '?'; };
  const getModeleName = id => { const m = modeles.find(m => m.id == id); return m ? m.prenom : ''; };

  return (
    <div className="fade-in p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-navy">Planning Shifts</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="p-2 card hover:shadow-md transition-shadow"><ChevronLeft size={18} /></button>
          <span className="text-sm font-medium">Semaine du {weekStart.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}</span>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="p-2 card hover:shadow-md transition-shadow"><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="card overflow-x-auto" style={{ padding: 0 }}>
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr>
              <th className="py-3 px-3 text-left w-24">Créneau</th>
              {days.map((d, i) => (
                <th key={i} className="py-3 px-2 text-center">
                  <div className="text-slate-400 text-xs">{jours[i]}</div>
                  <div className="font-medium">{d.getDate()}/{d.getMonth()+1}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CRENEAUX.map(cr => (
              <tr key={cr.id}>
                <td className="py-2 px-3 text-slate-500 text-xs font-medium">{cr.label}</td>
                {days.map((d, i) => {
                  const s = getShift(d, cr.id);
                  return (
                    <td key={i} className="py-2 px-1">
                      <button onClick={() => openModal(d, cr.id)}
                        className="w-full rounded-lg p-2 text-xs transition-all hover:shadow-sm min-h-[52px] text-left"
                        style={{ backgroundColor: s ? getChatteurColor(s.chatteur_id) + '15' : '#f8fafc', border: `1px solid ${s ? getChatteurColor(s.chatteur_id) + '30' : '#e2e8f0'}` }}>
                        {s ? (
                          <span style={{ color: getChatteurColor(s.chatteur_id) }} className="font-medium">
                            {getChatteurName(s.chatteur_id)}{s.modele_id ? <span className="text-slate-400 block">{getModeleName(s.modele_id)}</span> : null}
                          </span>
                        ) : <span className="text-slate-300 text-xs">— Vide —</span>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="card w-full max-w-sm" style={{ animation: 'floatIn 0.25s ease' }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-navy">Assigner un shift</h2>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <p className="text-sm text-slate-500 mb-4">{modal.date} · {CRENEAUX.find(c => c.id === modal.creneau)?.label}</p>
            <div className="space-y-3">
              <div><label className="label">Chatteur</label>
                <select className="input-field" value={selChatteur} onChange={e => setSelChatteur(e.target.value)}>
                  <option value="">Choisir...</option>
                  {chatteurs.map(c => <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}
                </select>
              </div>
              <div><label className="label">Modèle (optionnel)</label>
                <select className="input-field" value={selModele} onChange={e => setSelModele(e.target.value)}>
                  <option value="">Aucun</option>
                  {modeles.map(m => <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>)}
                </select>
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={handleAssign} className="btn-primary flex-1">Assigner</button>
                {existingShift && <button onClick={handleDelete} className="btn-danger flex-1">Supprimer</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
