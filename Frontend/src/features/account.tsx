import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  Bell, Check, ChevronRight, CreditCard, FileText, Globe, HelpCircle, LogOut, Repeat, Shield, ShieldCheck, Trash2, UserX, Crown, Mail, MessageSquareWarning, ChevronDown,
} from 'lucide-react';
import { Avatar, Badge, Button, Card, Chip, EmptyState, Input, Sheet, Skeleton, Textarea, Toggle, TopBar, type Tone } from '@/components/ui';
import { useBlocked, useCheckout, useCreateComplaint, useFaqs, useMyComplaints, useMySubscription, usePlans, useUpdateConversation, useConversations, useUpdateMe } from '@/api';
import { useAuth, usePrefs, toast } from '@/store';
import { useT } from '@/i18n';
import { APP } from '@/config/env';
import { cn, date, inr } from '@/lib/format';
import { queryClient } from '@/lib/http';
import type { ComplaintStatus, Complaint } from '@/types';

const Row = ({ icon, label, onClick, right, danger }: { icon: ReactNode; label: string; onClick?: () => void; right?: ReactNode; danger?: boolean }) => (
  <button onClick={onClick} className={cn('flex w-full items-center gap-3 px-4 py-3.5 text-left', danger && 'text-danger')}>
    <span className={cn('grid size-9 place-items-center rounded-xl', danger ? 'bg-danger-soft' : 'bg-surface-2 text-ink-2')}>{icon}</span>
    <span className="flex-1 font-medium">{label}</span>
    {right ?? <ChevronRight size={18} className="text-ink-3" />}
  </button>
);

export function Account() {
  const t = useT();
  const nav = useNavigate();
  const { user, switchRole, logout } = useAuth();
  const { lang, setLang } = usePrefs();
  const sub = useMySubscription();
  const [confirm, setConfirm] = useState<'logout' | 'delete' | null>(null);
  const isWorker = user?.activeRole === 'worker';
  const doLogout = () => { logout(); queryClient.clear(); nav('/login', { replace: true }); };
  return (
    <div>
      <TopBar back={false} title={t('account')} />
      <div className="space-y-4 p-4">
        <Card className="flex items-center gap-3 p-4">
          <Avatar name={user?.name ?? ''} size={60} />
          <div className="min-w-0 flex-1">
            <b className="block truncate text-lg">{user?.name}</b>
            <span className="text-sm text-ink-2">+91 {user?.mobile}</span>
            <div className="mt-1"><Badge tone="primary">{isWorker ? 'Worker' : 'Customer'}</Badge></div>
          </div>
          <Button size="sm" variant="soft" onClick={() => nav('/profile/edit')}>{t('editProfile')}</Button>
        </Card>

        <Card onClick={() => nav('/subscription')} className="flex items-center gap-3 overflow-hidden bg-gradient-to-r from-amber-50 to-orange-50 p-4">
          <span className="grid size-11 place-items-center rounded-xl bg-accent text-white"><Crown /></span>
          <div className="flex-1">
            <b>{t('subscription')}</b>
            <p className="text-sm text-ink-2">{sub.data?.status === 'active' ? `Active · ${t('validTill')} ${date(sub.data.endAt!)}` : '₹30/month · ₹300/year'}</p>
          </div>
          <ChevronRight className="text-ink-3" />
        </Card>

        <Card className="divide-y divide-line overflow-hidden">
          <Row icon={<Repeat size={18} />} label={isWorker ? t('switchToCustomer') : user?.roles.includes('worker') ? t('switchToWorker') : t('becomeWorker')}
            onClick={() => { if (isWorker) switchRole('customer'); else if (user?.roles.includes('worker')) switchRole('worker'); else return nav('/onboarding'); nav('/'); }} />
          <Row icon={<Globe size={18} />} label={t('language')} onClick={() => setLang(lang === 'en' ? 'hi' : 'en')} right={<Badge tone="primary">{lang === 'en' ? 'English' : 'हिंदी'}</Badge>} />
          <Row icon={<Bell size={18} />} label={t('notificationSettings')} onClick={() => nav('/settings/notifications')} />
          <Row icon={<UserX size={18} />} label={t('blockedUsers')} onClick={() => nav('/blocked')} />
        </Card>
        <Card className="divide-y divide-line overflow-hidden">
          <Row icon={<HelpCircle size={18} />} label={t('helpSupport')} onClick={() => nav('/help')} />
          <Row icon={<FileText size={18} />} label="Terms of Use" onClick={() => nav('/legal/terms')} />
          <Row icon={<Shield size={18} />} label="Privacy Policy" onClick={() => nav('/legal/privacy')} />
          <Row icon={<CreditCard size={18} />} label="Subscription & Refund Policy" onClick={() => nav('/legal/refund')} />
          <Row icon={<ShieldCheck size={18} />} label="Community & Safety Guidelines" onClick={() => nav('/legal/safety')} />
        </Card>
        <Card className="divide-y divide-line overflow-hidden">
          <Row icon={<LogOut size={18} />} label={t('logout')} onClick={() => setConfirm('logout')} right={<span />} danger />
          <Row icon={<Trash2 size={18} />} label={t('deleteAccount')} onClick={() => setConfirm('delete')} right={<span />} danger />
        </Card>
        <p className="text-center text-xs text-ink-3">WorkNear v0.1.0 · {t('tagline')}</p>
      </div>
      <Sheet open={!!confirm} onClose={() => setConfirm(null)} title={confirm === 'delete' ? t('deleteAccount') : t('logout')}>
        <p className="mb-5 text-ink-2">
          {confirm === 'delete' ? 'Your deletion request will be processed within 30 days as per our Privacy Policy. Chats and profile will be removed.' : 'Are you sure you want to logout?'}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" block onClick={() => setConfirm(null)}>{t('cancel')}</Button>
          <Button variant="danger" block onClick={() => { if (confirm === 'delete') toast('Deletion request submitted', 'info'); doLogout(); }}>{confirm === 'delete' ? 'Request deletion' : t('logout')}</Button>
        </div>
      </Sheet>
    </div>
  );
}

