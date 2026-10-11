import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Camera, CheckCircle2, Clock, Crosshair, FileText, Map as MapIcon, MapPin, Plus, ShieldCheck, Upload, X } from 'lucide-react';
import { Avatar, Badge, Button, Card, Chip, EmptyState, ErrorState, Input, Skeleton, Textarea, Toggle, TopBar, verificationLabel } from '@/components/ui';
import { FilePicker, LocationSheet } from '@/components/shared';
import type { PickedPlace } from '@/components/LocationSheet';
import {
  errorMessage, fieldErrors, isApiError, toastError, useCategories, useMyVerification, useMyWorkerProfile, useSaveWorkerProfile, useSubmitVerification,
  useUploadWorkerPhoto,
} from '@/api';
import { useAuth, useFeature, useGeo, usePrefs, toast } from '@/store';
import { useObjectUrl, useRadius } from '@/hooks/useAppSettings';
import { useT, type TKey } from '@/i18n';
import { cn, date, getDeviceLocation, GpsError } from '@/lib/format';
import { cleanName, nameError } from '@/lib/validate';
import { mapsEnabled, reverseGeocode } from '@/lib/maps';
import type { MyWorkerProfile, VerificationType } from '@/types';

const LANGS = ['Hindi', 'English', 'Punjabi', 'Urdu', 'Bengali', 'Marathi', 'Gujarati', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Odia'];
// Quick-pick suggestions only — nothing is pre-filled; the worker chooses or types their own.
const HOURS = ['Mon – Sat, 9:00 AM – 7:00 PM', 'All days, 8:00 AM – 8:00 PM', 'Weekends only', '24 × 7'];

type StepKey = 'basic' | 'skills' | 'area' | 'details' | 'verify';
const STEP_TITLE: Record<StepKey, TKey> = { basic: 'stepBasic', skills: 'stepSkills', area: 'stepArea', details: 'stepDetails', verify: 'stepVerify' };
// Which step shows a server field error.
const FIELD_STEP: Record<string, StepKey> = {
  name: 'basic', experience: 'basic', bio: 'basic', categoryId: 'skills', skills: 'skills',
  locality: 'area', lat: 'area', lng: 'area', radius: 'area', hours: 'details', priceRange: 'details', languages: 'details', showPhone: 'details',
};

const parsePrice = (s?: string) => {
  const m = s?.match(/(\d[\d,]*)\D+(\d[\d,]*)/);
  if (m) return { min: m[1].replace(/,/g, ''), max: m[2].replace(/,/g, '') };
  const one = s?.match(/(\d[\d,]*)/);
  return { min: one ? one[1].replace(/,/g, '') : '', max: '' };
};
const formatPrice = (min: string, max: string) => (min && max ? `₹${min} – ₹${max}` : min ? `From ₹${min}` : max ? `Up to ₹${max}` : '');

export function WorkerOnboarding() {
  const t = useT();
  const mine = useMyWorkerProfile();
  if (mine.isLoading) return <><TopBar title={t('workerProfile')} /><div className="space-y-3 p-4"><Skeleton className="h-8 w-40" /><Skeleton className="h-24" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div></>;
  if (mine.isError) return <><TopBar title={t('workerProfile')} /><ErrorState message={errorMessage(mine.error)} onRetry={() => mine.refetch()} /></>;
  return <OnboardingForm existing={mine.data ?? null} />;
}

function OnboardingForm({ existing }: { existing: MyWorkerProfile | null }) {
  const t = useT();
  const nav = useNavigate();
  const lang = usePrefs((s) => s.lang);
  const user = useAuth((s) => s.user);
  const point = useGeo((s) => s.point);
  const { options } = useRadius();
  const workerReg = useFeature('workerRegistration');
  const dualRole = useFeature('dualRole');
  const verificationOn = useFeature('verification');
  const phoneSharingOn = useFeature('phoneSharing');
  const cats = useCategories();
  const save = useSaveWorkerProfile();
  const uploadPhoto = useUploadWorkerPhoto();
  // Mode is fixed at mount: saving a new profile fills the cache, but the flow must continue to the verification step.
  const [edit] = useState(() => !!existing);

  const price0 = parsePrice(existing?.priceRange);
  const [f, setF] = useState(() => ({
    name: existing?.name ?? user?.name ?? '',
    bio: existing?.bio ?? '',
    experience: existing ? String(existing.experienceYrs) : '',
    categoryId: existing?.categoryId ?? '',
    skills: existing?.skills ?? ([] as string[]),
    languages: existing?.languages ?? ([] as string[]),
    radius: existing?.serviceRadiusKm ?? options[0] ?? 5,
    locality: existing?.locality ?? '',
    // Work location must be set explicitly (GPS or map) — never silently taken from a default.
    lat: existing?.lat ?? point?.lat ?? null as number | null,
    lng: existing?.lng ?? point?.lng ?? null as number | null,
    placeLabel: existing ? existing.locality : point?.label ?? '',
    hours: existing?.hours ?? '',
    priceMin: price0.min,
    priceMax: price0.max,
    showPhone: existing?.showPhone ?? false,
  }));
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    if (errors[k as string]) setErrors(({ [k as string]: _drop, ...rest }) => rest);
  };
  const [photo, setPhoto] = useState<File | null>(null);
  const photoUrl = useObjectUrl(photo);
  const [customSkill, setCustomSkill] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [mapOpen, setMapOpen] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);

  const steps: StepKey[] = useMemo(() => ['basic', 'skills', 'area', 'details', ...(!edit && verificationOn ? (['verify'] as const) : [])], [edit, verificationOn]);
  const [step, setStep] = useState(0);
  const key = steps[step];
  const cat = cats.data?.find((c) => c.id === f.categoryId);
  const catSkills = cat?.skills ?? [];
  const extraSkills = f.skills.filter((s) => !catSkills.includes(s));

  if (!edit && !workerReg) {
    return <><TopBar title={t('workerProfile')} /><EmptyState icon={<Clock size={32} />} title={t('workerRegPausedTitle')} sub={t('workerRegPaused')} /></>;
  }
  if (!edit && !dualRole && user && !user.roles.includes('worker')) {
    return <><TopBar title={t('workerProfile')} /><EmptyState icon={<ShieldCheck size={32} />} title={t('oneRoleTitle')} sub={t('oneRoleSub')} /></>;
  }

  const exp = Number(f.experience);
  const priceMin = Number(f.priceMin || 0), priceMax = Number(f.priceMax || 0);
  /** Field errors for one step (same rules as the server) — shown when the user taps Next. */
  const check = (k: StepKey): Record<string, string> => {
    const e: Record<string, string> = {};
    if (k === 'basic') {
      const n = nameError(f.name);
      if (n) e.name = t(n);
      if (f.experience === '') e.experience = t('expRequired');
      else if (exp > 60) e.experience = t('max60');
    }
    if (k === 'skills') {
      if (!f.categoryId) e.categoryId = t('catRequired');
      else if (!f.skills.length) e.skills = t('skillRequired');
    }
    if (k === 'area') {
      if (f.locality.trim().length < 2) e.locality = t('localityRequired');
      if (f.lat === null || f.lng === null) e.lat = t('locationRequired');
    }
    if (k === 'details') {
      if (f.hours.trim().length < 3) e.hours = t('hoursRequired');
      if (!f.languages.length) e.languages = t('langRequired');
      if (f.priceMin && f.priceMax && priceMin > priceMax) e.priceRange = t('priceMinMax');
    }
    return e;
  };
  const lastFormStep = steps.indexOf('details');

  const toggleSkill = (s: string) => set('skills', f.skills.includes(s) ? f.skills.filter((x) => x !== s) : f.skills.length >= 15 ? f.skills : [...f.skills, s]);
  const addCustomSkill = () => {
    const s = customSkill.trim().slice(0, 40);
    if (s && !f.skills.some((x) => x.toLowerCase() === s.toLowerCase()) && f.skills.length < 15) set('skills', [...f.skills, s]);
    setCustomSkill('');
  };
  const pickCategory = (id: string) => {
    if (id === f.categoryId) return;
    const allowed = cats.data?.find((c) => c.id === id)?.skills ?? [];
    setF((p) => ({ ...p, categoryId: id, skills: p.skills.filter((s) => allowed.includes(s)) }));
  };

  const useGps = async () => {
    setGpsBusy(true);
    try {
      const p = await getDeviceLocation();
      const label = mapsEnabled ? await reverseGeocode(p.lat, p.lng).catch(() => '') : '';
      setF((x) => ({ ...x, lat: p.lat, lng: p.lng, placeLabel: label || t('currentLocation'), locality: x.locality || label }));
      setErrors(({ lat: _l, ...rest }) => rest);
      toast(t('locationSet'));
    } catch (e) {
      toast(t(e instanceof GpsError ? (`gps_${e.reason}` as TKey) : 'gps_unavailable'), 'error');
    } finally {
      setGpsBusy(false);
    }
  };
  const onPick = (p: PickedPlace) => {
    setF((x) => ({ ...x, lat: p.lat, lng: p.lng, placeLabel: p.label, locality: x.locality || p.label }));
    setErrors(({ lat: _l, ...rest }) => rest);
  };

  const finish = () => {
    toast(t('workerProfileLive'));
    nav('/', { replace: true });
  };

  const submitProfile = () => {
    setErrors({});
    save.mutate(
      {
        name: cleanName(f.name), bio: f.bio.trim(), experience: exp, categoryId: f.categoryId, skills: f.skills, languages: f.languages,
        radius: f.radius, locality: f.locality.trim(), hours: f.hours.trim(), priceRange: formatPrice(f.priceMin, f.priceMax),
        lat: f.lat!, lng: f.lng!, ...(phoneSharingOn && { showPhone: f.showPhone }),
      },
      {
        onSuccess: async () => {
          if (photo) {
            try { await uploadPhoto.mutateAsync(photo); } catch (e) { toastError(e, t('photoUploadFailed')); }
          }
          if (edit) { toast(t('profileUpdated')); nav(-1); }
          else if (steps.includes('verify')) setStep(steps.indexOf('verify'));
          else finish();
        },
        onError: (e) => {
          const fe = fieldErrors(e);
          setErrors(fe);
          const first = Object.keys(fe).map((k) => FIELD_STEP[k]).find(Boolean);
          if (first) setStep(steps.indexOf(first));
          toastError(e);
        },
      },
    );
  };

  const next = () => {
    const e = check(key);
    if (Object.keys(e).length) return setErrors(e);
    setErrors({});
    if (step < lastFormStep) return setStep(step + 1);
    if (step === lastFormStep) return submitProfile();
  };

  const busy = save.isPending || uploadPhoto.isPending;
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <TopBar title={edit ? t('editWorkerProfile') : t('workerProfile')} />
      <div className="px-4 pt-2">
        <div className="flex gap-1.5">{steps.map((_, i) => <span key={i} className={cn('h-1.5 flex-1 rounded-full transition', i <= step ? 'bg-primary' : 'bg-line')} />)}</div>
        <p className="mt-3 text-xs font-semibold text-primary uppercase">{t('step')} {step + 1} / {steps.length}</p>
        <h2 className="text-xl font-extrabold">{t(STEP_TITLE[key])}</h2>
      </div>

      <div className="flex-1 space-y-4 p-4">
        {key === 'basic' && <>
          <div className="flex flex-col items-center gap-1">
            <FilePicker onFiles={([file]) => setPhoto(file)}>
              {(open) => (
                <button type="button" onClick={open} className="relative" aria-label={t('changePhoto')}>
                  <Avatar src={photoUrl ?? existing?.photo ?? user?.avatar} name={f.name || 'W N'} size={92} />
                  <span className="absolute right-0 bottom-0 grid size-8 place-items-center rounded-full bg-primary text-on-primary ring-2 ring-surface"><Camera size={16} /></span>
                </button>
              )}
            </FilePicker>
            <span className="text-xs text-ink-3">{photo ? photo.name : t('workPhotoHint')}</span>
          </div>
          <Input label={t('displayName')} value={f.name} maxLength={80} onChange={(e) => set('name', e.target.value)} error={errors.name} />
          <Input label={t('experienceYears')} inputMode="numeric" maxLength={2} value={f.experience} onChange={(e) => set('experience', e.target.value.replace(/\D/g, ''))}
            error={errors.experience ?? (f.experience !== '' && exp > 60 ? t('max60') : undefined)} />
          <Textarea label={t('shortBio')} value={f.bio} maxLength={1000} onChange={(e) => set('bio', e.target.value)} placeholder={t('bioPlaceholder')}
            error={errors.bio} hint={`${f.bio.length}/1000 · ${t('bioTip')}`} />
        </>}

        {key === 'skills' && <>
          <p className="text-sm font-medium text-ink-2">{t('serviceCategory')}</p>
          {cats.isLoading && <Skeleton className="h-24" />}
          {cats.isError && <ErrorState message={errorMessage(cats.error)} onRetry={() => cats.refetch()} />}
          <div className="flex flex-wrap gap-2">{cats.data?.map((c) => <Chip key={c.id} active={f.categoryId === c.id} onClick={() => pickCategory(c.id)}>{lang === 'hi' && c.nameHi ? c.nameHi : c.name}</Chip>)}</div>
          {errors.categoryId && <p className="text-xs text-danger">{errors.categoryId}</p>}
          {f.categoryId && <>
            <p className="pt-2 text-sm font-medium text-ink-2">{t('skills')} <span className="text-ink-3">({f.skills.length}/15)</span></p>
            <div className="flex flex-wrap gap-2">
              {[...catSkills, ...extraSkills].map((s) => <Chip key={s} active={f.skills.includes(s)} onClick={() => toggleSkill(s)}>{s}</Chip>)}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); addCustomSkill(); }} className="flex gap-2">
              <div className="flex-1"><Input value={customSkill} maxLength={40} onChange={(e) => setCustomSkill(e.target.value)} placeholder={t('addOwnSkill')} /></div>
              <Button type="submit" variant="soft" className="h-12" disabled={!customSkill.trim() || f.skills.length >= 15}><Plus size={18} /></Button>
            </form>
            {errors.skills && <p className="text-xs text-danger">{errors.skills}</p>}
          </>}
        </>}

        {key === 'area' && <>
          <Input label={t('serviceLocality')} value={f.locality} maxLength={120} onChange={(e) => set('locality', e.target.value)} placeholder="e.g. Karol Bagh, New Delhi"
            left={<MapPin size={18} className="text-ink-3" />} error={errors.locality} />
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink-2">{t('workLocation')}</p>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <MapPin size={18} className="shrink-0 text-primary" />
                <span className={cn('min-w-0 flex-1 truncate text-sm font-semibold', f.lat === null && 'text-ink-3')}>{f.lat === null ? t('setLocation') : f.placeLabel || `${f.lat.toFixed(4)}, ${f.lng!.toFixed(4)}`}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="soft" size="sm" loading={gpsBusy} onClick={useGps}><Crosshair size={16} />{t('currentLocation')}</Button>
                <Button variant="outline" size="sm" onClick={() => setMapOpen(true)}><MapIcon size={16} />{t('pickOnMap')}</Button>
              </div>
            </Card>
            {(errors.lat || errors.lng) && <p className="mt-1 text-xs text-danger">{errors.lat ?? errors.lng}</p>}
            <p className="mt-2 text-xs text-ink-3">{t('addressPrivate')}</p>
          </div>
          <p className="text-sm font-medium text-ink-2">{t('serviceRadius')}</p>
          <div className="flex gap-2">{options.map((r) => <Chip key={r} active={f.radius === r} onClick={() => set('radius', r)}>{r} KM</Chip>)}</div>
          <LocationSheet open={mapOpen} onClose={() => setMapOpen(false)} onPick={onPick} circleKm={f.radius} title={t('pickOnMap')}
            initial={f.lat !== null && f.lng !== null ? { lat: f.lat, lng: f.lng, label: f.placeLabel || f.locality, source: 'manual' } : undefined} />
        </>}

        {key === 'details' && <>
          <div>
            <Input label={t('workingHours')} value={f.hours} maxLength={80} onChange={(e) => set('hours', e.target.value)} error={errors.hours} />
            <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">{HOURS.map((h) => <Chip key={h} active={f.hours === h} onClick={() => set('hours', h)} className="h-8 text-xs">{h}</Chip>)}</div>
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink-2">{t('priceRange')} <span className="text-ink-3">({t('optional')})</span></span>
            <div className="grid grid-cols-2 gap-2">
              <Input inputMode="numeric" maxLength={6} value={f.priceMin} placeholder={t('from')} left={<span className="text-ink-3">₹</span>} onChange={(e) => set('priceMin', e.target.value.replace(/\D/g, ''))} />
              <Input inputMode="numeric" maxLength={6} value={f.priceMax} placeholder={t('to')} left={<span className="text-ink-3">₹</span>} onChange={(e) => set('priceMax', e.target.value.replace(/\D/g, ''))} />
            </div>
            {errors.priceRange ? <p className="mt-1 text-xs text-danger">{errors.priceRange}</p> : <p className="mt-1 text-xs text-ink-3">{t('priceHint')}</p>}
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink-2">{t('languages')}</p>
            <div className="flex flex-wrap gap-2">
              {LANGS.map((l) => (
                <Chip key={l} active={f.languages.includes(l)} disabled={!f.languages.includes(l) && f.languages.length >= 8}
                  onClick={() => set('languages', f.languages.includes(l) ? f.languages.filter((x) => x !== l) : [...f.languages, l])}>{l}</Chip>
              ))}
            </div>
            {errors.languages && <p className="mt-1 text-xs text-danger">{errors.languages}</p>}
          </div>
          {phoneSharingOn && (
            <Card className="flex items-center gap-3 p-4">
              <div className="flex-1"><b className="text-[15px]">{t('sharePhone')}</b><p className="text-xs text-ink-2">{t('sharePhoneSub')} (+91 {user?.mobile})</p></div>
              <Toggle label={t('sharePhone')} checked={f.showPhone} onChange={(v) => set('showPhone', v)} />
            </Card>
          )}
        </>}

        {key === 'verify' && <VerificationForm onDone={finish} />}
      </div>

      {key !== 'verify' ? (
        <div className="pb-safe sticky bottom-0 flex gap-2 border-t border-line bg-surface p-3 dark:shadow-[0_-10px_28px_-14px_rgba(0,0,0,0.9)]">
          {step > 0 && <Button variant="outline" size="lg" onClick={() => setStep(step - 1)}>{t('back')}</Button>}
          <Button size="lg" block loading={busy} onClick={next}>
            {step < lastFormStep ? t('next') : edit ? t('saveChanges') : t('saveProfile')}
          </Button>
        </div>
      ) : (
        <div className="pb-safe px-4 pt-1 text-center">
          <button onClick={finish} className="text-sm font-semibold text-ink-2">{t('skipForNow')}</button>
        </div>
      )}
    </div>
  );
}

