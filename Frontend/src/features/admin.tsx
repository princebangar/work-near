import { useState, type ReactNode } from 'react';
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router';
import {
  BadgeCheck, BarChart3, FileClock, FolderTree, IndianRupee, LayoutDashboard, LogOut, Menu, MessageSquareWarning, Search, ShieldCheck, Star,
  Users, Wallet, X, Newspaper, UserCog, AlertTriangle, Info, MessageCircle, Briefcase, Download,
} from 'lucide-react';
import { Avatar, Badge, Button, Card, Chip, Input, Sheet, Skeleton, Textarea, Toggle, CategoryIcon, type Tone } from '@/components/ui';
import { useAdminList, useAdminLogin, useAdminPatch } from '@/api';
import { useAuth, toast } from '@/store';
import { cn, date, inr, num, timeAgo } from '@/lib/format';
import { APP } from '@/config/env';
import type * as T from '@/types';

// ---------- Auth ----------
export function AdminLogin() {
  const nav = useNavigate();
  const setAdmin = useAuth((s) => s.setAdmin);
  const [f, setF] = useState({ email: 'owner@worknear.in', password: 'demo1234', otp: '' });
  const m = useAdminLogin();
  return (
    <div className="grid min-h-dvh place-items-center bg-gradient-to-br from-primary to-primary-600 p-4">
      <Card className="w-full max-w-sm p-6 shadow-2xl">
        <div className="mb-6 flex items-center gap-2">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-white"><ShieldCheck /></span>
          <div><b className="block text-lg">WorkNear Admin</b><span className="text-xs text-ink-2">Secure sign-in with MFA</span></div>
        </div>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); m.mutate(f, { onSuccess: (a) => { setAdmin(a); nav('/admin'); } }); }}>
          <Input label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <Input label="Password" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          <Input label="Authenticator code (MFA)" inputMode="numeric" maxLength={6} value={f.otp} onChange={(e) => setF({ ...f, otp: e.target.value.replace(/\D/g, '') })} placeholder={`Demo: ${APP.demoOtp}`} />
          {m.error && <p className="text-sm text-danger">{m.error.message}</p>}
          <Button block size="lg" loading={m.isPending}>Sign in</Button>
        </form>
      </Card>
    </div>
  );
}

// ---------- Layout ----------
type NavItem = { to: string; label: string; icon: typeof Users; roles?: T.AdminRole[] };
const NAV: NavItem[] = [
  { to: '', label: 'Dashboard', icon: LayoutDashboard, roles: ['super_admin', 'admin'] },
  { to: 'users', label: 'Users', icon: Users, roles: ['super_admin', 'admin'] },
  { to: 'verifications', label: 'Verifications', icon: BadgeCheck, roles: ['super_admin', 'admin'] },
  { to: 'categories', label: 'Categories', icon: FolderTree, roles: ['super_admin', 'admin'] },
  { to: 'subscriptions', label: 'Subscriptions', icon: Wallet, roles: ['super_admin', 'admin'] },
  { to: 'complaints', label: 'Complaints', icon: MessageSquareWarning },
  { to: 'reviews', label: 'Reviews', icon: Star, roles: ['super_admin', 'admin'] },
  { to: 'cms', label: 'Content (CMS)', icon: Newspaper, roles: ['super_admin', 'admin'] },
  { to: 'audit', label: 'Audit logs', icon: FileClock, roles: ['super_admin'] },
  { to: 'staff', label: 'Roles & staff', icon: UserCog, roles: ['super_admin'] },
];

