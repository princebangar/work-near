import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Ban, Briefcase, Camera, CheckCircle2, Clock, Flag, Languages, MapPin, MessageCircle, MoreVertical, Share2, Upload } from 'lucide-react';
import { Avatar, Badge, Button, Card, Chip, Input, Rating, Sheet, Skeleton, Spinner, Stars, Textarea, TopBar, VerifiedBadge } from '@/components/ui';
import { ReportSheet } from '@/components/shared';
import { useCategories, useSaveWorkerProfile, useStartConversation, useSubmitReview, useSubmitVerification, useWorker } from '@/api';
import { useAuth, toast } from '@/store';
import { useT } from '@/i18n';
import { APP } from '@/config/env';
import { cn, km, timeAgo } from '@/lib/format';
import type { VerificationType, WorkerDetail } from '@/types';

function ProfileBody({ w, preview }: { w: WorkerDetail; preview?: boolean }) {
  const t = useT();
  const facts = [
    { icon: Briefcase, label: t('experience'), value: `${w.experienceYrs} ${t('years')}` },
    { icon: MapPin, label: t('serviceArea'), value: `${w.locality} · ${w.serviceRadiusKm} KM` },
    { icon: Clock, label: t('workingHours'), value: w.hours },
    { icon: Languages, label: t('languages'), value: w.languages.join(', ') },
  ];
  return (
    <>
      <div className="bg-surface px-4 pt-2 pb-5 text-center">
        <Avatar src={w.photo} name={w.name} size={96} className="mx-auto ring-4 ring-primary-soft" />
        <h1 className="mt-3 text-xl font-extrabold">{w.name}</h1>
        <p className="text-ink-2">{w.categoryName}</p>
        <div className="mt-1.5 flex justify-center"><VerifiedBadge type={w.verification} /></div>
        <div className="mt-4 grid grid-cols-3 divide-x divide-line rounded-2xl bg-surface-2 py-3">
          <div><Rating value={w.rating} /><span className="block text-[11px] text-ink-2">{w.reviewCount} {t('reviews')}</span></div>
          <div><b>{km(w.distanceKm)}</b><span className="block text-[11px] text-ink-2">away</span></div>
          <div>
            <b className={w.available ? 'text-success' : 'text-ink-3'}>{w.available ? t('available') : t('busy')}</b>
            <span className="block text-[11px] text-ink-2">active {timeAgo(w.lastActiveAt)}</span>
          </div>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <Card className="p-4">
          <h3 className="mb-1 font-bold">{t('about')}</h3>
          <p className="text-sm leading-relaxed text-ink-2">{w.bio}</p>
          {w.priceRange && <p className="mt-2 text-sm"><b>Indicative price:</b> <span className="text-ink-2">{w.priceRange}</span></p>}
        </Card>
        <Card className="divide-y divide-line">
          {facts.map(({ icon: I, label, value }) => (
            <div key={label} className="flex items-center gap-3 p-3.5">
              <I size={18} className="text-primary" /><span className="flex-1 text-sm text-ink-2">{label}</span><b className="text-sm">{value}</b>
            </div>
          ))}
        </Card>
        <Card className="p-4">
          <h3 className="mb-2 font-bold">{t('skills')}</h3>
          <div className="flex flex-wrap gap-2">{w.skills.map((s) => <Badge key={s} tone="primary" className="px-3 py-1 text-xs">{s}</Badge>)}</div>
        </Card>
        <Card className="p-4">
          <h3 className="mb-2 font-bold">{t('portfolio')}</h3>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {w.portfolio.map((src) => <img key={src} src={src} alt="" loading="lazy" className="h-28 w-40 shrink-0 rounded-xl bg-surface-2 object-cover" />)}
          </div>
        </Card>
        {!preview && (
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-4">
              <div className="text-center"><b className="text-3xl">{w.rating.toFixed(1)}</b><Stars value={w.rating} size={12} /><span className="block text-[11px] text-ink-3">{w.reviewCount} reviews</span></div>
              <div className="flex-1 space-y-1">
                {([5, 4, 3, 2, 1] as const).map((s) => (
                  <div key={s} className="flex items-center gap-2 text-xs"><span className="w-2">{s}</span>
                    <div className="h-1.5 flex-1 rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent" style={{ width: `${w.ratingBreakdown[s]}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="divide-y divide-line">
              {w.reviews.map((r) => (
                <div key={r.id} className="py-3">
                  <div className="flex items-center gap-2"><Avatar src={r.reviewerPhoto} name={r.reviewerName} size={32} /><b className="flex-1 text-sm">{r.reviewerName}</b><span className="text-xs text-ink-3">{timeAgo(r.createdAt)}</span></div>
                  <div className="mt-1.5"><Stars value={r.stars} size={12} /></div>
                  <p className="mt-1 text-sm text-ink-2">{r.text}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-ink-3">Reviews are user-generated and not verified by WorkNear.</p>
          </Card>
        )}
      </div>
    </>
  );
}

export function WorkerProfile() {
  const t = useT();
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { data: w, isLoading } = useWorker(id);
  const start = useStartConversation();
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<'report' | 'review' | null>(null);
  if (isLoading || !w) return <><TopBar /><Spinner /></>;
  return (
    <div className="min-h-dvh pb-28">
      <TopBar
        right={<>
          <button aria-label="Share" onClick={() => { navigator.share?.({ title: w.name, url: location.href }).catch(() => {}); }} className="grid size-10 place-items-center rounded-full hover:bg-surface-2"><Share2 size={20} /></button>
          <button aria-label="More" onClick={() => setMenu(true)} className="grid size-10 place-items-center rounded-full hover:bg-surface-2"><MoreVertical size={20} /></button>
        </>}
      />
      <ProfileBody w={w} />
      <div className="pb-safe fixed bottom-0 left-1/2 z-30 flex w-full max-w-[var(--app-max-w)] -translate-x-1/2 gap-2 border-t border-line bg-surface p-3">
        <Button variant="outline" size="lg" onClick={() => setSheet('review')}>{t('writeReview')}</Button>
        <Button size="lg" block loading={start.isPending} onClick={() => start.mutate(w.id, { onSuccess: (c) => nav(`/chats/${c.id}`) })}>
          <MessageCircle size={20} />{t('chatNow')}
        </Button>
      </div>
      <Sheet open={menu} onClose={() => setMenu(false)} title={w.name}>
        <button onClick={() => { setMenu(false); setSheet('report'); }} className="flex w-full items-center gap-3 py-3.5 font-medium text-danger"><Flag size={20} />{t('report')}</button>
        <button onClick={() => { setMenu(false); toast(`${w.name} blocked`); }} className="flex w-full items-center gap-3 py-3.5 font-medium"><Ban size={20} />{t('block')}</button>
      </Sheet>
      <ReportSheet open={sheet === 'report'} onClose={() => setSheet(null)} targetType="profile" targetId={w.id} />
      <ReviewSheet open={sheet === 'review'} onClose={() => setSheet(null)} workerId={w.id} />
    </div>
  );
}

function ReviewSheet({ open, onClose, workerId }: { open: boolean; onClose: () => void; workerId: string }) {
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const m = useSubmitReview();
  return (
    <Sheet open={open} onClose={onClose} title="Rate your experience">
      <div className="mb-4 flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((s) => (
          <button key={s} aria-label={`${s} stars`} onClick={() => setStars(s)} className={cn('text-4xl transition', s <= stars ? 'text-accent' : 'text-line')}>★</button>
        ))}
      </div>
      <Textarea placeholder="Share details of your experience" value={text} onChange={(e) => setText(e.target.value)} />
      <p className="mt-2 text-xs text-ink-3">You can review only after chatting with this worker. One review per interaction.</p>
      <Button block className="mt-4" disabled={!stars} loading={m.isPending}
        onClick={() => m.mutate({ workerId, stars, text }, { onSuccess: () => { toast('Thanks! Review submitted'); onClose(); } })}>Submit</Button>
    </Sheet>
  );
}

export function MyProfile() {
  const t = useT();
  const nav = useNavigate();
  const user = useAuth((s) => s.user);
  const { data: w } = useWorker('w1'); // demo: own profile preview
  return (
    <div>
      <TopBar back={false} title={t('myProfile')} right={<Button size="sm" variant="soft" className="mr-2" onClick={() => nav('/onboarding')}>{t('editProfile')}</Button>} />
      <div className="mx-4 mt-3 rounded-xl bg-primary-soft p-3 text-center text-xs font-medium text-primary">This is how customers see your profile</div>
      {w ? <ProfileBody w={{ ...w, name: user?.name ?? w.name }} preview /> : <div className="space-y-3 p-4"><Skeleton className="h-60" /><Skeleton className="h-40" /></div>}
    </div>
  );
}

const STEPS = ['Basic details', 'Skills', 'Service area', 'Verification'];
export function WorkerOnboarding() {
  const nav = useNavigate();
  const { user, switchRole, updateUser } = useAuth();
  const cats = useCategories();
  const save = useSaveWorkerProfile();
  const verify = useSubmitVerification();
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ name: user?.name ?? '', bio: '', experience: '', categoryId: '', skills: [] as string[], radius: 5, locality: '', hours: '9 AM – 7 PM', vType: 'id' as VerificationType, docs: [] as string[] });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const SKILLS = ['Wiring', 'Repair', 'Installation', 'Maintenance', 'Emergency', 'Commercial', 'Residential', 'Consultation'];
  const valid = [f.name.length > 1 && !!f.experience, !!f.categoryId && f.skills.length > 0, f.locality.length > 2, f.docs.length > 0][step];

  const next = () => {
    if (step < 3) return setStep(step + 1);
    save.mutate(f, {
      onSuccess: () => verify.mutate({ type: f.vType, documents: f.docs }, {
        onSuccess: () => { switchRole('worker'); updateUser({ workerProfileStatus: 'pending' }); toast('Profile submitted for verification'); nav('/', { replace: true }); },
      }),
    });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <TopBar title="Worker profile" />
      <div className="px-4 pt-2">
        <div className="flex gap-1.5">{STEPS.map((_, i) => <span key={i} className={cn('h-1.5 flex-1 rounded-full', i <= step ? 'bg-primary' : 'bg-line')} />)}</div>
        <p className="mt-3 text-xs font-semibold text-primary">STEP {step + 1} OF 4</p>
        <h2 className="text-xl font-extrabold">{STEPS[step]}</h2>
      </div>
      <div className="flex-1 space-y-4 p-4">
        {step === 0 && <>
          <div className="flex justify-center">
            <button className="relative"><Avatar name={f.name || 'W N'} size={92} /><span className="absolute right-0 bottom-0 grid size-8 place-items-center rounded-full bg-primary text-white"><Camera size={16} /></span></button>
          </div>
          <Input label="Display name" value={f.name} onChange={(e) => set('name', e.target.value)} />
          <Input label="Experience (years)" inputMode="numeric" value={f.experience} onChange={(e) => set('experience', e.target.value.replace(/\D/g, ''))} />
          <Textarea label="Short bio" value={f.bio} onChange={(e) => set('bio', e.target.value)} placeholder="Tell customers about your work" />
        </>}
        {step === 1 && <>
          <p className="text-sm font-medium text-ink-2">Service category</p>
          <div className="flex flex-wrap gap-2">{cats.data?.map((c) => <Chip key={c.id} active={f.categoryId === c.id} onClick={() => set('categoryId', c.id)}>{c.name}</Chip>)}</div>
          <p className="pt-2 text-sm font-medium text-ink-2">Skills</p>
          <div className="flex flex-wrap gap-2">
            {SKILLS.map((s) => <Chip key={s} active={f.skills.includes(s)} onClick={() => set('skills', f.skills.includes(s) ? f.skills.filter((x) => x !== s) : [...f.skills, s])}>{s}</Chip>)}
          </div>
        </>}
        {step === 2 && <>
          <Input label="Service locality" value={f.locality} onChange={(e) => set('locality', e.target.value)} placeholder="e.g. Karol Bagh, New Delhi" left={<MapPin size={18} className="text-ink-3" />} />
          <p className="text-xs text-ink-3">Your exact home address is never shown to customers — only approximate distance.</p>
          <p className="text-sm font-medium text-ink-2">Service radius</p>
          <div className="flex gap-2">{APP.radiusOptions.map((r) => <Chip key={r} active={f.radius === r} onClick={() => set('radius', r)}>{r} KM</Chip>)}</div>
          <Input label="Working hours" value={f.hours} onChange={(e) => set('hours', e.target.value)} />
        </>}
        {step === 3 && <>
          <p className="text-sm text-ink-2">Documents are stored privately and seen only by verification staff. The badge shows exactly what was verified.</p>
          {([['phone', 'Phone only', 'Already verified via OTP'], ['id', 'Government ID', 'Aadhaar / PAN / Voter ID'], ['id_address', 'ID + Address', 'ID and address proof']] as const).map(([k, a, b]) => (
            <button key={k} onClick={() => set('vType', k)} className={cn('flex w-full items-center gap-3 rounded-2xl border-2 p-3.5 text-left', f.vType === k ? 'border-primary bg-primary-soft' : 'border-line')}>
              <CheckCircle2 className={f.vType === k ? 'text-primary' : 'text-line'} /><span><b className="block text-[15px]">{a}</b><span className="text-xs text-ink-2">{b}</span></span>
            </button>
          ))}
          <button onClick={() => set('docs', [...f.docs, `Document_${f.docs.length + 1}.jpg`])} className="flex w-full flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-line py-6 text-ink-2">
            <Upload /><b className="text-sm">Upload document</b><span className="text-xs">JPG, PNG or PDF · max 5 MB</span>
          </button>
          {f.docs.map((d) => <div key={d} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm"><CheckCircle2 size={16} className="text-success" />{d}</div>)}
        </>}
      </div>
      <div className="pb-safe flex gap-2 border-t border-line p-3">
        {step > 0 && <Button variant="outline" size="lg" onClick={() => setStep(step - 1)}>Back</Button>}
        <Button size="lg" block disabled={!valid} loading={save.isPending || verify.isPending} onClick={next}>{step < 3 ? 'Next' : 'Submit for verification'}</Button>
      </div>
    </div>
  );
}
