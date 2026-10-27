// Native port of Frontend/src/features/account.tsx.
import { Children, cloneElement, useEffect, useState } from 'react';
import { AppState, FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bell, BellRing, Power, Briefcase, IdCard, CalendarDays, Camera, Pencil, UserRound, Check, ChevronRight, CreditCard, Crown, FileText, Globe, HelpCircle, LogOut, Mail, Moon, MoonStar, Phone, Repeat, Shield, ShieldCheck, Sun,
  Trash2, UserPen, UserX,
} from 'lucide-react-native';
import { Avatar, Badge, Button, CenterDialog, ConfirmDialog, Divided, EmptyState, ErrorState, Input, Skeleton, Toggle, TopBar, Txt } from '@/components/ui';
import { PullRefresh } from '@/components/PullRefresh';
import { HeaderScrim } from '@/components/HeaderScrim';
import { TAB_BAR_SPACE, useTabScroll } from '@/components/TabBar';
import { useLightStatusBar } from '@/hooks/useStatusBar';
import { cleanName, nameError } from '@/lib/validate';
import {
  errorMessage, fieldErrors, toastError, unregisterPush, useBlocked, useDeleteRequest, useEnablePush, useMySubscription, useUnblockUser, useUpdateMe, useUploadAvatar,
} from '@/api';
import { useAvatarPicker } from '@/components/AvatarCropper';
import { pushState } from '@/lib/push';
import { useAuth, useFeature, usePrefs, useTheme, toast } from '@/store';
import { useSupport } from '@/hooks/useAppSettings';
import { useT } from '@/i18n';
import { date } from '@/lib/format';
import { queryClient } from '@/lib/http';
import { alpha, useColors } from '@/theme';

// ---------- Building blocks ----------
function Group({ title, children }) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <View style={{ paddingTop: title ? 22 : 8 }}>
      {title ? <Txt w={700} size={12} c="ink3" style={{ paddingHorizontal: 24, marginBottom: 2, letterSpacing: 1.6 }}>{title.toUpperCase()}</Txt> : null}
      {items.map((el, i) => cloneElement(el, { last: i === items.length - 1, key: el.key ?? i }))}
    </View>
  );
}

/** Menu row: grey icon chip, label, optional value, chevron. The divider starts at the text. */
function Row({ icon: I, label, value, right, onPress, disabled, last, danger }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} disabled={disabled}
      style={({ pressed }) => [st.row, { opacity: disabled ? 0.6 : 1, backgroundColor: pressed ? c.surface2 : 'transparent' }]}>
      <View style={[st.icon44, { backgroundColor: danger ? c.dangerSoft : c.surface2 }]}><I size={20} color={danger ? c.danger : c.ink2} /></View>
      <View style={[st.rowBody, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line }]}>
        <Txt w={600} c={danger ? 'danger' : 'ink'} style={{ flex: 1, minWidth: 0 }}>{label}</Txt>
        {value !== undefined && <Txt size={13} c="ink3" numberOfLines={1} style={{ maxWidth: '48%' }}>{value}</Txt>}
        {right === undefined ? <ChevronRight size={18} color={c.ink3} /> : right}
      </View>
    </Pressable>
  );
}

/** Green hero with soft swooshes and a wave edge; the avatar sits on the wave. */
function HeroBg() {
  const c = useColors();
  return (
    <>
      <LinearGradient colors={[c.primary600, c.primary, c.primary2]} locations={[0, 0.55, 1]} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={StyleSheet.absoluteFill} />
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 400 160" preserveAspectRatio="none" pointerEvents="none">
        <Path d="M190 0 C230 40 262 70 330 80 C370 86 390 96 400 110 L400 0 Z" fill="rgba(255,255,255,0.10)" />
        <Path d="M290 0 C300 30 332 50 400 52 L400 0 Z" fill="rgba(255,255,255,0.08)" />
      </Svg>
    </>
  );
}