export function AdminRoot() {
  const admin = useAuth((s) => s.admin);
  const setAdmin = useAuth((s) => s.setAdmin);
  const [open, setOpen] = useState(false);
  if (!admin) return <Navigate to="/admin/login" replace />;
  const items = NAV.filter((n) => !n.roles || n.roles.includes(admin.role));
  const side = (
    <nav className="flex h-full flex-col gap-1 p-3">
      <div className="mb-4 flex items-center gap-2 px-2 py-2">
        <span className="grid size-9 place-items-center rounded-xl bg-primary text-white"><ShieldCheck size={20} /></span>
        <b className="text-lg">WorkNear</b><Badge tone="primary">Admin</Badge>
      </div>
      {items.map(({ to, label, icon: I }) => (
        <NavLink key={to} to={`/admin/${to}`} end={to === ''} onClick={() => setOpen(false)}
          className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold', isActive ? 'bg-primary text-white' : 'text-ink-2 hover:bg-surface-2')}>
          <I size={18} />{label}
        </NavLink>
      ))}
      <div className="flex-1" />
      <div className="flex items-center gap-2 rounded-xl bg-surface-2 p-2.5">
        <Avatar name={admin.name} size={36} />
        <div className="min-w-0 flex-1"><b className="block truncate text-sm">{admin.name}</b><span className="text-xs text-ink-2 capitalize">{admin.role.replace('_', ' ')}</span></div>
        <button aria-label="Logout" onClick={() => setAdmin(null)} className="p-1.5 text-ink-2 hover:text-danger"><LogOut size={18} /></button>
      </div>
    </nav>
  );
  const fallback = items[0].to;
  return (
    <div className="min-h-dvh bg-bg lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-surface lg:block">{side}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="animate-fade absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-72 max-w-[85%] bg-surface">
            <button aria-label="Close" onClick={() => setOpen(false)} className="absolute top-4 right-3 p-1"><X /></button>
            {side}
          </aside>
        </div>
      )}
      <header className="pt-safe sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface/90 px-3 backdrop-blur lg:hidden">
        <button aria-label="Menu" onClick={() => setOpen(true)} className="p-2"><Menu /></button>
        <b>WorkNear Admin</b>
      </header>
      <main className="mx-auto max-w-7xl p-4 md:p-6">
        <Routes>
          {admin.role !== 'support' && <Route index element={<Dashboard />} />}
          <Route path="users" element={<UsersPage />} />
          <Route path="verifications" element={<VerificationsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="subscriptions" element={<SubscriptionsPage />} />
          <Route path="complaints" element={<ComplaintsPage />} />
          <Route path="reviews" element={<ReviewsPage />} />
          <Route path="cms" element={<CmsPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="*" element={<Navigate to={`/admin/${fallback}`} replace />} />
        </Routes>
      </main>
    </div>
  );
}

// ---------- Building blocks ----------
const PageHead = ({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) => (
  <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div><h1 className="text-2xl font-extrabold">{title}</h1>{sub && <p className="text-sm text-ink-2">{sub}</p>}</div>
    {action}
  </div>
);

interface Col<R> { key: string; label: string; render: (r: R) => ReactNode; className?: string }
/** Table on md+, stacked cards on mobile. */
function DataTable<R extends { id: string }>({ rows, cols, loading, actions }: { rows?: R[]; cols: Col<R>[]; loading?: boolean; actions?: (r: R) => ReactNode }) {
  if (loading) return <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>;
  if (!rows?.length) return <Card className="p-10 text-center text-ink-2">No records found</Card>;
  return (
    <>
      <Card className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs font-semibold text-ink-2 uppercase">
            <tr>{cols.map((c) => <th key={c.key} className="px-4 py-3">{c.label}</th>)}{actions && <th className="px-4 py-3 text-right">Actions</th>}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-surface-2/50">
                {cols.map((c) => <td key={c.key} className={cn('px-4 py-3', c.className)}>{c.render(r)}</td>)}
                {actions && <td className="px-4 py-3 text-right whitespace-nowrap">{actions(r)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="space-y-3 md:hidden">
        {rows.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="mb-2">{cols[0].render(r)}</div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              {cols.slice(1).map((c) => <div key={c.key}><dt className="text-xs text-ink-3">{c.label}</dt><dd>{c.render(r)}</dd></div>)}
            </dl>
            {actions && <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">{actions(r)}</div>}
          </Card>
        ))}
      </div>
    </>
  );
}

const SearchBox = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
  <label className="flex h-11 w-full items-center gap-2 rounded-xl border border-line bg-surface px-3 sm:w-72">
    <Search size={18} className="text-ink-3" /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-transparent text-sm outline-none" />
  </label>
);

const tone = (s: string): Tone =>
  ({ active: 'success', approved: 'success', success: 'success', resolved: 'success', visible: 'success', pending: 'warning', open: 'warning', info_requested: 'warning', in_progress: 'primary', suspended: 'danger', rejected: 'danger', failed: 'danger', escalated: 'danger', hidden: 'neutral', refunded: 'neutral', deleted_request: 'danger' } as Record<string, Tone>)[s] ?? 'neutral';
const Status = ({ s }: { s: string }) => <Badge tone={tone(s)}>{s.replace('_', ' ')}</Badge>;

function ReasonSheet({ title, open, onClose, onSubmit, cta, danger }: { title: string; open: boolean; onClose: () => void; onSubmit: (reason: string) => void; cta: string; danger?: boolean }) {
  const [reason, setReason] = useState('');
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="mb-3 text-sm text-ink-2">A reason is required and will be recorded in the audit log with your name and timestamp.</p>
      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason…" />
      <Button block className="mt-4" variant={danger ? 'danger' : 'primary'} disabled={reason.trim().length < 3} onClick={() => { onSubmit(reason); setReason(''); onClose(); }}>{cta}</Button>
    </Sheet>
  );
}

