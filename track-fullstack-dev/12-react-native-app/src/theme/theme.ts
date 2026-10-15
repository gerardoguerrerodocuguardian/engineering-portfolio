import { useColorScheme } from 'react-native';

export interface Palette {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryText: string;
  danger: string;
  success: string;
  warning: string;
  bar: string;
  barAlt: string;
}

export const lightPalette: Palette = {
  background: '#f5f6f8',
  surface: '#ffffff',
  text: '#14171c',
  textMuted: '#4f5866',
  border: '#d5d9e0',
  primary: '#1d4ed8',
  primaryText: '#ffffff',
  danger: '#b42318',
  success: '#17663a',
  warning: '#8a5a00',
  bar: '#1d4ed8',
  barAlt: '#0f766e',
};

export const darkPalette: Palette = {
  background: '#0d1117',
  surface: '#161b22',
  text: '#f0f3f6',
  textMuted: '#a5afbd',
  border: '#303844',
  primary: '#6ea0ff',
  primaryText: '#0d1117',
  danger: '#ff8b80',
  success: '#5fd18a',
  warning: '#f0b955',
  bar: '#6ea0ff',
  barAlt: '#4fd1c5',
};

export function paletteFor(scheme: string | null | undefined): Palette {
  return scheme === 'dark' ? darkPalette : lightPalette;
}

export function useTheme(): Palette {
  return paletteFor(useColorScheme());
}
