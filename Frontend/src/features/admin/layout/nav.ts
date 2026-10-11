import {
  BadgeCheck, CircleUserRound, FileClock, LayoutDashboard, LayoutGrid, MessageSquareWarning, Newspaper, SlidersHorizontal,
  Star, UserCog, Users, Wallet, type LucideIcon,
} from 'lucide-react';
import type { AdminBadges, AdminRole } from '@/types/admin';

export interface NavItem {
  /** Path under /admin ('' = dashboard). */
  to: string;
  label: string;
  icon: LucideIcon;
  roles: AdminRole[];
  badge?: keyof AdminBadges;
  /** Badge colour: amber for queues, red for problems. */
  badgeTone?: 'amber' | 'red';
  /** Extra words for the menu filter / command palette. */
  keywords?: string;
}
export interface NavSection { title: string; items: NavItem[] }

const ALL: AdminRole[] = ['super_admin', 'admin', 'support'];
const ADMINS: AdminRole[] = ['super_admin', 'admin'];
const SUPER: AdminRole[] = ['super_admin'];

export const NAV: NavSection[] = [
  { title: 'Overview', items: [{ to: '', label: 'Dashboard', icon: LayoutDashboard, roles: ADMINS, keywords: 'home kpi stats charts overview' }] },
  {
    title: 'Users & workers',
    items: [
      { to: 'users', label: 'Users', icon: Users, roles: ADMINS, badge: 'users', badgeTone: 'red', keywords: 'customers workers suspend delete accounts' },
      { to: 'verifications', label: 'Verifications', icon: BadgeCheck, roles: ADMINS, badge: 'verifications', badgeTone: 'amber', keywords: 'kyc documents id badge approve' },
    ],
  },
  { title: 'Catalog', items: [{ to: 'categories', label: 'Categories', icon: LayoutGrid, roles: ADMINS, keywords: 'services skills trades' }] },
  { title: 'Billing', items: [{ to: 'billing', label: 'Subscriptions & Transactions', icon: Wallet, roles: ADMINS, keywords: 'plans payments refund revenue razorpay' }] },
  {
    title: 'Trust & safety',
    items: [
      { to: 'complaints', label: 'Complaints', icon: MessageSquareWarning, roles: ALL, badge: 'complaints', badgeTone: 'red', keywords: 'reports tickets support' },
      { to: 'reviews', label: 'Reviews', icon: Star, roles: ADMINS, keywords: 'ratings moderation hide' },
    ],
  },
  { title: 'Content', items: [{ to: 'cms', label: 'CMS', icon: Newspaper, roles: ADMINS, keywords: 'banners faq legal terms privacy pages' }] },
  {
    title: 'System',
    items: [
      { to: 'settings', label: 'Customization Settings', icon: SlidersHorizontal, roles: ADMINS, keywords: 'maintenance features toggles radius support' },
      { to: 'audit', label: 'Audit logs', icon: FileClock, roles: SUPER, keywords: 'history activity security' },
      { to: 'staff', label: 'Roles & staff', icon: UserCog, roles: ADMINS, keywords: 'team admins permissions mfa' },
      { to: 'account', label: 'My account', icon: CircleUserRound, roles: ALL, keywords: 'profile password mfa 2fa security' },
    ],
  },
];

export const navFor = (role: AdminRole): NavSection[] =>
  NAV.map((s) => ({ ...s, items: s.items.filter((i) => i.roles.includes(role)) })).filter((s) => s.items.length);

export const itemsFor = (role: AdminRole) => navFor(role).flatMap((s) => s.items);

/** Landing page per role — support works the complaint queue. */
export const homeFor = (role: AdminRole) => (role === 'support' ? 'complaints' : '');

export const itemForPath = (pathname: string) => {
  const seg = pathname.replace(/^\/admin\/?/, '').split('/')[0] ?? '';
  return NAV.flatMap((s) => s.items).find((i) => i.to === seg);
};