// ---------- Pages ----------
function Dashboard() {
  const { data: k, isLoading } = useAdminList<T.AdminKpis>('kpis', '/admin/kpis');
  if (isLoading || !k) return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div>;
  const tiles = [
    { label: 'Total users', value: num(k.totalUsers), icon: Users },
    { label: 'Active workers', value: num(k.activeWorkers), icon: Briefcase },
    { label: 'Verified workers', value: num(k.verifiedWorkers), icon: BadgeCheck },
    { label: 'Searches today', value: num(k.searchesToday), icon: Search },
    { label: 'Chats today', value: num(k.chatsToday), icon: MessageCircle },
    { label: 'Active subscriptions', value: num(k.activeSubscriptions), icon: Wallet },
    { label: 'Revenue (month)', value: inr(k.revenueMonth), icon: IndianRupee },
    { label: 'Open complaints', value: k.openComplaints, icon: MessageSquareWarning },
  ];
  const max = Math.max(...k.signupsLast7.map((d) => d.customers + d.workers));
  return (
    <>
      <PageHead title="Dashboard" sub="Platform overview" action={<Button variant="outline" size="sm"><Download size={16} />Export CSV</Button>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ label, value, icon: I }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center justify-between text-ink-2"><span className="text-xs font-semibold">{label}</span><I size={18} /></div>
            <b className="mt-2 block text-2xl font-extrabold">{value}</b>
          </Card>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between"><b className="flex items-center gap-2"><BarChart3 size={18} />Sign-ups (last 7 days)</b>
            <span className="flex gap-3 text-xs"><span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-primary" />Customers</span><span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-accent" />Workers</span></span>
          </div>
          <div className="flex h-48 items-end gap-3">
            {k.signupsLast7.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.customers} customers, ${d.workers} workers`}>
                <div className="flex w-full max-w-10 flex-col overflow-hidden rounded-t-lg" style={{ height: `${((d.customers + d.workers) / max) * 160}px` }}>
                  <div className="bg-accent" style={{ flex: d.workers }} /><div className="bg-primary" style={{ flex: d.customers }} />
                </div>
                <span className="text-xs text-ink-2">{d.day}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <b className="mb-3 block">System alerts</b>
          <div className="space-y-2">
            {k.alerts.map((a) => (
              <div key={a.id} className={cn('flex gap-2 rounded-xl p-3 text-sm', { info: 'bg-primary-soft', warning: 'bg-warning-soft', danger: 'bg-danger-soft' }[a.level])}>
                {a.level === 'info' ? <Info size={16} className="shrink-0 text-primary" /> : <AlertTriangle size={16} className={cn('shrink-0', a.level === 'danger' ? 'text-danger' : 'text-warning')} />}
                {a.text}
              </div>
            ))}
          </div>
          <NavLink to="/admin/verifications" className="mt-4 flex items-center justify-between rounded-xl bg-surface-2 p-3 text-sm font-semibold">
            Pending verifications <Badge tone="warning">{k.pendingVerifications}</Badge>
          </NavLink>
        </Card>
      </div>
    </>
  );
}

function UsersPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>();
  const { data, isLoading } = useAdminList<T.Paginated<T.AdminUser>>('users', '/admin/users', { q: q || undefined, status });
  const patch = useAdminPatch<T.AdminUser>('users', '/admin/users');
  const [target, setTarget] = useState<T.AdminUser | null>(null);
  return (
    <>
      <PageHead title="Users" sub={`${data?.total ?? '…'} users`} action={<SearchBox value={q} onChange={setQ} placeholder="Search name or mobile" />} />
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {[undefined, 'active', 'suspended', 'deleted_request'].map((s) => <Chip key={String(s)} active={status === s} onClick={() => setStatus(s)}>{s ? s.replace('_', ' ') : 'All'}</Chip>)}
      </div>
      <DataTable
        loading={isLoading} rows={data?.items}
        cols={[
          { key: 'name', label: 'User', render: (u) => <span className="flex items-center gap-2"><Avatar name={u.name} size={34} /><span><b className="block">{u.name}</b><span className="text-xs text-ink-2">{u.mobile}</span></span></span> },
          { key: 'roles', label: 'Roles', render: (u) => <span className="flex gap-1">{u.roles.map((r) => <Badge key={r} tone="primary">{r}</Badge>)}</span> },
          { key: 'city', label: 'City', render: (u) => u.city },
          { key: 'reports', label: 'Reports', render: (u) => (u.reports ? <Badge tone="danger">{u.reports}</Badge> : '0') },
          { key: 'joined', label: 'Joined', render: (u) => date(u.joinedAt) },
          { key: 'status', label: 'Status', render: (u) => <Status s={u.status} /> },
        ]}
        actions={(u) => u.status === 'suspended'
          ? <Button size="sm" variant="soft" onClick={() => patch.mutate({ id: u.id, status: 'active' }, { onSuccess: () => toast('User reinstated') })}>Reinstate</Button>
          : <Button size="sm" variant="outline" className="text-danger" onClick={() => setTarget(u)}>Suspend</Button>}
      />
      <ReasonSheet open={!!target} onClose={() => setTarget(null)} title={`Suspend ${target?.name}`} cta="Suspend user" danger
        onSubmit={(reason) => target && patch.mutate({ id: target.id, status: 'suspended', reason }, { onSuccess: () => toast('User suspended') })} />
    </>
  );
}

const vLabel: Record<T.VerificationType, string> = { phone: 'Phone', id: 'Government ID', id_address: 'ID + Address' };
function VerificationsPage() {
  const [status, setStatus] = useState<string | undefined>('pending');
  const { data, isLoading } = useAdminList<T.VerificationRequest[]>('verifications', '/admin/verifications', { status });
  const patch = useAdminPatch<T.VerificationRequest>('verifications', '/admin/verifications');
  const [act, setAct] = useState<{ v: T.VerificationRequest; to: 'rejected' | 'info_requested' } | null>(null);
  return (
    <>
      <PageHead title="Worker verification" sub="Documents are private. Every view is audit-logged." />
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {[undefined, 'pending', 'approved', 'rejected', 'info_requested'].map((s) => <Chip key={String(s)} active={status === s} onClick={() => setStatus(s)}>{s ? s.replace('_', ' ') : 'All'}</Chip>)}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {isLoading && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-48" />)}
        {data?.map((v) => (
          <Card key={v.id} className="p-4">
            <div className="flex items-center gap-3">
              <Avatar src={v.photo} name={v.workerName} size={48} />
              <div className="flex-1"><b className="block">{v.workerName}</b><span className="text-sm text-ink-2">{v.category} · {timeAgo(v.submittedAt)}</span></div>
              <Status s={v.status} />
            </div>
            <p className="mt-3 text-sm"><span className="text-ink-2">Type:</span> <b>{vLabel[v.type]}</b></p>
            <div className="mt-2 flex flex-wrap gap-2">
              {v.documents.map((d) => <button key={d} onClick={() => toast('Opening signed document link (logged)', 'info')} className="rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-medium">📄 {d}</button>)}
            </div>
            {v.status === 'pending' && (
              <div className="mt-4 flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => patch.mutate({ id: v.id, status: 'approved' }, { onSuccess: () => toast('Approved — badge is live') })}>Approve</Button>
                <Button size="sm" variant="outline" onClick={() => setAct({ v, to: 'info_requested' })}>More info</Button>
                <Button size="sm" variant="outline" className="text-danger" onClick={() => setAct({ v, to: 'rejected' })}>Reject</Button>
              </div>
            )}
          </Card>
        ))}
      </div>
      {data?.length === 0 && <Card className="p-10 text-center text-ink-2">Nothing here 🎉</Card>}
      <ReasonSheet open={!!act} onClose={() => setAct(null)} title={act?.to === 'rejected' ? 'Reject verification' : 'Request more information'} cta="Submit" danger={act?.to === 'rejected'}
        onSubmit={(reason) => act && patch.mutate({ id: act.v.id, status: act.to, reason }, { onSuccess: () => toast('Updated') })} />
    </>
  );
}

function CategoriesPage() {
  const { data, isLoading } = useAdminList<T.Category[]>('categories', '/admin/categories');
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHead title="Categories & skills" action={<Button onClick={() => setOpen(true)}>+ Add category</Button>} />
      <DataTable loading={isLoading} rows={data}
        cols={[
          { key: 'name', label: 'Category', render: (c) => <span className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-lg bg-surface-3 text-ink-2"><CategoryIcon name={c.icon} size={18} /></span><b>{c.name}</b></span> },
          { key: 'hi', label: 'Hindi label', render: (c) => c.nameHi },
          { key: 'workers', label: 'Workers', render: (c) => num(c.workerCount) },
          { key: 'active', label: 'Active', render: () => <Toggle checked onChange={() => toast('Category status updated')} /> },
        ]}
      />
      <Sheet open={open} onClose={() => setOpen(false)} title="New category">
        <div className="space-y-3"><Input label="Name (English)" /><Input label="Name (Hindi)" /><Input label="Skills (comma separated)" />
          <Button block onClick={() => { setOpen(false); toast('Category created'); }}>Create</Button></div>
      </Sheet>
    </>
  );
}

function SubscriptionsPage() {
  const plans = useAdminList<T.Plan[]>('plans', '/admin/plans');
  const tx = useAdminList<T.Transaction[]>('transactions', '/admin/transactions');
  const patch = useAdminPatch<T.Plan>('plans', '/admin/plans');
  return (
    <>
      <PageHead title="Subscriptions" sub="Price changes apply to future purchases only" action={<Button variant="outline" size="sm"><Download size={16} />Export</Button>} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {plans.data?.map((p) => (
          <Card key={p.id} className="flex items-center gap-4 p-4">
            <div className="flex-1"><b className="block">{p.name}</b><span className="text-2xl font-extrabold">{inr(p.price)}</span><span className="text-sm text-ink-2">/{p.period}</span></div>
            <div className="text-right"><span className="mb-1 block text-xs text-ink-2">Enabled</span><Toggle checked={p.active} onChange={(v) => patch.mutate({ id: p.id, active: v })} /></div>
          </Card>
        ))}
      </div>
      <h2 className="mb-3 text-lg font-bold">Transactions</h2>
      <DataTable loading={tx.isLoading} rows={tx.data}
        cols={[
          { key: 'id', label: 'Txn', render: (t) => <span><b className="block">{t.userName}</b><span className="font-mono text-xs text-ink-2">{t.id}</span></span> },
          { key: 'plan', label: 'Plan', render: (t) => t.planName },
          { key: 'amt', label: 'Amount', render: (t) => <b>{inr(t.amount)}</b> },
          { key: 'ref', label: 'Gateway ref', render: (t) => <span className="font-mono text-xs">{t.gatewayRef}</span> },
          { key: 'date', label: 'Date', render: (t) => date(t.createdAt) },
          { key: 'status', label: 'Status', render: (t) => <Status s={t.status} /> },
        ]}
        actions={(t) => t.status === 'success' ? <Button size="sm" variant="ghost" onClick={() => toast('Refund initiated via gateway', 'info')}>Refund</Button> : null}
      />
    </>
  );
}

function ComplaintsPage() {
  const [status, setStatus] = useState<string>();
  const { data, isLoading } = useAdminList<T.AdminComplaint[]>('complaints', '/admin/complaints', { status });
  const patch = useAdminPatch<T.AdminComplaint>('complaints', '/admin/complaints');
  const [sel, setSel] = useState<T.AdminComplaint | null>(null);
  return (
    <>
      <PageHead title="Complaints" />
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {[undefined, 'open', 'in_progress', 'escalated', 'resolved'].map((s) => <Chip key={String(s)} active={status === s} onClick={() => setStatus(s)}>{s ? s.replace('_', ' ') : 'All'}</Chip>)}
      </div>
      <DataTable loading={isLoading} rows={data}
        cols={[
          { key: 'id', label: 'Complaint', render: (c) => <span><b className="block">#{c.id} · {c.category}</b><span className="line-clamp-1 text-xs text-ink-2">{c.description}</span></span> },
          { key: 'rep', label: 'Reporter', render: (c) => c.reporterName },
          { key: 'tgt', label: 'Against', render: (c) => c.targetName },
          { key: 'asg', label: 'Assigned', render: (c) => c.assignedTo ?? <span className="text-ink-3">—</span> },
          { key: 'at', label: 'Created', render: (c) => timeAgo(c.createdAt) },
          { key: 'st', label: 'Status', render: (c) => <Status s={c.status} /> },
        ]}
        actions={(c) => <Button size="sm" variant="soft" onClick={() => setSel(c)}>Manage</Button>}
      />
      <Sheet open={!!sel} onClose={() => setSel(null)} title={`#${sel?.id} · ${sel?.category}`}>
        {sel && <div className="space-y-3">
          <p className="text-sm text-ink-2">{sel.description}</p>
          <p className="text-sm"><b>Reporter:</b> {sel.reporterName} · <b>Against:</b> {sel.targetName}</p>
          <div className="flex flex-wrap gap-2">
            {(['in_progress', 'escalated', 'resolved'] as const).map((s) => <Chip key={s} active={sel.status === s} onClick={() => patch.mutate({ id: sel.id, status: s }, { onSuccess: () => { setSel({ ...sel, status: s }); toast('Status updated'); } })}>{s.replace('_', ' ')}</Chip>)}
          </div>
          <Textarea placeholder="Resolution note / internal comment" />
          <div className="flex gap-2"><Button variant="outline" block onClick={() => toast('Warning sent to user')}>Warn user</Button><Button variant="danger" block onClick={() => toast('Account restricted')}>Restrict account</Button></div>
        </div>}
      </Sheet>
    </>
  );
}

