import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { BadgeCheck, CheckCircle2, Clock3, FileImage, FileQuestion, FileText, MapPin, ShieldCheck, XCircle } from 'lucide-react';
import { Avatar, Skeleton } from '@/components/ui';
import { rowsOf, totalOf, useAdminBadges, useAdminVerifications, useReviewVerification } from '@/api/admin';
import { mediaUrl } from '@/lib/media';
import { cn, timeAgo } from '@/lib/format';
import type { AdminVerification } from '@/types/admin';
import { VERIFICATION_TYPE_LABEL, clean, dateTime, human, toneOf } from '../lib';
import { Btn, ConfirmDialog, EmptyBlock, ErrorBlock, FilterChips, LoadMore, MicroLabel, PageHeader, Pill, ReasonDialog, Toolbar } from '../components/kit';
import { useFileViewer } from '../components/FileViewer';

type Filter = 'pending' | 'info_requested' | 'approved' | 'rejected' | 'all';
type Act = { v: AdminVerification; kind: 'approve' | 'info' | 'reject' } | null;

export function VerificationsPage() {
  const [sp, setSp] = useSearchParams();
  const status = (sp.get('status') ?? 'pending') as Filter;
  const list = useAdminVerifications(clean({ status }));
  const rows = rowsOf(list.data);
  const { data: badges } = useAdminBadges();
  const { open, viewer } = useFileViewer();
  const [act, setAct] = useState<Act>(null);
  const review = useReviewVerification();
  const close = () => setAct(null);
  const run = (status: 'approved' | 'rejected' | 'info_requested', reason?: string) =>
    act && review.mutate({ id: act.v.id, status, reason }, { onSuccess: close, onError: () => list.refetch() });

  return (
    <>
      <PageHeader
        eyebrow="Users & workers"
        title="Verifications"
        sub="Check each worker's documents. An approved badge states exactly what was verified (phone, ID or ID + address)."
      />
      <Toolbar>
        <FilterChips
          label="Verification status"
          value={status}
          onChange={(v) => setSp(v === 'pending' ? {} : { status: v }, { replace: true })}
          options={[
            { value: 'pending', label: 'Pending', count: badges?.verifications },
            { value: 'info_requested', label: 'Info requested' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
            { value: 'all', label: 'All' },
          ]}
        />
      </Toolbar>

      {list.isError ? (
        <ErrorBlock error={list.error} onRetry={() => list.refetch()} />
      ) : list.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}</div>
      ) : !rows.length ? (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyBlock
            icon={<BadgeCheck size={26} />}
            title={status === 'pending' ? 'All caught up' : 'Nothing here'}
            sub={status === 'pending' ? 'No verification requests are waiting for review.' : 'No requests with this status.'}
          />
        </div>
      ) : (
        <div className={cn('grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3', list.isPlaceholderData && 'opacity-60')}>
          {rows.map((v) => (
            <VerificationCard
              key={v.id}
              v={v}
              onDoc={(i, name) => open({ path: `/admin/verifications/${v.id}/documents/${i}`, name, note: v.workerName })}
              onAct={(kind) => setAct({ v, kind })}
            />
          ))}
        </div>
      )}
      <LoadMore shown={rows.length} total={totalOf(list.data)} hasMore={!!list.hasNextPage} loading={list.isFetchingNextPage} onMore={() => list.fetchNextPage()} noun="requests" />

      {viewer}

      <ConfirmDialog
        open={act?.kind === 'approve'}
        onClose={close}
        icon={<span className="grid size-10 shrink-0 place-items-center rounded-xl bg-success-soft text-success"><ShieldCheck size={20} /></span>}
        title={`Approve ${act ? VERIFICATION_TYPE_LABEL[act.v.type] : ''} verification?`}
        description={act && <>The <b className="text-ink">{VERIFICATION_TYPE_LABEL[act.v.type]} verified</b> badge goes live on {act.v.workerName}'s profile right away and they are notified.</>}
        confirmLabel="Approve"
        loading={review.isPending}
        onConfirm={() => run('approved')}
      />
      <ReasonDialog
        open={act?.kind === 'info'}
        onClose={close}
        title="Request more information"
        description="The worker sees this message and can resubmit."
        confirmLabel="Send request"
        label="What do they need to fix?"
        presets={['Photo is blurry — please re-upload', 'Name does not match the profile', 'Address proof is missing', 'Upload both sides of the ID']}
        loading={review.isPending}
        onConfirm={(r) => run('info_requested', r)}
      />
      <ReasonDialog
        open={act?.kind === 'reject'}
        onClose={close}
        title="Reject verification?"
        description="No badge is shown. The worker is told why and may submit again."
        confirmLabel="Reject"
        tone="danger"
        presets={['Document is invalid or expired', 'Document belongs to someone else', 'Suspected tampering']}
        loading={review.isPending}
        onConfirm={(r) => run('rejected', r)}
      />
    </>
  );
}

