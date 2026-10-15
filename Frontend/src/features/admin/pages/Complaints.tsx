import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AlertTriangle, Ban, CheckCircle2, CircleDot, Download, EyeOff, FileImage, Loader, MessageSquareWarning, Paperclip, Send, UserRoundSearch } from 'lucide-react';
import { useAdminComplaints, useAdminStaff, useExport, useUpdateComplaint, rowsOf, totalOf } from '@/api/admin';
import { useAuth } from '@/store';
import { cn, timeAgo } from '@/lib/format';
import type { AdminComplaint, ComplaintAction, ComplaintStatus } from '@/types/admin';
import { clean, dateTime, human, isAdminPlus, toneOf, useDebounced } from '../lib';
import {
  Btn, DataTable, Drawer, EmptyBlock, ErrorBlock, FilterChips, KeyVals, LoadMore, MicroLabel, PageHeader, Pill, ReasonDialog, SearchField,
  SelectField, TextAreaField, Toolbar, type Column,
} from '../components/kit';
import { useFileViewer } from '../components/FileViewer';

type Filter = 'all' | ComplaintStatus;
const STATUSES: { value: ComplaintStatus; label: string; icon: typeof CircleDot; on: string }[] = [
  { value: 'open', label: 'Open', icon: CircleDot, on: 'border-warning bg-warning-soft text-warning' },
  { value: 'in_progress', label: 'In progress', icon: Loader, on: 'border-primary bg-primary-soft text-primary' },
  { value: 'escalated', label: 'Escalated', icon: AlertTriangle, on: 'border-danger bg-danger-soft text-danger' },
  { value: 'resolved', label: 'Resolved', icon: CheckCircle2, on: 'border-success bg-success-soft text-success' },
];

export function ComplaintsPage() {
  const role = useAuth((s) => s.admin?.role);
  const [sp, setSp] = useSearchParams();
  const status = (sp.get('status') ?? 'all') as Filter;
  const [q, setQ] = useState(sp.get('q') ?? '');
  const dq = useDebounced(q.trim(), 350);
  const list = useAdminComplaints(clean({ status, q: dq }));
  const rows = rowsOf(list.data);
  const [openCode, setOpenCode] = useState<string | null>(null);
  const open = rows.find((c) => c.id === openCode) ?? null;
  const exp = useExport();

  const columns: Column<AdminComplaint>[] = [
    {
      key: 'complaint',
      header: 'Complaint',
      mobile: 'title',
      cell: (c) => (
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] font-bold text-ink-2">#{c.id}</span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{c.category}</p>
            <p className="line-clamp-1 max-w-sm text-xs text-ink-3">{c.description}</p>
          </div>
          <span className="ml-auto md:hidden"><Pill tone={toneOf('complaint', c.status)}>{human(c.status)}</Pill></span>
        </div>
      ),
    },
    { key: 'reporter', header: 'Reporter', cell: (c) => <span className="text-ink-2">{c.reporterName}</span> },
    {
      key: 'target',
      header: 'Against',
      cell: (c) => (
        <span className="text-ink-2">
          {c.targetName}
          <span className="ml-1.5 text-[11px] text-ink-3 capitalize">({c.targetType})</span>
        </span>
      ),
    },
    { key: 'status', header: 'Status', mobile: 'hide', cell: (c) => <Pill tone={toneOf('complaint', c.status)}>{human(c.status)}</Pill> },
    { key: 'assigned', header: 'Assigned', cell: (c) => <span className={c.assignedTo ? 'text-ink' : 'text-ink-3'}>{c.assignedTo ?? 'Unassigned'}</span> },
    { key: 'evidence', header: 'Files', cell: (c) => (c.evidence ? <span className="inline-flex items-center gap-1 text-ink-2"><Paperclip size={13} />{c.evidence}</span> : <span className="text-ink-3">—</span>) },
    { key: 'created', header: 'Filed', cell: (c) => <span className="whitespace-nowrap text-ink-2" title={dateTime(c.createdAt)}>{timeAgo(c.createdAt)}</span> },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Trust & safety"
        title="Complaints"
        sub={role === 'support' ? 'Complaints assigned to you. Resolve them with a clear note — the reporter is notified.' : 'Reports from customers and workers. Assign, act on the reported user and resolve with a note.'}
        actions={isAdminPlus(role) && <Btn icon={<Download size={16} />} loading={exp.isPending} onClick={() => exp.mutate({ type: 'complaints' })}>Export CSV</Btn>}
      />
      <Toolbar>
        <SearchField value={q} onChange={setQ} placeholder="Search code or text…" label="Search complaints" />
        <FilterChips
          label="Complaint status"
          value={status}
          onChange={(v) => setSp(v === 'all' ? {} : { status: v }, { replace: true })}
          options={[{ value: 'all', label: 'All' }, ...STATUSES.map((s) => ({ value: s.value, label: s.label }))]}
        />
      </Toolbar>
      {list.isError ? (
        <ErrorBlock error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <>
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(c) => c.id}
            loading={list.isPending}
            dim={list.isPlaceholderData}
            onRowClick={(c) => setOpenCode(c.id)}
            rowLabel={(c) => `Manage complaint ${c.id}`}
            empty={<EmptyBlock icon={<MessageSquareWarning size={26} />} title="No complaints here" sub={role === 'support' ? 'Nothing is assigned to you right now.' : 'Try another status or search.'} />}
          />
          <LoadMore shown={rows.length} total={totalOf(list.data)} hasMore={!!list.hasNextPage} loading={list.isFetchingNextPage} onMore={() => list.fetchNextPage()} noun="complaints" />
        </>
      )}
      {open && <ComplaintDrawer key={open.id} c={open} onClose={() => setOpenCode(null)} />}
    </>
  );
}

