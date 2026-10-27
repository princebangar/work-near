// Native port of Frontend/src/features/worker.tsx — public worker profile + worker's own profile.
import { useState } from 'react';
import { Linking, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import {
  Ban, BadgeCheck, Briefcase, Camera, Clock, Flag, ImagePlus, Languages, MapPin, MessageCircle, MoreVertical, Pencil, Phone, Share2, Star, Trash2, UserPlus, UserX,
} from 'lucide-react-native';
import { Avatar, Badge, Button, Card, Divided, EmptyState, ErrorState, IconButton, Rating, Sheet, Skeleton, Stars, TopBar, Txt, VerifiedBadge } from '@/components/ui';
import { PullRefresh } from '@/components/PullRefresh';
import { ImageViewer, ReportSheet, ReviewSheet } from '@/components/shared';
import { TAB_BAR_SPACE, useTabScroll } from '@/components/TabBar';
import {
  errorMessage, isApiError, toastError, useBlockUser, useConversations, useDeletePortfolio, useMyWorkerProfile, useReviewEligibility, useStartConversation,
  useUploadPortfolio, useWorker,
} from '@/api';
import { useAuth, useFeature, useGeo, toast } from '@/store';
import { useT } from '@/i18n';
import { km, timeAgo } from '@/lib/format';
import { mediaUrl, pickFiles } from '@/lib/media';
import { env } from '@/config/env';
import { useColors } from '@/theme';

const MAX_PORTFOLIO = 12;
const PER_UPLOAD = 6;

function ProfileBody({ w, preview, hidePortfolio }) {
  const t = useT();
  const c = useColors();
  const portfolioOn = useFeature('portfolio');
  const [viewing, setViewing] = useState(null);
  const facts = [
    { icon: Briefcase, label: t('experience'), value: `${w.experienceYrs} ${t('years')}` },
    { icon: MapPin, label: t('serviceArea'), value: `${w.locality} · ${w.serviceRadiusKm} KM` },
    { icon: Clock, label: t('workingHours'), value: w.hours },
    { icon: Languages, label: t('languages'), value: w.languages.join(', ') },
  ].filter((f) => f.value);
  const showPortfolio = portfolioOn && !hidePortfolio && w.portfolio.length > 0;
  return (
    <>
      <View style={{ backgroundColor: c.surface, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20, alignItems: 'center' }}>
        <View style={{ borderRadius: 52, borderWidth: 4, borderColor: c.primarySoft }}><Avatar src={w.photo} name={w.name} size={96} /></View>
        <Txt w={800} size={20} style={{ marginTop: 12, textAlign: 'center' }}>{w.name}</Txt>
        <Txt c="ink2" size={16}>{w.categoryName}</Txt>
        {w.verification && <View style={{ marginTop: 6 }}><VerifiedBadge type={w.verification} /></View>}
        <View style={[st.statRow, { backgroundColor: c.surface2 }]}>
          <View style={st.stat}>
            <Rating value={w.rating} count={w.reviewCount ? undefined : 0} />
            <Txt size={11} c="ink2">{w.reviewCount} {t('reviews')}</Txt>
          </View>
          <View style={[st.stat, st.statDiv, { borderColor: c.line }]}>
            {preview
              ? <><Txt w={700} size={16}>{w.serviceRadiusKm} KM</Txt><Txt size={11} c="ink2">{t('serviceRadius')}</Txt></>
              : <><Txt w={700} size={16}>{km(w.distanceKm)}</Txt><Txt size={11} c="ink2">{t('away')}</Txt></>}
          </View>
          <View style={st.stat}>
            <Txt w={700} size={16} c={w.available ? 'success' : 'ink3'}>{w.available ? t('available') : t('busy')}</Txt>
            <Txt size={11} c="ink2">{t('active')} {timeAgo(w.lastActiveAt)}</Txt>
          </View>
        </View>
      </View>
      <View style={{ gap: 12, padding: 16 }}>
        <Card style={{ padding: 16 }}>
          <Txt w={700} style={{ marginBottom: 4 }}>{t('about')}</Txt>
          <Txt size={14} c="ink2" style={{ lineHeight: 22 }}>{w.bio || t('noBio')}</Txt>
          {w.priceRange ? <Txt size={14} style={{ marginTop: 8 }}><Txt w={700} size={14}>{t('indicativePrice')}:</Txt> <Txt size={14} c="ink2">{w.priceRange}</Txt></Txt> : null}
        </Card>
        <Card>
          <Divided>
            {facts.map(({ icon: I, label, value }) => (
              <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}><I size={17} color={c.ink2} /></View>
                <Txt size={14} c="ink2" style={{ flex: 1 }}>{label}</Txt>
                <Txt w={700} size={14} style={{ maxWidth: '60%', textAlign: 'right' }}>{value}</Txt>
              </View>
            ))}
          </Divided>
        </Card>
        {w.skills.length > 0 && (
          <Card style={{ padding: 16 }}>
            <Txt w={700} style={{ marginBottom: 8 }}>{t('skills')}</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {w.skills.map((sk) => <Badge key={sk} tone="primary" style={{ paddingHorizontal: 12, paddingVertical: 4 }} textStyle={{ fontSize: 12 }}>{sk}</Badge>)}
            </View>
          </Card>
        )}
        {showPortfolio && (
          <Card style={{ paddingVertical: 16 }}>
            <Txt w={700} style={{ marginBottom: 8, paddingHorizontal: 16 }}>{t('portfolio')}</Txt>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
              {w.portfolio.map((src) => (
                <Pressable key={src} onPress={() => setViewing(src)} accessibilityLabel={t('viewPhoto')}>
                  <Image source={{ uri: mediaUrl(src) }} style={{ height: 112, width: 160, borderRadius: 12, backgroundColor: c.surface2 }} contentFit="cover" cachePolicy="memory-disk" />
                </Pressable>
              ))}
            </ScrollView>
          </Card>
        )}
        <Card style={{ padding: 16 }}>
          <Txt w={700} style={{ marginBottom: 12 }}>{t('reviews')}</Txt>
          {w.reviewCount === 0 ? (
            <Txt size={14} c="ink2">{t('noReviews')}</Txt>
          ) : (
            <>
              <View style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <View style={{ alignItems: 'center' }}>
                  <Txt w={700} size={30}>{w.rating.toFixed(1)}</Txt>
                  <Stars value={w.rating} size={12} />
                  <Txt size={11} c="ink3">{w.reviewCount} {t('reviews')}</Txt>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  {[5, 4, 3, 2, 1].map((sn) => (
                    <View key={sn} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Txt size={12} style={{ width: 8 }}>{sn}</Txt>
                      <View style={{ height: 6, flex: 1, borderRadius: 3, backgroundColor: c.surface2 }}>
                        <View style={{ height: '100%', borderRadius: 3, backgroundColor: c.accent, width: `${w.ratingBreakdown?.[sn] ?? 0}%` }} />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
              <Divided>
                {w.reviews.map((r) => (
                  <View key={r.id} style={{ paddingVertical: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Avatar src={r.reviewerPhoto} name={r.reviewerName} size={32} />
                      <Txt w={700} size={14} style={{ flex: 1 }}>{r.reviewerName}</Txt>
                      <Txt size={12} c="ink3">{timeAgo(r.createdAt)}</Txt>
                    </View>
                    <View style={{ marginTop: 6 }}><Stars value={r.stars} size={12} /></View>
                    {r.text ? <Txt size={14} c="ink2" style={{ marginTop: 4 }}>{r.text}</Txt> : null}
                  </View>
                ))}
              </Divided>
            </>
          )}
          <Txt size={11} c="ink3" style={{ marginTop: 8 }}>{t('reviewsDisclaimer')}</Txt>
        </Card>
      </View>
      <ImageViewer src={viewing} onClose={() => setViewing(null)} />
    </>
  );
}

function ProfileSkeleton() {
  return (
    <View style={{ gap: 12, padding: 16 }}>
      <Skeleton style={{ alignSelf: 'center', width: 96, height: 96, borderRadius: 48 }} />
      <Skeleton style={{ alignSelf: 'center', height: 24, width: 160 }} />
      <Skeleton style={{ height: 64 }} /><Skeleton style={{ height: 112 }} /><Skeleton style={{ height: 160 }} />
    </View>
  );
}

const WhatsApp = ({ color }) => (
  <Svg viewBox="0 0 24 24" width={20} height={20}>
    <Path fill={color} d="M17.5 14.4c-.3-.1-1.8-.9-2-1s-.5-.1-.7.2-.8 1-1 1.2-.4.2-.7.1a8 8 0 0 1-2.4-1.5 9 9 0 0 1-1.6-2c-.2-.3 0-.5.1-.6l.5-.6.3-.5v-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6a1.1 1.1 0 0 0-.8.4 3.4 3.4 0 0 0-1 2.5 5.9 5.9 0 0 0 1.2 3.1 13.4 13.4 0 0 0 5.2 4.6c.7.3 1.3.5 1.7.6a4.2 4.2 0 0 0 1.9.1 3.1 3.1 0 0 0 2-1.4 2.5 2.5 0 0 0 .2-1.4c-.1-.1-.3-.2-.6-.3ZM12 21.8a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4a9.8 9.8 0 1 1 8.3 4.6ZM20.4 3.5A11.8 11.8 0 0 0 1.8 17.7L.1 24l6.4-1.7A11.8 11.8 0 0 0 24 12a11.7 11.7 0 0 0-3.6-8.5Z" />
  </Svg>
);

export function WorkerProfile() {
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id = '' } = useLocalSearchParams();
  const me = useAuth((s) => s.user?.id);
  const point = useGeo((s) => s.point);
  const chatOn = useFeature('chat');
  const reviewsOn = useFeature('reviews');
  const reportsOn = useFeature('reports');
  const { data: w, isLoading, error, refetch } = useWorker(id, point ?? undefined);
  const self = !!w && w.id === me;
  const convs = useConversations();
  const eligibility = useReviewEligibility(id, reviewsOn && !self && !!w);
  const start = useStartConversation();
  const block = useBlockUser();
  const [sheet, setSheet] = useState(null);

  if (isLoading) return <View style={{ flex: 1, backgroundColor: c.bg }}><TopBar /><ProfileSkeleton /></View>;
  if (!w) {
    return (
      <View style={{ flex: 1, backgroundColor: c.surface }}>
        <TopBar />
        {isApiError(error, 'NOT_FOUND')
          ? <EmptyState icon={UserX} title={t('profileUnavailable')} sub={t('profileUnavailableSub')} action={<Button onPress={() => router.navigate('/search')}>{t('search')}</Button>} />
          : <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />}
      </View>
    );
  }

  const startChat = () => {
    const existing = convs.data?.find((x) => x.peer.id === w.id && x.myRole === 'customer');
    if (existing) return router.push(`/chats/${existing.id}`);
    start.mutate(w.id, {
      onSuccess: (x) => router.push(`/chats/${x.id}`),
      onError: (e) => {
        if (isApiError(e, 'SUBSCRIPTION_REQUIRED')) {
          toast(e.message, 'info');
          router.push('/subscription');
        } else toastError(e);
      },
    });
  };
  const openReview = () => {
    if (eligibility.data?.eligible) setSheet('review');
    else if (eligibility.data) toast(eligibility.data.reason ?? t('cannotReview'), 'info');
    else if (eligibility.error) toastError(eligibility.error);
  };
  const share = () => {
    const url = `${env.webOrigin}/worker/${w.id}`;
    Share.share({ title: w.name, message: `${w.name} · ${w.categoryName}\n${url}` }).catch(() => undefined);
  };
  const doBlock = () =>
    block.mutate(w.id, {
      onSuccess: () => { toast(`${w.name} ${t('blockedToast')}`); setSheet(null); router.back(); },
      onError: (e) => toastError(e),
    });
  const phone = w.phone?.replace(/\D/g, '').slice(-10);
  const showBar = !self && (chatOn || reviewsOn || !!phone);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar
        right={<>
          <IconButton label={t('share')} onPress={share}><Share2 size={20} color={c.ink} /></IconButton>
          {!self && <IconButton label={t('more')} onPress={() => setSheet('menu')}><MoreVertical size={20} color={c.ink} /></IconButton>}
        </>}
      />
      <ScrollView refreshControl={<PullRefresh />} contentContainerStyle={{ paddingBottom: showBar ? 112 + insets.bottom : insets.bottom + 16 }}>
        {self && <Txt w={500} size={12} c="primary" style={[st.note, { backgroundColor: c.primarySoft, marginHorizontal: 16, marginTop: 12 }]}>{t('ownPublicProfile')}</Txt>}
        <ProfileBody w={w} />
      </ScrollView>

      {showBar && (
        <View style={[st.bar, { backgroundColor: c.surface, borderTopColor: c.line, paddingBottom: 12 + insets.bottom }]}>
          {phone && (
            <>
              <Pressable accessibilityLabel={t('call')} onPress={() => Linking.openURL(`tel:+91${phone}`)} style={[st.sq, { borderColor: c.line, backgroundColor: c.surface }]}><Phone size={20} color={c.primary} /></Pressable>
              <Pressable accessibilityLabel="WhatsApp" onPress={() => Linking.openURL(`https://wa.me/91${phone}`)} style={[st.sq, { borderColor: c.line, backgroundColor: c.surface }]}><WhatsApp color={c.success} /></Pressable>
            </>
          )}
          {reviewsOn && (
            <Button variant="outline" size="lg" grow={!chatOn} icon={Star} style={!eligibility.data?.eligible && { opacity: 0.85 }} loading={eligibility.isLoading} onPress={openReview}>
              {chatOn ? t('review') : t('writeReview')}
            </Button>
          )}
          {chatOn && <Button size="lg" grow icon={MessageCircle} loading={start.isPending} onPress={startChat}>{t('chatNow')}</Button>}
        </View>
      )}

      <Sheet open={sheet === 'menu'} onClose={() => setSheet(null)} title={w.name}>
        {reportsOn && <Pressable onPress={() => setSheet('report')} style={st.menuRow}><Flag size={20} color={c.danger} /><Txt w={500} c="danger">{t('report')}</Txt></Pressable>}
        <Pressable onPress={() => setSheet('block')} style={st.menuRow}><Ban size={20} color={c.ink} /><Txt w={500}>{t('block')}</Txt></Pressable>
      </Sheet>
      <Sheet open={sheet === 'block'} onClose={() => setSheet(null)} title={`${t('block')} ${w.name}?`}>
        <Txt size={14} c="ink2" style={{ marginBottom: 20 }}>{t('blockExplain')}</Txt>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button variant="outline" grow onPress={() => setSheet(null)}>{t('cancel')}</Button>
          <Button variant="danger" grow loading={block.isPending} onPress={doBlock}>{t('block')}</Button>
        </View>
      </Sheet>
      <ReportSheet open={sheet === 'report'} onClose={() => setSheet(null)} targetType="profile" targetId={w.id} />
      <ReviewSheet open={sheet === 'review'} onClose={() => setSheet(null)} workerId={w.id} workerName={w.name} />
    </View>
  );
}

// ---------- My profile (worker) ----------
function PortfolioManager({ photos }) {
  const t = useT();
  const c = useColors();
  const up = useUploadPortfolio();
  const del = useDeletePortfolio();
  const [viewing, setViewing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const room = MAX_PORTFOLIO - photos.length;
  const add = async () => {
    const files = await pickFiles({ multiple: true, max: Math.min(room, PER_UPLOAD) });
    if (files.length) up.mutate(files, { onSuccess: () => toast(t('photosAdded')), onError: (e) => toastError(e) });
  };
  const cell = { width: '31.5%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden' };
  return (
    <Card style={{ padding: 16 }}>
      <View style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt w={700}>{t('portfolio')}</Txt>
        <Txt size={12} c="ink3">{photos.length}/{MAX_PORTFOLIO}</Txt>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {photos.map((src) => (
          <View key={src} style={[cell, { backgroundColor: c.surface2 }]}>
            <Pressable style={{ flex: 1 }} onPress={() => setViewing(src)} accessibilityLabel={t('viewPhoto')}>
              <Image source={{ uri: mediaUrl(src) }} style={{ flex: 1 }} contentFit="cover" cachePolicy="memory-disk" />
            </Pressable>
            <Pressable accessibilityLabel={t('delete')} onPress={() => setConfirm(src)} style={st.del}><Trash2 size={14} color="#fff" /></Pressable>
          </View>
        ))}
        {up.isPending && <Skeleton style={cell} />}
        {room > 0 && !up.isPending && (
          <Pressable onPress={add} style={[cell, { borderWidth: 2, borderStyle: 'dashed', borderColor: c.line, alignItems: 'center', justifyContent: 'center', gap: 4 }]}>
            <ImagePlus size={22} color={c.ink2} /><Txt w={600} size={11} c="ink2">{t('addPhotos')}</Txt>
          </Pressable>
        )}
      </View>
      <Txt size={12} c="ink3" style={{ marginTop: 8 }}>{t('portfolioHint')}</Txt>
      <ImageViewer src={viewing} onClose={() => setViewing(null)} />
      <Sheet open={!!confirm} onClose={() => setConfirm(null)} title={t('deletePhoto')}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button variant="outline" grow onPress={() => setConfirm(null)}>{t('cancel')}</Button>
          <Button variant="danger" grow loading={del.isPending} onPress={() => confirm && del.mutate(confirm, { onSuccess: () => setConfirm(null), onError: (e) => toastError(e) })}>{t('delete')}</Button>
        </View>
      </Sheet>
    </Card>
  );
}

export function MyProfile() {
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const onScroll = useTabScroll();
  const portfolioOn = useFeature('portfolio');
  const workerReg = useFeature('workerRegistration');
  const { data: w, isLoading, error, refetch } = useMyWorkerProfile();
  const head = <TopBar onBack={() => router.navigate('/account')} title={t('myProfile')} right={w ? <Button size="sm" variant="soft" icon={Pencil} style={{ marginRight: 8 }} onPress={() => router.push('/onboarding')}>{t('editProfile')}</Button> : undefined} />;
  if (isLoading) return <View style={{ flex: 1, backgroundColor: c.bg }}>{head}<View style={{ gap: 12, padding: 16 }}><Skeleton style={{ height: 240 }} /><Skeleton style={{ height: 160 }} /></View></View>;
  if (error) return <View style={{ flex: 1, backgroundColor: c.bg }}>{head}<ErrorState message={errorMessage(error)} onRetry={() => refetch()} /></View>;
  if (!w) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        {head}
        <EmptyState icon={UserPlus} title={t('createWorkerProfile')} sub={workerReg ? t('createWorkerProfileSub') : t('workerRegPaused')}
          action={workerReg && <Button onPress={() => router.push('/onboarding')}>{t('getStarted')}</Button>} />
      </View>
    );
  }
  const vsLabel = { none: t('vsNone'), pending: t('vPendingTitle'), approved: t('vApprovedTitle'), rejected: t('vRejectedTitle'), info_requested: t('vInfoTitle') };
  const vTone = w.verificationStatus === 'approved' ? 'success' : w.verificationStatus === 'rejected' ? 'danger' : w.verificationStatus === 'none' ? 'neutral' : 'warning';
  const changePhoto = () => router.push('/onboarding');
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {head}
      <ScrollView refreshControl={<PullRefresh />} onScroll={onScroll} scrollEventThrottle={32} contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + insets.bottom }}>
        <View style={{ gap: 12, paddingHorizontal: 16, paddingTop: 12 }}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
            <Pressable onPress={changePhoto} accessibilityLabel={t('changePhoto')}>
              <Avatar src={w.photo} name={w.name} size={56} />
              <View style={[st.cam, { backgroundColor: c.primary, borderColor: c.surface }]}><Camera size={12} color={c.onPrimary} /></View>
            </Pressable>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                <Badge tone={w.visible && !w.restricted ? 'success' : 'neutral'}>{w.restricted ? t('hiddenByAdmin') : w.visible ? t('live') : t('paused')}</Badge>
                <Badge tone={vTone} icon={BadgeCheck}>{vsLabel[w.verificationStatus]}</Badge>
              </View>
              <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ height: 6, flex: 1, overflow: 'hidden', borderRadius: 3, backgroundColor: c.surface2 }}>
                  <View style={{ height: '100%', borderRadius: 3, backgroundColor: c.primary, width: `${w.completion}%` }} />
                </View>
                <Txt w={700} size={12} c="primary">{w.completion}%</Txt>
              </View>
              <Txt size={11} c="ink3">{w.profileViews} {t('profileViews').toLowerCase()}</Txt>
            </View>
          </Card>
          {portfolioOn && <PortfolioManager photos={w.portfolio} />}
          <Txt w={500} size={12} c="primary" style={[st.note, { backgroundColor: c.primarySoft }]}>{t('previewNote')}</Txt>
        </View>
        <ProfileBody w={w} preview hidePortfolio={portfolioOn} />
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  statRow: { marginTop: 16, flexDirection: 'row', alignSelf: 'stretch', borderRadius: 16, paddingVertical: 12 },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statDiv: { borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth },
  note: { borderRadius: 12, padding: 12, textAlign: 'center', overflow: 'hidden' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 30, flexDirection: 'row', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingTop: 12 },
  sq: { width: 52, height: 52, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  del: { position: 'absolute', top: 4, right: 4, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  cam: { position: 'absolute', right: -4, bottom: -4, width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
