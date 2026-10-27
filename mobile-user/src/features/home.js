// Native port of Frontend/src/features/home.tsx — customer home, worker dashboard, notifications.
import { useEffect, useState } from 'react';
import { FlatList, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlertTriangle, BadgeCheck, BadgeIndianRupee, Bell, ChevronDown, ChevronRight, Clock, CreditCard, EyeOff, Info, MapPin, MessageCircle,
  MessageSquareWarning, Search, ShieldCheck, ShieldX, UserPlus, Zap,
} from 'lucide-react-native';
import { Avatar, Badge, Button, Card, CategoryIcon, Divided, EmptyState, ErrorState, SectionTitle, Skeleton, TextLink, Toggle, TopBar, Txt, verificationLabel } from '@/components/ui';
import { PullRefresh } from '@/components/PullRefresh';
import { HeaderScrim } from '@/components/HeaderScrim';
import { WorkerCard } from '@/components/shared';
import { LocationSheet } from '@/components/LocationSheet';
import { TAB_BAR_SPACE, useTabScroll } from '@/components/TabBar';
import { errorMessage, isApiError, useBanners, useCategories, useConversations, useMarkRead, useNotifications, useWorkerDashboard, useWorkerSearch, useWorkerStatus } from '@/api';
import { useAuth, useFeature, useGeo, usePrefs } from '@/store';
import { useRadius } from '@/hooks/useAppSettings';
import { useT } from '@/i18n';
import { useLightStatusBar } from '@/hooks/useStatusBar';
import { num, timeAgo } from '@/lib/format';
import { mediaUrl } from '@/lib/media';
import { alpha, useColors } from '@/theme';

function useUnreadNotifications() {
  const { data } = useNotifications();
  return data?.filter((n) => !n.read).length ?? 0;
}

function HeaderActions() {
  const t = useT();
  const c = useColors();
  const unread = useUnreadNotifications();
  return (
    <Pressable accessibilityLabel={t('notifications')} onPress={() => router.push('/notifications')} style={st.headerBtn}>
      <Bell size={20} color="#fff" />
      {unread > 0 && <View style={[st.dot, { backgroundColor: c.accent, borderColor: c.primary }]} />}
    </Pressable>
  );
}

/** Green header background, shared by the headers and the status-bar band (HeaderScrim) so both match exactly. */
function HeaderBg() {
  const c = useColors();
  return <LinearGradient colors={[c.primary, c.primary600]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, st.headerRound]} />;
}

function HomeHeader({ onLayout }) {
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const name = useAuth((s) => s.user?.name.split(' ')[0]);
  const { point, asked, setAsked } = useGeo();
  const { radiusKm } = useRadius();
  // First visit: open the location picker once (permission is never forced).
  const [loc, setLoc] = useState(!asked);
  useEffect(() => { if (!asked) setAsked(); }, [asked, setAsked]);
  return (
    <View onLayout={onLayout} style={[st.header, { paddingTop: insets.top, paddingBottom: 24 }]}>
      <HeaderBg />
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={() => setLoc(true)} style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={st.headerBtn}><MapPin size={20} color="#fff" /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt size={12} c="rgba(255,255,255,0.75)" numberOfLines={1}>{t('hello')}, {name} 👋</Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Txt w={700} c="#ffffff" numberOfLines={1} style={{ flexShrink: 1 }}>{point?.label ?? t('setLocation')}</Txt>
              <ChevronDown size={16} color="#fff" />
            </View>
          </View>
        </Pressable>
        <HeaderActions />
      </View>
      <Pressable onPress={() => router.navigate('/search')} style={[st.searchBtn, { backgroundColor: c.surface }]}>
        <Search size={20} color={c.primary} />
        <Txt size={15} c="ink3" numberOfLines={1} style={{ flex: 1 }}>{t('searchPlaceholder')}</Txt>
        <View style={{ borderRadius: 8, backgroundColor: c.primarySoft, paddingHorizontal: 8, paddingVertical: 4 }}><Txt w={700} size={12} c="primary">{radiusKm} KM</Txt></View>
      </Pressable>
      <LocationSheet open={loc} onClose={() => setLoc(false)} />
    </View>
  );
}

