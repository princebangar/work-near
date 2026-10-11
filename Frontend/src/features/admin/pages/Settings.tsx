import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AppWindow, BadgeCheck, Bell, Clock, Crown, Flag, GalleryHorizontalEnd, Images, Info, Languages, LifeBuoy, Lock, MessageCircle,
  MessageSquareWarning, Paperclip, Phone, Radar, RotateCcw, Save, ShieldCheck, Star, Store, UserPlus, Users, Wrench, Zap, OctagonAlert,
  type LucideIcon,
} from 'lucide-react';
import { Skeleton } from '@/components/ui';
import { useAdminSettings, useToggleFeature, useUpdateSettings } from '@/api/admin';
import { useAuth } from '@/store';
import { cn, timeAgo } from '@/lib/format';
import type { AdminSettings, FeatureKey, Maintenance, Role } from '@/types/admin';
import { dateTime, human, isSuper } from '../lib';
import { Btn, ConfirmDialog, ErrorBlock, Field, MicroLabel, PageHeader, Pill, SelectField, Switch, TextAreaField, TextField } from '../components/kit';

// ---------- Feature catalogue (label, description, icon, grouping) ----------
interface FeatureMeta { key: FeatureKey; label: string; desc: string; icon: LucideIcon; needs?: FeatureKey }
interface FeatureGroup { title: string; icon: LucideIcon; tint: string; items: FeatureMeta[] }
const GROUPS: FeatureGroup[] = [
  {
    title: 'Monetization',
    icon: Crown,
    tint: 'bg-amber-500/12 text-amber-500',
    items: [{ key: 'subscriptions', label: 'Subscriptions', desc: 'Plans & payments. Off = plan screens disappear and nothing requires a subscription.', icon: Crown }],
  },
  {
    title: 'Communication',
    icon: MessageCircle,
    tint: 'bg-sky-500/12 text-sky-500',
    items: [
      { key: 'chat', label: 'Chat', desc: 'Customers can message workers directly in the app.', icon: MessageCircle },
      { key: 'chatAttachments', label: 'Chat photos', desc: 'Send images inside conversations.', icon: Paperclip, needs: 'chat' },
      { key: 'pushNotifications', label: 'Push notifications', desc: 'Device alerts for new messages and account updates.', icon: Bell },
      { key: 'phoneSharing', label: 'Phone sharing', desc: 'Workers may show their phone number on their profile (opt-in).', icon: Phone },
    ],
  },
  {
    title: 'Trust & safety',
    icon: ShieldCheck,
    tint: 'bg-emerald-500/12 text-emerald-500',
    items: [
      { key: 'reviews', label: 'Reviews', desc: 'Customers rate a worker after a real conversation.', icon: Star },
      { key: 'reports', label: 'Reports', desc: 'Report profiles, messages and reviews to the safety team.', icon: Flag },
      { key: 'complaints', label: 'Complaints', desc: 'Raise a complaint with evidence from Help.', icon: MessageSquareWarning },
      { key: 'verification', label: 'Verification', desc: 'Workers can apply for a phone / ID / address badge.', icon: BadgeCheck },
    ],
  },
  {
    title: 'Workers',
    icon: Wrench,
    tint: 'bg-violet-500/12 text-violet-500',
    items: [
      { key: 'workerRegistration', label: 'Worker registration', desc: 'New worker profiles can be created. Existing workers stay listed.', icon: UserPlus },
      { key: 'dualRole', label: 'Dual role', desc: 'One account can switch between customer and worker.', icon: Users },
      { key: 'portfolio', label: 'Portfolio', desc: 'Workers upload photos of their past work.', icon: Images },
    ],
  },
  {
    title: 'App',
    icon: AppWindow,
    tint: 'bg-indigo-500/12 text-indigo-500',
    items: [
      { key: 'hindi', label: 'Hindi', desc: 'Offer हिंदी as an app language.', icon: Languages },
      { key: 'banners', label: 'Home banners', desc: 'Promotional banners on the home screen (managed in CMS).', icon: GalleryHorizontalEnd },
    ],
  },
];

