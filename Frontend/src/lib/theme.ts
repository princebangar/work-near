import { flushSync } from 'react-dom';
import { useAuth, useTheme, type ThemeMode, type ThemeScope } from '@/store';

/** Admin panel, or the signed-in user's active role in the app (worker / customer). */
export const currentThemeScope = (): ThemeScope =>
  location.pathname.startsWith('/admin') ? 'admin' : useAuth.getState().user?.activeRole === 'worker' ? 'worker' : 'customer';

/**
 * Writes the theme onto <html> (CSS tokens switch on [data-theme]; [data-panel] picks the admin indigo vs the app green)
 * and the browser chrome colour.
 */
export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  const admin = useTheme.getState().scope === 'admin';
  root.dataset.theme = mode;
  root.dataset.panel = admin ? 'admin' : 'app';
  root.style.colorScheme = mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'dark' ? '#000000' : admin ? '#4f46e5' : '#15803d');
}

/** Re-applies the right panel's saved mode — on boot, admin ↔ app navigation and customer ↔ worker switch. */
export function syncThemeScope() {
  const scope = currentThemeScope();
  const t = useTheme.getState();
  if (t.scope !== scope) t.setScope(scope);
  applyTheme(useTheme.getState().mode);
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

// Apply the right panel's saved theme before React paints, then follow customer <-> worker switches (called from main.tsx).
export function initTheme() {
  syncThemeScope();
  useAuth.subscribe((s, prev) => s.user?.activeRole !== prev.user?.activeRole && syncThemeScope());
}
