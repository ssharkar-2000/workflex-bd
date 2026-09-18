import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { Admin, AdminAuthTokens } from '@workflex/shared';

const KEYS = {
  token: 'workflex.admin.accessToken',
  admin: 'workflex.admin.user',
} as const;

type Status = 'loading' | 'authenticated' | 'unauthenticated';

interface AdminState {
  status: Status;
  accessToken: string | null;
  admin: Admin | null;

  hydrate: () => Promise<void>;
  signIn: (tokens: AdminAuthTokens) => Promise<void>;
  signOut: () => Promise<void>;
}

/**
 * Admin sessions carry no refresh token — the API issues one longer-lived
 * access token (ADMIN_JWT_TTL, 8h) and expects a fresh sign-in after it
 * lapses. An expired token therefore surfaces as a plain 401, which the api
 * client turns into a sign-out; there is nothing to silently rotate.
 */
export const useAdminStore = create<AdminState>((set) => ({
  status: 'loading',
  accessToken: null,
  admin: null,

  hydrate: async () => {
    try {
      const [token, raw] = await Promise.all([
        SecureStore.getItemAsync(KEYS.token),
        SecureStore.getItemAsync(KEYS.admin),
      ]);
      if (token && raw) {
        set({
          accessToken: token,
          admin: JSON.parse(raw) as Admin,
          status: 'authenticated',
        });
        return;
      }
    } catch {
      // A failed read just means signing in again.
    }
    set({ status: 'unauthenticated' });
  },

  signIn: async (tokens) => {
    await Promise.all([
      SecureStore.setItemAsync(KEYS.token, tokens.accessToken),
      SecureStore.setItemAsync(KEYS.admin, JSON.stringify(tokens.admin)),
    ]);
    set({
      accessToken: tokens.accessToken,
      admin: tokens.admin,
      status: 'authenticated',
    });
  },

  signOut: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.token),
      SecureStore.deleteItemAsync(KEYS.admin),
    ]);
    set({ accessToken: null, admin: null, status: 'unauthenticated' });
  },
}));
