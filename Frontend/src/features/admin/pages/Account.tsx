import { useState, type FormEvent } from 'react';
import { Check, CheckCircle2, Copy, ExternalLink, KeyRound, LogIn, ShieldAlert, ShieldCheck, Smartphone, XCircle } from 'lucide-react';
import { Avatar, Skeleton } from '@/components/ui';
import { useAdminMe, useChangePassword, useMfaEnable, useMfaSetup } from '@/api/admin';
import { toast } from '@/store';
import { timeAgo } from '@/lib/format';
import type { AdminMe } from '@/types/admin';
import { copyText, dateTime, roleLabel } from '../lib';
import { Btn, ErrorBlock, KeyVals, PageHeader, Panel, Pill, TextField } from '../components/kit';

export function AccountPage() {
  const me = useAdminMe();
  return (
    <>
      <PageHeader eyebrow="System" title="My account" sub="Your profile, sign-in security and recent sign-ins." />
      {me.isPending ? (
        <div className="grid gap-5 lg:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}</div>
      ) : me.isError ? (
        <ErrorBlock error={me.error} onRetry={() => me.refetch()} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Profile me={me.data} />
          <Mfa me={me.data} />
          <PasswordForm />
          <LoginHistory me={me.data} />
        </div>
      )}
    </>
  );
}

function Profile({ me }: { me: AdminMe }) {
  return (
    <Panel title="Profile">
      <div className="mb-5 flex items-center gap-4">
        <Avatar name={me.name} size={60} />
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-ink">{me.name}</p>
          <p className="truncate text-sm text-ink-2">{me.email}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Pill tone="primary" dot={false}>{roleLabel(me.role)}</Pill>
            {me.mfaEnabled ? <Pill tone="success" dot={false}><ShieldCheck size={12} /> MFA on</Pill> : <Pill tone="warning" dot={false}><ShieldAlert size={12} /> MFA off</Pill>}
          </div>
        </div>
      </div>
      <KeyVals
        items={[
          { label: 'Role', value: roleLabel(me.role) },
          { label: 'Last sign-in', value: me.lastLoginAt ? dateTime(me.lastLoginAt) : '—' },
          { label: 'Staff ID', value: <span className="font-mono text-xs">{me.id}</span>, wide: true },
        ]}
      />
      <p className="mt-4 text-xs text-ink-3">Name, email and role are managed by the super admin in Roles & staff.</p>
    </Panel>
  );
}

