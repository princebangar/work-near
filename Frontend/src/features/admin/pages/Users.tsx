import { useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Ban, Crown, Download, EyeOff, Eye, Gift, MessageSquareWarning, ShieldCheck, Star, Trash2, UserCheck, UserRound, Users } from 'lucide-react';
import { Avatar, Skeleton } from '@/components/ui';
import {
  rowsOf, totalOf, useAdminBadges, useAdminCategories, useAdminPlans, useAdminUser, useAdminUsers, useExport, useGrantSubscription,
  useRestrictWorker, useSetUserStatus,
} from '@/api/admin';
import { useAuth } from '@/store';
import { mediaUrl } from '@/lib/media';
import { cn, date, inr, num, timeAgo } from '@/lib/format';
import type { AdminUserDetail, AdminUserRow } from '@/types/admin';
import { USER_STATUS_LABEL, VERIFICATION_TYPE_LABEL, clean, dateTime, human, isSuper, toneOf, useDebounced } from '../lib';
import {
  Btn, ConfirmDialog, DataTable, DateRangeField, Dialog, Drawer, EmptyBlock, ErrorBlock, FilterChips, KeyVals, LoadMore, MicroLabel, PageHeader,
  Pill, ReasonDialog, SearchField, SelectField, TextAreaField, Toolbar, type Column,
} from '../components/kit';

type StatusFilter = 'all' | 'active' | 'suspended' | 'deleted_request';

export function UsersPage() {
  const [sp, setSp] = useSearchParams();
  const status = (sp.get('status') ?? 'all') as StatusFilter;
  const role = sp.get('role') ?? 'all';
  const from = sp.get('from') ?? undefined;
  const to = sp.get('to') ?? undefined;
  const openId = sp.get('user');
  const [q, setQ] = useState(sp.get('q') ?? '');
  const dq = useDebounced(q.trim(), 350);
  const { data: badges } = useAdminBadges();
  const exp = useExport();

  const set = (patch: Record<string, string | undefined>) =>
    setSp(
      (prev) => {
        const n = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) (v && v !== 'all' ? n.set(k, v) : n.delete(k));
        return n;
      },
      { replace: true },
    );

  const params = clean({ q: dq, status, role, from, to });
  const list = useAdminUsers(params);
  const rows = rowsOf(list.data);
  const total = totalOf(list.data);

  const columns: Column<AdminUserRow>[] = [
    {
      key: 'user',
      header: 'User',
      mobile: 'title',
      cell: (u) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={u.name} src={mediaUrl(u.avatar)} size={36} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{u.name}</p>
            <p className="text-xs text-ink-3 tabular-nums">{u.mobile}</p>
          </div>
          <span className="ml-auto md:hidden"><Pill tone={toneOf('user', u.status)}>{USER_STATUS_LABEL[u.status]}</Pill></span>
        </div>
      ),
    },
    {
      key: 'roles',
      header: 'Roles',
      cell: (u) => (
        <div className="flex flex-wrap gap-1">
          {u.roles.map((r) => (
            <span key={r} className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-semibold capitalize', r === u.activeRole ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-ink-2')}>{r}</span>
          ))}
        </div>
      ),
    },
    { key: 'city', header: 'City', cell: (u) => <span className="text-ink-2">{u.city || '—'}</span> },
    { key: 'status', header: 'Status', mobile: 'hide', cell: (u) => <Pill tone={toneOf('user', u.status)}>{USER_STATUS_LABEL[u.status]}</Pill> },
    {
      key: 'reports',
      header: 'Reports',
      cell: (u) => (u.reports ? <span className="inline-flex items-center gap-1 font-semibold text-danger"><MessageSquareWarning size={14} />{u.reports}</span> : <span className="text-ink-3">0</span>),
    },
    { key: 'joined', header: 'Joined', cell: (u) => <span className="whitespace-nowrap text-ink-2">{date(u.joinedAt)}</span> },
    { key: 'active', header: 'Last active', cell: (u) => <span className="whitespace-nowrap text-ink-2">{u.lastActiveAt ? timeAgo(u.lastActiveAt) : '—'}</span> },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Users & workers"
        title="Users"
        sub="Everyone with a WorkNear account. Open a user to suspend, restrict a worker profile, grant a plan or process a deletion request."
        actions={
          <Btn icon={<Download size={16} />} loading={exp.isPending} onClick={() => exp.mutate({ type: 'users', from, to })}>
            Export CSV
          </Btn>
        }
      />

      <Toolbar>
        <SearchField value={q} onChange={setQ} placeholder="Search name or mobile…" label="Search users" />
        <FilterChips
          label="Status"
          value={status}
          onChange={(v) => set({ status: v })}
          options={[
            { value: 'all', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'suspended', label: 'Suspended' },
            { value: 'deleted_request', label: 'Deletion requests', count: badges?.users },
          ]}
        />
        <div className="flex flex-col gap-3 sm:flex-row lg:ml-auto">
          <SelectField
            aria-label="Role"
            value={role}
            onChange={(e) => set({ role: e.target.value })}
            className="sm:w-40"
            options={[{ value: 'all', label: 'All roles' }, { value: 'customer', label: 'Customers' }, { value: 'worker', label: 'Workers' }]}
          />
          <DateRangeField from={from} to={to} onChange={(r) => set({ from: r.from, to: r.to })} />
        </div>
      </Toolbar>

      {list.isError ? (
        <ErrorBlock error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <>
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(u) => u.id}
            loading={list.isPending}
            dim={list.isPlaceholderData}
            onRowClick={(u) => set({ user: u.id })}
            rowLabel={(u) => `Open ${u.name}`}
            empty={<EmptyBlock icon={<Users size={26} />} title="No users match" sub="Try a different search, status or date range." />}
          />
          <LoadMore shown={rows.length} total={total} hasMore={!!list.hasNextPage} loading={list.isFetchingNextPage} onMore={() => list.fetchNextPage()} noun="users" />
        </>
      )}

      <UserDrawer id={openId} onClose={() => set({ user: undefined })} />
    </>
  );
}

