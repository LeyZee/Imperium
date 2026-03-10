import { useState, useEffect, useRef, useMemo } from 'react';
import api from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ChevronLeft, ChevronRight, Clock, Users, Eye } from 'lucide-react';
import { CHATTEUR_COLORS } from '../../constants/colors.js';

const CRENEAUX = [
  { id: 1, label: '08h-14h', short: '08-14', startH: 8, endH: 14 },
  { id: 2, label: '14h-20h', short: '14-20', startH: 14, endH: 20 },
  { id: 3, label: '20h-02h', short: '20-02', startH: 20, endH: 26 },
  { id: 4, label: '02h-08h', short: '02-08', startH: 2, endH: 8 },
];

const JOURS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const TIMEZONES = [
  { key: 'France', label: 'France', tz: 'Europe/Paris', offset: 0 },
  { key: 'Benin', label: 'Bénin', tz: 'Africa/Porto-Novo', offset: 0 },
  { key: 'Madagascar', label: 'Madagascar', tz: 'Indian/Antananarivo', offset: 2 },
];

const PAYS_ISO_TZ = { 'France': 'fr', 'Benin': 'bj', 'Madagascar': 'mg' };
const PAYS_TO_TZ_KEY = { 'France': 'France', 'Benin': 'Benin', 'Madagascar': 'Madagascar' };

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

export default function PlanningGeneral() {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [shifts, setShifts] = useState([]);
  const [modeles, setModeles] = useState([]);
  const [plateformes, setPlateformes] = useState([]);
  const [modelesPlateformes, setModelesPlateformes] = useState([]);
  const [activePlatform, setActivePlatform] = useState(null);
  const [selectedTZ, setSelectedTZ] = useState('France');
  const [currentTime, setCurrentTime] = useState('');
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  // Auto-select timezone based on chatteur's country
  useEffect(() => {
    if (!user?.chatteur_id) return;
    api.get(`/api/chatteurs/${user.chatteur_id}`).then(({ data }) => {
      const pays = data.pays || 'France';
      const tzKey = PAYS_TO_TZ_KEY[pays];
      if (tzKey) setSelectedTZ(tzKey);
    }).catch(() => {});
  }, [user]);

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

  // Fetch models once
  useEffect(() => {
    api.get('/api/modeles').then(({ data }) => {
      setModeles(data);
    }).catch(() => {});
  }, []);

  // Fetch shifts for the week (general=true to get all chatteurs' shifts)
  useEffect(() => {
    setLoading(true);
    api.get(`/api/shifts/semaine?date=${toISO(weekStart)}&general=true`).then(({ data }) => {
      setShifts(data.shifts || []);
      if (data.plateformes?.length) {
        setPlateformes(data.plateformes);
        setActivePlatform(prev => prev || data.plateformes[0].id);
      }
      if (data.modeles_plateformes) {
        setModelesPlateformes(data.modeles_plateformes);
      }
    }).finally(() => setLoading(false));
  }, [weekStart]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const todayISO = useMemo(() => toISO(new Date()), []);

  // Filter shifts by active platform
  const filteredShifts = useMemo(() => shifts.filter(s => s.plateforme_id === activePlatform), [shifts, activePlatform]);

  // Filter models by active platform
  const filteredModeles = useMemo(() => {
    const platformModelIds = modelesPlateformes
      .filter(mp => mp.plateforme_id === activePlatform)
      .map(mp => mp.modele_id);
    return modeles.filter(m => platformModelIds.includes(m.id));
  }, [modeles, modelesPlateformes, activePlatform]);

  const tzOffset = TIMEZONES.find(t => t.key === selectedTZ)?.offset || 0;

  // Count unique chatteurs this week
  const uniqueChatteurs = useMemo(() => new Set(shifts.map(s => s.chatteur_id)).size, [shifts]);

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <div>
          <h1 className="text-navy" style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Planning Général</h1>
          <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
            <Users size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '0.3rem' }} />
            {uniqueChatteurs} chatteur{uniqueChatteurs !== 1 ? 's' : ''} actif{uniqueChatteurs !== 1 ? 's' : ''} cette semaine
          </p>
        </div>
        {/* Read-only badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.3rem',
          padding: '0.3rem 0.6rem', borderRadius: '20px',
          background: 'rgba(99,102,241,0.08)', color: '#6366f1',
          fontSize: '0.7rem', fontWeight: 600,
        }}>
          <Eye size={12} />
          Consultation
        </div>
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
            const bg = p.couleur_fond || '#1b2e4b';
            const txt = p.couleur_texte || '#ffffff';
            return (
              <PlatformTab
                key={p.id}
                active={active}
                last={i === plateformes.length - 1}
                onClick={() => setActivePlatform(p.id)}
                label={p.nom}
                bgColor={bg}
                textColor={txt}
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
          <Clock size={13} style={{ color: '#f5b731' }} />
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{currentTime}</span>
        </div>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem',
        fontSize: '0.68rem', color: '#64748b',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <div style={{
            width: 14, height: 14, borderRadius: '3px', border: '2px solid #f5b731',
            background: 'rgba(245,183,49,0.15)', boxShadow: '0 0 0 1px #f5b731',
          }} />
          Mes shifts
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <div style={{
            width: 14, height: 14, borderRadius: '3px', border: '1.5px dashed #94a3b8',
            background: '#f1f5f9',
          }} />
          Récurrent (non confirmé)
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem 0' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }} />
          Chargement...
        </div>
      ) : (
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
                currentUserId={user?.chatteur_id}
                todayISO={todayISO}
              />
            );
          })}
          {filteredModeles.length === 0 && (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem 0', fontSize: '0.85rem' }}>
              Aucun modèle sur cette plateforme
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Small reusable components ─── */

function NavButton({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="card"
      style={{
        padding: '0.5rem', lineHeight: 1, cursor: 'pointer',
        transition: 'transform 120ms ease, box-shadow 200ms ease',
      }}
    >
      {children}
    </button>
  );
}

function PlatformTab({ active, last, onClick, label, bgColor, textColor }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        padding: '0.65rem 0.5rem',
        background: active ? bgColor : (hovered ? '#f8fafc' : '#ffffff'),
        color: active ? textColor : '#64748b',
        border: 'none',
        borderRight: !last ? '1px solid rgba(0,0,0,0.08)' : 'none',
        fontWeight: active ? 700 : 500,
        fontSize: '0.85rem',
        cursor: 'pointer',
        transition: 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
      }}
    >
      {active && (
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: textColor, flexShrink: 0 }} />
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