// Banner tints are Tailwind gradient stops set by admin ("from-indigo-600 to-violet-500") or a CSS colour.
const TW = {
  'indigo-500': '#6366f1', 'indigo-600': '#4f46e5', 'violet-500': '#8b5cf6', 'violet-600': '#7c3aed', 'emerald-500': '#10b981', 'emerald-600': '#059669',
  'teal-500': '#14b8a6', 'teal-600': '#0d9488', 'amber-500': '#f59e0b', 'amber-600': '#d97706', 'orange-500': '#f97316', 'purple-500': '#a855f7',
  'purple-600': '#9333ea', 'blue-600': '#2563eb', 'cyan-500': '#06b6d4', 'cyan-600': '#0891b2', 'sky-500': '#0ea5e9', 'rose-500': '#f43f5e',
  'pink-500': '#ec4899', 'red-500': '#ef4444', 'fuchsia-600': '#c026d3', 'slate-700': '#334155', 'slate-900': '#0f172a', 'green-600': '#16a34a',
  'lime-500': '#84cc16', 'yellow-500': '#eab308',
};
function tintColors(tint, c) {
  const s = (tint || '').trim();
  if (/^(#|rgb|hsl)/.test(s)) return [s, s];
  const pick = (k) => {
    const m = s.match(new RegExp(`${k}-([a-z]+-\\d{3}|primary-2|primary)`));
    if (!m) return null;
    return m[1] === 'primary' ? c.primary : m[1] === 'primary-2' ? c.primary2 : TW[m[1]] ?? null;
  };
  return [pick('from') ?? c.primary, pick('to') ?? c.primary2];
}

function BannerCard({ b, width }) {
  const c = useColors();
  const open = () => {
    if (!b.link) return;
    if (b.link.startsWith('/')) router.push(b.link);
    else Linking.openURL(b.link);
  };
  return (
    <Pressable onPress={b.link ? open : undefined} disabled={!b.link} style={{ width }}>
      <LinearGradient colors={tintColors(b.tint, c)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 128, borderRadius: 18, overflow: 'hidden', padding: 16 }}>
        <Txt w={800} size={18} c="#ffffff" style={{ maxWidth: '80%', lineHeight: 22 }}>{b.title}</Txt>
        {b.subtitle ? <Txt size={14} c="rgba(255,255,255,0.85)" style={{ marginTop: 4, maxWidth: '70%' }}>{b.subtitle}</Txt> : null}
        <View style={{ position: 'absolute', right: -12, bottom: -12 }}><BadgeIndianRupee size={96} color="rgba(255,255,255,0.15)" /></View>
      </LinearGradient>
    </Pressable>
  );
}

function CustomerHome() {
  useLightStatusBar();
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const onScroll = useTabScroll();
  const lang = usePrefs((s) => s.lang);
  const user = useAuth((s) => s.user);
  const bannersOn = useFeature('banners');
  const workerReg = useFeature('workerRegistration');
  const dualRole = useFeature('dualRole');
  const canBecomeWorker = workerReg && dualRole && !user?.roles.includes('worker');
  const point = useGeo((s) => s.point);
  const { radiusKm, options } = useRadius();
  const cats = useCategories();
  const banners = useBanners(bannersOn);
  const top = useWorkerSearch({ lat: point?.lat ?? 0, lng: point?.lng ?? 0, radiusKm, sort: 'rating' }, !!point);
  const [locOpen, setLocOpen] = useState(false);
  const [bw, setBw] = useState(0);
  const [headH, setHeadH] = useState(0);
  const topList = top.data?.pages[0]?.items.slice(0, 4);
  const showBanners = bannersOn && (banners.isLoading || (banners.data?.length ?? 0) > 0);
  const cardW = bw ? bw * 0.85 : 0;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
    <ScrollView refreshControl={<PullRefresh progressViewOffset={insets.top} />} onScroll={onScroll} scrollEventThrottle={32} style={{ backgroundColor: c.bg }} contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + insets.bottom }}>
      <HomeHeader onLayout={(e) => setHeadH(e.nativeEvent.layout.height)} />
      <View style={{ gap: 28, paddingHorizontal: 16, paddingVertical: 20 }} onLayout={(e) => setBw(e.nativeEvent.layout.width - 32)}>
        {showBanners && cardW > 0 && (
          <FlatList
            horizontal
            data={banners.isLoading ? [{ id: 's1' }, { id: 's2' }] : banners.data}
            keyExtractor={(b) => b.id}
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardW + 12}
            decelerationRate="fast"
            style={{ marginHorizontal: -16 }}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
            renderItem={({ item }) => (banners.isLoading ? <Skeleton style={{ height: 128, width: cardW }} /> : <BannerCard b={item} width={cardW} />)}
          />
        )}

        {/* Categories come only from admin — hide the block until at least one exists. */}
        {cats.data?.length !== 0 && (
          <View>
            <SectionTitle action={<TextLink onPress={() => router.navigate('/search')}>{t('seeAll')}</TextLink>}>{t('categories')}</SectionTitle>
            {cats.isError ? (
              <ErrorState message={errorMessage(cats.error)} onRetry={() => cats.refetch()} />
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 }}>
                {cats.isLoading && Array.from({ length: 8 }, (_, i) => <View key={i} style={{ width: '25%', paddingHorizontal: 4 }}><Skeleton style={{ height: 80 }} /></View>)}
                {cats.data?.slice(0, 8).map((cat) => (
                  <Pressable key={cat.id} onPress={() => router.navigate({ pathname: '/search', params: { cat: cat.id } })} style={{ width: '25%', alignItems: 'center', gap: 6, paddingHorizontal: 4 }}>
                    <View style={{ width: 60, height: 60, borderRadius: 16, backgroundColor: c.surface3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {/* admin can upload a picture per category; otherwise the icon */}
                      {cat.image ? <Image source={{ uri: mediaUrl(cat.image) }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} cachePolicy="memory-disk" />
                        : <CategoryIcon name={cat.icon} slug={cat.id} size={26} color={c.ink2} />}
                    </View>
                    <Txt w={600} size={12} style={{ textAlign: 'center', lineHeight: 15 }}>{lang === 'hi' && cat.nameHi ? cat.nameHi : cat.name}</Txt>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        <View>
          <SectionTitle action={<TextLink onPress={() => router.navigate({ pathname: '/search', params: { sort: 'rating' } })}>{t('seeAll')}</TextLink>}>{t('topNearby')}</SectionTitle>
          <View style={{ gap: 12 }}>
            {!point && (
              <Card style={{ padding: 20, alignItems: 'center' }}>
                <MapPin size={24} color={c.ink2} style={{ marginBottom: 8 }} />
                <Txt w={600}>{t('setLocation')}</Txt>
                <Txt size={14} c="ink2" style={{ marginTop: 4, textAlign: 'center' }}>{t('setLocationSub')}</Txt>
                <Button size="sm" style={{ marginTop: 12 }} onPress={() => setLocOpen(true)}>{t('selectLocation')}</Button>
                <LocationSheet open={locOpen} onClose={() => setLocOpen(false)} />
              </Card>
            )}
            {point && top.isLoading && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} style={{ height: 112 }} />)}
            {top.isError && <ErrorState message={errorMessage(top.error)} onRetry={() => top.refetch()} />}
            {topList?.map((w) => <WorkerCard key={w.id} w={w} />)}
            {topList?.length === 0 && (
              <Card style={{ padding: 20, alignItems: 'center' }}>
                <Txt w={600}>{t('noWorkers')}</Txt>
                <Txt size={14} c="ink2" style={{ marginTop: 4, textAlign: 'center' }}>{t('within')} {radiusKm} KM · {point?.label}</Txt>
                {radiusKm < Math.max(...options) && <Button variant="soft" size="sm" style={{ marginTop: 12 }} onPress={() => router.navigate('/search')}>{t('increaseRadius')}</Button>}
              </Card>
            )}
          </View>
        </View>

        <View>
          <SectionTitle>{t('howItWorks')}</SectionTitle>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[[Search, 'how1', 'how1s'], [MessageCircle, 'how2', 'how2s'], [BadgeIndianRupee, 'how3', 'how3s']].map(([I, a, b], i) => (
              <Card key={a} style={{ flex: 1, padding: 12, alignItems: 'center' }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}><I size={20} color={c.ink2} /></View>
                <Txt w={700} size={13} style={{ textAlign: 'center' }}>{i + 1}. {t(a)}</Txt>
                <Txt size={11} c="ink2" style={{ textAlign: 'center', lineHeight: 14 }}>{t(b)}</Txt>
              </Card>
            ))}
          </View>
        </View>

        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}><ShieldCheck size={24} color={c.ink2} /></View>
          <View style={{ flex: 1 }}><Txt w={700}>{t('zeroCommission')}</Txt><Txt size={14} c="ink2">{t('zeroCommissionSub')}</Txt></View>
        </Card>

        {canBecomeWorker && (
          <Card onPress={() => router.push('/onboarding')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: alpha(c.accent, 0.15), alignItems: 'center', justifyContent: 'center' }}><BadgeCheck size={24} color={c.accent} /></View>
            <View style={{ flex: 1 }}><Txt w={700}>{t('becomeWorker')}</Txt><Txt size={14} c="ink2">{t('roleWorkerSub')}</Txt></View>
            <ChevronRight size={24} color={c.ink3} />
          </Card>
        )}
      </View>
    </ScrollView>
    <HeaderScrim height={headH}><HeaderBg /></HeaderScrim>
    </View>
  );
}

