import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export type Intent = 'WORK' | 'HIRE';

const STORAGE_KEY = 'workflex.intent';

interface IntentState {
  intent: Intent | null;
  setIntent: (intent: Intent) => Promise<void>;
  hydrate: () => Promise<void>;
}

/**
 * What the user said they came to do, captured before sign-in.
 *
 * Asking first lets the rest of the flow speak to one audience instead of
 * hedging, and it survives the OTP round trip so onboarding can pre-select
 * the sensible account type rather than asking the same thing twice.
 */
export const useIntentStore = create<IntentState>((set) => ({
  intent: null,

  hydrate: async () => {
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY);
      if (stored === 'WORK' || stored === 'HIRE') set({ intent: stored });
    } catch {
      // A missing preference just means we ask again.
    }
  },

  setIntent: async (intent) => {
    set({ intent });
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, intent);
    } catch {
      // Non-fatal: the choice still applies for this session.
    }
  },
}));