export function SubscriptionPage() {
  const t = useT();
  const plans = usePlans();
  const sub = useMySubscription();
  const checkout = useCheckout();
  const [sel, setSel] = useState('yearly');
  const [done, setDone] = useState(false);
  const plan = plans.data?.find((p) => p.id === sel);
  const active = sub.data?.status === 'active';
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <TopBar title={t('subscription')} />
      <div className="flex-1 space-y-4 p-4">
        {active && (
          <Card className="border-success/30 bg-success-soft p-4">
            <Badge tone="success">Active</Badge>
            <b className="mt-2 block text-lg capitalize">{t('currentPlan')}: {sub.data!.planId}</b>
            <p className="text-sm text-ink-2">{date(sub.data!.startAt!)} → {date(sub.data!.endAt!)} · Manual renewal</p>
          </Card>
        )}
        <div className="text-center">
          <Crown className="mx-auto mb-2 text-accent" size={36} />
          <h2 className="text-xl font-extrabold">{t('choosePlan')}</h2>
          <p className="text-sm text-ink-2">Subscription is separate from job payments. Zero commission on work.</p>
        </div>
        {plans.isLoading && <Skeleton className="h-40" />}
        {plans.data?.map((p) => (
          <button key={p.id} onClick={() => setSel(p.id)} className={cn('relative w-full rounded-card border-2 p-4 text-left transition', sel === p.id ? 'border-primary bg-primary-soft' : 'border-line')}>
            {p.badge && <Badge tone="success" className="absolute top-4 right-4">{p.badge}</Badge>}
            <span className="text-sm font-semibold text-ink-2">{p.name}</span>
            <div className="text-3xl font-extrabold">{inr(p.price)}<span className="text-base font-medium text-ink-2">{p.period === 'month' ? t('perMonth') : t('perYear')}</span></div>
            <ul className="mt-3 space-y-1.5">
              {p.features.map((f) => <li key={f} className="flex items-center gap-2 text-sm"><Check size={16} className="text-success" />{f}</li>)}
            </ul>
          </button>
        ))}
        <p className="text-center text-xs text-ink-3">{t('inclTax')} See <Link to="/legal/refund" className="text-primary underline">refund policy</Link>.</p>
      </div>
      <div className="pb-safe border-t border-line p-3">
        <Button size="lg" block disabled={!plan} loading={checkout.isPending} onClick={() => plan && checkout.mutate(plan.id, { onSuccess: () => setDone(true) })}>
          {t('payNow')} {plan && inr(plan.price)}
        </Button>
      </div>
      <Sheet open={done} onClose={() => setDone(false)} title="Payment successful">
        <div className="py-4 text-center">
          <span className="mx-auto mb-3 grid size-16 place-items-center rounded-full bg-success-soft text-success"><Check size={32} /></span>
          <b className="text-lg">Your {plan?.name} plan is active</b>
          <p className="mt-1 text-sm text-ink-2">Receipt sent to your registered number. Valid till {sub.data?.endAt && date(sub.data.endAt)}.</p>
        </div>
        <Button block onClick={() => setDone(false)}>Done</Button>
      </Sheet>
    </div>
  );
}