// ---------- Worker dashboard ----------
function toneColors(c, tone) {
  return {
    primary: { border: alpha(c.line, 0.7), bg: c.surface, fg: c.ink2 },
    success: { border: alpha(c.success, 0.3), bg: c.successSoft, fg: c.success },
    warning: { border: alpha(c.warning, 0.3), bg: c.warningSoft, fg: c.warning },
    danger: { border: alpha(c.danger, 0.3), bg: c.dangerSoft, fg: c.danger },
    neutral: { border: c.line, bg: c.surface2, fg: c.ink2 },
  }[tone];
}

function VerificationCard({ d }) {
  const t = useT();
  const c = useColors();
  const verificationOn = useFeature('verification');
  const typeLabel = d.verificationType ? verificationLabel[d.verificationType] : '';
  const cfg = {
    none: { tone: 'primary', icon: ShieldCheck, title: t('vNoneTitle'), sub: t('vNoneSub'), cta: t('getVerified') },
    pending: { tone: 'warning', icon: Clock, title: t('vPendingTitle'), sub: t('vPendingSub') },
    approved: { tone: 'success', icon: BadgeCheck, title: t('vApprovedTitle'), sub: typeLabel || t('vApprovedSub') },
    rejected: { tone: 'danger', icon: ShieldX, title: t('vRejectedTitle'), sub: d.verificationReason || t('vRejectedSub'), cta: t('resubmit') },
    info_requested: { tone: 'warning', icon: AlertTriangle, title: t('vInfoTitle'), sub: d.verificationReason || t('vInfoSub'), cta: t('submitAgain') },
  };
  const k = cfg[d.verification] ?? cfg.none;
  if (!verificationOn && d.verification !== 'approved') return null;
  const tc = toneColors(c, k.tone);
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderColor: tc.border, backgroundColor: tc.bg }}>
      <k.icon size={24} color={tc.fg} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt w={700}>{t('verificationStatus')}: {k.title}</Txt>
        <Txt size={12} c="ink2" style={{ marginTop: 2 }}>{(d.verification === 'rejected' || d.verification === 'info_requested') && d.verificationReason ? `${t('reason')}: ${k.sub}` : k.sub}</Txt>
        {k.cta && verificationOn ? (
          <Button size="sm" variant={k.tone === 'primary' ? 'primary' : 'outline'} style={{ marginTop: 12, alignSelf: 'flex-start' }} onPress={() => router.push('/verification')}>{k.cta}</Button>
        ) : null}
      </View>
    </Card>
  );
}

