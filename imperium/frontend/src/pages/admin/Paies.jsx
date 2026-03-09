import { useState, useEffect } from 'react';
import { Download, CheckCircle, FileText } from 'lucide-react';
import api from '../../api/index.js';

function generatePeriods() {
  const periods = [];
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); // 0-indexed
  let isFirstHalf = now.getDate() < 15;

  for (let i = 0; i < 8; i++) {
    const m = String(month + 1).padStart(2, '0');
    const monthName = new Date(year, month, 1).toLocaleDateString('fr-FR', { month: 'long' });
    const cap = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    if (isFirstHalf) {
      periods.push({
        debut: `${year}-${m}-01`,
        fin: `${year}-${m}-15`,
        label: `1-15 ${cap} ${year}`
      });
      isFirstHalf = false;
      month--;
      if (month < 0) { month = 11; year--; }
    } else {
      const next = new Date(year, month + 1, 1);
      const ny = next.getFullYear();
      const nm = String(next.getMonth() + 1).padStart(2, '0');
      const nextMonth = next.toLocaleDateString('fr-FR', { month: 'long' });
      const capNext = nextMonth.charAt(0).toUpperCase() + nextMonth.slice(1);
      periods.push({
        debut: `${year}-${m}-15`,
        fin: `${ny}-${nm}-01`,
        label: `15 ${cap} - 1 ${capNext} ${ny}`
      });
      isFirstHalf = true;
    }
  }

  return periods;
}

export default function Paies() {
  const periods = generatePeriods();
  const [selectedPeriod, setSelectedPeriod] = useState(periods[0]?.debut || '');
  const [paies, setPaies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!selectedPeriod) return;
    fetchPaies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod]);

  const fetchPaies = async () => {
    setLoading(true);
    setError('');
    try {
      const period = periods.find(p => p.debut === selectedPeriod);
      if (!period) return;
      const res = await api.get(`/api/paies?periode_debut=${period.debut}&periode_fin=${period.fin}`);
      setPaies(res.data);
    } catch {
      setError('Impossible de charger les paies pour cette période.');
      setPaies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!window.confirm('Valider et générer les factures pour cette période ?')) return;
    setValidating(true);
    setError('');
    setSuccess('');
    try {
      const period = periods.find(p => p.debut === selectedPeriod);
      await api.post('/api/paies/calculer', { periode_debut: period.debut, periode_fin: period.fin });
      setSuccess('Factures générées avec succès !');
      fetchPaies();
    } catch {
      setError('Erreur lors de la validation des paies.');
    } finally {
      setValidating(false);
    }
  };

  const handleDownloadPDF = (paieId) => {
    window.open(`/api/paies/${paieId}/facture`, '_blank');
  };

  const selectedLabel = periods.find((p) => p.debut === selectedPeriod)?.label || '';

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 className="page-title">Paies</h2>
          <p className="page-subtitle">Calcul et validation des rémunérations</p>
        </div>
        <select
          className="input-field"
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          style={{ width: 'auto', minWidth: '220px' }}
        >
          {periods.map((p) => (
            <option key={p.debut} value={p.debut}>{p.label}</option>
          ))}
        </select>
      </div>

      {error && <div className="error-box" style={{ marginBottom: '1rem' }}>{error}</div>}
      {success && (
        <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '12px', padding: '0.75rem 1rem', color: '#10b981', marginBottom: '1rem', fontSize: '0.875rem' }}>
          {success}
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={16} color="#1b2e4b" />
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Paies — {selectedLabel}</span>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <div className="spinner" />
          </div>
        ) : (
          <div className="table-wrapper" style={{ borderRadius: 0, border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Plateforme</th>
                  <th style={{ textAlign: 'right' }}>Ventes brutes</th>
                  <th style={{ textAlign: 'right' }}>Net HT</th>
                  <th style={{ textAlign: 'right' }}>Commission</th>
                  <th style={{ textAlign: 'right' }}>Malus</th>
                  <th style={{ textAlign: 'right' }}>Prime</th>
                  <th style={{ textAlign: 'right' }}>TOTAL</th>
                  <th style={{ textAlign: 'center' }}>PDF</th>
                </tr>
              </thead>
              <tbody>
                {paies.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                      Aucune paie pour cette période.
                    </td>
                  </tr>
                ) : (
                  paies.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.nom}</td>
                      <td><span className="badge badge-navy">{p.plateforme}</span></td>
                      <td style={{ textAlign: 'right', color: '#64748b' }}>{(p.ventes_brutes || 0).toLocaleString('fr-FR')} €</td>
                      <td style={{ textAlign: 'right' }}>{(p.net_ht || 0).toLocaleString('fr-FR')} €</td>
                      <td style={{ textAlign: 'right', color: '#ef4444' }}>-{(p.commission || 0).toLocaleString('fr-FR')} €</td>
                      <td style={{ textAlign: 'right', color: p.malus > 0 ? '#ef4444' : '#94a3b8' }}>
                        {p.malus > 0 ? `-${(p.malus).toLocaleString('fr-FR')} €` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', color: p.prime > 0 ? '#10b981' : '#94a3b8' }}>
                        {p.prime > 0 ? `+${(p.prime).toLocaleString('fr-FR')} €` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#f5b731', fontSize: '1rem' }}>
                        {(p.total || 0).toLocaleString('fr-FR')} €
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {p.facture_generee ? (
                          <button
                            className="btn-ghost"
                            onClick={() => handleDownloadPDF(p.id)}
                            title="Télécharger la facture"
                            style={{ padding: '0.35rem 0.5rem' }}
                          >
                            <Download size={15} color="#1b2e4b" />
                          </button>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer action */}
        <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn-primary"
            onClick={handleValidate}
            disabled={validating || loading || paies.length === 0}
          >
            {validating ? (
              <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
            ) : (
              <CheckCircle size={16} />
            )}
            Valider et générer factures
          </button>
        </div>
      </div>
    </div>
  );
}