// ======================================================================
// Detail drawer
// ======================================================================
type Pending = null | 'suspend' | 'reinstate' | 'delete' | 'restrict' | 'unrestrict' | 'grant';

function UserDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const q = useAdminUser(id);
  const u = q.data;
  const [pending, setPending] = useState<Pending>(null);
  const role = useAuth((s) => s.admin?.role);
  const setStatus = useSetUserStatus();
  const restrict = useRestrictWorker();
  const done = () => setPending(null);

  const footer = u && u.status !== 'deleted' && (
    <>
      {u.status === 'active' && <Btn tone="danger" icon={<Ban size={16} />} onClick={() => setPending('suspend')}>Suspend</Btn>}
      {u.status === 'suspended' && <Btn tone="primary" icon={<UserCheck size={16} />} onClick={() => setPending('reinstate')}>Reinstate</Btn>}
      {u.status === 'deleted_request' && (
        <>
          <Btn tone="outline" icon={<UserCheck size={16} />} onClick={() => setPending('reinstate')}>Keep account</Btn>
          <Btn tone="danger" icon={<Trash2 size={16} />} onClick={() => setPending('delete')}>Process deletion</Btn>
        </>
      )}
    </>
  );

  return (
    <Drawer
      open={!!id}
      onClose={onClose}
      wide
      title={u ? u.name || 'Unnamed user' : 'User'}
      sub={u ? <span className="tabular-nums">{u.mobile}</span> : q.isPending ? 'Loading…' : undefined}
      icon={u ? <Avatar name={u.name || '?'} src={mediaUrl(u.avatar)} size={44} /> : <span className="grid size-11 place-items-center rounded-full bg-surface-2 text-ink-3"><UserRound size={20} /></span>}
      footer={footer || undefined}
    >
      {q.isPending ? (
        <div className="space-y-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : q.isError ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} />
      ) : u ? (
        <UserDetail u={u} canGrant={isSuper(role)} onAction={setPending} />
      ) : null}

      {u && (
        <>
          <ReasonDialog
            open={pending === 'suspend'}
            onClose={done}
            title={`Suspend ${u.name}?`}
            description="They are signed out immediately, can't use the app, and their worker profile is hidden from search."
            confirmLabel="Suspend user"
            tone="danger"
            presets={['Fake / spam account', 'Abusive behaviour', 'Fraud reported', 'Repeated complaints']}
            loading={setStatus.isPending}
            onConfirm={(reason) => setStatus.mutate({ id: u.id, status: 'suspended', reason, prev: u.status }, { onSuccess: done })}
          />
          <ConfirmDialog
            open={pending === 'reinstate'}
            onClose={done}
            title={u.status === 'deleted_request' ? 'Keep this account?' : `Reinstate ${u.name}?`}
            description={u.status === 'deleted_request' ? 'The deletion request is cancelled and the account stays active.' : 'They can sign in again and their worker profile becomes visible.'}
            confirmLabel={u.status === 'deleted_request' ? 'Keep account' : 'Reinstate'}
            loading={setStatus.isPending}
            onConfirm={() => setStatus.mutate({ id: u.id, status: 'active', prev: u.status }, { onSuccess: done })}
          />
          <ReasonDialog
            open={pending === 'delete'}
            onClose={done}
            title="Process deletion request?"
            description={
              <span>
                This permanently <b className="text-ink">anonymises</b> the account: name, email, photo, worker profile, portfolio and devices are removed.
                Chats stay for the other party. This cannot be undone.
              </span>
            }
            confirmLabel="Delete permanently"
            tone="danger"
            presets={['User requested deletion']}
            loading={setStatus.isPending}
            onConfirm={(reason) => setStatus.mutate({ id: u.id, status: 'deleted', reason, prev: u.status }, { onSuccess: done })}
          />
          <ReasonDialog
            open={pending === 'restrict' || pending === 'unrestrict'}
            onClose={done}
            title={pending === 'restrict' ? 'Hide worker profile?' : 'Make worker profile visible?'}
            description={pending === 'restrict' ? 'The profile disappears from search. The worker is notified with your reason.' : 'Customers can find this worker in search again.'}
            confirmLabel={pending === 'restrict' ? 'Restrict profile' : 'Unrestrict'}
            tone={pending === 'restrict' ? 'danger' : 'primary'}
            presets={pending === 'restrict' ? ['Misleading profile', 'Inappropriate photos', 'Under investigation'] : ['Issue resolved']}
            loading={restrict.isPending}
            onConfirm={(reason) => restrict.mutate({ userId: u.id, restricted: pending === 'restrict', reason }, { onSuccess: done })}
          />
          <GrantDialog open={pending === 'grant'} onClose={done} userId={u.id} name={u.name} />
        </>
      )}
    </Drawer>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <MicroLabel>{title}</MicroLabel>
        {action}
      </div>
      {children}
    </section>
  );
}

