// Native port of Frontend/src/features/auth.tsx — Welcome, Login, Otp, RoleSetup.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, ArrowRight, BadgeIndianRupee, Briefcase, Check, CheckCircle2, Languages, MapPinned, MessagesSquare, Phone, Search as SearchIcon, ShieldCheck,
  UserRound,
} from 'lucide-react-native';
import { Button, Input, Txt } from '@/components/ui';
import { errorMessage, fieldErrors, isApiError, qk, setUser, useRequestOtp, useUpdateMe, useVerifyOtp } from '@/api';
import { useAuth, useFeature, usePrefs, useSettings, toast } from '@/store';
import { useT } from '@/i18n';
import { useLightStatusBar } from '@/hooks/useStatusBar';
import { cleanName, nameError } from '@/lib/validate';
import { http, queryClient } from '@/lib/http';
import { APP } from '@/config/env';
import { alpha, fonts, useColors } from '@/theme';

function LangSwitch({ style, color }) {
  const { lang, setLang } = usePrefs();
  const hindi = useFeature('hindi');
  if (!hindi) return null;
  return (
    <Pressable onPress={() => setLang(lang === 'en' ? 'hi' : 'en')} style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }, style]}>
      <Languages size={16} color={color} />
      <Txt w={600} size={14} c={color}>{lang === 'en' ? 'हिंदी' : 'English'}</Txt>
    </Pressable>
  );
}

export function Welcome() {
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const setOnboarded = usePrefs((s) => s.setOnboarded);
  const token = useAuth((s) => s.token);
  const radius = useSettings((s) => s.settings?.defaultRadiusKm) ?? APP.defaultRadiusKm;
  const [i, setI] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  if (token) return <Redirect href="/" />;
  const slides = [
    { icon: MapPinned, title: t('slide1Title').replace('{km}', String(radius)), sub: t('slide1Sub') },
    { icon: MessagesSquare, title: t('slide2Title'), sub: t('slide2Sub') },
    { icon: BadgeIndianRupee, title: t('zeroCommission'), sub: t('slide3Sub') },
  ];
  const done = () => { setOnboarded(); router.replace('/login'); };
  const next = () => {
    if (i >= slides.length - 1) return done();
    fade.setValue(0);
    setI(i + 1);
    Animated.timing(fade, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };
  const S = slides[i];
  return (
    <View style={{ flex: 1, backgroundColor: c.surface, paddingHorizontal: 24, paddingTop: insets.top, paddingBottom: 16 + insets.bottom }}>
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <LangSwitch color={c.ink} style={{ borderWidth: 1, borderColor: c.line }} />
        <Pressable onPress={done} style={{ marginLeft: 'auto' }}><Txt w={600} size={14} c="ink2">{t('skip')}</Txt></Pressable>
      </View>
      <Animated.View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', opacity: fade }}>
        <View style={{ width: 224, height: 224, marginBottom: 40, alignItems: 'center', justifyContent: 'center' }}>
          <View style={[StyleSheet.absoluteFill, { borderRadius: 112, backgroundColor: c.primarySoft }]} />
          <View style={{ position: 'absolute', top: 32, left: 32, right: 32, bottom: 32, borderRadius: 80, backgroundColor: alpha(c.primary, 0.15) }} />
          <View style={{ width: 96, height: 96, borderRadius: 24, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', elevation: 12, shadowColor: c.primary }}>
            <S.icon size={48} color={c.onPrimary} />
          </View>
        </View>
        <Txt w={800} size={28} style={{ textAlign: 'center', lineHeight: 34 }}>{S.title}</Txt>
        <Txt c="ink2" size={16} style={{ marginTop: 12, maxWidth: 320, textAlign: 'center', lineHeight: 24 }}>{S.sub}</Txt>
      </Animated.View>
      <View style={{ marginBottom: 24, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
        {slides.map((_, k) => <View key={k} style={{ height: 8, width: k === i ? 24 : 8, borderRadius: 4, backgroundColor: k === i ? c.primary : c.line }} />)}
      </View>
      <Button size="lg" block onPress={next}>{i < slides.length - 1 ? t('next') : t('getStarted')}</Button>
    </View>
  );
}

const LOGO_BADGE = require('../../assets/splash-icon.png');

/** Soft "location ping" rings behind the hero logo — replaces the old floating tool icons. */
function PingRings() {
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = (v, delay) => Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration: 2400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    const all = Animated.parallel([loop(a, 0), loop(b, 1200)]);
    all.start();
    return () => all.stop();
  }, [a, b]);
  const ring = (v) => ({
    opacity: v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.4, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.85, 2] }) }],
  });
  return (
    <>
      <Animated.View pointerEvents="none" style={[st.ping, ring(a)]} />
      <Animated.View pointerEvents="none" style={[st.ping, ring(b)]} />
    </>
  );
}

