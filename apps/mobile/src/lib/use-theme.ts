import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { palettes, type Palette, type ThemeMode } from './theme';

const STORAGE_KEY = 'workflex.themePreference';

/**
 * Light or dark, nothing else.
 *
 * There used to be a third `system` option. It is gone by request, but the
 * device setting still decides the *starting* mode on a fresh install — a
 * phone in dark mode is usually in dark mode for a reason, and opening
 * blazing white is the fastest way to get an app closed. After the first
 * explicit choice the stored value wins and the device is ignored.
 */
export type ThemePreference = ThemeMode;

interface ThemeState {
  /** Null until hydrated, meaning "nothing chosen yet, follow the device". */
  preference: ThemePreference | null;
  ready: boolean;
  hydrate: () => Promise<void>;
  setPreference: (preference: ThemePreference) => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: null,
  ready: false,

  hydrate: async () => {
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY);
      set({
        // A stored 'system' is a leftover from the old three-way control.
        // Treated as "never chose", so the device keeps deciding rather than
        // the app silently pinning them to light.
        preference: stored === 'light' || stored === 'dark' ? stored : null,
        ready: true,
      });
    } catch {
      set({ ready: true });
    }
  },

  setPreference: async (preference) => {
    set({ preference });
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, preference);
    } catch {
      // A failed write only costs the preference on next launch.
    }
  },
}));

export interface ThemeValue {
  mode: ThemeMode;
  /** The resolved mode — the control is a two-way switch, so these agree. */
  preference: ThemePreference;
  c: Palette;
  isDark: boolean;
  setPreference: (preference: ThemePreference) => Promise<void>;
  toggle: () => Promise<void>;
}

export function useTheme(): ThemeValue {
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  const system = useColorScheme();

  // Falls back to the device only until the first explicit choice.
  const mode: ThemeMode = preference ?? (system === 'dark' ? 'dark' : 'light');

  return useMemo(
    () => ({
      mode,
      preference: mode,
      c: palettes[mode],
      isDark: mode === 'dark',
      setPreference,
      toggle: () => setPreference(mode === 'dark' ? 'light' : 'dark'),
    }),
    [mode, setPreference],
  );
}
