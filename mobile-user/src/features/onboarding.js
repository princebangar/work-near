// Native port of Frontend/src/features/onboarding.tsx — worker profile wizard + verification.
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, CheckCircle2, Clock, Crosshair, FileText, Map as MapIcon, MapPin, Plus, ShieldCheck, Upload, X } from 'lucide-react-native';
import { Avatar, Badge, Button, Card, Chip, EmptyState, ErrorState, Input, Skeleton, Textarea, Toggle, TopBar, Txt, verificationLabel } from '@/components/ui';
import { PullRefresh } from '@/components/PullRefresh';
import { LocationSheet } from '@/components/LocationSheet';
import {
  errorMessage, fieldErrors, isApiError, toastError, useCategories, useMyVerification, useMyWorkerProfile, useSaveWorkerProfile, useSubmitVerification, useUploadWorkerPhoto,
} from '@/api';
import { useAuth, useFeature, useGeo, usePrefs, toast } from '@/store';
import { useRadius } from '@/hooks/useAppSettings';
import { useT } from '@/i18n';
import { date } from '@/lib/format';
import { getDeviceLocation, GpsError } from '@/lib/location';
import { pickFiles } from '@/lib/media';
import { useAvatarPicker } from '@/components/AvatarCropper';
import { cleanName, displayNameError } from '@/lib/validate';
import { mapsEnabled, reverseGeocode } from '@/lib/maps';
import { useColors } from '@/theme';

