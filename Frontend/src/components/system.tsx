import { useEffect, useState, type ReactNode } from 'react';
import { Clock, Hammer, Mail, Moon, PaintRoller, RefreshCw, Sun, Wrench, Zap } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { http } from '@/lib/http';
import { connectSocket, onSocket } from '@/lib/socket';
import { toggleTheme, type ThemeTransition } from '@/lib/theme';
import { useAuth, useSettings, useTheme, toast } from '@/store';
import { cn } from '@/lib/format';
import type { AppNotification, AppSettings } from '@/types';

/**
 * Sun/moon button. App uses the smooth cross-fade; admin passes variant="fold" for the paper-fold transition.
 * `decorative` renders only the animated icon (no button) for use inside a row that is itself the toggle.
 */
export function ThemeToggle({ className, variant = 'fade', decorative }: { className?: string; variant?: ThemeTransition; decorative?: boolean }) {
  const mode = useTheme((s) => s.mode);
  const dark = mode === 'dark';
  const cls = cn('relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full transition active:scale-95', className);
  const icons = (
    <>
      <Sun size={20} className={cn('absolute transition-all duration-500', dark ? 'translate-y-6 rotate-90 opacity-0' : 'translate-y-0 rotate-0 opacity-100')} />
      <Moon size={20} className={cn('absolute transition-all duration-500', dark ? 'translate-y-0 rotate-0 opacity-100' : '-translate-y-6 -rotate-90 opacity-0')} />
    </>
  );
  if (decorative) return <span aria-hidden className={cls}>{icons}</span>;
  return (
    <button type="button" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => toggleTheme(variant)} className={cls}>
      {icons}
    </button>
  );
}

/**
 * Loads public settings once and keeps them live over the socket. Also owns the single socket connection
 * (re-connects with the user's token after login/logout) and app-wide realtime events.
 * Mounted once at the root — the admin panel shares it but is never blocked by maintenance.
 */
export function AppBootstrap() {
  const token = useAuth((s) => s.token);
  const setSettings = useSettings((s) => s.set);
  const qc = useQueryClient();

  useEffect(() => {
    http.get<AppSettings>('/settings').then(setSettings).catch(() => undefined);
  }, [setSettings]);

  useEffect(() => {
    connectSocket(token);
    const offs = [
      onSocket<AppSettings>('settings:update', (s) => {
        setSettings(s);
        // Feature switches change what lists contain (e.g. banners) — refresh cached public data.
        qc.invalidateQueries({ queryKey: ['banners'] });
      }),
      onSocket('account:suspended', () => {
        toast('Your account has been suspended', 'error');
        useAuth.getState().logout();
        qc.clear();
      }),
      onSocket<AppNotification>('notification:new', (n) => {
        qc.setQueryData<AppNotification[]>(['notifications'], (l) => (l ? [n, ...l.filter((x) => x.id !== n.id)] : l));
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [token, setSettings, qc]);

  return null;
}

/** Wraps the customer/worker app. When admin turns maintenance on, the app is replaced instantly. */
export function MaintenanceGate({ children }: { children: ReactNode }) {
  const m = useSettings((s) => s.settings?.maintenance);
  return m?.enabled ? <MaintenanceScreen /> : <>{children}</>;
}

const TOOLS = [
  { I: Wrench, c: 'left-[6%] top-[18%] [animation-delay:0s]' },
  { I: Hammer, c: 'right-[8%] top-[12%] [animation-delay:.6s]' },
  { I: Zap, c: 'left-[14%] bottom-[22%] [animation-delay:1.2s]' },
  { I: PaintRoller, c: 'right-[12%] bottom-[28%] [animation-delay:1.8s]' },
];

export function MaintenanceScreen() {
  const m = useSettings((s) => s.settings?.maintenance);
  const email = useSettings((s) => s.settings?.supportEmail) || '';
  const setSettings = useSettings((s) => s.set);
  const [busy, setBusy] = useState(false);
  const retry = async () => {
    setBusy(true);
    try {
      const s = await http.get<AppSettings>('/settings');
      setSettings(s);
      if (s.maintenance.enabled) toast('Still under maintenance — we’ll be back soon', 'info');
    } catch {
      toast('Could not reach WorkNear', 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="pt-safe pb-safe relative flex min-h-dvh flex-col overflow-hidden bg-surface">
      <div className="relative overflow-hidden rounded-b-[36px] bg-gradient-to-br from-primary via-primary to-violet-500 px-6 pt-14 pb-24 text-white">
        <div className="absolute -top-20 -right-16 size-64 rounded-full bg-white/10" />
        <div className="absolute -bottom-24 -left-10 size-56 rounded-full bg-white/10" />
        {TOOLS.map(({ I, c }, i) => (
          <span key={i} className={cn('absolute grid size-11 animate-[wn-float_3.6s_ease-in-out_infinite] place-items-center rounded-2xl bg-white/15 backdrop-blur-sm', c)}>
            <I size={20} />
          </span>
        ))}
        <div className="relative mx-auto grid size-28 place-items-center rounded-[32px] bg-white shadow-2xl shadow-black/25">
          <Wrench size={52} className="animate-[wn-wiggle_2.4s_ease-in-out_infinite] text-primary" />
        </div>
      </div>
      <div className="relative -mt-10 flex flex-1 flex-col items-center px-6 text-center">
        <span className="rounded-full bg-warning-soft px-3 py-1 text-xs font-bold tracking-wide text-warning uppercase">Scheduled maintenance</span>
        <h1 className="mt-4 text-[26px] leading-tight font-extrabold text-ink">{m?.title || 'We’ll be right back'}</h1>
        <p className="mt-2 max-w-sm text-[15px] text-ink-2">{m?.message}</p>
        {m?.eta && (
          <p className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-surface-2 px-4 py-2.5 text-sm font-semibold text-ink">
            <Clock size={16} className="text-primary" /> Expected back in {m.eta}
          </p>
        )}
        <div className="mt-6 w-full max-w-sm rounded-2xl border border-line bg-surface-2/60 p-4 text-left text-sm text-ink-2">
          <b className="block text-ink">Your data is safe</b>
          Chats, profile and subscription are untouched. Workers stay listed once we are back.
        </div>
        <div className="min-h-6 flex-1" />
        <button onClick={retry} disabled={busy} className="mb-3 flex h-13 w-full max-w-sm items-center justify-center gap-2 rounded-2xl bg-primary font-semibold text-on-primary shadow-sm shadow-primary/30 transition active:scale-[.98] disabled:opacity-60">
          <RefreshCw size={18} className={cn(busy && 'animate-spin')} /> Try again
        </button>
        {email && <a href={`mailto:${email}`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2"><Mail size={15} />{email}</a>}
      </div>
      <ThemeToggle className="absolute top-[calc(env(safe-area-inset-top)+12px)] right-4 bg-white/15 text-white" />
    </div>
  );
}
