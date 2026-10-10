import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Bell, ChevronDown, ChevronRight, Eye, MapPin, MessageCircle, Search, ShieldCheck, Star, BadgeIndianRupee, CreditCard, Info, BadgeCheck, AlertTriangle } from 'lucide-react';
import { Avatar, Badge, Button, Card, CategoryIcon, EmptyState, SectionTitle, Skeleton, Toggle, TopBar } from '@/components/ui';
import { LocationSheet, WorkerCard } from '@/components/shared';
import { useBanners, useCategories, useConversations, useMarkRead, useNotifications, useWorkerDashboard, useWorkerSearch } from '@/api';
import { useAuth, useGeo, usePrefs, toast } from '@/store';
import { useT } from '@/i18n';
import { cn, timeAgo } from '@/lib/format';
import type { NotificationType } from '@/types';

function HomeHeader() {
  const t = useT();
  const nav = useNavigate();
  const name = useAuth((s) => s.user?.name.split(' ')[0]);
  const { point, radiusKm, asked, setAsked } = useGeo();
  const { data: notifs } = useNotifications();
  const unread = notifs?.filter((n) => !n.read).length ?? 0;
  // First visit: open the location picker once (permission is never forced).
  const [loc, setLoc] = useState(!asked);
  useEffect(() => { if (!asked) setAsked(); }, [asked, setAsked]);
  return (
    <div className="pt-safe rounded-b-[28px] bg-gradient-to-br from-primary to-primary-600 px-4 pb-6 text-white">
      <div className="flex h-14 items-center gap-3">
        <button onClick={() => setLoc(true)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/15"><MapPin size={20} /></span>
          <span className="min-w-0">
            <span className="block text-xs text-white/75">{t('hello')}, {name} 👋</span>
            <span className="flex items-center gap-1 truncate text-[15px] font-bold">{point.label}<ChevronDown size={16} /></span>
          </span>
        </button>
        <button aria-label="Notifications" onClick={() => nav('/notifications')} className="relative grid size-10 place-items-center rounded-full bg-white/15">
          <Bell size={20} />
          {unread > 0 && <span className="absolute top-2 right-2.5 size-2.5 rounded-full bg-accent ring-2 ring-primary" />}
        </button>
      </div>
      <button onClick={() => nav('/search')} className="mt-3 flex h-12 w-full items-center gap-3 rounded-2xl bg-white px-4 text-left text-ink-3 shadow-lg shadow-black/10">
        <Search size={20} className="text-primary" />
        <span className="flex-1 truncate text-[15px]">{t('searchPlaceholder')}</span>
        <span className="rounded-lg bg-primary-soft px-2 py-1 text-xs font-bold text-primary">{radiusKm} KM</span>
      </button>
      <LocationSheet open={loc} onClose={() => setLoc(false)} />
    </div>
  );
}

function CustomerHome() {
  const t = useT();
  const nav = useNavigate();
  const lang = usePrefs((s) => s.lang);
  const { point, radiusKm } = useGeo();
  const cats = useCategories();
  const banners = useBanners();
  const top = useWorkerSearch({ lat: point.lat, lng: point.lng, radiusKm, sort: 'rating' });
  const topList = top.data?.pages[0].items.slice(0, 4);
  return (
    <>
      <HomeHeader />
      <div className="space-y-7 px-4 py-5">
        <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4">
          {(banners.data ?? [1, 2]).map((b, i) =>
            typeof b === 'number' ? <Skeleton key={i} className="h-32 w-[85%] shrink-0" /> : (
              <div key={b.id} className={cn('relative h-32 w-[85%] shrink-0 snap-start overflow-hidden rounded-card bg-gradient-to-br p-4 text-white', b.tint)}>
                <h3 className="text-lg font-extrabold">{b.title}</h3>
                <p className="mt-1 max-w-[70%] text-sm text-white/85">{b.subtitle}</p>
                <BadgeIndianRupee className="absolute -right-3 -bottom-3 size-24 text-white/15" />
              </div>
            ),
          )}
        </div>

        <section>
          <SectionTitle action={<Link to="/search" className="text-sm font-semibold text-primary">{t('seeAll')}</Link>}>{t('categories')}</SectionTitle>
          <div className="grid grid-cols-4 gap-x-2 gap-y-4">
            {cats.isLoading && Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-20" />)}
            {cats.data?.slice(0, 8).map((c) => (
              <button key={c.id} onClick={() => nav(`/search?cat=${c.id}`)} className="flex flex-col items-center gap-1.5">
                <span className="grid size-15 place-items-center rounded-2xl bg-surface-3 text-ink-2"><CategoryIcon name={c.icon} size={26} /></span>
                <span className="text-center text-xs leading-tight font-semibold">{lang === 'hi' ? c.nameHi : c.name}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle action={<Link to="/search?sort=rating" className="text-sm font-semibold text-primary">{t('seeAll')}</Link>}>{t('topNearby')}</SectionTitle>
          <div className="space-y-3">
            {top.isLoading && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-28" />)}
            {topList?.map((w) => <WorkerCard key={w.id} w={w} />)}
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

        <Card onClick={() => nav('/onboarding')} className="flex items-center gap-3 p-4">
          <span className="grid size-11 place-items-center rounded-xl bg-accent/15 text-accent"><BadgeCheck /></span>
          <div className="flex-1"><b>{t('becomeWorker')}</b><p className="text-sm text-ink-2">{t('roleWorkerSub')}</p></div>
          <ChevronRight className="text-ink-3" />
        </Card>
      </div>
    </>
  );
}

function WorkerHome() {
  const t = useT();
  const nav = useNavigate();
  const name = useAuth((s) => s.user?.name);
  const d = useWorkerDashboard();
  const convs = useConversations();
  const [visible, setVisible] = useState(true);
  const stats = [
    { icon: Eye, label: t('profileViews'), value: d.data?.profileViews },
    { icon: MessageCircle, label: t('enquiries'), value: d.data?.enquiries },
    { icon: Star, label: t('rating'), value: d.data?.rating },
  ];
  return (
    <>
      <div className="pt-safe rounded-b-[28px] bg-gradient-to-br from-primary to-primary-600 px-4 pb-16 text-white">
        <div className="flex h-14 items-center justify-between">
          <div><span className="text-xs text-white/75">{t('hello')} 👋</span><h1 className="text-lg font-bold">{name}</h1></div>
          <button aria-label="Notifications" onClick={() => nav('/notifications')} className="grid size-10 place-items-center rounded-full bg-white/15"><Bell size={20} /></button>
        </div>
      </div>
      <div className="-mt-12 space-y-4 px-4 pb-6">
        <Card className="grid grid-cols-3 divide-x divide-line p-4 shadow-lg shadow-black/5">
          {stats.map(({ icon: I, label, value }) => (
            <div key={label} className="text-center">
              <I size={18} className="mx-auto text-primary" />
              <b className="mt-1 block text-xl">{value ?? '–'}</b>
              <span className="text-[11px] text-ink-2">{label}</span>
            </div>
          ))}
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex-1"><b className="text-[15px]">{t('profileVisible')}</b><p className="text-xs text-ink-2">Pause anytime when you are not taking work</p></div>
          <Toggle checked={visible} onChange={(v) => { setVisible(v); toast(v ? 'Profile is live' : 'Profile paused'); }} />
        </Card>
        <Card className="p-4">
          <div className="mb-2 flex justify-between text-sm"><b>{t('completeProfile')}</b><span className="font-bold text-primary">{d.data?.completion ?? 0}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-primary" style={{ width: `${d.data?.completion ?? 0}%` }} /></div>
          <Button variant="soft" size="sm" className="mt-3" onClick={() => nav('/onboarding')}>Update profile</Button>
        </Card>
        <Card className="flex items-center gap-3 border-warning/30 bg-warning-soft p-4">
          <AlertTriangle className="text-warning" />
          <div className="flex-1"><b className="text-[15px]">{t('verificationStatus')}: Pending</b><p className="text-xs text-ink-2">Admin is reviewing your documents (24–48 hrs)</p></div>
        </Card>
        <section>
          <SectionTitle action={<Link to="/chats" className="text-sm font-semibold text-primary">{t('seeAll')}</Link>}>{t('recentEnquiries')}</SectionTitle>
          <Card className="divide-y divide-line">
            {convs.data?.slice(0, 3).map((c) => (
              <button key={c.id} onClick={() => nav(`/chats/${c.id}`)} className="flex w-full items-center gap-3 p-3 text-left">
                <Avatar src={c.peer.photo} name={c.peer.name} />
                <span className="min-w-0 flex-1"><b className="block truncate text-[15px]">{c.peer.name}</b><span className="block truncate text-sm text-ink-2">{c.lastMessage}</span></span>
                <span className="text-xs text-ink-3">{timeAgo(c.lastMessageAt)}</span>
              </button>
            ))}
          </Card>
        </section>
      </div>
    </>
  );
}

export function Home() {
  const role = useAuth((s) => s.user?.activeRole);
  return role === 'worker' ? <WorkerHome /> : <CustomerHome />;
}

const nIcon: Record<NotificationType, typeof Bell> = { chat: MessageCircle, subscription: CreditCard, verification: BadgeCheck, complaint: AlertTriangle, system: Info };

export function Notifications() {
  const t = useT();
  const nav = useNavigate();
  const { data, isLoading } = useNotifications();
  const mark = useMarkRead();
  return (
    <div className="min-h-dvh bg-surface">
      <TopBar title={t('notifications')} right={<button onClick={() => mark.mutate('all')} className="px-3 text-sm font-semibold text-primary">{t('markAllRead')}</button>} />
      {isLoading && <div className="space-y-2 p-4">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>}
      {data?.length === 0 && <EmptyState icon={<Bell size={32} />} title="No notifications" />}
      <ul className="divide-y divide-line">
        {data?.map((n) => {
          const I = nIcon[n.type];
          return (
            <li key={n.id}>
              <button onClick={() => { if (!n.read) mark.mutate(n.id); if (n.link) nav(n.link); }} className={cn('flex w-full gap-3 px-4 py-3.5 text-left', !n.read && 'bg-primary-soft/50')}>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary"><I size={18} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start gap-2"><b className="flex-1 text-[15px]">{n.title}</b>{!n.read && <Badge tone="primary">New</Badge>}</span>
                  <span className="block text-sm text-ink-2">{n.body}</span>
                  <span className="text-xs text-ink-3">{timeAgo(n.createdAt)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
