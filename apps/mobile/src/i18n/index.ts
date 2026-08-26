import { useCallback } from 'react';
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { DEFAULT_LOCALE, type Locale } from '@workflex/shared';
import { dictionaries, type TranslationKey } from './translations';

const STORAGE_KEY = 'workflex.locale';

interface I18nState {
  locale: Locale;
  ready: boolean;
  hydrate: () => Promise<void>;
  setLocale: (locale: Locale) => Promise<void>;
}

/**
 * The choice is persisted on the device rather than only on the account,
 * because it has to apply before anyone signs in — the landing screen is the
 * first thing a user sees and it must already be in their language.
 */
export const useI18nStore = create<I18nState>((set) => ({
  locale: DEFAULT_LOCALE,
  ready: false,

  hydrate: async () => {
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY);
      set({
        locale: stored === 'en' || stored === 'bn' ? stored : DEFAULT_LOCALE,
        ready: true,
      });
    } catch {
      set({ ready: true });
    }
  },

  setLocale: async (locale) => {
    set({ locale });
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