export function EditProfile() {
  const t = useT();
  const nav = useNavigate();
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const m = useUpdateMe();
  return (
    <div className="min-h-dvh bg-surface">
      <TopBar title={t('editProfile')} />
      <div className="space-y-4 p-4">
        <div className="flex justify-center py-2"><Avatar name={name || 'U'} size={88} /></div>
        <Input label={t('yourName')} value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Mobile" value={`+91 ${user?.mobile}`} disabled />
        <Input label="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button block size="lg" loading={m.isPending} onClick={() => m.mutate({ name, email }, { onSuccess: () => { updateUser({ name, email }); toast('Profile updated'); nav(-1); } })}>{t('save')}</Button>
      </div>
    </div>
  );
}

export function NotificationSettings() {
  const t = useT();
  const { notif, setNotif } = usePrefs();
  const rows: [keyof typeof notif, string, string][] = [
    ['chat', 'Chat messages', 'New messages from customers / workers'],
    ['subscription', 'Subscription', 'Expiry and renewal reminders'],
    ['offers', 'Offers & updates', 'News and promotions'],
  ];
  return (
    <div className="min-h-dvh bg-surface">
      <TopBar title={t('notificationSettings')} />
      <div className="divide-y divide-line">
        {rows.map(([k, a, b]) => (
          <div key={k} className="flex items-center gap-3 px-4 py-4">
            <div className="flex-1"><b className="block">{a}</b><span className="text-sm text-ink-2">{b}</span></div>
            <Toggle checked={notif[k]} onChange={(v) => setNotif(k, v)} />
          </div>
        ))}
        <div className="flex items-center gap-3 px-4 py-4 opacity-60">
          <div className="flex-1"><b className="block">Security alerts</b><span className="text-sm text-ink-2">Login & account security (mandatory)</span></div>
          <Toggle checked onChange={() => {}} />
        </div>
      </div>
    </div>
  );
}

export function BlockedUsers() {
  const t = useT();
  const { data, isLoading } = useBlocked();
  const convs = useConversations();
  const upd = useUpdateConversation();
  return (
    <div className="min-h-dvh bg-surface">
      <TopBar title={t('blockedUsers')} />
      {isLoading && <Skeleton className="m-4 h-16" />}
      {data?.length === 0 && <EmptyState icon={<UserX size={32} />} title="No blocked users" sub="People you block will appear here." />}
      {data?.map((p) => (
        <div key={p.id} className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Avatar src={p.photo} name={p.name} />
          <div className="flex-1"><b className="block">{p.name}</b><span className="text-sm text-ink-2">{p.subtitle}</span></div>
          <Button size="sm" variant="outline" onClick={() => { const c = convs.data?.find((x) => x.peer.id === p.id); if (c) upd.mutate({ id: c.id, blocked: false }); }}>{t('unblock')}</Button>
        </div>
      ))}
    </div>
  );
}

const statusTone: Record<ComplaintStatus, Tone> = { open: 'warning', in_progress: 'primary', resolved: 'success', escalated: 'danger' };
export const ComplaintStatusBadge = ({ s }: { s: ComplaintStatus }) => <Badge tone={statusTone[s]}>{s.replace('_', ' ')}</Badge>;