function ProfileHero({ title, sub, onLayout }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View onLayout={onLayout}>
      <HeroBg />
      <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 20, paddingBottom: 64 }}>
        <Txt w={800} size={28} c="#ffffff">{title}</Txt>
        <Txt w={500} size={13} c="rgba(255,255,255,0.85)" style={{ marginTop: 4 }}>{sub}</Txt>
      </View>
      <Svg style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 56, width: '100%' }} viewBox="0 0 400 56" preserveAspectRatio="none" pointerEvents="none">
        <Path d="M0 56 V30 C70 22 150 30 230 26 C305 22 355 6 400 0 V56 Z" fill="rgba(255,255,255,0.28)" />
        <Path d="M0 56 V40 C80 32 160 44 240 36 C310 29 360 18 400 12 V56 Z" fill={c.surface} />
      </Svg>
    </View>
  );
}

const subLabel = (s, t) => (!s ? '…' : s.status === 'active' ? t('subActive') : s.status === 'expired' ? t('subExpired') : s.status === 'pending' ? t('subPending') : t('subNone'));

/** Pick-one popup (Language, Appearance). The current choice is listed first and highlighted with a tick. */
function OptionSheet({ open, onClose, title, value, options, onPick }) {
  const c = useColors();
  const ordered = [...options].sort((a, b) => Number(b.value === value) - Number(a.value === value));
  return (
    <CenterDialog open={open} onClose={onClose} title={title}>
      <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
        {ordered.map(({ value: v, label, sub, icon: I }) => {
          const on = v === value;
          return (
            <Pressable key={v} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onPick(v)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 2, paddingHorizontal: 14, paddingVertical: 12, borderColor: on ? c.primary : c.line, backgroundColor: on ? c.primarySoft : c.surface }}>
              <View style={[st.icon40, { backgroundColor: on ? c.primary : c.surface2 }]}><I size={19} color={on ? c.onPrimary : c.ink2} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt w={700} c={on ? 'primary' : 'ink'}>{label}</Txt>
                {sub ? <Txt size={12} c="ink2">{sub}</Txt> : null}
              </View>
              {on && <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}><Check size={14} strokeWidth={3} color={c.onPrimary} /></View>}
            </Pressable>
          );
        })}
      </View>
    </CenterDialog>
  );
}

