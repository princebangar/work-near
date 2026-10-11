import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { ArrowLeft, ArrowRight, BadgeIndianRupee, Briefcase, CheckCircle2, Droplets, Hammer, Languages, MapPinned, MessagesSquare, Paintbrush, Search as SearchIcon, ShieldCheck, Zap } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { errorMessage, fieldErrors, isApiError, qk, setUser, useRequestOtp, useUpdateMe, useVerifyOtp } from '@/api';
import { useAuth, useFeature, usePrefs, useSettings, toast } from '@/store';
import { useT } from '@/i18n';
import { cn } from '@/lib/format';
import { cleanName, nameError } from '@/lib/validate';
import { http, queryClient } from '@/lib/http';
import { APP } from '@/config/env';
import type { Role, Session, User } from '@/types';

function LangSwitch({ className }: { className?: string }) {
  const { lang, setLang } = usePrefs();
  const hindi = useFeature('hindi');
  if (!hindi) return null;
  return (
    <button onClick={() => setLang(lang === 'en' ? 'hi' : 'en')} className={className}>
      <Languages size={16} />{lang === 'en' ? 'हिंदी' : 'English'}
    </button>
  );
}

export function Welcome() {
  const t = useT();
  const nav = useNavigate();
  const setOnboarded = usePrefs((s) => s.setOnboarded);
  const token = useAuth((s) => s.token);
  const radius = useSettings((s) => s.settings?.defaultRadiusKm) ?? APP.defaultRadiusKm;
  const [i, setI] = useState(0);
  if (token) return <Navigate to="/" replace />;
  const slides = [
    { icon: MapPinned, title: t('slide1Title').replace('{km}', String(radius)), sub: t('slide1Sub') },
    { icon: MessagesSquare, title: t('slide2Title'), sub: t('slide2Sub') },
    { icon: BadgeIndianRupee, title: t('zeroCommission'), sub: t('slide3Sub') },
  ];
  const done = () => { setOnboarded(); nav('/login'); };
  const S = slides[i];
  return (
    <div className="pt-safe pb-safe flex min-h-dvh flex-col bg-surface px-6">
      <div className="flex h-14 items-center justify-between">
        <LangSwitch className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-sm font-semibold text-ink" />
        <button onClick={done} className="ml-auto text-sm font-semibold text-ink-2">{t('skip')}</button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="relative mb-10 grid size-56 place-items-center">
          <div className="absolute inset-0 rounded-full bg-primary-soft" />
          <div className="absolute inset-8 rounded-full bg-primary/15" />
          <div className="relative grid size-24 place-items-center rounded-3xl bg-primary text-on-primary shadow-xl shadow-primary/40">
            <S.icon size={48} />
          </div>
        </div>
        <h1 className="text-[28px] leading-tight font-extrabold">{S.title}</h1>
        <p className="mt-3 max-w-xs text-ink-2">{S.sub}</p>
      </div>
      <div className="mb-6 flex justify-center gap-1.5">
        {slides.map((_, k) => <span key={k} className={cn('h-2 rounded-full transition-all', k === i ? 'w-6 bg-primary' : 'w-2 bg-line')} />)}
      </div>
      <Button size="lg" block className="mb-4" onClick={() => (i < slides.length - 1 ? setI(i + 1) : done())}>
        {i < slides.length - 1 ? t('next') : t('getStarted')}
      </Button>
    </div>
  );
}

