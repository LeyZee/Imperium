import React from "react";
import { useNavigate } from "react-router-dom";

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-imperium-navy flex flex-col items-center justify-center font-sans">
      <header className="w-full bg-imperium-navy text-imperium-gold p-6 text-5xl font-extrabold tracking-widest shadow text-center mb-8 rounded-b-3xl">
        Imperium
      </header>
      <main className="flex flex-col items-center gap-10 w-full px-4">
        <h1 className="text-4xl md:text-5xl font-bold text-imperium-gold mb-2 text-center drop-shadow-lg">
          Gérez vos shifts et vos paiements <span className="text-imperium-marble">en toute simplicité</span>
        </h1>
        <p className="text-imperium-marble text-lg md:text-2xl max-w-2xl text-center mb-6 opacity-80">
          Imperium est la plateforme moderne pour les agences et chatteurs : suivi des shifts, paiements automatisés, statistiques en temps réel, et bien plus.
        </p>
        <div className="flex flex-col md:flex-row gap-6 w-full max-w-md justify-center">
          <button
            className="bg-imperium-gold text-imperium-navy font-bold px-8 py-3 rounded-full shadow-sm border border-imperium-gold text-xl hover:bg-imperium-marble hover:text-imperium-gold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-imperium-gold"
            onClick={() => navigate('/login')}
          >
            Connexion
          </button>
          <button
            className="bg-imperium-marble text-imperium-navy font-bold px-8 py-3 rounded-full shadow-sm border-2 border-imperium-gold text-xl hover:bg-imperium-gold hover:text-imperium-marble transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-imperium-gold"
            onClick={() => navigate('/signup-chatteur')}
          >
            Inscription Chatteur
          </button>
        </div>
      </main>
      <footer className="mt-16 text-imperium-marble opacity-60 text-sm">
        © {new Date().getFullYear()} Imperium. Tous droits réservés.
      </footer>
    </div>
  );
};

export default HomePage; 