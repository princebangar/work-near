/**
 * Admin-panel permissions.
 *  - super_admin: everything (incl. staff, audit logs, maintenance, refunds, plan creation, grants)
 *  - admin:       every module below (no super-only actions)
 *  - support:     complaints assigned to them (SRS 4 / AC-12)
 *  - sub_admin:   exactly the modules + actions the super admin ticks (view / create / edit / delete)
 * Module keys mirror the admin sidebar, so the same map drives both menu visibility and API access.
 */
export const ADMIN_MODULES = ['dashboard', 'users', 'verifications', 'categories', 'billing', 'complaints', 'reviews', 'cms', 'broadcast', 'settings'] as const;
export type AdminModule = (typeof ADMIN_MODULES)[number];
export const PERM_ACTIONS = ['view', 'create', 'edit', 'delete'] as const;
export type PermAction = (typeof PERM_ACTIONS)[number];
export type Permissions = Partial<Record<AdminModule, Partial<Record<PermAction, boolean>>>>;

export const MODULE_LABEL: Record<AdminModule, string> = {
  dashboard: 'Dashboard', users: 'Users', verifications: 'Verifications', categories: 'Categories', billing: 'Subscriptions & Transactions',
  complaints: 'Complaints', reviews: 'Reviews', cms: 'CMS', broadcast: 'Broadcast notifications', settings: 'Customization Settings',
};

/** HTTP method → action (GET = view, POST = create, PUT/PATCH = edit, DELETE = delete). */
export const actionFor = (method: string): PermAction =>
  method === 'POST' ? 'create' : method === 'PUT' || method === 'PATCH' ? 'edit' : method === 'DELETE' ? 'delete' : 'view';

/** Keeps only known modules/actions; any create/edit/delete implies view (can't edit what you can't see). */
export function normalizePermissions(input: unknown): Permissions {
  const out: Permissions = {};
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, Record<string, unknown>>;
  for (const m of ADMIN_MODULES) {
    const row = src[m];
    if (!row || typeof row !== 'object') continue;
    const acts = Object.fromEntries(PERM_ACTIONS.filter((a) => row[a] === true).map((a) => [a, true])) as Partial<Record<PermAction, boolean>>;
    if (acts.create || acts.edit || acts.delete) acts.view = true;
    if (Object.keys(acts).length) out[m] = acts;
  }
  return out;
}

export function can(admin: { role: string; permissions?: Permissions | null }, module: AdminModule, action: PermAction) {
  if (admin.role === 'super_admin' || admin.role === 'admin') return true;
  if (admin.role === 'support') return module === 'complaints' && (action === 'view' || action === 'edit');
  if (admin.role === 'sub_admin') return admin.permissions?.[module]?.[action] === true;
  return false;
}
