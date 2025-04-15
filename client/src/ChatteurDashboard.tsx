import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";

type DashboardData = {
  totalGenerated: number;
  commission: number;
  nextPaymentDate: string;
  recentShifts: { startTime: string; amount: number; platform: string }[];
};

const ChatteurDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const { user, isLoaded } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoaded && user) {
      const role = user.publicMetadata?.role;
      if (role !== "chatteur") navigate("/login");
    }
  }, [user, isLoaded, navigate]);

  useEffect(() => {
    fetch("/chatteur/dashboard")
      .then(res => res.json())
      .then(setData);
  }, []);

  if (!data) return <div>Chargement...</div>;

  const timeLeft = () => {
    const now = new Date();
    const next = new Date(data.nextPaymentDate);
    const diff = next.getTime() - now.getTime();
    if (diff < 0) return "Paiement imminent !";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    return `${days}j ${hours}h`;
  };

  return (
    <div className="min-h-screen bg-imperium-navy text-imperium-marble">
      <header className="w-full bg-imperium-navy text-imperium-gold p-6 text-4xl font-extrabold tracking-widest shadow text-center mb-8">
        Imperium - Chatteur
      </header>
      <div className="p-8 space-y-8 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-imperium-marble text-imperium-navy p-4 rounded shadow text-center border-2 border-imperium-gold">
            <div className="text-2xl font-bold">{data.totalGenerated.toFixed(2)} €</div>
            <div className="text-imperium-gold font-semibold">Total généré</div>
          </div>
          <div className="bg-imperium-marble text-imperium-navy p-4 rounded shadow text-center border-2 border-imperium-gold">
            <div className="text-2xl font-bold">{(data.commission * 100).toFixed(0)} %</div>
            <div className="text-imperium-gold font-semibold">Commission</div>
          </div>
          <div className="bg-imperium-marble text-imperium-navy p-4 rounded shadow text-center border-2 border-imperium-gold">
            <div className="text-2xl font-bold">{timeLeft()}</div>
            <div className="text-imperium-gold font-semibold">Jusqu'au prochain paiement</div>
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold mb-2 text-imperium-gold">Shifts récents</h2>
          <ul>
            {data.recentShifts.map((s, i) => (
              <li key={i}>{new Date(s.startTime).toLocaleString()} - {s.amount} € - {s.platform}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ChatteurDashboard; 