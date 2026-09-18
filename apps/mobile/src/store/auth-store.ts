import { create } from 'zustand';
import type {
  Admin,
  AdminAuthTokens,
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
  /**
   * Set only for an admin session (POST /auth/admin/login), never alongside
   * `user`. There is no refresh token for this session — checked directly
   * rather than inferred from `refreshToken === null`, because a regular
   * session can legitimately be mid-hydration with no refresh token yet.
   */
  admin: Admin | null;

  hydrate: () => Promise<void>;
  setSession: (session: AuthSession) => Promise<void>;
  setTokens: (tokens: AuthTokens) => Promise<void>;
  setUser: (user: AuthUser) => void;
  setAdminSession: (tokens: AdminAuthTokens) => Promise<void>;
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
  admin: null,

  /** Called once at app launch, before anything is rendered. */
  hydrate: async () => {
    const [accessToken, refreshToken, adminAccessToken, adminUserRaw] =
      await Promise.all([
        getSecure('accessToken'),
        getSecure('refreshToken'),
        getSecure('adminAccessToken'),
        getSecure('adminUser'),
      ]);

    // An admin session has no refresh token to judge restorability by, so a
    // stored access token is trusted until the first request 401s — at which
    // point the client signs it out (see api/client.ts).
    if (adminAccessToken && adminUserRaw) {
      set({
        accessToken: adminAccessToken,
        admin: JSON.parse(adminUserRaw) as Admin,
        status: 'authenticated',
      });
      return;
    }

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

  setAdminSession: async (tokens) => {
    await Promise.all([
      setSecure('adminAccessToken', tokens.accessToken),
      setSecure('adminUser', JSON.stringify(tokens.admin)),
    ]);
    set({
      accessToken: tokens.accessToken,
      admin: tokens.admin,
      refreshToken: null,
      user: null,
      status: 'authenticated',
    });
  },

  signOut: async () => {
    await Promise.all([
      deleteSecure('accessToken'),
      deleteSecure('refreshToken'),
      deleteSecure('adminAccessToken'),
      deleteSecure('adminUser'),
    ]);
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      admin: null,
      status: 'unauthenticated',
    });
  },
}));
