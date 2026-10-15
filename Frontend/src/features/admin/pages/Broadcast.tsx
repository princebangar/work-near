import { useEffect, useMemo, useState } from 'react';
import { BellRing, Check, History, Megaphone, Search, Send, Smartphone, Trash2, Users } from 'lucide-react';
import { Avatar, Skeleton } from '@/components/ui';
import { rowsOf, totalOf, useBroadcastCounts, useBroadcastRecipients, useBroadcasts, useDeleteBroadcast, useSendBroadcast } from '@/api/admin';
import { useAuth } from '@/store';
import { mediaUrl } from '@/lib/media';
import { cn, num } from '@/lib/format';
import type { BroadcastAudience, BroadcastInput, BroadcastKind, BroadcastRecipient, BroadcastRow } from '@/types/admin';
import { canAdmin, dateTime, useDebounced } from '../lib';
import { Btn, ConfirmDialog, DataTable, Drawer, EmptyBlock, ErrorBlock, LoadMore, PageHeader, Panel, Pill, SelectField, TextAreaField, TextField, type Column } from '../components/kit';

const AUDIENCES: { value: BroadcastAudience; label: string }[] = [
  { value: 'all', label: 'Everyone (customers + workers)' },
  { value: 'customers', label: 'All customers' },
  { value: 'workers', label: 'All workers' },
  { value: 'custom', label: 'Selected people' },
];
const AUDIENCE_SHORT: Record<BroadcastAudience, string> = { all: 'Everyone', customers: 'Customers', workers: 'Workers', custom: 'Selected' };
const KINDS: { value: BroadcastKind; label: string; hint: string }[] = [
  { value: 'announcement', label: 'Announcement', hint: 'Important updates — reaches everyone in the audience.' },
  { value: 'offer', label: 'Offer / promotion', hint: 'Only users who turned on “Offers” in notification settings receive it.' },
];
type PickTab = 'all' | 'customers' | 'workers';

const EMPTY: BroadcastInput = { title: '', body: '', link: '', kind: 'announcement', audience: 'all', targetIds: [] };

