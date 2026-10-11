import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Check, Crown, Download, Gift, Info, Pencil, Plus, ReceiptIndianRupee, RotateCcw, Trash2, Users, Wallet } from 'lucide-react';
import { Skeleton } from '@/components/ui';
import { rowsOf, totalOf, useAdminPlans, useAdminSubscriptions, useAdminTransactions, useExport, useRefund, useSavePlan } from '@/api/admin';
import { useAuth } from '@/store';
import { cn, date, inr } from '@/lib/format';
import type { AdminPlan, AdminSubscriptionRow, AdminTransaction, PlanInput } from '@/types/admin';
import { clean, dateTime, human, isSuper, toneOf, useDebounced } from '../lib';
import {
  Btn, DataTable, DateRangeField, Drawer, EmptyBlock, ErrorBlock, Field, FilterChips, IconBtn, LoadMore, PageHeader, Pill, ReasonDialog,
  SearchField, Switch, Tabs, TextField, Toolbar, type Column,
} from '../components/kit';

type Tab = 'plans' | 'subscriptions' | 'transactions';

export function BillingPage() {
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get('tab') ?? 'plans') as Tab;
  return (
    <>
      <PageHeader
        eyebrow="Billing"
        title="Subscriptions & Transactions"
        sub="Zero commission on work — WorkNear only sells simple subscriptions. Renewal is always manual."
      />
      <Tabs
        className="mb-5"
        value={tab}
        onChange={(t) => setSp(t === 'plans' ? {} : { tab: t }, { replace: true })}
        items={[
          { value: 'plans', label: 'Plans', icon: <Crown size={15} /> },
          { value: 'subscriptions', label: 'Active subscriptions', icon: <Users size={15} /> },
          { value: 'transactions', label: 'Transactions', icon: <ReceiptIndianRupee size={15} /> },
        ]}
      />
      {tab === 'plans' && <PlansTab />}
      {tab === 'subscriptions' && <SubscriptionsTab />}
      {tab === 'transactions' && <TransactionsTab />}
    </>
  );
}