// ---------- Verification ----------
const V_TYPES: { k: VerificationType; title: TKey; sub: TKey }[] = [
  { k: 'phone', title: 'vPhone', sub: 'vPhoneSub' },
  { k: 'id', title: 'vId', sub: 'vIdSub' },
  { k: 'id_address', title: 'vIdAddress', sub: 'vIdAddressSub' },
];

/** Document upload (private storage, admin-reviewed). 'phone' needs no files. */
export function VerificationForm({ onDone }: { onDone: () => void }) {
  const t = useT();
  const [type, setType] = useState<VerificationType>('id');
  const [files, setFiles] = useState<File[]>([]);
  const m = useSubmitVerification();
  const needsFiles = type !== 'phone';
  const submit = () =>
    m.mutate(
      { type, files },
      {
        onSuccess: () => { toast(t('verificationSubmitted')); onDone(); },
        onError: (e) => { toastError(e); if (isApiError(e, 'ALREADY_PENDING')) onDone(); },
      },
    );
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-2">{t('docsPrivate')}</p>
      <div className="space-y-2" role="radiogroup">
        {V_TYPES.map(({ k, title, sub }) => (
          <button key={k} type="button" role="radio" aria-checked={type === k} onClick={() => setType(k)}
            className={cn('flex w-full items-center gap-3 rounded-2xl border-2 p-3.5 text-left transition', type === k ? 'border-primary bg-primary-soft' : 'border-line')}>
            <CheckCircle2 className={cn('shrink-0', type === k ? 'text-primary' : 'text-line')} />
            <span><b className="block text-[15px]">{t(title)}</b><span className="text-xs text-ink-2">{t(sub)}</span></span>
          </button>
        ))}
      </div>
      {needsFiles && (
        <>
          {files.length < 4 && (
            <FilePicker multiple allowPdf max={4 - files.length} onFiles={(fs) => setFiles((p) => [...p, ...fs].slice(0, 4))}>
              {(open) => (
                <button type="button" onClick={open} className="flex w-full flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-line py-6 text-ink-2">
                  <Upload /><b className="text-sm">{t('uploadDocument')}</b><span className="text-xs">{t('docFormats')}</span>
                </button>
              )}
            </FilePicker>
          )}
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
              <FileText size={16} className="shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0 text-xs text-ink-3">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
              <button aria-label={t('remove')} onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} className="grid size-7 place-items-center rounded-full text-ink-3 hover:bg-surface-3"><X size={16} /></button>
            </div>
          ))}
        </>
      )}
      <Button size="lg" block disabled={needsFiles && files.length === 0} loading={m.isPending} onClick={submit}>{t('submitVerification')}</Button>
    </div>
  );
}

