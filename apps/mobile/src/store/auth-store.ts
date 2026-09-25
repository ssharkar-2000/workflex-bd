import { create } from 'zustand';
import type {
  AuthSession,
  AuthTokens,
  AuthUser,
} from '@workflex/shared';
import {
  deleteSecure,
  getSecure,
  setSecure,
} from '../lib/secure-storage';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;

  hydrate: () => Promise<void>;
  setSession: (session: AuthSession) => Promise<void>;
  setTokens: (tokens: AuthTokens) => Promise<void>;
  setUser: (user: AuthUser) => void;
  signOut: () => Promise<void>;
}

/**
 * The api client reads tokens via `useAuthStore.getState()`. This store must
 * therefore never import the api client, or the two form a cycle.
 */
export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  accessToken: null,
  refreshToken: null,

  /** Called once at app launch, before anything is rendered. */
  hydrate: async () => {
    const [accessToken, refreshToken] = await Promise.all([
      getSecure('accessToken'),
      getSecure('refreshToken'),
    ]);

    // This app no longer signs anyone in as an admin — that moved to the
    // admin panel (apps/admin). Any token left in the keystore by the screens
    // that did is cleared out here rather than left sitting there.
    void deleteSecure('adminAccessToken');
    void deleteSecure('adminUser');

    // A refresh token is what makes a regular session restorable; the access
    // token has very likely expired while the app was closed.
    set({
      accessToken,
      refreshToken,
      status: refreshToken ? 'authenticated' : 'unauthenticated',
    });
  },

  setSession: async (session) => {
    await Promise.all([
      setSecure('accessToken', session.tokens.accessToken),
      setSecure('refreshToken', session.tokens.refreshToken),
    ]);
    set({
      user: session.user,
      accessToken: session.tokens.accessToken,
      refreshToken: session.tokens.refreshToken,
      status: 'authenticated',
    });
  },

  setTokens: async (tokens) => {
    await Promise.all([
      setSecure('accessToken', tokens.accessToken),
      setSecure('refreshToken', tokens.refreshToken),
    ]);
    set({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      status: 'authenticated',
    });
  },

  setUser: (user) => set({ user }),

  signOut: async () => {
    await Promise.all([
      deleteSecure('accessToken'),
      deleteSecure('refreshToken'),
    ]);
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      status: 'unauthenticated',
    });
  },
}));