// ======================================================================
// Plans
// ======================================================================
function PlansTab() {
  const plans = useAdminPlans();
  const save = useSavePlan();
  const role = useAuth((s) => s.admin?.role);
  const [editing, setEditing] = useState<AdminPlan | 'new' | null>(null);

  if (plans.isError) return <ErrorBlock error={plans.error} onRetry={() => plans.refetch()} />;
  return (
    <>
      <p className="mb-4 flex items-start gap-2 rounded-2xl border border-primary/20 bg-primary-soft px-4 py-3 text-sm text-ink-2">
        <Info size={16} className="mt-0.5 shrink-0 text-primary" />
        Price and feature changes apply to <b className="text-ink">future purchases only</b> — existing subscribers keep what they paid for until their plan ends.
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.isPending
          ? [0, 1].map((i) => <Skeleton key={i} className="h-80 rounded-2xl" />)
          : plans.data.map((p) => (
            <article key={p.id} className={cn('relative flex flex-col overflow-hidden rounded-2xl border bg-surface p-5 transition', p.active ? 'border-line' : 'border-dashed border-line opacity-80')}>
              {p.badge && <span className="absolute top-4 right-4 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-amber-950">{p.badge}</span>}
              <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary"><Crown size={20} /></span>
              <p className="mt-4 text-lg font-bold text-ink">{p.name}</p>
              <p className="mt-1">
                <span className="text-[34px] leading-none font-extrabold tracking-tight text-ink tabular-nums">{inr(p.price)}</span>
                <span className="text-sm text-ink-3"> / {p.period}</span>
              </p>
              <ul className="mt-4 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-ink-2"><Check size={16} className="mt-0.5 shrink-0 text-success" />{f}</li>
                ))}
              </ul>
              <div className="mt-auto flex items-center gap-3 border-t border-line pt-4">
                <Switch checked={p.active} label={`${p.name} on sale`} disabled={save.isPending} onChange={(v) => save.mutate({ id: p.id, body: { active: v } })} />
                <span className={cn('text-sm font-semibold', p.active ? 'text-success' : 'text-ink-3')}>{p.active ? 'On sale' : 'Hidden'}</span>
                <Btn size="sm" className="ml-auto" icon={<Pencil size={14} />} onClick={() => setEditing(p)}>Edit</Btn>
              </div>
            </article>
          ))}
        {isSuper(role) && !plans.isPending && (
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line p-5 text-ink-2 transition hover:border-primary/50 hover:bg-primary-soft/40 hover:text-primary"
          >
            <span className="grid size-12 place-items-center rounded-2xl bg-surface-2"><Plus size={22} /></span>
            <span className="font-semibold">Create plan</span>
            <span className="text-xs text-ink-3">Super admin only</span>
          </button>
        )}
      </div>
      {editing && <PlanDrawer key={editing === 'new' ? 'new' : editing.id} plan={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function PlanDrawer({ plan, onClose }: { plan: AdminPlan | null; onClose: () => void }) {
  const save = useSavePlan();
  const [f, setF] = useState<PlanInput>(() => ({
    name: plan?.name ?? '',
    price: plan?.price ?? 30,
    period: plan?.period ?? 'month',
    features: plan?.features.length ? [...plan.features] : [''],
    badge: plan?.badge ?? '',
    active: plan?.active ?? true,
  }));
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof PlanInput>(k: K, v: PlanInput[K]) => setF((p) => ({ ...p, [k]: v }));

  const submit = () => {
    const features = f.features.map((x) => x.trim()).filter(Boolean);
    if (f.name.trim().length < 2) return setErr('Name must be at least 2 characters');
    if (!Number.isFinite(f.price) || f.price < 0) return setErr('Enter a valid price');
    if (!features.length) return setErr('Add at least one feature');
    setErr(null);
    save.mutate({ id: plan?.id, body: { ...f, name: f.name.trim(), badge: f.badge?.trim() ?? '', features } }, { onSuccess: onClose });
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={plan ? `Edit ${plan.name} plan` : 'Create plan'}
      sub="Applies to future purchases"
      footer={
        <>
          <Btn tone="ghost" onClick={onClose}>Cancel</Btn>
          <Btn tone="primary" loading={save.isPending} onClick={submit}>{plan ? 'Save plan' : 'Create plan'}</Btn>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Plan name" data-autofocus value={f.name} maxLength={40} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Monthly" />
          <TextField label="Badge (optional)" value={f.badge ?? ''} maxLength={30} onChange={(e) => set('badge', e.target.value)} placeholder="e.g. Save ₹60" />
          <TextField label="Price (₹)" type="number" inputMode="numeric" min={0} max={100000} value={Number.isFinite(f.price) ? f.price : ''} onChange={(e) => set('price', e.target.value === '' ? NaN : Number(e.target.value))} />
          <Field label="Billing period">
            <Tabs value={f.period} onChange={(v) => set('period', v)} className="w-full" items={[{ value: 'month', label: 'Monthly' }, { value: 'year', label: 'Yearly' }]} />
          </Field>
        </div>

        <Field label={`Features (${f.features.filter((x) => x.trim()).length}/12)`} hint="Shown as a checklist on the subscription screen.">
          <ul className="space-y-2">
            {f.features.map((feat, i) => (
              <li key={i} className="flex items-center gap-2">
                <Check size={16} className="shrink-0 text-success" />
                <input
                  value={feat}
                  maxLength={80}
                  aria-label={`Feature ${i + 1}`}
                  onChange={(e) => set('features', f.features.map((x, j) => (j === i ? e.target.value : x)))}
                  className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
                <IconBtn label={`Remove feature ${i + 1}`} disabled={f.features.length <= 1} onClick={() => set('features', f.features.filter((_, j) => j !== i))}><Trash2 size={15} /></IconBtn>
              </li>
            ))}
          </ul>
          {f.features.length < 12 && <Btn size="sm" tone="ghost" className="mt-2" icon={<Plus size={14} />} onClick={() => set('features', [...f.features, ''])}>Add feature</Btn>}
        </Field>

        <div className="flex items-center justify-between gap-4 rounded-2xl border border-line p-4">
          <div>
            <p className="text-sm font-semibold text-ink">On sale</p>
            <p className="text-xs text-ink-3">Hidden plans can't be bought; current subscribers are unaffected.</p>
          </div>
          <Switch checked={f.active} onChange={(v) => set('active', v)} label="Plan on sale" />
        </div>
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        <button type="submit" hidden />
      </form>
    </Drawer>
  );
}

// ======================================================================
// Subscriptions
// ======================================================================
function SubscriptionsTab() {
  const [status, setStatus] = useState<'active' | 'pending' | 'expired'>('active');
  const list = useAdminSubscriptions({ status });
  const rows = rowsOf(list.data);
  const daysLeft = (iso?: string) => (iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000) : null);
  const columns: Column<AdminSubscriptionRow>[] = [
    {
      key: 'user',
      header: 'User',
      mobile: 'title',
      cell: (s) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{s.userName}</p>
          <p className="text-xs text-ink-3 tabular-nums">{s.mobile ?? '—'}</p>
        </div>
      ),
    },
    { key: 'plan', header: 'Plan', cell: (s) => <span className="inline-flex items-center gap-1.5 font-semibold capitalize"><Crown size={14} className="text-accent" />{s.plan}</span> },
    { key: 'status', header: 'Status', cell: (s) => <Pill tone={toneOf('subscription', s.status)}>{human(s.status)}</Pill> },
    { key: 'start', header: 'Started', cell: (s) => <span className="whitespace-nowrap text-ink-2">{s.startAt ? date(s.startAt) : '—'}</span> },
    {
      key: 'end',
      header: 'Ends',
      cell: (s) => {
        const d = daysLeft(s.endAt);
        return (
          <span className="whitespace-nowrap text-ink-2">
            {s.endAt ? date(s.endAt) : '—'}
            {d !== null && d >= 0 && s.status === 'active' && <span className={cn('ml-1.5 text-xs font-semibold', d <= 3 ? 'text-warning' : 'text-ink-3')}>({d}d left)</span>}
          </span>
        );
      },
    },
    { key: 'source', header: 'Source', cell: (s) => (s.source === 'admin_grant' ? <Pill tone="primary" dot={false}><Gift size={12} /> Granted</Pill> : <Pill dot={false}>Payment</Pill>) },
  ];
  return (
    <>
      <Toolbar>
        <FilterChips
          label="Subscription status"
          value={status}
          onChange={setStatus}
          options={[{ value: 'active', label: 'Active' }, { value: 'pending', label: 'Pending' }, { value: 'expired', label: 'Expired' }]}
        />
      </Toolbar>
      {list.isError ? (
        <ErrorBlock error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <>
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(s) => s.id}
            loading={list.isPending}
            dim={list.isPlaceholderData}
            empty={<EmptyBlock icon={<Wallet size={26} />} title={`No ${status} subscriptions`} sub="Paid and admin-granted plans appear here." />}
          />
          <LoadMore shown={rows.length} total={totalOf(list.data)} hasMore={!!list.hasNextPage} loading={list.isFetchingNextPage} onMore={() => list.fetchNextPage()} noun="subscriptions" />
        </>
      )}
    </>
  );
}

