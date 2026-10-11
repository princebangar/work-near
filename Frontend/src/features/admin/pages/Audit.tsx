import { useState } from 'react';
import { FileClock } from 'lucide-react';
import { rowsOf, totalOf, useAuditLogs } from '@/api/admin';
import { cn, timeAgo } from '@/lib/format';
import type { AuditEntry } from '@/types/admin';
import { clean, dateTime, useDebounced } from '../lib';
import { DataTable, DateRangeField, EmptyBlock, ErrorBlock, LoadMore, PageHeader, SearchField, Toolbar, type Column } from '../components/kit';

/** Colour an action by its verb so risky operations stand out when scanning. */
function actionTone(a: string) {
  if (/(delete|suspend|refund|reject|restrict|disable|maintenance\.on|hide)/.test(a)) return 'bg-danger-soft text-danger';
  if (/(maintenance|settings|reset|grant|password|mfa)/.test(a)) return 'bg-warning-soft text-warning';
  if (/(create|approve|reinstate|restore|enable|unrestrict)/.test(a)) return 'bg-success-soft text-success';
  if (/(view|export|login)/.test(a)) return 'bg-surface-2 text-ink-2';
  return 'bg-primary-soft text-primary';
}

export function AuditPage() {
  const [q, setQ] = useState('');
  const [range, setRange] = useState<{ from?: string; to?: string }>({});
  const dq = useDebounced(q.trim(), 350);
  const list = useAuditLogs(clean({ q: dq, from: range.from, to: range.to }));
  const rows = rowsOf(list.data);

  const columns: Column<AuditEntry>[] = [
    {
      key: 'action',
      header: 'Action',
      mobile: 'title',
      cell: (l) => (
        <div className="flex items-center justify-between gap-2">
          <span className={cn('inline-flex rounded-md px-2 py-0.5 font-mono text-[11.5px] font-semibold whitespace-nowrap', actionTone(l.action))}>{l.action}</span>
          <span className="text-xs text-ink-3 md:hidden">{timeAgo(l.at)}</span>
        </div>
      ),
    },
    { key: 'actor', header: 'Actor', cell: (l) => <span className="font-medium text-ink">{l.actor}</span> },
    { key: 'target', header: 'Target', cell: (l) => <span className="block max-w-[260px] truncate text-ink-2" title={l.target}>{l.target || '—'}</span> },
    { key: 'reason', header: 'Reason', cell: (l) => <span className="block max-w-[240px] truncate text-ink-2" title={l.reason}>{l.reason || '—'}</span> },
    { key: 'ip', header: 'IP', cell: (l) => <span className="font-mono text-xs text-ink-3">{l.ip || '—'}</span> },
    {
      key: 'at',
      header: 'Time',
      mobile: 'hide',
      cell: (l) => (
        <span className="whitespace-nowrap text-ink-2" title={dateTime(l.at)}>
          {dateTime(l.at)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="System"
        title="Audit logs"
        sub="Every admin action — who did what, to what, why, and from where. Private document views and exports are recorded too."
      />
      <Toolbar>
        <SearchField value={q} onChange={setQ} placeholder="Search action, target or person…" label="Search audit logs" wide />
        <DateRangeField from={range.from} to={range.to} onChange={setRange} className="lg:ml-auto" />
      </Toolbar>
      {list.isError ? (
        <ErrorBlock error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <>
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(l) => l.id}
            loading={list.isPending}
            dim={list.isPlaceholderData}
            skeletonRows={10}
            empty={<EmptyBlock icon={<FileClock size={26} />} title="No log entries" sub="Nothing matches this search or date range." />}
          />
          <LoadMore shown={rows.length} total={totalOf(list.data)} hasMore={!!list.hasNextPage} loading={list.isFetchingNextPage} onMore={() => list.fetchNextPage()} noun="entries" />
        </>
      )}
    </>
  );
}