function UserDetail({ u, canGrant, onAction }: { u: AdminUserDetail; canGrant: boolean; onAction: (p: Pending) => void }) {
  const cats = useAdminCategories(!!u.worker);
  const catName = useMemo(() => new Map(cats.data?.map((c) => [c.id, c.name])), [cats.data]);
  const w = u.worker;
  const s = u.subscription;
  const live = u.status !== 'deleted';
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={toneOf('user', u.status)}>{USER_STATUS_LABEL[u.status]}</Pill>
        {u.roles.map((r) => <Pill key={r} tone="neutral" dot={false} className="capitalize">{r}</Pill>)}
        {w?.restricted && <Pill tone="danger" dot={false}><EyeOff size={12} /> Profile restricted</Pill>}
      </div>

      {u.status === 'suspended' && (
        <Notice tone="danger" title="Account suspended">{u.statusReason ? `Reason: ${u.statusReason}` : 'No reason recorded.'}</Notice>
      )}
      {u.status === 'deleted_request' && (
        <Notice tone="warning" title="Deletion requested">
          Requested {u.deletionRequestedAt ? dateTime(u.deletionRequestedAt) : 'recently'}. Signing in again cancels it automatically.
        </Notice>
      )}

      <Section title="Profile">
        <KeyVals
          items={[
            { label: 'Mobile', value: <span className="tabular-nums">{u.mobile}</span> },
            { label: 'Email', value: u.email || '—' },
            { label: 'City', value: u.city || '—' },
            { label: 'Language', value: u.language === 'hi' ? 'Hindi' : 'English' },
            { label: 'Joined', value: u.joinedAt ? dateTime(u.joinedAt) : '—' },
            { label: 'Last login', value: u.lastLoginAt ? dateTime(u.lastLoginAt) : '—' },
            { label: 'Last active', value: u.lastActiveAt ? timeAgo(u.lastActiveAt) : '—' },
            { label: 'Conversations', value: num(u.conversations) },
            { label: 'Complaints filed', value: num(u.complaintsFiled) },
            { label: 'Consent version', value: u.consentVersion || '—' },
          ]}
        />
      </Section>

      {w && (
        <Section
          title="Worker profile"
          action={
            live && (
              <Btn size="sm" tone={w.restricted ? 'soft' : 'outline'} icon={w.restricted ? <Eye size={14} /> : <EyeOff size={14} />} onClick={() => onAction(w.restricted ? 'unrestrict' : 'restrict')}>
                {w.restricted ? 'Unrestrict' : 'Restrict'}
              </Btn>
            )
          }
        >
          <KeyVals
            items={[
              { label: 'Display name', value: w.displayName },
              { label: 'Category', value: catName.get(w.category) ?? w.category },
              { label: 'Locality', value: w.locality || '—' },
              { label: 'Rating', value: <span className="inline-flex items-center gap-1"><Star size={13} className="fill-accent text-accent" />{w.rating.toFixed(1)} <span className="text-ink-3">({w.reviewCount})</span></span> },
              { label: 'Profile views', value: num(w.profileViews) },
              { label: 'Visibility', value: w.restricted ? <Pill tone="danger">Restricted by admin</Pill> : w.visible ? <Pill tone="success">Visible</Pill> : <Pill>Paused by worker</Pill> },
              {
                label: 'Verification',
                value: (
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    {w.verification && <span className="inline-flex items-center gap-1 font-semibold text-primary"><ShieldCheck size={14} />{VERIFICATION_TYPE_LABEL[w.verification]}</span>}
                    <Pill tone={toneOf('verification', w.verificationStatus)}>{human(w.verificationStatus)}</Pill>
                  </span>
                ),
                wide: true,
              },
            ]}
          />
        </Section>
      )}

      <Section
        title="Subscription"
        action={canGrant && live && <Btn size="sm" tone="soft" icon={<Gift size={14} />} onClick={() => onAction('grant')}>Grant plan</Btn>}
      >
        {s ? (
          <KeyVals
            items={[
              { label: 'Plan', value: <span className="inline-flex items-center gap-1.5 font-semibold capitalize"><Crown size={14} className="text-accent" />{s.plan}</span> },
              { label: 'Status', value: <Pill tone={toneOf('subscription', s.status)}>{human(s.status)}</Pill> },
              { label: 'Valid till', value: s.endAt ? date(s.endAt) : '—' },
              { label: 'Source', value: s.source === 'admin_grant' ? 'Granted by admin' : 'Payment' },
            ]}
          />
        ) : (
          <p className="text-sm text-ink-3">No subscription.</p>
        )}
      </Section>

      <Section title={`Complaints against (${u.complaintsAgainst.length})`}>
        {u.complaintsAgainst.length ? (
          <ul className="divide-y divide-line">
            {u.complaintsAgainst.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5 text-sm">
                <Link to={`/admin/complaints?q=${encodeURIComponent(c.id)}`} className="font-mono text-xs font-bold text-primary hover:underline">#{c.id}</Link>
                <span className="min-w-0 flex-1 truncate text-ink">{c.category}</span>
                <Pill tone={toneOf('complaint', c.status)}>{human(c.status)}</Pill>
                <span className="hidden w-24 text-right text-xs text-ink-3 sm:block">{c.createdAt ? date(c.createdAt) : ''}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-3">No complaints against this user.</p>
        )}
      </Section>

      <Section title={`Payments (${u.payments.length})`}>
        {u.payments.length ? (
          <ul className="divide-y divide-line">
            {u.payments.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{p.planName ?? 'Plan'}</p>
                  <p className="truncate font-mono text-[11px] text-ink-3">{p.id}</p>
                </div>
                <b className="tabular-nums">{inr(p.amount)}</b>
                <Pill tone={toneOf('txn', p.status)}>{human(p.status)}</Pill>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-3">No payments yet.</p>
        )}
      </Section>
    </div>
  );
}

function Notice({ tone, title, children }: { tone: 'danger' | 'warning'; title: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-2xl border px-4 py-3', tone === 'danger' ? 'border-danger/25 bg-danger-soft' : 'border-warning/25 bg-warning-soft')}>
      <p className={cn('text-sm font-bold', tone === 'danger' ? 'text-danger' : 'text-warning')}>{title}</p>
      <p className="mt-0.5 text-sm text-ink-2">{children}</p>
    </div>
  );
}

function GrantDialog({ open, onClose, userId, name }: { open: boolean; onClose: () => void; userId: string; name: string }) {
  const plans = useAdminPlans(open);
  const grant = useGrantSubscription();
  const [planId, setPlanId] = useState('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const options = (plans.data ?? []).filter((p) => p.active);
  const chosen = planId || options[0]?.id || '';
  const submit = () => {
    if (!chosen) return setErr('Choose a plan');
    if (reason.trim().length < 3) return setErr('Please add a reason (at least 3 characters)');
    grant.mutate({ userId, planId: chosen, reason: reason.trim() }, { onSuccess: () => { setReason(''); setErr(null); onClose(); } });
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Grant a plan to ${name}`}
      description="Activates immediately without payment and notifies the user. Recorded in the audit log."
      footer={
        <>
          <Btn tone="ghost" onClick={onClose}>Cancel</Btn>
          <Btn tone="primary" icon={<Gift size={16} />} loading={grant.isPending} onClick={submit}>Grant plan</Btn>
        </>
      }
    >
      <div className="space-y-3">
        {plans.isPending ? (
          <Skeleton className="h-10" />
        ) : (
          <SelectField
            label="Plan"
            value={chosen}
            onChange={(e) => setPlanId(e.target.value)}
            options={options.map((p) => ({ value: p.id, label: `${p.name} · ${inr(p.price)} / ${p.period}` }))}
          />
        )}
        <TextAreaField label="Reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Compensation for payment issue" />
        {err && <p className="text-sm text-danger">{err}</p>}
      </div>
    </Dialog>
  );
}

