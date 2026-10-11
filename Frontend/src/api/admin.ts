// Admin panel data layer — every admin call goes through these hooks (admin token via adminHttp).
// Cache strategy: shared keys under ['adm', …], generous staleTime, setQueryData after mutations where the
// response carries enough data, and narrow invalidation (inactive lists are only marked stale — no refetch storm).
import {
  keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient,
  type InfiniteData, type QueryClient, type QueryKey,
} from '@tanstack/react-query';
import { ApiError, adminHttp } from '@/lib/http';
import { toast, useAuth, useSettings } from '@/store';
import type * as A from '@/types/admin';

type ListName = 'users' | 'verifications' | 'subscriptions' | 'transactions' | 'complaints' | 'reviews' | 'audit';

export const ak = {
  root: ['adm'] as const,
  me: ['adm', 'me'] as const,
  badges: ['adm', 'badges'] as const,
  kpis: ['adm', 'kpis'] as const,
  list: (name: ListName, p?: A.ListParams): QueryKey => (p ? ['adm', name, p] : ['adm', name]),
  user: (id: string) => ['adm', 'user', id] as const,
  userSearch: (q: string) => ['adm', 'user-search', q] as const,
  categories: ['adm', 'categories'] as const,
  plans: ['adm', 'plans'] as const,
  staff: ['adm', 'staff'] as const,
  banners: ['adm', 'banners'] as const,
  faqs: ['adm', 'faqs'] as const,
  pages: ['adm', 'pages'] as const,
  settings: ['adm', 'settings'] as const,
};

/** Human-readable message for any API error (first field error for validation failures). */
export function errText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'VALIDATION_ERROR' && e.details && typeof e.details === 'object') {
      const [field, msgs] = Object.entries(e.details as Record<string, string[] | undefined>).find(([, v]) => v?.length) ?? [];
      if (field && msgs?.[0]) return `${field}: ${msgs[0]}`;
    }
    return e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong';
}

// ---------- helpers ----------
type Inf<T> = InfiniteData<A.Page<T>, string | undefined>;
const PAGE_SIZE = 25;

function useList<T>(name: ListName, path: string, params: A.ListParams, opts: { enabled?: boolean; limit?: number } = {}) {
  const limit = opts.limit ?? PAGE_SIZE;
  return useInfiniteQuery({
    queryKey: ak.list(name, params),
    queryFn: ({ pageParam, signal }) => adminHttp.get<A.Page<T>>(path, { ...params, limit, cursor: pageParam }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled: opts.enabled,
  });
}

/** Rows of an infinite list, flattened. */
export const rowsOf = <T,>(d?: { pages: A.Page<T>[] }) => d?.pages.flatMap((p) => p.items) ?? [];
export const totalOf = <T,>(d?: { pages: A.Page<T>[] }) => d?.pages[0]?.total ?? 0;

/** Update one row (by id) in every cached page of a list, whatever the filters. */
function patchRows<T extends { id: string }>(qc: QueryClient, name: ListName, id: string, patch: Partial<T> | ((r: T) => T)) {
  qc.setQueriesData<Inf<T>>({ queryKey: ['adm', name] }, (d) =>
    d && {
      ...d,
      pages: d.pages.map((pg) => ({ ...pg, items: pg.items.map((r) => (r.id === id ? (typeof patch === 'function' ? patch(r) : { ...r, ...patch }) : r)) })),
    },
  );
}
/** Mark as stale without refetching now — next mount / filter change loads fresh data. */
const stale = (qc: QueryClient, key: QueryKey) => qc.invalidateQueries({ queryKey: key, refetchType: 'none' });
const refreshBadges = (qc: QueryClient) => qc.invalidateQueries({ queryKey: ak.badges });

function useAction<V, R>(fn: (v: V) => Promise<R>, done?: (qc: QueryClient, r: R, v: V) => void, msg?: string | ((r: R, v: V) => string)) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r, v) => {
      done?.(qc, r, v);
      const m = typeof msg === 'function' ? msg(r, v) : msg;
      if (m) toast(m, 'success');
    },
    onError: (e) => toast(errText(e), 'error'),
  });
}

// ---------- Auth ----------
export const useAdminLogin = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { email: string; password: string; otp?: string }) => adminHttp.post<A.AdminSession>('/admin/auth/login', b),
    onSuccess: (s) => {
      qc.removeQueries({ queryKey: ak.root }); // never show a previous admin's cached data
      useAuth.getState().setAdmin(s);
    },
  });
};