const LANGS = ['Hindi', 'English', 'Punjabi', 'Urdu', 'Bengali', 'Marathi', 'Gujarati', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Odia'];
// Quick-pick suggestions only — nothing is pre-filled; the worker chooses or types their own.
const HOURS = ['Mon – Sat, 9:00 AM – 7:00 PM', 'All days, 8:00 AM – 8:00 PM', 'Weekends only', '24 × 7'];

const STEP_TITLE = { basic: 'stepBasic', skills: 'stepSkills', area: 'stepArea', details: 'stepDetails', verify: 'stepVerify' };
// Which step shows a server field error.
const FIELD_STEP = {
  name: 'basic', experience: 'basic', bio: 'basic', categoryId: 'skills', skills: 'skills',
  locality: 'area', lat: 'area', lng: 'area', radius: 'area', hours: 'details', priceRange: 'details', languages: 'details', showPhone: 'details',
};

const parsePrice = (s) => {
  const m = s?.match(/(\d[\d,]*)\D+(\d[\d,]*)/);
  if (m) return { min: m[1].replace(/,/g, ''), max: m[2].replace(/,/g, '') };
  const one = s?.match(/(\d[\d,]*)/);
  return { min: one ? one[1].replace(/,/g, '') : '', max: '' };
};
const formatPrice = (min, max) => (min && max ? `₹${min} – ₹${max}` : min ? `From ₹${min}` : max ? `Up to ₹${max}` : '');

export function WorkerOnboarding() {
  const t = useT();
  const c = useColors();
  const mine = useMyWorkerProfile();
  if (mine.isLoading) return <View style={{ flex: 1, backgroundColor: c.surface }}><TopBar title={t('workerProfile')} /><View style={{ gap: 12, padding: 16 }}><Skeleton style={{ height: 32, width: 160 }} /><Skeleton style={{ height: 96 }} /><Skeleton style={{ height: 48 }} /><Skeleton style={{ height: 48 }} /></View></View>;
  if (mine.isError) return <View style={{ flex: 1, backgroundColor: c.surface }}><TopBar title={t('workerProfile')} /><ErrorState message={errorMessage(mine.error)} onRetry={() => mine.refetch()} /></View>;
  return <OnboardingForm existing={mine.data ?? null} />;
}

function OnboardingForm({ existing }) {
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
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
  const { pick: pickAvatar, cropper } = useAvatarPicker();
  // Mode is fixed at mount: saving a new profile fills the cache, but the flow must continue to the verification step.
  const [edit] = useState(() => !!existing);

  const price0 = parsePrice(existing?.priceRange);
  const [f, setF] = useState(() => ({
    name: existing?.name ?? user?.name ?? '',
    bio: existing?.bio ?? '',
    experience: existing ? String(existing.experienceYrs) : '',
    categoryId: existing?.categoryId ?? '',
    skills: existing?.skills ?? [],
    languages: existing?.languages ?? [],
    radius: existing?.serviceRadiusKm ?? options[0] ?? 5,
    locality: existing?.locality ?? '',
    // Work location must be set explicitly (GPS or map) — never silently taken from a default.
    lat: existing?.lat ?? point?.lat ?? null,
    lng: existing?.lng ?? point?.lng ?? null,
    placeLabel: existing ? existing.locality : point?.label ?? '',
    hours: existing?.hours ?? '',
    priceMin: price0.min,
    priceMax: price0.max,
    showPhone: existing?.showPhone ?? false,
  }));
  const [errors, setErrors] = useState({});
  const set = (k, v) => {
    setF((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors(({ [k]: _drop, ...rest }) => rest);
  };
  const [photo, setPhoto] = useState(null);
  const [customSkill, setCustomSkill] = useState('');
  const [mapOpen, setMapOpen] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);

  const steps = useMemo(() => ['basic', 'skills', 'area', 'details', ...(!edit && verificationOn ? ['verify'] : [])], [edit, verificationOn]);
  const [step, setStep] = useState(0);
  const key = steps[step];
  const cat = cats.data?.find((x) => x.id === f.categoryId);
  const catSkills = cat?.skills ?? [];
  const extraSkills = f.skills.filter((sk) => !catSkills.includes(sk));

  if (!edit && !workerReg) {
    return <View style={{ flex: 1, backgroundColor: c.surface }}><TopBar title={t('workerProfile')} /><EmptyState icon={Clock} title={t('workerRegPausedTitle')} sub={t('workerRegPaused')} /></View>;
  }
  if (!edit && !dualRole && user && !user.roles.includes('worker')) {
    return <View style={{ flex: 1, backgroundColor: c.surface }}><TopBar title={t('workerProfile')} /><EmptyState icon={ShieldCheck} title={t('oneRoleTitle')} sub={t('oneRoleSub')} /></View>;
  }

  const exp = Number(f.experience);
  const priceMin = Number(f.priceMin || 0), priceMax = Number(f.priceMax || 0);
  /** Field errors for one step (same rules as the server) — shown when the user taps Next. */
  const check = (k) => {
    const e = {};
    if (k === 'basic') {
      const n = displayNameError(f.name);
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

  const toggleSkill = (sk) => set('skills', f.skills.includes(sk) ? f.skills.filter((x) => x !== sk) : f.skills.length >= 15 ? f.skills : [...f.skills, sk]);
  const addCustomSkill = () => {
    const sk = customSkill.trim().slice(0, 40);
    if (sk && !f.skills.some((x) => x.toLowerCase() === sk.toLowerCase()) && f.skills.length < 15) set('skills', [...f.skills, sk]);
    setCustomSkill('');
  };
  const pickCategory = (id) => {
    if (id === f.categoryId) return;
    const allowed = cats.data?.find((x) => x.id === id)?.skills ?? [];
    setF((p) => ({ ...p, categoryId: id, skills: p.skills.filter((sk) => allowed.includes(sk)) }));
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
      toast(t(e instanceof GpsError ? `gps_${e.reason}` : 'gps_unavailable'), 'error');
    } finally {
      setGpsBusy(false);
    }
  };
  const onPick = (p) => {
    setF((x) => ({ ...x, lat: p.lat, lng: p.lng, placeLabel: p.label, locality: x.locality || p.label }));
    setErrors(({ lat: _l, ...rest }) => rest);
  };

  const finish = () => {
    toast(t('workerProfileLive'));
    if (router.canDismiss()) router.dismissAll();
    router.replace('/');
  };

  const submitProfile = () => {
    setErrors({});
    save.mutate(
      {
        name: cleanName(f.name), bio: f.bio.trim(), experience: exp, categoryId: f.categoryId, skills: f.skills, languages: f.languages,
        radius: f.radius, locality: f.locality.trim(), hours: f.hours.trim(), priceRange: formatPrice(f.priceMin, f.priceMax),
        lat: f.lat, lng: f.lng, ...(phoneSharingOn && { showPhone: f.showPhone }),
      },
      {
        onSuccess: async () => {
          if (photo) {
            try { await uploadPhoto.mutateAsync(photo); } catch (e) { toastError(e, t('photoUploadFailed')); }
          }
          if (edit) { toast(t('profileUpdated')); router.back(); }
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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.surface }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopBar title={edit ? t('editWorkerProfile') : t('workerProfile')} />
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>{steps.map((_, i) => <View key={i} style={{ height: 6, flex: 1, borderRadius: 3, backgroundColor: i <= step ? c.primary : c.line }} />)}</View>
        <Txt w={600} size={12} c="primary" style={{ marginTop: 12 }}>{`${t('step')} ${step + 1} / ${steps.length}`.toUpperCase()}</Txt>
        <Txt w={800} size={20}>{t(STEP_TITLE[key])}</Txt>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, gap: 16, padding: 16 }}>
        {key === 'basic' && <>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Pressable onPress={async () => { const file = await pickAvatar(); if (file) setPhoto(file); }} accessibilityLabel={t('changePhoto')}>
              <Avatar src={photo?.uri ?? existing?.photo ?? user?.avatar} name={f.name || 'W N'} size={92} />
              <View style={[st.cam, { backgroundColor: c.primary, borderColor: c.surface }]}><Camera size={16} color={c.onPrimary} /></View>
            </Pressable>
            <Txt size={12} c="ink3">{t('workPhotoHint')}</Txt>
          </View>
          <Input label={t('displayName')} value={f.name} maxLength={80} onChangeText={(v) => set('name', v)} error={errors.name} />
          <Input label={t('experienceYears')} keyboardType="number-pad" maxLength={2} value={f.experience} onChangeText={(v) => set('experience', v.replace(/\D/g, ''))}
            error={errors.experience ?? (f.experience !== '' && exp > 60 ? t('max60') : undefined)} />
          <Textarea label={t('shortBio')} value={f.bio} maxLength={1000} onChangeText={(v) => set('bio', v)} placeholder={t('bioPlaceholder')}
            error={errors.bio} hint={`${f.bio.length}/1000 · ${t('bioTip')}`} />
        </>}

        {key === 'skills' && <>
          <Txt w={500} size={14} c="ink2">{t('serviceCategory')}</Txt>
          {cats.isLoading && <Skeleton style={{ height: 96 }} />}
          {cats.isError && <ErrorState message={errorMessage(cats.error)} onRetry={() => cats.refetch()} />}
          <View style={st.wrap}>{cats.data?.map((x) => <Chip key={x.id} active={f.categoryId === x.id} onPress={() => pickCategory(x.id)}>{lang === 'hi' && x.nameHi ? x.nameHi : x.name}</Chip>)}</View>
          {errors.categoryId && <Txt size={12} c="danger">{errors.categoryId}</Txt>}
          {f.categoryId ? <>
            <Txt w={500} size={14} c="ink2" style={{ paddingTop: 8 }}>{t('skills')} <Txt size={14} c="ink3">({f.skills.length}/15)</Txt></Txt>
            <View style={st.wrap}>{[...catSkills, ...extraSkills].map((sk) => <Chip key={sk} active={f.skills.includes(sk)} onPress={() => toggleSkill(sk)}>{sk}</Chip>)}</View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Input style={{ flex: 1 }} value={customSkill} maxLength={40} onChangeText={setCustomSkill} placeholder={t('addOwnSkill')} onSubmitEditing={addCustomSkill} returnKeyType="done" />
              <Button variant="soft" style={{ height: 48 }} disabled={!customSkill.trim() || f.skills.length >= 15} onPress={addCustomSkill}><Plus size={18} color={c.primary} /></Button>
            </View>
            {errors.skills && <Txt size={12} c="danger">{errors.skills}</Txt>}
          </> : null}
        </>}

        {key === 'area' && <>
          <Input label={t('serviceLocality')} value={f.locality} maxLength={120} onChangeText={(v) => set('locality', v)} placeholder="e.g. Karol Bagh, New Delhi"
            left={<MapPin size={18} color={c.ink3} />} error={errors.locality} />
          <View>
            <Txt w={500} size={14} c="ink2" style={{ marginBottom: 6 }}>{t('workLocation')}</Txt>
            <Card style={{ padding: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MapPin size={18} color={c.primary} />
                <Txt w={600} size={14} c={f.lat === null ? 'ink3' : 'ink'} numberOfLines={1} style={{ flex: 1 }}>
                  {f.lat === null ? t('setLocation') : f.placeLabel || `${f.lat.toFixed(4)}, ${f.lng.toFixed(4)}`}
                </Txt>
              </View>
              <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
                <Button variant="soft" size="sm" grow icon={Crosshair} loading={gpsBusy} onPress={useGps}>{t('currentLocation')}</Button>
                <Button variant="outline" size="sm" grow icon={MapIcon} onPress={() => setMapOpen(true)}>{t('pickOnMap')}</Button>
              </View>
            </Card>
            {(errors.lat || errors.lng) && <Txt size={12} c="danger" style={{ marginTop: 4 }}>{errors.lat ?? errors.lng}</Txt>}
            <Txt size={12} c="ink3" style={{ marginTop: 8 }}>{t('addressPrivate')}</Txt>
          </View>
          <Txt w={500} size={14} c="ink2">{t('serviceRadius')}</Txt>
          <View style={{ flexDirection: 'row', gap: 8 }}>{options.map((r) => <Chip key={r} active={f.radius === r} onPress={() => set('radius', r)}>{r} KM</Chip>)}</View>
          <LocationSheet open={mapOpen} onClose={() => setMapOpen(false)} onPick={onPick} circleKm={f.radius} title={t('pickOnMap')}
            initial={f.lat !== null && f.lng !== null ? { lat: f.lat, lng: f.lng, label: f.placeLabel || f.locality, source: 'manual' } : undefined} />
        </>}

        {key === 'details' && <>
          <View>
            <Input label={t('workingHours')} value={f.hours} maxLength={80} onChangeText={(v) => set('hours', v)} error={errors.hours} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 8 }}>
              {HOURS.map((h) => <Chip key={h} small active={f.hours === h} onPress={() => set('hours', h)}>{h}</Chip>)}
            </ScrollView>
          </View>
          <View>
            <Txt w={500} size={14} c="ink2" style={{ marginBottom: 6 }}>{t('priceRange')} <Txt size={14} c="ink3">({t('optional')})</Txt></Txt>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Input style={{ flex: 1 }} keyboardType="number-pad" maxLength={6} value={f.priceMin} placeholder={t('from')} left={<Txt c="ink3">₹</Txt>} onChangeText={(v) => set('priceMin', v.replace(/\D/g, ''))} />
              <Input style={{ flex: 1 }} keyboardType="number-pad" maxLength={6} value={f.priceMax} placeholder={t('to')} left={<Txt c="ink3">₹</Txt>} onChangeText={(v) => set('priceMax', v.replace(/\D/g, ''))} />
            </View>
            {errors.priceRange ? <Txt size={12} c="danger" style={{ marginTop: 4 }}>{errors.priceRange}</Txt> : <Txt size={12} c="ink3" style={{ marginTop: 4 }}>{t('priceHint')}</Txt>}
          </View>
          <View>
            <Txt w={500} size={14} c="ink2" style={{ marginBottom: 6 }}>{t('languages')}</Txt>
            <View style={st.wrap}>
              {LANGS.map((l) => (
                <Chip key={l} active={f.languages.includes(l)} disabled={!f.languages.includes(l) && f.languages.length >= 8}
                  onPress={() => set('languages', f.languages.includes(l) ? f.languages.filter((x) => x !== l) : [...f.languages, l])}>{l}</Chip>
              ))}
            </View>
            {errors.languages && <Txt size={12} c="danger" style={{ marginTop: 4 }}>{errors.languages}</Txt>}
          </View>
          {phoneSharingOn && (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
              <View style={{ flex: 1 }}><Txt w={700}>{t('sharePhone')}</Txt><Txt size={12} c="ink2">{t('sharePhoneSub')} (+91 {user?.mobile})</Txt></View>
              <Toggle label={t('sharePhone')} checked={f.showPhone} onChange={(v) => set('showPhone', v)} />
            </Card>
          )}
        </>}

        {key === 'verify' && <VerificationForm onDone={finish} />}
      </ScrollView>

      {key !== 'verify' ? (
        <View style={{ flexDirection: 'row', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, backgroundColor: c.surface, padding: 12, paddingBottom: 12 + insets.bottom }}>
          {step > 0 && <Button variant="outline" size="lg" onPress={() => setStep(step - 1)}>{t('back')}</Button>}
          <Button size="lg" grow loading={busy} onPress={next}>{step < lastFormStep ? t('next') : edit ? t('saveChanges') : t('saveProfile')}</Button>
        </View>
      ) : (
        <Pressable onPress={finish} style={{ alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 + insets.bottom }}>
          <Txt w={600} size={14} c="ink2">{t('skipForNow')}</Txt>
        </Pressable>
      )}
      {cropper}
    </KeyboardAvoidingView>
  );
}

// ---------- Verification ----------
const V_TYPES = [
  { k: 'phone', title: 'vPhone', sub: 'vPhoneSub' },
  { k: 'id', title: 'vId', sub: 'vIdSub' },
  { k: 'id_address', title: 'vIdAddress', sub: 'vIdAddressSub' },
];

/** Document upload (private storage, admin-reviewed). 'phone' needs no files. */
export function VerificationForm({ onDone }) {
  const t = useT();
  const c = useColors();
  const [type, setType] = useState('id');
  const [files, setFiles] = useState([]);
  const m = useSubmitVerification();
  const needsFiles = type !== 'phone';
  const submit = () =>
    m.mutate({ type, files }, {
      onSuccess: () => { toast(t('verificationSubmitted')); onDone(); },
      onError: (e) => { toastError(e); if (isApiError(e, 'ALREADY_PENDING')) onDone(); },
    });
  const addFiles = async () => {
    const fs = await pickFiles({ multiple: true, allowPdf: true, max: 4 - files.length });
    if (fs.length) setFiles((p) => [...p, ...fs].slice(0, 4));
  };
  return (
    <View style={{ gap: 12 }}>
      <Txt size={14} c="ink2">{t('docsPrivate')}</Txt>
      <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
        {V_TYPES.map(({ k, title, sub }) => {
          const on = type === k;
          return (
            <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setType(k)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 2, padding: 14, borderColor: on ? c.primary : c.line, backgroundColor: on ? c.primarySoft : 'transparent' }}>
              <CheckCircle2 size={24} color={on ? c.primary : c.line} />
              <View style={{ flex: 1 }}><Txt w={700}>{t(title)}</Txt><Txt size={12} c="ink2">{t(sub)}</Txt></View>
            </Pressable>
          );
        })}
      </View>
      {needsFiles && (
        <>
          {files.length < 4 && (
            <Pressable onPress={addFiles} style={{ alignItems: 'center', gap: 4, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: c.line, paddingVertical: 24 }}>
              <Upload size={24} color={c.ink2} /><Txt w={700} size={14} c="ink2">{t('uploadDocument')}</Txt><Txt size={12} c="ink2">{t('docFormats')}</Txt>
            </Pressable>
          )}
          {files.map((file, i) => (
            <View key={`${file.name}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, backgroundColor: c.surface2, paddingHorizontal: 12, paddingVertical: 8 }}>
              <FileText size={16} color={c.primary} />
              <Txt size={14} numberOfLines={1} style={{ flex: 1 }}>{file.name}</Txt>
              {file.size ? <Txt size={12} c="ink3">{(file.size / 1024 / 1024).toFixed(1)} MB</Txt> : null}
              <Pressable accessibilityLabel={t('remove')} onPress={() => setFiles((p) => p.filter((_, j) => j !== i))} style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}><X size={16} color={c.ink3} /></Pressable>
            </View>
          ))}
        </>
      )}
      <Button size="lg" block disabled={needsFiles && files.length === 0} loading={m.isPending} onPress={submit}>{t('submitVerification')}</Button>
    </View>
  );
}

export function VerificationPage() {
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const on = useFeature('verification');
  const profile = useMyWorkerProfile();
  const latest = useMyVerification(on && !!profile.data);
  const v = latest.data;
  const head = <TopBar title={t('stepVerify')} />;
  const wrap = (children) => <View style={{ flex: 1, backgroundColor: c.surface }}>{head}{children}</View>;
  if (!on) return wrap(<EmptyState icon={ShieldCheck} title={t('verificationOff')} />);
  if (profile.isLoading || latest.isLoading) return wrap(<View style={{ gap: 12, padding: 16 }}><Skeleton style={{ height: 80 }} /><Skeleton style={{ height: 160 }} /></View>);
  if (!profile.data) return wrap(<EmptyState icon={ShieldCheck} title={t('createWorkerProfile')} sub={t('verifyNeedsProfile')} action={<Button onPress={() => router.push('/onboarding')}>{t('getStarted')}</Button>} />);
  const status = profile.data.verificationStatus;
  return wrap(
    <ScrollView refreshControl={<PullRefresh />} contentContainerStyle={{ gap: 16, padding: 16, paddingBottom: 16 + insets.bottom }}>
      {v && (
        <Card style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Txt w={700}>{t('lastSubmission')}</Txt>
            <Badge tone={v.status === 'approved' ? 'success' : v.status === 'rejected' ? 'danger' : 'warning'}>{v.status.replace('_', ' ')}</Badge>
          </View>
          <Txt size={14} c="ink2" style={{ marginTop: 4 }}>{verificationLabel[v.type]} · {v.documents} {t('documents')} · {date(v.submittedAt)}</Txt>
          {v.reason && v.status !== 'approved' ? (
            <Txt size={14} style={{ marginTop: 8, borderRadius: 8, backgroundColor: c.surface2, padding: 10, overflow: 'hidden' }}><Txt w={700} size={14}>{t('reason')}:</Txt> {v.reason}</Txt>
          ) : null}
        </Card>
      )}
      {status === 'pending' ? (
        <Card style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, backgroundColor: c.warningSoft }}>
          <Clock size={24} color={c.warning} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}><Txt w={700}>{t('vPendingTitle')}</Txt><Txt size={12} c="ink2">{t('vPendingSub')}</Txt></View>
        </Card>
      ) : status === 'approved' ? (
        <Card style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, backgroundColor: c.successSoft }}>
          <ShieldCheck size={24} color={c.success} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}><Txt w={700}>{t('vApprovedTitle')}</Txt><Txt size={12} c="ink2">{profile.data.verification ? verificationLabel[profile.data.verification] : t('vApprovedSub')}</Txt></View>
        </Card>
      ) : (
        <VerificationForm onDone={() => router.back()} />
      )}
    </ScrollView>,
  );
}

const st = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cam: { position: 'absolute', right: 0, bottom: 0, width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
