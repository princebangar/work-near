import { flushSync } from 'react-dom';
import { useTheme, type ThemeMode } from '@/store';

/** Writes the theme onto <html> (CSS tokens switch on [data-theme]) and the browser chrome colour. */
export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.style.colorScheme = mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'dark' ? '#0b0d14' : '#4f46e5');
}

/**
 * Theme switch.
 *  - 'fade' (customer/worker app): one smooth cross-fade of the whole screen — no flash, no colour flicker.
 *  - 'fold' (admin panel): "paper fold" reveal — the new theme sweeps in diagonally from the bottom-left
 *    corner to the top-right with a soft folded-edge shadow.
 * Uses the View Transitions API; instant switch where unsupported or with reduced motion.
 */
export type ThemeTransition = 'fade' | 'fold';
export function toggleTheme(variant: ThemeTransition = 'fade') {
  const next: ThemeMode = useTheme.getState().mode === 'dark' ? 'light' : 'dark';
  const commit = () => {
    useTheme.getState().setMode(next);
    applyTheme(next);
  };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (!doc.startViewTransition || reduce) return commit();
  const cls = variant === 'fold' ? 'theme-fold' : 'theme-fade';
  document.documentElement.classList.add(cls);
  const vt = doc.startViewTransition(() => flushSync(commit)) as { finished: Promise<void> };
  vt.finished.finally(() => document.documentElement.classList.remove(cls));
}

// Apply the persisted theme before first paint of React (called from main.tsx).
export const initTheme = () => applyTheme(useTheme.getState().mode);