export function adminLogout(qc: QueryClient) {
  useAuth.getState().setAdmin(null);
  qc.removeQueries({ queryKey: ak.root });
}

export const useAdminMe = () =>
  useQuery({ queryKey: ak.me, queryFn: ({ signal }) => adminHttp.get<A.AdminMe>('/admin/auth/me', undefined, signal), staleTime: 60_000 });

export const useMfaSetup = () =>
  useMutation({ mutationFn: () => adminHttp.post<A.MfaSetup>('/admin/auth/me/mfa/setup'), onError: (e) => toast(errText(e), 'error') });

export const useMfaEnable = () =>
  useAction(
    (code: string) => adminHttp.post<{ mfaEnabled: boolean }>('/admin/auth/me/mfa/enable', { code }),
    (qc) => {
      const a = useAuth.getState().admin;
      if (a) useAuth.getState().setAdmin({ ...a, mfaEnabled: true });
      qc.setQueryData<A.AdminMe>(ak.me, (m) => m && { ...m, mfaEnabled: true });
      stale(qc, ak.staff);
    },
    'Two-factor authentication is on',
  );

export const useChangePassword = () =>
  useAction((b: { current: string; next: string }) => adminHttp.post<{ changed: boolean }>('/admin/auth/me/password', b), undefined, 'Password changed');

// ---------- Dashboard ----------
export const useAdminKpis = () =>
  useQuery({ queryKey: ak.kpis, queryFn: ({ signal }) => adminHttp.get<A.AdminKpis>('/admin/kpis', undefined, signal), staleTime: 60_000 });