/** Shared brand header for Login, OTP & Role: green gradient hero with the logo badge. */
function AuthHero({ title, sub, onBack, compact }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const logo = compact ? 64 : 92;
  return (
    <LinearGradient colors={['#22c55e', c.primary, '#0b5a2a']} locations={[0, 0.55, 1]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
      style={{ overflow: 'hidden', paddingHorizontal: 24, paddingTop: insets.top, paddingBottom: compact ? 52 : 60 }}>
      <View style={[st.blob, { top: -90, right: -70, width: 260, height: 260 }]} />
      <View style={[st.blob, { bottom: -110, left: -50, width: 230, height: 230 }]} />
      <View style={[st.blob, { top: 70, left: -30, width: 70, height: 70, opacity: 0.6 }]} />
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {onBack ? (
          <Pressable accessibilityLabel="Back" onPress={onBack} hitSlop={6}
            style={({ pressed }) => [st.backBtn, pressed && { transform: [{ scale: 0.92 }], backgroundColor: 'rgba(255,255,255,0.3)' }]}>
            <ArrowLeft size={20} strokeWidth={2.5} color="#fff" />
          </Pressable>
        ) : <View />}
        <LangSwitch color="#ffffff" style={{ backgroundColor: 'rgba(255,255,255,0.18)', paddingVertical: 6 }} />
      </View>
      <View style={{ alignItems: 'center', paddingTop: compact ? 4 : 16, paddingBottom: 8 }}>
        <View style={{ width: logo, height: logo, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
          {!compact && <PingRings />}
          <Image source={LOGO_BADGE} style={{ width: logo * 1.07, height: logo * 1.07 }} contentFit="contain" />
        </View>
        <Txt w={800} size={compact ? 24 : 30} c="#ffffff" style={{ textAlign: 'center', letterSpacing: -0.3 }}>{title}</Txt>
        {sub ? <Txt size={15} c="rgba(255,255,255,0.88)" style={{ marginTop: 6, maxWidth: 320, textAlign: 'center', lineHeight: 21 }}>{sub}</Txt> : null}
      </View>
    </LinearGradient>
  );
}

/** White sheet that overlaps the hero with a rounded top. */
function Sheet({ children }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, marginTop: -32, borderTopLeftRadius: 32, borderTopRightRadius: 32, backgroundColor: c.surface, paddingHorizontal: 24, paddingTop: 30, paddingBottom: 16 + insets.bottom }}>
      {children}
    </View>
  );
}

// The terms checkbox on login is switched off for now — the old Checkbox component + `agree` state can come back from git history.

