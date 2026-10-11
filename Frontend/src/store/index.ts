import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AdminRole, AdminPermissions, AppSettings, FeatureKey, Lang, Role, Session, User } from '@/types';
import { APP } from '@/config/env';

// localStorage on web; swap for AsyncStorage when moving to React Native.
const storage = createJSONStorage(() => localStorage);

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  admin: { token: string; id?: string; name: string; email?: string; role: AdminRole; mfaEnabled?: boolean; permissions?: AdminPermissions } | null;
  setSession: (s: Session) => void;
  setTokens: (token: string, refreshToken: string) => void;
  updateUser: (u: Partial<User>) => void;
  switchRole: (r: Role) => void;
  setAdmin: (a: AuthState['admin']) => void;
  logout: () => void;
}
export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      admin: null,
      setSession: ({ token, refreshToken, user }) => set({ token, refreshToken: refreshToken ?? null, user }),
      setTokens: (token, refreshToken) => set({ token, refreshToken }),
      updateUser: (u) => set((s) => (s.user ? { user: { ...s.user, ...u } } : s)),
      switchRole: (r) =>
        set((s) => (s.user ? { user: { ...s.user, activeRole: r, roles: s.user.roles.includes(r) ? s.user.roles : [...s.user.roles, r] } } : s)),
      setAdmin: (admin) => set({ admin }),
      logout: () => set({ token: null, refreshToken: null, user: null }),
    }),
    { name: 'wn-auth', storage },
  ),
);

export interface GeoPoint { lat: number; lng: number; label: string; source: 'gps' | 'manual' }
interface GeoState {
  /** null until the user picks a location (GPS, map, search or saved address) — no hard-coded default city. */
  point: GeoPoint | null;
  radiusKm: number;
  asked: boolean;
  setAsked: () => void;
  setPoint: (p: GeoPoint) => void;
  setRadius: (r: number) => void;
}
export const useGeo = create<GeoState>()(
  persist(
    (set) => ({
      point: null,
      radiusKm: APP.defaultRadiusKm,
      asked: false,
      setAsked: () => set({ asked: true }),
      setPoint: (point) => set({ point }),
      setRadius: (radiusKm) => set({ radiusKm }),
    }),
    {
      name: 'wn-geo',
      storage,
      version: 1,
      // v0 stored a hard-coded default city for everyone — drop it so the user is asked for their real location.
      migrate: (s) => {
        const st = s as GeoState;
        if (st?.point?.label === 'Connaught Place, New Delhi' && st.point.source === 'manual') st.point = null;
        return st;
      },
    },
  ),
);

interface PrefsState {
  lang: Lang;
  onboarded: boolean;
  notif: { chat: boolean; subscription: boolean; offers: boolean };
  setLang: (l: Lang) => void;
  setOnboarded: () => void;
  setNotif: (k: keyof PrefsState['notif'], v: boolean) => void;
}
export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      lang: 'en',
      onboarded: false,
      notif: { chat: true, subscription: true, offers: false },
      setLang: (lang) => set({ lang }),
      setOnboarded: () => set({ onboarded: true }),
      setNotif: (k, v) => set((s) => ({ notif: { ...s.notif, [k]: v } })),
    }),
    { name: 'wn-prefs', storage },
  ),
);

type ToastKind = 'success' | 'error' | 'info';
interface ToastState {
  toast: { id: number; kind: ToastKind; text: string } | null;
  show: (text: string, kind?: ToastKind) => void;
}
export const useToast = create<ToastState>()((set) => ({
  toast: null,
  show: (text, kind = 'success') => {
    const id = Date.now();
    set({ toast: { id, kind, text } });
    setTimeout(() => set((s) => (s.toast?.id === id ? { toast: null } : s)), 2600);
  },
}));
export const toast = (text: string, kind?: ToastKind) => useToast.getState().show(text, kind);

// ---------- Live app settings (feature toggles + maintenance) ----------
// Loaded once at boot (GET /settings) and kept fresh by the socket `settings:update` event — no polling.
interface SettingsState {
  settings: AppSettings | null;
  set: (s: AppSettings) => void;
  patch: (p: Partial<AppSettings>) => void;
}
export const useSettings = create<SettingsState>()((set) => ({
  settings: null,
  set: (settings) => set({ settings }),
  patch: (p) => set((s) => ({ settings: s.settings ? { ...s.settings, ...p } : ({ ...p } as AppSettings) })),
}));
/** true unless admin switched the feature off. Unknown (still loading) counts as on. */
export const useFeature = (k: FeatureKey) => useSettings((s) => s.settings?.features?.[k] !== false);
export const featureOn = (k: FeatureKey) => useSettings.getState().settings?.features?.[k] !== false;

// ---------- Theme ----------
export type ThemeMode = 'light' | 'dark';
interface ThemeState { mode: ThemeMode; setMode: (m: ThemeMode) => void }
const systemMode = (): ThemeMode => (typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
export const useTheme = create<ThemeState>()(
  persist((set) => ({ mode: systemMode(), setMode: (mode) => set({ mode }) }), { name: 'wn-theme', storage }),
);
