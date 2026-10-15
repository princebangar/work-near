import { useState } from 'react';
import { Check, Copy, KeyRound, ListChecks, Lock, Plus, RefreshCw, ShieldCheck, ShieldOff, UserCog, UserMinus, UserPlus } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { useAdminStaff, useCreateStaff, useUpdateStaff } from '@/api/admin';
import { toast, useAuth } from '@/store';
import { timeAgo } from '@/lib/format';
import type { AdminPermissions, AdminRole, AdminStaff, StaffInput } from '@/types/admin';
import { ACTIONS, MODULES, copyText, dateTime, isSuper, randomPassword, roleLabel, toneOf } from '../lib';
import { Btn, ConfirmDialog, DataTable, Drawer, EmptyBlock, ErrorBlock, IconBtn, PageHeader, Pill, SelectField, TextField, type Column } from '../components/kit';

const ROLES: { value: AdminRole; label: string; desc: string }[] = [
  { value: 'super_admin', label: 'Super admin', desc: 'Everything, including maintenance mode, refunds, plan creation and staff.' },
  { value: 'admin', label: 'Admin', desc: 'Day-to-day operations: users, verifications, catalog, billing (no refunds), content and feature switches.' },
  { value: 'support', label: 'Support', desc: 'Only complaints assigned to them — can warn and restrict, but not suspend or reassign.' },
  { value: 'sub_admin', label: 'Sub-admin', desc: 'Only the modules you tick — View / Create / Edit / Delete per module. Never staff, refunds or maintenance.' },
];

type Pending = { s: AdminStaff; kind: 'role'; role: AdminRole } | { s: AdminStaff; kind: 'status' } | { s: AdminStaff; kind: 'mfa' } | { s: AdminStaff; kind: 'perms' } | null;

