import { useEffect, useState } from 'react';
import type { AdminModule, AdminPermissions, AdminRole, PermAction } from '@/types/admin';

export type PillTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

export const isSuper = (r?: AdminRole) => r === 'super_admin';
/** super_admin + admin (everything except support-only access). */
export const isAdminPlus = (r?: AdminRole) => r === 'super_admin' || r === 'admin';
export const roleLabel = (r: AdminRole) => ({ super_admin: 'Super admin', admin: 'Admin', support: 'Support', sub_admin: 'Sub-admin' })[r] ?? r;

/** Same rule as the server (Backend lib/permissions.ts `can`) — hides what the API would refuse anyway. */
export function canAdmin(role: AdminRole | undefined, perms: AdminPermissions | undefined, module: AdminModule, action: PermAction = 'view') {
  if (role === 'super_admin' || role === 'admin') return true;
  if (role === 'support') return module === 'complaints' && (action === 'view' || action === 'edit');
  if (role === 'sub_admin') return perms?.[module]?.[action] === true;
  return false;
}

export const MODULES: { key: AdminModule; label: string; hint: string }[] = [
  { key: 'dashboard', label: 'Dashboard', hint: 'KPIs and charts' },
  { key: 'users', label: 'Users', hint: 'Customers & workers, suspend / delete, CSV' },
  { key: 'verifications', label: 'Verifications', hint: 'Review ID documents, approve / reject' },
  { key: 'categories', label: 'Categories', hint: 'Services and skills' },
  { key: 'billing', label: 'Subscriptions & Transactions', hint: 'Plans, payments (refunds stay super-admin only)' },
  { key: 'complaints', label: 'Complaints', hint: 'Reports and support tickets' },
  { key: 'reviews', label: 'Reviews', hint: 'Hide / restore ratings' },
  { key: 'cms', label: 'CMS', hint: 'Banners, FAQs, legal pages' },
  { key: 'broadcast', label: 'Broadcast notifications', hint: 'Send push + inbox messages' },
  { key: 'settings', label: 'Customization Settings', hint: 'Feature switches (maintenance stays super-admin only)' },
];
export const ACTIONS: { key: PermAction; label: string }[] = [
  { key: 'view', label: 'View' }, { key: 'create', label: 'Create' }, { key: 'edit', label: 'Edit' }, { key: 'delete', label: 'Delete' },
];

/** "in_progress" → "In progress" */
export const human = (s: string) => {
  const t = s.replace(/[_-]+/g, ' ').trim();
  return t ? t[0]!.toUpperCase() + t.slice(1) : t;
};

export const TONES = {
  user: { active: 'success', suspended: 'danger', deleted_request: 'warning', deleted: 'neutral' },
  verification: { pending: 'warning', info_requested: 'primary', approved: 'success', rejected: 'danger' },
  complaint: { open: 'warning', in_progress: 'primary', escalated: 'danger', resolved: 'success' },
  txn: { success: 'success', pending: 'warning', failed: 'danger', refunded: 'neutral' },
  subscription: { active: 'success', pending: 'warning', expired: 'neutral', none: 'neutral' },
  review: { visible: 'success', hidden: 'neutral' },
  staff: { active: 'success', disabled: 'neutral' },
} satisfies Record<string, Record<string, PillTone>>;

export const toneOf = (group: keyof typeof TONES, value?: string): PillTone =>
  ((TONES[group] as Record<string, PillTone>)[value ?? ''] ?? 'neutral');

export const USER_STATUS_LABEL: Record<string, string> = { active: 'Active', suspended: 'Suspended', deleted_request: 'Deletion requested', deleted: 'Deleted' };
export const VERIFICATION_TYPE_LABEL: Record<string, string> = { phone: 'Phone', id: 'ID', id_address: 'ID + Address' };

const dtFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
export const dateTime = (iso?: string) => (iso ? dtFmt.format(new Date(iso)) : '—');

const compactFmt = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
export const compact = (n: number) => compactFmt.format(n);

/** "worknear@admin.com" → "wo•••••@admin.com" */
export function maskEmail(e?: string) {
  if (!e) return '';
  const [u = '', d = ''] = e.split('@');
  return `${u.slice(0, 2)}${'•'.repeat(Math.max(2, Math.min(6, u.length - 2)))}@${d}`;
}

export const maskMobile = (m: string) => (m.length > 4 ? `${'•'.repeat(m.length - 4)}${m.slice(-4)}` : m);

/** Local-date yyyy-mm-dd (what the API's from/to expect). */
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export type RangePreset = 'all' | '7d' | '30d' | 'month';
export function presetRange(p: RangePreset): { from?: string; to?: string } {
  const now = new Date();
  if (p === 'all') return {};
  if (p === 'month') return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(now) };
  const days = p === '7d' ? 6 : 29;
  return { from: ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days)), to: ymd(now) };
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** useState persisted in localStorage (best-effort: private mode / blocked storage just falls back to memory). */
export function useStoredState<T>(key: string, init: T) {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? init : (JSON.parse(raw) as T);
    } catch {
      return init;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* storage unavailable */
    }
  }, [key, v]);
  return [v, setV] as const;
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Removes empty values so query keys / URLs stay canonical. */
export const clean = <T extends Record<string, string | number | undefined>>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && v !== 'all')) as Partial<T>;

export const randomPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const a = new Uint32Array(12);
  crypto.getRandomValues(a);
  return `${Array.from(a, (n) => chars[n % chars.length]).join('')}#9`;
};
