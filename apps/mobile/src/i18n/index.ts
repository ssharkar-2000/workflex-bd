import { useCallback } from 'react';
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { DEFAULT_LOCALE, type Locale } from '@workflex/shared';
import { dictionaries, type TranslationKey } from './translations';

const STORAGE_KEY = 'workflex.locale';

interface I18nState {
  locale: Locale;
  /**
   * Whether this device has a language of its own — picked here, or taken
   * from the account and saved. False on a fresh install, where `locale` is
   * only the default.
   */
  chosen: boolean;
  ready: boolean;
  hydrate: () => Promise<void>;
  setLocale: (locale: Locale) => Promise<void>;
}

/**
 * The choice is saved on the device, because it has to apply before anyone
 * signs in — the landing screen is the first thing a user sees and it must
 * already be in their language — and it stays through signing out.
 *
 * It is also kept on the account, so it follows the person to a new phone:
 * a device with no choice of its own takes the account's language when they
 * sign in, and a choice made on this device is copied back to the account
 * (see the dashboard).
 */
export const useI18nStore = create<I18nState>((set) => ({
  locale: DEFAULT_LOCALE,
  chosen: false,
  ready: false,

  hydrate: async () => {
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY);
      const saved = stored === 'en' || stored === 'bn';
      set({
        locale: saved ? stored : DEFAULT_LOCALE,
        chosen: saved,
        ready: true,
      });
    } catch {
      set({ ready: true });
    }
  },

  setLocale: async (locale) => {
    set({ locale, chosen: true });
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, locale);
    } catch {
      // A failed write only costs the preference on next launch.
    }
  },
}));

export type Translate = (
  key: TranslationKey,
  params?: Record<string, string | number>,
) => string;

export function useT(): Translate {
  const locale = useI18nStore((s) => s.locale);

  return useCallback(
    (key, params) => {
      const template = dictionaries[locale][key] ?? dictionaries.en[key] ?? key;
      if (!params) return template;

      return Object.entries(params).reduce(
        (out, [name, value]) => out.replaceAll(`{${name}}`, String(value)),
        template,
      );
    },
    [locale],
  );
}

export function useLocale(): [Locale, (l: Locale) => Promise<void>] {
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);
  return [locale, setLocale];
}

export type { TranslationKey };