// ---------- Account ----------
export function Account() {
  useLightStatusBar();
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const onScroll = useTabScroll();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const { lang, setLang } = usePrefs();
  const mode = useTheme((s) => s.mode);
  const setMode = useTheme((s) => s.setMode);
  const subsOn = useFeature('subscriptions');
  const hindiOn = useFeature('hindi');
  const dualRole = useFeature('dualRole');
  const workerReg = useFeature('workerRegistration');
  const complaintsOn = useFeature('complaints');
  const support = useSupport();
  const sub = useMySubscription(subsOn);
  const updateMe = useUpdateMe();
  const delReq = useDeleteRequest();
  const [confirm, setConfirm] = useState(null);
  const [typed, setTyped] = useState('');
  const [picker, setPicker] = useState(null);
  const [heroH, setHeroH] = useState(0);
  if (!user) return null;

  const isWorker = user.activeRole === 'worker';
  const other = isWorker ? 'customer' : 'worker';
  const hasOther = user.roles.includes(other);
  const switchRow =
    hasOther || (isWorker && dualRole)
      ? {
          label: isWorker ? t('switchToCustomer') : t('switchToWorker'),
          run: () => updateMe.mutate({ activeRole: other }, { onSuccess: () => { toast(isWorker ? t('nowCustomer') : t('nowWorker')); router.navigate('/'); }, onError: (e) => toastError(e) }),
        }
      : !isWorker && workerReg && dualRole
        ? { label: t('becomeWorker'), run: () => router.push('/onboarding') }
        : null;

  const changeLang = (next) => {
    setPicker(null);
    if (next === lang) return;
    setLang(next);
    updateMe.mutate({ language: next }, { onError: () => undefined }); // device choice already applied; server copy is best-effort
  };
  const changeTheme = (next) => {
    setPicker(null);
    if (next !== mode) setTimeout(() => setMode(next), 200); // let the dialog close first
  };
  const changePhoto = () => router.push('/profile/edit');

  const doLogout = () => {
    void unregisterPush();
    logout();
    queryClient.clear();
    router.replace('/login');
  };
  const doDelete = () =>
    delReq.mutate(undefined, {
      onSuccess: () => { toast(t('deletionRequested'), 'info'); doLogout(); },
      onError: (e) => toastError(e),
    });
  const closeConfirm = () => { setConfirm(null); setTyped(''); };

  const memberSince = new Date(user.createdAt).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { month: 'short', year: 'numeric' });
  const subStatus = sub.data?.status;

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <ScrollView refreshControl={<PullRefresh progressViewOffset={insets.top} />} onScroll={onScroll} scrollEventThrottle={32} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + insets.bottom }}>
        <ProfileHero title={t('account')} sub={`+91 ${user.mobile}`} onLayout={(e) => setHeroH(e.nativeEvent.layout.height)} />

        <View style={{ zIndex: 10, marginTop: -42, flexDirection: 'row', alignItems: 'flex-start', gap: 16, paddingHorizontal: 20 }}>
          <Pressable onPress={changePhoto} accessibilityLabel={t('changePhoto')}>
            <View style={[st.avatarRing, { backgroundColor: c.surface }]}><Avatar src={user.avatar} name={user.name} size={88} /></View>
            <View style={[st.editBtn, { backgroundColor: c.primary, borderColor: c.surface }]}><Pencil size={14} strokeWidth={2.5} color="#fff" /></View>
          </Pressable>
          <View style={{ flex: 1, minWidth: 0, paddingTop: 46 }}>
            <Txt w={800} size={21} numberOfLines={1}>{user.name}</Txt>
            {user.email ? <Txt size={13} c="ink3" numberOfLines={1} style={{ marginTop: 2 }}>{user.email}</Txt> : null}
          </View>
        </View>

        <View style={[st.infoCard, { backgroundColor: c.surface, borderColor: c.line }]}>
          <View style={st.infoCell}>
            <View style={[st.icon32, { backgroundColor: c.surface2 }]}>{isWorker ? <Briefcase size={15} color={c.ink2} /> : <UserRound size={15} color={c.ink2} />}</View>
            <View style={{ alignItems: 'center', minWidth: 0 }}><Txt size={10} c="ink3">{t('mode')}</Txt><Txt w={700} size={12} numberOfLines={1}>{isWorker ? t('roleWorkerShort') : t('roleCustomerShort')}</Txt></View>
          </View>
          <View style={[st.infoCell, { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: c.line }]}>
            <View style={[st.icon32, { backgroundColor: c.surface2 }]}><CalendarDays size={15} color={c.ink2} /></View>
            <View style={{ alignItems: 'center', minWidth: 0 }}><Txt size={10} c="ink3">{t('memberSince')}</Txt><Txt w={700} size={12} numberOfLines={1}>{memberSince}</Txt></View>
          </View>
          {subsOn && (
            <Pressable onPress={() => router.push('/subscription')} style={[st.infoCell, { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: c.line }]}>
              <View style={[st.icon32, { backgroundColor: c.surface2 }]}><Crown size={15} color={c.ink2} /></View>
              <View style={{ alignItems: 'center', minWidth: 0 }}>
                <Txt size={10} c="ink3">{t('subscription')}</Txt>
                {sub.isLoading ? <Skeleton style={{ height: 14, width: 48 }} /> : <Txt w={700} size={12} numberOfLines={1} c={subStatus === 'active' ? 'success' : 'ink'}>{subLabel(sub.data, t)}</Txt>}
              </View>
            </Pressable>
          )}
        </View>

        <Group title={t('accountGroup')}>
          <Row icon={UserPen} label={t('editProfile')} onPress={() => router.push('/profile/edit')} />
          {isWorker && <Row icon={IdCard} label={t('myProfile')} value={t('workerProfile')} onPress={() => router.navigate('/my-profile')} />}
          {switchRow && <Row icon={Repeat} label={switchRow.label} onPress={switchRow.run} disabled={updateMe.isPending} />}
          {hindiOn && <Row icon={Globe} label={t('language')} value={lang === 'en' ? 'English' : 'हिंदी'} onPress={() => setPicker('lang')} />}
          <Row icon={MoonStar} label={t('appearance')} value={mode === 'dark' ? t('dark') : t('light')} onPress={() => setPicker('theme')} />
          <Row icon={Bell} label={t('notificationSettings')} onPress={() => router.push('/settings/notifications')} />
          <Row icon={UserX} label={t('blockedUsers')} onPress={() => router.push('/blocked')} />
        </Group>

        {subsOn && (
          <Group title={t('subscription')}>
            <Row icon={Crown} label={t('mySubscription')} onPress={() => router.push('/subscription')}
              value={sub.data?.status === 'active' && sub.data.endAt ? `${t('validTill')} ${date(sub.data.endAt)}` : subLabel(sub.data, t)} />
          </Group>
        )}

        <Group title={t('support')}>
          <Row icon={HelpCircle} label={complaintsOn ? t('helpComplaints') : t('helpFaqs')} onPress={() => router.push('/help')} />
          {support.email ? <Row icon={Mail} label={t('emailSupport')} value={support.email} onPress={() => Linking.openURL(`mailto:${support.email}`)} /> : null}
          {support.phone ? <Row icon={Phone} label={t('callSupport')} value={support.phone} onPress={() => Linking.openURL(`tel:${support.phone.replace(/\s/g, '')}`)} /> : null}
        </Group>

        <Group title={t('legal')}>
          <Row icon={FileText} label={t('termsOfUse')} onPress={() => router.push(isWorker ? '/legal/terms-worker' : '/legal/terms')} />
          <Row icon={Shield} label={t('privacyPolicy')} onPress={() => router.push('/legal/privacy')} />
          <Row icon={CreditCard} label={t('refundPolicy')} onPress={() => router.push('/legal/refund')} />
          <Row icon={ShieldCheck} label={t('safetyGuidelines')} onPress={() => router.push(isWorker ? '/legal/safety-worker' : '/legal/safety')} />
        </Group>

        <View style={{ paddingHorizontal: 20, paddingTop: 28, gap: 10 }}>
          <Button size="lg" block icon={LogOut} style={{ borderRadius: 16 }} onPress={() => setConfirm('logout')}>{t('logout')}</Button>
          <Button variant="ghost" block icon={Trash2} onPress={() => setConfirm('delete')}>{t('deleteAccount')}</Button>
        </View>
        <Txt size={12} c="ink3" style={{ paddingTop: 8, paddingBottom: 8, textAlign: 'center' }}>Work Near v{support.version}</Txt>
      </ScrollView>
      <HeaderScrim height={heroH}><HeroBg /></HeaderScrim>

      <OptionSheet open={picker === 'lang'} onClose={() => setPicker(null)} title={t('language')} value={lang} onPick={changeLang}
        options={[{ value: 'en', label: 'English', sub: 'English', icon: Globe }, { value: 'hi', label: 'हिंदी', sub: 'Hindi', icon: Globe }]} />
      <OptionSheet open={picker === 'theme'} onClose={() => setPicker(null)} title={t('appearance')} value={mode} onPick={changeTheme}
        options={[{ value: 'light', label: t('light'), sub: t('lightSub'), icon: Sun }, { value: 'dark', label: t('dark'), sub: t('darkSub'), icon: Moon }]} />

      <ConfirmDialog open={confirm === 'logout'} onClose={closeConfirm} icon={Power} title={`${t('logout')}?`} message={t('logoutConfirm')}
        cancelLabel={t('cancel')} confirmLabel={t('logout')} confirmIcon={LogOut} onConfirm={doLogout} />
      <ConfirmDialog open={confirm === 'delete'} onClose={closeConfirm} icon={Trash2} title={`${t('deleteAccount')}?`} message={t('deleteExplain')}
        cancelLabel={t('cancel')} confirmLabel={t('requestDeletion')} disabled={typed.trim() !== 'DELETE'} loading={delReq.isPending} onConfirm={doDelete}>
        <Input label={t('typeDelete')} value={typed} autoCapitalize="characters" autoComplete="off" autoCorrect={false} onChangeText={setTyped} placeholder="DELETE" />
      </ConfirmDialog>
    </View>
  );
}