function WorkerHome() {
  useLightStatusBar();
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const onScroll = useTabScroll();
  const name = useAuth((s) => s.user?.name);
  const workerReg = useFeature('workerRegistration');
  const d = useWorkerDashboard();
  const convs = useConversations();
  const status = useWorkerStatus();
  const noProfile = isApiError(d.error, 'NOT_FOUND');
  const enquiries = convs.data?.filter((x) => x.myRole === 'worker').slice(0, 3);
  const stats = [
    { label: t('profileViews'), value: d.data && num(d.data.profileViews) },
    { label: t('enquiries'), value: d.data && num(d.data.enquiries) },
    { label: d.data?.reviewCount ? `${t('rating')} (${d.data.reviewCount})` : t('rating'), value: d.data && (d.data.reviewCount ? d.data.rating.toFixed(1) : '–') },
  ];
  const lifted = { elevation: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 };
  const [headH, setHeadH] = useState(0);
  const danger = toneColors(c, 'danger');
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
    <ScrollView refreshControl={<PullRefresh progressViewOffset={insets.top} />} onScroll={onScroll} scrollEventThrottle={32} style={{ backgroundColor: c.bg }} contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + insets.bottom }}>
      <View onLayout={(e) => setHeadH(e.nativeEvent.layout.height)} style={[st.header, { paddingTop: insets.top, paddingBottom: 64 }]}>
        <HeaderBg />
        <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt size={12} c="rgba(255,255,255,0.75)">{t('hello')} 👋</Txt>
            <Txt w={700} size={18} c="#ffffff" numberOfLines={1}>{name}</Txt>
          </View>
          <HeaderActions />
        </View>
      </View>
      <View style={{ marginTop: -48, gap: 16, paddingHorizontal: 16, paddingBottom: 24 }}>
        {noProfile ? (
          <Card style={[{ padding: 20, alignItems: 'center' }, lifted]}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><UserPlus size={24} color={c.ink2} /></View>
            <Txt w={700} size={18} style={{ textAlign: 'center' }}>{t('createWorkerProfile')}</Txt>
            <Txt size={14} c="ink2" style={{ marginTop: 4, textAlign: 'center' }}>{workerReg ? t('createWorkerProfileSub') : t('workerRegPaused')}</Txt>
            {workerReg && <Button style={{ marginTop: 16 }} onPress={() => router.push('/onboarding')}>{t('getStarted')}</Button>}
          </Card>
        ) : d.isError ? (
          <Card style={lifted}><ErrorState message={errorMessage(d.error)} onRetry={() => d.refetch()} /></Card>
        ) : (
          <>
            <Card style={[{ flexDirection: 'row', padding: 16 }, lifted]}>
              {stats.map(({ label, value }, i) => (
                <View key={label} style={[{ flex: 1, alignItems: 'center', paddingHorizontal: 4 }, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: c.line }]}>
                  {value === undefined ? <Skeleton style={{ height: 28, width: 40 }} /> : <Txt w={800} size={22}>{value}</Txt>}
                  <Txt size={11} c="ink2" style={{ textAlign: 'center' }}>{label}</Txt>
                </View>
              ))}
            </Card>

            {d.data?.restricted && (
              <Card style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderColor: danger.border, backgroundColor: danger.bg }}>
                <EyeOff size={24} color={c.danger} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}><Txt w={700}>{t('restrictedTitle')}</Txt><Txt size={12} c="ink2">{t('restrictedSub')}</Txt></View>
              </Card>
            )}

            <Card>
              <Divided>
                <View style={st.toggleRow}>
                  <View style={{ flex: 1 }}><Txt w={700}>{t('profileVisible')}</Txt><Txt size={12} c="ink2">{t('profileVisibleSub')}</Txt></View>
                  {d.data ? <Toggle label={t('profileVisible')} checked={d.data.visible} disabled={status.isPending} onChange={(v) => status.mutate({ visible: v })} /> : <Skeleton style={{ height: 28, width: 48, borderRadius: 14 }} />}
                </View>
                <View style={st.toggleRow}>
                  <View style={{ flex: 1 }}><Txt w={700}>{t('availableForWork')}</Txt><Txt size={12} c="ink2">{t('availableForWorkSub')}</Txt></View>
                  {d.data ? <Toggle label={t('availableForWork')} checked={d.data.available} disabled={status.isPending} onChange={(v) => status.mutate({ available: v })} /> : <Skeleton style={{ height: 28, width: 48, borderRadius: 14 }} />}
                </View>
              </Divided>
            </Card>

            {d.data && (
              <Card style={{ padding: 16 }}>
                <View style={{ marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Txt w={700} size={14}>{d.data.completion >= 100 ? t('profileComplete') : t('completeProfile')}</Txt>
                  <Txt w={700} size={14} c="primary">{d.data.completion}%</Txt>
                </View>
                <View style={{ height: 8, overflow: 'hidden', borderRadius: 4, backgroundColor: c.surface2 }}>
                  <View style={{ height: '100%', width: `${d.data.completion}%`, borderRadius: 4, backgroundColor: c.primary }} />
                </View>
                <Button variant="outline" size="sm" style={{ marginTop: 12, alignSelf: 'flex-start' }} onPress={() => router.push('/onboarding')}>{t('updateProfile')}</Button>
              </Card>
            )}

            {d.data && <VerificationCard d={d.data} />}
          </>
        )}

        <View>
          <SectionTitle action={<TextLink onPress={() => router.navigate('/chats')}>{t('seeAll')}</TextLink>}>{t('recentEnquiries')}</SectionTitle>
          {convs.isLoading ? (
            <Skeleton style={{ height: 160 }} />
          ) : enquiries?.length ? (
            <Card style={{ overflow: 'hidden' }}>
              <Divided>
                {enquiries.map((x) => (
                  <Pressable key={x.id} onPress={() => router.push(`/chats/${x.id}`)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }, pressed && { backgroundColor: c.surface2 }]}>
                    <Avatar src={x.peer.photo} name={x.peer.name} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt w={700} numberOfLines={1}>{x.peer.name}</Txt>
                      <Txt size={14} c="ink2" numberOfLines={1}>{x.lastMessage || t('newEnquiry')}</Txt>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Txt size={12} c="ink3">{timeAgo(x.lastMessageAt)}</Txt>
                      {x.unread > 0 && <View style={[st.count, { backgroundColor: c.primary }]}><Txt w={700} size={11} c="onPrimary">{x.unread}</Txt></View>}
                    </View>
                  </Pressable>
                ))}
              </Divided>
            </Card>
          ) : (
            <Card style={{ padding: 20, alignItems: 'center' }}>
              <MessageCircle size={24} color={c.ink3} style={{ marginBottom: 8 }} />
              <Txt size={14} c="ink2" style={{ textAlign: 'center' }}>{t('noEnquiries')}</Txt>
            </Card>
          )}
        </View>
      </View>
    </ScrollView>
    <HeaderScrim height={headH}><HeaderBg /></HeaderScrim>
    </View>
  );
}