/** Shared brand header for Login & OTP: gradient hero with floating service icons. */
function AuthHero({ title, sub, back }: { title: string; sub: string; back?: boolean }) {
  const nav = useNavigate();
  const floaters = [
    { I: Zap, c: 'top-[22%] left-[8%] rotate-[-12deg]' },
    { I: Droplets, c: 'top-[14%] right-[12%] rotate-[10deg]' },
    { I: Hammer, c: 'bottom-[30%] left-[16%] rotate-[8deg]' },
    { I: Paintbrush, c: 'bottom-[34%] right-[8%] rotate-[-8deg]' },
  ];
  return (
    <div className="pt-safe relative overflow-hidden bg-gradient-to-br from-primary via-primary to-violet-500 px-6 pb-14 text-white">
      <div className="absolute -top-20 -right-16 size-64 rounded-full bg-white/10" />
      <div className="absolute -bottom-24 -left-10 size-56 rounded-full bg-white/10" />
      {floaters.map(({ I, c }, i) => (
        <span key={i} className={cn('absolute grid size-11 place-items-center rounded-2xl bg-white/15 backdrop-blur-sm', c)}><I size={20} /></span>
      ))}
      <div className="relative flex h-14 items-center justify-between">
        {back ? (
          <button aria-label="Back" onClick={() => nav(-1)} className="grid size-10 place-items-center rounded-full bg-white/15"><ArrowLeft size={20} /></button>
        ) : <span />}
        <LangSwitch className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold" />
      </div>
      <div className="relative flex flex-col items-center pt-6 pb-4 text-center">
        <div className="mb-4 grid size-20 place-items-center rounded-[26px] bg-white shadow-2xl shadow-black/20">
          <MapPinned size={40} className="text-primary" />
        </div>
        <h1 className="text-[28px] leading-tight font-extrabold">{title}</h1>
        <p className="mt-1.5 max-w-xs text-[15px] text-white/85">{sub}</p>
      </div>
    </div>
  );
}

interface OtpState { mobile: string; resendAfter: number; expiresIn: number; isRegistered: boolean; from?: string }

