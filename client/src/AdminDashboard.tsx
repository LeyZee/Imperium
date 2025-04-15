import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";

type DashboardData = {
  totalEarnings: number;
  activeShifts: { pseudo: string; startTime: string }[];
  absentUsers: { pseudo: string; email: string }[];
  topChatteurs: { pseudo: string; total: number }[];
  recentShifts: { pseudo: string; startTime: string; amount: number }[];
  top3Last7Days?: { pseudo: string; total: number }[];
};

const medalEmojis = ["🥇", "🥈", "🥉"];

const AdminDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const { user, isLoaded } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoaded && user) {
      const role = user.publicMetadata?.role;
      if (role !== "admin") navigate("/login");
    }
  }, [user, isLoaded, navigate]);

  useEffect(() => {
    fetch("/admin/dashboard")
      .then(res => res.json())
      .then(setData);
  }, []);

  if (!data) return <div>Chargement...</div>;

  return (
    <div className="min-h-screen bg-imperium-navy text-imperium-marble">
      <header className="w-full bg-imperium-navy text-imperium-gold p-6 text-4xl font-extrabold tracking-widest shadow text-center mb-8">
        Imperium - Admin
      </header>
      <div className="p-8 space-y-8 max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-imperium-marble text-imperium-navy p-4 rounded shadow text-center border-2 border-imperium-gold">
            <div className="text-2xl font-bold">{data.totalEarnings.toFixed(2)} €</div>
            <div className="text-imperium-gold font-semibold">Gains totaux</div>
          </div>
          <div className="bg-imperium-marble text-imperium-navy p-4 rounded shadow text-center border-2 border-imperium-gold">
            <div className="text-2xl font-bold">{data.activeShifts.length}</div>
            <div className="text-imperium-gold font-semibold">Shifts en cours</div>
          </div>
          <div className="bg-imperium-marble text-imperium-navy p-4 rounded shadow text-center border-2 border-imperium-gold">
            <div className="text-2xl font-bold">{data.absentUsers.length}</div>
            <div className="text-imperium-gold font-semibold">Absences</div>
          </div>
          <div className="bg-imperium-marble text-imperium-navy p-4 rounded shadow text-center border-2 border-imperium-gold">
            <div className="text-2xl font-bold">Top 3</div>
            <ul>
              {data.topChatteurs.map((c, i) => (
                <li key={i}>{c.pseudo} : {c.total.toFixed(2)} €</li>
              ))}
            </ul>
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold mb-2 text-imperium-gold">Shifts récents</h2>
          <ul>
            {data.recentShifts.map((s, i) => (
              <li key={i}>{s.pseudo} - {new Date(s.startTime).toLocaleString()} - {s.amount} €</li>
            ))}
          </ul>
        </div>
        {data.top3Last7Days && (
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-2 text-imperium-gold">Top 3 des 7 derniers jours</h2>
            <ul className="flex flex-col gap-2">
              {data.top3Last7Days.map((c, i) => (
                <li key={i} className="flex items-center gap-2 text-lg">
                  <span>{medalEmojis[i] || ""}</span>
                  <span className="font-semibold">{c.pseudo}</span>
                  <span className="ml-2 text-imperium-gold">{c.total.toFixed(2)} €</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard; 