// ---------- Edit profile ----------
export function EditProfile() {
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const user = useAuth((s) => s.user);
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const m = useUpdateMe();
  const avatar = useUploadAvatar();
  const { pick, cropper } = useAvatarPicker();
  const [photo, setPhoto] = useState(null); // cropped, not uploaded yet
  const errs = fieldErrors(m.error);
  const emailOk = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const nameErr = nameError(name);
  const fieldsDirty = cleanName(name) !== (user?.name ?? '') || email.trim() !== (user?.email ?? '');
  const dirty = fieldsDirty || !!photo;
  const done = () => { toast(t('profileUpdated')); if (router.canGoBack()) router.back(); else router.replace('/account'); };
  const save = async () => {
    if (photo) {
      try { await avatar.mutateAsync(photo); } catch (e) { return toastError(e); }
      setPhoto(null);
    }
    if (!fieldsDirty) return done();
    m.mutate({ name: cleanName(name), email: email.trim() }, {
      onSuccess: done,
      onError: (e) => { if (!Object.keys(fieldErrors(e)).length) toastError(e); },
    });
  };
  const changePhoto = async () => {
    const f = await pick();
    if (f) setPhoto(f);
  };
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.surface }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopBar title={t('editProfile')} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16, padding: 16, paddingBottom: 16 + insets.bottom }}>
        <View style={{ alignItems: 'center', gap: 4, paddingVertical: 8 }}>
          <Pressable onPress={changePhoto} accessibilityLabel={t('changePhoto')}>
            <View style={{ opacity: avatar.isPending ? 0.5 : 1 }}><Avatar src={photo?.uri ?? user?.avatar} name={name || 'U'} size={88} /></View>
            <View style={[st.cam, { width: 32, height: 32, borderRadius: 16, right: 0, bottom: 0, backgroundColor: c.primary, borderColor: c.surface }]}><Camera size={15} color={c.onPrimary} /></View>
          </Pressable>
          <Txt size={12} c="ink3">{t('photoHint')}</Txt>
        </View>
        <Input label={t('yourName')} value={name} maxLength={80} autoComplete="name" onChangeText={setName} error={errs.name ?? (nameErr ? t(nameErr) : undefined)} />
        <Input label={t('mobile')} value={`+91 ${user?.mobile ?? ''}`} disabled hint={t('mobileFixed')} />
        <Input label={`${t('email')} (${t('optional')})`} keyboardType="email-address" autoCapitalize="none" autoComplete="email" maxLength={120} value={email}
          onChangeText={setEmail} error={errs.email ?? (!emailOk ? t('invalidEmail') : undefined)} />
        {user?.roles.includes('worker') && (
          <Txt size={12} c="ink2" style={{ borderRadius: 12, backgroundColor: c.surface2, padding: 12, overflow: 'hidden' }}>
            {t('workerNameNote')} <Txt w={600} size={12} c="primary" onPress={() => router.push('/onboarding')}>{t('editWorkerProfile')}</Txt>
          </Txt>
        )}
        <Button block size="lg" disabled={!dirty || !emailOk || !!nameErr} loading={m.isPending || avatar.isPending} onPress={save}>{t('save')}</Button>
      </ScrollView>
      {cropper}
    </KeyboardAvoidingView>
  );
}

