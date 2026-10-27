// Native port of Frontend/src/features/search.tsx — infinite FlatList instead of IntersectionObserver.
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowUpDown, MapPin, Search as SearchIcon, SearchX, SlidersHorizontal, X } from 'lucide-react-native';
import { Button, Chip, EmptyState, ErrorState, Sheet, Skeleton, Toggle, Txt } from '@/components/ui';
import { PullRefresh } from '@/components/PullRefresh';
import { WorkerCard } from '@/components/shared';
import { LocationSheet } from '@/components/LocationSheet';
import { TAB_BAR_SPACE, useTabScroll } from '@/components/TabBar';
import { errorMessage, useCategories, useWorkerSearch } from '@/api';
import { useGeo, usePrefs } from '@/store';
import { useDebounced, useRadius } from '@/hooks/useAppSettings';
import { useT } from '@/i18n';
import { alpha, fonts, useColors } from '@/theme';

const SORTS = ['distance', 'rating', 'recent'];

export function SearchPage() {
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const onScroll = useTabScroll();
  const lang = usePrefs((s) => s.lang);
  const sp = useLocalSearchParams();
  const point = useGeo((s) => s.point);
  const { radiusKm, options, setRadius } = useRadius();
  const cats = useCategories();
  const [text, setText] = useState(typeof sp.q === 'string' ? sp.q : '');
  const q = useDebounced(text.trim().slice(0, 60)); // one API call after typing stops
  const categoryId = typeof sp.cat === 'string' && sp.cat ? sp.cat : undefined;
  const sort = SORTS.includes(sp.sort) ? sp.sort : 'distance';
  const [filters, setFilters] = useState({});
  const [draft, setDraft] = useState({});
  const [sheet, setSheet] = useState(null);

  const params = useMemo(
    () => ({ lat: point?.lat ?? 0, lng: point?.lng ?? 0, radiusKm, q: q || undefined, categoryId, sort, ...filters }),
    [point?.lat, point?.lng, radiusKm, q, categoryId, sort, filters],
  );
  const res = useWorkerSearch(params, !!point); // no search until the user has set a location
  const items = res.data?.pages.flatMap((p) => p.items) ?? [];
  const total = res.data?.pages[0]?.total ?? 0;
  const nextRadius = options.find((r) => r > radiusKm);

  const setParam = (k, v) => router.setParams({ [k]: v || undefined });
  // Keep ?q= in the route so coming back from a profile restores the search.
  useEffect(() => {
    if ((sp.q ?? '') !== q) setParam('q', q || undefined);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeFilters = Object.values(filters).filter(Boolean).length;
  const sortLabel = { distance: t('sortDistance'), rating: t('sortRating'), recent: t('sortRecent') };
  const refreshing = res.isFetching && !res.isFetchingNextPage && !res.isLoading;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: insets.top, backgroundColor: c.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: alpha(c.line, 0.9), zIndex: 30 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 12 }}>
          <View style={[st.searchBox, { backgroundColor: c.surface2 }]}>
            <SearchIcon size={20} color={c.ink3} />
            <TextInput
              value={text} maxLength={60} onChangeText={setText} placeholder={t('searchPlaceholder')} accessibilityLabel={t('search')} returnKeyType="search"
              placeholderTextColor={c.ink3} selectionColor={c.primary} style={{ flex: 1, height: '100%', color: c.ink, fontFamily: fonts[400], fontSize: 15, padding: 0 }}
            />
            {text ? <Pressable accessibilityLabel="Clear" onPress={() => setText('')} hitSlop={8}><X size={18} color={c.ink3} /></Pressable> : null}
          </View>
          <Pressable accessibilityLabel={t('filters')} onPress={() => { setDraft(filters); setSheet('filter'); }} style={[st.filterBtn, { backgroundColor: c.surface2 }]}>
            <SlidersHorizontal size={20} color={c.ink} />
            {activeFilters > 0 && <View style={[st.filterCount, { backgroundColor: c.primary }]}><Txt size={10} c="onPrimary">{activeFilters}</Txt></View>}
          </Pressable>
        </View>
        <Pressable onPress={() => setSheet('loc')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingTop: 8 }}>
          <MapPin size={14} color={c.primary} />
          <Txt size={14} c="ink2" numberOfLines={1} style={{ flexShrink: 1 }}>{point?.label ?? t('setLocation')}</Txt>
          <Txt w={600} size={14} c="primary">· {radiusKm} KM</Txt>
        </Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
          <Chip active={!categoryId} onPress={() => setParam('cat')}>{t('all')}</Chip>
          {cats.isLoading && [0, 1, 2, 3].map((i) => <Skeleton key={i} style={{ height: 36, width: 96, borderRadius: 18 }} />)}
          {cats.data?.map((cat) => <Chip key={cat.id} active={categoryId === cat.id} onPress={() => setParam('cat', cat.id)}>{lang === 'hi' && cat.nameHi ? cat.nameHi : cat.name}</Chip>)}
        </ScrollView>
      </View>

      <FlatList refreshControl={<PullRefresh />}
        data={items}
        keyExtractor={(w) => w.id}
        onScroll={onScroll}
        scrollEventThrottle={32}
        keyboardShouldPersistTaps="handled"
        style={{ opacity: refreshing ? 0.6 : 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: TAB_BAR_SPACE + insets.bottom }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => <WorkerCard w={item} />}
        onEndReachedThreshold={0.6}
        onEndReached={() => { if (res.hasNextPage && !res.isFetchingNextPage && !res.isError) res.fetchNextPage(); }}
        ListHeaderComponent={
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, paddingBottom: 8 }}>
              <Txt size={14} c="ink2">{!point ? null : res.isLoading ? '…' : <><Txt w={700} size={14}>{total}</Txt> {t('results')} · {t('within')} {radiusKm} KM</>}</Txt>
              <Pressable onPress={() => setSheet('sort')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <ArrowUpDown size={15} color={c.primary} /><Txt w={600} size={14} c="primary">{sortLabel[sort]}</Txt>
              </Pressable>
            </View>
            {!point && (
              <EmptyState icon={MapPin} title={t('setLocation')} sub={t('setLocationSub')} action={<Button onPress={() => setSheet('loc')}>{t('selectLocation')}</Button>} />
            )}
            {point && res.isLoading && <View style={{ gap: 12 }}>{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} style={{ height: 112 }} />)}</View>}
            {res.isError && !items.length && <ErrorState message={errorMessage(res.error)} onRetry={() => res.refetch()} />}
            {res.isSuccess && items.length === 0 && (
              <EmptyState
                icon={SearchX} title={t('noWorkers')} sub={t('noWorkersSub')}
                action={
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
                    <Button variant="outline" onPress={() => setSheet('loc')}>{t('changeLocation')}</Button>
                    {nextRadius && <Button onPress={() => setRadius(nextRadius)}>{t('increaseRadius')} · {nextRadius} KM</Button>}
                  </View>
                }
              />
            )}
          </View>
        }
        ListFooterComponent={
          <View style={{ marginTop: 12, gap: 12 }}>
            {res.isFetchingNextPage && <Skeleton style={{ height: 112 }} />}
            {res.isError && items.length > 0 && <Button variant="outline" block onPress={() => res.fetchNextPage()}>{t('retry')}</Button>}
            {!res.hasNextPage && items.length > 8 && <Txt size={12} c="ink3" style={{ paddingVertical: 8, textAlign: 'center' }}>{t('endOfResults')}</Txt>}
          </View>
        }
      />

      <Sheet open={sheet === 'filter'} onClose={() => setSheet(null)} title={t('filters')}>
        <Txt w={600} size={14} c="ink2" style={{ marginBottom: 8 }}>{t('searchRadius')}</Txt>
        <View style={{ marginBottom: 20, flexDirection: 'row', gap: 8 }}>{options.map((r) => <Chip key={r} active={radiusKm === r} onPress={() => setRadius(r)}>{r} KM</Chip>)}</View>
        <Txt w={600} size={14} c="ink2" style={{ marginBottom: 8 }}>{t('minRating')}</Txt>
        <View style={{ marginBottom: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[undefined, 3, 4, 4.5].map((r) => <Chip key={String(r)} active={draft.minRating === r} onPress={() => setDraft({ ...draft, minRating: r })}>{r ? `${r}★ +` : t('any')}</Chip>)}
        </View>
        {[['verifiedOnly', t('verifiedOnly')], ['availableOnly', t('availableNow')]].map(([k, label]) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, paddingVertical: 16 }}>
            <Txt w={500}>{label}</Txt>
            <Toggle label={label} checked={!!draft[k]} onChange={(v) => setDraft({ ...draft, [k]: v || undefined })} />
          </View>
        ))}
        <View style={{ marginTop: 8, flexDirection: 'row', gap: 8 }}>
          <Button variant="outline" grow onPress={() => { setDraft({}); setFilters({}); setSheet(null); }}>{t('reset')}</Button>
          <Button grow onPress={() => { setFilters(draft); setSheet(null); }}>{t('apply')}</Button>
        </View>
      </Sheet>

      <Sheet open={sheet === 'sort'} onClose={() => setSheet(null)} title={t('sort')}>
        {SORTS.map((k, i) => (
          <Pressable key={k} onPress={() => { setParam('sort', k === 'distance' ? undefined : k); setSheet(null); }}
            style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 }, i < SORTS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line }]}>
            <Txt w={500}>{sortLabel[k]}</Txt>
            <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: sort === k ? 6 : 2, borderColor: sort === k ? c.primary : c.line }} />
          </Pressable>
        ))}
      </Sheet>
      <LocationSheet open={sheet === 'loc'} onClose={() => setSheet(null)} />
    </View>
  );
}

const st = StyleSheet.create({
  searchBox: { flex: 1, height: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, paddingHorizontal: 14 },
  filterBtn: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  filterCount: { position: 'absolute', top: 8, right: 8, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
