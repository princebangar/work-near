import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Bell, BellRing, Camera, Check, Moon, Sun, ChevronRight, CreditCard, Crown, FileText, Globe, HelpCircle, LogOut, Mail, MoonStar, Phone, Repeat, Shield, ShieldCheck, Trash2,
  UserPen, UserX, X, type LucideIcon,
} from 'lucide-react';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Input, Sheet, Skeleton, Toggle, TopBar } from '@/components/ui';
import { FilePicker } from '@/components/shared';
import { toggleTheme } from '@/lib/theme';
import { cleanName, nameError } from '@/lib/validate';
import {
  errorMessage, fieldErrors, toastError, unregisterPush, useBlocked, useDeleteRequest, useEnablePush, useMySubscription, useUnblockUser, useUpdateMe, useUploadAvatar,
} from '@/api';
import { pushState, type PushState } from '@/lib/push';
import { useAuth, useFeature, usePrefs, useTheme, toast } from '@/store';
import { useSupport } from '@/hooks/useAppSettings';
import { useT, type TKey } from '@/i18n';
import { cn, date } from '@/lib/format';
import { queryClient } from '@/lib/http';
import type { NotifPrefs, Subscription } from '@/types';

// ---------- Building blocks ----------
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2.5 flex items-center gap-2 px-1 text-[13px] font-bold tracking-wide text-ink-2 uppercase">
        <span className="h-4 w-1 rounded bg-primary" aria-hidden />{title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

const rowCls = 'flex w-full items-center gap-3 rounded-2xl border border-line/70 bg-surface px-3.5 py-3 text-left transition';
function RowBody({ icon: I, label, value, right }: { icon: LucideIcon; label: string; value?: ReactNode; right?: ReactNode }) {
  return (
    <>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary"><I size={19} /></span>
      <span className="min-w-0 flex-1 text-[15px] font-semibold text-ink">{label}</span>
      {value !== undefined && <span className="max-w-[48%] truncate text-sm text-ink-2">{value}</span>}
      {right ?? <ChevronRight size={18} className="shrink-0 text-ink-3" />}
    </>
  );
}
function Row(p: { icon: LucideIcon; label: string; value?: ReactNode; right?: ReactNode; onClick?: () => void; href?: string; to?: string; disabled?: boolean }) {
  if (p.href) return <a href={p.href} className={cn(rowCls, 'active:scale-[.99]')}><RowBody {...p} /></a>;
  if (p.to) return <Link to={p.to} className={cn(rowCls, 'active:scale-[.99]')}><RowBody {...p} /></Link>;
  return <button type="button" onClick={p.onClick} disabled={p.disabled} className={cn(rowCls, 'active:scale-[.99] disabled:opacity-60')}><RowBody {...p} /></button>;
}

const subLabel = (s: Subscription | undefined, t: (k: TKey) => string) =>
  !s ? '…' : s.status === 'active' ? t('subActive') : s.status === 'expired' ? t('subExpired') : s.status === 'pending' ? t('subPending') : t('subNone');

/**
 * Pick-one popup (Language, Appearance). The current choice is listed first and highlighted with a tick;
 * the other options follow below. Picking one applies it and closes the sheet.
 */
function OptionSheet<V extends string>({ open, onClose, title, value, options, onPick }: {
  open: boolean; onClose: () => void; title: string; value: V; onPick: (v: V) => void;
  options: { value: V; label: string; sub?: string; icon: LucideIcon }[];
}) {
  const ordered = [...options].sort((a, b) => Number(b.value === value) - Number(a.value === value));
  return (
    <CenterDialog open={open} onClose={onClose} title={title}>
      <div role="radiogroup" aria-label={title} className="space-y-2">
        {ordered.map(({ value: v, label, sub, icon: I }) => {
          const on = v === value;
          return (
            <button key={v} type="button" role="radio" aria-checked={on} onClick={() => onPick(v)}
              className={cn('flex w-full items-center gap-3 rounded-2xl border-2 px-3.5 py-3 text-left transition active:scale-[.99]', on ? 'border-primary bg-primary-soft' : 'border-line bg-surface hover:bg-surface-2')}>
              <span className={cn('grid size-10 shrink-0 place-items-center rounded-full', on ? 'bg-primary text-on-primary' : 'bg-surface-2 text-ink-2')}><I size={19} /></span>
              <span className="min-w-0 flex-1">
                <b className={cn('block text-[15px]', on && 'text-primary')}>{label}</b>
                {sub && <span className="block text-xs text-ink-2">{sub}</span>}
              </span>
              {on && <span className="grid size-6 place-items-center rounded-full bg-primary text-on-primary"><Check size={14} strokeWidth={3} /></span>}
            </button>
          );
        })}
      </div>
    </CenterDialog>
  );
}

/** Small centred popup (Zomato-style chooser): dimmed backdrop, card pops in at the middle of the screen. */
function CenterDialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-6">
      <div className="animate-fade absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label={title} className="animate-pop relative w-full max-w-[340px] rounded-3xl bg-surface p-4 text-ink shadow-2xl">
        <div className="mb-3 flex items-center px-1">
          <h3 className="flex-1 text-lg font-bold">{title}</h3>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-8 place-items-center rounded-full bg-surface-2 text-ink-2"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- Account ----------
export function Account() {
  const t = useT();
  const nav = useNavigate();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const { lang, setLang } = usePrefs();
  const mode = useTheme((s) => s.mode);
  const subsOn = useFeature('subscriptions');
  const hindiOn = useFeature('hindi');
  const dualRole = useFeature('dualRole');
  const workerReg = useFeature('workerRegistration');
  const complaintsOn = useFeature('complaints');
  const support = useSupport();
  const sub = useMySubscription(subsOn);
  const avatar = useUploadAvatar();
  const updateMe = useUpdateMe();
  const delReq = useDeleteRequest();
  const [confirm, setConfirm] = useState<'logout' | 'delete' | null>(null);
  const [typed, setTyped] = useState('');
  if (!user) return null;

  const isWorker = user.activeRole === 'worker';
  const other = isWorker ? 'customer' : 'worker';
  const hasOther = user.roles.includes(other);
  const switchRow: { label: string; run: () => void } | null =
    hasOther || (isWorker && dualRole)
      ? {
          label: isWorker ? t('switchToCustomer') : t('switchToWorker'),
          run: () => updateMe.mutate({ activeRole: other }, { onSuccess: () => { toast(isWorker ? t('nowCustomer') : t('nowWorker')); nav('/'); }, onError: (e) => toastError(e) }),
        }
      : !isWorker && workerReg && dualRole
        ? { label: t('becomeWorker'), run: () => nav('/onboarding') }
        : null;

  const [picker, setPicker] = useState<'lang' | 'theme' | null>(null);
  const changeLang = (next: 'en' | 'hi') => {
    setPicker(null);
    if (next === lang) return;
    setLang(next);
    updateMe.mutate({ language: next }, { onError: () => undefined }); // device choice already applied; server copy is best-effort
  };
  const changeTheme = (next: 'light' | 'dark') => {
    setPicker(null);
    // Let the sheet close first so the smooth cross-fade runs on the page, not on the closing sheet.
    if (next !== mode) requestAnimationFrame(() => toggleTheme());
  };

  const doLogout = () => {
    void unregisterPush();
    logout();
    queryClient.clear();
    nav('/login', { replace: true });
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
    <div>
      <TopBar back={false} title={t('account')} />
      <div className="space-y-6 p-4">
        {/* Header card */}
        <Card className="overflow-hidden">
          <div className="flex items-center gap-4 p-4">
            <FilePicker onFiles={([f]) => avatar.mutate(f, { onSuccess: () => toast(t('photoUpdated')), onError: (e) => toastError(e) })}>
              {(open) => (
                <button onClick={open} className="relative shrink-0" aria-label={t('changePhoto')} disabled={avatar.isPending}>
                  <Avatar src={user.avatar} name={user.name} size={64} className={cn(avatar.isPending && 'opacity-50')} />
                  <span className="absolute -right-0.5 -bottom-0.5 grid size-6 place-items-center rounded-full bg-primary text-on-primary ring-2 ring-surface">
                    {avatar.isPending ? <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Camera size={12} />}
                  </span>
                </button>
              )}
            </FilePicker>
            <div className="min-w-0 flex-1">
              <b className="block truncate text-lg leading-tight">{user.name}</b>
              <span className="block text-sm text-ink-2">+91 {user.mobile}</span>
              {user.email && <span className="block truncate text-sm text-ink-2">{user.email}</span>}
              <Link to="/profile/edit" className="mt-1 inline-flex items-center text-sm font-semibold text-primary">{t('editProfile')}<ChevronRight size={16} /></Link>
            </div>
          </div>
          <div className={cn('grid divide-x divide-line border-t border-line bg-surface-2/60 py-3 text-center', subsOn ? 'grid-cols-3' : 'grid-cols-2')}>
            <div className="px-1">
              <Badge tone="primary">{isWorker ? t('roleWorkerShort') : t('roleCustomerShort')}</Badge>
              <span className="mt-1 block text-[11px] text-ink-3">{t('mode')}</span>
            </div>
            <div className="px-1">
              <b className="block text-sm">{memberSince}</b>
              <span className="block text-[11px] text-ink-3">{t('memberSince')}</span>
            </div>
            {subsOn && (
              <button onClick={() => nav('/subscription')} className="px-1">
                {sub.isLoading ? <Skeleton className="mx-auto h-5 w-14" /> : (
                  <b className={cn('block text-sm', subStatus === 'active' ? 'text-success' : 'text-ink')}>{subLabel(sub.data, t)}</b>
                )}
                <span className="block text-[11px] text-ink-3">{t('subscription')}</span>
              </button>
            )}
          </div>
        </Card>

        <Group title={t('accountGroup')}>
          <Row icon={UserPen} label={t('editProfile')} to="/profile/edit" />
          {switchRow && <Row icon={Repeat} label={switchRow.label} onClick={switchRow.run} disabled={updateMe.isPending} />}
          {hindiOn && <Row icon={Globe} label={t('language')} value={lang === 'en' ? 'English' : 'हिंदी'} onClick={() => setPicker('lang')} />}
          <Row icon={MoonStar} label={t('appearance')} value={mode === 'dark' ? t('dark') : t('light')} onClick={() => setPicker('theme')} />
          <Row icon={Bell} label={t('notificationSettings')} to="/settings/notifications" />
          <Row icon={UserX} label={t('blockedUsers')} to="/blocked" />
        </Group>

        {subsOn && (
          <Group title={t('subscription')}>
            <Row icon={Crown} label={t('mySubscription')} to="/subscription"
              value={sub.data?.status === 'active' && sub.data.endAt ? `${t('validTill')} ${date(sub.data.endAt)}` : subLabel(sub.data, t)} />
          </Group>
        )}

        <Group title={t('support')}>
          <Row icon={HelpCircle} label={complaintsOn ? t('helpComplaints') : t('helpFaqs')} to="/help" />
          {support.email && <Row icon={Mail} label={t('emailSupport')} value={support.email} href={`mailto:${support.email}`} />}
          {support.phone && <Row icon={Phone} label={t('callSupport')} value={support.phone} href={`tel:${support.phone.replace(/\s/g, '')}`} />}
        </Group>

        <Group title={t('legal')}>
          <Row icon={FileText} label={t('termsOfUse')} to="/legal/terms" />
          <Row icon={Shield} label={t('privacyPolicy')} to="/legal/privacy" />
          <Row icon={CreditCard} label={t('refundPolicy')} to="/legal/refund" />
          <Row icon={ShieldCheck} label={t('safetyGuidelines')} to="/legal/safety" />
        </Group>

        <div className="space-y-2">
          <Row icon={LogOut} label={t('logout')} onClick={() => setConfirm('logout')} right={<span />} />
          <Row icon={Trash2} label={t('deleteAccount')} onClick={() => setConfirm('delete')} right={<span />} />
        </div>
        <p className="pb-2 text-center text-xs text-ink-3">WorkNear v{support.version} · {t('tagline')}</p>
      </div>

      <OptionSheet open={picker === 'lang'} onClose={() => setPicker(null)} title={t('language')} value={lang} onPick={changeLang}
        options={[{ value: 'en', label: 'English', sub: 'English', icon: Globe }, { value: 'hi', label: 'हिंदी', sub: 'Hindi', icon: Globe }]} />
      <OptionSheet open={picker === 'theme'} onClose={() => setPicker(null)} title={t('appearance')} value={mode} onPick={changeTheme}
        options={[{ value: 'light', label: t('light'), sub: t('lightSub'), icon: Sun }, { value: 'dark', label: t('dark'), sub: t('darkSub'), icon: Moon }]} />

      <Sheet open={confirm === 'logout'} onClose={closeConfirm} title={t('logout')}>
        <p className="mb-5 text-ink-2">{t('logoutConfirm')}</p>
        <div className="flex gap-2">
          <Button variant="outline" block onClick={closeConfirm}>{t('cancel')}</Button>
          <Button block onClick={doLogout}>{t('logout')}</Button>
        </div>
      </Sheet>
      <Sheet open={confirm === 'delete'} onClose={closeConfirm} title={t('deleteAccount')}>
        <p className="mb-4 text-sm text-ink-2">{t('deleteExplain')}</p>
        <Input label={t('typeDelete')} value={typed} autoCapitalize="characters" autoComplete="off" onChange={(e) => setTyped(e.target.value)} placeholder="DELETE" />
        <div className="mt-5 flex gap-2">
          <Button variant="outline" block onClick={closeConfirm}>{t('cancel')}</Button>
          <Button block disabled={typed.trim() !== 'DELETE'} loading={delReq.isPending} onClick={doDelete}>{t('requestDeletion')}</Button>
        </div>
      </Sheet>
    </div>
  );
}

// ---------- Edit profile ----------
export function EditProfile() {
  const t = useT();
  const nav = useNavigate();
  const user = useAuth((s) => s.user);
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const m = useUpdateMe();
  const avatar = useUploadAvatar();
  const errs = fieldErrors(m.error);
  const emailOk = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const nameErr = nameError(name);
  const dirty = cleanName(name) !== (user?.name ?? '') || email.trim() !== (user?.email ?? '');
  const save = () =>
    m.mutate({ name: cleanName(name), email: email.trim() }, {
      onSuccess: () => { toast(t('profileUpdated')); if (history.length > 1) nav(-1); else nav('/account'); },
      onError: (e) => { if (!Object.keys(fieldErrors(e)).length) toastError(e); },
    });
  return (
    <div className="min-h-dvh bg-surface">
      <TopBar title={t('editProfile')} />
      <form onSubmit={(e) => { e.preventDefault(); if (dirty && emailOk && !nameErr) save(); }} className="space-y-4 p-4">
        <div className="flex flex-col items-center gap-1 py-2">
          <FilePicker onFiles={([f]) => avatar.mutate(f, { onSuccess: () => toast(t('photoUpdated')), onError: (e) => toastError(e) })}>
            {(open) => (
              <button type="button" onClick={open} className="relative" aria-label={t('changePhoto')}>
                <Avatar src={user?.avatar} name={name || 'U'} size={88} className={cn(avatar.isPending && 'opacity-50')} />
                <span className="absolute right-0 bottom-0 grid size-8 place-items-center rounded-full bg-primary text-on-primary ring-2 ring-surface"><Camera size={15} /></span>
              </button>
            )}
          </FilePicker>
          <span className="text-xs text-ink-3">{t('photoHint')}</span>
        </div>
        <Input label={t('yourName')} value={name} maxLength={80} autoComplete="name" onChange={(e) => setName(e.target.value)} error={errs.name ?? (nameErr ? t(nameErr) : undefined)} />
        <Input label={t('mobile')} value={`+91 ${user?.mobile ?? ''}`} disabled hint={t('mobileFixed')} />
        <Input label={`${t('email')} (${t('optional')})`} type="email" inputMode="email" autoComplete="email" maxLength={120} value={email}
          onChange={(e) => setEmail(e.target.value)} error={errs.email ?? (!emailOk ? t('invalidEmail') : undefined)} />
        {user?.roles.includes('worker') && (
          <p className="rounded-xl bg-surface-2 p-3 text-xs text-ink-2">
            {t('workerNameNote')} <Link to="/onboarding" className="font-semibold text-primary">{t('editWorkerProfile')}</Link>
          </p>
        )}
        <Button type="submit" block size="lg" disabled={!dirty || !emailOk || !!nameErr} loading={m.isPending}>{t('save')}</Button>
      </form>
    </div>
  );
}

// ---------- Notification settings ----------
/** Device-level push permission. Browser permission can only be requested from a user tap. */
function PushRow() {
  const t = useT();
  const [state, setState] = useState<PushState>(pushState);
  const enable = useEnablePush();
  const turnOn = () =>
    enable.mutate(true, {
      onSuccess: (token) => {
        setState(pushState());
        toast(token ? t('pushEnabled') : t('pushNotGranted'), token ? 'success' : 'error');
      },
      onError: () => toast(t('pushFailed'), 'error'),
    });
  const sub: Record<PushState, TKey> = { granted: 'pushOnDevice', default: 'pushDefault', denied: 'pushDenied', unsupported: 'pushUnsupported' };
  return (
    <div className="flex items-center gap-3 border-b border-line bg-primary-soft/40 px-4 py-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary"><BellRing size={20} /></span>
      <div className="min-w-0 flex-1"><b className="block">{t('pushNotifications')}</b><span className="text-sm text-ink-2">{t(sub[state])}</span></div>
      {state === 'granted' ? <Badge tone="success">{t('on')}</Badge> : state === 'default' ? <Button size="sm" loading={enable.isPending} onClick={turnOn}>{t('enable')}</Button> : null}
    </div>
  );
}

export function NotificationSettings() {
  const t = useT();
  const user = useAuth((s) => s.user);
  const updateUser = useAuth((s) => s.updateUser);
  const pushOn = useFeature('pushNotifications');
  const subsOn = useFeature('subscriptions');
  const m = useUpdateMe();
  const notif: NotifPrefs = user?.notif ?? { chat: true, subscription: true, offers: false };
  const rows: [keyof NotifPrefs, TKey, TKey][] = [
    ['chat', 'nChat', 'nChatSub'],
    ...(subsOn ? ([['subscription', 'subscription', 'nSubSub']] as [keyof NotifPrefs, TKey, TKey][]) : []),
    ['offers', 'nOffers', 'nOffersSub'],
  ];
  const change = (k: keyof NotifPrefs, v: boolean) => {
    const prev = notif;
    updateUser({ notif: { ...notif, [k]: v } }); // optimistic; server response replaces it
    m.mutate({ notif: { [k]: v } }, { onError: (e) => { updateUser({ notif: prev }); toastError(e); } });
  };
  return (
    <div className="min-h-dvh bg-surface">
      <TopBar title={t('notificationSettings')} />
      {pushOn && <PushRow />}
      <div className="divide-y divide-line">
        {rows.map(([k, a, b]) => (
          <div key={k} className="flex items-center gap-3 px-4 py-4">
            <div className="flex-1"><b className="block">{t(a)}</b><span className="text-sm text-ink-2">{t(b)}</span></div>
            <Toggle label={t(a)} checked={notif[k]} onChange={(v) => change(k, v)} />
          </div>
        ))}
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="flex-1"><b className="block">{t('nSecurity')}</b><span className="text-sm text-ink-2">{t('nSecuritySub')}</span></div>
          <Toggle label={t('nSecurity')} checked disabled onChange={() => undefined} />
        </div>
      </div>
    </div>
  );
}

// ---------- Blocked users ----------
export function BlockedUsers() {
  const t = useT();
  const { data, isLoading, isError, error, refetch } = useBlocked();
  const unblock = useUnblockUser();
  return (
    <div className="min-h-dvh bg-surface">
      <TopBar title={t('blockedUsers')} />
      {isLoading && <div className="space-y-2 p-4"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>}
      {isError && <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />}
      {data?.length === 0 && <EmptyState icon={<UserX size={32} />} title={t('noBlocked')} sub={t('noBlockedSub')} />}
      {data?.map((p) => (
        <div key={p.id} className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Avatar src={p.photo} name={p.name} />
          <div className="min-w-0 flex-1"><b className="block truncate">{p.name}</b><span className="text-sm text-ink-2">{p.subtitle}</span></div>
          <Button size="sm" variant="outline" loading={unblock.isPending && unblock.variables === p.id}
            onClick={() => unblock.mutate(p.id, { onSuccess: () => toast(`${p.name} ${t('unblockedToast')}`) })}>{t('unblock')}</Button>
        </div>
      ))}
    </div>
  );
}
