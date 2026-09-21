import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { registerErrorTranslator } from '../api/errors';
import { useAuth } from '../auth/AuthContext';
import { Language, translations } from './translations';

const STORAGE_KEY = 'workflex.language';

type I18nValue = {
  language: Language;
  t: (key: string, vars?: Record<string, string | number>) => string;
  setLanguage: (language: Language) => void;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { admin, setLanguage: setAdminLanguage } = useAuth();
  const [language, setLanguageState] = useState<Language>('en');

  // Before sign-in (or if the profile fetch is slow) we still want the
  // last language the person picked on this device.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'en' || saved === 'bn') setLanguageState(saved);
      })
      .catch(() => {});
  }, []);

  // Once signed in, the admin's saved preference (from the backend) wins.
  useEffect(() => {
    if (admin?.language && admin.language !== language) {
      setLanguageState(admin.language);
      AsyncStorage.setItem(STORAGE_KEY, admin.language).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin?.language]);

  const setLanguage = useCallback(
    (next: Language) => {
      setLanguageState(next);
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      if (admin) setAdminLanguage(next);
    },
    [admin, setAdminLanguage],
  );

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const dict = translations[language] ?? translations.en;
      let str = dict[key] ?? translations.en[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(`{${k}}`, String(v));
        }
      }
      return str;
    },
    [language],
  );

  // Item 14: keep the error helper's translator in step with the language,
  // so a failure raised outside the React tree still reads in the right one.
  useEffect(() => {
    registerErrorTranslator(t);
  }, [t]);

  const value = useMemo<I18nValue>(() => ({ language, t, setLanguage }), [language, t, setLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