export function VerificationPage() {
  const t = useT();
  const nav = useNavigate();
  const on = useFeature('verification');
  const profile = useMyWorkerProfile();
  const latest = useMyVerification(on && !!profile.data);
  const v = latest.data;
  const head = <TopBar title={t('stepVerify')} />;
  if (!on) return <div className="min-h-dvh bg-surface">{head}<EmptyState icon={<ShieldCheck size={32} />} title={t('verificationOff')} /></div>;
  if (profile.isLoading || latest.isLoading) return <div className="min-h-dvh bg-surface">{head}<div className="space-y-3 p-4"><Skeleton className="h-20" /><Skeleton className="h-40" /></div></div>;
  if (!profile.data) {
    return (
      <div className="min-h-dvh bg-surface">{head}
        <EmptyState icon={<ShieldCheck size={32} />} title={t('createWorkerProfile')} sub={t('verifyNeedsProfile')} action={<Button onClick={() => nav('/onboarding')}>{t('getStarted')}</Button>} />
      </div>
    );
  }
  const status = profile.data.verificationStatus;
  return (
    <div className="min-h-dvh bg-surface">
      {head}
      <div className="space-y-4 p-4">
        {v && (
          <Card className="p-4">
            <div className="flex items-center justify-between gap-2">
              <b className="text-[15px]">{t('lastSubmission')}</b>
              <Badge tone={v.status === 'approved' ? 'success' : v.status === 'rejected' ? 'danger' : 'warning'}>{v.status.replace('_', ' ')}</Badge>
            </div>
            <p className="mt-1 text-sm text-ink-2">{verificationLabel[v.type]} · {v.documents} {t('documents')} · {date(v.submittedAt)}</p>
            {v.reason && v.status !== 'approved' && <p className="mt-2 rounded-lg bg-surface-2 p-2.5 text-sm"><b>{t('reason')}:</b> {v.reason}</p>}
          </Card>
        )}
        {status === 'pending' ? (
          <Card className="flex items-start gap-3 border-warning/30 bg-warning-soft p-4">
            <Clock className="mt-0.5 shrink-0 text-warning" />
            <div><b className="text-[15px]">{t('vPendingTitle')}</b><p className="text-xs text-ink-2">{t('vPendingSub')}</p></div>
          </Card>
        ) : status === 'approved' ? (
          <Card className="flex items-start gap-3 border-success/30 bg-success-soft p-4">
            <ShieldCheck className="mt-0.5 shrink-0 text-success" />
            <div><b className="text-[15px]">{t('vApprovedTitle')}</b><p className="text-xs text-ink-2">{profile.data.verification ? verificationLabel[profile.data.verification] : t('vApprovedSub')}</p></div>
          </Card>
        ) : (
          <VerificationForm onDone={() => nav(-1)} />
        )}
      </div>
    </div>
  );
}
