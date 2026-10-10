import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { ArrowLeft, ArrowRight, BadgeIndianRupee, Briefcase, CheckCircle2, Droplets, Hammer, Languages, MapPinned, MessagesSquare, Paintbrush, Search as SearchIcon, ShieldCheck, Zap } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { useRequestOtp, useUpdateMe, useVerifyOtp } from '@/api';
import { useAuth, usePrefs, toast } from '@/store';
import { useT } from '@/i18n';
import { APP } from '@/config/env';
import { cn } from '@/lib/format';
import { ApiError } from '@/lib/http';
import type { Role } from '@/types';

const slides = [
  { icon: MapPinned, title: 'Workers within 5 KM', sub: 'Find electricians, plumbers, tutors and more — right in your neighbourhood.' },
  { icon: MessagesSquare, title: 'Chat directly', sub: 'Talk to the worker, agree on work, time and price. No middlemen.' },
  { icon: BadgeIndianRupee, title: 'Zero Commission', sub: 'Pay the worker directly. WorkNear never takes a cut from your job.' },
];

export function Welcome() {
  const t = useT();
  const nav = useNavigate();
  const { lang, setLang, setOnboarded } = usePrefs();
  const [i, setI] = useState(0);
  const done = () => { setOnboarded(); nav('/login'); };
  const S = slides[i];
  return (
    <div className="pt-safe pb-safe flex min-h-dvh flex-col bg-surface px-6">
      <div className="flex h-14 items-center justify-between">
        <button onClick={() => setLang(lang === 'en' ? 'hi' : 'en')} className="rounded-full border border-line px-3 py-1 text-sm font-semibold">
          {lang === 'en' ? 'हिंदी' : 'English'}
        </button>
        <button onClick={done} className="text-sm font-semibold text-ink-2">{t('skip')}</button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="relative mb-10 grid size-56 place-items-center">
          <div className="absolute inset-0 rounded-full bg-primary-soft" />
          <div className="absolute inset-8 rounded-full bg-primary/15" />
          <div className="relative grid size-24 place-items-center rounded-3xl bg-primary text-white shadow-xl shadow-primary/40">
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
  const { lang, setLang } = usePrefs();
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
        <button onClick={() => setLang(lang === 'en' ? 'hi' : 'en')} className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold">
          <Languages size={16} />{lang === 'en' ? 'हिंदी' : 'English'}
        </button>
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

export function Login() {
  const t = useT();
  const nav = useNavigate();
  const [mobile, setMobile] = useState('');
  const [agree, setAgree] = useState(true);
  const m = useRequestOtp();
  if (useAuth.getState().token) return <Navigate to="/" replace />;
  const valid = /^[6-9]\d{9}$/.test(mobile);
  const submit = () => valid && agree && m.mutate(mobile, { onSuccess: () => nav('/otp', { state: { mobile } }) });
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <AuthHero title="WorkNear" sub={t('tagline')} />
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="pb-safe relative -mt-8 flex flex-1 flex-col rounded-t-[32px] bg-surface px-6 pt-8">
        <h2 className="text-[22px] font-extrabold">{t('login')} / Sign up</h2>
        <p className="mt-1 mb-6 text-sm text-ink-2">{t('otpSentInfo')}</p>
        <label className={cn('flex h-14 items-center gap-3 rounded-2xl border-2 bg-surface px-4 transition focus-within:border-primary focus-within:shadow-[0_0_0_4px_var(--c-primary-soft)]', m.isError ? 'border-danger' : 'border-line')}>
          <span className="border-r border-line pr-3 font-bold">+91</span>
          <input
            inputMode="numeric" autoComplete="tel-national" autoFocus maxLength={10} value={mobile} placeholder={t('enterMobile')}
            onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
            className="h-full w-full bg-transparent font-semibold tracking-wider outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-ink-3"
          />
          {valid && <CheckCircle2 size={22} className="shrink-0 text-success" />}
        </label>
        {m.error && <p className="mt-2 text-sm text-danger">{m.error instanceof ApiError ? m.error.message : 'Something went wrong'}</p>}

        <label className="mt-5 flex items-start gap-3 text-sm text-ink-2">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-[18px] shrink-0 accent-[var(--c-primary)]" />
          <span>
            I agree to the <Link className="font-semibold text-primary" to="/legal/terms">Terms of Use</Link> and{' '}
            <Link className="font-semibold text-primary" to="/legal/privacy">Privacy Policy</Link>
          </span>
        </label>

        <div className="mt-6 grid grid-cols-3 gap-2">
          {[[ShieldCheck, 'Verified workers'], [BadgeIndianRupee, 'Zero commission'], [MapPinned, 'Within 5 KM']].map(([I, label]) => {
            const Icon = I as typeof ShieldCheck;
            return (
              <div key={label as string} className="flex flex-col items-center gap-1.5 rounded-2xl bg-surface-2 px-2 py-3 text-center">
                <Icon size={20} className="text-primary" /><span className="text-[11px] leading-tight font-semibold text-ink-2">{label as string}</span>
              </div>
            );
          })}
        </div>

        <div className="min-h-6 flex-1" />
        <Button type="submit" size="lg" block className="mb-6 h-14 rounded-2xl text-base" disabled={!valid || !agree} loading={m.isPending}>
          {t('sendOtp')}<ArrowRight size={20} />
        </Button>
      </form>
    </div>
  );
}

export function Otp() {
  const t = useT();
  const nav = useNavigate();
  const mobile = (useLocation().state as { mobile?: string } | null)?.mobile;
  const [otp, setOtp] = useState('');
  const [left, setLeft] = useState(30);
  const ref = useRef<HTMLInputElement>(null);
  const verify = useVerifyOtp();
  const resend = useRequestOtp();
  const setSession = useAuth((s) => s.setSession);
  useEffect(() => {
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  const run = (code: string) =>
    mobile && verify.mutate({ mobile, otp: code }, { onSuccess: (s) => { setSession(s); nav(s.user.name ? '/' : '/role', { replace: true }); } });
  if (!mobile) return <Navigate to="/login" replace />;
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <AuthHero back title={t('enterOtp')} sub={`${t('otpSentTo')} +91 ${mobile.slice(0, 5)} ${mobile.slice(5)}`} />
      <div className="pb-safe relative -mt-8 flex flex-1 flex-col rounded-t-[32px] bg-surface px-6 pt-8">
        <div className="relative" onClick={() => ref.current?.focus()}>
          <input
            ref={ref} autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} aria-label="OTP"
            onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setOtp(v); verify.reset(); if (v.length === 6) run(v); }}
            className="absolute inset-0 z-10 opacity-0"
          />
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={cn('grid aspect-[4/5] place-items-center rounded-2xl border-2 text-2xl font-extrabold transition',
                verify.isError ? 'border-danger bg-danger-soft' : otp[i] ? 'border-primary bg-primary-soft text-primary' : i === otp.length ? 'border-primary' : 'border-line bg-surface-2')}>
                {otp[i] ?? (i === otp.length ? <span className="h-6 w-0.5 animate-pulse bg-primary" /> : '')}
              </div>
            ))}
          </div>
        </div>
        {verify.error && <p className="mt-3 text-center text-sm text-danger">{verify.error.message}</p>}
        <p className="mt-3 text-center text-xs text-ink-3">Demo OTP: {APP.demoOtp}</p>
        <div className="mt-6 text-center text-sm">
          {left > 0 ? (
            <span className="text-ink-2">{t('resendIn')} <b className="text-ink">0:{String(left).padStart(2, '0')}</b></span>
          ) : (
            <button className="font-bold text-primary" onClick={() => resend.mutate(mobile, { onSuccess: () => { setLeft(30); setOtp(''); toast('OTP sent again'); } })}>{t('resend')}</button>
          )}
        </div>
        <div className="min-h-6 flex-1" />
        <Button size="lg" block className="mb-3 h-14 rounded-2xl text-base" loading={verify.isPending} disabled={otp.length !== 6} onClick={() => run(otp)}>{t('verifyOtp')}</Button>
        <button onClick={() => nav('/login', { replace: true })} className="mb-4 text-sm font-semibold text-ink-2">Change number</button>
      </div>
    </div>
  );
}


