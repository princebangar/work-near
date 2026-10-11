import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  AlertTriangle, BadgeCheck, BadgeIndianRupee, Bell, ChevronDown, ChevronRight, Clock, CreditCard, Eye, EyeOff, Info, MapPin,
  MessageCircle, MessageSquareWarning, Search, ShieldCheck, ShieldX, Star, UserPlus, Zap,
} from 'lucide-react';
import { Avatar, Badge, Button, Card, CategoryIcon, EmptyState, ErrorState, SectionTitle, Skeleton, Toggle, TopBar, verificationLabel, type Tone } from '@/components/ui';
import { LocationSheet, WorkerCard } from '@/components/shared';
import {
  errorMessage, isApiError, useBanners, useCategories, useConversations, useMarkRead, useNotifications, useWorkerDashboard, useWorkerSearch, useWorkerStatus,
} from '@/api';
import { useAuth, useFeature, useGeo, usePrefs } from '@/store';
import { useRadius } from '@/hooks/useAppSettings';
import { useT } from '@/i18n';
import { cn, num, timeAgo } from '@/lib/format';
import type { Banner, NotificationType, VerificationType, WorkerDashboard } from '@/types';

function useUnreadNotifications() {
  const { data } = useNotifications();
  return data?.filter((n) => !n.read).length ?? 0;
}

function HeaderActions() {
  const nav = useNavigate();
  const t = useT();
  const unread = useUnreadNotifications();
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button aria-label={t('notifications')} onClick={() => nav('/notifications')} className="relative grid size-10 place-items-center rounded-full bg-white/15">
        <Bell size={20} />
        {unread > 0 && <span className="absolute top-2 right-2.5 size-2.5 rounded-full bg-accent ring-2 ring-primary" />}
      </button>
    </div>
  );
}

