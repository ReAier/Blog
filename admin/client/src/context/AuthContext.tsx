import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError } from '../api/client';
import type { AdminPermission, SessionUser } from '../types';

interface AuthContextValue {
  user?: SessionUser;
  loading: boolean;
  login: (input: { key: string }) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: AdminPermission) => boolean;
}
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser>();
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api.session().then((session) => { if (active) setUser(session); }).catch((error) => {
      if (!(error instanceof ApiError && error.status === 401)) console.error(error);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const clear = () => setUser(undefined);
    window.addEventListener('admin:auth-required', clear);
    return () => window.removeEventListener('admin:auth-required', clear);
  }, []);
  const login = useCallback(async (input: { key: string }) => setUser(await api.login(input)), []);
  const logout = useCallback(async () => { await api.logout(); setUser(undefined); }, []);
  const hasPermission = useCallback((permission: AdminPermission) => user?.permissions.includes(permission) ?? false, [user]);
  const value = useMemo(() => ({ user, loading, login, logout, hasPermission }), [user, loading, login, logout, hasPermission]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
