import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

export interface User {
  id: number;
  username: string;
  nombre: string;
  rol: 'admin' | 'agente';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  getAuthHeader: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_KEY = 'aima_crm_auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Cargar sesión guardada al iniciar
  useEffect(() => {
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored) {
      try {
        const { user: storedUser, authHeader } = JSON.parse(stored);
        setUser(storedUser);
        // Verificar que la sesión sigue siendo válida
        fetch('/api/auth/me', { headers: { Authorization: authHeader } })
          .then(res => {
            if (!res.ok) throw new Error('Sesión expirada');
            return res.json();
          })
          .then(data => {
            setUser(data);
          })
          .catch(() => {
            localStorage.removeItem(AUTH_KEY);
            setUser(null);
          });
      } catch {
        localStorage.removeItem(AUTH_KEY);
        setUser(null);
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    const authHeader = 'Basic ' + btoa(`${username}:${password}`);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { Authorization: authHeader },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error de autenticación' }));
        throw new Error(err.error);
      }

      const userData = await res.json();
      setUser(userData);
      localStorage.setItem(AUTH_KEY, JSON.stringify({ user: userData, authHeader }));
      return true;
    } catch (err: any) {
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(AUTH_KEY);
  }, []);

  // Generar header auth desde credenciales guardadas
  const getAuthHeader = useCallback((): string | null => {
    const stored = localStorage.getItem(AUTH_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored).authHeader;
    } catch {
      return null;
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, getAuthHeader }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}