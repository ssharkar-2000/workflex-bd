import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { api } from '../api/client';
import { clearTokens, getTokens, saveTokens, Tokens } from './tokenStorage';

export type Admin = {
  id: string;
  email: string;
  displayName: string;
  role: 'SUPER_ADMIN' | 'MODERATOR' | 'SUPPORT';
  language: 'en' | 'bn';
};

type AuthValue = {
  admin: Admin | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setLanguage: (language: 'en' | 'bn') => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);

  // 🟢 ব্যাকগ্রাউন্ড থেকে আসার পর নেটওয়ার্ক ফেল করলে সাইলেন্টলি হ্যান্ডেল করবে
  const loadAdmin = async (isInitialCheck = false) => {
    try {
      const data = await api<Admin>('/admin/me');
      setAdmin(data);
    } catch (e: any) {
      console.log('Admin fetch failed gracefully:', e?.message || e);
      // শুধুমাত্র অ্যাপ খোলার একদম প্রথমবার টোকেন ইনভ্যালিড হলে লগআউট করবে
      // ব্যাকগ্রাউন্ড থেকে আসার সময় নেটওয়ার্ক ল্যাগে টোকেন ক্লিয়ার করবে না
      if (isInitialCheck) {
        await clearTokens();
        setAdmin(null);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        const tokens = await getTokens();
        if (tokens?.accessToken) {
          await loadAdmin(true);
        } else {
          if (isMounted) setAdmin(null);
        }
      } catch {
        if (isMounted) {
          await clearTokens();
          setAdmin(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initAuth();

    // 🟢 অ্যাপ ব্যাকগ্রাউন্ড থেকে ফোরগ্রাউন্ডে এলে হ্যান্ডেল করার সেফ লিসেনার
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        getTokens().then((tokens) => {
          if (tokens?.accessToken) {
            loadAdmin(false); // সাইলেন্ট রি-ফেচ
          }
        });
      }
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      admin,
      loading,
      signIn: async (email, password) => {
        const tokens = await api<Tokens>('/auth/sign-in', {
          method: 'POST',
          body: { email, password },
          auth: false,
        });
        await saveTokens(tokens);
        await loadAdmin(true);
      },
      signOut: async () => {
        try {
          await api('/auth/sign-out', { method: 'POST' });
        } catch (e) {
          console.log('Sign-out API ignored error:', e);
        } finally {
          await clearTokens();
          setAdmin(null);
        }
      },
      setLanguage: async (language) => {
        try {
          const updated = await api<Admin>('/admin/me', { method: 'PATCH', body: { language } });
          setAdmin(updated);
        } catch {
          if (admin) setAdmin({ ...admin, language });
        }
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