export function StaffPage() {
  const me = useAuth((s) => s.admin);
  const sup = isSuper(me?.role);
  const staff = useAdminStaff();
  const update = useUpdateStaff();
  const [pending, setPending] = useState<Pending>(null);
  const [adding, setAdding] = useState(false);
  const close = () => setPending(null);

  const columns: Column<AdminStaff>[] = [
    {
      key: 'member',
      header: 'Member',
      mobile: 'title',
      cell: (s) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={s.name} size={36} />
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate font-semibold text-ink">
              {s.name}
              {s.id === me?.id && <span className="rounded-md bg-primary-soft px-1.5 text-[10px] font-bold text-primary uppercase">You</span>}
            </p>
            <p className="truncate text-xs text-ink-3">{s.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      cell: (s) =>
        sup && s.id !== me?.id ? (
          <SelectField
            aria-label={`Role for ${s.name}`}
            value={s.role}
            className="w-40"
            // Becoming a sub-admin needs a permission set first → open the matrix instead of a plain confirm.
            onChange={(e) => (e.target.value === 'sub_admin' ? setPending({ s: { ...s, role: 'sub_admin' }, kind: 'perms' }) : setPending({ s, kind: 'role', role: e.target.value as AdminRole }))}
            options={ROLES.map((r) => ({ value: r.value, label: r.label }))}
          />
        ) : (
          <Pill tone={s.role === 'super_admin' ? 'primary' : 'neutral'} dot={false}>{roleLabel(s.role)}</Pill>
        ),
    },
    { key: 'status', header: 'Status', cell: (s) => <Pill tone={toneOf('staff', s.status)}>{s.status === 'active' ? 'Active' : 'Disabled'}</Pill> },
    {
      key: 'mfa',
      header: 'MFA',
      cell: (s) => (s.mfa ? <Pill tone="success" dot={false}><ShieldCheck size={12} /> On</Pill> : <Pill tone="warning" dot={false}><ShieldOff size={12} /> Off</Pill>),
    },
    { key: 'login', header: 'Last login', cell: (s) => <span className="whitespace-nowrap text-ink-2" title={s.lastLoginAt ? dateTime(s.lastLoginAt) : undefined}>{s.lastLoginAt ? timeAgo(s.lastLoginAt) : 'Never'}</span> },
    ...(sup
      ? [{
        key: 'actions',
        header: <span className="sr-only">Actions</span>,
        align: 'right' as const,
        cell: (s: AdminStaff) =>
          s.id === me?.id ? (
            <span className="text-xs text-ink-3">—</span>
          ) : (
            <div className="flex justify-end gap-1">
              {s.role === 'sub_admin' && <Btn size="sm" icon={<ListChecks size={14} />} onClick={() => setPending({ s, kind: 'perms' })}>Permissions</Btn>}
              {s.mfa && <IconBtn label={`Reset MFA for ${s.name}`} onClick={() => setPending({ s, kind: 'mfa' })}><KeyRound size={16} /></IconBtn>}
              <Btn size="sm" tone={s.status === 'active' ? 'dangerGhost' : 'successGhost'} icon={s.status === 'active' ? <UserMinus size={14} /> : <UserPlus size={14} />} onClick={() => setPending({ s, kind: 'status' })}>
                {s.status === 'active' ? 'Disable' : 'Enable'}
              </Btn>
            </div>
          ),
      }]
      : []),
  ];

  return (
    <>
      <PageHeader
        eyebrow="System"
        title="Roles & staff"
        sub={sup ? 'Invite teammates and decide what they can do. Role and status changes apply on their next request.' : 'Your team. Only the super admin can add staff or change roles.'}
        actions={sup && <Btn tone="primary" icon={<Plus size={16} />} onClick={() => setAdding(true)}>Add staff</Btn>}
      />

      <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {ROLES.map((r) => (
          <div key={r.value} className="rounded-2xl border border-line bg-surface p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-ink">
              <UserCog size={16} className="text-primary" />
              {r.label}
              <span className="ml-auto text-xs font-semibold text-ink-3">{staff.data?.filter((s) => s.role === r.value && s.status === 'active').length ?? '–'} active</span>
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-2">{r.desc}</p>
          </div>
        ))}
      </div>

      {!sup && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-4 py-2.5 text-sm text-ink-2">
          <Lock size={15} /> Read-only — ask the super admin to change staff.
        </p>
      )}

      {staff.isError ? (
        <ErrorBlock error={staff.error} onRetry={() => staff.refetch()} />
      ) : (
        <DataTable rows={staff.data ?? []} columns={columns} rowKey={(s) => s.id} loading={staff.isPending} empty={<EmptyBlock icon={<UserCog size={26} />} title="No staff yet" />} />
      )}

      {adding && <AddStaffDrawer onClose={() => setAdding(false)} />}
      {pending?.kind === 'perms' && <PermissionsDrawer staff={pending.s} onClose={close} />}

      <ConfirmDialog
        open={pending?.kind === 'role'}
        onClose={close}
        title="Change role?"
        description={pending?.kind === 'role' && <><b className="text-ink">{pending.s.name}</b> goes from {roleLabel(pending.s.role)} to <b className="text-ink">{roleLabel(pending.role)}</b>. They may need to sign in again for the new menu.</>}
        confirmLabel="Change role"
        loading={update.isPending}
        onConfirm={() => pending?.kind === 'role' && update.mutate({ id: pending.s.id, patch: { role: pending.role } }, { onSuccess: close })}
      />
      <ConfirmDialog
        open={pending?.kind === 'status'}
        onClose={close}
        title={pending?.s.status === 'active' ? `Disable ${pending.s.name}?` : `Enable ${pending?.s.name}?`}
        description={pending?.s.status === 'active' ? 'They can no longer sign in to the admin panel.' : 'They can sign in again with their existing password.'}
        confirmLabel={pending?.s.status === 'active' ? 'Disable' : 'Enable'}
        tone={pending?.s.status === 'active' ? 'danger' : 'primary'}
        loading={update.isPending}
        onConfirm={() => pending && update.mutate({ id: pending.s.id, patch: { status: pending.s.status === 'active' ? 'disabled' : 'active' } }, { onSuccess: close })}
      />
      <ConfirmDialog
        open={pending?.kind === 'mfa'}
        onClose={close}
        title={`Reset MFA for ${pending?.s.name}?`}
        description="Their authenticator is unlinked. They sign in with email + password and should set up MFA again from My account."
        confirmLabel="Reset MFA"
        tone="danger"
        loading={update.isPending}
        onConfirm={() => pending && update.mutate({ id: pending.s.id, patch: { resetMfa: true } }, { onSuccess: close })}
      />
    </>
  );
}