function HomeHeader() {
  const t = useT();
  const nav = useNavigate();
  const name = useAuth((s) => s.user?.name.split(' ')[0]);
  const { point, asked, setAsked } = useGeo();
  const { radiusKm } = useRadius();
  // First visit: open the location picker once (permission is never forced).
  const [loc, setLoc] = useState(!asked);
  useEffect(() => { if (!asked) setAsked(); }, [asked, setAsked]);
  return (
    <div className="pt-safe rounded-b-[28px] bg-gradient-to-br from-primary to-primary-600 px-4 pb-6 text-white">
      <div className="flex h-14 items-center gap-3">
        <button onClick={() => setLoc(true)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/15"><MapPin size={20} /></span>
          <span className="min-w-0">
            <span className="block truncate text-xs text-white/75">{t('hello')}, {name} 👋</span>
            <span className="flex items-center gap-1 text-[15px] font-bold"><span className="truncate">{point.label}</span><ChevronDown size={16} className="shrink-0" /></span>
          </span>
        </button>
        <HeaderActions />
      </div>
      <button onClick={() => nav('/search')} className="mt-3 flex h-12 w-full items-center gap-3 rounded-2xl bg-surface px-4 text-left text-ink-3 shadow-lg shadow-black/10">
        <Search size={20} className="text-primary" />
        <span className="flex-1 truncate text-[15px]">{t('searchPlaceholder')}</span>
        <span className="rounded-lg bg-primary-soft px-2 py-1 text-xs font-bold text-primary">{radiusKm} KM</span>
      </button>
      <LocationSheet open={loc} onClose={() => setLoc(false)} />
    </div>
  );
}

// Banner tints are Tailwind gradient stops set by admin. Keep the common ones generated:
// from-indigo-600 to-violet-500 from-emerald-600 to-teal-500 from-amber-500 to-orange-500 from-violet-600 to-purple-500
// from-blue-600 to-cyan-500 from-sky-500 to-blue-600 from-rose-500 to-pink-500 from-pink-500 to-rose-500 from-teal-600 to-emerald-500
// from-orange-500 to-red-500 from-fuchsia-600 to-pink-500 from-cyan-600 to-sky-500 from-slate-700 to-slate-900 from-green-600 to-emerald-500
// from-purple-600 to-indigo-500 from-red-500 to-orange-500 from-lime-500 to-green-600 from-yellow-500 to-amber-600 from-primary to-violet-500
const tintProps = (tint: string) =>
  /^(#|rgb|hsl)/.test(tint.trim()) ? { className: '', style: { background: tint } } : { className: cn('bg-gradient-to-br', tint || 'from-primary to-violet-500'), style: undefined };

function BannerCard({ b }: { b: Banner }) {
  const nav = useNavigate();
  const tp = tintProps(b.tint);
  const open = () => {
    if (!b.link) return;
    if (b.link.startsWith('/')) nav(b.link);
    else window.open(b.link, '_blank', 'noopener');
  };
  return (
    <div
      onClick={b.link ? open : undefined}
      role={b.link ? 'link' : undefined}
      className={cn('relative h-32 w-[85%] shrink-0 snap-start overflow-hidden rounded-card p-4 text-white', tp.className, b.link && 'cursor-pointer active:scale-[.99] transition')}
      style={tp.style}
    >
      <h3 className="max-w-[80%] text-lg leading-tight font-extrabold">{b.title}</h3>
      {b.subtitle && <p className="mt-1 max-w-[70%] text-sm text-white/85">{b.subtitle}</p>}
      <BadgeIndianRupee className="absolute -right-3 -bottom-3 size-24 text-white/15" />
    </div>
  );
}

function CustomerHome() {
  const t = useT();
  const nav = useNavigate();
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
  const top = useWorkerSearch({ lat: point.lat, lng: point.lng, radiusKm, sort: 'rating' });
  const topList = top.data?.pages[0]?.items.slice(0, 4);
  const showBanners = bannersOn && (banners.isLoading || (banners.data?.length ?? 0) > 0);
  return (
    <>
      <HomeHeader />
      <div className="space-y-7 px-4 py-5">
        {showBanners && (
          <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4">
            {banners.isLoading
              ? [0, 1].map((i) => <Skeleton key={i} className="h-32 w-[85%] shrink-0" />)
              : banners.data?.map((b) => <BannerCard key={b.id} b={b} />)}
          </div>
        )}

        <section>
          <SectionTitle action={<Link to="/search" className="text-sm font-semibold text-primary">{t('seeAll')}</Link>}>{t('categories')}</SectionTitle>
          {cats.isError ? (
            <ErrorState message={errorMessage(cats.error)} onRetry={() => cats.refetch()} />
          ) : (
            <div className="grid grid-cols-4 gap-x-2 gap-y-4">
              {cats.isLoading && Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-20" />)}
              {cats.data?.slice(0, 8).map((c) => (
                <button key={c.id} onClick={() => nav(`/search?cat=${c.id}`)} className="flex flex-col items-center gap-1.5">
                  <span className="grid size-15 place-items-center rounded-2xl bg-surface-3 text-ink-2"><CategoryIcon name={c.icon} size={26} /></span>
                  <span className="text-center text-xs leading-tight font-semibold">{lang === 'hi' && c.nameHi ? c.nameHi : c.name}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionTitle action={<Link to="/search?sort=rating" className="text-sm font-semibold text-primary">{t('seeAll')}</Link>}>{t('topNearby')}</SectionTitle>
          <div className="space-y-3">
            {top.isLoading && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-28" />)}
            {top.isError && <ErrorState message={errorMessage(top.error)} onRetry={() => top.refetch()} />}
            {topList?.map((w) => <WorkerCard key={w.id} w={w} />)}
            {topList?.length === 0 && (
              <Card className="p-5 text-center">
                <p className="font-semibold">{t('noWorkers')}</p>
                <p className="mt-1 text-sm text-ink-2">{t('within')} {radiusKm} KM · {point.label}</p>
                {radiusKm < Math.max(...options) && (
                  <Button variant="soft" size="sm" className="mt-3" onClick={() => nav('/search')}>{t('increaseRadius')}</Button>
                )}
              </Card>
            )}
          </div>
        </section>

        <section>
          <SectionTitle>{t('howItWorks')}</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            {([[Search, 'how1', 'how1s'], [MessageCircle, 'how2', 'how2s'], [BadgeIndianRupee, 'how3', 'how3s']] as const).map(([I, a, b], i) => (
              <Card key={a} className="p-3 text-center">
                <span className="mx-auto mb-2 grid size-10 place-items-center rounded-full bg-primary-soft text-primary"><I size={20} /></span>
                <b className="block text-[13px]">{i + 1}. {t(a)}</b>
                <span className="text-[11px] leading-tight text-ink-2">{t(b)}</span>
              </Card>
            ))}
          </div>
        </section>

        <Card className="flex items-center gap-3 border-success/30 bg-success-soft p-4">
          <ShieldCheck className="shrink-0 text-success" size={32} />
          <div><b>{t('zeroCommission')}</b><p className="text-sm text-ink-2">{t('zeroCommissionSub')}</p></div>
        </Card>

        {canBecomeWorker && (
          <Card onClick={() => nav('/onboarding')} className="flex items-center gap-3 p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent"><BadgeCheck /></span>
            <div className="flex-1"><b>{t('becomeWorker')}</b><p className="text-sm text-ink-2">{t('roleWorkerSub')}</p></div>
            <ChevronRight className="text-ink-3" />
          </Card>
        )}
      </div>
    </>
  );
}

// ---------- Worker dashboard ----------
const toneCard: Record<Tone, string> = {
  primary: 'border-primary/25 bg-primary-soft', success: 'border-success/30 bg-success-soft', warning: 'border-warning/30 bg-warning-soft',
  danger: 'border-danger/30 bg-danger-soft', neutral: 'border-line bg-surface-2',
};
const toneText: Record<Tone, string> = { primary: 'text-primary', success: 'text-success', warning: 'text-warning', danger: 'text-danger', neutral: 'text-ink-2' };

function VerificationCard({ d }: { d: WorkerDashboard }) {
  const t = useT();
  const nav = useNavigate();
  const verificationOn = useFeature('verification');
  const typeLabel = d.verificationType ? verificationLabel[d.verificationType as VerificationType] : '';
  const cfg: Record<WorkerDashboard['verification'], { tone: Tone; icon: typeof Info; title: string; sub: string; cta?: string }> = {
    none: { tone: 'primary', icon: ShieldCheck, title: t('vNoneTitle'), sub: t('vNoneSub'), cta: t('getVerified') },
    pending: { tone: 'warning', icon: Clock, title: t('vPendingTitle'), sub: t('vPendingSub') },
    approved: { tone: 'success', icon: BadgeCheck, title: t('vApprovedTitle'), sub: typeLabel || t('vApprovedSub') },
    rejected: { tone: 'danger', icon: ShieldX, title: t('vRejectedTitle'), sub: d.verificationReason || t('vRejectedSub'), cta: t('resubmit') },
    info_requested: { tone: 'warning', icon: AlertTriangle, title: t('vInfoTitle'), sub: d.verificationReason || t('vInfoSub'), cta: t('submitAgain') },
  };
  const c = cfg[d.verification] ?? cfg.none;
  if (!verificationOn && d.verification !== 'approved') return null;
  return (
    <Card className={cn('flex items-start gap-3 p-4', toneCard[c.tone])}>
      <c.icon className={cn('mt-0.5 shrink-0', toneText[c.tone])} />
      <div className="min-w-0 flex-1">
        <b className="text-[15px]">{t('verificationStatus')}: {c.title}</b>
        <p className="mt-0.5 text-xs text-ink-2">{(d.verification === 'rejected' || d.verification === 'info_requested') && d.verificationReason ? `${t('reason')}: ${c.sub}` : c.sub}</p>
        {c.cta && verificationOn && <Button size="sm" variant={c.tone === 'primary' ? 'primary' : 'outline'} className="mt-3" onClick={() => nav('/verification')}>{c.cta}</Button>}
      </div>
    </Card>
  );
}

function WorkerHome() {
  const t = useT();
  const nav = useNavigate();
  const name = useAuth((s) => s.user?.name);
  const workerReg = useFeature('workerRegistration');
  const d = useWorkerDashboard();
  const convs = useConversations();
  const status = useWorkerStatus();
  const noProfile = isApiError(d.error, 'NOT_FOUND');
  const enquiries = convs.data?.filter((c) => c.myRole === 'worker').slice(0, 3);
  const stats = [
    { icon: Eye, label: t('profileViews'), value: d.data && num(d.data.profileViews) },
    { icon: MessageCircle, label: t('enquiries'), value: d.data && num(d.data.enquiries) },
    { icon: Star, label: d.data?.reviewCount ? `${t('rating')} (${d.data.reviewCount})` : t('rating'), value: d.data && (d.data.reviewCount ? d.data.rating.toFixed(1) : '–') },
  ];
  return (
    <>
      <div className="pt-safe rounded-b-[28px] bg-gradient-to-br from-primary to-primary-600 px-4 pb-16 text-white">
        <div className="flex h-14 items-center justify-between gap-3">
          <div className="min-w-0"><span className="text-xs text-white/75">{t('hello')} 👋</span><h1 className="truncate text-lg font-bold">{name}</h1></div>
          <HeaderActions />
        </div>
      </div>
      <div className="-mt-12 space-y-4 px-4 pb-6">
        {noProfile ? (
          <Card className="p-5 text-center shadow-lg shadow-black/5">
            <span className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-primary-soft text-primary"><UserPlus /></span>
            <b className="text-lg">{t('createWorkerProfile')}</b>
            <p className="mt-1 text-sm text-ink-2">{workerReg ? t('createWorkerProfileSub') : t('workerRegPaused')}</p>
            {workerReg && <Button className="mt-4" onClick={() => nav('/onboarding')}>{t('getStarted')}</Button>}
          </Card>
        ) : d.isError ? (
          <Card className="shadow-lg shadow-black/5"><ErrorState message={errorMessage(d.error)} onRetry={() => d.refetch()} /></Card>
        ) : (
          <>
            <Card className="grid grid-cols-3 divide-x divide-line p-4 shadow-lg shadow-black/5">
              {stats.map(({ icon: I, label, value }) => (
                <div key={label} className="px-1 text-center">
                  <I size={18} className="mx-auto text-primary" />
                  {value === undefined ? <Skeleton className="mx-auto mt-1 h-7 w-10" /> : <b className="mt-1 block text-xl">{value}</b>}
                  <span className="text-[11px] text-ink-2">{label}</span>
                </div>
              ))}
            </Card>

            {d.data?.restricted && (
              <Card className={cn('flex items-start gap-3 p-4', toneCard.danger)}>
                <EyeOff className="mt-0.5 shrink-0 text-danger" />
                <div className="flex-1"><b className="text-[15px]">{t('restrictedTitle')}</b><p className="text-xs text-ink-2">{t('restrictedSub')}</p></div>
              </Card>
            )}

            <Card className="divide-y divide-line">
              <div className="flex items-center gap-3 p-4">
                <div className="flex-1"><b className="text-[15px]">{t('profileVisible')}</b><p className="text-xs text-ink-2">{t('profileVisibleSub')}</p></div>
                {d.data ? <Toggle label={t('profileVisible')} checked={d.data.visible} disabled={status.isPending} onChange={(v) => status.mutate({ visible: v })} /> : <Skeleton className="h-7 w-12 rounded-full" />}
              </div>
              <div className="flex items-center gap-3 p-4">
                <div className="flex-1"><b className="text-[15px]">{t('availableForWork')}</b><p className="text-xs text-ink-2">{t('availableForWorkSub')}</p></div>
                {d.data ? <Toggle label={t('availableForWork')} checked={d.data.available} disabled={status.isPending} onChange={(v) => status.mutate({ available: v })} /> : <Skeleton className="h-7 w-12 rounded-full" />}
              </div>
            </Card>

            {d.data && (
              <Card className="p-4">
                <div className="mb-2 flex justify-between text-sm"><b>{d.data.completion >= 100 ? t('profileComplete') : t('completeProfile')}</b><span className="font-bold text-primary">{d.data.completion}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={d.data.completion} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${d.data.completion}%` }} />
                </div>
                <Button variant="soft" size="sm" className="mt-3" onClick={() => nav('/onboarding')}>{t('updateProfile')}</Button>
              </Card>
            )}

            {d.data && <VerificationCard d={d.data} />}
          </>
        )}

        <section>
          <SectionTitle action={<Link to="/chats" className="text-sm font-semibold text-primary">{t('seeAll')}</Link>}>{t('recentEnquiries')}</SectionTitle>
          {convs.isLoading ? (
            <Skeleton className="h-40" />
          ) : enquiries?.length ? (
            <Card className="divide-y divide-line overflow-hidden">
              {enquiries.map((c) => (
                <button key={c.id} onClick={() => nav(`/chats/${c.id}`)} className="flex w-full items-center gap-3 p-3 text-left active:bg-surface-2">
                  <Avatar src={c.peer.photo} name={c.peer.name} />
                  <span className="min-w-0 flex-1"><b className="block truncate text-[15px]">{c.peer.name}</b><span className="block truncate text-sm text-ink-2">{c.lastMessage || t('newEnquiry')}</span></span>
                  <span className="flex flex-col items-end gap-1">
                    <span className="text-xs text-ink-3">{timeAgo(c.lastMessageAt)}</span>
                    {c.unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-on-primary">{c.unread}</span>}
                  </span>
                </button>
              ))}
            </Card>
          ) : (
            <Card className="p-5 text-center text-sm text-ink-2">
              <MessageCircle className="mx-auto mb-2 text-ink-3" />
              {t('noEnquiries')}
            </Card>
          )}
        </section>
      </div>
    </>
  );
}

export function Home() {
  const role = useAuth((s) => s.user?.activeRole);
  return role === 'worker' ? <WorkerHome /> : <CustomerHome />;
}

// ---------- Notifications ----------
const nIcon: Record<NotificationType, typeof Bell> = { chat: MessageCircle, subscription: CreditCard, verification: BadgeCheck, complaint: MessageSquareWarning, system: Info };

export function Notifications() {
  const t = useT();
  const nav = useNavigate();
  const { data, isLoading, isError, error, refetch } = useNotifications();
  const mark = useMarkRead();
  const unread = data?.some((n) => !n.read);
  return (
    <div className="min-h-dvh bg-surface">
      <TopBar title={t('notifications')} right={unread ? <button onClick={() => mark.mutate('all')} className="px-3 text-sm font-semibold text-primary">{t('markAllRead')}</button> : undefined} />
      {isLoading && <div className="space-y-2 p-4">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>}
      {isError && <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />}
      {data?.length === 0 && <EmptyState icon={<Bell size={32} />} title={t('noNotifications')} sub={t('noNotificationsSub')} />}
      <ul className="divide-y divide-line">
        {data?.map((n) => {
          const I = nIcon[n.type] ?? Zap;
          return (
            <li key={n.id}>
              <button
                onClick={() => {
                  if (!n.read) mark.mutate(n.id);
                  if (n.link?.startsWith('/')) nav(n.link);
                  else if (n.link) window.open(n.link, '_blank', 'noopener');
                }}
                className={cn('flex w-full gap-3 px-4 py-3.5 text-left transition active:bg-surface-2', !n.read && 'bg-primary-soft/60')}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary"><I size={18} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start gap-2"><b className="flex-1 text-[15px]">{n.title}</b>{!n.read && <Badge tone="primary">{t('new')}</Badge>}</span>
                  {n.body && <span className="block text-sm text-ink-2">{n.body}</span>}
                  <span className="text-xs text-ink-3">{timeAgo(n.createdAt)}</span>
                </span>
                {n.link && <ChevronRight size={18} className="mt-2 shrink-0 text-ink-3" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