export function Login() {
  useLightStatusBar();
  const t = useT();
  const c = useColors();
  const { from } = useLocalSearchParams();
  const token = useAuth((s) => s.token);
  const named = useAuth((s) => !!s.user?.name);
  const radius = useSettings((s) => s.settings?.defaultRadiusKm) ?? APP.defaultRadiusKm;
  const [mobile, setMobile] = useState('');
  const [focus, setFocus] = useState(false); // no autoFocus: it popped the number pad over the splash
  const m = useRequestOtp();
  if (token && named) return <Redirect href="/" />;
  const valid = /^[6-9]\d{9}$/.test(mobile);
  const submit = () =>
    valid && !m.isPending && m.mutate(mobile, { onSuccess: (r) => router.push({ pathname: '/otp', params: { mobile, resendAfter: String(r.resendAfter), expiresIn: String(r.expiresIn), ...(from && { from }) } }) });
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.surface }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
        <AuthHero title={APP.name} sub={t('tagline')} />
        <Sheet>
          <Txt w={800} size={22}>{t('loginSignup')}</Txt>
          <Txt size={14} c="ink2" style={{ marginTop: 4, marginBottom: 22 }}>{t('otpSentInfo')}</Txt>
          <View style={[st.mobileBox, { borderColor: m.isError ? c.danger : focus ? c.primary : c.line, backgroundColor: focus ? c.surface : c.surface2 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRightWidth: 1, borderRightColor: c.line, paddingRight: 12 }}>
              <Phone size={16} color={c.primary} />
              <Txt w={700}>+91</Txt>
            </View>
            <TextInput
              inputMode="numeric" keyboardType="number-pad" autoComplete="tel-national" maxLength={10} value={mobile} placeholder={t('enterMobile')} accessibilityLabel={t('enterMobile')}
              placeholderTextColor={c.ink3} selectionColor={c.primary} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} onSubmitEditing={submit}
              onChangeText={(v) => { setMobile(v.replace(/\D/g, '')); if (m.isError) m.reset(); }}
              style={{ flex: 1, height: '100%', color: c.ink, fontFamily: mobile ? fonts[700] : fonts[400], fontSize: mobile ? 18 : 16, letterSpacing: mobile ? 2 : 0, padding: 0 }}
            />
            {valid && <CheckCircle2 size={22} color={c.success} />}
          </View>
          {mobile.length === 10 && !valid && <Txt size={14} c="danger" style={{ marginTop: 8 }}>{t('invalidMobile')}</Txt>}
          {m.error && <Txt size={14} c="danger" style={{ marginTop: 8 }}>{fieldErrors(m.error).mobile ?? errorMessage(m.error)}</Txt>}
          <Button size="lg" block style={[st.cta, { marginTop: 20 }]} disabled={!valid} loading={m.isPending} onPress={submit}>
            {t('sendOtp')}<ArrowRight size={20} color={c.onPrimary} />
          </Button>

          <View style={{ marginTop: 24, flexDirection: 'row', gap: 10 }}>
            {[[ShieldCheck, t('verifiedWorkers')], [BadgeIndianRupee, t('zeroCommission')], [MapPinned, `${t('within')} ${radius} KM`]].map(([Icon, label]) => (
              <View key={label} style={{ flex: 1, alignItems: 'center', gap: 8, borderRadius: 18, borderWidth: 1, borderColor: alpha(c.primary, 0.12), backgroundColor: alpha(c.primary, 0.05), paddingHorizontal: 6, paddingVertical: 14 }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: alpha(c.primary, 0.12), alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={19} color={c.primary} />
                </View>
                <Txt w={600} size={11} c="ink2" style={{ textAlign: 'center', lineHeight: 14 }}>{label}</Txt>
              </View>
            ))}
          </View>

          <View style={{ flex: 1, minHeight: 24 }} />
          <Txt size={12} c="ink3" style={{ textAlign: 'center' }}>{t('byContinuing')}</Txt>
          <View style={st.links}>
            {[['terms', 'termsShort'], ['privacy', 'privacyShort'], ['support', 'supportShort']].map(([slug, key], i) => (
              <View key={slug} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {i > 0 && <View style={[st.linkDot, { backgroundColor: c.ink3 }]} />}
                <Pressable hitSlop={8} onPress={() => router.push(`/legal/${slug}`)}><Txt w={700} size={12} c="ink2" style={st.linkText}>{t(key)}</Txt></Pressable>
              </View>
            ))}
          </View>
        </Sheet>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function Caret() {
  const c = useColors();
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 0.2, duration: 500, useNativeDriver: true }), Animated.timing(v, { toValue: 1, duration: 500, useNativeDriver: true })]));
    a.start();
    return () => a.stop();
  }, [v]);
  return <Animated.View style={{ width: 2, height: 24, backgroundColor: c.primary, opacity: v }} />;
}