export function Login() {
  const t = useT();
  const nav = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const token = useAuth((s) => s.token);
  const radius = useSettings((s) => s.settings?.defaultRadiusKm) ?? APP.defaultRadiusKm;
  const [mobile, setMobile] = useState('');
  const [agree, setAgree] = useState(false);
  const m = useRequestOtp();
  if (token) return <Navigate to="/" replace />;
  const valid = /^[6-9]\d{9}$/.test(mobile);
  const submit = () =>
    valid && agree && m.mutate(mobile, { onSuccess: (r) => nav('/otp', { state: { mobile, ...r, from } satisfies OtpState }) });
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <AuthHero title={APP.name} sub={t('tagline')} />
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="pb-safe relative -mt-8 flex flex-1 flex-col rounded-t-[32px] bg-surface px-6 pt-8">
        <h2 className="text-[22px] font-extrabold">{t('loginSignup')}</h2>
        <p className="mt-1 mb-6 text-sm text-ink-2">{t('otpSentInfo')}</p>
        <label className={cn('flex h-14 items-center gap-3 rounded-2xl border-2 bg-surface px-4 transition focus-within:border-primary focus-within:shadow-[0_0_0_4px_var(--c-primary-soft)]', m.isError ? 'border-danger' : 'border-line')}>
          <span className="border-r border-line pr-3 font-bold">+91</span>
          <input
            inputMode="numeric" autoComplete="tel-national" autoFocus maxLength={10} value={mobile} placeholder={t('enterMobile')} aria-label={t('enterMobile')}
            onChange={(e) => { setMobile(e.target.value.replace(/\D/g, '')); if (m.isError) m.reset(); }}
            className="h-full w-full bg-transparent font-semibold tracking-wider text-ink outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-ink-3"
          />
          {valid && <CheckCircle2 size={22} className="shrink-0 text-success" />}
        </label>
        {mobile.length === 10 && !valid && <p className="mt-2 text-sm text-danger">{t('invalidMobile')}</p>}
        {m.error && <p role="alert" className="mt-2 text-sm text-danger">{fieldErrors(m.error).mobile ?? errorMessage(m.error)}</p>}

        <label className="mt-5 flex items-start gap-3 text-sm text-ink-2">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-[18px] shrink-0 accent-[var(--c-primary)]" />
          <span>
            {t('iAgree')} <Link className="font-semibold text-primary" to="/legal/terms">{t('termsOfUse')}</Link> {t('and')}{' '}
            <Link className="font-semibold text-primary" to="/legal/privacy">{t('privacyPolicy')}</Link>
          </span>
        </label>

        <div className="mt-6 grid grid-cols-3 gap-2">
          {([[ShieldCheck, t('verifiedWorkers')], [BadgeIndianRupee, t('zeroCommission')], [MapPinned, `${t('within')} ${radius} KM`]] as const).map(([Icon, label]) => (
            <div key={label} className="flex flex-col items-center gap-1.5 rounded-2xl bg-surface-2 px-2 py-3 text-center">
              <Icon size={20} className="text-primary" /><span className="text-[11px] leading-tight font-semibold text-ink-2">{label}</span>
            </div>
          ))}
        </div>

        <div className="min-h-6 flex-1" />
        {valid && !agree && <p className="mb-2 text-center text-xs text-ink-3">{t('acceptToContinue')}</p>}
        <Button type="submit" size="lg" block className="mb-4 h-14 rounded-2xl text-base" disabled={!valid || !agree} loading={m.isPending}>
          {t('sendOtp')}<ArrowRight size={20} />
        </Button>
      </form>
    </div>
  );
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function Otp() {
  const t = useT();
  const nav = useNavigate();
  const st = useLocation().state as OtpState | null;
  const mobile = st?.mobile;
  const [otp, setOtp] = useState('');
  const [left, setLeft] = useState(st?.resendAfter ?? 30);
  const [expAt, setExpAt] = useState(() => Date.now() + (st?.expiresIn ?? 300) * 1000);
  const [now, setNow] = useState(Date.now);
  const [error, setError] = useState<{ text: string; needsNew?: boolean } | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const verify = useVerifyOtp();
  const resend = useRequestOtp();
  const setSession = useAuth((s) => s.setSession);
  const lang = usePrefs((s) => s.lang);
  useEffect(() => {
    const id = setInterval(() => { setLeft((s) => Math.max(0, s - 1)); setNow(Date.now()); }, 1000);
    return () => clearInterval(id);
  }, []);
  const expired = now >= expAt;

  const onLoggedIn = (session: Session) => {
    const { user } = session;
    queryClient.clear(); // never show a previous account's cached data
    setSession(session);
    queryClient.setQueryData(qk.me, user);
    // The language picked on this device wins; keep the server copy in sync for SMS/push texts.
    if (user.name && user.language !== lang) void http.patch<User>('/me', { language: lang }).then(setUser).catch(() => undefined);
    if (!user.name) return nav('/role', { replace: true });
    toast(`${t('welcomeBack')}, ${user.name.split(' ')[0]}`);
    nav(st?.from && st.from !== '/login' ? st.from : '/', { replace: true });
  };

  const run = (code: string) => {
    if (!mobile || verify.isPending) return;
    setError(null);
    verify.mutate(
      { mobile, otp: code, acceptTerms: true },
      {
        onSuccess: onLoggedIn,
        onError: (e) => {
          setOtp('');
          ref.current?.focus();
          if (isApiError(e, 'OTP_EXPIRED') || isApiError(e, 'RATE_LIMITED')) {
            setExpAt(Date.now());
            setError({ text: errorMessage(e), needsNew: true });
          } else if (isApiError(e, 'CONSENT_REQUIRED')) {
            toast(errorMessage(e), 'error');
            nav('/login', { replace: true });
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
        ref.current?.focus();
        toast(t('otpResent'));
      },
      onError: (e) => toast(errorMessage(e), 'error'),
    });

  if (!mobile) return <Navigate to="/login" replace />;
  const blocked = expired || !!error?.needsNew;
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <AuthHero back title={t('enterOtp')} sub={`${t('otpSentTo')} +91 ${mobile.slice(0, 5)} ${mobile.slice(5)}`} />
      <div className="pb-safe relative -mt-8 flex flex-1 flex-col rounded-t-[32px] bg-surface px-6 pt-8">
        <div className="relative" onClick={() => ref.current?.focus()}>
          <input
            ref={ref} autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} aria-label="OTP" disabled={blocked}
            onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setOtp(v); if (error) setError(null); if (v.length === 6) run(v); }}
            className="absolute inset-0 z-10 opacity-0"
          />
          <div className={cn('grid grid-cols-6 gap-2', blocked && 'opacity-50')}>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={cn('grid aspect-[4/5] place-items-center rounded-2xl border-2 text-2xl font-extrabold transition',
                error ? 'border-danger bg-danger-soft' : otp[i] ? 'border-primary bg-primary-soft text-primary' : i === otp.length ? 'border-primary' : 'border-line bg-surface-2')}>
                {otp[i] ?? (i === otp.length && !blocked ? <span className="h-6 w-0.5 animate-pulse bg-primary" /> : '')}
              </div>
            ))}
          </div>
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-center text-sm text-danger">{error.text}</p>
        ) : expired ? (
          <p role="alert" className="mt-3 text-center text-sm text-danger">{t('otpExpired')}</p>
        ) : (
          <p className="mt-3 text-center text-xs text-ink-3">{t('codeExpiresIn')} {mmss(Math.ceil((expAt - now) / 1000))}</p>
        )}
        {import.meta.env.DEV && <p className="mt-1 text-center text-xs text-ink-3">Dev: OTP 123456</p>}
        <div className="mt-6 text-center text-sm">
          {left > 0 ? (
            <span className="text-ink-2">{t('resendIn')} <b className="text-ink">{mmss(left)}</b></span>
          ) : (
            <button className="font-bold text-primary disabled:opacity-50" disabled={resend.isPending} onClick={doResend}>{resend.isPending ? '…' : t('resend')}</button>
          )}
        </div>
        <div className="min-h-6 flex-1" />
        <Button size="lg" block className="mb-3 h-14 rounded-2xl text-base" loading={verify.isPending} disabled={otp.length !== 6 || blocked} onClick={() => run(otp)}>{t('verifyOtp')}</Button>
        <button onClick={() => nav('/login', { replace: true })} className="mb-4 text-sm font-semibold text-ink-2">{t('changeNumber')}</button>
      </div>
    </div>
  );
}

