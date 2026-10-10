import { Suspense } from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router';
import { Home, LayoutDashboard, MessageCircle, Search, User, UserRound } from 'lucide-react';
import { useAuth, usePrefs } from '@/store';
import { useConversations } from '@/api';
import { useT, type TKey } from '@/i18n';
import { cn } from '@/lib/format';
import { Spinner } from '@/components/ui';

/**
 * Phone-sized frame. Mobile: full-bleed native feel. Tablet/desktop: a centred phone device, scrolling inside it.
 * translateZ(0) makes fixed children (bottom nav, sheets, CTA bars) position relative to the frame.
 */
export function AppFrame() {
  return (
    <div className="min-h-dvh bg-[#e9ebf3] sm:grid sm:place-items-center sm:p-4">
      <div className="app-frame relative mx-auto w-full max-w-[var(--app-max-w)] bg-bg sm:h-[min(880px,calc(100dvh-32px))] sm:max-w-[412px] sm:overflow-hidden sm:rounded-[44px] sm:border-[10px] sm:border-[#111827] sm:shadow-2xl sm:shadow-black/25 sm:[transform:translateZ(0)]">
        <div className="no-scrollbar flex min-h-dvh flex-col sm:h-full sm:overflow-y-auto sm:overscroll-contain">
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export function RequireAuth() {
  const token = useAuth((s) => s.token);
  const user = useAuth((s) => s.user);
  const onboarded = usePrefs((s) => s.onboarded);
  const loc = useLocation();
  if (!token) return <Navigate to={onboarded ? '/login' : '/welcome'} replace state={{ from: loc.pathname }} />;
  if (!user?.name) return <Navigate to="/role" replace />;
  return <Outlet />;
}

const customerTabs: { to: string; icon: typeof Home; label: TKey }[] = [
  { to: '/', icon: Home, label: 'home' },
  { to: '/search', icon: Search, label: 'search' },
  { to: '/chats', icon: MessageCircle, label: 'chats' },
  { to: '/account', icon: User, label: 'account' },
];
const workerTabs: typeof customerTabs = [
  { to: '/', icon: LayoutDashboard, label: 'dashboard' },
  { to: '/chats', icon: MessageCircle, label: 'chats' },
  { to: '/my-profile', icon: UserRound, label: 'myProfile' },
  { to: '/account', icon: User, label: 'account' },
];

export function TabsLayout() {
  const t = useT();
  const role = useAuth((s) => s.user?.activeRole);
  const { data } = useConversations();
  const unread = data?.reduce((n, c) => n + (c.muted ? 0 : c.unread), 0) ?? 0;
  const tabs = role === 'worker' ? workerTabs : customerTabs;
  return (
    <>
      <main className="flex-1 pb-[calc(72px+env(safe-area-inset-bottom))]">
        <Suspense fallback={<Spinner />}>
          <Outlet />
        </Suspense>
      </main>
      <nav className="pb-safe fixed bottom-0 left-1/2 z-40 w-full max-w-[var(--app-max-w)] -translate-x-1/2 border-t border-line bg-surface/95 backdrop-blur">
        <ul className="grid h-[64px] grid-cols-4">
          {tabs.map(({ to, icon: I, label }) => (
            <li key={to}>
              <NavLink to={to} end={to === '/'} className={({ isActive }) => cn('relative flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold', isActive ? 'text-primary' : 'text-ink-3')}>
                {({ isActive }) => (
                  <>
                    <span className={cn('grid h-7 w-14 place-items-center rounded-full transition', isActive && 'bg-primary-soft')}>
                      <I size={21} strokeWidth={isActive ? 2.4 : 1.9} />
                    </span>
                    {t(label)}
                    {to === '/chats' && unread > 0 && (
                      <span className="absolute top-1.5 left-1/2 ml-2 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] text-white">{unread}</span>
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
