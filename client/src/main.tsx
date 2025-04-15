import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './HomePage';
import SignupChatteur from './SignupChatteur';
import App from './App';
import AdminDashboard from './AdminDashboard';
import ChatteurDashboard from './ChatteurDashboard';
import './style.css';

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_test_Z2xvcmlvdXMtZmxlYS0xOC5jbGVyay5hY2NvdW50cy5kZXYk';

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={clerkKey}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<App />} />
          <Route path="/signup-chatteur" element={<SignupChatteur />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/chatteur" element={<ChatteurDashboard />} />
        </Routes>
      </BrowserRouter>
    </ClerkProvider>
  </React.StrictMode>
);
