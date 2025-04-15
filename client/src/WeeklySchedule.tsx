import React from "react";

// Types pour les props
export type Shift = {
  id: number;
  pseudo: string;
  platform: string; // "OF" ou "Reveal"
  model: string;
  startTime: string; // ISO string
  plannedEndTime: string; // ISO string
};

export type WeeklyScheduleProps = {
  shifts: Shift[];
};

function getDuration(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = endDate.getTime() - startDate.getTime();
  const hours = Math.floor(diffMs / 1000 / 60 / 60);
  const minutes = Math.floor((diffMs / 1000 / 60) % 60);
  return `${hours}h${minutes.toString().padStart(2, "0")}`;
}

function getElapsed(start: string) {
  const now = new Date();
  const startDate = new Date(start);
  const diffMs = now.getTime() - startDate.getTime();
  if (diffMs < 0) return "à venir";
  const hours = Math.floor(diffMs / 1000 / 60 / 60);
  const minutes = Math.floor((diffMs / 1000 / 60) % 60);
  return `${hours}h${minutes.toString().padStart(2, "0")}`;
}

function getTimeLeft(end: string) {
  const now = new Date();
  const endDate = new Date(end);
  const diffMs = endDate.getTime() - now.getTime();
  if (diffMs < 0) return "Terminé";
  const hours = Math.floor(diffMs / 1000 / 60 / 60);
  const minutes = Math.floor((diffMs / 1000 / 60) % 60);
  return `${hours}h${minutes.toString().padStart(2, "0")}`;
}

const platformColors: Record<string, string> = {
  OF: "bg-pink-200 text-pink-800",
  Reveal: "bg-blue-200 text-blue-800",
};

const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

const WeeklySchedule: React.FC<WeeklyScheduleProps> = ({ shifts }) => {
  // Regroupe les shifts par jour de la semaine
  const shiftsByDay: Record<number, Shift[]> = {};
  shifts.forEach((shift) => {
    const day = new Date(shift.startTime).getDay();
    if (!shiftsByDay[day]) shiftsByDay[day] = [];
    shiftsByDay[day].push(shift);
  });

  return (
    <div className="p-6 bg-gray-50 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Planning hebdomadaire</h2>
      <div className="grid grid-cols-7 gap-4">
        {days.map((day, idx) => (
          <div key={day} className="flex flex-col">
            <div className="text-center font-semibold mb-2 text-gray-600">{day}</div>
            {shiftsByDay[idx]?.length ? (
              shiftsByDay[idx].map((shift) => (
                <div
                  key={shift.id}
                  className="mb-4 p-4 rounded-lg shadow bg-white border-l-4 border-blue-400 flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg text-gray-700">{shift.pseudo}</span>
                    <span className={`ml-2 px-2 py-1 rounded text-xs font-semibold ${platformColors[shift.platform] || "bg-gray-200 text-gray-700"}`}>
                      {shift.platform}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    Modèle : <span className="font-medium text-gray-700">{shift.model}</span>
                  </div>
                  <div className="flex justify-between text-xs mt-2">
                    <span className="text-green-700">
                      En ligne depuis : <b>{getElapsed(shift.startTime)}</b>
                    </span>
                    <span className="text-blue-700">
                      Temps restant : <b>{getTimeLeft(shift.plannedEndTime)}</b>
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    Durée prévue : {getDuration(shift.startTime, shift.plannedEndTime)}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-300 italic">-</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WeeklySchedule; 