export function RoleSetup() {
  const t = useT();
  const nav = useNavigate();
  const user = useAuth((s) => s.user);
  const lang = usePrefs((s) => s.lang);
  const workerReg = useFeature('workerRegistration');
  const [role, setRole] = useState<Role>('customer');
  const [name, setName] = useState(user?.name ?? '');
  const m = useUpdateMe();
  const submitted = useRef(false); // after saving, the name is set — don't let the guard below race our own navigation
  if (!user) return <Navigate to="/login" replace />;
  if (user.name && !submitted.current) return <Navigate to="/" replace />;
  const opts = [
    { r: 'customer' as const, icon: SearchIcon, title: t('roleCustomer'), sub: t('roleCustomerSub') },
    ...(workerReg ? [{ r: 'worker' as const, icon: Briefcase, title: t('roleWorker'), sub: t('roleWorkerSub') }] : []),
  ];
  const chosen = workerReg ? role : 'customer';
  const errs = fieldErrors(m.error);
  const nameErr = nameError(name);
  const save = () => {
    if (nameErr) return;
    submitted.current = true;
    m.mutate(
      { name: cleanName(name), activeRole: chosen, language: lang },
      { onSuccess: () => nav(chosen === 'worker' ? '/onboarding' : '/', { replace: true }), onError: () => (submitted.current = false) },
    );
  };
  return (
    <div className="pt-safe pb-safe flex min-h-dvh flex-col bg-surface px-6">
      <h1 className="mt-10 text-[26px] font-extrabold">{t('chooseRole')}</h1>
      <p className="mt-1 text-sm text-ink-2">{t('roleLater')}</p>
      <div className="mt-6 space-y-3" role="radiogroup">
        {opts.map(({ r, icon: I, title, sub }) => (
          <button key={r} role="radio" aria-checked={chosen === r} onClick={() => setRole(r)} className={cn('flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition', chosen === r ? 'border-primary bg-primary-soft' : 'border-line')}>
            <span className={cn('grid size-12 place-items-center rounded-xl', chosen === r ? 'bg-primary text-on-primary' : 'bg-surface-2 text-ink-2')}><I /></span>
            <span><b className="block">{title}</b><span className="text-sm text-ink-2">{sub}</span></span>
          </button>
        ))}
      </div>
      <div className="mt-6">
        <Input label={t('yourName')} value={name} maxLength={80} autoComplete="name" onChange={(e) => setName(e.target.value)} placeholder="e.g. Rahul Sharma"
          error={errs.name ?? (name.trim() && nameErr ? t(nameErr) : undefined)} />
      </div>
      {m.error && !errs.name && <p role="alert" className="mt-2 text-sm text-danger">{errorMessage(m.error)}</p>}
      <div className="flex-1" />
      <Button size="lg" block className="mb-4" disabled={!!nameErr} loading={m.isPending} onClick={save}>{t('continue')}</Button>
    </div>
  );
}
