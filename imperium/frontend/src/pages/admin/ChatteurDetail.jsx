import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Euro, Trophy, AlertCircle, Calendar, Minus, Plus, MessageSquare, Trash2, Send } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import api from '../../utils/api';
import { CHATTEUR_COLORS } from '../../constants/colors';
import StatCard from '../../components/StatCard.jsx';
import { CardSkeleton } from '../../components/Skeleton.jsx';

const PAYS_ISO = { 'France': 'fr', 'Benin': 'bj', 'Madagascar': 'mg' };
const DONUT_COLORS = ['#f5b731', '#1b2e4b', '#6366f1', '#10b981', '#ef4444', '#8b5cf6', '#f97316', '#06b6d4'];
const MOIS_COURTS = ['Jan', 'F\u00e9v', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Ao\u00fbt', 'Sep', 'Oct', 'Nov', 'D\u00e9c'];

export default function ChatteurDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [chatteur, setChatteur] = useState(null);
  const [kpis, setKpis] = useState(null);
  const [historique, setHistorique] = useState([]);
  const [ventesParModele, setVentesParModele] = useState([]);
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ventesRecentes, setVentesRecentes] = useState([]);

  useEffect(() => { fetchAll(); }, [id]);

  async function fetchAll() {
    setLoading(true);
    try {
      const [cRes, kRes, hRes, mRes, nRes, vRes] = await Promise.all([
        api.get(`/api/chatteurs/${id}`),
        api.get(`/api/chatteurs/${id}/kpis`),
        api.get(`/api/chatteurs/${id}/historique`),
        api.get(`/api/ventes/par-modele?chatteur_id=${id}`),
        api.get(`/api/notes?chatteur_id=${id}`).catch(() => ({ data: [] })),
        api.get(`/api/ventes?chatteur_id=${id}&limit=10`).catch(() => ({ data: [] })),
      ]);
      setChatteur(cRes.data);
      setKpis(kRes.data);
      setHistorique(hRes.data || []);
      setVentesParModele(mRes.data || []);
      setNotes(nRes.data || []);
      setVentesRecentes(Array.isArray(vRes.data) ? vRes.data.slice(0, 10) : []);
    } catch {
      setError('Impossible de charger les donn\u00e9es du chatteur.');
    } finally {
      setLoading(false);
    }
  }

  async function addNote() {
    if (!noteText.trim()) return;
    try {
      await api.post('/api/notes', { chatteur_id: id, content: noteText });
      setNoteText('');
      const { data } = await api.get(`/api/notes?chatteur_id=${id}`);
      setNotes(data || []);
    } catch { /* empty */ }
  }

  async function deleteNote(noteId) {
    try {
      await api.delete(`/api/notes/${noteId}`);
      setNotes(prev => prev.filter(n => n.id !== noteId));
    } catch { /* empty */ }
  }

  if (loading) {
    return (
      <div className="page-enter">
        <button onClick={() => navigate(-1)} className="btn-ghost" style={{ marginBottom: '1rem' }}>
          <ArrowLeft size={16} /> Retour
        </button>
        <CardSkeleton count={4} />
      </div>
    );
  }

  if (error || !chatteur) {
    return (
      <div className="page-enter">
        <button onClick={() => navigate(-1)} className="btn-ghost" style={{ marginBottom: '1rem' }}>
          <ArrowLeft size={16} /> Retour
        </button>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <AlertCircle size={40} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
          <p style={{ color: '#64748b' }}>{error || 'Chatteur introuvable'}</p>
        </div>
      </div>
    );
  }

  const colorInfo = CHATTEUR_COLORS[chatteur.couleur] || CHATTEUR_COLORS[0];
  const countryCode = PAYS_ISO[chatteur.pays] || 'fr';

  // Compute total brut EUR from kpis
  const totalBrut = kpis?.ventes?.reduce((s, v) => s + (v.total_brut || 0), 0) || 0;

  const stats = [
    { title: 'Total Ventes', value: `${totalBrut.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} \u20ac`, icon: Euro, color: '#f5b731' },
    { title: 'Commission', value: `${(kpis?.commission_totale || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} \u20ac`, icon: Euro, color: '#10b981' },
    { title: 'Rang', value: kpis?.rang ? `${kpis.rang}/${kpis.nb_chatteurs}` : '\u2014', icon: Trophy, color: '#f59e0b' },
    { title: 'Malus', value: `${(kpis?.malus_total || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} \u20ac`, icon: Minus, color: '#ef4444' },
    { title: 'Primes', value: `${(kpis?.primes_total || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} \u20ac`, icon: Plus, color: '#8b5cf6' },
    { title: 'Shifts', value: kpis?.nb_shifts || 0, icon: Calendar, color: '#1b2e4b' },
  ];

  // Chart data for evolution
  const chartData = historique.map(p => {
    const deb = new Date(p.periode_debut + 'T00:00:00');
    const fin = new Date(p.periode_fin + 'T00:00:00');
    const mois = MOIS_COURTS[deb.getMonth()];
    return {
      label: `${deb.getDate()}-${fin.getDate()} ${mois}`,
      fullLabel: `${deb.getDate()} - ${fin.getDate()} ${mois} ${fin.getFullYear()}`,
      net_ht: parseFloat((p.total_net_ht || 0).toFixed(2)),
      commission: parseFloat((p.total_commission || 0).toFixed(2)),
    };
  });

  // Pie data for modeles
  const totalModeles = ventesParModele.reduce((s, d) => s + d.total_brut, 0);
  const modelesPie = ventesParModele.map(d => ({
    ...d,
    pseudo: d.pseudo || 'Non assign\u00e9',
    percentage: totalModeles > 0 ? (d.total_brut / totalModeles) * 100 : 0,
  }));

  // Pie data for plateformes
  const totalPlat = kpis?.ventes_par_plateforme?.reduce((s, d) => s + d.total_brut, 0) || 0;
  const platPie = (kpis?.ventes_par_plateforme || []).map(d => ({
    ...d,
    name: d.plateforme,
    percentage: totalPlat > 0 ? (d.total_brut / totalPlat) * 100 : 0,
  }));

  return (
    <div className="page-enter">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button onClick={() => navigate(-1)} className="btn-ghost" style={{ padding: '0.4rem' }}>
          <ArrowLeft size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
          {/* Avatar */}
          {chatteur.photo ? (
            <img src={chatteur.photo} alt="" style={{
              width: 56, height: 56, borderRadius: '50%', objectFit: 'cover',
              border: `3px solid ${colorInfo.bg}`,
            }} />
          ) : (
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: colorInfo.bg, border: `3px solid ${colorInfo.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <User size={24} color={colorInfo.text} />
            </div>
          )}
          <div>
            <h1 style={{ fontWeight: 700, color: '#1a1f2e', marginBottom: '0.15rem' }}>{chatteur.prenom}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
              <span style={{
                padding: '0.15rem 0.5rem', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 600,
                background: chatteur.role === 'manager' ? '#fef3c7' : chatteur.role === 'va' ? '#f3e8ff' : '#dbeafe',
                color: chatteur.role === 'manager' ? '#b45309' : chatteur.role === 'va' ? '#7c3aed' : '#1e40af',
              }}>
                {chatteur.role?.toUpperCase()}
              </span>
              <img src={`https://flagcdn.com/w40/${countryCode}.png`} alt={chatteur.pays}
                style={{ width: 18, height: 13, borderRadius: 2, objectFit: 'cover' }} />
              <span>{chatteur.pays}</span>
            </div>
          </div>
        </div>

        {/* Meta info */}
        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.78rem', color: '#64748b' }}>
          {kpis?.moyenne_par_periode > 0 && (
            <div>
              <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 500, marginBottom: '0.1rem' }}>Moy./p\u00e9riode</p>
              <p style={{ fontWeight: 700, color: '#1a1f2e' }}>{kpis.moyenne_par_periode.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} \u20ac</p>
            </div>
          )}
          {kpis?.meilleure_periode && (
            <div>
              <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 500, marginBottom: '0.1rem' }}>Meilleure p\u00e9riode</p>
              <p style={{ fontWeight: 700, color: '#f5b731' }}>
                {kpis.meilleure_periode.total?.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} \u20ac
              </p>
              <p style={{ fontSize: '0.6rem' }}>{kpis.meilleure_periode.periode_debut} \u2192 {kpis.meilleure_periode.periode_fin}</p>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid stagger-children" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        {stats.map(s => <StatCard key={s.title} {...s} />)}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        {/* Evolution BarChart */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)' }}>\u00c9volution Net HT</h3>
            <p style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{chartData.length} derni\u00e8res p\u00e9riodes</p>
          </div>
          <div style={{ padding: '1rem 0.5rem 0.5rem 0' }}>
            {chartData.length >= 2 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={45}
                    tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${v}`} />
                  <Tooltip formatter={(v) => `${v.toLocaleString('fr-FR')} \u20ac`} labelFormatter={(l) => {
                    const item = chartData.find(d => d.label === l);
                    return item?.fullLabel || l;
                  }} />
                  <Bar dataKey="net_ht" fill="#f5b731" radius={[4,4,0,0]} maxBarSize={40} name="Net HT" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem', fontSize: '0.82rem' }}>
                Pas assez de donn\u00e9es
              </p>
            )}
          </div>
        </div>

        {/* Pie: Modeles */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)' }}>Ventes par mod\u00e8le</h3>
          </div>
          <div style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {modelesPie.length > 0 ? (
              <>
                <div style={{ width: 140, height: 140, flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={modelesPie} cx="50%" cy="50%" innerRadius={35} outerRadius={60}
                        paddingAngle={2} dataKey="total_brut" stroke="none">
                        {modelesPie.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => `${v.toLocaleString('fr-FR')} \u20ac`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {modelesPie.map((d, i) => (
                    <div key={d.pseudo + i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: DONUT_COLORS[i % DONUT_COLORS.length], flexShrink: 0 }} />
                      <span style={{ fontSize: '0.75rem', flex: 1 }}>{d.pseudo}</span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>{d.percentage.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Aucune vente</p>
            )}
          </div>
        </div>
      </div>

      {/* Plateforme Pie + Notes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        {/* Pie: Plateformes */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)' }}>Ventes par plateforme</h3>
          </div>
          <div style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {platPie.length > 0 ? (
              <>
                <div style={{ width: 140, height: 140, flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={platPie} cx="50%" cy="50%" innerRadius={35} outerRadius={60}
                        paddingAngle={2} dataKey="total_brut" stroke="none">
                        {platPie.map((_, i) => <Cell key={i} fill={DONUT_COLORS[(i + 3) % DONUT_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => `${v.toLocaleString('fr-FR')} \u20ac`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {platPie.map((d, i) => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: DONUT_COLORS[(i + 3) % DONUT_COLORS.length], flexShrink: 0 }} />
                      <span style={{ fontSize: '0.75rem', flex: 1 }}>{d.name}</span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>{d.total_brut.toLocaleString('fr-FR')} \u20ac</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Aucune donn\u00e9e</p>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MessageSquare size={16} color="#6366f1" />
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)' }}>Notes</h3>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>({notes.length})</span>
          </div>
          <div style={{ padding: '1rem 1.25rem', maxHeight: '280px', overflowY: 'auto' }}>
            {/* Add note */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Ajouter une note..."
                rows={2}
                style={{
                  flex: 1, resize: 'vertical', borderRadius: '8px', padding: '0.5rem 0.75rem',
                  border: '1px solid #e2e8f0', fontSize: '0.8rem', fontFamily: 'inherit',
                }}
              />
              <button onClick={addNote} className="btn-primary" disabled={!noteText.trim()}
                style={{ padding: '0.4rem 0.7rem', alignSelf: 'flex-end' }}>
                <Send size={14} />
              </button>
            </div>
            {notes.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center', padding: '1rem' }}>
                Aucune note
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {notes.map(n => (
                  <div key={n.id} style={{
                    padding: '0.6rem 0.75rem', borderRadius: '8px',
                    background: '#f8fafc', border: '1px solid #f1f5f9',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6366f1' }}>{n.author_name || 'Admin'}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                          {new Date(n.created_at).toLocaleDateString('fr-FR')}
                        </span>
                        <button onClick={() => deleteNote(n.id)} style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: '0.1rem',
                        }}>
                          <Trash2 size={12} color="#94a3b8" />
                        </button>
                      </div>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: '#1a1f2e', whiteSpace: 'pre-wrap' }}>{n.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent sales */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)' }}>Derni\u00e8res ventes</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Mod\u00e8le</th>
                <th>Plateforme</th>
                <th style={{ textAlign: 'right' }}>Montant</th>
              </tr>
            </thead>
            <tbody>
              {ventesRecentes.length > 0 ? ventesRecentes.map(v => (
                <tr key={v.id}>
                  <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                    {v.created_at ? new Date(v.created_at).toLocaleDateString('fr-FR') : '\u2014'}
                  </td>
                  <td>{v.modele_pseudo || '\u2014'}</td>
                  <td><span className="badge badge-navy">{v.plateforme || '\u2014'}</span></td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#f5b731' }}>
                    {v.montant_brut?.toLocaleString('fr-FR')} {v.devise === 'USD' ? '$' : '\u20ac'}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                    Aucune vente r\u00e9cente
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
