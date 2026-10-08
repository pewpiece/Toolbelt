import { create } from 'zustand';

import { getRepos } from './repos';

export type ThemeMode = 'light' | 'dark' | 'system';

export const FONT_SIZES = [13, 14, 15, 16, 18, 20] as const;
export const DEFAULT_FONT_SIZE = 15;

interface SettingsState {
  hydrated: boolean;
  themeMode: ThemeMode;
  fontSize: number;
  hydrate: () => void;
  setThemeMode: (m: ThemeMode) => void;
  setFontSize: (n: number) => void;
}

export function parseThemeMode(v: string | null): ThemeMode {
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

export function parseFontSize(v: string | null): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 12 && n <= 24 ? Math.round(n) : DEFAULT_FONT_SIZE;
}

function persist(key: string, value: string) {
  try {
    getRepos().settings.set(key, value);
  } catch {
    // Persisting a preference must never crash the UI; the in-memory value still applies.
  }
}

export const useSettings = create<SettingsState>((set) => ({
  hydrated: false,
  themeMode: 'system',
  fontSize: DEFAULT_FONT_SIZE,
  hydrate: () => {
    const s = getRepos().settings;
    set({
      hydrated: true,
      themeMode: parseThemeMode(s.get('themeMode')),
      fontSize: parseFontSize(s.get('fontSize')),
    });
  },
  setThemeMode: (themeMode) => {
    set({ themeMode });
    persist('themeMode', themeMode);
  },
  setFontSize: (fontSize) => {
    set({ fontSize });
    persist('fontSize', String(fontSize));
  },
}));
