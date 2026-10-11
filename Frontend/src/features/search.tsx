import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ArrowUpDown, MapPin, SearchX, SlidersHorizontal, Search as SearchIcon, X } from 'lucide-react';
import { Button, Chip, EmptyState, ErrorState, Sheet, Skeleton, Toggle } from '@/components/ui';
import { LocationSheet, WorkerCard } from '@/components/shared';
import { errorMessage, useCategories, useWorkerSearch } from '@/api';
import { useGeo, usePrefs } from '@/store';
import { useDebounced, useRadius } from '@/hooks/useAppSettings';
import { useT } from '@/i18n';
import { cn } from '@/lib/format';
import type { SortBy } from '@/types';

interface Filters { minRating?: number; verifiedOnly?: boolean; availableOnly?: boolean }
const SORTS: SortBy[] = ['distance', 'rating', 'recent'];

export function SearchPage() {
  const t = useT();
  const lang = usePrefs((s) => s.lang);
  const [sp, setSp] = useSearchParams();
  const point = useGeo((s) => s.point);
  const { radiusKm, options, setRadius } = useRadius();
  const cats = useCategories();
  const [text, setText] = useState(sp.get('q') ?? '');
  const q = useDebounced(text.trim().slice(0, 60)); // one API call after typing stops
  const categoryId = sp.get('cat') ?? undefined;
  const sortParam = sp.get('sort') as SortBy | null;
  const sort: SortBy = sortParam && SORTS.includes(sortParam) ? sortParam : 'distance';
  const [filters, setFilters] = useState<Filters>({});
  const [draft, setDraft] = useState<Filters>({});
  const [sheet, setSheet] = useState<'filter' | 'sort' | 'loc' | null>(null);

  const params = useMemo(
    () => ({ lat: point.lat, lng: point.lng, radiusKm, q: q || undefined, categoryId, sort, ...filters }),
    [point.lat, point.lng, radiusKm, q, categoryId, sort, filters],
  );
  const res = useWorkerSearch(params);
  const items = res.data?.pages.flatMap((p) => p.items) ?? [];
  const total = res.data?.pages[0]?.total ?? 0;
  const nextRadius = options.find((r) => r > radiusKm);

  const setParam = (k: string, v?: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    setSp(n, { replace: true });
  };
  // Keep ?q= in the URL so back-navigation from a profile restores the search.
  useEffect(() => {
    if ((sp.get('q') ?? '') !== q) setParam('q', q || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Infinite scroll: one observer; reads the latest query state through a ref.
  const sentinel = useRef<HTMLDivElement>(null);
  const resRef = useRef(res);
  resRef.current = res;
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      const r = resRef.current;
      if (e.isIntersecting && r.hasNextPage && !r.isFetchingNextPage && !r.isError) r.fetchNextPage();
    }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const activeFilters = Object.values(filters).filter(Boolean).length;
  const sortLabel: Record<SortBy, string> = { distance: t('sortDistance'), rating: t('sortRating'), recent: t('sortRecent') };

  return (
    <div>
      <div className="pt-safe sticky top-0 z-30 border-b border-line/60 bg-surface/95 backdrop-blur">
        <div className="flex items-center gap-2 px-4 pt-3">
          <label className="flex h-12 flex-1 items-center gap-2 rounded-2xl bg-surface-2 px-3.5">
            <SearchIcon size={20} className="text-ink-3" />
            <input value={text} maxLength={60} onChange={(e) => setText(e.target.value)} placeholder={t('searchPlaceholder')} aria-label={t('search')}
              className="h-full w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3" />
            {text && <button aria-label="Clear" onClick={() => setText('')}><X size={18} className="text-ink-3" /></button>}
          </label>
          <button aria-label={t('filters')} onClick={() => { setDraft(filters); setSheet('filter'); }} className="relative grid size-12 place-items-center rounded-2xl bg-surface-2 text-ink">
            <SlidersHorizontal size={20} />
            {activeFilters > 0 && <span className="absolute top-2 right-2 grid size-4 place-items-center rounded-full bg-primary text-[10px] text-on-primary">{activeFilters}</span>}
          </button>
        </div>
        <button onClick={() => setSheet('loc')} className="flex max-w-full items-center gap-1 px-4 pt-2 text-sm text-ink-2">
          <MapPin size={14} className="shrink-0 text-primary" /><span className="truncate">{point.label}</span>
          <span className="shrink-0 font-semibold text-primary">· {radiusKm} KM</span>
        </button>
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
          <Chip active={!categoryId} onClick={() => setParam('cat')}>{t('all')}</Chip>
          {cats.isLoading && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-24 shrink-0 rounded-full" />)}
          {cats.data?.map((c) => <Chip key={c.id} active={categoryId === c.id} onClick={() => setParam('cat', c.id)}>{lang === 'hi' && c.nameHi ? c.nameHi : c.name}</Chip>)}
        </div>
      </div>

      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="text-sm text-ink-2">{res.isLoading ? '…' : <><b className="text-ink">{total}</b> {t('results')} · {t('within')} {radiusKm} KM</>}</span>
        <button onClick={() => setSheet('sort')} className="flex items-center gap-1 text-sm font-semibold text-primary"><ArrowUpDown size={15} />{sortLabel[sort]}</button>
      </div>

      <div className={cn('space-y-3 px-4 pb-4 transition-opacity', res.isFetching && !res.isFetchingNextPage && !res.isLoading && 'opacity-60')}>
        {res.isLoading && Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-28" />)}
        {res.isError && !items.length && <ErrorState message={errorMessage(res.error)} onRetry={() => res.refetch()} />}
        {items.map((w) => <WorkerCard key={w.id} w={w} />)}
        {res.isSuccess && items.length === 0 && (
          <EmptyState
            icon={<SearchX size={34} />} title={t('noWorkers')} sub={t('noWorkersSub')}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" onClick={() => setSheet('loc')}>{t('changeLocation')}</Button>
                {nextRadius && <Button onClick={() => setRadius(nextRadius)}>{t('increaseRadius')} · {nextRadius} KM</Button>}
              </div>
            }
          />
        )}
        <div ref={sentinel} />
        {res.isFetchingNextPage && <Skeleton className="h-28" />}
        {res.isError && items.length > 0 && <Button variant="outline" block onClick={() => res.fetchNextPage()}>{t('retry')}</Button>}
        {!res.hasNextPage && items.length > 8 && <p className="py-2 text-center text-xs text-ink-3">{t('endOfResults')}</p>}
      </div>

      <Sheet open={sheet === 'filter'} onClose={() => setSheet(null)} title={t('filters')}>
        <h4 className="mb-2 text-sm font-semibold text-ink-2">{t('searchRadius')}</h4>
        <div className="mb-5 flex gap-2">{options.map((r) => <Chip key={r} active={radiusKm === r} onClick={() => setRadius(r)}>{r} KM</Chip>)}</div>
        <h4 className="mb-2 text-sm font-semibold text-ink-2">{t('minRating')}</h4>
        <div className="mb-5 flex flex-wrap gap-2">
          {[undefined, 3, 4, 4.5].map((r) => <Chip key={String(r)} active={draft.minRating === r} onClick={() => setDraft({ ...draft, minRating: r })}>{r ? `${r}★ +` : t('any')}</Chip>)}
        </div>
        {([['verifiedOnly', t('verifiedOnly')], ['availableOnly', t('availableNow')]] as const).map(([k, label]) => (
          <div key={k} className="flex items-center justify-between border-t border-line py-4">
            <span className="font-medium">{label}</span>
            <Toggle label={label} checked={!!draft[k]} onChange={(v) => setDraft({ ...draft, [k]: v || undefined })} />
          </div>
        ))}
        <div className="mt-2 flex gap-2">
          <Button variant="outline" block onClick={() => { setDraft({}); setFilters({}); setSheet(null); }}>{t('reset')}</Button>
          <Button block onClick={() => { setFilters(draft); setSheet(null); }}>{t('apply')}</Button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'sort'} onClose={() => setSheet(null)} title={t('sort')}>
        {SORTS.map((k) => (
          <button key={k} onClick={() => { setParam('sort', k === 'distance' ? undefined : k); setSheet(null); }} className="flex w-full items-center justify-between border-b border-line py-4 text-left font-medium last:border-0">
            {sortLabel[k]}<span className={cn('size-5 rounded-full border-2', sort === k ? 'border-6 border-primary' : 'border-line')} />
          </button>
        ))}
      </Sheet>
      <LocationSheet open={sheet === 'loc'} onClose={() => setSheet(null)} />
    </div>
  );
}