function AddStaffDrawer({ onClose }: { onClose: () => void }) {
  const create = useCreateStaff();
  const [f, setF] = useState<StaffInput>(() => ({ name: '', email: '', password: randomPassword(), role: 'support', permissions: {} }));
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<StaffInput | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = () => {
    if (f.name.trim().length < 2) return setErr('Name must be at least 2 characters');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return setErr('Enter a valid email');
    if (f.password.length < 8) return setErr('Temporary password must be at least 8 characters');
    if (f.role === 'sub_admin' && !Object.keys(f.permissions ?? {}).length) return setErr('Tick at least one permission for the sub-admin');
    setErr(null);
    const body = { ...f, name: f.name.trim(), email: f.email.trim().toLowerCase(), permissions: f.role === 'sub_admin' ? f.permissions : undefined };
    create.mutate(body, { onSuccess: () => setCreated(body) });
  };
  const copyCreds = async () => {
    if (!created) return;
    const ok = await copyText(`WorkNear admin panel\n${location.origin}/admin/login\nEmail: ${created.email}\nTemporary password: ${created.password}`);
    setCopied(ok);
    toast(ok ? 'Credentials copied' : 'Copy failed — select the text instead', ok ? 'success' : 'error');
  };

  return (
    <Drawer
      open
      onClose={onClose}
      wide={!created && f.role === 'sub_admin'}
      title={created ? 'Staff member added' : 'Add staff'}
      sub={created ? 'Share these details privately — the password is shown only once.' : 'They sign in at /admin/login and should change the password and set up MFA.'}
      footer={
        created ? (
          <Btn tone="primary" onClick={onClose}>Done</Btn>
        ) : (
          <>
            <Btn tone="ghost" onClick={onClose}>Cancel</Btn>
            <Btn tone="primary" loading={create.isPending} onClick={submit}>Create account</Btn>
          </>
        )
      }
    >
      {created ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-success/30 bg-success-soft p-4">
            <p className="flex items-center gap-2 font-bold text-success"><Check size={18} /> {created.name} · {roleLabel(created.role)}</p>
          </div>
          <dl className="space-y-3 rounded-2xl border border-line p-4 text-sm">
            <div><dt className="text-xs font-semibold text-ink-3 uppercase">Sign-in page</dt><dd className="font-mono text-ink">{location.origin}/admin/login</dd></div>
            <div><dt className="text-xs font-semibold text-ink-3 uppercase">Email</dt><dd className="font-mono text-ink">{created.email}</dd></div>
            <div><dt className="text-xs font-semibold text-ink-3 uppercase">Temporary password</dt><dd className="font-mono text-ink select-all">{created.password}</dd></div>
          </dl>
          <Btn icon={copied ? <Check size={16} /> : <Copy size={16} />} onClick={copyCreds}>{copied ? 'Copied' : 'Copy details'}</Btn>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4">
          <TextField label="Full name" data-autofocus maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Priya Sharma" />
          <TextField label="Work email" type="email" autoComplete="off" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="name@worknear.in" />
          <div className="flex items-end gap-2">
            <TextField className="flex-1" label="Temporary password" autoComplete="new-password" minLength={8} maxLength={100} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} inputClassName="font-mono" />
            <Btn aria-label="Generate new password" title="Generate new password" icon={<RefreshCw size={16} />} onClick={() => setF({ ...f, password: randomPassword() })} />
          </div>
          <div role="radiogroup" aria-label="Role" className="space-y-2">
            <p className="text-[13px] font-semibold text-ink-2">Role</p>
            {ROLES.map((r) => (
              <label key={r.value} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition ${f.role === r.value ? 'border-primary bg-primary-soft/50' : 'border-line hover:bg-surface-2'}`}>
                <input type="radio" name="staff-role" className="mt-1 accent-primary" checked={f.role === r.value} onChange={() => setF({ ...f, role: r.value })} />
                <span>
                  <span className="block text-sm font-semibold text-ink">{r.label}</span>
                  <span className="block text-xs text-ink-2">{r.desc}</span>
                </span>
              </label>
            ))}
          </div>
          {f.role === 'sub_admin' && <PermissionMatrix value={f.permissions ?? {}} onChange={(permissions) => setF({ ...f, permissions })} />}
          {err && <p role="alert" className="text-sm text-danger">{err}</p>}
          <button type="submit" hidden />
        </form>
      )}
    </Drawer>
  );
}

/**
 * Module × action grid for sub-admins. Ticking Create / Edit / Delete also ticks View (the server enforces the same),
 * and the row switch toggles every action of a module at once.
 */
function PermissionMatrix({ value, onChange }: { value: AdminPermissions; onChange: (p: AdminPermissions) => void }) {
  const toggle = (m: (typeof MODULES)[number]['key'], a: (typeof ACTIONS)[number]['key']) => {
    const row = { ...(value[m] ?? {}) };
    const on = !row[a];
    if (on) row[a] = true;
    else delete row[a];
    if (on && a !== 'view') row.view = true;
    if (!on && a === 'view') { delete row.create; delete row.edit; delete row.delete; } // no view → nothing else
    const next = { ...value, [m]: row };
    if (!Object.keys(row).length) delete next[m];
    onChange(next);
  };
  const toggleRow = (m: (typeof MODULES)[number]['key']) => {
    const full = ACTIONS.every((a) => value[m]?.[a.key]);
    const next = { ...value };
    if (full) delete next[m];
    else next[m] = { view: true, create: true, edit: true, delete: true };
    onChange(next);
  };
  const count = Object.keys(value).length;
  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-ink-2">Permissions</p>
          <p className="text-xs text-ink-3">Only ticked modules appear in their sidebar. Every action is also checked by the server.</p>
        </div>
        <span className="shrink-0 rounded-md bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">{count} module{count === 1 ? '' : 's'}</span>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-surface-2/70 text-xs text-ink-2">
            <tr>
              <th className="px-3 py-2.5 text-left font-semibold">Module</th>
              {ACTIONS.map((a) => <th key={a.key} className="w-16 px-2 py-2.5 text-center font-semibold">{a.label}</th>)}
              <th className="w-14 px-2 py-2.5 text-center font-semibold">All</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {MODULES.map((m) => {
              const full = ACTIONS.every((a) => value[m.key]?.[a.key]);
              return (
                <tr key={m.key} className={value[m.key] ? 'bg-primary-soft/30' : undefined}>
                  <td className="px-3 py-2.5">
                    <span className="block font-semibold text-ink">{m.label}</span>
                    <span className="block text-[11px] text-ink-3">{m.hint}</span>
                  </td>
                  {ACTIONS.map((a) => (
                    <td key={a.key} className="px-2 py-2.5 text-center">
                      <input type="checkbox" className="size-4 accent-primary" aria-label={`${m.label}: ${a.label}`}
                        checked={!!value[m.key]?.[a.key]} onChange={() => toggle(m.key, a.key)} />
                    </td>
                  ))}
                  <td className="px-2 py-2.5 text-center">
                    <input type="checkbox" className="size-4 accent-primary" aria-label={`${m.label}: all actions`} checked={full} onChange={() => toggleRow(m.key)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Edit a sub-admin's permissions (or make someone a sub-admin — `staff.role` is already 'sub_admin' then). */
function PermissionsDrawer({ staff, onClose }: { staff: AdminStaff; onClose: () => void }) {
  const update = useUpdateStaff();
  const [perms, setPerms] = useState<AdminPermissions>(() => staff.permissions ?? {});
  const empty = !Object.keys(perms).length;
  return (
    <Drawer
      open
      wide
      onClose={onClose}
      title={`Permissions · ${staff.name}`}
      sub="Changes apply on their next click — no need to sign out."
      footer={
        <>
          <Btn tone="ghost" onClick={onClose}>Cancel</Btn>
          <Btn tone="primary" disabled={empty} loading={update.isPending} onClick={() => update.mutate({ id: staff.id, patch: { role: 'sub_admin', permissions: perms } }, { onSuccess: onClose })}>
            Save permissions
          </Btn>
        </>
      }
    >
      <PermissionMatrix value={perms} onChange={setPerms} />
      {empty && <p role="alert" className="mt-3 text-sm text-danger">Tick at least one permission.</p>}
    </Drawer>
  );
}
