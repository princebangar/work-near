import { useDeferredValue, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ArrowUpDown, MapPin, SearchX, SlidersHorizontal, Search as SearchIcon, X } from 'lucide-react';
import { Button, Chip, EmptyState, Sheet, Skeleton, Toggle } from '@/components/ui';
import { LocationSheet, WorkerCard } from '@/components/shared';
import { useCategories, useWorkerSearch } from '@/api';
import { useGeo } from '@/store';
import { useT } from '@/i18n';
import { APP } from '@/config/env';
import type { SortBy } from '@/types';

interface Filters { minRating?: number; verifiedOnly?: boolean; availableOnly?: boolean }

function useDebounced<T>(v: T, ms = 350) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const id = setTimeout(() => setD(v), ms);
    return () => clearTimeout(id);
  }, [v, ms]);
  return d;
}

export function SearchPage() {
  const t = useT();
  const [sp, setSp] = useSearchParams();
  const { point, radiusKm, setRadius } = useGeo();
  const cats = useCategories();
  const [text, setText] = useState(sp.get('q') ?? '');
  const q = useDebounced(text.trim()); // avoids an API call per keystroke
  const categoryId = sp.get('cat') ?? undefined;
  const sort = (sp.get('sort') as SortBy) ?? 'distance';
  const [filters, setFilters] = useState<Filters>({});
  const [draft, setDraft] = useState<Filters>({});
  const [sheet, setSheet] = useState<'filter' | 'sort' | 'loc' | null>(null);

  const params = useDeferredValue({ lat: point.lat, lng: point.lng, radiusKm, q: q || undefined, categoryId, sort, ...filters });
  const res = useWorkerSearch(params);
  const items = res.data?.pages.flatMap((p) => p.items) ?? [];
  const total = res.data?.pages[0]?.total ?? 0;

  const setParam = (k: string, v?: string) => {
    const n = new URLSearchParams(sp);
    v ? n.set(k, v) : n.delete(k);
    setSp(n, { replace: true });
  };

  // Infinite scroll via IntersectionObserver
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && res.hasNextPage && !res.isFetchingNextPage && res.fetchNextPage());
    io.observe(el);
    return () => io.disconnect();
  }, [res]);

  const activeFilters = Object.values(filters).filter(Boolean).length;
  const sorts: [SortBy, string][] = [['distance', t('sortDistance')], ['rating', t('sortRating')], ['recent', t('sortRecent')]];

  return (
    <div>
      <div className="pt-safe sticky top-0 z-30 border-b border-line/60 bg-surface/95 backdrop-blur">
        <div className="flex items-center gap-2 px-4 pt-3">
          <label className="flex h-12 flex-1 items-center gap-2 rounded-2xl bg-surface-2 px-3.5">
            <SearchIcon size={20} className="text-ink-3" />
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('searchPlaceholder')} className="h-full w-full bg-transparent text-[15px] outline-none" />
            {text && <button aria-label="Clear" onClick={() => setText('')}><X size={18} className="text-ink-3" /></button>}
          </label>
          <button aria-label={t('filters')} onClick={() => { setDraft(filters); setSheet('filter'); }} className="relative grid size-12 place-items-center rounded-2xl bg-surface-2">
            <SlidersHorizontal size={20} />
            {activeFilters > 0 && <span className="absolute top-2 right-2 grid size-4 place-items-center rounded-full bg-primary text-[10px] text-white">{activeFilters}</span>}
          </button>
        </div>
        <button onClick={() => setSheet('loc')} className="flex items-center gap-1 px-4 pt-2 text-sm text-ink-2">
          <MapPin size={14} className="text-primary" /><span className="truncate">{point.label}</span>
        </button>
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
          <Chip active={!categoryId} onClick={() => setParam('cat')}>All</Chip>
          {cats.data?.map((c) => <Chip key={c.id} active={categoryId === c.id} onClick={() => setParam('cat', c.id)}>{c.name}</Chip>)}
        </div>
      </div>

      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="text-sm text-ink-2">{res.isLoading ? '…' : <><b className="text-ink">{total}</b> {t('results')} · {t('within')} {radiusKm} KM</>}</span>
        <button onClick={() => setSheet('sort')} className="flex items-center gap-1 text-sm font-semibold text-primary"><ArrowUpDown size={15} />{sorts.find((s) => s[0] === sort)?.[1]}</button>
      </div>

      <div className="space-y-3 px-4 pb-4">
        {res.isLoading && Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-28" />)}
        {items.map((w) => <WorkerCard key={w.id} w={w} />)}
        {!res.isLoading && items.length === 0 && (
          <EmptyState
            icon={<SearchX size={34} />} title={t('noWorkers')} sub={t('noWorkersSub')}
            action={
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSheet('loc')}>{t('changeLocation')}</Button>
                {radiusKm < 15 && <Button onClick={() => setRadius(radiusKm + 5)}>{t('increaseRadius')}</Button>}
              </div>
            }
          />
        )}
        <div ref={sentinel} />
        {res.isFetchingNextPage && <Skeleton className="h-28" />}
      </div>

      <Sheet open={sheet === 'filter'} onClose={() => setSheet(null)} title={t('filters')}>
        <h4 className="mb-2 text-sm font-semibold text-ink-2">{t('searchRadius')}</h4>
        <div className="mb-5 flex gap-2">{APP.radiusOptions.map((r) => <Chip key={r} active={radiusKm === r} onClick={() => setRadius(r)}>{r} KM</Chip>)}</div>
        <h4 className="mb-2 text-sm font-semibold text-ink-2">{t('minRating')}</h4>
        <div className="mb-5 flex gap-2">
          {[undefined, 3, 4, 4.5].map((r) => <Chip key={String(r)} active={draft.minRating === r} onClick={() => setDraft({ ...draft, minRating: r })}>{r ? `${r}★ +` : 'Any'}</Chip>)}
        </div>
        {([['verifiedOnly', t('verifiedOnly')], ['availableOnly', t('availableNow')]] as const).map(([k, label]) => (
          <div key={k} className="flex items-center justify-between border-t border-line py-4">
            <span className="font-medium">{label}</span>
            <Toggle checked={!!draft[k]} onChange={(v) => setDraft({ ...draft, [k]: v })} />
          </div>
        ))}
        <div className="mt-2 flex gap-2">
          <Button variant="outline" block onClick={() => { setDraft({}); setFilters({}); setSheet(null); }}>{t('reset')}</Button>
          <Button block onClick={() => { setFilters(draft); setSheet(null); }}>{t('apply')}</Button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'sort'} onClose={() => setSheet(null)} title={t('sort')}>
        {sorts.map(([k, label]) => (
          <button key={k} onClick={() => { setParam('sort', k); setSheet(null); }} className="flex w-full items-center justify-between border-b border-line py-4 text-left font-medium last:border-0">
            {label}<span className={`size-5 rounded-full border-2 ${sort === k ? 'border-6 border-primary' : 'border-line'}`} />
          </button>
        ))}
      </Sheet>
      <LocationSheet open={sheet === 'loc'} onClose={() => setSheet(null)} />
    </div>
  );
}
