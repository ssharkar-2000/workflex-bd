import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import {
  clearTokens,
  getStoredAdmin,
  getTokens,
  saveStoredAdmin,
  saveTokens,
} from './tokenStorage';

export type Admin = {
  id: string;
  email: string;
  displayName: string;
  role: 'SUPER_ADMIN' | 'MODERATOR' | 'SUPPORT';
  language: 'en' | 'bn';
};

/** What POST /auth/admin/login answers with. */
type LoginResponse = {
  accessToken: string;
  expiresIn: number;
  admin: { id: string; email: string; name?: string | null };
};

type AuthValue = {
  admin: Admin | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setLanguage: (language: 'en' | 'bn') => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

/**
 * Every account in the API's Admin table may do everything; there are no
 * roles yet, so the screens that branch on one are told the account is a
 * super admin rather than being hidden from a reviewer who needs them.
 */
function toAdmin(res: LoginResponse, language: 'en' | 'bn'): Admin {
  return {
    id: res.admin.id,
    email: res.admin.email,
    displayName: res.admin.name ?? res.admin.email,
    role: 'SUPER_ADMIN',
    language,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * The session is restored from storage, not re-fetched: admin sign-in
   * returns the account with the token and the API has no "who am I" route
   * for admins. An expired token surfaces as a 401 on the first screen that
   * loads, which clears the session (see api/client.ts).
   */
  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const tokens = await getTokens();
        const stored = tokens?.accessToken
          ? await getStoredAdmin<Admin>()
          : null;
        if (alive) setAdmin(stored);
      } catch {
        await clearTokens();
        if (alive) setAdmin(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      admin,
      loading,
      signIn: async (email, password) => {
        const res = await api<LoginResponse>('/auth/admin/login', {
          method: 'POST',
          body: { email, password },
          auth: false,
        });
        const next = toAdmin(res, admin?.language ?? 'en');
        await saveTokens({ accessToken: res.accessToken });
        await saveStoredAdmin(next);
        setAdmin(next);
      },
      // Nothing to tell the server: the token is stateless and expires on its
      // own, so signing out is dropping it from this device.
      signOut: async () => {
        await clearTokens();
        setAdmin(null);
      },
      setLanguage: async (language) => {
        if (!admin) return;
        const next = { ...admin, language };
        await saveStoredAdmin(next);
        setAdmin(next);
      },
    }),
    [admin, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
