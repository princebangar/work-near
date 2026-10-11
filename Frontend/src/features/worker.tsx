import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  Ban, BadgeCheck, Briefcase, Camera, Clock, Flag, ImagePlus, Languages, MapPin, MessageCircle, MoreVertical, Pencil, Phone, Share2, Star, Trash2, UserPlus, UserX,
} from 'lucide-react';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Rating, Sheet, Skeleton, Stars, TopBar, VerifiedBadge } from '@/components/ui';
import { FilePicker, ImageViewer, ReportSheet, ReviewSheet } from '@/components/shared';
import {
  errorMessage, isApiError, toastError, useBlockUser, useConversations, useDeletePortfolio, useMyWorkerProfile, useReviewEligibility, useStartConversation,
  useUploadPortfolio, useUploadWorkerPhoto, useWorker,
} from '@/api';
import { useAuth, useFeature, useGeo, toast } from '@/store';
import { useT } from '@/i18n';
import { cn, km, timeAgo } from '@/lib/format';
import { mediaUrl } from '@/lib/media';
import type { WorkerDetail } from '@/types';

const MAX_PORTFOLIO = 12;
const PER_UPLOAD = 6;

function ProfileBody({ w, preview, hidePortfolio }: { w: WorkerDetail; preview?: boolean; hidePortfolio?: boolean }) {
  const t = useT();
  const portfolioOn = useFeature('portfolio');
  const [viewing, setViewing] = useState<string | null>(null);
  const facts = [
    { icon: Briefcase, label: t('experience'), value: `${w.experienceYrs} ${t('years')}` },
    { icon: MapPin, label: t('serviceArea'), value: `${w.locality} · ${w.serviceRadiusKm} KM` },
    { icon: Clock, label: t('workingHours'), value: w.hours },
    { icon: Languages, label: t('languages'), value: w.languages.join(', ') },
  ].filter((f) => f.value);
  const showPortfolio = portfolioOn && !hidePortfolio && w.portfolio.length > 0;
  return (
    <>
      <div className="bg-surface px-4 pt-2 pb-5 text-center">
        <Avatar src={w.photo} name={w.name} size={96} className="mx-auto ring-4 ring-primary-soft" />
        <h1 className="mt-3 text-xl font-extrabold">{w.name}</h1>
        <p className="text-ink-2">{w.categoryName}</p>
        {w.verification && <div className="mt-1.5 flex justify-center"><VerifiedBadge type={w.verification} /></div>}
        <div className="mt-4 grid grid-cols-3 divide-x divide-line rounded-2xl bg-surface-2 py-3">
          <div><Rating value={w.rating} count={w.reviewCount ? undefined : 0} /><span className="block text-[11px] text-ink-2">{w.reviewCount} {t('reviews')}</span></div>
          <div>
            {preview ? <><b>{w.serviceRadiusKm} KM</b><span className="block text-[11px] text-ink-2">{t('serviceRadius')}</span></>
              : <><b>{km(w.distanceKm)}</b><span className="block text-[11px] text-ink-2">{t('away')}</span></>}
          </div>
          <div>
            <b className={w.available ? 'text-success' : 'text-ink-3'}>{w.available ? t('available') : t('busy')}</b>
            <span className="block text-[11px] text-ink-2">{t('active')} {timeAgo(w.lastActiveAt)}</span>
          </div>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <Card className="p-4">
          <h3 className="mb-1 font-bold">{t('about')}</h3>
          <p className="text-sm leading-relaxed whitespace-pre-line text-ink-2">{w.bio || t('noBio')}</p>
          {w.priceRange && <p className="mt-2 text-sm"><b>{t('indicativePrice')}:</b> <span className="text-ink-2">{w.priceRange}</span></p>}
        </Card>
        <Card className="divide-y divide-line">
          {facts.map(({ icon: I, label, value }) => (
            <div key={label} className="flex items-center gap-3 p-3.5">
              <I size={18} className="shrink-0 text-primary" /><span className="flex-1 text-sm text-ink-2">{label}</span><b className="max-w-[60%] text-right text-sm">{value}</b>
            </div>
          ))}
        </Card>
        {w.skills.length > 0 && (
          <Card className="p-4">
            <h3 className="mb-2 font-bold">{t('skills')}</h3>
            <div className="flex flex-wrap gap-2">{w.skills.map((s) => <Badge key={s} tone="primary" className="px-3 py-1 text-xs normal-case">{s}</Badge>)}</div>
          </Card>
        )}
        {showPortfolio && (
          <Card className="p-4">
            <h3 className="mb-2 font-bold">{t('portfolio')}</h3>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
              {w.portfolio.map((src) => (
                <button key={src} onClick={() => setViewing(src)} className="shrink-0" aria-label={t('viewPhoto')}>
                  <img src={mediaUrl(src)} alt="" loading="lazy" className="h-28 w-40 rounded-xl bg-surface-2 object-cover" />
                </button>
              ))}
            </div>
          </Card>
        )}
        <Card className="p-4">
          <h3 className="mb-3 font-bold">{t('reviews')}</h3>
          {w.reviewCount === 0 ? (
            <p className="text-sm text-ink-2">{t('noReviews')}</p>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-4">
                <div className="text-center"><b className="text-3xl">{w.rating.toFixed(1)}</b><Stars value={w.rating} size={12} /><span className="block text-[11px] text-ink-3">{w.reviewCount} {t('reviews')}</span></div>
                <div className="flex-1 space-y-1">
                  {([5, 4, 3, 2, 1] as const).map((s) => (
                    <div key={s} className="flex items-center gap-2 text-xs"><span className="w-2">{s}</span>
                      <div className="h-1.5 flex-1 rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent" style={{ width: `${w.ratingBreakdown[s] ?? 0}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="divide-y divide-line">
                {w.reviews.map((r) => (
                  <div key={r.id} className="py-3">
                    <div className="flex items-center gap-2"><Avatar src={r.reviewerPhoto} name={r.reviewerName} size={32} /><b className="flex-1 text-sm">{r.reviewerName}</b><span className="text-xs text-ink-3">{timeAgo(r.createdAt)}</span></div>
                    <div className="mt-1.5"><Stars value={r.stars} size={12} /></div>
                    {r.text && <p className="mt-1 text-sm text-ink-2">{r.text}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
          <p className="mt-2 text-[11px] text-ink-3">{t('reviewsDisclaimer')}</p>
        </Card>
      </div>
      <ImageViewer src={viewing} onClose={() => setViewing(null)} />
    </>
  );
}

const ProfileSkeleton = () => (
  <div className="space-y-3 p-4"><Skeleton className="mx-auto size-24 rounded-full" /><Skeleton className="mx-auto h-6 w-40" /><Skeleton className="h-16" /><Skeleton className="h-28" /><Skeleton className="h-40" /></div>
);

export function WorkerProfile() {
  const t = useT();
  const { id = '' } = useParams();
  const nav = useNavigate();
  const me = useAuth((s) => s.user?.id);
  const point = useGeo((s) => s.point);
  const chatOn = useFeature('chat');
  const reviewsOn = useFeature('reviews');
  const reportsOn = useFeature('reports');
  const { data: w, isLoading, error, refetch } = useWorker(id, point);
  const self = !!w && w.id === me;
  const convs = useConversations();
  const eligibility = useReviewEligibility(id, reviewsOn && !self && !!w);
  const start = useStartConversation();
  const block = useBlockUser();
  const [sheet, setSheet] = useState<'menu' | 'report' | 'review' | 'block' | null>(null);

  if (isLoading) return <><TopBar /><ProfileSkeleton /></>;
  if (!w) {
    return (
      <div className="min-h-dvh bg-surface">
        <TopBar />
        {isApiError(error, 'NOT_FOUND')
          ? <EmptyState icon={<UserX size={32} />} title={t('profileUnavailable')} sub={t('profileUnavailableSub')} action={<Button onClick={() => nav('/search')}>{t('search')}</Button>} />
          : <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />}
      </div>
    );
  }

  const startChat = () => {
    const existing = convs.data?.find((c) => c.peer.id === w.id && c.myRole === 'customer');
    if (existing) return nav(`/chats/${existing.id}`);
    start.mutate(w.id, {
      onSuccess: (c) => nav(`/chats/${c.id}`),
      onError: (e) => {
        if (isApiError(e, 'SUBSCRIPTION_REQUIRED')) {
          toast(e.message, 'info');
          nav('/subscription');
        } else toastError(e);
      },
    });
  };
  const openReview = () => {
    if (eligibility.data?.eligible) setSheet('review');
    else if (eligibility.data) toast(eligibility.data.reason ?? t('cannotReview'), 'info');
    else if (eligibility.error) toastError(eligibility.error);
  };
  const share = async () => {
    const url = location.href;
    try {
      if (navigator.share) await navigator.share({ title: w.name, text: `${w.name} · ${w.categoryName}`, url });
      else { await navigator.clipboard.writeText(url); toast(t('linkCopied')); }
    } catch { /* dismissed */ }
  };
  const doBlock = () =>
    block.mutate(w.id, {
      onSuccess: () => { toast(`${w.name} ${t('blockedToast')}`); setSheet(null); nav(-1); },
      onError: (e) => toastError(e),
    });
  const phone = w.phone?.replace(/\D/g, '').slice(-10);
  const showBar = !self && (chatOn || reviewsOn || !!phone);

  return (
    <div className={cn('min-h-dvh', showBar && 'pb-28')}>
      <TopBar
        right={<>
          <button aria-label={t('share')} onClick={share} className="grid size-10 place-items-center rounded-full hover:bg-surface-2"><Share2 size={20} /></button>
          {!self && <button aria-label={t('more')} onClick={() => setSheet('menu')} className="grid size-10 place-items-center rounded-full hover:bg-surface-2"><MoreVertical size={20} /></button>}
        </>}
      />
      {self && <div className="mx-4 mt-3 rounded-xl bg-primary-soft p-3 text-center text-xs font-medium text-primary">{t('ownPublicProfile')}</div>}
      <ProfileBody w={w} />

      {showBar && (
        <div className="pb-safe fixed bottom-0 left-1/2 z-30 flex w-full max-w-[var(--app-max-w)] -translate-x-1/2 gap-2 border-t border-line bg-surface p-3 dark:shadow-[0_-10px_28px_-14px_rgba(0,0,0,0.9)]">
          {phone && (
            <>
              <a href={`tel:+91${phone}`} aria-label={t('call')} className="grid size-13 shrink-0 place-items-center rounded-xl border border-line bg-surface text-primary"><Phone size={20} /></a>
              <a href={`https://wa.me/91${phone}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="grid size-13 shrink-0 place-items-center rounded-xl border border-line bg-surface text-success">
                <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1s-.5-.1-.7.2-.8 1-1 1.2-.4.2-.7.1a8 8 0 0 1-2.4-1.5 9 9 0 0 1-1.6-2c-.2-.3 0-.5.1-.6l.5-.6.3-.5v-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6a1.1 1.1 0 0 0-.8.4 3.4 3.4 0 0 0-1 2.5 5.9 5.9 0 0 0 1.2 3.1 13.4 13.4 0 0 0 5.2 4.6c.7.3 1.3.5 1.7.6a4.2 4.2 0 0 0 1.9.1 3.1 3.1 0 0 0 2-1.4 2.5 2.5 0 0 0 .2-1.4c-.1-.1-.3-.2-.6-.3ZM12 21.8a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4a9.8 9.8 0 1 1 8.3 4.6ZM20.4 3.5A11.8 11.8 0 0 0 1.8 17.7L.1 24l6.4-1.7A11.8 11.8 0 0 0 24 12a11.7 11.7 0 0 0-3.6-8.5Z" /></svg>
              </a>
            </>
          )}
          {reviewsOn && (
            <Button variant="outline" size="lg" block={!chatOn} aria-label={t('writeReview')} className={cn(!eligibility.data?.eligible && 'text-ink-2')} loading={eligibility.isLoading} onClick={openReview}>
              <Star size={18} />{chatOn ? t('review') : t('writeReview')}
            </Button>
          )}
          {chatOn && (
            <Button size="lg" block loading={start.isPending} onClick={startChat}>
              <MessageCircle size={20} />{t('chatNow')}
            </Button>
          )}
        </div>
      )}

      <Sheet open={sheet === 'menu'} onClose={() => setSheet(null)} title={w.name}>
        {reportsOn && <button onClick={() => setSheet('report')} className="flex w-full items-center gap-3 py-3.5 font-medium text-danger"><Flag size={20} />{t('report')}</button>}
        <button onClick={() => setSheet('block')} className="flex w-full items-center gap-3 py-3.5 font-medium"><Ban size={20} />{t('block')}</button>
      </Sheet>
      <Sheet open={sheet === 'block'} onClose={() => setSheet(null)} title={`${t('block')} ${w.name}?`}>
        <p className="mb-5 text-sm text-ink-2">{t('blockExplain')}</p>
        <div className="flex gap-2">
          <Button variant="outline" block onClick={() => setSheet(null)}>{t('cancel')}</Button>
          <Button variant="danger" block loading={block.isPending} onClick={doBlock}>{t('block')}</Button>
        </div>
      </Sheet>
      <ReportSheet open={sheet === 'report'} onClose={() => setSheet(null)} targetType="profile" targetId={w.id} />
      <ReviewSheet open={sheet === 'review'} onClose={() => setSheet(null)} workerId={w.id} workerName={w.name} />
    </div>
  );
}

// ---------- My profile (worker) ----------
function PortfolioManager({ photos }: { photos: string[] }) {
  const t = useT();
  const up = useUploadPortfolio();
  const del = useDeletePortfolio();
  const [viewing, setViewing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const room = MAX_PORTFOLIO - photos.length;
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold">{t('portfolio')}</h3>
        <span className="text-xs text-ink-3">{photos.length}/{MAX_PORTFOLIO}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((src) => (
          <div key={src} className="relative aspect-square overflow-hidden rounded-xl bg-surface-2">
            <button className="size-full" onClick={() => setViewing(src)} aria-label={t('viewPhoto')}>
              <img src={mediaUrl(src)} alt="" loading="lazy" className="size-full object-cover" />
            </button>
            <button aria-label={t('delete')} onClick={() => setConfirm(src)} className="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-black/55 text-white">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {up.isPending && <Skeleton className="aspect-square" />}
        {room > 0 && !up.isPending && (
          <FilePicker multiple max={Math.min(room, PER_UPLOAD)} onFiles={(files) => up.mutate(files, { onSuccess: () => toast(t('photosAdded')), onError: (e) => toastError(e) })}>
            {(open) => (
              <button onClick={open} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line text-ink-2">
                <ImagePlus size={22} /><span className="text-[11px] font-semibold">{t('addPhotos')}</span>
              </button>
            )}
          </FilePicker>
        )}
      </div>
      <p className="mt-2 text-xs text-ink-3">{t('portfolioHint')}</p>
      <ImageViewer src={viewing} onClose={() => setViewing(null)} />
      <Sheet open={!!confirm} onClose={() => setConfirm(null)} title={t('deletePhoto')}>
        <div className="flex gap-2">
          <Button variant="outline" block onClick={() => setConfirm(null)}>{t('cancel')}</Button>
          <Button variant="danger" block loading={del.isPending}
            onClick={() => confirm && del.mutate(confirm, { onSuccess: () => setConfirm(null), onError: (e) => toastError(e) })}>{t('delete')}</Button>
        </div>
      </Sheet>
    </Card>
  );
}

export function MyProfile() {
  const t = useT();
  const nav = useNavigate();
  const portfolioOn = useFeature('portfolio');
  const workerReg = useFeature('workerRegistration');
  const { data: w, isLoading, error, refetch } = useMyWorkerProfile();
  const photo = useUploadWorkerPhoto();
  const head = <TopBar back={false} title={t('myProfile')} right={w ? <Button size="sm" variant="soft" className="mr-2" onClick={() => nav('/onboarding')}><Pencil size={15} />{t('editProfile')}</Button> : undefined} />;
  if (isLoading) return <div>{head}<div className="space-y-3 p-4"><Skeleton className="h-60" /><Skeleton className="h-40" /></div></div>;
  if (error) return <div>{head}<ErrorState message={errorMessage(error)} onRetry={() => refetch()} /></div>;
  if (!w) {
    return (
      <div>{head}
        <EmptyState icon={<UserPlus size={32} />} title={t('createWorkerProfile')} sub={workerReg ? t('createWorkerProfileSub') : t('workerRegPaused')}
          action={workerReg && <Button onClick={() => nav('/onboarding')}>{t('getStarted')}</Button>} />
      </div>
    );
  }
  const vsLabel = { none: t('vsNone'), pending: t('vPendingTitle'), approved: t('vApprovedTitle'), rejected: t('vRejectedTitle'), info_requested: t('vInfoTitle') };
  const vTone = w.verificationStatus === 'approved' ? 'success' : w.verificationStatus === 'rejected' ? 'danger' : w.verificationStatus === 'none' ? 'neutral' : 'warning';
  return (
    <div>
      {head}
      <div className="space-y-3 px-4 pt-3">
        <Card className="flex items-center gap-3 p-3">
          <FilePicker onFiles={([f]) => photo.mutate(f, { onSuccess: () => toast(t('photoUpdated')), onError: (e) => toastError(e) })}>
            {(open) => (
              <button onClick={open} className="relative shrink-0" aria-label={t('changePhoto')}>
                <Avatar src={w.photo} name={w.name} size={56} className={cn(photo.isPending && 'opacity-50')} />
                <span className="absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full bg-primary text-on-primary ring-2 ring-surface"><Camera size={12} /></span>
              </button>
            )}
          </FilePicker>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={w.visible && !w.restricted ? 'success' : 'neutral'}>{w.restricted ? t('hiddenByAdmin') : w.visible ? t('live') : t('paused')}</Badge>
              <Badge tone={vTone}><BadgeCheck size={12} />{vsLabel[w.verificationStatus]}</Badge>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-primary" style={{ width: `${w.completion}%` }} /></div>
              <span className="text-xs font-bold text-primary">{w.completion}%</span>
            </div>
            <span className="text-[11px] text-ink-3">{w.profileViews} {t('profileViews').toLowerCase()}</span>
          </div>
        </Card>
        {portfolioOn && <PortfolioManager photos={w.portfolio} />}
        <div className="rounded-xl bg-primary-soft p-3 text-center text-xs font-medium text-primary">{t('previewNote')}</div>
      </div>
      <ProfileBody w={w} preview hidePortfolio={portfolioOn} />
    </div>
  );
}
