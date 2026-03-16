import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import api from '../../api/index';
import { ChevronLeft, ChevronRight, X, Clock, CalendarPlus, Repeat, Download, AlertTriangle, Trash2 } from 'lucide-react';
import { CHATTEUR_COLORS } from '../../constants/colors';
import { useToast } from '../../components/Toast.jsx';
import { TableSkeleton } from '../../components/Skeleton.jsx';

const CRENEAUX = [
  { id: 1, label: '08h–14h', short: '08-14', startH: 8, endH: 14 },
  { id: 2, label: '14h–20h', short: '14-20', startH: 14, endH: 20 },
  { id: 3, label: '20h–02h', short: '20-02', startH: 20, endH: 26 },
  { id: 4, label: '02h–08h', short: '02-08', startH: 2, endH: 8 },
];

const JOURS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const TIMEZONES = [
  { key: 'France', label: 'France', tz: 'Europe/Paris', offset: 0 },
  { key: 'Bénin', label: 'Bénin', tz: 'Africa/Porto-Novo', offset: 0 },
  { key: 'Madagascar', label: 'Madagascar', tz: 'Indian/Antananarivo', offset: 2 },
];

const PAYS_ISO_TZ = { 'France': 'fr', 'Bénin': 'bj', 'Madagascar': 'mg' };

const COLORS = CHATTEUR_COLORS;

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff); d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date); d.setDate(d.getDate() + n); return d;
}

function toISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function padH(h) {
  const hh = ((h % 24) + 24) % 24;
  return String(hh).padStart(2, '0');
}

function getCreneauShort(cr, tzOffset) {
  const s = cr.startH + tzOffset;
  const e = (cr.endH > 24 ? cr.endH - 24 : cr.endH) + tzOffset;
  return `${padH(s)}-${padH(e)}`;
}

/* ─── Responsive hook ─── */
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
  });
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    setIsMobile(mql.matches);
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

/* ─── Shared overlay style for modals ─── */
const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 50, padding: '1rem',
  animation: 'modalIn 0.2s ease',
};

