import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  AlertTriangle, ArrowUpRight, BadgeCheck, ChevronDown, Crown, Download, FileClock, FileCheck2, Info, IndianRupee, LayoutGrid,
  MessageSquareWarning, MessagesSquare, Newspaper, OctagonAlert, RefreshCw, Search, SlidersHorizontal, UserX, Users, Wrench, type LucideIcon,
} from 'lucide-react';
import { Skeleton } from '@/components/ui';
import { useAdminBadges, useAdminKpis, useExport } from '@/api/admin';
import { useAuth } from '@/store';
import { cn, inr, num, timeAgo } from '@/lib/format';
import type { AdminKpis, AlertLevel, ExportType } from '@/types/admin';
import { isSuper, presetRange, type RangePreset } from '../lib';
import { Btn, ErrorBlock, Menu, MenuItem, Panel, Tabs } from '../components/kit';
import { CategoryDonut, ComplaintStatusRows, RevenueChart, SignupsChart } from '../components/charts';

type Tone = 'indigo' | 'emerald' | 'sky' | 'violet' | 'amber' | 'rose';
// Each tone has explicit dark-mode classes: tinted icon tile, stronger wash/glow, coloured hover glow.
const TONE: Record<Tone, { icon: string; tile: string; overlay: string; glow: string; ring: string }> = {
  indigo: {
    icon: 'text-indigo-500 dark:text-indigo-300',
    tile: 'dark:bg-indigo-500/15 dark:ring-indigo-400/25',
    overlay: 'from-indigo-500/[.09] dark:from-indigo-500/[.18]',
    glow: 'bg-indigo-500/15 dark:bg-indigo-500/30',
    ring: 'hover:border-indigo-400/50 dark:hover:border-indigo-400/40 dark:hover:shadow-indigo-500/15',
  },
  emerald: {
    icon: 'text-emerald-500 dark:text-emerald-300',
    tile: 'dark:bg-emerald-500/15 dark:ring-emerald-400/25',
    overlay: 'from-emerald-500/[.09] dark:from-emerald-500/[.18]',
    glow: 'bg-emerald-500/15 dark:bg-emerald-500/30',
    ring: 'hover:border-emerald-400/50 dark:hover:border-emerald-400/40 dark:hover:shadow-emerald-500/15',
  },
  sky: {
    icon: 'text-sky-500 dark:text-sky-300',
    tile: 'dark:bg-sky-500/15 dark:ring-sky-400/25',
    overlay: 'from-sky-500/[.09] dark:from-sky-500/[.18]',
    glow: 'bg-sky-500/15 dark:bg-sky-500/30',
    ring: 'hover:border-sky-400/50 dark:hover:border-sky-400/40 dark:hover:shadow-sky-500/15',
  },
  violet: {
    icon: 'text-violet-500 dark:text-violet-300',
    tile: 'dark:bg-violet-500/15 dark:ring-violet-400/25',
    overlay: 'from-violet-500/[.09] dark:from-violet-500/[.18]',
    glow: 'bg-violet-500/15 dark:bg-violet-500/30',
    ring: 'hover:border-violet-400/50 dark:hover:border-violet-400/40 dark:hover:shadow-violet-500/15',
  },
  amber: {
    icon: 'text-amber-500 dark:text-amber-300',
    tile: 'dark:bg-amber-500/15 dark:ring-amber-400/25',
    overlay: 'from-amber-500/[.09] dark:from-amber-500/[.18]',
    glow: 'bg-amber-500/15 dark:bg-amber-500/30',
    ring: 'hover:border-amber-400/50 dark:hover:border-amber-400/40 dark:hover:shadow-amber-500/15',
  },
  rose: {
    icon: 'text-rose-500 dark:text-rose-300',
    tile: 'dark:bg-rose-500/15 dark:ring-rose-400/25',
    overlay: 'from-rose-500/[.09] dark:from-rose-500/[.18]',
    glow: 'bg-rose-500/15 dark:bg-rose-500/30',
    ring: 'hover:border-rose-400/50 dark:hover:border-rose-400/40 dark:hover:shadow-rose-500/15',
  },
};