/** Sidebar counts — the only polled call: every 60 s, paused while the tab is hidden. */
export const useAdminBadges = () =>
  useQuery({
    queryKey: ak.badges,
    queryFn: ({ signal }) => adminHttp.get<A.AdminBadges>('/admin/badges', undefined, signal),
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

// ---------- Users ----------
export const useAdminUsers = (p: A.ListParams) => useList<A.AdminUserRow>('users', '/admin/users', p);

export const useUserSearch = (q: string, enabled: boolean) =>
  useQuery({
    queryKey: ak.userSearch(q),
    queryFn: ({ signal }) => adminHttp.get<A.Page<A.AdminUserRow>>('/admin/users', { q, limit: 6 }, signal),
    enabled: enabled && q.length >= 2,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

export const useAdminUser = (id: string | null) =>
  useQuery({
    queryKey: ak.user(id ?? ''),
    queryFn: ({ signal }) => adminHttp.get<A.AdminUserDetail>(`/admin/users/${id}`, undefined, signal),
    enabled: !!id,
    staleTime: 30_000,
  });

type StatusVars = { id: string; status: 'active' | 'suspended' | 'deleted'; reason?: string; prev?: A.AdminUserStatus };
export const useSetUserStatus = () =>
  useAction(
    ({ id, ...b }: StatusVars) => adminHttp.patch<{ id: string; status: A.AdminUserStatus }>(`/admin/users/${id}`, { status: b.status, reason: b.reason || undefined }),
    (qc, r, v) => {
      patchRows<A.AdminUserRow>(qc, 'users', v.id, (u) => ({ ...u, status: r.status, ...(r.status === 'deleted' && { name: 'Deleted user' }) }));
      if (r.status === 'deleted') qc.invalidateQueries({ queryKey: ak.user(v.id) }); // anonymised — reload the detail
      else
        qc.setQueryData<A.AdminUserDetail>(ak.user(v.id), (d) =>
          d && { ...d, status: r.status, statusReason: v.reason, worker: d.worker && { ...d.worker, restricted: r.status === 'suspended' } },
        );
      if (v.prev === 'deleted_request' || r.status === 'deleted') refreshBadges(qc);
      stale(qc, ['adm', 'users']);
      stale(qc, ak.kpis);
    },
    (r) => ({ active: 'User reinstated', suspended: 'User suspended', deleted: 'Account deleted & anonymised' } as Record<string, string>)[r.status] ?? 'Updated',
  );

export const useRestrictWorker = () =>
  useAction(
    (v: { userId: string; restricted: boolean; reason: string }) => adminHttp.patch<{ restricted: boolean }>(`/admin/workers/${v.userId}`, { restricted: v.restricted, reason: v.reason }),
    (qc, r, v) => {
      qc.setQueryData<A.AdminUserDetail>(ak.user(v.userId), (d) => d && { ...d, worker: d.worker && { ...d.worker, restricted: r.restricted } });
      stale(qc, ak.kpis);
    },
    (r) => (r.restricted ? 'Worker profile hidden from search' : 'Worker profile visible again'),
  );

export const useGrantSubscription = () =>
  useAction(
    (v: { userId: string; planId: string; reason: string }) => adminHttp.post<{ endAt: string }>('/admin/subscriptions/grant', v),
    (qc, r, v) => {
      qc.setQueryData<A.AdminUserDetail>(ak.user(v.userId), (d) => d && { ...d, subscription: { plan: v.planId, status: 'active', endAt: r.endAt, source: 'admin_grant' } });
      stale(qc, ['adm', 'subscriptions']);
      stale(qc, ak.kpis);
    },
    'Subscription granted',
  );

// ---------- Verifications ----------
export const useAdminVerifications = (p: A.ListParams) => useList<A.AdminVerification>('verifications', '/admin/verifications', p, { limit: 24 });

export const useReviewVerification = () =>
  useAction(
    (v: { id: string; status: Exclude<A.VerificationStatus, 'pending'>; reason?: string }) =>
      adminHttp.patch<{ id: string; status: A.VerificationStatus }>(`/admin/verifications/${v.id}`, { status: v.status, reason: v.reason || undefined }),
    (qc, r, v) => {
      const me = useAuth.getState().admin?.name;
      patchRows<A.AdminVerification>(qc, 'verifications', v.id, { status: r.status, reason: v.reason, reviewedAt: new Date().toISOString(), reviewer: me });
      stale(qc, ['adm', 'verifications']);
      stale(qc, ak.kpis);
      refreshBadges(qc);
    },
    (_r, v) => ({ approved: 'Verification approved — badge is live', rejected: 'Verification rejected', info_requested: 'More information requested' })[v.status],
  );

// ---------- Full-object PATCH bodies ----------
// The backend validates PATCH bodies with `schema.partial()` over fields that have zod defaults, so any field
// left out is RESET to its default (e.g. PATCH {active} wipes a category's icon, Hindi name and skills).
// We therefore always send the complete object, merged from the cached row.
const categoryInput = (c: A.AdminCategory): A.CategoryInput => ({ name: c.name, nameHi: c.nameHi, icon: c.icon, tint: c.tint, skills: c.skills, active: c.active });
const bannerInput = (b: A.AdminBanner): A.BannerInput => ({ title: b.title, subtitle: b.subtitle, tint: b.tint, link: b.link ?? '', active: b.active, sort: b.sort });
const faqInput = (f: A.AdminFaq): A.FaqInput => ({ q: f.q, a: f.a, active: f.active, sort: f.sort });
function fullBody<T extends { id: string }, I>(qc: QueryClient, key: QueryKey, id: string, toInput: (x: T) => I, patch: Partial<I>): Partial<I> {
  const cur = qc.getQueryData<T[]>(key)?.find((x) => x.id === id);
  return cur ? { ...toInput(cur), ...patch } : patch;
}

// ---------- Categories ----------
export const useAdminCategories = (enabled = true) =>
  useQuery({ queryKey: ak.categories, queryFn: ({ signal }) => adminHttp.get<A.AdminCategory[]>('/admin/categories', undefined, signal), staleTime: 5 * 60_000, enabled });

export const useSaveCategory = () => {
  const qc = useQueryClient();
  return useAction(
    (v: { id?: string; body: Partial<A.CategoryInput> }) =>
      v.id
        ? adminHttp.patch<Omit<A.AdminCategory, 'workerCount'>>(`/admin/categories/${v.id}`, fullBody(qc, ak.categories, v.id, categoryInput, v.body))
        : adminHttp.post<A.AdminCategory>('/admin/categories', v.body),
    (qc, r) => {
      qc.setQueryData<A.AdminCategory[]>(ak.categories, (l) => {
        if (!l) return l;
        const i = l.findIndex((c) => c.id === r.id);
        if (i < 0) return [...l, { workerCount: 0, ...r }];
        return l.map((c) => (c.id === r.id ? { ...c, ...r } : c));
      });
      stale(qc, ['categories']); // public catalogue used by the app
    },
    (_r, v) => (v.id ? 'Category saved' : 'Category created'),
  );
};

export function useToggleCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; active: boolean }) =>
      adminHttp.patch<A.AdminCategory>(`/admin/categories/${v.id}`, fullBody(qc, ak.categories, v.id, categoryInput, { active: v.active })),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ak.categories });
      const prev = qc.getQueryData<A.AdminCategory[]>(ak.categories);
      qc.setQueryData<A.AdminCategory[]>(ak.categories, (l) => l?.map((c) => (c.id === v.id ? { ...c, active: v.active } : c)));
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(ak.categories, ctx.prev);
      toast(errText(e), 'error');
    },
    onSuccess: (_r, v) => {
      stale(qc, ['categories']);
      toast(v.active ? 'Category is live in the app' : 'Category hidden from the app', 'success');
    },
  });
}