export function Home() {
  const role = useAuth((s) => s.user?.activeRole);
  return role === 'worker' ? <WorkerHome /> : <CustomerHome />;
}

// ---------- Notifications ----------
const nIcon = { chat: MessageCircle, subscription: CreditCard, verification: BadgeCheck, complaint: MessageSquareWarning, system: Info };

export function Notifications() {
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, error, refetch } = useNotifications();
  const mark = useMarkRead();
  const unread = data?.some((n) => !n.read);
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <TopBar title={t('notifications')} right={unread ? <Pressable onPress={() => mark.mutate('all')} style={{ paddingHorizontal: 12 }}><Txt w={600} size={14} c="primary">{t('markAllRead')}</Txt></Pressable> : undefined} />
      <FlatList refreshControl={<PullRefresh />}
        data={data ?? []}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.line }} />}
        ListHeaderComponent={
          <>
            {isLoading && <View style={{ gap: 8, padding: 16 }}>{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} style={{ height: 64 }} />)}</View>}
            {isError && <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />}
            {data?.length === 0 && <EmptyState icon={Bell} title={t('noNotifications')} sub={t('noNotificationsSub')} />}
          </>
        }
        renderItem={({ item: n }) => {
          const I = nIcon[n.type] ?? Zap;
          return (
            <Pressable
              onPress={() => {
                if (!n.read) mark.mutate(n.id);
                if (n.link?.startsWith('/')) router.push(n.link);
                else if (n.link) Linking.openURL(n.link);
              }}
              style={({ pressed }) => [{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 14 }, !n.read && { backgroundColor: alpha(c.primarySoft, 0.6) }, pressed && { backgroundColor: c.surface2 }]}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}><I size={18} color={c.ink2} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                  <Txt w={700} style={{ flex: 1 }}>{n.title}</Txt>
                  {!n.read && <Badge tone="primary">{t('new')}</Badge>}
                </View>
                {n.body ? <Txt size={14} c="ink2">{n.body}</Txt> : null}
                <Txt size={12} c="ink3">{timeAgo(n.createdAt)}</Txt>
              </View>
              {n.link ? <ChevronRight size={18} color={c.ink3} style={{ marginTop: 8 }} /> : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const st = StyleSheet.create({
  header: { borderBottomLeftRadius: 28, borderBottomRightRadius: 28, paddingHorizontal: 16, overflow: 'hidden' },
  headerRound: { borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 8, right: 10, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  searchBtn: { marginTop: 12, height: 48, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingHorizontal: 16, elevation: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 12 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  count: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
});
