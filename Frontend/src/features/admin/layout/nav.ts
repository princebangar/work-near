import {
  BadgeCheck, CircleUserRound, LayoutDashboard, LayoutGrid, Megaphone, MessageSquareWarning, Newspaper, SlidersHorizontal,
  Star, UserCog, Users, Wallet, type LucideIcon,
} from 'lucide-react';
import type { AdminBadges, AdminModule, AdminPermissions, AdminRole } from '@/types/admin';
import { canAdmin } from '../lib';

export interface NavItem {
  /** Path under /admin ('' = dashboard). */
  to: string;
  label: string;
  icon: LucideIcon;
  /** Permission module — visible when the staff member can *view* it (sub-admins: ticked permission). */
  module?: AdminModule;
  /** Pages outside the module system (staff, account): visible to these roles. */
  roles?: AdminRole[];
  badge?: keyof AdminBadges;
  /** Badge colour: amber for queues, red for problems. */
  badgeTone?: 'amber' | 'red';
  /** Extra words for the menu filter / command palette. */
  keywords?: string;
}
export interface NavSection { title: string; items: NavItem[] }

const ALL: AdminRole[] = ['super_admin', 'admin', 'support', 'sub_admin'];
const ADMINS: AdminRole[] = ['super_admin', 'admin'];

export const NAV: NavSection[] = [
  { title: 'Overview', items: [{ to: '', label: 'Dashboard', icon: LayoutDashboard, module: 'dashboard', keywords: 'home kpi stats charts overview' }] },
  {
    title: 'Users & workers',
    items: [
      { to: 'users', label: 'Users', icon: Users, module: 'users', badge: 'users', badgeTone: 'red', keywords: 'customers workers suspend delete accounts' },
      { to: 'verifications', label: 'Verifications', icon: BadgeCheck, module: 'verifications', badge: 'verifications', badgeTone: 'amber', keywords: 'kyc documents id badge approve' },
    ],
  },
  { title: 'Catalog', items: [{ to: 'categories', label: 'Categories', icon: LayoutGrid, module: 'categories', keywords: 'services skills trades' }] },
  { title: 'Billing', items: [{ to: 'billing', label: 'Subscriptions & Transactions', icon: Wallet, module: 'billing', keywords: 'plans payments refund revenue razorpay' }] },
  {
    title: 'Trust & safety',
    items: [
      { to: 'complaints', label: 'Complaints', icon: MessageSquareWarning, module: 'complaints', badge: 'complaints', badgeTone: 'red', keywords: 'reports tickets support' },
      { to: 'reviews', label: 'Reviews', icon: Star, module: 'reviews', keywords: 'ratings moderation hide' },
    ],
  },
  {
    title: 'Content',
    items: [
      { to: 'cms', label: 'CMS', icon: Newspaper, module: 'cms', keywords: 'banners faq legal terms privacy pages' },
      { to: 'broadcast', label: 'Broadcast notification', icon: Megaphone, module: 'broadcast', keywords: 'push notification announce message send offer' },
    ],
  },
  {
    title: 'System',
    items: [
      { to: 'settings', label: 'Customization Settings', icon: SlidersHorizontal, module: 'settings', keywords: 'maintenance features toggles radius support' },
      { to: 'staff', label: 'Roles & staff', icon: UserCog, roles: ADMINS, keywords: 'team admins sub-admin permissions mfa' },
      { to: 'account', label: 'My account', icon: CircleUserRound, roles: ALL, keywords: 'profile password mfa 2fa security' },
    ],
  },
];

const visible = (i: NavItem, role: AdminRole, perms?: AdminPermissions) => (i.module ? canAdmin(role, perms, i.module) : !!i.roles?.includes(role));

export const navFor = (role: AdminRole, perms?: AdminPermissions): NavSection[] =>
  NAV.map((s) => ({ ...s, items: s.items.filter((i) => visible(i, role, perms)) })).filter((s) => s.items.length);

export const itemsFor = (role: AdminRole, perms?: AdminPermissions) => navFor(role, perms).flatMap((s) => s.items);

/** Landing page: support works the complaint queue; a sub-admin lands on their first permitted page. */
export const homeFor = (role: AdminRole, perms?: AdminPermissions) => {
  if (role === 'support') return 'complaints';
  if (role === 'sub_admin') return itemsFor(role, perms)[0]?.to ?? 'account';
  return '';
};

export const itemForPath = (pathname: string) => {
  const seg = pathname.replace(/^\/admin\/?/, '').split('/')[0] ?? '';
  return NAV.flatMap((s) => s.items).find((i) => i.to === seg);
};