// ======================================================================
// Transactions
// ======================================================================
type TxnFilter = 'all' | 'success' | 'pending' | 'failed' | 'refunded';

function TransactionsTab() {
  const role = useAuth((s) => s.admin?.role);
  const [status, setStatus] = useState<TxnFilter>('all');
  const [q, setQ] = useState('');
  const [range, setRange] = useState<{ from?: string; to?: string }>({});
  const dq = useDebounced(q.trim(), 350);
  const list = useAdminTransactions(clean({ status, q: dq, from: range.from, to: range.to }));
  const rows = rowsOf(list.data);
  const exp = useExport();
  const refund = useRefund();
  const [target, setTarget] = useState<AdminTransaction | null>(null);

  const columns: Column<AdminTransaction>[] = [
    {
      key: 'order',
      header: 'Order',
      mobile: 'title',
      cell: (t) => (
        <div className="min-w-0">
          <p className="truncate font-mono text-xs font-semibold text-ink">{t.orderId}</p>
          {t.gatewayRef !== t.orderId && <p className="truncate font-mono text-[11px] text-ink-3">{t.gatewayRef}</p>}
          {t.refundId && <p className="truncate font-mono text-[11px] text-ink-3">Refund {t.refundId}</p>}
        </div>
      ),
    },
    { key: 'user', header: 'User', cell: (t) => <span className="font-medium text-ink">{t.userName}</span> },
    { key: 'plan', header: 'Plan', cell: (t) => <span className="text-ink-2">{t.planName}</span> },
    { key: 'amount', header: 'Amount', align: 'right', cell: (t) => <b className={cn('tabular-nums', t.status === 'refunded' && 'text-ink-3 line-through')}>{inr(t.amount)}</b> },
    { key: 'status', header: 'Status', cell: (t) => <Pill tone={toneOf('txn', t.status)}>{human(t.status)}</Pill> },
    { key: 'gateway', header: 'Gateway', cell: (t) => <span className="text-xs font-semibold text-ink-2 capitalize">{t.gateway}</span> },
    { key: 'date', header: 'Date', cell: (t) => <span className="whitespace-nowrap text-ink-2">{dateTime(t.createdAt)}</span> },
    ...(isSuper(role)
      ? [{
        key: 'actions',
        header: <span className="sr-only">Actions</span>,
        align: 'right' as const,
        cell: (t: AdminTransaction) =>
          t.status === 'success' ? (
            <Btn size="sm" tone="dangerGhost" icon={<RotateCcw size={14} />} onClick={() => setTarget(t)}>Refund</Btn>
          ) : null,
      }]
      : []),
  ];

  return (
    <>
      <Toolbar>
        <SearchField value={q} onChange={setQ} placeholder="Search order id…" label="Search by order id" />
        <FilterChips
          label="Payment status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'All' },
            { value: 'success', label: 'Success' },
            { value: 'pending', label: 'Pending' },
            { value: 'failed', label: 'Failed' },
            { value: 'refunded', label: 'Refunded' },
          ]}
        />
        <div className="flex flex-col gap-3 sm:flex-row lg:ml-auto">
          <DateRangeField from={range.from} to={range.to} onChange={setRange} />
          <Btn icon={<Download size={16} />} loading={exp.isPending} onClick={() => exp.mutate({ type: 'transactions', ...range })}>Export CSV</Btn>
        </div>
      </Toolbar>
      {list.isError ? (
        <ErrorBlock error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <>
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(t) => t.id}
            loading={list.isPending}
            dim={list.isPlaceholderData}
            empty={<EmptyBlock icon={<ReceiptIndianRupee size={26} />} title="No transactions" sub="Payments appear here as soon as a checkout starts." />}
          />
          <LoadMore shown={rows.length} total={totalOf(list.data)} hasMore={!!list.hasNextPage} loading={list.isFetchingNextPage} onMore={() => list.fetchNextPage()} noun="transactions" />
        </>
      )}
      <ReasonDialog
        open={!!target}
        onClose={() => setTarget(null)}
        title={target ? `Refund ${inr(target.amount)}?` : 'Refund'}
        description={
          target && (
            <span>
              Order <span className="font-mono text-xs">{target.orderId}</span> · {target.userName} · {target.planName}. The money goes back via the gateway in 5–7 working days and
              <b className="text-ink"> the user's paid plan ends immediately</b>.
            </span>
          )
        }
        confirmLabel="Refund payment"
        tone="danger"
        presets={['Duplicate payment', 'Customer request', 'Service issue']}
        loading={refund.isPending}
        onConfirm={(reason) => target && refund.mutate({ id: target.id, reason }, { onSuccess: () => setTarget(null) })}
      />
    </>
  );
}