export function Otp() {
  useLightStatusBar();
  const t = useT();
  const c = useColors();
  const st0 = useLocalSearchParams();
  const mobile = st0.mobile;
  const [otp, setOtp] = useState('');
  const [left, setLeft] = useState(Number(st0.resendAfter ?? 30));
  const [expAt, setExpAt] = useState(() => Date.now() + Number(st0.expiresIn ?? 300) * 1000);
  const [now, setNow] = useState(Date.now);
  const [error, setError] = useState(null);
  const ref = useRef(null);
  const shake = useRef(new Animated.Value(0)).current;
  const verify = useVerifyOtp();
  const resend = useRequestOtp();
  const setSession = useAuth((s) => s.setSession);
  const lang = usePrefs((s) => s.lang);
  useEffect(() => {
    const id = setInterval(() => { setLeft((s) => Math.max(0, s - 1)); setNow(Date.now()); }, 1000);
    return () => clearInterval(id);
  }, []);
  const expired = now >= expAt;

  // Back to the first box with the keyboard up (the hidden input can lose focus while the request runs).
  const refocus = () => setTimeout(() => { ref.current?.blur(); ref.current?.focus(); }, 80);

  const onLoggedIn = (session) => {
    const { user } = session;
    queryClient.clear(); // never show a previous account's cached data
    setSession(session);
    queryClient.setQueryData(qk.me, user);
    // The language picked on this device wins; keep the server copy in sync for SMS/push texts.
    if (user.name && user.language !== lang) void http.patch('/me', { language: lang }).then(setUser).catch(() => undefined);
    // Drop login + otp from the stack first: a still-mounted login screen redirects on every re-render (keyboard
    // open/close) and remounted the role screen, which closed the keyboard on the name field.
    if (router.canDismiss()) router.dismissAll();
    if (!user.name) return router.replace('/role');
    toast(`${t('welcomeBack')}, ${user.name.split(' ')[0]}`);
    router.replace(st0.from && st0.from !== '/login' ? st0.from : '/');
  };

  const run = (code) => {
    if (!mobile || verify.isPending) return;
    setError(null);
    verify.mutate(
      { mobile, otp: code, acceptTerms: true },
      {
        onSuccess: onLoggedIn,
        onError: (e) => {
          setOtp('');
          Animated.sequence([10, -10, 7, -7, 0].map((x) => Animated.timing(shake, { toValue: x, duration: 55, useNativeDriver: true }))).start();
          refocus();
          if (isApiError(e, 'OTP_EXPIRED') || isApiError(e, 'RATE_LIMITED')) {
            setExpAt(Date.now());
            setError({ text: errorMessage(e), needsNew: true });
          } else if (isApiError(e, 'CONSENT_REQUIRED')) {
            toast(errorMessage(e), 'error');
            router.replace('/login');
          } else setError({ text: fieldErrors(e).otp ?? errorMessage(e) });
        },
      },
    );
  };

  const doResend = () =>
    mobile &&
    resend.mutate(mobile, {
      onSuccess: (r) => {
        setLeft(r.resendAfter);
        setExpAt(Date.now() + r.expiresIn * 1000);
        setOtp('');
        setError(null);
        refocus();
        toast(t('otpResent'));
      },
      onError: (e) => toast(errorMessage(e), 'error'),
    });

  if (!mobile) return <Redirect href="/login" />;
  const blocked = expired || !!error?.needsNew;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.surface }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
        <AuthHero compact onBack={() => (router.canGoBack() ? router.back() : router.replace('/login'))} title={t('enterOtp')} sub={`${t('otpSentTo')} +91 ${mobile.slice(0, 5)} ${mobile.slice(5)}`} />
        <Sheet>
          <Pressable onPress={() => ref.current?.focus()}>
            <TextInput
              ref={ref} autoFocus inputMode="numeric" keyboardType="number-pad" autoComplete="sms-otp" textContentType="oneTimeCode" maxLength={6} value={otp} accessibilityLabel="OTP" editable={!blocked}
              onChangeText={(x) => { const v = x.replace(/\D/g, '').slice(0, 6); setOtp(v); if (error) setError(null); if (v.length === 6) run(v); }}
              caretHidden style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
            />
            <Animated.View style={{ flexDirection: 'row', gap: 8, opacity: blocked ? 0.5 : 1, transform: [{ translateX: shake }] }}>
              {Array.from({ length: 6 }, (_, i) => {
                const filled = otp[i];
                const cur = i === otp.length;
                return (
                  <View key={i} style={{
                    flex: 1, aspectRatio: 4 / 5, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center',
                    borderColor: error ? c.danger : filled || cur ? c.primary : c.line,
                    backgroundColor: error ? c.dangerSoft : filled ? c.primarySoft : cur ? c.surface : c.surface2,
                  }}>
                    {filled ? <Txt w={800} size={24} c="primary">{filled}</Txt> : cur && !blocked && !verify.isPending ? <Caret /> : null}
                  </View>
                );
              })}
            </Animated.View>
          </Pressable>
          {error ? (
            <Txt size={14} c="danger" style={{ marginTop: 12, textAlign: 'center' }}>{error.text}</Txt>
          ) : expired ? (
            <Txt size={14} c="danger" style={{ marginTop: 12, textAlign: 'center' }}>{t('otpExpired')}</Txt>
          ) : (
            <Txt size={12} c="ink3" style={{ marginTop: 12, textAlign: 'center' }}>{t('codeExpiresIn')} {mmss(Math.ceil((expAt - now) / 1000))}</Txt>
          )}
          {__DEV__ && <Txt size={12} c="ink3" style={{ marginTop: 4, textAlign: 'center' }}>Dev: OTP 123456</Txt>}
          <View style={{ marginTop: 24, alignItems: 'center' }}>
            {left > 0 ? (
              <Txt size={14} c="ink2">{t('resendIn')} <Txt w={700} size={14}>{mmss(left)}</Txt></Txt>
            ) : (
              <Pressable disabled={resend.isPending} onPress={doResend}><Txt w={700} size={14} c="primary" style={{ opacity: resend.isPending ? 0.5 : 1 }}>{resend.isPending ? '…' : t('resend')}</Txt></Pressable>
            )}
          </View>
          <View style={{ flex: 1, minHeight: 24 }} />
          <Button size="lg" block style={[st.cta, { marginBottom: 12 }]} textSize={16} loading={verify.isPending} disabled={otp.length !== 6 || blocked} onPress={() => run(otp)}>{t('verifyOtp')}</Button>
          <Pressable onPress={() => router.replace('/login')} style={{ alignItems: 'center', paddingVertical: 4 }}><Txt w={600} size={14} c="ink2">{t('changeNumber')}</Txt></Pressable>
        </Sheet>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function RoleSetup() {
  useLightStatusBar();
  const t = useT();
  const c = useColors();
  const user = useAuth((s) => s.user);
  const lang = usePrefs((s) => s.lang);
  const workerReg = useFeature('workerRegistration');
  const [role, setRole] = useState('customer');
  const [name, setName] = useState(user?.name ?? '');
  const m = useUpdateMe();
  const submitted = useRef(false); // after saving, the name is set — don't let the guard below race our own navigation

  // Back (arrow or hardware) drops the half-done sign-up and starts again on the login screen — never the OTP screen.
  const toLogin = useCallback(() => {
    useAuth.getState().logout();
    queryClient.clear();
    if (router.canDismiss()) router.dismissAll();
    router.replace('/login');
    return true;
  }, []);
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', toLogin);
    return () => sub.remove();
  }, [toLogin]));

  if (!user) return <Redirect href="/login" />;
  if (user.name && !submitted.current) return <Redirect href="/" />;
  const opts = [
    { r: 'customer', icon: SearchIcon, title: t('roleCustomer'), sub: t('roleCustomerSub') },
    ...(workerReg ? [{ r: 'worker', icon: Briefcase, title: t('roleWorker'), sub: t('roleWorkerSub') }] : []),
  ];
  const chosen = workerReg ? role : 'customer';
  const errs = fieldErrors(m.error);
  const nameErr = nameError(name);
  const save = () => {
    if (nameErr) return;
    submitted.current = true;
    m.mutate(
      { name: cleanName(name), activeRole: chosen, language: lang },
      { onSuccess: () => router.replace(chosen === 'worker' ? '/onboarding' : '/'), onError: () => (submitted.current = false) },
    );
  };
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.surface }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
        <AuthHero compact onBack={toLogin} title={t('chooseRole')} sub={t('roleLater')} />
        <Sheet>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 12 }}>
            {opts.map(({ r, icon: I, title, sub }) => {
              const on = chosen === r;
              return (
                <Pressable key={r} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setRole(r)}
                  style={({ pressed }) => [st.roleCard, {
                    borderColor: on ? c.primary : c.line, backgroundColor: on ? c.primarySoft : c.surface,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  }, on && { shadowColor: c.primary, shadowOpacity: 0.2, shadowRadius: 10, elevation: 4 }]}>
                  <View style={[st.roleCheck, { borderColor: on ? c.primary : c.line, backgroundColor: on ? c.primary : 'transparent' }]}>
                    {on && <Check size={12} strokeWidth={3.5} color="#fff" />}
                  </View>
                  <LinearGradient colors={on ? ['#22c55e', c.primary] : [c.surface2, c.surface3]} style={st.roleIcon}>
                    <I size={28} color={on ? '#ffffff' : c.ink2} />
                  </LinearGradient>
                  <Txt w={800} size={15} style={{ textAlign: 'center', marginTop: 12 }}>{title}</Txt>
                  <Txt size={12} c="ink2" style={{ textAlign: 'center', marginTop: 4, lineHeight: 16 }}>{sub}</Txt>
                </Pressable>
              );
            })}
          </View>
          <Input style={{ marginTop: 24 }} label={t('yourName')} value={name} maxLength={80} autoComplete="name" autoCapitalize="words" onChangeText={setName} placeholder="e.g. Prince Bangar"
            left={<UserRound size={18} color={c.ink3} />} returnKeyType="done" onSubmitEditing={save}
            error={errs.name ?? (name.trim() && nameErr ? t(nameErr) : undefined)} />
          {m.error && !errs.name && <Txt size={14} c="danger" style={{ marginTop: 8 }}>{errorMessage(m.error)}</Txt>}
          <View style={{ flex: 1, minHeight: 24 }} />
          <Button size="lg" block style={st.cta} disabled={!!nameErr} loading={m.isPending} onPress={save}>
            {t('continue')}<ArrowRight size={20} color={c.onPrimary} />
          </Button>
        </Sheet>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.09)' },
  ping: { position: 'absolute', width: 92, height: 92, borderRadius: 46, borderWidth: 2, borderColor: '#ffffff' },
  backBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  mobileBox: { height: 58, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 2, paddingHorizontal: 16 },
  cta: { height: 56, borderRadius: 16 },
  links: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  linkDot: { width: 4, height: 4, borderRadius: 2 },
  linkText: { textTransform: 'uppercase', letterSpacing: 0.9 },
  roleCard: { flex: 1, alignItems: 'center', borderRadius: 20, borderWidth: 2, paddingHorizontal: 12, paddingTop: 22, paddingBottom: 18 },
  roleCheck: { position: 'absolute', top: 10, right: 10, width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  roleIcon: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
