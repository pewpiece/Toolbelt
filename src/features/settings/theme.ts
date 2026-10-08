import { useColorScheme } from 'react-native';

import { useSettings } from '@/store/settings';

export interface Palette {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
  onPrimary: string;
  danger: string;
  codeBg: string;
  chip: string;
  token: Record<'plain' | 'comment' | 'string' | 'number' | 'keyword' | 'flag' | 'placeholder', string>;
}

export const lightPalette: Palette = {
  bg: '#f6f7f9',
  surface: '#ffffff',
  text: '#14171a',
  muted: '#5b6670',
  border: '#dfe3e8',
  primary: '#2457d6',
  onPrimary: '#ffffff',
  danger: '#b3261e',
  codeBg: '#f0f2f5',
  chip: '#e8ecf3',
  token: {
    plain: '#14171a',
    comment: '#6a737d',
    string: '#0a7a3c',
    number: '#b45309',
    keyword: '#7c3aed',
    flag: '#0e7490',
    placeholder: '#c2185b',
  },
};

export const darkPalette: Palette = {
  bg: '#0e1116',
  surface: '#171b22',
  text: '#e6e9ee',
  muted: '#98a2b0',
  border: '#2a303a',
  primary: '#7aa2ff',
  onPrimary: '#0b1020',
  danger: '#ff8a80',
  codeBg: '#10141a',
  chip: '#232a36',
  token: {
    plain: '#e6e9ee',
    comment: '#7d8896',
    string: '#7ee2a8',
    number: '#f5b46b',
    keyword: '#c4a1ff',
    flag: '#67d4e8',
    placeholder: '#ff7eb6',
  },
};

export interface Theme {
  dark: boolean;
  colors: Palette;
  /** Base body font size; other sizes scale from it. */
  font: { body: number; small: number; title: number; code: number };
}

export function buildTheme(mode: 'light' | 'dark' | 'system', system: string | null | undefined, fontSize: number): Theme {
  const dark = mode === 'system' ? system === 'dark' : mode === 'dark';
  return {
    dark,
    colors: dark ? darkPalette : lightPalette,
    font: {
      body: fontSize,
      small: Math.max(11, fontSize - 3),
      title: fontSize + 5,
      code: Math.max(11, fontSize - 1),
    },
  };
}

export function useTheme(): Theme {
  const system = useColorScheme();
  const mode = useSettings((s) => s.themeMode);
  const fontSize = useSettings((s) => s.fontSize);
  return buildTheme(mode, system, fontSize);
}