/* ─── Model Card with compact week grid (read-only) ─── */
function ModelCard({ model, shifts, days, tzOffset, currentUserId, todayISO }) {
  const [hovered, setHovered] = useState(false);
  const count = shifts.length;

  // Pre-index shifts into a lookup map for O(1) access instead of O(n) .find()
  const shiftMap = useMemo(() => {
    const map = {};
    for (const s of shifts) {
      map[`${s.date}-${s.creneau}`] = s;
    }
    return map;
  }, [shifts]);

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
            border: '2px solid rgba(245,183,49,0.3)', flexShrink: 0,
          }} />
        ) : (
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(245,183,49,0.12)', border: '2px solid rgba(245,183,49,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.65rem', fontWeight: 700, color: '#1b2e4b', flexShrink: 0,
          }}>
            {model.pseudo?.charAt(0) || '?'}
          </div>
        )}
        <span style={{ fontWeight: 600, color: '#1b2e4b', fontSize: '0.85rem' }}>{model.pseudo}</span>
        <span style={{
          marginLeft: 'auto', fontSize: '0.55rem', fontWeight: 600,
          background: count > 0 ? 'rgba(245,183,49,0.12)' : 'rgba(0,0,0,0.04)',
          color: count > 0 ? '#b8860b' : '#94a3b8',
          padding: '0.15rem 0.45rem', borderRadius: '20px',
        }}>
          {count} shift{count !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Compact week grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '38px repeat(7, 1fr)', gap: '2px' }}>
        {/* Day headers */}
        <div />
        {days.map((d, i) => {
          const isToday = toISO(d) === todayISO;
          return (
            <div key={i} style={{
              textAlign: 'center', padding: '2px 0', borderRadius: '4px',
              background: isToday ? 'rgba(245,183,49,0.1)' : 'transparent',
            }}>
              <div style={{ fontSize: '0.5rem', color: '#94a3b8', fontWeight: 500 }}>{JOURS_SHORT[i]}</div>
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
            currentUserId={currentUserId}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Single creneau row ─── */
function ShiftRow({ creneau, tzOffset, days, shiftMap, currentUserId }) {
  return (
    <>
      <div style={{
        fontSize: '0.5rem', color: '#94a3b8', fontWeight: 500,
        display: 'flex', alignItems: 'center', padding: '0 2px', whiteSpace: 'nowrap',
      }}>
        {getCreneauShort(creneau, tzOffset)}
      </div>
      {days.map((d, i) => {
        const shift = shiftMap[`${toISO(d)}-${creneau.id}`];
        return (
          <ShiftCell
            key={i}
            shift={shift}
            currentUserId={currentUserId}
          />
        );
      })}
    </>
  );
}

/* ─── Individual shift cell (read-only, no click) ─── */
function ShiftCell({ shift, currentUserId }) {
  const [hovered, setHovered] = useState(false);
  const isMe = shift && shift.chatteur_id === currentUserId;
  const isTemplate = shift?.from_template;

  const color = shift
    ? (shift.chatteur_couleur !== undefined && shift.chatteur_couleur !== null
        ? CHATTEUR_COLORS[shift.chatteur_couleur % CHATTEUR_COLORS.length]
        : CHATTEUR_COLORS[0])
    : null;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={shift ? `${shift.chatteur_prenom}${isTemplate ? ' (récurrent)' : ''}` : ''}
      style={{
        minHeight: '30px',
        borderRadius: '5px',
        border: shift
          ? (isMe
            ? '2px solid #f5b731'
            : (isTemplate
              ? `1.5px dashed ${color.border}`
              : `1.5px solid ${hovered ? color.text : color.border}`))
          : '1.5px solid #f1f5f9',
        background: shift
          ? (hovered ? color.border + '30' : color.bg)
          : '#fafafa',
        padding: '2px 1px',
        fontSize: '0.55rem',
        fontWeight: 600,
        color: shift ? color.text : 'transparent',
        opacity: isTemplate ? 0.6 : 1,
        textAlign: 'center',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        lineHeight: 1.1,
        transition: 'all 180ms cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: isMe ? '0 0 0 1px #f5b731' : (hovered && shift ? `0 2px 8px ${color.border}40` : 'none'),
        transform: hovered && shift ? 'scale(1.05)' : 'scale(1)',
        cursor: shift ? 'default' : 'default',
      }}
    >
      {shift ? shift.chatteur_prenom : ''}
    </div>
  );
}