interface Kpi { title: string; value: string; helper: ReactNode; icon: LucideIcon; tone: Tone; to?: string; attention?: boolean }

const kpiCards = (k: AdminKpis): Kpi[] => [
  { title: 'Total users', value: num(k.totalUsers), helper: <><b className="text-success">+{num(k.newUsersToday)}</b> new today</>, icon: Users, tone: 'indigo', to: '/admin/users' },
  { title: 'Active workers', value: num(k.activeWorkers), helper: 'Visible in search right now', icon: Wrench, tone: 'emerald', to: '/admin/users?role=worker' },
  { title: 'Verified workers', value: num(k.verifiedWorkers), helper: 'Carry an approved badge', icon: BadgeCheck, tone: 'sky', to: '/admin/verifications?status=approved' },
  { title: 'Searches today', value: num(k.searchesToday), helper: 'Since midnight', icon: Search, tone: 'violet' },
  { title: 'Messages today', value: num(k.chatsToday), helper: <><b className="text-ink">{num(k.newChatsToday)}</b> new chats started</>, icon: MessagesSquare, tone: 'sky' },
  { title: 'Active subscriptions', value: num(k.activeSubscriptions), helper: 'Paid or granted, not expired', icon: Crown, tone: 'amber', to: '/admin/billing?tab=subscriptions' },
  { title: 'Revenue this month', value: inr(k.revenueMonth), helper: 'Paid since the 1st', icon: IndianRupee, tone: 'emerald', to: '/admin/billing?tab=transactions' },
  { title: 'Open complaints', value: num(k.openComplaints), helper: 'Not yet resolved', icon: MessageSquareWarning, tone: 'rose', to: '/admin/complaints', attention: k.openComplaints > 0 },
  { title: 'Pending verifications', value: num(k.pendingVerifications), helper: 'Waiting for review', icon: FileCheck2, tone: 'amber', to: '/admin/verifications', attention: k.pendingVerifications > 0 },
  { title: 'Deletion requests', value: num(k.deletionRequests), helper: 'Waiting to be processed', icon: UserX, tone: 'rose', to: '/admin/users?status=deleted_request', attention: k.deletionRequests > 0 },
];

function KpiCard({ k, index }: { k: Kpi; index: number }) {
  const nav = useNavigate();
  const t = TONE[k.tone];
  const body = (
    <>
      <span className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent to-transparent', t.overlay)} aria-hidden />
      <span className={cn('pointer-events-none absolute -top-8 -right-8 size-24 rounded-full blur-2xl', t.glow)} aria-hidden />
      <span className="relative flex items-start justify-between">
        <span className={cn('grid size-10 place-items-center rounded-xl bg-surface shadow-sm ring-1 ring-line dark:shadow-none', t.tile)}>
          <k.icon size={19} className={t.icon} />
        </span>
        {k.attention && (
          <span className="relative mt-1 mr-1 flex size-2.5" title="Needs attention">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-danger opacity-50" />
            <span className="relative size-2.5 rounded-full bg-danger" />
          </span>
        )}
        {k.to && !k.attention && (
          <ArrowUpRight size={18} className="-translate-x-1 translate-y-1 text-ink-3 opacity-0 transition duration-200 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
        )}
      </span>
      <span className="relative mt-4 block text-[10.5px] font-bold tracking-[.12em] text-ink-3 uppercase dark:text-ink-2/80">{k.title}</span>
      <span className="relative mt-1.5 block text-[26px] leading-none font-extrabold tracking-tight text-ink tabular-nums">{k.value}</span>
      <span className="relative mt-2 block truncate text-xs text-ink-2">{k.helper}</span>
    </>
  );
  const cls = cn(
    'adm-rise group relative block overflow-hidden rounded-2xl border border-line bg-surface p-4 text-left transition duration-200',
    'dark:border-white/[.06] dark:bg-gradient-to-b dark:from-surface-2/70 dark:to-surface dark:shadow-[inset_0_1px_0_rgba(255,255,255,.05)]',
    k.to && cn('cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/[.06] dark:hover:shadow-xl', t.ring),
  );
  return k.to ? (
    <button type="button" onClick={() => nav(k.to!)} className={cls} style={{ animationDelay: `${index * 30}ms` }} aria-label={`${k.title}: ${k.value}. Open`}>
      {body}
    </button>
  ) : (
    <div className={cls} style={{ animationDelay: `${index * 30}ms` }}>{body}</div>
  );
}