function ComplaintDrawer({ c, onClose }: { c: AdminComplaint; onClose: () => void }) {
  const role = useAuth((s) => s.admin?.role);
  const adminPlus = isAdminPlus(role);
  const staff = useAdminStaff(adminPlus);
  const update = useUpdateComplaint();
  const { open: openFile, viewer } = useFileViewer();
  const [status, setStatus] = useState<ComplaintStatus>(c.status);
  const [resolution, setResolution] = useState(c.resolution ?? '');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [action, setAction] = useState<ComplaintAction | null>(null);

  const dirty = status !== c.status || resolution.trim() !== (c.resolution ?? '') || note.trim().length > 0;
  const save = () => {
    if (status === 'resolved' && !resolution.trim()) return setErr('Add a resolution note before resolving — the reporter sees it.');
    setErr(null);
    update.mutate(
      {
        code: c.id,
        patch: {
          ...(status !== c.status && { status }),
          ...(resolution.trim() && resolution.trim() !== (c.resolution ?? '') && { resolution: resolution.trim() }),
          ...(note.trim() && { note: note.trim() }),
        },
      },
      { onSuccess: () => setNote('') },
    );
  };

  const history = [{ at: c.createdAt, by: c.reporterName, action: 'complaint filed', note: undefined as string | undefined }, ...c.history];

  return (
    <Drawer
      open
      onClose={onClose}
      wide
      title={<span className="flex items-center gap-2"><span className="font-mono">#{c.id}</span><span className="truncate text-ink-2">· {c.category}</span></span>}
      sub={<span className="inline-flex items-center gap-2"><Pill tone={toneOf('complaint', c.status)}>{human(c.status)}</Pill> filed {timeAgo(c.createdAt)}</span>}
      footer={
        <>
          <span className="mr-auto text-xs text-ink-3">{dirty ? 'Unsaved changes' : 'Up to date'}</span>
          <Btn tone="primary" icon={<Send size={15} />} loading={update.isPending && !action} disabled={!dirty} onClick={save}>Save update</Btn>
        </>
      }
    >
      <div className="space-y-5">
        <section className="rounded-2xl border border-line p-4">
          <MicroLabel className="mb-2">Description</MicroLabel>
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink">{c.description || '—'}</p>
          <KeyVals
            className="mt-4 border-t border-line pt-4"
            items={[
              { label: 'Reporter', value: c.reporterName },
              {
                label: 'Against',
                value:
                  c.targetUserId && adminPlus ? (
                    <Link to={`/admin/users?user=${c.targetUserId}`} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"><UserRoundSearch size={14} />{c.targetName}</Link>
                  ) : (
                    c.targetName
                  ),
              },
              { label: 'Type', value: <span className="capitalize">{c.targetType}</span> },
              { label: 'Target ID', value: c.targetId ? <span className="font-mono text-xs break-all">{c.targetId}</span> : '—' },
              { label: 'Filed', value: dateTime(c.createdAt) },
              { label: 'Last update', value: c.updatedAt ? dateTime(c.updatedAt) : '—' },
            ]}
          />
        </section>

        {c.evidence > 0 && (
          <section>
            <MicroLabel className="mb-2">Evidence ({c.evidence})</MicroLabel>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: c.evidence }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => openFile({ path: `/admin/complaints/${encodeURIComponent(c.id)}/evidence/${i}`, name: `Evidence ${i + 1} · #${c.id}` })}
                  className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink transition hover:border-primary/40 hover:bg-primary-soft/50"
                >
                  <FileImage size={15} className="text-primary" /> Evidence {i + 1}
                </button>
              ))}
            </div>
          </section>
        )}

        {adminPlus && (
          <SelectField
            label="Assigned to"
            value={c.assignedToId ?? ''}
            disabled={update.isPending || staff.isPending}
            onChange={(e) => update.mutate({ code: c.id, patch: { assignedTo: e.target.value || null } })}
            options={[
              { value: '', label: 'Unassigned' },
              ...(staff.data ?? []).filter((s) => s.status === 'active').map((s) => ({ value: s.id, label: `${s.name} · ${human(s.role)}` })),
              ...(c.assignedToId && !staff.data?.some((s) => s.id === c.assignedToId) ? [{ value: c.assignedToId, label: c.assignedTo ?? 'Staff member' }] : []),
            ]}
          />
        )}

        <section>
          <MicroLabel className="mb-2">Status</MicroLabel>
          <div role="radiogroup" aria-label="Status" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={status === s.value}
                onClick={() => setStatus(s.value)}
                className={cn('inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border text-[13px] font-semibold transition', status === s.value ? s.on : 'border-line text-ink-2 hover:bg-surface-2')}
              >
                <s.icon size={15} /> {s.label}
              </button>
            ))}
          </div>
        </section>

        <TextAreaField
          label={status === 'resolved' ? 'Resolution (required — sent to the reporter)' : 'Resolution'}
          rows={3}
          maxLength={1000}
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          placeholder="What was done to resolve this?"
          error={err ?? undefined}
        />
        <TextAreaField label="Internal note (staff only)" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Added to the history timeline" />

        {c.targetUserId && (
          <section className="rounded-2xl border border-line p-4">
            <MicroLabel className="mb-1">Action on reported user</MicroLabel>
            <p className="mb-3 text-xs text-ink-3">{c.targetName} — every action is logged on this complaint.</p>
            <div className="flex flex-wrap gap-2">
              <Btn size="sm" icon={<AlertTriangle size={14} />} onClick={() => setAction('warn')}>Send warning</Btn>
              <Btn size="sm" icon={<EyeOff size={14} />} onClick={() => setAction('restrict')}>Restrict worker</Btn>
              {adminPlus && <Btn size="sm" tone="dangerGhost" icon={<Ban size={14} />} onClick={() => setAction('suspend')}>Suspend user</Btn>}
            </div>
          </section>
        )}

        <section>
          <MicroLabel className="mb-3">History</MicroLabel>
          <ol className="relative ml-2 space-y-4 border-l border-line pl-5">
            {history.map((h, i) => (
              <li key={i} className="relative">
                <span className={cn('absolute top-1 -left-[26px] size-3 rounded-full ring-4 ring-surface', i === history.length - 1 ? 'bg-primary' : 'bg-ink-3')} />
                <p className="text-sm text-ink"><b className="capitalize">{h.action}</b> <span className="text-ink-3">by {h.by}</span></p>
                <p className="text-xs text-ink-3">{dateTime(h.at)}</p>
                {h.note && <p className="mt-1.5 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2">{h.note}</p>}
              </li>
            ))}
          </ol>
        </section>
      </div>

      <ReasonDialog
        open={!!action}
        onClose={() => setAction(null)}
        required={false}
        label="Internal note"
        placeholder="Why? (kept on the complaint history)"
        title={action === 'warn' ? `Warn ${c.targetName}?` : action === 'restrict' ? `Restrict ${c.targetName}'s worker profile?` : `Suspend ${c.targetName}?`}
        description={
          action === 'warn'
            ? 'They receive an in-app warning to follow the community guidelines.'
            : action === 'restrict'
              ? 'Their worker profile is hidden from search until an admin lifts it.'
              : 'They are signed out and blocked from the app until reinstated.'
        }
        confirmLabel={action === 'warn' ? 'Send warning' : action === 'restrict' ? 'Restrict' : 'Suspend'}
        tone={action === 'warn' ? 'primary' : 'danger'}
        loading={update.isPending}
        onConfirm={(n) => action && update.mutate({ code: c.id, patch: { action, ...(n && { note: n }) } }, { onSuccess: () => setAction(null) })}
      />
      {viewer}
    </Drawer>
  );
}
