// Design tokens — mirror Frontend/src/index.css (:root and [data-theme='dark']). Customer + worker app = bright logo green (#16a34a).
import { useMemo } from 'react';
import { useTheme } from '@/store';

export const palettes = {
  light: {
    primary: '#16a34a', primary600: '#15803d', primary2: '#22c55e', primarySoft: '#e9f9ef', onPrimary: '#ffffff',
    accent: '#f59e0b', bg: '#f5f6fa', surface: '#ffffff', surface2: '#f1f3f8', surface3: '#e8ebf1',
    ink: '#0f172a', ink2: '#475569', ink3: '#94a3b8', line: '#e5e7ef',
    success: '#16a34a', successSoft: '#dcfce7', warning: '#d97706', warningSoft: '#fef3c7', danger: '#dc2626', dangerSoft: '#fee2e2',
    skelA: '#e3e6ee', skelB: '#eef0f5',
  },
  dark: {
    primary: '#22c55e', primary600: '#16a34a', primary2: '#4ade80', primarySoft: '#0d2416', onPrimary: '#ffffff',
    accent: '#f59e0b', bg: '#000000', surface: '#0f0f0f', surface2: '#171717', surface3: '#222222',
    ink: '#f2f2f2', ink2: '#a3a3a3', ink3: '#737373', line: '#262626',
    success: '#22c55e', successSoft: '#10291c', warning: '#f59e0b', warningSoft: '#2b2211', danger: '#f87171', dangerSoft: '#361719',
    skelA: '#171717', skelB: '#222222',
  },
};

export const radius = { card: 18, xl: 12, '2xl': 16, '3xl': 24, full: 999 };

// Plus Jakarta Sans (same family the web loads from Google Fonts), one file per weight.
export const fonts = {
  400: 'PlusJakartaSans_400Regular',
  500: 'PlusJakartaSans_500Medium',
  600: 'PlusJakartaSans_600SemiBold',
  700: 'PlusJakartaSans_700Bold',
  800: 'PlusJakartaSans_800ExtraBold',
  900: 'PlusJakartaSans_800ExtraBold',
};

/** Hex colour + alpha (0–1) → rgba() — the web's `bg-primary/15` style. */
export function alpha(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export const useColors = () => palettes[useTheme((s) => s.mode)];
export const useIsDark = () => useTheme((s) => s.mode) === 'dark';

/** Memoised StyleSheet built from the current palette: `const s = useStyles(makeStyles)`. */
export function useStyles(factory) {
  const c = useColors();
  return useMemo(() => factory(c), [c, factory]);
}