export function SettingsPage() {
  const q = useAdminSettings();
  return (
    <>
      <PageHeader
        eyebrow="System"
        title="Customization Settings"
        sub="Switch app features on or off and close the app for maintenance. Every change reaches all open apps instantly — no app update needed."
        actions={
          q.data?.updatedAt && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-2" title={dateTime(q.data.updatedAt)}>
              <Clock size={13} /> Last updated {timeAgo(q.data.updatedAt)}
            </span>
          )
        }
      />
      {q.isPending ? (
        <div className="space-y-5">
          <Skeleton className="h-80 rounded-3xl" />
          <div className="grid gap-4 lg:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}</div>
        </div>
      ) : q.isError ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <div className="space-y-6">
          <MaintenanceCard s={q.data} />
          <Features s={q.data} />
          <GeneralForm s={q.data} />
        </div>
      )}
    </>
  );
}

// ======================================================================
// Maintenance
// ======================================================================
function MaintenanceCard({ s }: { s: AdminSettings }) {
  const role = useAuth((x) => x.admin?.role);
  const canSwitch = isSuper(role);
  const on = s.maintenance.enabled;
  const update = useUpdateSettings('Maintenance message saved');
  const turnOn = useUpdateSettings('Maintenance ON — the app is closed for users');
  const turnOff = useUpdateSettings('Maintenance OFF — the app is open again');
  const [m, setM] = useState<Omit<Maintenance, 'enabled'>>({ title: s.maintenance.title, message: s.maintenance.message, eta: s.maintenance.eta });
  const [confirm, setConfirm] = useState<'on' | 'off' | null>(null);
  const dirty = m.title !== s.maintenance.title || m.message !== s.maintenance.message || m.eta !== s.maintenance.eta;

  // Keep the form in step with server changes made elsewhere when there are no local edits.
  const serverKey = `${s.maintenance.title}|${s.maintenance.message}|${s.maintenance.eta}`;
  useEffect(() => {
    if (!dirty) setM({ title: s.maintenance.title, message: s.maintenance.message, eta: s.maintenance.eta });
  }, [serverKey]);

  const texts = { title: m.title.trim(), message: m.message.trim(), eta: m.eta.trim() };

  return (
    <section className={cn('overflow-hidden rounded-3xl border bg-surface transition-colors', on ? 'border-danger/50 shadow-lg shadow-danger/10' : 'border-line')}>
      {on && (
        <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-danger px-5 py-3 text-white sm:px-6">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-60" />
            <span className="relative size-2.5 rounded-full bg-white" />
          </span>
          <b className="text-sm sm:text-[15px]">App is closed for users — admin keeps working.</b>
          <span className="text-xs text-white/80">Customers and workers see the maintenance screen right now.</span>
        </div>
      )}
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <div className="flex items-start gap-4">
            <span className={cn('grid size-12 shrink-0 place-items-center rounded-2xl', on ? 'bg-danger text-white' : 'bg-warning-soft text-warning')}>
              <Wrench size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-extrabold text-ink">Maintenance mode</h2>
              <p className="mt-1 text-sm text-ink-2">
                Closes every customer & worker app <b className="text-ink">instantly</b> (pushed live to all open apps) and shows the message below.
                The admin panel keeps working, and nobody's data is touched.
              </p>
            </div>
          </div>

          <div className={cn('mt-5 flex flex-wrap items-center gap-4 rounded-2xl border p-4', on ? 'border-danger/30 bg-danger-soft' : 'border-line bg-surface-2/60')}>
            <Switch
              size="lg"
              tone="danger"
              checked={on}
              disabled={!canSwitch || turnOn.isPending || turnOff.isPending}
              onChange={(v) => setConfirm(v ? 'on' : 'off')}
              label="Maintenance mode"
            />
            <div className="min-w-0 flex-1">
              <p className={cn('font-bold', on ? 'text-danger' : 'text-ink')}>{on ? 'Maintenance is ON' : 'App is open'}</p>
              <p className="text-xs text-ink-2">{on ? 'Switch off to reopen the app for everyone.' : 'Switch on before risky deploys or database work.'}</p>
            </div>
            {!canSwitch && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-ink-2 ring-1 ring-line">
                <Lock size={12} /> Only the super admin can switch this
              </span>
            )}
          </div>

          <form
            className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]"
            onSubmit={(e) => {
              e.preventDefault();
              if (dirty) update.mutate({ maintenance: texts });
            }}
          >
            <TextField label="Screen title" maxLength={80} value={m.title} onChange={(e) => setM({ ...m, title: e.target.value })} placeholder="We’ll be right back" />
            <TextField label="Expected back in" maxLength={60} value={m.eta} onChange={(e) => setM({ ...m, eta: e.target.value })} placeholder="e.g. 30 minutes" />
            <TextAreaField className="sm:col-span-2" label="Message" rows={3} maxLength={400} value={m.message} onChange={(e) => setM({ ...m, message: e.target.value })} hint={`${m.message.length}/400 · shown under the title`} />
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <Btn type="submit" tone="outline" icon={<Save size={15} />} loading={update.isPending} disabled={!dirty}>Save message</Btn>
              {dirty && <Btn tone="ghost" icon={<RotateCcw size={15} />} onClick={() => setM({ title: s.maintenance.title, message: s.maintenance.message, eta: s.maintenance.eta })}>Reset</Btn>}
              {dirty && on && <span className="text-xs text-warning">Users see the new message as soon as you save.</span>}
            </div>
          </form>
        </div>

        {/* Live preview of what users see */}
        <div>
          <MicroLabel className="mb-2">What users see</MicroLabel>
          <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded-[28px] border-4 border-surface-3 bg-surface shadow-xl shadow-black/10">
            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-500 px-5 pt-8 pb-12 text-white">
              <div className="absolute -top-10 -right-10 size-32 rounded-full bg-white/10" />
              <div className="relative mx-auto grid size-16 place-items-center rounded-2xl bg-white text-indigo-600 shadow-lg"><Wrench size={28} /></div>
            </div>
            <div className="-mt-5 rounded-t-3xl bg-surface px-5 pt-5 pb-6 text-center">
              <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-warning uppercase">Scheduled maintenance</span>
              <p className="mt-3 text-base leading-snug font-extrabold text-ink">{m.title || 'We’ll be right back'}</p>
              <p className="mt-1.5 line-clamp-4 text-xs text-ink-2">{m.message || 'Your message appears here.'}</p>
              {m.eta && <p className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-1.5 text-[11px] font-semibold text-ink"><Clock size={12} className="text-primary" />Expected back in {m.eta}</p>}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirm === 'on'}
        onClose={() => setConfirm(null)}
        icon={<span className="grid size-10 shrink-0 place-items-center rounded-xl bg-danger-soft text-danger"><OctagonAlert size={20} /></span>}
        title="Close the app for all users?"
        description="Every open customer and worker app switches to the maintenance screen immediately. Nobody can search, chat or pay until you switch it off. The admin panel keeps working."
        confirmLabel="Turn maintenance ON"
        tone="danger"
        loading={turnOn.isPending}
        onConfirm={() => turnOn.mutate({ maintenance: { enabled: true, ...texts } }, { onSuccess: () => setConfirm(null) })}
      />
      <ConfirmDialog
        open={confirm === 'off'}
        onClose={() => setConfirm(null)}
        title="Reopen the app?"
        description="The maintenance screen disappears from every open app right away."
        confirmLabel="Turn maintenance OFF"
        loading={turnOff.isPending}
        onConfirm={() => turnOff.mutate({ maintenance: { enabled: false } }, { onSuccess: () => setConfirm(null) })}
      />
    </section>
  );
}