function ReviewsPage() {
  const { data, isLoading } = useAdminList<T.AdminReview[]>('reviews', '/admin/reviews');
  const patch = useAdminPatch<T.AdminReview>('reviews', '/admin/reviews');
  const [target, setTarget] = useState<T.AdminReview | null>(null);
  return (
    <>
      <PageHead title="Review moderation" />
      <DataTable loading={isLoading} rows={data}
        cols={[
          { key: 'r', label: 'Review', render: (r) => <span><b className="block">{'★'.repeat(r.stars)} <span className="font-normal text-ink-2">by {r.reviewerName}</span></b><span className="text-xs text-ink-2">{r.text}</span></span> },
          { key: 'w', label: 'Worker', render: (r) => r.workerName },
          { key: 'rep', label: 'Reports', render: (r) => (r.reports ? <Badge tone="danger">{r.reports}</Badge> : '0') },
          { key: 's', label: 'Status', render: (r) => <Status s={r.status} /> },
        ]}
        actions={(r) => r.status === 'visible'
          ? <Button size="sm" variant="outline" onClick={() => setTarget(r)}>Hide</Button>
          : <Button size="sm" variant="soft" onClick={() => patch.mutate({ id: r.id, status: 'visible' })}>Restore</Button>}
      />
      <ReasonSheet open={!!target} onClose={() => setTarget(null)} title="Hide review" cta="Hide review" danger
        onSubmit={(reason) => target && patch.mutate({ id: target.id, status: 'hidden', reason }, { onSuccess: () => toast('Review hidden') })} />
    </>
  );
}

