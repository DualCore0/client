'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  ApiError,
  clearToken,
  getMe,
  getToken,
  logout as logoutRequest,
  setToken,
  type AuthUser,
  type Role,
} from '@/lib/api';

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  signIn: (token: string, user?: AuthUser) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await getMe();
      setUser(me);
      setError(null);
    } catch (err) {
      // An expired or invalid token must not leave a stale session behind.
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        clearToken();
      }
      setUser(null);
      setError(err instanceof Error ? err.message : 'Could not load your session');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(async (token: string, nextUser?: AuthUser) => {
    setToken(token);
    if (nextUser) {
      setUser(nextUser);
      setLoading(false);
    }
    await refresh();
  }, [refresh]);

  const signOut = useCallback(() => {
    // Revoke the refresh session server-side so the cookie cannot be reused,
    // but never block the UI on the network.
    void logoutRequest().catch(() => undefined);
    clearToken();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, error, refresh, signIn, signOut }),
    [user, loading, error, refresh, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/**
 * Client-side route guard. Renders a spinner while the session is resolved,
 * redirects anonymous visitors to /login and wrong-role visitors to their own
 * dashboard. Returns the authenticated user to the caller.
 */
export function useRequireAuth(requiredRole?: Role) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const next = typeof window !== 'undefined' ? window.location.pathname : '/dashboard';
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    if (requiredRole && user.role !== requiredRole) {
      router.replace(user.role === 'TEACHER' ? '/rooms' : '/dashboard');
    }
  }, [user, loading, requiredRole, router]);

  return { user, loading, ready: !loading && !!user && (!requiredRole || user.role === requiredRole) };
}
