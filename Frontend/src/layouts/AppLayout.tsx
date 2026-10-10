import { Suspense, useEffect, useState } from 'react';
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
        <div className="app-scroll no-scrollbar flex min-h-dvh flex-col sm:h-full sm:overflow-y-auto sm:overscroll-contain">
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

/** Hide on scroll-down, show on scroll-up (same thresholds as HelloParth). Listens to window + the desktop frame scroller. */
function useHideOnScroll(pathname: string) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => setHidden(false), [pathname]);
  useEffect(() => {
    let last = 0, acc = 0;
    const onScroll = (e: Event) => {
      const t = e.target;
      if (t !== document && !(t instanceof HTMLElement && t.classList.contains('app-scroll'))) return; // ignore horizontal carousels etc.
      const y = t === document ? window.scrollY : (t as HTMLElement).scrollTop;
      if (y <= 50) { acc = 0; last = y; setHidden(false); return; }
      const d = y - last;
      if (Math.sign(d) !== Math.sign(acc)) acc = 0;
      acc += d;
      if (acc > 80 && y > 100) setHidden(true);
      else if (acc < -150) setHidden(false);
      last = y;
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', onScroll, { capture: true });
  }, []);
  return hidden;
}

export function TabsLayout() {
  const t = useT();
  const { pathname } = useLocation();
  const role = useAuth((s) => s.user?.activeRole);
  const { data } = useConversations();
  const unread = data?.reduce((n, c) => n + (c.muted ? 0 : c.unread), 0) ?? 0;
  const tabs = role === 'worker' ? workerTabs : customerTabs;
  const active = tabs.findIndex(({ to }) => (to === '/' ? pathname === '/' : pathname.startsWith(to)));
  const hidden = useHideOnScroll(pathname);
  return (
    <>
      <main className="flex-1 pb-[calc(104px+env(safe-area-inset-bottom))]">
        <Suspense fallback={<Spinner />}>
          <Outlet />
        </Suspense>
      </main>
      <nav
        aria-hidden={hidden}
        className={cn(
          'pointer-events-none fixed inset-x-0 bottom-0 z-40 px-5 pb-[calc(20px+env(safe-area-inset-bottom))] transition-transform duration-200 ease-[cubic-bezier(.22,1,.36,1)]',
          hidden && 'translate-y-[140%]',
        )}
      >
        <div className="pointer-events-auto relative mx-auto flex h-[70px] max-w-md items-center rounded-[2rem] border border-line/70 bg-surface px-1.5 shadow-[0_15px_40px_-10px_rgba(0,0,0,0.3)]">
          {/* Sliding active pill */}
          {active >= 0 && (
            <span
              aria-hidden
              className="absolute inset-y-1.5 left-1.5 rounded-[1.5rem] bg-primary-soft transition-transform duration-300 ease-[cubic-bezier(.34,1.3,.64,1)]"
              style={{ width: `calc((100% - 12px) / ${tabs.length})`, transform: `translateX(${active * 100}%)` }}
            />
          )}
          {tabs.map(({ to, icon: I, label }, i) => (
            <NavLink
              key={to}
              to={to}
              replace={i === active}
              className={cn('relative z-10 flex h-14 flex-1 touch-manipulation flex-col items-center justify-center gap-1 transition-colors duration-300', i === active ? 'text-primary' : 'text-ink-2')}
            >
              <span className="relative">
                <I size={22} strokeWidth={i === active ? 2.4 : 2} className={cn('transition-transform duration-300', i === active && 'scale-110')} />
                {to === '/chats' && unread > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white ring-2 ring-surface">{unread}</span>
                )}
              </span>
              <span className={cn('text-[10px] leading-none font-black tracking-tight uppercase', i !== active && 'opacity-70')}>{t(label)}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