function CmsPage() {
  const banners = useAdminList<T.Banner[]>('banners', '/admin/banners');
  const faqs = useAdminList<T.Faq[]>('faqs', '/admin/faqs');
  return (
    <>
      <PageHead title="Content management" sub="Banners, FAQs and policy pages" />
      <h2 className="mb-3 font-bold">Home banners</h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {banners.data?.map((b) => (
          <div key={b.id} className={cn('rounded-card bg-gradient-to-br p-4 text-white', b.tint)}>
            <b className="block">{b.title}</b><span className="text-sm text-white/85">{b.subtitle}</span>
            <div className="mt-3 flex gap-2"><button className="rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold">Edit</button><button className="rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold">Disable</button></div>
          </div>
        ))}
      </div>
      <h2 className="mb-3 font-bold">FAQs</h2>
      <Card className="mb-6 divide-y divide-line">{faqs.data?.map((f) => <div key={f.id} className="p-4"><b className="block text-sm">{f.q}</b><p className="text-sm text-ink-2">{f.a}</p></div>)}</Card>
      <h2 className="mb-3 font-bold">Legal pages</h2>
      <div className="grid gap-3 sm:grid-cols-2">{['Terms of Use', 'Privacy Policy', 'Subscription & Refund Policy', 'Community Guidelines'].map((p) => <Card key={p} className="flex items-center justify-between p-4"><b className="text-sm">{p}</b><Button size="sm" variant="soft">Edit</Button></Card>)}</div>
    </>
  );
}

