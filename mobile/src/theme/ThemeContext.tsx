import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  buildCategoryPalette,
  buildShadow,
  buildStatusPalette,
  buildText,
  darkColors,
  lightColors,
  radii,
  spacing,
  ThemeColors,
} from './index';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'workflex.themeMode';

type ThemeValue = {
  mode: ThemeMode;
  colors: ThemeColors;
  text: ReturnType<typeof buildText>;
  statusPalette: ReturnType<typeof buildStatusPalette>;
  categoryPalette: ReturnType<typeof buildCategoryPalette>;
  shadow: ReturnType<typeof buildShadow>;
  radii: typeof radii;
  spacing: typeof spacing;
  toggleMode: () => void;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'dark' || saved === 'light') setModeState(saved);
      })
      .catch(() => {
        // no persisted preference yet / storage unavailable — default to light
      });
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  const value = useMemo<ThemeValue>(() => {
    const colors = mode === 'dark' ? darkColors : lightColors;
    return {
      mode,
      colors,
      text: buildText(colors),
      statusPalette: buildStatusPalette(colors),
      categoryPalette: buildCategoryPalette(mode),
      shadow: buildShadow(mode),
      radii,
      spacing,
      toggleMode: () => setMode(mode === 'dark' ? 'light' : 'dark'),
      setMode,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