function VerificationCard({ v, onDoc, onAct }: { v: AdminVerification; onDoc: (i: number, name: string) => void; onAct: (k: 'approve' | 'info' | 'reject') => void }) {
  const open = v.status === 'pending' || v.status === 'info_requested';
  return (
    <article className="flex flex-col rounded-2xl border border-line bg-surface p-4 transition hover:shadow-md hover:shadow-black/[.04]">
      <header className="flex items-start gap-3">
        <Avatar name={v.workerName} src={mediaUrl(v.photo)} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-ink">{v.workerName}</p>
          <p className="truncate text-xs text-ink-3">{v.category || 'No category'}</p>
          {v.locality && <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-3"><MapPin size={11} />{v.locality}</p>}
        </div>
        <Pill tone={toneOf('verification', v.status)}>{human(v.status)}</Pill>
      </header>

      <div className="mt-4 flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5">
        <span className="text-xs font-medium text-ink-3">Requested badge</span>
        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-primary"><ShieldCheck size={15} />{VERIFICATION_TYPE_LABEL[v.type]}</span>
      </div>

      <div className="mt-3">
        <MicroLabel className="mb-2">Documents ({v.documents.length})</MicroLabel>
        {v.documents.length ? (
          <div className="flex flex-wrap gap-2">
            {v.documents.map((d, i) => (
              <button
                key={`${d}-${i}`}
                type="button"
                onClick={() => onDoc(i, d)}
                className="inline-flex max-w-full items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-left text-xs font-semibold text-ink transition hover:border-primary/40 hover:bg-primary-soft/50"
              >
                {/\.pdf$/i.test(d) ? <FileText size={15} className="shrink-0 text-danger" /> : <FileImage size={15} className="shrink-0 text-primary" />}
                <span className="truncate">{d}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="flex items-center gap-2 text-xs text-ink-3"><FileQuestion size={14} /> No files — phone-only verification</p>
        )}
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-3"><Clock3 size={12} /> Submitted {timeAgo(v.submittedAt)} · {dateTime(v.submittedAt)}</p>

      {v.reason && (
        <p className={cn('mt-3 rounded-xl px-3 py-2 text-xs', v.status === 'rejected' ? 'bg-danger-soft text-danger' : 'bg-primary-soft text-primary')}>
          <b>{v.status === 'rejected' ? 'Rejected: ' : 'Asked: '}</b>{v.reason}
        </p>
      )}

      <div className="mt-auto pt-4">
        {open ? (
          <div className="grid grid-cols-3 gap-2">
            <Btn size="sm" tone="success" icon={<CheckCircle2 size={14} />} onClick={() => onAct('approve')}>Approve</Btn>
            <Btn size="sm" tone="outline" onClick={() => onAct('info')}>Ask info</Btn>
            <Btn size="sm" tone="dangerGhost" icon={<XCircle size={14} />} className="border border-line" onClick={() => onAct('reject')}>Reject</Btn>
          </div>
        ) : (
          <p className="border-t border-line pt-3 text-xs text-ink-2">
            Reviewed by <b className="text-ink">{v.reviewer ?? 'admin'}</b>{v.reviewedAt && <> · {dateTime(v.reviewedAt)}</>}
          </p>
        )}
        {v.status === 'info_requested' && v.reviewer && (
          <p className="mt-2 text-[11px] text-ink-3">Info requested by {v.reviewer}{v.reviewedAt && ` · ${timeAgo(v.reviewedAt)}`}</p>
        )}
      </div>
    </article>
  );
}
