import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Eye, EyeOff, Flag, MessageSquareQuote } from 'lucide-react';
import { Avatar, Skeleton, Stars } from '@/components/ui';
import { rowsOf, totalOf, useAdminReviews, useModerateReview } from '@/api/admin';
import { mediaUrl } from '@/lib/media';
import { cn, date } from '@/lib/format';
import type { AdminReview } from '@/types/admin';
import { clean, human, toneOf } from '../lib';
import { Btn, ConfirmDialog, EmptyBlock, ErrorBlock, FilterChips, LoadMore, PageHeader, Pill, ReasonDialog, Toolbar } from '../components/kit';

type Filter = 'all' | 'reported' | 'visible' | 'hidden';

export function ReviewsPage() {
  const [sp, setSp] = useSearchParams();
  const status = (sp.get('status') ?? 'all') as Filter;
  const list = useAdminReviews(clean({ status }));
  const rows = rowsOf(list.data);
  const mod = useModerateReview();
  const [hide, setHide] = useState<AdminReview | null>(null);
  const [restore, setRestore] = useState<AdminReview | null>(null);

  return (
    <>
      <PageHeader
        eyebrow="Trust & safety"
        title="Reviews"
        sub="Customers can review a worker after a real conversation. Hide abusive or fake reviews — the worker's rating is recalculated instantly."
      />
      <Toolbar>
        <FilterChips
          label="Review status"
          value={status}
          onChange={(v) => setSp(v === 'all' ? {} : { status: v }, { replace: true })}
          options={[{ value: 'all', label: 'All' }, { value: 'reported', label: 'Reported' }, { value: 'visible', label: 'Visible' }, { value: 'hidden', label: 'Hidden' }]}
        />
      </Toolbar>

      {list.isError ? (
        <ErrorBlock error={list.error} onRetry={() => list.refetch()} />
      ) : list.isPending ? (
        <div className="grid gap-3 lg:grid-cols-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}</div>
      ) : !rows.length ? (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyBlock icon={<MessageSquareQuote size={26} />} title={status === 'reported' ? 'No reported reviews' : 'No reviews here'} sub="Reviews show up once customers rate workers after a chat." />
        </div>
      ) : (
        <div className={cn('grid gap-3 transition-opacity lg:grid-cols-2', list.isPlaceholderData && 'opacity-60')}>
          {rows.map((r) => (
            <article key={r.id} className={cn('flex flex-col rounded-2xl border bg-surface p-4', r.reports > 0 && r.status === 'visible' ? 'border-danger/30' : 'border-line')}>
              <header className="flex items-start gap-3">
                <Avatar name={r.reviewerName} src={mediaUrl(r.reviewerPhoto)} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{r.reviewerName}</p>
                  <p className="truncate text-xs text-ink-3">
                    for <Link to={`/admin/users?user=${r.workerId}`} className="font-semibold text-primary hover:underline">{r.workerName}</Link> · {date(r.createdAt)}
                  </p>
                </div>
                <Pill tone={toneOf('review', r.status)}>{human(r.status)}</Pill>
              </header>
              <div className="mt-3 flex items-center gap-2">
                <Stars value={r.stars} />
                <span className="text-xs font-semibold text-ink-2">{r.stars}/5</span>
                {r.reports > 0 && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-bold text-danger">
                    <Flag size={11} /> {r.reports} report{r.reports > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className={cn('mt-2 text-sm leading-relaxed whitespace-pre-wrap', r.text ? 'text-ink' : 'text-ink-3 italic', r.status === 'hidden' && 'opacity-70')}>{r.text || 'No written review'}</p>
              {r.status === 'hidden' && r.hiddenReason && <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-2"><b>Hidden:</b> {r.hiddenReason}</p>}
              <div className="mt-auto flex justify-end pt-3">
                {r.status === 'visible' ? (
                  <Btn size="sm" tone="dangerGhost" icon={<EyeOff size={14} />} onClick={() => setHide(r)}>Hide</Btn>
                ) : (
                  <Btn size="sm" tone="soft" icon={<Eye size={14} />} onClick={() => setRestore(r)}>Restore</Btn>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <LoadMore shown={rows.length} total={totalOf(list.data)} hasMore={!!list.hasNextPage} loading={list.isFetchingNextPage} onMore={() => list.fetchNextPage()} noun="reviews" />

      <ReasonDialog
        open={!!hide}
        onClose={() => setHide(null)}
        title="Hide this review?"
        description={hide && <>It disappears from {hide.workerName}'s profile and their rating is recalculated.</>}
        confirmLabel="Hide review"
        tone="danger"
        presets={['Abusive language', 'Fake / not a real customer', 'Personal information', 'Spam or promotion']}
        loading={mod.isPending}
        onConfirm={(reason) => hide && mod.mutate({ id: hide.id, status: 'hidden', reason }, { onSuccess: () => setHide(null) })}
      />
      <ConfirmDialog
        open={!!restore}
        onClose={() => setRestore(null)}
        title="Restore this review?"
        description="It becomes visible again, its report count is cleared and the rating is recalculated."
        confirmLabel="Restore"
        loading={mod.isPending}
        onConfirm={() => restore && mod.mutate({ id: restore.id, status: 'visible' }, { onSuccess: () => setRestore(null) })}
      />
    </>
  );
}