export function BroadcastPage() {
  const admin = useAuth((s) => s.admin);
  const canSend = canAdmin(admin?.role, admin?.permissions, 'broadcast', 'create');
  const canDelete = canAdmin(admin?.role, admin?.permissions, 'broadcast', 'delete');
  const counts = useBroadcastCounts();
  const history = useBroadcasts();
  const send = useSendBroadcast();
  const [f, setF] = useState<BroadcastInput>(EMPTY);
  const [picked, setPicked] = useState<Map<string, BroadcastRecipient>>(new Map());
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const set = <K extends keyof BroadcastInput>(k: K, v: BroadcastInput[K]) => setF((p) => ({ ...p, [k]: v }));

  const reach = f.audience === 'custom' ? picked.size : counts.data?.[f.audience] ?? 0;
  const historyRows = rowsOf(history.data);

  // While a broadcast is still being delivered, refresh its progress every few seconds (stops when done).
  const sending = historyRows.some((b) => b.status === 'sending');
  useEffect(() => {
    if (!sending) return;
    const id = setInterval(() => void history.refetch(), 3000);
    return () => clearInterval(id);
  }, [sending, history]);

  const validate = () => {
    if (f.title.trim().length < 3) return 'Title must be at least 3 characters';
    if (f.body.trim().length < 5) return 'Message must be at least 5 characters';
    if (f.link.trim() && !/^\/(?!\/)/.test(f.link.trim())) return 'Link must be an in-app path, e.g. /subscription';
    if (f.audience === 'custom' && !picked.size) return 'Select at least one person';
    return null;
  };
  const review = () => {
    const e = validate();
    setErr(e);
    if (!e) setConfirm(true);
  };
  const doSend = () =>
    send.mutate(
      { ...f, title: f.title.trim(), body: f.body.trim(), link: f.link.trim(), targetIds: f.audience === 'custom' ? [...picked.keys()] : [] },
      { onSuccess: () => { setConfirm(false); setF(EMPTY); setPicked(new Map()); } },
    );

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Broadcast notification"
        sub="Send one message to everyone, all customers, all workers, or selected people. It lands in their in-app inbox and as a push notification."
        actions={
          <Btn tone="primary" icon={<History size={16} />} onClick={() => setShowHistory(true)}>
            View history
            <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-extrabold">{history.isPending ? '…' : num(totalOf(history.data))}</span>
          </Btn>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel icon={<span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary"><BellRing size={20} /></span>} title="Compose" sub="Keep it short — push notifications show about 2 lines.">
          <form onSubmit={(e) => { e.preventDefault(); review(); }} className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <TextField label="Title" maxLength={80} value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Enter notification title" hint={`${f.title.length}/80`} />
              <SelectField label="Target type" value={f.audience} onChange={(e) => set('audience', e.target.value as BroadcastAudience)}
                options={AUDIENCES.map((a) => ({ value: a.value, label: a.value === 'custom' || !counts.data ? a.label : `${a.label} · ${num(counts.data[a.value])}` }))} />
            </div>
            <TextAreaField label="Message" rows={4} maxLength={500} value={f.body} onChange={(e) => set('body', e.target.value)} placeholder="Enter notification message" hint={`${f.body.length}/500`} />
            <div className="grid gap-4 lg:grid-cols-2">
              <SelectField label="Type" value={f.kind} onChange={(e) => set('kind', e.target.value as BroadcastKind)} hint={KINDS.find((k) => k.value === f.kind)?.hint}
                options={KINDS.map((k) => ({ value: k.value, label: k.label }))} />
              <TextField label="Open page on tap (optional)" maxLength={120} value={f.link} onChange={(e) => set('link', e.target.value)} placeholder="/subscription" hint="In-app path. Empty = opens Notifications." />
            </div>

            {f.audience === 'custom' && <RecipientPicker picked={picked} onChange={setPicked} counts={counts.data} />}

            {err && <p role="alert" className="text-sm text-danger">{err}</p>}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
              <span className="text-sm text-ink-2"><Users size={15} className="mr-1 inline" />Reaches up to <b className="text-ink">{num(reach)}</b> {reach === 1 ? 'person' : 'people'}</span>
              <Btn type="submit" tone="primary" icon={<Send size={16} />} disabled={!canSend} title={canSend ? undefined : 'You need Broadcast → Create permission'}>Send broadcast</Btn>
            </div>
          </form>
        </Panel>

        <Panel icon={<span className="grid size-10 place-items-center rounded-xl bg-surface-2 text-ink-2"><Smartphone size={20} /></span>} title="Preview" sub="How it appears on a phone">
          <div className="rounded-2xl bg-surface-2 p-3">
            <div className="flex items-start gap-3 rounded-xl bg-surface p-3 shadow-sm ring-1 ring-line">
              <img src="/favicon.webp" alt="" className="size-9 rounded-lg" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center justify-between gap-2 text-[11px] text-ink-3"><span className="font-semibold">WorkNear</span><span>now</span></p>
                <p className="truncate text-sm font-bold text-ink">{f.title.trim() || 'Notification title'}</p>
                <p className="line-clamp-2 text-xs text-ink-2">{f.body.trim() || 'Your message appears here.'}</p>
              </div>
            </div>
          </div>
          <ul className="mt-4 space-y-2 text-xs text-ink-2">
            <li className="flex gap-2"><Check size={14} className="mt-0.5 shrink-0 text-success" /> Saved in every recipient’s in-app inbox (works even without push).</li>
            <li className="flex gap-2"><Check size={14} className="mt-0.5 shrink-0 text-success" /> Push goes to devices that allowed notifications.</li>
            <li className="flex gap-2"><Check size={14} className="mt-0.5 shrink-0 text-success" /> Suspended and deleted accounts are skipped.</li>
          </ul>
        </Panel>
      </div>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Send this broadcast?"
        description={<>“<b className="text-ink">{f.title.trim()}</b>” goes to <b className="text-ink">{f.audience === 'custom' ? `${num(picked.size)} selected people` : `${AUDIENCE_SHORT[f.audience].toLowerCase()} (${num(reach)})`}</b>. It can’t be unsent from phones once delivered.</>}
        confirmLabel="Send now"
        loading={send.isPending}
        icon={<Megaphone size={20} />}
        onConfirm={doSend}
      />
      {showHistory && <HistoryDrawer rows={historyRows} query={history} canDelete={canDelete} onClose={() => setShowHistory(false)} />}
    </>
  );
}

function RecipientPicker({ picked, onChange, counts }: { picked: Map<string, BroadcastRecipient>; onChange: (m: Map<string, BroadcastRecipient>) => void; counts?: { all: number; customers: number; workers: number } }) {
  const [tab, setTab] = useState<PickTab>('all');
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim());
  const list = useBroadcastRecipients(useMemo(() => ({ role: tab, ...(dq && { q: dq }) }), [tab, dq]), true);
  const rows = rowsOf(list.data);
  const toggle = (r: BroadcastRecipient) => {
    const m = new Map(picked);
    if (m.has(r.id)) m.delete(r.id);
    else m.set(r.id, r);
    onChange(m);
  };
  const selectShown = (on: boolean) => {
    const m = new Map(picked);
    rows.forEach((r) => (on ? m.set(r.id, r) : m.delete(r.id)));
    onChange(m);
  };
  const tabs: { v: PickTab; label: string; n?: number }[] = [
    { v: 'all', label: 'All', n: counts?.all }, { v: 'customers', label: 'Customers', n: counts?.customers }, { v: 'workers', label: 'Workers', n: counts?.workers },
  ];
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface-2/50 p-4">
      <div className="flex flex-wrap gap-2 border-b border-line pb-3">
        {tabs.map((t) => (
          <button key={t.v} type="button" onClick={() => setTab(t.v)}
            className={cn('inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition', tab === t.v ? 'bg-primary text-on-primary' : 'border border-line bg-surface text-ink-2 hover:bg-surface-2')}>
            {t.label}
            <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold', tab === t.v ? 'bg-white/20' : 'bg-surface-2')}>{t.n === undefined ? '…' : num(t.n)}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="flex h-10 flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3">
          <Search size={16} className="text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or mobile…" aria-label="Search recipients" className="w-full bg-transparent text-sm outline-none" />
        </label>
        <div className="flex gap-2">
          <Btn size="sm" onClick={() => selectShown(true)} disabled={!rows.length}>Select all shown</Btn>
          <Btn size="sm" tone="ghost" onClick={() => selectShown(false)} disabled={!rows.length}>Deselect shown</Btn>
        </div>
      </div>
      <div className="flex justify-between px-1 text-xs text-ink-3">
        <span>{list.isPending ? 'Searching…' : `Showing ${num(rows.length)} of ${num(totalOf(list.data))}`}</span>
        <span className="font-semibold text-primary">Selected: {num(picked.size)}</span>
      </div>
      <div className="max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line bg-surface">
        {list.isError && <ErrorBlock error={list.error} onRetry={() => list.refetch()} />}
        {list.isPending && Array.from({ length: 4 }, (_, i) => <div key={i} className="p-3"><Skeleton className="h-9" /></div>)}
        {!list.isPending && !rows.length && <p className="p-6 text-center text-sm text-ink-3">No people match.</p>}
        {rows.map((r) => (
          <label key={r.id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-surface-2">
            <input type="checkbox" className="size-4 accent-primary" checked={picked.has(r.id)} onChange={() => toggle(r)} />
            <Avatar name={r.name} src={mediaUrl(r.avatar)} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{r.workerName && r.workerName !== r.name ? `${r.name} · ${r.workerName}` : r.name}</span>
              <span className="block text-xs text-ink-3">{r.mobile}</span>
            </span>
            {r.roles.includes('worker') && <Pill tone="primary" dot={false}>Worker</Pill>}
          </label>
        ))}
      </div>
      {list.hasNextPage && <div className="text-center"><Btn size="sm" loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>Load more</Btn></div>}
    </div>
  );
}

function HistoryDrawer({ rows, query, canDelete, onClose }: {
  rows: BroadcastRow[]; query: ReturnType<typeof useBroadcasts>; canDelete: boolean; onClose: () => void;
}) {
  const del = useDeleteBroadcast();
  const [removing, setRemoving] = useState<BroadcastRow | null>(null);
  const columns: Column<BroadcastRow>[] = [
    { key: 'title', header: 'Title', mobile: 'title', cell: (b) => <span className="font-semibold text-ink">{b.title}</span> },
    { key: 'msg', header: 'Message', cell: (b) => <span className="line-clamp-2 max-w-xs text-ink-2">{b.body}</span> },
    { key: 'target', header: 'Target', cell: (b) => <span className="whitespace-nowrap">{AUDIENCE_SHORT[b.audience]}{b.kind === 'offer' && <span className="text-ink-3"> · offer</span>}</span> },
    {
      key: 'reach', header: 'Recipients',
      cell: (b) => (
        <span className="whitespace-nowrap">
          {num(b.recipients)} <span className="text-xs text-ink-3">· {num(b.pushSent)} push</span>
          {b.status !== 'sent' && <Pill className="ml-2" tone={b.status === 'failed' ? 'danger' : 'warning'}>{b.status === 'failed' ? 'Failed' : 'Sending'}</Pill>}
        </span>
      ),
    },
    { key: 'at', header: 'Sent', cell: (b) => <span className="whitespace-nowrap text-ink-2" title={`by ${b.createdBy}`}>{dateTime(b.createdAt)}</span> },
    ...(canDelete
      ? [{ key: 'act', header: <span className="sr-only">Actions</span>, align: 'right' as const, cell: (b: BroadcastRow) => <Btn size="sm" tone="dangerGhost" icon={<Trash2 size={14} />} onClick={() => setRemoving(b)}>Delete</Btn> }]
      : []),
  ];
  return (
    <Drawer open wide onClose={onClose} title="Broadcast history" sub="Deleting also removes it from users’ inboxes. Pushes already shown on phones stay.">
      {query.isError ? (
        <ErrorBlock error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <>
          <DataTable rows={rows} columns={columns} rowKey={(b) => b.id} loading={query.isPending}
            empty={<EmptyBlock icon={<Megaphone size={26} />} title="No broadcasts yet" sub="Sent broadcasts show up here with their reach." />} />
          <LoadMore shown={rows.length} total={totalOf(query.data)} hasMore={!!query.hasNextPage} loading={query.isFetchingNextPage} onMore={() => query.fetchNextPage()} noun="broadcasts" />
        </>
      )}
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Delete this broadcast?"
        description={<>“<b className="text-ink">{removing?.title}</b>” is removed from history and from every recipient’s inbox.</>}
        confirmLabel="Delete"
        tone="danger"
        loading={del.isPending}
        onConfirm={() => removing && del.mutate(removing.id, { onSuccess: () => setRemoving(null) })}
      />
    </Drawer>
  );
}