// ---------- Plans, subscriptions, transactions ----------
export const useAdminPlans = (enabled = true) =>
  useQuery({ queryKey: ak.plans, queryFn: ({ signal }) => adminHttp.get<A.AdminPlan[]>('/admin/plans', undefined, signal), staleTime: 5 * 60_000, enabled });

export const useSavePlan = () =>
  useAction(
    (v: { id?: string; body: Partial<A.PlanInput> }) => (v.id ? adminHttp.patch<A.AdminPlan>(`/admin/plans/${v.id}`, v.body) : adminHttp.post<A.AdminPlan>('/admin/plans', v.body)),
    (qc, r) => {
      qc.setQueryData<A.AdminPlan[]>(ak.plans, (l) => (!l ? l : l.some((p) => p.id === r.id) ? l.map((p) => (p.id === r.id ? r : p)) : [...l, r]));
      stale(qc, ['plans']);
    },
    (_r, v) => (v.id ? 'Plan saved — applies to future purchases' : 'Plan created'),
  );

export const useAdminSubscriptions = (p: A.ListParams) => useList<A.AdminSubscriptionRow>('subscriptions', '/admin/subscriptions', p);
export const useAdminTransactions = (p: A.ListParams) => useList<A.AdminTransaction>('transactions', '/admin/transactions', p);

export const useRefund = () =>
  useAction(
    (v: { id: string; reason: string }) => adminHttp.post<{ status: A.TxnStatus; refundId?: string }>(`/admin/transactions/${v.id}/refund`, { reason: v.reason }),
    (qc, r, v) => {
      patchRows<A.AdminTransaction>(qc, 'transactions', v.id, { status: r.status, refundId: r.refundId });
      stale(qc, ['adm', 'subscriptions']);
      stale(qc, ak.kpis);
    },
    'Refund initiated',
  );

// ---------- Complaints ----------
export const useAdminComplaints = (p: A.ListParams) => useList<A.AdminComplaint>('complaints', '/admin/complaints', p);

export const useUpdateComplaint = () =>
  useAction(
    (v: { code: string; patch: A.ComplaintPatch }) => adminHttp.patch<A.AdminComplaint>(`/admin/complaints/${encodeURIComponent(v.code)}`, v.patch),
    (qc, r, v) => {
      patchRows<A.AdminComplaint>(qc, 'complaints', r.id, r);
      if (v.patch.status || v.patch.assignedTo !== undefined) {
        refreshBadges(qc);
        stale(qc, ['adm', 'complaints']);
        stale(qc, ak.kpis);
      }
      if (v.patch.action && v.patch.action !== 'warn' && r.targetUserId) {
        stale(qc, ['adm', 'users']);
        qc.invalidateQueries({ queryKey: ak.user(r.targetUserId), refetchType: 'none' });
      }
    },
    (_r, v) =>
      v.patch.action === 'warn' ? 'Warning sent to the user'
        : v.patch.action === 'restrict' ? 'Worker profile restricted'
          : v.patch.action === 'suspend' ? 'User suspended'
            : v.patch.status === 'resolved' ? 'Complaint resolved — reporter notified'
              : v.patch.status ? 'Status updated'
                : v.patch.assignedTo !== undefined ? (v.patch.assignedTo ? 'Complaint assigned' : 'Complaint unassigned')
                  : 'Saved',
  );

// ---------- Reviews ----------
export const useAdminReviews = (p: A.ListParams) => useList<A.AdminReview>('reviews', '/admin/reviews', p);

