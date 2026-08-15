import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError } from '../api/client';
import type { AdminSetupStatus, SessionUser } from '../types';

interface AuthContextValue {
  user?: SessionUser;
  setupStatus?: AdminSetupStatus;
  loading: boolean;
  login: (input: {
    username: string;
    password: string;
    totp?: string;
    recoveryCode?: string;
  }) => Promise<void>;
  acceptSetupSession: (session: SessionUser) => void;
  refreshSetupStatus: () => Promise<AdminSetupStatus>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser>();
  const [setupStatus, setSetupStatus] = useState<AdminSetupStatus>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.session()
        .then((session) => { if (active) setUser(session); })
        .catch((error) => {
          if (!(error instanceof ApiError && error.status === 401)) console.error(error);
        }),
      api.setupStatus()
        .then((status) => { if (active) setSetupStatus(status); })
        .catch((error) => console.error(error)),
    ]).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const clearExpiredSession = () => setUser(undefined);
    window.addEventListener('admin:auth-required', clearExpiredSession);
    return () => window.removeEventListener('admin:auth-required', clearExpiredSession);
  }, []);

  const login = useCallback(async (input: {
    username: string;
    password: string;
    totp?: string;
    recoveryCode?: string;
  }) => {
    const session = await api.login(input);
    setUser(session);
  }, []);

  const acceptSetupSession = useCallback((session: SessionUser) => {
    setUser(session);
    setSetupStatus({ required: false, tokenReady: false });
  }, []);

  const refreshSetupStatus = useCallback(async () => {
    const status = await api.setupStatus();
    setSetupStatus(status);
    return status;
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(undefined);
  }, []);

  const value = useMemo(() => ({
    user,
    setupStatus,
    loading,
    login,
    acceptSetupSession,
    refreshSetupStatus,
    logout,
  }), [
    user,
    setupStatus,
    loading,
    login,
    acceptSetupSession,
    refreshSetupStatus,
    logout,
  ]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
