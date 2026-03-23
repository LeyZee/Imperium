import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/index.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount — validate JWT via /api/auth/me
  useEffect(() => {
    const controller = new AbortController();
    async function validateSession() {
      try {
        const res = await api.get('/api/auth/me', { signal: controller.signal });
        if (!controller.signal.aborted && res.data?.user) {
          setUser(res.data.user);
          sessionStorage.setItem('user', JSON.stringify(res.data.user));
        }
      } catch (err) {
        if (err?.name === 'CanceledError' || controller.signal.aborted) return;
        // JWT invalid — clear stale session data, user stays null (not logged in)
        sessionStorage.removeItem('user');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    validateSession();
    return () => controller.abort();
  }, []);

  const login = async (email, password) => {
    const response = await api.post('/api/auth/login', { email, password });
    const { user: newUser } = response.data;

    sessionStorage.setItem('user', JSON.stringify(newUser));
    setUser(newUser);

    return newUser;
  };

  const refreshUser = (updatedFields) => {
    const newUser = { ...user, ...updatedFields };
    setUser(newUser);
    sessionStorage.setItem('user', JSON.stringify(newUser));
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Ignore errors — clear local state regardless
    }
    sessionStorage.removeItem('user');
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default AuthContext;