export const useModerateReview = () =>
  useAction(
    (v: { id: string; status: A.ReviewStatus; reason?: string }) => adminHttp.patch<{ id: string; status: A.ReviewStatus }>(`/admin/reviews/${v.id}`, { status: v.status, reason: v.reason || undefined }),
    (qc, r, v) => {
      patchRows<A.AdminReview>(qc, 'reviews', v.id, (x) => ({ ...x, status: r.status, hiddenReason: r.status === 'hidden' ? v.reason : undefined, reports: r.status === 'visible' ? 0 : x.reports }));
      stale(qc, ['adm', 'reviews']);
    },
    (r) => (r.status === 'hidden' ? 'Review hidden' : 'Review restored'),
  );

// ---------- CMS ----------
const bySort = <T extends { sort: number }>(l: T[]) => [...l].sort((a, b) => a.sort - b.sort);

export const useAdminBanners = () =>
  useQuery({ queryKey: ak.banners, queryFn: ({ signal }) => adminHttp.get<A.AdminBanner[]>('/admin/banners', undefined, signal), staleTime: 5 * 60_000 });

export const useSaveBanner = (silent = false) => {
  const qc = useQueryClient();
  return useAction(
    (v: { id?: string; body: Partial<A.BannerInput> }) =>
      v.id
        ? adminHttp.patch<A.AdminBanner>(`/admin/banners/${v.id}`, fullBody(qc, ak.banners, v.id, bannerInput, v.body))
        : adminHttp.post<A.AdminBanner>('/admin/banners', v.body),
    (qc2, r) => {
      qc2.setQueryData<A.AdminBanner[]>(ak.banners, (l) => l && bySort(l.some((b) => b.id === r.id) ? l.map((b) => (b.id === r.id ? r : b)) : [...l, r]));
      stale(qc2, ['banners']);
    },
    silent ? undefined : (_r, v) => (v.id ? 'Banner saved' : 'Banner created'),
  );
};

export const useDeleteBanner = () =>
  useAction(
    (id: string) => adminHttp.del<void>(`/admin/banners/${id}`),
    (qc, _r, id) => {
      qc.setQueryData<A.AdminBanner[]>(ak.banners, (l) => l?.filter((b) => b.id !== id));
      stale(qc, ['banners']);
    },
    'Banner deleted',
  );

export const useAdminFaqs = () =>
  useQuery({ queryKey: ak.faqs, queryFn: ({ signal }) => adminHttp.get<A.AdminFaq[]>('/admin/faqs', undefined, signal), staleTime: 5 * 60_000 });

export const useSaveFaq = (silent = false) => {
  const qc = useQueryClient();
  return useAction(
    (v: { id?: string; body: Partial<A.FaqInput> }) =>
      v.id ? adminHttp.patch<A.AdminFaq>(`/admin/faqs/${v.id}`, fullBody(qc, ak.faqs, v.id, faqInput, v.body)) : adminHttp.post<A.AdminFaq>('/admin/faqs', v.body),
    (qc2, r) => {
      qc2.setQueryData<A.AdminFaq[]>(ak.faqs, (l) => l && bySort(l.some((f) => f.id === r.id) ? l.map((f) => (f.id === r.id ? r : f)) : [...l, r]));
      stale(qc2, ['faqs']);
    },
    silent ? undefined : (_r, v) => (v.id ? 'FAQ saved' : 'FAQ added'),
  );
};

export const useDeleteFaq = () =>
  useAction(
    (id: string) => adminHttp.del<void>(`/admin/faqs/${id}`),
    (qc, _r, id) => {
      qc.setQueryData<A.AdminFaq[]>(ak.faqs, (l) => l?.filter((f) => f.id !== id));
      stale(qc, ['faqs']);
    },
    'FAQ deleted',
  );

export const useAdminPages = () =>
  useQuery({ queryKey: ak.pages, queryFn: ({ signal }) => adminHttp.get<A.AdminLegalPage[]>('/admin/pages', undefined, signal), staleTime: 5 * 60_000 });

export const useSavePage = () =>
  useAction(
    (v: { slug: A.LegalSlug; title: string; body: string[] }) => adminHttp.put<A.AdminLegalPage>(`/admin/pages/${v.slug}`, { title: v.title, body: v.body }),
    (qc, r) => {
      qc.setQueryData<A.AdminLegalPage[]>(ak.pages, (l) => (!l ? [r] : l.some((p) => p.slug === r.slug) ? l.map((p) => (p.slug === r.slug ? r : p)) : [...l, r]));
    },
    'Page published',
  );