function AuditPage() {
  const { data, isLoading } = useAdminList<T.AuditLog[]>('audit', '/admin/audit-logs');
  return (
    <>
      <PageHead title="Audit logs" sub="Immutable record of admin actions" />
      <DataTable loading={isLoading} rows={data}
        cols={[
          { key: 'a', label: 'Action', render: (l) => <span className="font-mono text-xs font-semibold text-primary">{l.action}</span> },
          { key: 'actor', label: 'Actor', render: (l) => l.actor },
          { key: 't', label: 'Target', render: (l) => l.target },
          { key: 'r', label: 'Reason', render: (l) => l.reason ?? <span className="text-ink-3">—</span> },
          { key: 'at', label: 'Time', render: (l) => timeAgo(l.at) },
        ]}
      />
    </>
  );
}

function StaffPage() {
  const { data, isLoading } = useAdminList<T.StaffMember[]>('staff', '/admin/staff');
  return (
    <>
      <PageHead title="Roles & staff" sub="Support staff can only access assigned complaints" action={<Button>+ Add staff</Button>} />
      <DataTable loading={isLoading} rows={data}
        cols={[
          { key: 'n', label: 'Member', render: (s) => <span className="flex items-center gap-2"><Avatar name={s.name} size={34} /><span><b className="block">{s.name}</b><span className="text-xs text-ink-2">{s.email}</span></span></span> },
          { key: 'r', label: 'Role', render: (s) => <Badge tone={s.role === 'super_admin' ? 'danger' : s.role === 'admin' ? 'primary' : 'neutral'}>{s.role.replace('_', ' ')}</Badge> },
          { key: 'm', label: 'MFA', render: (s) => (s.mfa ? <Badge tone="success">Enabled</Badge> : <Badge tone="warning">Off</Badge>) },
          { key: 'l', label: 'Last login', render: (s) => timeAgo(s.lastLoginAt) },
        ]}
      />
    </>
  );
}