const ALERT_STYLE: Record<AlertLevel, { box: string; icon: LucideIcon; iconCls: string }> = {
  danger: { box: 'border-danger/25 bg-danger-soft', icon: OctagonAlert, iconCls: 'text-danger' },
  warning: { box: 'border-warning/25 bg-warning-soft', icon: AlertTriangle, iconCls: 'text-warning' },
  info: { box: 'border-primary/20 bg-primary-soft', icon: Info, iconCls: 'text-primary' },
};

function ExportMenu() {
  const [range, setRange] = useState<RangePreset>('30d');
  const exp = useExport();
  const run = (type: ExportType, close: () => void) => {
    close();
    exp.mutate({ type, ...presetRange(range) });
  };
  return (
    <Menu
      label="Export CSV"
      width="w-72"
      buttonClassName="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary shadow-sm shadow-primary/25 transition hover:bg-primary-600"
      button={<>{exp.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />} Export CSV <ChevronDown size={15} /></>}
    >
      {(close) => (
        <>
          <p className="px-3 pt-2 pb-2 text-[10.5px] font-bold tracking-[.14em] text-ink-3 uppercase">Date range</p>
          <div className="px-2 pb-2">
            <Tabs value={range} onChange={setRange} className="w-full" items={[{ value: '7d', label: '7 days' }, { value: '30d', label: '30 days' }, { value: 'month', label: 'Month' }, { value: 'all', label: 'All' }]} />
          </div>
          <div className="my-1 border-t border-line" />
          <MenuItem icon={<Users size={16} />} onClick={() => run('users', close)} hint="mobile masked">Users</MenuItem>
          <MenuItem icon={<IndianRupee size={16} />} onClick={() => run('transactions', close)}>Transactions</MenuItem>
          <MenuItem icon={<MessageSquareWarning size={16} />} onClick={() => run('complaints', close)}>Complaints</MenuItem>
        </>
      )}
    </Menu>
  );
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export function Dashboard() {
  const admin = useAuth((s) => s.admin)!;
  const kpis = useAdminKpis();
  const updated = kpis.dataUpdatedAt ? timeAgo(new Date(kpis.dataUpdatedAt).toISOString()) : null;

  return (
    <div className="overflow-hidden rounded-[28px] border border-line bg-surface shadow-sm shadow-black/[.03] dark:border-white/[.06] dark:shadow-none">
      <header className="relative overflow-hidden border-b border-line px-5 py-6 sm:px-8 sm:py-7">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary-soft via-primary-soft/40 to-transparent dark:from-primary/[.16] dark:via-primary/[.05]" aria-hidden />
        <div className="pointer-events-none absolute -top-20 right-10 size-56 rounded-full bg-primary/[.07] blur-2xl" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-[.2em] text-primary uppercase">Admin overview</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">{greeting()}, {admin.name.split(' ')[0]}</h1>
            <p className="mt-1 text-sm text-ink-2">
              Live snapshot of WorkNear · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              {updated && <span className="text-ink-3"> · updated {updated}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Btn icon={<RefreshCw size={16} className={cn(kpis.isFetching && 'animate-spin')} />} onClick={() => kpis.refetch()} disabled={kpis.isFetching} aria-label="Refresh dashboard">
              <span className="hidden sm:inline">Refresh</span>
            </Btn>
            <ExportMenu />
          </div>
        </div>
      </header>

      <div className="space-y-5 bg-bg/60 p-4 sm:p-6 lg:p-8 dark:bg-bg">
        {kpis.isPending ? <DashboardSkeleton /> : kpis.isError ? <ErrorBlock error={kpis.error} onRetry={() => kpis.refetch()} /> : <Body k={kpis.data} />}
      </div>
    </div>
  );
}

function Body({ k }: { k: AdminKpis }) {
  const role = useAuth((s) => s.admin!.role);
  const { data: badges } = useAdminBadges();
  const links = [
    { to: '/admin/verifications', label: 'Review verifications', icon: BadgeCheck, count: badges?.verifications },
    { to: '/admin/complaints', label: 'Complaint queue', icon: MessageSquareWarning, count: badges?.complaints },
    { to: '/admin/settings', label: 'Customization settings', icon: SlidersHorizontal },
    { to: '/admin/cms', label: 'Banners, FAQs & legal', icon: Newspaper },
    { to: '/admin/categories', label: 'Service categories', icon: LayoutGrid },
    ...(isSuper(role) ? [{ to: '/admin/audit', label: 'Audit logs', icon: FileClock }] : []),
  ];
  return (
    <>
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        {kpiCards(k).map((c, i) => <KpiCard key={c.title} k={c} index={i} />)}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Revenue" sub="Subscription revenue, last 6 months">
          <RevenueChart data={k.revenueLast6} />
        </Panel>
        <Panel title="Sign-ups" sub="Last 7 days">
          <SignupsChart data={k.signupsLast7} />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Workers by category" sub="Tap a category to focus it">
          <CategoryDonut data={k.workersByCategory} />
        </Panel>
        <Panel title="Complaints by status" sub="All time" actions={<Link to="/admin/complaints" className="text-xs font-semibold text-primary hover:underline">Open queue</Link>}>
          <ComplaintStatusRows data={k.complaintsByStatus} />
        </Panel>
        <Panel title="System alerts" sub="Things that need an admin" className="lg:col-span-2 xl:col-span-1">
          <ul className="space-y-2">
            {k.alerts.map((a) => {
              const s = ALERT_STYLE[a.level] ?? ALERT_STYLE.info;
              return (
                <li key={a.id} className={cn('flex items-start gap-3 rounded-xl border px-3.5 py-3', s.box)}>
                  <s.icon size={17} className={cn('mt-0.5 shrink-0', s.iconCls)} />
                  <span className="text-sm font-medium text-ink">{a.text}</span>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <Panel title="Quick links">
        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-3">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="group flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-3 transition hover:border-primary/40 hover:bg-primary-soft/40">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><l.icon size={17} /></span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{l.label}</span>
              {!!l.count && <span className="rounded-full bg-danger px-1.5 text-[11px] font-bold text-white tabular-nums">{l.count}</span>}
              <ArrowUpRight size={15} className="shrink-0 text-ink-3 transition group-hover:text-primary" />
            </Link>
          ))}
        </div>
      </Panel>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard" className="space-y-5">
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="rounded-2xl border border-line bg-surface p-4">
            <Skeleton className="size-10" />
            <Skeleton className="mt-4 h-3 w-24" />
            <Skeleton className="mt-2 h-7 w-20" />
            <Skeleton className="mt-2 h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-5 xl:col-span-2"><Skeleton className="h-4 w-28" /><Skeleton className="mt-4 h-72" /></div>
        <div className="rounded-2xl border border-line bg-surface p-5"><Skeleton className="h-4 w-24" /><Skeleton className="mt-4 h-72" /></div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="rounded-2xl border border-line bg-surface p-5"><Skeleton className="h-4 w-32" /><Skeleton className="mt-4 h-56" /></div>)}
      </div>
    </div>
  );
}
