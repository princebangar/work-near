// Admin shell: session guard, role-guarded routes (each page is its own lazy chunk), sidebar + topbar + palette.
import { Suspense, lazy, useEffect, useState, type ComponentType, type LazyExoticComponent } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { Skeleton } from '@/components/ui';
import { useAuth } from '@/store';
import { cn } from '@/lib/format';
import type { AdminRole } from '@/types/admin';
import { AdminStyles } from '../components/styles';
import { useStoredState } from '../lib';
import { CommandPalette } from './CommandPalette';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { homeFor, itemForPath, itemsFor } from './nav';

const Dashboard = lazy(() => import('../pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const UsersPage = lazy(() => import('../pages/Users').then((m) => ({ default: m.UsersPage })));
const VerificationsPage = lazy(() => import('../pages/Verifications').then((m) => ({ default: m.VerificationsPage })));
const CategoriesPage = lazy(() => import('../pages/Categories').then((m) => ({ default: m.CategoriesPage })));
const BillingPage = lazy(() => import('../pages/Billing').then((m) => ({ default: m.BillingPage })));
const ComplaintsPage = lazy(() => import('../pages/Complaints').then((m) => ({ default: m.ComplaintsPage })));
const ReviewsPage = lazy(() => import('../pages/Reviews').then((m) => ({ default: m.ReviewsPage })));
const CmsPage = lazy(() => import('../pages/Cms').then((m) => ({ default: m.CmsPage })));
const SettingsPage = lazy(() => import('../pages/Settings').then((m) => ({ default: m.SettingsPage })));
const AuditPage = lazy(() => import('../pages/Audit').then((m) => ({ default: m.AuditPage })));
const StaffPage = lazy(() => import('../pages/Staff').then((m) => ({ default: m.StaffPage })));
const AccountPage = lazy(() => import('../pages/Account').then((m) => ({ default: m.AccountPage })));

const PAGES: Record<string, LazyExoticComponent<ComponentType>> = {
  '': Dashboard,
  users: UsersPage,
  verifications: VerificationsPage,
  categories: CategoriesPage,
  billing: BillingPage,
  complaints: ComplaintsPage,
  reviews: ReviewsPage,
  cms: CmsPage,
  settings: SettingsPage,
  audit: AuditPage,
  staff: StaffPage,
  account: AccountPage,
};

export function AdminRoot() {
  const role = useAuth((s) => s.admin?.role);
  const loc = useLocation();
  if (!role) return <Navigate to="/admin/login" replace state={{ from: loc.pathname + loc.search }} />;
  return <AdminShell role={role} />;
}

function AdminShell({ role }: { role: AdminRole }) {
  const [collapsed, setCollapsed] = useStoredState('wn-admin-sidebar-collapsed', false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { pathname } = useLocation();
  const items = itemsFor(role);
  const home = homeFor(role);

  // Restore the app title when leaving the panel (declared first so it captures the original).
  useEffect(() => {
    const original = document.title;
    return () => void (document.title = original);
  }, []);

  // Close the mobile drawer on navigation; keep the tab title in sync.
  useEffect(() => {
    setMobileOpen(false);
    const item = itemForPath(pathname);
    document.title = `${item?.label ?? 'Admin'} · WorkNear Admin`;
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <AdminStyles />
      <a href="#admin-main" className="sr-only z-[80] rounded-lg bg-primary px-3 py-2 text-on-primary focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Skip to content</a>
      <Sidebar role={role} collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className={cn('flex min-h-dvh flex-col transition-[padding] duration-300 ease-out', collapsed ? 'lg:pl-20' : 'lg:pl-72')}>
        <Topbar onMenu={() => setMobileOpen(true)} onSearch={() => setPaletteOpen(true)} />
        <main id="admin-main" className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              {items.map((i) => {
                const Page = PAGES[i.to]!;
                return i.to === '' ? <Route key="index" index element={<Page />} /> : <Route key={i.to} path={i.to} element={<Page />} />;
              })}
              <Route path="*" element={<Navigate to={home ? `/admin/${home}` : '/admin'} replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} role={role} />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-2 h-4 w-28" />
      <Skeleton className="mb-6 h-8 w-64" />
      <div className="mb-4 flex gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-24 rounded-full" />)}</div>
      <div className="space-y-2 rounded-2xl border border-line bg-surface p-3">{Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
    </div>
  );
}
