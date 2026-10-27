import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { APP } from '@/config/env';
import { appStorage, secureStorage } from '@/lib/storage';

// Same stores as the web (Frontend/src/store), persisted with SecureStore (auth) / AsyncStorage (rest).

export const useAuth = create()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      setSession: ({ token, refreshToken, user }) => set({ token, refreshToken: refreshToken ?? null, user }),
      setTokens: (token, refreshToken) => set({ token, refreshToken }),
      updateUser: (u) => set((s) => (s.user ? { user: { ...s.user, ...u } } : s)),
      switchRole: (r) =>
        set((s) => (s.user ? { user: { ...s.user, activeRole: r, roles: s.user.roles.includes(r) ? s.user.roles : [...s.user.roles, r] } } : s)),
      logout: () => set({ token: null, refreshToken: null, user: null }),
    }),
    { name: 'wn-auth', storage: secureStorage, partialize: (s) => ({ token: s.token, refreshToken: s.refreshToken, user: s.user }) },
  ),
);

export const useGeo = create()(
  persist(
    (set) => ({
      /** null until the user picks a location (GPS, map, search or saved address) — no hard-coded default city. */
      point: null,
      radiusKm: APP.defaultRadiusKm,
      asked: false,
      setAsked: () => set({ asked: true }),
      setPoint: (point) => set({ point }),
      setRadius: (radiusKm) => set({ radiusKm }),
    }),
    { name: 'wn-geo', storage: appStorage, version: 1 },
  ),
);

export const usePrefs = create()(
  persist(
    (set) => ({
      lang: 'en',
      onboarded: false,
      setLang: (lang) => set({ lang }),
      setOnboarded: () => set({ onboarded: true }),
    }),
    { name: 'wn-prefs', storage: appStorage },
  ),
);

export const useToast = create()((set) => ({
  toast: null,
  show: (text, kind = 'success') => {
    const id = Date.now();
    set({ toast: { id, kind, text } });
    setTimeout(() => set((s) => (s.toast?.id === id ? { toast: null } : s)), 2600);
  },
}));
export const toast = (text, kind) => useToast.getState().show(text, kind);

// ---------- Live app settings (feature toggles + maintenance) ----------
// Loaded once at boot (GET /settings) and kept fresh by the socket `settings:update` event — no polling.
export const useSettings = create()((set) => ({
  settings: null,
  set: (settings) => set({ settings }),
  patch: (p) => set((s) => ({ settings: s.settings ? { ...s.settings, ...p } : { ...p } })),
}));
/** true unless admin switched the feature off. Unknown (still loading) counts as on. */
export const useFeature = (k) => useSettings((s) => s.settings?.features?.[k] !== false);
export const featureOn = (k) => useSettings.getState().settings?.features?.[k] !== false;

// ---------- Theme ----------
// Customer and worker app keep their own light/dark choice (web: useTheme().modes). Always starts light — dark only from the in-app toggle.
export const useTheme = create()(
  persist(
    (set) => ({
      modes: { customer: 'light', worker: 'light' },
      scope: 'customer',
      mode: 'light',
      setMode: (mode) => set((s) => ({ mode, modes: { ...s.modes, [s.scope]: mode } })),
      setScope: (scope) => set((s) => ({ scope, mode: s.modes[scope] })),
    }),
    {
      name: 'wn-theme',
      storage: appStorage,
      version: 1, // v0 copied the phone's dark mode — reset those installs to light once
      migrate: () => ({ modes: { customer: 'light', worker: 'light' } }),
      partialize: (s) => ({ modes: s.modes }),
      merge: (p, cur) => {
        const modes = { ...cur.modes, ...p?.modes };
        return { ...cur, modes, mode: modes[cur.scope] };
      },
    },
  ),
);

/** Follows customer ↔ worker switches (web: lib/theme.ts initTheme). */
export function syncThemeScope() {
  const scope = useAuth.getState().user?.activeRole === 'worker' ? 'worker' : 'customer';
  const t = useTheme.getState();
  if (t.scope !== scope) t.setScope(scope);
}
useAuth.subscribe((s, prev) => s.user?.activeRole !== prev.user?.activeRole && syncThemeScope());

/** Resolves once every persisted store has loaded from disk. */
export function whenHydrated() {
  const stores = [useAuth, useGeo, usePrefs, useTheme];
  return Promise.all(
    stores.map((st) => (st.persist.hasHydrated() ? Promise.resolve() : new Promise((r) => { const off = st.persist.onFinishHydration(() => { off(); r(); }); }))),
  ).then(() => {
    const { token, user, logout } = useAuth.getState();
    if (token && !user?.name) logout(); // sign-up left half-way (name never saved): start again from login
    syncThemeScope();
  });
}
