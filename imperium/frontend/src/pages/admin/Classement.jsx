import { Trophy } from 'lucide-react';
import ClassementBoard from '../../components/ClassementBoard.jsx';

export default function Classement() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1f2e', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <Trophy size={24} color="#f5b731" /> Classement
      </h1>
      <ClassementBoard />
    </div>
  );
}
