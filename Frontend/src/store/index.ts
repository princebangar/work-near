import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AdminRole, Lang, Role, Session, User } from '@/types';
import { APP } from '@/config/env';

// localStorage on web; swap for AsyncStorage when moving to React Native.
const storage = createJSONStorage(() => localStorage);

interface AuthState {
  token: string | null;
  user: User | null;
  admin: { token: string; name: string; role: AdminRole } | null;
  setSession: (s: Session) => void;
  updateUser: (u: Partial<User>) => void;
  switchRole: (r: Role) => void;
  setAdmin: (a: AuthState['admin']) => void;
  logout: () => void;
}
export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      admin: null,
      setSession: ({ token, user }) => set({ token, user }),
      updateUser: (u) => set((s) => (s.user ? { user: { ...s.user, ...u } } : s)),
      switchRole: (r) =>
        set((s) => (s.user ? { user: { ...s.user, activeRole: r, roles: s.user.roles.includes(r) ? s.user.roles : [...s.user.roles, r] } } : s)),
      setAdmin: (admin) => set({ admin }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'wn-auth', storage },
  ),
);

export interface GeoPoint { lat: number; lng: number; label: string; source: 'gps' | 'manual' }
interface GeoState {
  point: GeoPoint;
  radiusKm: number;
  asked: boolean;
  setAsked: () => void;
  setPoint: (p: GeoPoint) => void;
  setRadius: (r: number) => void;
}
export const useGeo = create<GeoState>()(
  persist(
    (set) => ({
      point: { lat: 28.6139, lng: 77.209, label: 'Connaught Place, New Delhi', source: 'manual' },
      radiusKm: APP.defaultRadiusKm,
      asked: false,
      setAsked: () => set({ asked: true }),
      setPoint: (point) => set({ point }),
      setRadius: (radiusKm) => set({ radiusKm }),
    }),
    { name: 'wn-geo', storage },
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