// ---------- Customization settings ----------
export const useAdminSettings = () =>
  useQuery({ queryKey: ak.settings, queryFn: ({ signal }) => adminHttp.get<A.AdminSettings>('/admin/settings', undefined, signal), staleTime: 60_000 });

/** Mirror into the app-wide live settings store (maintenance chip etc.) — the socket broadcast does the same for every other client. */
function mirrorPublic(s: A.AdminSettings) {
  const { featureKeys: _k, updatedAt: _u, ...pub } = s;
  useSettings.getState().set(pub);
}

export const useUpdateSettings = (msg = 'Settings saved') =>
  useAction(
    (patch: A.SettingsPatch) => adminHttp.patch<A.AdminSettings>('/admin/settings', patch),
    (qc, r) => {
      qc.setQueryData(ak.settings, r);
      mirrorPublic(r);
      stale(qc, ak.kpis); // maintenance alert on the dashboard
    },
    msg,
  );

const FEATURE_MUTATION = ['adm', 'feature-toggle'];
/** One switch = one request, applied optimistically and rolled back on error. */
export function useToggleFeature() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: FEATURE_MUTATION,
    mutationFn: (v: { key: A.FeatureKey; on: boolean }) => adminHttp.patch<A.AdminSettings>('/admin/settings', { features: { [v.key]: v.on } }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ak.settings });
      const prev = qc.getQueryData<A.AdminSettings>(ak.settings);
      qc.setQueryData<A.AdminSettings>(ak.settings, (s) => s && { ...s, features: { ...s.features, [v.key]: v.on } });
      return { prev };
    },
    onError: (e, v, ctx) => {
      qc.setQueryData<A.AdminSettings>(ak.settings, (s) => s && ctx?.prev && { ...s, features: { ...s.features, [v.key]: ctx.prev.features[v.key] } });
      toast(errText(e), 'error');
    },
    onSuccess: (r) => {
      // While other toggles are still in flight keep their optimistic values; otherwise take the server's truth.
      if (qc.isMutating({ mutationKey: FEATURE_MUTATION }) <= 1) qc.setQueryData(ak.settings, r);
      else qc.setQueryData<A.AdminSettings>(ak.settings, (s) => s && { ...s, updatedAt: r.updatedAt });
      mirrorPublic(r);
    },
  });
}

// ---------- Audit, staff ----------
export const useAuditLogs = (p: A.ListParams) => useList<A.AuditEntry>('audit', '/admin/audit-logs', p, { limit: 30 });

export const useAdminStaff = (enabled = true) =>
  useQuery({ queryKey: ak.staff, queryFn: ({ signal }) => adminHttp.get<A.AdminStaff[]>('/admin/staff', undefined, signal), staleTime: 5 * 60_000, enabled });

export const useCreateStaff = () =>
  useAction(
    (b: A.StaffInput) => adminHttp.post<A.AdminStaff>('/admin/staff', b),
    (qc, r) => qc.setQueryData<A.AdminStaff[]>(ak.staff, (l) => (l ? [...l, r] : l)),
    (r) => `${r.name} added as ${r.role.replace('_', ' ')}`,
  );

export const useUpdateStaff = () =>
  useAction(
    (v: { id: string; patch: A.StaffPatch }) => adminHttp.patch<A.AdminStaff>(`/admin/staff/${v.id}`, v.patch),
    (qc, r) => qc.setQueryData<A.AdminStaff[]>(ak.staff, (l) => l?.map((s) => (s.id === r.id ? r : s))),
    (_r, v) => (v.patch.resetMfa ? 'MFA reset — they will set it up again' : v.patch.status ? (v.patch.status === 'active' ? 'Account enabled' : 'Account disabled') : 'Role updated'),
  );

// ---------- Files ----------
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** CSV export (users | transactions | complaints) for an optional date range → file download. */
export const useExport = () =>
  useAction(
    async (v: { type: A.ExportType } & A.DateRange) => {
      const blob = await adminHttp.blob(`/admin/export/${v.type}`, { from: v.from, to: v.to });
      downloadBlob(blob, `worknear-${v.type}-${new Date().toISOString().slice(0, 10)}.csv`);
    },
    undefined,
    (_r, v) => `${v.type[0]!.toUpperCase()}${v.type.slice(1)} CSV downloaded`,
  );
