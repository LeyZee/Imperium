import React, { useEffect } from 'react';
import { SignIn, SignUp, UserButton, useUser } from '@clerk/clerk-react';
import WeeklySchedule, { Shift } from './WeeklySchedule';
import { useNavigate } from 'react-router-dom';

const demoShifts: Shift[] = [
  {
    id: 1,
    pseudo: 'Alice',
    platform: 'OF',
    model: 'Model X',
    startTime: new Date(new Date().setHours(8, 0, 0, 0)).toISOString(),
    plannedEndTime: new Date(new Date().setHours(12, 0, 0, 0)).toISOString(),
  },
  {
    id: 2,
    pseudo: 'Bob',
    platform: 'Reveal',
    model: 'Model Y',
    startTime: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString(),
    plannedEndTime: new Date(new Date().setDate(new Date().getDate() + 1) + 4 * 60 * 60 * 1000).toISOString(),
  },
];

const App: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      // On suppose que le rôle est stocké dans user.publicMetadata.role
      const role = user.publicMetadata?.role || user.role;
      if (role === 'admin') navigate('/admin');
      else if (role === 'chatteur') navigate('/chatteur');
    }
  }, [user, navigate]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-imperium-navy">
        <header className="w-full bg-imperium-navy text-imperium-gold p-6 text-4xl font-extrabold tracking-widest shadow text-center mb-8">
          Imperium
        </header>
        <div className="bg-imperium-marble rounded-lg shadow p-8 w-full max-w-md">
          <h1 className="text-2xl font-bold mb-4 text-imperium-navy">Bienvenue !</h1>
          <SignIn />
          <p className="mt-4 text-imperium-navy">Pas encore de compte ?</p>
          <SignUp />
        </div>
      </div>
    );
  }

  // Si l'utilisateur est connecté mais n'a pas de rôle, on affiche un menu simple
  return (
    <div className="flex flex-col items-center min-h-screen bg-imperium-navy">
      <header className="w-full bg-imperium-navy text-imperium-gold p-6 text-4xl font-extrabold tracking-widest shadow text-center mb-8">
        Imperium
      </header>
      <nav className="mb-8 flex gap-4">
        <button className="bg-imperium-gold text-imperium-navy font-bold px-4 py-2 rounded shadow" onClick={() => navigate('/admin')}>Admin</button>
        <button className="bg-imperium-gold text-imperium-navy font-bold px-4 py-2 rounded shadow" onClick={() => navigate('/chatteur')}>Chatteur</button>
      </nav>
      <div className="flex flex-col items-center w-full max-w-6xl mt-8">
        <UserButton />
        <WeeklySchedule shifts={demoShifts} />
      </div>
    </div>
  );
};

export default App; 