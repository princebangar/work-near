import { useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';
import { ArrowLeft, BadgeCheck, Eye, EyeOff, IndianRupee, KeyRound, Lock, Mail, MapPin, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { ThemeToggle } from '@/components/system';
import { ApiError } from '@/lib/http';
import { errText, useAdminLogin } from '@/api/admin';
import { toast, useAuth } from '@/store';
import { AdminStyles } from '../components/styles';
import { Btn, TextField } from '../components/kit';

const POINTS = [
  { icon: BadgeCheck, title: 'Trust first', text: 'Review worker verifications, complaints and reviews in one place.' },
  { icon: IndianRupee, title: 'Zero commission', text: 'Simple ₹30 / ₹300 plans — refunds and grants managed from one place.' },
  { icon: SlidersHorizontal, title: 'Instant control', text: 'Feature switches and maintenance mode reach every open app live.' },
];

export function AdminLogin() {
  const admin = useAuth((s) => s.admin);
  const loc = useLocation();
  const login = useAdminLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [otp, setOtp] = useState('');
  const [mfa, setMfa] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const otpRef = useRef<HTMLInputElement>(null);

  if (admin) {
    const from = (loc.state as { from?: string } | null)?.from;
    return <Navigate to={from && from.startsWith('/admin') && from !== '/admin/login' ? from : admin.role === 'support' ? '/admin/complaints' : '/admin'} replace />;
  }

  const send = (code?: string) => {
    setErr(null);
    login.mutate(
      { email: email.trim(), password, otp: mfa ? code : undefined },
      {
        onSuccess: (s) => toast(`Welcome back, ${s.name.split(' ')[0]}`, 'success'),
        onError: (e) => {
          if (e instanceof ApiError && e.code === 'MFA_REQUIRED') {
            setMfa(true);
            setTimeout(() => otpRef.current?.focus(), 50);
          } else if (e instanceof ApiError && e.code === 'MFA_INVALID') {
            setErr(e.message);
            setOtp('');
            otpRef.current?.focus();
          } else setErr(errText(e));
        },
      },
    );
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return setErr('Enter your email and password');
    if (mfa && !/^\d{6}$/.test(otp)) return setErr('Enter the 6-digit code from your authenticator app');
    send(otp);
  };

  return (
    <div className="relative grid min-h-dvh bg-bg text-ink lg:grid-cols-[1.05fr_1fr]">
      <AdminStyles />
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle variant="fold" className="bg-surface text-ink-2 shadow-sm ring-1 ring-line hover:text-ink" />
      </div>

      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 p-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -top-32 -right-24 size-96 rounded-full bg-white/10" aria-hidden />
        <div className="pointer-events-none absolute -bottom-40 -left-28 size-[28rem] rounded-full bg-white/[.07]" aria-hidden />
        <div className="pointer-events-none absolute right-16 bottom-40 size-40 rounded-full border border-white/15" aria-hidden />
        <div className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur"><MapPin size={22} /></span>
          <div>
            <p className="text-lg leading-tight font-extrabold">WorkNear</p>
            <p className="text-[10px] font-bold tracking-[.22em] text-white/70">ADMIN PANEL</p>
          </div>
        </div>
        <div className="relative mt-auto max-w-md">
          <h2 className="text-[34px] leading-[1.15] font-extrabold tracking-tight">Keep your neighbourhood marketplace safe, fair and running.</h2>
          <ul className="mt-8 space-y-4">
            {POINTS.map((p) => (
              <li key={p.title} className="flex gap-3.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/12 ring-1 ring-white/20"><p.icon size={19} /></span>
                <span>
                  <b className="block text-[15px]">{p.title}</b>
                  <span className="text-sm text-white/75">{p.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Form */}
      <main className="flex items-center justify-center px-4 py-16 sm:px-8">
        <div className="adm-pop w-full max-w-[400px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30"><MapPin size={22} /></span>
            <div>
              <p className="text-lg leading-tight font-extrabold">WorkNear</p>
              <p className="text-[10px] font-bold tracking-[.22em] text-primary">ADMIN PANEL</p>
            </div>
          </div>

          <div className="rounded-3xl border border-line bg-surface p-6 shadow-xl shadow-black/[.04] sm:p-8">
            {!mfa ? (
              <>
                <h1 className="text-2xl font-extrabold tracking-tight">Sign in</h1>
                <p className="mt-1 text-sm text-ink-2">Use your WorkNear staff account.</p>
              </>
            ) : (
              <>
                <button type="button" onClick={() => { setMfa(false); setOtp(''); setErr(null); }} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink">
                  <ArrowLeft size={15} /> Back
                </button>
                <span className="mb-3 grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary"><ShieldCheck size={24} /></span>
                <h1 className="text-2xl font-extrabold tracking-tight">Two-factor check</h1>
                <p className="mt-1 text-sm text-ink-2">Enter the 6-digit code from your authenticator app for <b className="text-ink">{email}</b>.</p>
              </>
            )}

            <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
              {!mfa ? (
                <>
                  <TextField
                    label="Email"
                    type="email"
                    autoComplete="username"
                    autoFocus
                    left={<Mail size={16} />}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@worknear.in"
                    tall
                  />
                  <TextField
                    label="Password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    left={<Lock size={16} />}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    tall
                    trailing={
                      <button
                        type="button"
                        aria-label={showPw ? 'Hide password' : 'Show password'}
                        aria-pressed={showPw}
                        onClick={() => setShowPw((v) => !v)}
                        className="grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink"
                      >
                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    }
                  />
                </>
              ) : (
                <div>
                  <label htmlFor="adm-otp" className="mb-1.5 block text-[13px] font-semibold text-ink-2">Authenticator code</label>
                  <input
                    id="adm-otp"
                    ref={otpRef}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setOtp(v);
                      if (v.length === 6 && !login.isPending) send(v);
                    }}
                    placeholder="••••••"
                    className="h-14 w-full rounded-xl border border-line bg-surface text-center text-2xl font-bold tracking-[.5em] text-ink tabular-nums outline-none placeholder:text-ink-3 focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </div>
              )}

              {err && (
                <p role="alert" className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger">
                  <KeyRound size={16} className="mt-0.5 shrink-0" /> {err}
                </p>
              )}

              <Btn type="submit" tone="primary" loading={login.isPending} size="lg" className="w-full">
                {mfa ? 'Verify & sign in' : 'Sign in'}
              </Btn>
            </form>
          </div>
          <p className="mt-6 text-center text-xs text-ink-3">Restricted area · access is logged with IP and time</p>
        </div>
      </main>
    </div>
  );
}