export function RoleSetup() {
  const t = useT();
  const nav = useNavigate();
  const { user, updateUser } = useAuth();
  const [role, setRole] = useState<Role>('customer');
  const [name, setName] = useState(user?.name ?? '');
  const m = useUpdateMe();
  if (!user) return <Navigate to="/login" replace />;
  const opts = [
    { r: 'customer' as const, icon: SearchIcon, title: t('roleCustomer'), sub: t('roleCustomerSub') },
    { r: 'worker' as const, icon: Briefcase, title: t('roleWorker'), sub: t('roleWorkerSub') },
  ];
  const save = () => {
    const patch = { name: name.trim(), roles: [role], activeRole: role };
    m.mutate(patch, { onSuccess: () => { updateUser(patch); nav(role === 'worker' ? '/onboarding' : '/', { replace: true }); } });
  };
  return (
    <div className="pt-safe pb-safe flex min-h-dvh flex-col bg-surface px-6">
      <h1 className="mt-10 text-[26px] font-extrabold">{t('chooseRole')}</h1>
      <div className="mt-6 space-y-3">
        {opts.map(({ r, icon: I, title, sub }) => (
          <button key={r} onClick={() => setRole(r)} className={cn('flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition', role === r ? 'border-primary bg-primary-soft' : 'border-line')}>
            <span className={cn('grid size-12 place-items-center rounded-xl', role === r ? 'bg-primary text-white' : 'bg-surface-2 text-ink-2')}><I /></span>
            <span><b className="block">{title}</b><span className="text-sm text-ink-2">{sub}</span></span>
          </button>
        ))}
      </div>
      <div className="mt-6"><Input label={t('yourName')} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rahul Sharma" /></div>
      <div className="flex-1" />
      <Button size="lg" block className="mb-4" disabled={name.trim().length < 2} loading={m.isPending} onClick={save}>{t('continue')}</Button>
    </div>
  );
}