export function Help() {
  const t = useT();
  const nav = useNavigate();
  const faqs = useFaqs();
  const complaints = useMyComplaints();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="min-h-dvh">
      <TopBar title={t('helpSupport')} />
      <div className="space-y-5 p-4">
        <div className="grid grid-cols-2 gap-3">
          <Card onClick={() => nav('/help/complaint')} className="p-4"><MessageSquareWarning className="mb-2 text-danger" /><b className="text-sm">{t('raiseComplaint')}</b></Card>
          <Card onClick={() => (location.href = `mailto:${APP.supportEmail}`)} className="p-4"><Mail className="mb-2 text-primary" /><b className="text-sm">{t('contactUs')}</b></Card>
        </div>
        <section>
          <h2 className="mb-2 font-bold">{t('myComplaints')}</h2>
          <Card className="divide-y divide-line">
            {complaints.data?.map((c: Complaint) => (
              <div key={c.id} className="p-3.5">
                <div className="flex items-center justify-between"><b className="text-sm">#{c.id} · {c.category}</b><ComplaintStatusBadge s={c.status} /></div>
                <p className="mt-1 text-sm text-ink-2">{c.description}</p>
                {c.resolution && <p className="mt-1 text-xs text-success">Resolution: {c.resolution}</p>}
                <span className="text-xs text-ink-3">{date(c.createdAt)}</span>
              </div>
            ))}
          </Card>
        </section>
        <section>
          <h2 className="mb-2 font-bold">{t('faqs')}</h2>
          <Card className="divide-y divide-line">
            {faqs.data?.map((f) => (
              <button key={f.id} onClick={() => setOpen(open === f.id ? null : f.id)} className="block w-full p-3.5 text-left">
                <span className="flex items-center gap-2"><b className="flex-1 text-sm">{f.q}</b><ChevronDown size={18} className={cn('text-ink-3 transition', open === f.id && 'rotate-180')} /></span>
                {open === f.id && <p className="mt-2 text-sm text-ink-2">{f.a}</p>}
              </button>
            ))}
          </Card>
        </section>
        <p className="text-center text-xs text-ink-3">Urgent safety issue? Email {APP.supportEmail} with subject "URGENT".</p>
      </div>
    </div>
  );
}

const CATS = ['Fake profile', 'Fraud', 'Abusive behaviour', 'Payment / subscription', 'App issue', 'Other'];
export function ComplaintForm() {
  const t = useT();
  const nav = useNavigate();
  const [category, setCat] = useState('');
  const [description, setDesc] = useState('');
  const m = useCreateComplaint();
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <TopBar title={t('raiseComplaint')} />
      <div className="flex-1 space-y-4 p-4">
        <p className="text-sm font-medium text-ink-2">Category</p>
        <div className="flex flex-wrap gap-2">{CATS.map((c) => <Chip key={c} active={category === c} onClick={() => setCat(c)}>{c}</Chip>)}</div>
        <Textarea label="Describe the issue" value={description} onChange={(e) => setDesc(e.target.value)} />
        <button className="w-full rounded-2xl border-2 border-dashed border-line py-4 text-sm text-ink-2">+ Attach evidence (optional)</button>
      </div>
      <div className="pb-safe border-t border-line p-3">
        <Button size="lg" block disabled={!category || description.length < 10} loading={m.isPending}
          onClick={() => m.mutate({ category, description, targetType: 'other' }, { onSuccess: (c) => { toast(`Complaint #${c.id} submitted`); nav(-1); } })}>{t('submit')}</Button>
      </div>
    </div>
  );
}

const LEGAL: Record<string, { title: string; body: string[] }> = {
  terms: { title: 'Terms of Use', body: ['WorkNear is a discovery and communication platform connecting customers with local service providers.', 'WorkNear does not guarantee work quality, worker availability, payment or outcomes.', 'Users must provide accurate information and must not misuse the platform for fraud, spam or abuse.', 'Zero Commission: WorkNear does not charge commission on the value of work. Payment for work is made directly between customer and worker.'] },
  privacy: { title: 'Privacy Policy', body: ['We collect only data necessary to provide the service: mobile number, profile details and approximate location.', 'Location is used only to show nearby workers and is not continuously tracked.', 'Identity documents are stored in private encrypted storage and accessed only by authorised verification staff. Every access is logged.', 'You can request data export or account deletion from Account → Delete account.'] },
  refund: { title: 'Subscription & Refund Policy', body: ['Plans: ₹30/month and ₹300/year, inclusive of applicable taxes.', 'Renewal is manual. No automatic debit without explicit consent.', 'A plan is activated only after server-verified payment success.', 'Refund eligibility and timelines will be published here before payment launch.'] },
  safety: { title: 'Community & Safety Guidelines', body: ['Be respectful in chats. Abuse, harassment and spam lead to suspension.', 'Never share OTPs or pay large advances before work starts.', 'Phone number sharing is optional and controlled by you.', 'Report suspicious profiles or messages using the Report option.'] },
};
export function Legal() {
  const { slug = 'terms' } = useParams();
  const doc = LEGAL[slug] ?? LEGAL.terms;
  return (
    <div className="min-h-dvh bg-surface">
      <TopBar title={doc.title} />
      <article className="space-y-3 p-5 text-[15px] leading-relaxed text-ink-2">
        <p className="text-xs text-ink-3">Last updated: 01 Oct 2026 · Draft — subject to legal review</p>
        {doc.body.map((p, i) => <p key={i}><b className="text-ink">{i + 1}.</b> {p}</p>)}
      </article>
    </div>
  );
}