// ======================================================================
// Feature toggles — one switch = one request, optimistic with rollback
// ======================================================================
function Features({ s }: { s: AdminSettings }) {
  const toggle = useToggleFeature();
  const known = new Set(GROUPS.flatMap((g) => g.items.map((i) => i.key)));
  const extra = (s.featureKeys ?? []).filter((k) => !known.has(k));
  const groups: FeatureGroup[] = extra.length
    ? [...GROUPS, { title: 'Other', icon: Zap, tint: 'bg-surface-2 text-ink-2', items: extra.map((k) => ({ key: k, label: human(k), desc: 'Feature switch', icon: Zap })) }]
    : GROUPS;
  const onCount = Object.values(s.features).filter(Boolean).length;
  const total = Object.keys(s.features).length;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-extrabold text-ink">Features</h2>
          <p className="text-sm text-ink-2">Each switch saves instantly. Turning a feature off hides it in the app and blocks its API.</p>
        </div>
        <Pill tone="primary" dot={false}>{onCount} of {total} on</Pill>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((g) => (
          <div key={g.title} className="rounded-2xl border border-line bg-surface">
            <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
              <span className={cn('grid size-8 place-items-center rounded-lg', g.tint)}><g.icon size={16} /></span>
              <h3 className="text-sm font-bold text-ink">{g.title}</h3>
              <span className="ml-auto text-xs text-ink-3">{g.items.filter((i) => s.features[i.key]).length}/{g.items.length} on</span>
            </div>
            <ul className="divide-y divide-line">
              {g.items.map((f) => {
                const on = !!s.features[f.key];
                const blocked = f.needs && !s.features[f.needs];
                return (
                  <li key={f.key} className="flex items-center gap-3.5 px-5 py-3.5">
                    <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl transition-colors', on && !blocked ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-ink-3')}>
                      <f.icon size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                        {f.label}
                        {blocked && on && <span className="text-[11px] font-semibold text-warning">needs {human(f.needs!)}</span>}
                      </p>
                      <p className="text-xs text-ink-3">{f.desc}</p>
                    </div>
                    <Switch checked={on} label={f.label} onChange={(v) => toggle.mutate({ key: f.key, on: v })} />
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// ======================================================================
// General form (single Save)
// ======================================================================
const RADII = [5, 10, 15] as const;
interface General { subscriptionRequiredFor: Role[]; radiusOptions: number[]; defaultRadiusKm: number; supportEmail: string; supportPhone: string; appVersion: string }
const pickGeneral = (s: AdminSettings): General => ({
  subscriptionRequiredFor: [...s.subscriptionRequiredFor].sort(),
  radiusOptions: [...s.radiusOptions].sort((a, b) => a - b),
  defaultRadiusKm: s.defaultRadiusKm,
  supportEmail: s.supportEmail ?? '',
  supportPhone: s.supportPhone ?? '',
  appVersion: s.appVersion ?? '',
});

function GeneralForm({ s }: { s: AdminSettings }) {
  const server = useMemo(() => pickGeneral(s), [s]);
  const [f, setF] = useState<General>(server);
  const [err, setErr] = useState<string | null>(null);
  const save = useUpdateSettings('Settings saved');
  const dirty = JSON.stringify(f) !== JSON.stringify(server);
  const subsOn = !!s.features.subscriptions;

  const serverKey = JSON.stringify(server);
  useEffect(() => {
    if (!dirty) setF(server);
  }, [serverKey]);

  const toggleRole = (r: Role) =>
    setF((p) => ({ ...p, subscriptionRequiredFor: (p.subscriptionRequiredFor.includes(r) ? p.subscriptionRequiredFor.filter((x) => x !== r) : [...p.subscriptionRequiredFor, r]).sort() }));
  const toggleRadius = (r: number) =>
    setF((p) => {
      const radiusOptions = (p.radiusOptions.includes(r) ? p.radiusOptions.filter((x) => x !== r) : [...p.radiusOptions, r]).sort((a, b) => a - b);
      return { ...p, radiusOptions, defaultRadiusKm: radiusOptions.includes(p.defaultRadiusKm) ? p.defaultRadiusKm : radiusOptions[0] ?? p.defaultRadiusKm };
    });

  const submit = () => {
    if (!f.radiusOptions.length) return setErr('Keep at least one search radius');
    if (!f.radiusOptions.includes(f.defaultRadiusKm)) return setErr('Default radius must be one of the offered options');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.supportEmail.trim())) return setErr('Enter a valid support email');
    setErr(null);
    save.mutate({
      ...(subsOn && { subscriptionRequiredFor: f.subscriptionRequiredFor }),
      radiusOptions: f.radiusOptions,
      defaultRadiusKm: f.defaultRadiusKm,
      supportEmail: f.supportEmail.trim(),
      supportPhone: f.supportPhone.trim(),
      appVersion: f.appVersion.trim(),
    });
  };

  const roleBox = (r: Role, title: string, desc: ReactNode) => {
    const on = f.subscriptionRequiredFor.includes(r);
    return (
      <label key={r} className={cn('flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition', on && subsOn ? 'border-primary bg-primary-soft/50' : 'border-line', !subsOn && 'cursor-not-allowed opacity-55')}>
        <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" checked={on} disabled={!subsOn} onChange={() => toggleRole(r)} />
        <span>
          <span className="block text-sm font-semibold text-ink">{title}</span>
          <span className="block text-xs text-ink-2">{desc}</span>
        </span>
      </label>
    );
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="rounded-2xl border border-line bg-surface"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-lg font-extrabold text-ink">Rules & app info</h2>
          <p className="text-sm text-ink-2">Saved together with the button below.</p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <Btn tone="ghost" icon={<RotateCcw size={15} />} onClick={() => { setF(server); setErr(null); }}>Discard</Btn>}
          <Btn type="submit" tone="primary" icon={<Save size={15} />} loading={save.isPending} disabled={!dirty}>Save changes</Btn>
        </div>
      </div>

      <div className="grid gap-8 p-5 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Crown size={16} className="text-accent" />
            <MicroLabel>Subscription required for</MicroLabel>
          </div>
          {!subsOn && (
            <p className="flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning">
              <Info size={14} className="mt-0.5 shrink-0" /> Subscriptions are switched off above, so nobody needs a plan. Turn them on to edit this.
            </p>
          )}
          {roleBox('customer', 'Customers', 'Need an active plan to start a new chat with a worker.')}
          {roleBox('worker', 'Workers', <>Only workers with an active plan <b>appear in search</b>.</>)}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Radar size={16} className="text-primary" />
            <MicroLabel>Search radius</MicroLabel>
          </div>
          <Field label="Distances customers can choose" hint="Straight-line distance from the selected location.">
            <div role="group" aria-label="Radius options" className="flex gap-2">
              {RADII.map((r) => {
                const on = f.radiusOptions.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleRadius(r)}
                    className={cn('h-11 flex-1 rounded-xl border text-sm font-bold transition', on ? 'border-primary bg-primary text-on-primary' : 'border-line bg-surface text-ink-2 hover:bg-surface-2')}
                  >
                    {r} KM
                  </button>
                );
              })}
            </div>
          </Field>
          <SelectField
            label="Default radius"
            value={String(f.defaultRadiusKm)}
            onChange={(e) => setF({ ...f, defaultRadiusKm: Number(e.target.value) })}
            options={f.radiusOptions.map((r) => ({ value: String(r), label: `${r} KM` }))}
          />
        </div>

        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center gap-2">
            <LifeBuoy size={16} className="text-success" />
            <MicroLabel>Support & version</MicroLabel>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="Support email" type="email" value={f.supportEmail} onChange={(e) => setF({ ...f, supportEmail: e.target.value })} placeholder="support@worknear.in" />
            <TextField label="Support phone" type="tel" maxLength={20} value={f.supportPhone} onChange={(e) => setF({ ...f, supportPhone: e.target.value })} placeholder="+91 …" />
            <TextField label="App version" maxLength={20} value={f.appVersion} onChange={(e) => setF({ ...f, appVersion: e.target.value })} placeholder="1.0.0" left={<Store size={15} />} />
          </div>
        </div>
      </div>
      {err && <p role="alert" className="px-5 pb-4 text-sm text-danger">{err}</p>}
    </form>
  );
}