// ---------- Notification settings ----------
/** Device-level push permission. */
function PushRow() {
  const t = useT();
  const c = useColors();
  const [state, setState] = useState('default');
  const enable = useEnablePush();
  useEffect(() => {
    const read = () => pushState().then(setState);
    read();
    // permission may be changed in phone settings while the app is in the background
    const sub = AppState.addEventListener('change', (s) => s === 'active' && read());
    return () => sub.remove();
  }, []);
  const turnOn = () =>
    enable.mutate(true, {
      onSuccess: async (token) => {
        setState(await pushState());
        toast(token ? t('pushEnabled') : t('pushNotGranted'), token ? 'success' : 'error');
      },
      onError: () => toast(t('pushFailed'), 'error'),
    });
  const sub = { granted: 'pushOnDevice', default: 'pushDefault', denied: 'pushDenied', unsupported: 'pushUnsupported' };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line, backgroundColor: alpha(c.primarySoft, 0.4), paddingHorizontal: 16, paddingVertical: 16 }}>
      <View style={[st.icon40, { backgroundColor: c.primarySoft }]}><BellRing size={20} color={c.primary} /></View>
      <View style={{ flex: 1, minWidth: 0 }}><Txt w={700}>{t('pushNotifications')}</Txt><Txt size={14} c="ink2">{t(sub[state])}</Txt></View>
      {state === 'granted' ? <Badge tone="success">{t('on')}</Badge>
        : state === 'default' ? <Button size="sm" loading={enable.isPending} onPress={turnOn}>{t('enable')}</Button>
          : state === 'denied' ? <Button size="sm" variant="outline" onPress={() => Linking.openSettings()}>{t('enable')}</Button> : null}
    </View>
  );
}