export default function Shifts() {
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [shifts, setShifts] = useState([]);
  const [chatteurs, setChatteurs] = useState([]);
  const [modeles, setModeles] = useState([]);
  const [plateformes, setPlateformes] = useState([]);
  const [modelesPlateformes, setModelesPlateformes] = useState([]);
  const [activePlatform, setActivePlatform] = useState(null);
  const [selectedTZ, setSelectedTZ] = useState('France');
  const [currentTime, setCurrentTime] = useState('');
  const [modal, setModal] = useState(null);
  const [selChatteur, setSelChatteur] = useState('');
  const [existingShift, setExistingShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [bulkModal, setBulkModal] = useState(false);
  const [hasTemplates, setHasTemplates] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateMsg, setTemplateMsg] = useState('');
  const [conflits, setConflits] = useState(null);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteScope, setDeleteScope] = useState('week'); // 'week' | 'all'
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const timerRef = useRef(null);
  const toast = useToast();

  // Real-time clock for selected timezone
  useEffect(() => {
    function tick() {
      const tz = TIMEZONES.find(t => t.key === selectedTZ);
      if (!tz) return;
      const now = new Date();
      const str = now.toLocaleTimeString('fr-FR', { timeZone: tz.tz, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setCurrentTime(str);
    }
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [selectedTZ]);

  useEffect(() => {
    Promise.all([api.get('/api/chatteurs'), api.get('/api/modeles')]).then(([c, m]) => {
      setChatteurs(c.data);
      setModeles(m.data);
    });
  }, []);

  useEffect(() => { fetchShifts(); }, [weekStart]);

  async function fetchShifts() {
    setLoading(true);
    setFetchError(null);
    try {
      const { data } = await api.get(`/api/shifts/semaine?date=${toISO(weekStart)}`);
      setShifts(data.shifts || []);
      if (data.plateformes?.length) {
        setPlateformes(data.plateformes);
        if (!activePlatform) setActivePlatform(data.plateformes[0].id);
      }
      if (data.modeles_plateformes) {
        setModelesPlateformes(data.modeles_plateformes);
      }
      if (data.has_templates !== undefined) {
        setHasTemplates(data.has_templates);
      }
      // Fetch conflict alerts for current + next week
      const today = new Date();
      const dow = today.getDay();
      const conflictStart = addDays(today, -(dow === 0 ? 6 : dow - 1)); // Monday
      const conflictEnd = addDays(conflictStart, 13); // Sunday of next week
      api.get(`/api/shifts/conflits?date_debut=${toISO(conflictStart)}&date_fin=${toISO(conflictEnd)}`)
        .then(r => setConflits(r.data))
        .catch(() => setConflits(null));
    } catch (err) {
      setFetchError(err.response?.data?.error || err.message || 'Erreur lors du chargement des shifts');
    } finally { setLoading(false); }
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Filter shifts by active platform
  const filteredShifts = shifts.filter(s => s.plateforme_id === activePlatform);

  // Filter models by active platform
  const platformModelIds = modelesPlateformes
    .filter(mp => mp.plateforme_id === activePlatform)
    .map(mp => mp.modele_id);
  const filteredModeles = modeles.filter(m => platformModelIds.includes(m.id));

  const tzOffset = TIMEZONES.find(t => t.key === selectedTZ)?.offset || 0;
  const isMobile = useIsMobile(768);
  const todayISO = useMemo(() => toISO(new Date()), []);

  const getChatteurColor = useCallback((id) => {
    const c = chatteurs.find(x => x.id === id);
    if (c && c.couleur !== undefined && c.couleur !== null) {
      return COLORS[c.couleur % COLORS.length];
    }
    return COLORS[id % COLORS.length];
  }, [chatteurs]);
  const getChatteurName = useCallback((id) => {
    const c = chatteurs.find(x => x.id === id);
    return c ? c.prenom : '?';
  }, [chatteurs]);

  function openModal(date, creneau, modeleId) {
    const existing = filteredShifts.find(s =>
      s.date === toISO(date) && s.creneau === creneau && s.modele_id === modeleId
    );
    // Template shifts are "virtual" — treat as pre-filled but not existing
    const isReal = existing && !existing.from_template;
    setExistingShift(isReal ? existing : null);
    setSelChatteur(existing?.chatteur_id?.toString() || '');
    setModal({ date: toISO(date), creneau, modele_id: modeleId });
  }

  async function handleAssign() {
    if (!selChatteur) return;
    try {
      if (existingShift) await api.delete(`/api/shifts/${existingShift.id}`);
      await api.post('/api/shifts', {
        chatteur_id: parseInt(selChatteur),
        modele_id: modal.modele_id,
        plateforme_id: activePlatform,
        date: modal.date,
        creneau: modal.creneau
      });
      setModal(null);
      fetchShifts();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur lors de l\'assignation'); }
  }

  async function handleDelete() {
    if (!existingShift) return;
    await api.delete(`/api/shifts/${existingShift.id}`);
    setModal(null);
    fetchShifts();
  }

  async function saveAsTemplate() {
    setSavingTemplate(true); setTemplateMsg('');
    try {
      const { data } = await api.post('/api/shifts/template/save', { date: toISO(weekStart) });
      setHasTemplates(true);
      setTemplateMsg(`Planning récurrent sauvegardé (${data.count} shifts)`);
      setTimeout(() => setTemplateMsg(''), 3000);
    } catch (err) {
      setTemplateMsg('Erreur : ' + (err.response?.data?.error || 'échec'));
      setTimeout(() => setTemplateMsg(''), 3000);
    } finally { setSavingTemplate(false); }
  }

  async function handleBulkDelete() {
    setDeleting(true);
    try {
      const params = `?date_debut=${toISO(weekStart)}&date_fin=${toISO(addDays(weekStart, 6))}`;
      const { data } = await api.delete(`/api/shifts/bulk${params}`);
      toast.success(`${data.count} shift(s) supprimé(s)`);
      setDeleteModal(false);
      setDeleteConfirmText('');
      fetchShifts();
    } catch (err) {
      toast.error('Erreur : ' + (err.response?.data?.error || 'échec'));
    } finally { setDeleting(false); }
  }


  return (
    <div className="page-enter">
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', marginBottom: '0.5rem', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 className="text-navy" style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CalendarPlus size={22} color="#f5b731" /> Planning Shifts</h1>
          {isMobile && (
            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
              <button onClick={saveAsTemplate} disabled={savingTemplate} className="btn-secondary haptic" title={hasTemplates ? 'Mettre à jour récurrence' : 'Définir comme récurrent'} style={{ padding: '0.45rem', lineHeight: 1 }}>
                <Repeat size={15} />
              </button>
              <button className="btn-secondary haptic" title="Exporter CSV" style={{ padding: '0.45rem', lineHeight: 1 }}
                onClick={() => {
                  const d = toISO(weekStart);
                  const f = toISO(addDays(weekStart, 6));
                  window.open(`/api/shifts/export-csv?date_debut=${d}&date_fin=${f}`, '_blank');
                }}>
                <Download size={15} />
              </button>
              <button onClick={() => setDeleteModal(true)} className="btn-secondary haptic" title="Supprimer des shifts" style={{ padding: '0.45rem', lineHeight: 1, color: '#ef4444', borderColor: '#fecaca' }}>
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>
        {templateMsg && (
          <span style={{ fontSize: '0.7rem', color: templateMsg.startsWith('Erreur') ? '#ef4444' : '#10b981', fontWeight: 500, animation: 'fadeIn 0.3s ease', textAlign: 'center' }}>
            {templateMsg}
          </span>
        )}
        {isMobile ? (
          <button onClick={() => setBulkModal(true)} className="btn-primary haptic" style={{ width: '100%', fontSize: '0.85rem', padding: '0.6rem', justifyContent: 'center' }}>
            <CalendarPlus size={16} /> Planifier des shifts
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={saveAsTemplate} disabled={savingTemplate} className="btn-secondary haptic" style={{ whiteSpace: 'nowrap', fontSize: '0.75rem', padding: '0.4rem 0.85rem' }}>
              <Repeat size={14} /> {savingTemplate ? 'Sauvegarde...' : (hasTemplates ? 'Mettre à jour récurrence' : 'Définir comme récurrent')}
            </button>
            <button className="btn-secondary haptic" style={{ whiteSpace: 'nowrap', fontSize: '0.75rem', padding: '0.4rem 0.85rem' }}
              onClick={() => {
                const d = toISO(weekStart);
                const f = toISO(addDays(weekStart, 6));
                window.open(`/api/shifts/export-csv?date_debut=${d}&date_fin=${f}`, '_blank');
              }}>
              <Download size={14} /> CSV
            </button>
            <button onClick={() => setDeleteModal(true)} className="btn-secondary haptic" style={{ whiteSpace: 'nowrap', fontSize: '0.75rem', padding: '0.4rem 0.85rem', color: '#ef4444', borderColor: '#fecaca' }}>
              <Trash2 size={14} /> Supprimer tout
            </button>
            <button onClick={() => setBulkModal(true)} className="btn-primary haptic" style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
              <CalendarPlus size={16} /> Planifier
            </button>
          </div>
        )}
      </div>

      {/* Week navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <NavButton onClick={() => setWeekStart(addDays(weekStart, -7))}>
          <ChevronLeft size={18} />
        </NavButton>
        <span style={{ fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
          Sem. du {weekStart.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}
        </span>
        <NavButton onClick={() => setWeekStart(addDays(weekStart, 7))}>
          <ChevronRight size={18} />
        </NavButton>
      </div>

      {/* Platform tabs */}
      {plateformes.length > 0 && (
        <div style={{ display: 'flex', marginBottom: '0.75rem', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)' }}>
          {plateformes.map((p, i) => {
            const active = activePlatform === p.id;
            return (
              <PlatformTab
                key={p.id}
                active={active}
                last={i === plateformes.length - 1}
                onClick={() => setActivePlatform(p.id)}
                label={p.nom}
                bgColor={p.couleur_fond}
                textColor={p.couleur_texte}
              />
            );
          })}
        </div>
      )}

      {/* Timezone selector + live clock */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)' }}>
          {TIMEZONES.map((tz, i) => (
            <TzButton
              key={tz.key}
              active={selectedTZ === tz.key}
              last={i === TIMEZONES.length - 1}
              onClick={() => setSelectedTZ(tz.key)}
              label={tz.label}
              iso={PAYS_ISO_TZ[tz.key]}
            />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: '#1b2e4b', fontWeight: 600 }}>
          <Clock size={13} style={{ color: '#f5b731', animation: 'pulse-soft 2s ease infinite' }} />
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{currentTime}</span>
        </div>
      </div>

      {/* Conflict alerts */}
      {conflits && (conflits.doublons?.length > 0 || conflits.non_couverts?.length > 0) && (
        <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {conflits.doublons?.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
              padding: '0.75rem 1rem', borderRadius: '10px',
              background: '#fffbeb', border: '1px solid #fde68a',
            }}>
              <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
              <div>
                <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#92400e', marginBottom: '0.25rem' }}>
                  {conflits.doublons.length} doublon{conflits.doublons.length > 1 ? 's' : ''} détecté{conflits.doublons.length > 1 ? 's' : ''}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                  {conflits.doublons.slice(0, 5).map((d, i) => (
                    <span key={i} style={{
                      fontSize: '0.7rem', background: '#fef3c7', color: '#b45309',
                      padding: '0.15rem 0.5rem', borderRadius: '12px',
                    }}>
                      {d.date} Créneau {d.creneau} — {d.modele} ({d.count}x)
                    </span>
                  ))}
                  {conflits.doublons.length > 5 && (
                    <span style={{ fontSize: '0.7rem', color: '#92400e' }}>+{conflits.doublons.length - 5} autres</span>
                  )}
                </div>
              </div>
            </div>
          )}
          {conflits.non_couverts?.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
              padding: '0.75rem 1rem', borderRadius: '10px',
              background: '#fef2f2', border: '1px solid #fecaca',
            }}>
              <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
              <div>
                <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#991b1b', marginBottom: '0.25rem' }}>
                  {conflits.non_couverts.length} créneau{conflits.non_couverts.length > 1 ? 'x' : ''} non couvert{conflits.non_couverts.length > 1 ? 's' : ''} (2 semaines)
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                  {conflits.non_couverts.slice(0, 5).map((d, i) => (
                    <span key={i} style={{
                      fontSize: '0.7rem', background: '#fee2e2', color: '#991b1b',
                      padding: '0.15rem 0.5rem', borderRadius: '12px',
                    }}>
                      {d.date} {d.creneau_label || `Créneau ${d.creneau}`}
                    </span>
                  ))}
                  {conflits.non_couverts.length > 5 && (
                    <span style={{ fontSize: '0.7rem', color: '#991b1b' }}>+{conflits.non_couverts.length - 5} autres</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {fetchError ? (
        <div className="alert alert-error" role="alert" style={{ marginBottom: '1rem' }}>
          {fetchError}
          <button onClick={fetchShifts} className="btn-ghost" style={{ marginLeft: '1rem', fontSize: '0.8rem' }}>Réessayer</button>
        </div>
      ) : loading ? (
        <div className="card" style={{ padding: '1rem' }}><TableSkeleton rows={6} cols={8} /></div>
      ) : (
        <>
          {/* Model cards */}
          <div className="stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredModeles.map(model => {
              const modelShifts = filteredShifts.filter(s => s.modele_id === model.id);
              return (
                <ModelCard
                  key={model.id}
                  model={model}
                  shifts={modelShifts}
                  days={days}
                  tzOffset={tzOffset}
                  getChatteurName={getChatteurName}
                  getChatteurColor={getChatteurColor}
                  onCellClick={(date, creneau) => openModal(date, creneau, model.id)}
                  isMobile={isMobile}
                  todayISO={todayISO}
                />
              );
            })}
          </div>

        </>
      )}

      {/* Bulk creation modal */}
      {bulkModal && (
        <BulkModal
          plateformes={plateformes}
          modeles={modeles}
          chatteurs={chatteurs}
          modelesPlateformes={modelesPlateformes}
          onClose={() => setBulkModal(false)}
          onCreated={() => { setBulkModal(false); fetchShifts(); }}
          isMobile={isMobile}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteModal && (
        <div onClick={() => { setDeleteModal(false); setDeleteConfirmText(''); setDeleteScope('week'); }}
          style={{ ...overlayStyle, alignItems: isMobile ? 'flex-end' : 'center', padding: isMobile ? '0' : '1rem', zIndex: 1000 }}>
          <div className="card" onClick={e => e.stopPropagation()} style={{
            maxWidth: isMobile ? '100%' : '420px', width: '100%',
            animation: isMobile ? 'slideUp 0.3s ease' : 'modalCardIn 0.3s cubic-bezier(.4,0,.2,1)',
            borderRadius: isMobile ? '16px 16px 0 0' : undefined,
            padding: isMobile ? '1.25rem 1rem 2rem' : '1.5rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={20} style={{ color: '#ef4444' }} /> Supprimer des shifts
              </h3>
              <button onClick={() => { setDeleteModal(false); setDeleteConfirmText(''); setDeleteScope('week'); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{
              background: '#fff7ed',
              border: '1px solid #fed7aa',
              borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem',
            }}>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5 }}>
                Vous allez supprimer <strong style={{ color: '#ea580c' }}>tous les shifts de la semaine du {weekStart.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}</strong>. Cette action est irréversible.
              </p>
            </div>

            <button
              onClick={handleBulkDelete}
              disabled={deleting}
              className="haptic"
              style={{
                width: '100%', padding: '0.65rem', borderRadius: '8px', cursor: 'pointer',
                fontWeight: 700, fontSize: '0.85rem', border: 'none',
                background: deleting ? '#e2e8f0' : '#ef4444',
                color: deleting ? '#94a3b8' : 'white',
                transition: 'all 150ms ease',
              }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                <Trash2 size={16} />
                {deleting ? 'Suppression...' : 'Supprimer les shifts de la semaine'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Assignment modal */}
      {modal && (
        <div onClick={() => setModal(null)} style={overlayStyle}>
          <div className="card" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '380px', animation: 'modalCardIn 0.3s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1b2e4b' }}>Assigner un shift</h2>
              <CloseButton onClick={() => setModal(null)} />
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                <span className="badge badge-navy">{plateformes.find(p => p.id === activePlatform)?.nom}</span>
                <span className="badge badge-gold">{modeles.find(m => m.id === modal.modele_id)?.pseudo}</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>{modal.date} · {CRENEAUX.find(c => c.id === modal.creneau)?.label}</p>
            </div>
            <div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label className="label">Chatteur</label>
                <select className="input-field" value={selChatteur} onChange={e => setSelChatteur(e.target.value)} aria-label="Sélectionner le chatteur">
                  <option value="">Choisir...</option>
                  {chatteurs.map(c => <option key={c.id} value={c.id}>{c.prenom}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={handleAssign} className="btn-primary" style={{ flex: 1 }}>Assigner</button>
                {existingShift && <button onClick={handleDelete} className="btn-danger" style={{ flex: 1 }}>Supprimer</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Small interactive components ─── */

function NavButton({ onClick, children }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      className="card"
      style={{
        padding: '0.5rem', lineHeight: 1, cursor: 'pointer',
        transform: pressed ? 'scale(0.9)' : 'scale(1)',
        transition: 'transform 120ms ease, box-shadow 200ms ease',
      }}
    >
      {children}
    </button>
  );
}

function PlatformTab({ active, last, onClick, label, bgColor, textColor }) {
  const [hovered, setHovered] = useState(false);
  const bg = bgColor || '#1b2e4b';
  const txt = textColor || '#ffffff';
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        padding: '0.65rem 0.5rem',
        background: active ? bg : (hovered ? '#f8fafc' : '#ffffff'),
        color: active ? txt : '#64748b',
        border: 'none',
        borderRight: !last ? '1px solid rgba(0,0,0,0.08)' : 'none',
        fontWeight: active ? 700 : 500,
        fontSize: '0.85rem',
        cursor: 'pointer',
        transition: 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
        position: 'relative',
      }}
    >
      {active && (
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: txt, flexShrink: 0,
          animation: 'ripple 0.4s ease',
        }} />
      )}
      {label}
    </button>
  );
}

function TzButton({ active, last, onClick, label, iso }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={label}
      style={{
        padding: '0.4rem 0.65rem',
        background: active ? 'rgba(245,183,49,0.15)' : (hovered ? 'rgba(245,183,49,0.06)' : '#fff'),
        color: active ? '#92400e' : '#64748b',
        border: 'none',
        borderRight: !last ? '1px solid rgba(0,0,0,0.08)' : 'none',
        fontWeight: active ? 600 : 400,
        fontSize: '0.7rem',
        cursor: 'pointer',
        transition: 'all 200ms ease',
        display: 'flex', alignItems: 'center', gap: '0.3rem',
      }}
    >
      {iso && (
        <img
          src={`https://flagcdn.com/w40/${iso}.png`}
          alt={label}
          style={{ width: 18, height: 'auto', borderRadius: 2, verticalAlign: 'middle' }}
        />
      )}
      {label}
    </button>
  );
}

function CloseButton({ onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'rgba(0,0,0,0.05)' : 'none',
        border: 'none', cursor: 'pointer',
        color: hovered ? '#475569' : '#94a3b8',
        borderRadius: '50%', padding: '4px',
        transition: 'all 150ms ease',
        transform: hovered ? 'rotate(90deg)' : 'rotate(0deg)',
      }}
    >
      <X size={20} />
    </button>
  );
}


/* ─── Model Card with compact week grid ─── */
function ModelCard({ model, shifts, days, tzOffset, getChatteurName, getChatteurColor, onCellClick, isMobile, todayISO }) {
  const [hovered, setHovered] = useState(false);
  const count = shifts.length;

  // O(1) shift lookup map: "date|creneau" → shift
  const shiftMap = useMemo(() => {
    const m = new Map();
    for (const s of shifts) m.set(`${s.date}|${s.creneau}`, s);
    return m;
  }, [shifts]);

  const JOURS_FULL_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  return (
    <div
      className="card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '0.75rem',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered ? '0 8px 25px rgba(0,0,0,0.08)' : undefined,
        transition: 'transform 250ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 250ms ease',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        {model.photo ? (
          <img src={model.photo} alt="" style={{
            width: 28, height: 28, borderRadius: '50%', objectFit: 'cover',
            border: `2px solid ${model.couleur_fond || 'rgba(245,183,49,0.3)'}`,
            flexShrink: 0,
            transition: 'transform 300ms ease',
            transform: hovered ? 'scale(1.1)' : 'scale(1)',
          }} />
        ) : (
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: model.couleur_fond || 'rgba(245,183,49,0.12)',
            border: `2px solid ${model.couleur_fond || 'rgba(245,183,49,0.3)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.65rem', fontWeight: 700,
            color: model.couleur_texte || '#ffffff',
            flexShrink: 0,
            transition: 'transform 300ms ease, background 300ms ease',
            transform: hovered ? 'scale(1.1) rotate(5deg)' : 'scale(1)',
          }}>
            {model.pseudo.charAt(0)}
          </div>
        )}
        <span style={{ fontWeight: 600, color: '#1b2e4b', fontSize: '0.85rem' }}>{model.pseudo}</span>
        <span style={{
          marginLeft: 'auto', fontSize: '0.55rem', fontWeight: 600,
          background: count > 0 ? 'rgba(245,183,49,0.12)' : 'rgba(0,0,0,0.04)',
          color: count > 0 ? '#b8860b' : '#94a3b8',
          padding: '0.15rem 0.45rem', borderRadius: '20px',
          transition: 'all 200ms ease',
        }}>
          {count} shift{count !== 1 ? 's' : ''}
        </span>
      </div>

      {isMobile ? (
        /* ─── Mobile: vertical day-by-day layout ─── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {days.map((d, di) => {
            const iso = toISO(d);
            const isToday = iso === todayISO;
            return (
              <div key={di} style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.35rem 0.5rem',
                borderRadius: '8px',
                background: isToday ? 'rgba(245,183,49,0.06)' : 'transparent',
                borderLeft: isToday ? '3px solid #f5b731' : '3px solid transparent',
                transition: 'all 200ms ease',
              }}>
                {/* Day label */}
                <div style={{ minWidth: '42px', flexShrink: 0 }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: isToday ? '#b8860b' : '#1b2e4b' }}>
                    {JOURS_FULL_FR[di]}
                  </div>
                  <div style={{ fontSize: '0.55rem', color: '#94a3b8' }}>
                    {d.getDate()}/{String(d.getMonth() + 1).padStart(2, '0')}
                  </div>
                </div>
                {/* Creneau pills */}
                <div style={{ display: 'flex', gap: '3px', flex: 1, flexWrap: 'wrap' }}>
                  {CRENEAUX.map(cr => {
                    const shift = shiftMap.get(`${iso}|${cr.id}`);
                    const color = shift ? getChatteurColor(shift.chatteur_id) : null;
                    const name = shift ? getChatteurName(shift.chatteur_id) : null;
                    const isTemplate = shift?.from_template;
                    return (
                      <MobileShiftPill
                        key={cr.id}
                        shift={shift}
                        color={color}
                        name={name}
                        isTemplate={isTemplate}
                        creneauShort={getCreneauShort(cr, tzOffset)}
                        onClick={() => onCellClick(d, cr.id)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ─── Desktop: compact week grid ─── */
        <div style={{ display: 'grid', gridTemplateColumns: '38px repeat(7, 1fr)', gap: '2px' }}>
          {/* Day headers */}
          <div />
          {days.map((d, i) => {
            const isToday = toISO(d) === todayISO;
            return (
              <div key={i} style={{
                textAlign: 'center', padding: '2px 0', borderRadius: '4px',
                background: isToday ? 'rgba(245,183,49,0.12)' : 'transparent',
                transition: 'background 200ms ease',
              }}>
                <div style={{ fontSize: '0.5rem', color: isToday ? '#b8860b' : '#94a3b8', fontWeight: isToday ? 700 : 500 }}>{JOURS_SHORT[i]}</div>
                <div style={{ fontSize: '0.65rem', fontWeight: 600, color: isToday ? '#b8860b' : '#1a1f2e' }}>
                  {d.getDate()}
                </div>
              </div>
            );
          })}

          {/* Creneau rows */}
          {CRENEAUX.map(cr => (
            <ShiftRow
              key={cr.id}
              creneau={cr}
              tzOffset={tzOffset}
              days={days}
              shiftMap={shiftMap}
              getChatteurName={getChatteurName}
              getChatteurColor={getChatteurColor}
              onCellClick={onCellClick}
              todayISO={todayISO}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Mobile shift pill ─── */
function MobileShiftPill({ shift, color, name, isTemplate, creneauShort, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={shift ? `${name} — ${creneauShort}${isTemplate ? ' (récurrent)' : ''}` : `${creneauShort} — Assigner`}
      style={{
        flex: '1 1 0',
        minWidth: '52px',
        padding: '0.3rem 0.25rem',
        borderRadius: '8px',
        border: shift
          ? (isTemplate
            ? `1.5px dashed ${hovered ? color.text : color.border}`
            : `1.5px solid ${hovered ? color.text : color.border}`)
          : `1.5px dashed ${hovered ? '#f5b731' : '#e2e8f0'}`,
        background: shift
          ? (hovered ? color.border + '40' : color.bg)
          : (hovered ? 'rgba(245,183,49,0.06)' : '#fafafa'),
        color: shift ? color.text : (hovered ? '#f5b731' : '#cbd5e1'),
        cursor: 'pointer',
        fontSize: '0.55rem',
        fontWeight: 600,
        opacity: isTemplate ? (hovered ? 1 : 0.85) : 1,
        transition: 'all 180ms cubic-bezier(0.4, 0, 0.2, 1)',
        transform: hovered ? 'scale(1.05)' : 'scale(1)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px',
        lineHeight: 1.2,
      }}
    >
      <span style={{ fontSize: '0.45rem', opacity: 0.7 }}>{creneauShort}</span>
      <span>{shift ? name : '+'}</span>
    </button>
  );
}

/* ─── Single creneau row ─── */
function ShiftRow({ creneau, tzOffset, days, shiftMap, getChatteurName, getChatteurColor, onCellClick, todayISO }) {
  return (
    <>
      <div style={{
        fontSize: '0.5rem', color: '#94a3b8', fontWeight: 500,
        display: 'flex', alignItems: 'center', padding: '0 2px', whiteSpace: 'nowrap'
      }}>
        {getCreneauShort(creneau, tzOffset)}
      </div>
      {days.map((d, i) => {
        const iso = toISO(d);
        const shift = shiftMap.get(`${iso}|${creneau.id}`);
        const isToday = iso === todayISO;
        return (
          <ShiftCell
            key={i}
            shift={shift}
            getChatteurColor={getChatteurColor}
            getChatteurName={getChatteurName}
            onClick={() => onCellClick(d, creneau.id)}
            isToday={isToday}
          />
        );
      })}
    </>
  );
}

/* ─── Individual shift cell with hover animation ─── */
function ShiftCell({ shift, getChatteurColor, getChatteurName, onClick, isToday }) {
  const [hovered, setHovered] = useState(false);
  const color = shift ? getChatteurColor(shift.chatteur_id) : null;
  const name = shift ? getChatteurName(shift.chatteur_id) : null;
  const isTemplate = shift?.from_template;

  const emptyBg = isToday
    ? (hovered ? 'rgba(245,183,49,0.1)' : 'rgba(245,183,49,0.04)')
    : (hovered ? 'rgba(245,183,49,0.06)' : '#fafafa');

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={shift ? `${shift.chatteur_prenom}${isTemplate ? ' (récurrent)' : ''}` : 'Cliquer pour assigner'}
      style={{
        minHeight: '30px',
        borderRadius: '5px',
        border: shift
          ? (isTemplate
            ? `1.5px dashed ${hovered ? color.text : color.border}`
            : `1.5px solid ${hovered ? color.text : color.border}`)
          : `1.5px dashed ${hovered ? '#f5b731' : (isToday ? '#f5b73180' : '#e2e8f0')}`,
        background: shift
          ? (hovered ? color.border + '40' : color.bg)
          : emptyBg,
        cursor: 'pointer',
        padding: '2px 1px',
        fontSize: '0.55rem',
        fontWeight: 600,
        color: shift ? color.text : (hovered ? '#f5b731' : (isToday ? '#d4a017' : '#d1d5db')),
        opacity: isTemplate ? (hovered ? 1 : 0.85) : 1,
        transition: 'all 180ms cubic-bezier(0.4, 0, 0.2, 1)',
        textAlign: 'center',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        lineHeight: 1.1,
        transform: hovered ? 'scale(1.08)' : 'scale(1)',
        boxShadow: hovered
          ? (shift ? `0 3px 10px ${color.border}60` : '0 3px 10px rgba(245,183,49,0.15)')
          : 'none',
        zIndex: hovered ? 2 : 1,
        position: 'relative',
      }}
    >
      {shift ? name : (
        <span style={{
          fontSize: '0.7rem',
          transition: 'transform 200ms ease',
          transform: hovered ? 'scale(1.3)' : 'scale(1)',
        }}>+</span>
      )}
    </button>
  );
}

/* ─── Bulk Shift Creation Modal ─── */
const SCHEDULE_TYPES = [
  { key: 'single', label: 'Date unique' },
  { key: 'range', label: 'Plage de dates' },
  { key: 'interval', label: 'Tous les N jours' },
];

const JOURS_FULL = [
  { key: 1, label: 'L', full: 'Lundi' },
  { key: 2, label: 'M', full: 'Mardi' },
  { key: 3, label: 'Me', full: 'Mercredi' },
  { key: 4, label: 'J', full: 'Jeudi' },
  { key: 5, label: 'V', full: 'Vendredi' },
  { key: 6, label: 'S', full: 'Samedi' },
  { key: 0, label: 'D', full: 'Dimanche' },
];

function generateDates(type, config) {
  const dates = [];
  if (type === 'single') {
    if (config.date) dates.push(config.date);
  } else if (type === 'range') {
    if (!config.start || !config.end) return dates;
    const cur = new Date(config.start + 'T00:00:00');
    const end = new Date(config.end + 'T00:00:00');
    while (cur <= end) {
      if (config.days.length === 0 || config.days.includes(cur.getDay())) {
        dates.push(toISO(cur));
      }
      cur.setDate(cur.getDate() + 1);
    }
  } else if (type === 'interval') {
    if (!config.start || !config.end || !config.every) return dates;
    const cur = new Date(config.start + 'T00:00:00');
    const end = new Date(config.end + 'T00:00:00');
    while (cur <= end) {
      dates.push(toISO(cur));
      cur.setDate(cur.getDate() + config.every);
    }
  }
  return dates;
}

/* ─── Toggle pill button (day of week, creneau) ─── */
function TogglePill({ active, onClick, children, style: extraStyle = {}, round }) {
  const [hovered, setHovered] = useState(false);
  const base = round ? {
    width: 32, height: 32, borderRadius: '50%',
    border: `2px solid ${active ? '#1b2e4b' : (hovered ? '#94a3b8' : '#e2e8f0')}`,
    background: active ? '#1b2e4b' : (hovered ? '#f8fafc' : '#fff'),
    color: active ? '#f5b731' : '#94a3b8',
    fontWeight: 700, fontSize: '0.65rem',
  } : {
    padding: '0.4rem 0.75rem', borderRadius: '20px',
    border: `2px solid ${active ? '#f5b731' : (hovered ? '#fcd34d' : '#e2e8f0')}`,
    background: active ? 'rgba(245,183,49,0.12)' : (hovered ? 'rgba(245,183,49,0.04)' : '#fff'),
    color: active ? '#92400e' : '#94a3b8',
    fontWeight: active ? 700 : 500, fontSize: '0.75rem',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...base,
        cursor: 'pointer',
        transition: 'all 180ms cubic-bezier(0.4, 0, 0.2, 1)',
        transform: hovered ? 'scale(1.08)' : 'scale(1)',
        ...extraStyle,
      }}
    >
      {children}
    </button>
  );
}

function BulkModal({ plateformes, modeles, chatteurs, modelesPlateformes, onClose, onCreated, isMobile }) {
  const [pfId, setPfId] = useState('');
  const [modeleId, setModeleId] = useState('');
  const [chatteurId, setChatteurId] = useState('');
  const [schedType, setSchedType] = useState('single');
  const [singleDate, setSingleDate] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [rangeDays, setRangeDays] = useState([1, 2, 3, 4, 5]);
  const [intervalStart, setIntervalStart] = useState('');
  const [intervalEnd, setIntervalEnd] = useState('');
  const [intervalEvery, setIntervalEvery] = useState(2);
  const [selCreneaux, setSelCreneaux] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const filteredModels = useMemo(() => {
    if (!pfId) return [];
    const ids = modelesPlateformes.filter(mp => mp.plateforme_id === Number(pfId)).map(mp => mp.modele_id);
    return modeles.filter(m => ids.includes(m.id));
  }, [pfId, modelesPlateformes, modeles]);

  const previewDates = useMemo(() => {
    if (schedType === 'single') return generateDates('single', { date: singleDate });
    if (schedType === 'range') return generateDates('range', { start: rangeStart, end: rangeEnd, days: rangeDays });
    if (schedType === 'interval') return generateDates('interval', { start: intervalStart, end: intervalEnd, every: intervalEvery });
    return [];
  }, [schedType, singleDate, rangeStart, rangeEnd, rangeDays, intervalStart, intervalEnd, intervalEvery]);

  const totalShifts = previewDates.length * selCreneaux.length;
  const canSubmit = pfId && modeleId && chatteurId && selCreneaux.length > 0 && previewDates.length > 0;

  function toggleDay(d) {
    setRangeDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  }
  function toggleCreneau(id) {
    setSelCreneaux(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { data } = await api.post('/api/shifts/bulk', {
        chatteur_id: Number(chatteurId),
        modele_id: Number(modeleId),
        plateforme_id: Number(pfId),
        dates: previewDates,
        creneaux: selCreneaux,
        replace: true,
      });
      setResult(data);
    } catch (err) {
      setResult({ error: err.response?.data?.error || 'Erreur' });
    } finally { setSubmitting(false); }
  }

  const sectionStyle = { marginBottom: '0.85rem' };
  const sectionTitleStyle = { fontSize: '0.7rem', fontWeight: 700, color: '#1b2e4b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' };

  return (
    <div onClick={onClose} style={{
      ...overlayStyle,
      alignItems: isMobile ? 'flex-end' : 'center',
      padding: isMobile ? '0' : '1rem',
    }}>
      <div
        className="card"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: isMobile ? '100%' : '480px',
          maxHeight: isMobile ? '92vh' : '90vh',
          overflowY: 'auto',
          animation: isMobile ? 'slideUp 0.3s ease' : 'modalCardIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          borderRadius: isMobile ? '16px 16px 0 0' : undefined,
          padding: isMobile ? '1.25rem 1rem 2rem' : undefined,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1b2e4b' }}>Planifier des shifts</h2>
          <CloseButton onClick={onClose} />
        </div>

        {result ? (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            {result.error ? (
              <p style={{ color: '#ef4444', fontWeight: 600 }}>{result.error}</p>
            ) : (
              <>
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#1b2e4b', animation: 'ripple 0.5s ease' }}>{result.created}</div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b' }}>shift{result.created !== 1 ? 's' : ''} créé{result.created !== 1 ? 's' : ''}</div>
                  {result.replaced > 0 && (
                    <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.5rem' }}>
                      dont {result.replaced} remplacé{result.replaced !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </>
            )}
            <button onClick={onCreated} className="btn-primary" style={{ width: '100%', marginTop: '1rem' }}>Fermer</button>
          </div>
        ) : (
          <>
            {/* Step 1: Context */}
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>1. Contexte</div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label className="label" style={{ fontSize: '0.7rem' }}>Plateforme</label>
                  <select className="input-field" value={pfId} onChange={e => { setPfId(e.target.value); setModeleId(''); }} style={{ fontSize: '0.8rem' }} aria-label="Sélectionner la plateforme">
                    <option value="">...</option>
                    {plateformes.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" style={{ fontSize: '0.7rem' }}>Modèle</label>
                  <select className="input-field" value={modeleId} onChange={e => setModeleId(e.target.value)} style={{ fontSize: '0.8rem' }} aria-label="Sélectionner le modèle">
                    <option value="">...</option>
                    {filteredModels.map(m => <option key={m.id} value={m.id}>{m.pseudo}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" style={{ fontSize: '0.7rem' }}>Chatteur</label>
                  <select className="input-field" value={chatteurId} onChange={e => setChatteurId(e.target.value)} style={{ fontSize: '0.8rem' }} aria-label="Sélectionner le chatteur">
                    <option value="">...</option>
                    {chatteurs.map(c => <option key={c.id} value={c.id}>{c.prenom}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Step 2: Schedule type */}
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>2. Dates</div>
              <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)', marginBottom: '0.5rem' }}>
                {SCHEDULE_TYPES.map((st, i) => (
                  <SchedTab
                    key={st.key}
                    active={schedType === st.key}
                    last={i === SCHEDULE_TYPES.length - 1}
                    onClick={() => setSchedType(st.key)}
                    label={st.label}
                  />
                ))}
              </div>

              {schedType === 'single' && (
                <input type="date" className="input-field" value={singleDate} onChange={e => setSingleDate(e.target.value)} style={{ fontSize: '0.8rem' }} />
              )}
              {schedType === 'range' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <div>
                      <label className="label" style={{ fontSize: '0.65rem' }}>Début</label>
                      <input type="date" className="input-field" value={rangeStart} onChange={e => setRangeStart(e.target.value)} style={{ fontSize: '0.8rem' }} />
                    </div>
                    <div>
                      <label className="label" style={{ fontSize: '0.65rem' }}>Fin</label>
                      <input type="date" className="input-field" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} style={{ fontSize: '0.8rem' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                    {JOURS_FULL.map(j => (
                      <TogglePill key={j.key} active={rangeDays.includes(j.key)} onClick={() => toggleDay(j.key)} round>
                        {j.label}
                      </TogglePill>
                    ))}
                  </div>
                </>
              )}
              {schedType === 'interval' && (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label className="label" style={{ fontSize: '0.65rem' }}>Début</label>
                    <input type="date" className="input-field" value={intervalStart} onChange={e => setIntervalStart(e.target.value)} style={{ fontSize: '0.8rem' }} />
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: '0.65rem' }}>Fin</label>
                    <input type="date" className="input-field" value={intervalEnd} onChange={e => setIntervalEnd(e.target.value)} style={{ fontSize: '0.8rem' }} />
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: '0.65rem' }}>Tous les</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <input type="number" min="1" max="30" className="input-field" value={intervalEvery}
                        onChange={e => setIntervalEvery(Math.max(1, parseInt(e.target.value) || 1))}
                        style={{ fontSize: '0.8rem', width: '50px' }} />
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>jours</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Creneaux */}
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>3. Créneaux</div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {CRENEAUX.map(cr => (
                  <TogglePill key={cr.id} active={selCreneaux.includes(cr.id)} onClick={() => toggleCreneau(cr.id)}>
                    {cr.label}
                  </TogglePill>
                ))}
              </div>
            </div>

            {/* Step 4: Preview */}
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>4. Aperçu</div>
              {previewDates.length > 0 ? (
                <>
                  <div style={{
                    maxHeight: '120px', overflowY: 'auto', padding: '0.5rem',
                    background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0',
                    fontSize: '0.7rem', color: '#475569',
                  }}>
                    {previewDates.slice(0, 50).map((d, i) => (
                      <div key={i} style={{ padding: '1px 0', animation: `fadeIn ${0.15 + i * 0.02}s ease` }}>
                        {new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}
                        {selCreneaux.length > 0 && (
                          <span style={{ color: '#94a3b8', marginLeft: '0.3rem' }}>
                            · {selCreneaux.map(c => CRENEAUX.find(cr => cr.id === c)?.short).join(', ')}
                          </span>
                        )}
                      </div>
                    ))}
                    {previewDates.length > 50 && (
                      <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>...et {previewDates.length - 50} autres</div>
                    )}
                  </div>
                  <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', fontWeight: 600, color: '#1b2e4b' }}>
                    Total : {totalShifts} shift{totalShifts !== 1 ? 's' : ''} ({previewDates.length} date{previewDates.length !== 1 ? 's' : ''} × {selCreneaux.length} créneau{selCreneaux.length !== 1 ? 'x' : ''})
                  </div>
                </>
              ) : (
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
                  Configurez les dates et créneaux pour voir l'aperçu
                </div>
              )}
            </div>

            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="btn-primary"
              style={{
                width: '100%', opacity: (!canSubmit || submitting) ? 0.5 : 1,
                cursor: (!canSubmit || submitting) ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Création en cours...' : `Créer / remplacer ${totalShifts} shift${totalShifts !== 1 ? 's' : ''}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SchedTab({ active, last, onClick, label }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1, padding: '0.4rem 0.25rem', border: 'none',
        borderRight: !last ? '1px solid rgba(0,0,0,0.08)' : 'none',
        background: active ? '#1b2e4b' : (hovered ? '#f1f5f9' : '#fff'),
        color: active ? '#f5b731' : '#64748b',
        fontWeight: active ? 700 : 500,
        fontSize: '0.7rem', cursor: 'pointer',
        transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {label}
    </button>
  );
}