function Mfa({ me }: { me: AdminMe }) {
  const setup = useMfaSetup();
  const enable = useMfaEnable();
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const secret = setup.data?.secret;
  const grouped = secret?.match(/.{1,4}/g)?.join(' ');

  const copy = async () => {
    if (!secret) return;
    const ok = await copyText(secret);
    setCopied(ok);
    toast(ok ? 'Secret copied' : 'Copy failed — select the text instead', ok ? 'success' : 'error');
  };
  const confirm = (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return toast('Enter the 6-digit code from the app', 'error');
    enable.mutate(code, { onError: () => setCode('') });
  };

  return (
    <Panel
      title="Two-factor authentication"
      sub="A 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…) on every sign-in."
      icon={<span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><Smartphone size={18} /></span>}
    >
      {me.mfaEnabled ? (
        <div className="rounded-2xl border border-success/30 bg-success-soft p-4">
          <p className="flex items-center gap-2 font-bold text-success"><ShieldCheck size={18} /> MFA is on for your account</p>
          <p className="mt-1 text-sm text-ink-2">Lost your phone? Ask the super admin to reset MFA from Roles & staff, then set it up again.</p>
        </div>
      ) : !secret ? (
        <div>
          <div className="mb-4 rounded-2xl border border-warning/30 bg-warning-soft p-4">
            <p className="flex items-center gap-2 font-bold text-warning"><ShieldAlert size={18} /> Your account is protected by a password only</p>
            <p className="mt-1 text-sm text-ink-2">Admins can see private documents and close the app — please turn on MFA.</p>
          </div>
          <Btn tone="primary" icon={<ShieldCheck size={16} />} loading={setup.isPending} onClick={() => setup.mutate()}>Set up MFA</Btn>
        </div>
      ) : (
        <form onSubmit={confirm} className="space-y-4">
          <ol className="space-y-4 text-sm text-ink-2">
            <li>
              <b className="text-ink">1. Add WorkNear to your authenticator app.</b> Tap the link on your phone, or enter this key manually:
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="rounded-xl border border-line bg-surface-2 px-3 py-2 font-mono text-[15px] font-bold tracking-wider text-ink select-all">{grouped}</code>
                <Btn size="sm" icon={copied ? <Check size={14} /> : <Copy size={14} />} onClick={copy}>{copied ? 'Copied' : 'Copy'}</Btn>
              </div>
              <a href={setup.data!.otpauthUrl} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                <ExternalLink size={14} /> Open in authenticator app
              </a>
            </li>
            <li>
              <b className="text-ink">2. Enter the 6-digit code it shows.</b>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-label="Authenticator code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                className="mt-2 block h-12 w-full max-w-[220px] rounded-xl border border-line bg-surface text-center text-xl font-bold tracking-[.45em] text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <Btn type="submit" tone="primary" loading={enable.isPending} disabled={code.length !== 6}>Turn on MFA</Btn>
            <Btn tone="ghost" onClick={() => { setup.reset(); setCode(''); }}>Cancel</Btn>
          </div>
          <p className="text-xs text-ink-3">The setup key expires in 10 minutes.</p>
        </form>
      )}
    </Panel>
  );
}

function PasswordForm() {
  const change = useChangePassword();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [err, setErr] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.current) return setErr('Enter your current password');
    if (f.next.length < 8) return setErr('New password must be at least 8 characters');
    if (f.next !== f.confirm) return setErr('New passwords do not match');
    if (f.next === f.current) return setErr('Choose a password different from the current one');
    setErr(null);
    change.mutate({ current: f.current, next: f.next }, { onSuccess: () => setF({ current: '', next: '', confirm: '' }) });
  };
  const strength = [/.{10,}/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(f.next)).length;
  return (
    <Panel title="Change password" icon={<span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><KeyRound size={18} /></span>}>
      <form onSubmit={submit} className="space-y-3.5">
        <input type="text" name="username" autoComplete="username" hidden readOnly />
        <TextField label="Current password" type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
        <TextField label="New password" type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} hint="At least 8 characters — longer with numbers and symbols is better." />
        {f.next && (
          <div className="flex items-center gap-2" aria-label={`Password strength ${strength} of 4`}>
            {[0, 1, 2, 3].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i < strength ? (strength >= 3 ? 'bg-success' : 'bg-warning') : 'bg-surface-3'}`} />)}
          </div>
        )}
        <TextField label="Confirm new password" type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        <Btn type="submit" tone="primary" loading={change.isPending}>Update password</Btn>
      </form>
    </Panel>
  );
}

function LoginHistory({ me }: { me: AdminMe }) {
  return (
    <Panel title="Recent sign-ins" sub="Last 10 attempts on your account" icon={<span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><LogIn size={18} /></span>}>
      {me.loginHistory.length ? (
        <ul className="divide-y divide-line">
          {me.loginHistory.map((l, i) => (
            <li key={`${l.at}-${i}`} className="flex items-center gap-3 py-2.5">
              {l.ok ? <CheckCircle2 size={18} className="shrink-0 text-success" /> : <XCircle size={18} className="shrink-0 text-danger" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{l.ok ? 'Signed in' : 'Failed attempt'}</p>
                <p className="text-xs text-ink-3">{dateTime(l.at)} · {timeAgo(l.at)}</p>
              </div>
              <span className="font-mono text-xs text-ink-3">{l.ip ?? '—'}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-3">No sign-ins recorded yet.</p>
      )}
    </Panel>
  );
}
