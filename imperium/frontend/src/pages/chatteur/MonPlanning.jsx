import { useState, useEffect } from 'react';
import api from '../../api/index';
import { useAuth } from '../../context/AuthContext';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const CRENEAUX = ['', '08h – 14h', '14h – 20h', '20h – 02h', '02h – 08h'];
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff); d.setHours(0,0,0,0);
  return d;
}
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function toISO(date) { return date.toISOString().split('T')[0]; }

export default function MonPlanning() {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [shifts, setShifts] = useState([]);

  useEffect(() => {
    api.get(`/api/shifts/semaine?date=${toISO(weekStart)}`).then(({ data }) => {
      setShifts(data.filter(s => s.chatteur_id === user?.chatteur_id));
    });
  }, [weekStart, user]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const myShifts = shifts.filter(s => s.chatteur_id === user?.chatteur_id);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-or">Mon Planning</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="p-2 card hover:border-or/50"><ChevronLeft size={18} /></button>
          <span className="text-sm">Semaine du {weekStart.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}</span>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="p-2 card hover:border-or/50"><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="grid gap-3">
        {days.map((day, i) => {
          const dayShifts = myShifts.filter(s => s.date === toISO(day));
          return (
            <div key={i} className={`card ${dayShifts.length > 0 ? 'border border-or/40' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium">{JOURS[i]} {day.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                {dayShifts.length === 0 && <span className="text-gray-500 text-sm">Repos</span>}
              </div>
              {dayShifts.length > 0 && (
                <div className="mt-2 space-y-1">
                  {dayShifts.map(s => (
                    <div key={s.id} className="flex items-center gap-3 text-sm">
                      <span className="bg-or/20 text-or px-2 py-1 rounded text-xs font-medium">{CRENEAUX[s.creneau]}</span>
                      {s.modele_prenom && <span className="text-gray-400">· {s.modele_prenom} {s.modele_nom}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