export function NotificationSettings() {
  const t = useT();
  const c = useColors();
  const user = useAuth((s) => s.user);
  const updateUser = useAuth((s) => s.updateUser);
  const pushOn = useFeature('pushNotifications');
  const subsOn = useFeature('subscriptions');
  const m = useUpdateMe();
  const notif = user?.notif ?? { chat: true, subscription: true, offers: false };
  const rows = [['chat', 'nChat', 'nChatSub'], ...(subsOn ? [['subscription', 'subscription', 'nSubSub']] : []), ['offers', 'nOffers', 'nOffersSub']];
  const change = (k, v) => {
    const prev = notif;
    updateUser({ notif: { ...notif, [k]: v } }); // optimistic; server response replaces it
    m.mutate({ notif: { [k]: v } }, { onError: (e) => { updateUser({ notif: prev }); toastError(e); } });
  };
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <TopBar title={t('notificationSettings')} />
      <ScrollView refreshControl={<PullRefresh />}>
        {pushOn && <PushRow />}
        <Divided>
          {rows.map(([k, a, b]) => (
            <View key={k} style={st.toggleRow}>
              <View style={{ flex: 1 }}><Txt w={700}>{t(a)}</Txt><Txt size={14} c="ink2">{t(b)}</Txt></View>
              <Toggle label={t(a)} checked={notif[k]} onChange={(v) => change(k, v)} />
            </View>
          ))}
          <View style={st.toggleRow}>
            <View style={{ flex: 1 }}><Txt w={700}>{t('nSecurity')}</Txt><Txt size={14} c="ink2">{t('nSecuritySub')}</Txt></View>
            <Toggle label={t('nSecurity')} checked disabled onChange={() => undefined} />
          </View>
        </Divided>
      </ScrollView>
    </View>
  );
}

// ---------- Blocked users ----------
export function BlockedUsers() {
  const t = useT();
  const c = useColors();
  const { data, isLoading, isError, error, refetch } = useBlocked();
  const unblock = useUnblockUser();
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <TopBar title={t('blockedUsers')} />
      <FlatList refreshControl={<PullRefresh />}
        data={data ?? []}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={
          <>
            {isLoading && <View style={{ gap: 8, padding: 16 }}><Skeleton style={{ height: 64 }} /><Skeleton style={{ height: 64 }} /></View>}
            {isError && <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />}
            {data?.length === 0 && <EmptyState icon={UserX} title={t('noBlocked')} sub={t('noBlockedSub')} />}
          </>
        }
        renderItem={({ item: p }) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line, paddingHorizontal: 16, paddingVertical: 12 }}>
            <Avatar src={p.photo} name={p.name} />
            <View style={{ flex: 1, minWidth: 0 }}><Txt w={700} numberOfLines={1}>{p.name}</Txt><Txt size={14} c="ink2">{p.subtitle}</Txt></View>
            <Button size="sm" variant="outline" loading={unblock.isPending && unblock.variables === p.id} onPress={() => unblock.mutate(p.id, { onSuccess: () => toast(`${p.name} ${t('unblockedToast')}`) })}>{t('unblock')}</Button>
          </View>
        )}
      />
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingLeft: 20, paddingRight: 18 },
  rowBody: { flex: 1, minWidth: 0, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  icon44: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  icon32: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarRing: { width: 96, height: 96, borderRadius: 48, padding: 4, elevation: 8, shadowColor: '#0b5a2a', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 10 } },
  editBtn: { position: 'absolute', bottom: 4, right: 0, width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  infoCard: { flexDirection: 'row', marginHorizontal: 16, marginTop: 20, borderRadius: 22, borderWidth: 1, padding: 6, elevation: 6, shadowColor: '#0b5a2a', shadowOpacity: 0.1, shadowRadius: 15, shadowOffset: { width: 0, height: 8 } },
  infoCell: { flex: 1, alignItems: 'center', gap: 6, minWidth: 0, paddingHorizontal: 4, paddingVertical: 12 },
  icon40: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cam: { position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  cell: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
});
