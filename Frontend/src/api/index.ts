// Data layer: fetchers + React Query hooks. UI-agnostic → reusable in React Native as-is.
// Cache policy: realtime changes arrive over the socket (hooks/useRealtime) and mutation results are written
// straight into the cache with setQueryData — so screens almost never need to refetch.
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ApiError, formData, http, queryClient } from '@/lib/http';
import { getPushToken, rememberPushToken, savedPushToken } from '@/lib/push';
import { useAuth, toast } from '@/store';
import type * as T from '@/types';

export const qk = {
  me: ['me'] as const,
  categories: ['categories'] as const,
  banners: ['banners'] as const,
  faqs: ['faqs'] as const,
  page: (slug: string) => ['pages', slug] as const,
  search: (p: Omit<T.WorkerSearchParams, 'cursor'>) => ['workers', 'search', p] as const,
  worker: (id: string, lat?: number, lng?: number) => ['workers', id, lat, lng] as const,
  workerDash: ['workers', 'me', 'dashboard'] as const,
  myWorker: ['workers', 'me', 'profile'] as const,
  myVerification: ['verification', 'me'] as const,
  reviewEligibility: (workerId: string) => ['reviews', 'eligibility', workerId] as const,
  conversations: ['conversations'] as const,
  messages: (id: string) => ['conversations', id, 'messages'] as const,
  notifications: ['notifications'] as const,
  plans: ['plans'] as const,
  mySub: ['subscription', 'me'] as const,
  payments: ['subscription', 'payments'] as const,
  complaints: ['complaints', 'me'] as const,
  blocked: ['blocked'] as const,
  addresses: ['me', 'addresses'] as const,
  admin: (k: string, p?: unknown) => ['admin', k, p] as const,
};

const STATIC = { staleTime: 30 * 60_000 }; // categories/plans/faqs/pages rarely change
const LIVE = { staleTime: 5 * 60_000 }; // kept fresh by socket events + mutation results

// ---------- Errors ----------
export const isApiError = (e: unknown, code?: string): e is ApiError => e instanceof ApiError && (!code || e.code === code);
export function errorMessage(e: unknown, fallback = 'Something went wrong. Please try again.') {
  if (e instanceof ApiError) return e.message || fallback;
  if (e instanceof TypeError) return 'Network error — check your internet connection.';
  return fallback;
}
export const toastError = (e: unknown, fallback?: string) => toast(errorMessage(e, fallback), 'error');
/** VALIDATION_ERROR details → first message per field. */
export function fieldErrors(e: unknown): Record<string, string> {
  if (!isApiError(e, 'VALIDATION_ERROR') || !e.details || typeof e.details !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(e.details as Record<string, unknown>)) {
    const msg = Array.isArray(v) ? v[0] : v;
    if (typeof msg === 'string') out[k] = msg;
  }
  return out;
}

// ---------- Me ----------
/** Writes a fresh User from the server into the auth store and the ['me'] cache. */
export function setUser(u: T.User) {
  useAuth.getState().updateUser(u);
  queryClient.setQueryData(qk.me, u);
}
/** Fetched once per app start (RequireAuth) to sync roles/status; later changes arrive via mutations. */
export const useMe = (enabled: boolean) => useQuery({ queryKey: qk.me, queryFn: () => http.get<T.User>('/me'), enabled, staleTime: Infinity });
export const useUpdateMe = () => useMutation({ mutationFn: (b: T.MePatch) => http.patch<T.User>('/me', b), onSuccess: (u) => setUser(u) });
export const useUploadAvatar = () =>
  useMutation({ mutationFn: (photo: File) => http.upload<T.User>('/me/avatar', formData({ photo })), onSuccess: (u) => setUser(u) });
export const useDeleteRequest = () => useMutation({ mutationFn: () => http.post<{ requested: boolean }>('/me/delete-request') });

// ---------- Auth ----------
export const useRequestOtp = () => useMutation({ mutationFn: (mobile: string) => http.post<T.OtpRequest>('/auth/request-otp', { mobile }) });
export const useVerifyOtp = () =>
  useMutation({ mutationFn: (b: { mobile: string; otp: string; acceptTerms?: boolean }) => http.post<T.Session>('/auth/verify-otp', b) });

// ---------- Catalog ----------
export const useCategories = () => useQuery({ queryKey: qk.categories, queryFn: () => http.get<T.Category[]>('/categories'), ...STATIC });
export const useBanners = (enabled = true) => useQuery({ queryKey: qk.banners, queryFn: () => http.get<T.Banner[]>('/banners'), enabled, ...STATIC });
export const useFaqs = () => useQuery({ queryKey: qk.faqs, queryFn: () => http.get<T.Faq[]>('/faqs'), ...STATIC });
export const useLegalPage = (slug: string) => useQuery({ queryKey: qk.page(slug), queryFn: () => http.get<T.LegalPage>(`/pages/${slug}`), ...STATIC });

// ---------- Workers ----------
export function useWorkerSearch(p: Omit<T.WorkerSearchParams, 'cursor'>, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.search(p),
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      http.get<T.Paginated<T.WorkerSummary>>(
        '/workers/search',
        {
          lat: p.lat, lng: p.lng, radius_km: p.radiusKm, q: p.q, category_id: p.categoryId, min_rating: p.minRating,
          verified_only: p.verifiedOnly, available_only: p.availableOnly, sort: p.sort, cursor: pageParam, limit: 20,
        },
        signal,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}
/** Public profile. Each fetch counts a profile view server-side → cached for 5 min. */
export const useWorker = (id: string, at?: { lat: number; lng: number }) =>
  useQuery({
    queryKey: qk.worker(id, at?.lat, at?.lng),
    queryFn: () => http.get<T.WorkerDetail>(`/workers/${id}`, at && { lat: at.lat, lng: at.lng }),
    enabled: !!id,
    ...LIVE,
  });
export const useWorkerDashboard = (enabled = true) =>
  useQuery({ queryKey: qk.workerDash, queryFn: () => http.get<T.WorkerDashboard>('/workers/me/dashboard'), enabled, retry: false });
export const useMyWorkerProfile = (enabled = true) =>
  useQuery({ queryKey: qk.myWorker, queryFn: () => http.get<T.MyWorkerProfile | null>('/workers/me/profile'), enabled, ...LIVE });

const patchMyWorker = (qc: QueryClient, p: Partial<T.MyWorkerProfile>) =>
  qc.setQueryData<T.MyWorkerProfile | null>(qk.myWorker, (w) => (w ? { ...w, ...p } : w));
const patchDash = (qc: QueryClient, p: Partial<T.WorkerDashboard>) =>
  qc.setQueryData<T.WorkerDashboard>(qk.workerDash, (d) => (d ? { ...d, ...p } : d));

export function useSaveWorkerProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: T.WorkerProfileInput) => http.patch<{ profile: T.MyWorkerProfile; user: T.User }>('/workers/profile', b),
    onSuccess: ({ profile, user }) => {
      setUser(user);
      qc.setQueryData(qk.myWorker, profile);
      qc.invalidateQueries({ queryKey: qk.workerDash });
    },
  });
}

/** Visibility / availability / phone-sharing switches — optimistic. */
export function useWorkerStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: Partial<T.WorkerStatus>) => http.patch<T.WorkerStatus>('/workers/me/status', b),
    onMutate: (b) => {
      const prev = { dash: qc.getQueryData<T.WorkerDashboard>(qk.workerDash), mine: qc.getQueryData<T.MyWorkerProfile | null>(qk.myWorker) };
      patchDash(qc, b);
      patchMyWorker(qc, b);
      return prev;
    },
    onSuccess: (s) => {
      patchDash(qc, { visible: s.visible, available: s.available });
      patchMyWorker(qc, s);
    },
    onError: (e, _b, prev) => {
      if (prev?.dash) qc.setQueryData(qk.workerDash, prev.dash);
      if (prev?.mine) qc.setQueryData(qk.myWorker, prev.mine);
      toastError(e);
    },
  });
}

export function useUploadWorkerPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (photo: File) => http.upload<{ photo: string }>('/workers/profile/photo', formData({ photo })),
    onSuccess: ({ photo }) => {
      patchMyWorker(qc, { photo });
      qc.invalidateQueries({ queryKey: qk.workerDash });
    },
  });
}
export function useUploadPortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (photos: File[]) => http.upload<{ portfolio: string[] }>('/workers/profile/portfolio', formData({ photos })),
    onSuccess: ({ portfolio }) => {
      patchMyWorker(qc, { portfolio });
      qc.invalidateQueries({ queryKey: qk.workerDash });
    },
  });
}
export function useDeletePortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => http.del<{ portfolio: string[] }>('/workers/profile/portfolio', { url }),
    onSuccess: ({ portfolio }) => {
      patchMyWorker(qc, { portfolio });
      qc.invalidateQueries({ queryKey: qk.workerDash });
    },
  });
}

export const useMyVerification = (enabled = true) =>
  useQuery({ queryKey: qk.myVerification, queryFn: () => http.get<T.MyVerification | null>('/verification/me'), enabled, ...LIVE });
export function useSubmitVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ type, files }: { type: T.VerificationType; files: File[] }) =>
      http.upload<{ id: string; status: T.VerificationStatus }>('/verification/submissions', formData({ documents: type === 'phone' ? [] : files }, { type })),
    onSuccess: () => {
      useAuth.getState().updateUser({ workerProfileStatus: 'pending' });
      qc.setQueryData<T.User>(qk.me, (u) => (u ? { ...u, workerProfileStatus: 'pending' } : u));
      patchDash(qc, { verification: 'pending', verificationReason: undefined });
      patchMyWorker(qc, { verificationStatus: 'pending' });
      qc.invalidateQueries({ queryKey: qk.myVerification });
    },
  });
}

// ---------- Chat ----------
/** The thread currently on screen (set by ChatThread) — lets realtime handlers know what the user is looking at. */
export const activeThread = { id: null as string | null };

export const useConversations = (enabled = true) =>
  useQuery({ queryKey: qk.conversations, queryFn: () => http.get<T.Conversation[]>('/conversations'), enabled, ...LIVE });

const previewOf = (m: T.Message) => (m.type === 'image' ? '📷 Photo' : m.text);

/** Updates one conversation in the list and moves it to the top (no refetch). */
export function bumpConversation(qc: QueryClient, id: string, patch: Partial<T.Conversation>, toTop = true) {
  qc.setQueryData<T.Conversation[]>(qk.conversations, (l) => {
    const c = l?.find((x) => x.id === id);
    if (!l || !c) return l;
    const next = { ...c, ...patch };
    return toTop ? [next, ...l.filter((x) => x.id !== id)] : l.map((x) => (x.id === id ? next : x));
  });
}
export function upsertConversation(qc: QueryClient, c: T.Conversation) {
  qc.setQueryData<T.Conversation[]>(qk.conversations, (l) => (l ? [c, ...l.filter((x) => x.id !== c.id)] : l));
}
/** Appends a message to a cached thread (ignored when the thread isn't cached or the message is already there). */
export function upsertMessage(qc: QueryClient, m: T.Message) {
  qc.setQueryData<T.Thread>(qk.messages(m.conversationId), (t) => (t && !t.items.some((x) => x.id === m.id) ? { ...t, items: [...t.items, m] } : t));
}
export const lastMessagePatch = (m: T.Message): Partial<T.Conversation> => ({ lastMessage: previewOf(m), lastMessageAt: m.sentAt });

function replaceTemp(qc: QueryClient, cid: string, tmpId: string, m: T.Message) {
  qc.setQueryData<T.Thread>(qk.messages(cid), (t) => {
    if (!t) return t;
    // The socket echo of my own message can arrive before the HTTP response — never show it twice.
    const dup = t.items.some((x) => x.id === m.id);
    return { ...t, items: dup ? t.items.filter((x) => x.id !== tmpId) : t.items.map((x) => (x.id === tmpId ? m : x)) };
  });
}
function patchTemp(qc: QueryClient, cid: string, tmpId: string, p: Partial<T.Message> | null) {
  qc.setQueryData<T.Thread>(qk.messages(cid), (t) =>
    t && { ...t, items: p ? t.items.map((x) => (x.id === tmpId ? { ...x, ...p } : x)) : t.items.filter((x) => x.id !== tmpId) },
  );
}

/** Latest 50 messages. The server marks the peer's messages read on this call → clear my unread badge locally. */
export function useThread(id: string) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: qk.messages(id),
    queryFn: async () => {
      const r = await http.get<T.Paginated<T.Message>>(`/conversations/${id}/messages`, { limit: 50 });
      bumpConversation(qc, id, { unread: 0 }, false);
      return { items: r.items, nextCursor: r.nextCursor } satisfies T.Thread;
    },
    ...LIVE,
  });
}
/** Loads the page before the oldest cached message and prepends it. */
export function useLoadOlder(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (before: string) => http.get<T.Paginated<T.Message>>(`/conversations/${id}/messages`, { before, limit: 50 }),
    onSuccess: (r) =>
      qc.setQueryData<T.Thread>(qk.messages(id), (t) => {
        if (!t) return t;
        const seen = new Set(t.items.map((m) => m.id));
        return { items: [...r.items.filter((m) => !seen.has(m.id)), ...t.items], nextCursor: r.nextCursor };
      }),
    onError: (e) => toastError(e),
  });
}
export function useMarkConversationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => http.post(`/conversations/${id}/read`),
    onMutate: (id) => bumpConversation(qc, id, { unread: 0 }, false),
  });
}

export function useStartConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (workerId: string) => http.post<T.Conversation>('/conversations', { workerId }),
    onSuccess: (c) => qc.setQueryData<T.Conversation[]>(qk.conversations, (l) => (l ? (l.some((x) => x.id === c.id) ? l : [c, ...l]) : l)),
  });
}

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ text }: { text: string; tmpId: string }) => http.post<T.Message>(`/conversations/${conversationId}/messages`, { text }),
    // Optimistic append — no refetch of the thread after sending.
    onMutate: ({ text, tmpId }) => {
      const senderId = useAuth.getState().user?.id ?? '';
      const tmp: T.Message = { id: tmpId, conversationId, senderId, type: 'text', text, sentAt: new Date().toISOString(), status: 'sending' };
      qc.setQueryData<T.Thread>(qk.messages(conversationId), (t) => ({ items: [...(t?.items.filter((x) => x.id !== tmpId) ?? []), tmp], nextCursor: t?.nextCursor ?? null }));
    },
    onSuccess: (m, { tmpId }) => {
      replaceTemp(qc, conversationId, tmpId, m);
      bumpConversation(qc, conversationId, lastMessagePatch(m));
    },
    onError: (e, { tmpId }) => {
      patchTemp(qc, conversationId, tmpId, { status: 'failed' });
      toastError(e, 'Message not sent');
    },
  });
}
export function useSendImage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, text }: { file: File; text: string; tmpId: string; preview: string }) =>
      http.upload<T.Message>(`/conversations/${conversationId}/images`, formData({ image: file }, { text: text || undefined })),
    onMutate: ({ text, tmpId, preview }) => {
      const senderId = useAuth.getState().user?.id ?? '';
      const tmp: T.Message = { id: tmpId, conversationId, senderId, type: 'image', text, image: preview, sentAt: new Date().toISOString(), status: 'sending' };
      qc.setQueryData<T.Thread>(qk.messages(conversationId), (t) => ({ items: [...(t?.items ?? []), tmp], nextCursor: t?.nextCursor ?? null }));
    },
    onSuccess: (m, { tmpId }) => {
      replaceTemp(qc, conversationId, tmpId, m);
      bumpConversation(qc, conversationId, lastMessagePatch(m));
    },
    onError: (e, { tmpId }) => {
      patchTemp(qc, conversationId, tmpId, null);
      toastError(e, 'Photo not sent');
    },
    onSettled: (_r, _e, { preview }) => URL.revokeObjectURL(preview),
  });
}

export function useUpdateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...b }: { id: string; muted?: boolean; blocked?: boolean }) => http.patch<T.Conversation>(`/conversations/${id}`, b),
    onSuccess: (c, b) => {
      qc.setQueryData<T.Conversation[]>(qk.conversations, (l) => l?.map((x) => (x.id === c.id ? c : x)));
      if (b.blocked !== undefined) afterBlockChange(qc, c.peer.id, b.blocked);
    },
    onError: (e) => toastError(e),
  });
}

// ---------- Notifications ----------
export const useNotifications = () =>
  useQuery({ queryKey: qk.notifications, queryFn: () => http.get<T.AppNotification[]>('/notifications'), ...LIVE });
export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string | 'all') => (id === 'all' ? http.post('/notifications/read-all') : http.patch(`/notifications/${id}/read`)),
    onMutate: (id) => {
      const prev = qc.getQueryData<T.AppNotification[]>(qk.notifications);
      qc.setQueryData<T.AppNotification[]>(qk.notifications, (l) => l?.map((n) => (id === 'all' || n.id === id ? { ...n, read: true } : n)));
      return prev;
    },
    onError: (e, _id, prev) => {
      if (prev) qc.setQueryData(qk.notifications, prev);
      toastError(e);
    },
  });
}

// ---------- Subscription ----------
export const usePlans = (enabled = true) => useQuery({ queryKey: qk.plans, queryFn: () => http.get<T.Plan[]>('/subscription/plans'), enabled, ...STATIC });
export const useMySubscription = (enabled = true) =>
  useQuery({ queryKey: qk.mySub, queryFn: () => http.get<T.Subscription>('/subscription/me'), enabled, ...LIVE });
export const usePayments = (enabled = true) =>
  useQuery({ queryKey: qk.payments, queryFn: () => http.get<T.PaymentReceipt[]>('/subscription/payments'), enabled, ...LIVE });
/** Creates a pending order. The plan is NOT activated here — only by /subscription/verify on the server. */
export const useCheckout = () => useMutation({ mutationFn: (planId: string) => http.post<T.CheckoutOrder>('/subscription/checkout', { planId }) });
export function useVerifyPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: T.VerifyPaymentBody) => http.post<T.VerifyPaymentResult>('/subscription/verify', b),
    onSuccess: (r) => qc.setQueryData(qk.mySub, r.subscription),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.payments }),
  });
}

// ---------- Trust & safety ----------
export const useReviewEligibility = (workerId: string, enabled: boolean) =>
  useQuery({
    queryKey: qk.reviewEligibility(workerId),
    queryFn: () => http.get<{ eligible: boolean; reason?: string }>('/reviews/eligibility', { workerId }),
    enabled: enabled && !!workerId,
    ...LIVE,
  });
export function useSubmitReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { workerId: string; stars: number; text: string }) => http.post<{ id: string }>('/reviews', b),
    onSuccess: (_r, b) => {
      qc.setQueryData(qk.reviewEligibility(b.workerId), { eligible: false, reason: 'You have already reviewed this worker.' });
      qc.setQueryData<T.Conversation[]>(qk.conversations, (l) =>
        l?.map((c) => (c.peer.id === b.workerId && c.myRole === 'customer' ? { ...c, canReview: false, reviewed: true } : c)),
      );
      qc.invalidateQueries({ queryKey: ['workers', b.workerId] });
    },
  });
}
export const useReport = () =>
  useMutation({ mutationFn: (b: { targetType: T.ReportTarget; targetId: string; reason: string; details?: string }) => http.post<{ id: string }>('/reports', b) });

export const useMyComplaints = (enabled = true) =>
  useQuery({ queryKey: qk.complaints, queryFn: () => http.get<T.Complaint[]>('/complaints/me'), enabled, ...LIVE });
export function useCreateComplaint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ files, ...b }: { category: string; description: string; targetType?: T.Complaint['targetType']; targetId?: string; files: File[] }) =>
      files.length
        ? http.upload<T.Complaint>('/complaints', formData({ evidence: files }, b))
        : http.post<T.Complaint>('/complaints', b),
    onSuccess: (c) => qc.setQueryData<T.Complaint[]>(qk.complaints, (l) => (l ? [c, ...l] : l)),
  });
}

export const useBlocked = () => useQuery({ queryKey: qk.blocked, queryFn: () => http.get<T.Peer[]>('/blocked'), ...LIVE });

/** Keeps chats / blocked list / search results consistent after (un)blocking someone. */
function afterBlockChange(qc: QueryClient, userId: string, blocked: boolean) {
  qc.setQueryData<T.Conversation[]>(qk.conversations, (l) => l?.map((c) => (c.peer.id === userId ? { ...c, blocked } : c)));
  if (!blocked) qc.setQueryData<T.Peer[]>(qk.blocked, (l) => l?.filter((p) => p.id !== userId));
  else qc.invalidateQueries({ queryKey: qk.blocked });
  // Blocked users are hidden from search server-side.
  qc.invalidateQueries({ queryKey: ['workers', 'search'] });
}
export function useBlockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => http.post('/blocks', { userId }),
    onSuccess: (_r, userId) => afterBlockChange(qc, userId, true),
  });
}
export function useUnblockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => http.del(`/blocks/${userId}`),
    onSuccess: (_r, userId) => afterBlockChange(qc, userId, false),
    onError: (e) => toastError(e),
  });
}

// ---------- Push notifications ----------
/** Gets the FCM token (asking permission only if prompt=true) and registers it — skips the API call when unchanged. */
export const useEnablePush = () =>
  useMutation({
    mutationFn: async (prompt: boolean) => {
      const token = await getPushToken(prompt);
      if (token && token !== savedPushToken()) {
        await http.post('/me/push-tokens', { token, platform: 'web' });
        rememberPushToken(token);
      }
      return token;
    },
  });

/** Call before logout so this device stops receiving the user's notifications. */
export function unregisterPush() {
  const token = savedPushToken();
  if (!token) return Promise.resolve();
  rememberPushToken(null);
  return http.del('/me/push-tokens', { token }).catch(() => undefined);
}

// ---------- Admin (legacy helpers still used by features/admin.tsx) ----------
export const useAdminLogin = () =>
  useMutation({ mutationFn: (b: { email: string; password: string; otp: string }) => http.post<{ token: string; name: string; role: T.AdminRole }>('/admin/auth/login', b) });
export const useAdminList = <R,>(key: string, path: string, query?: Record<string, string | undefined>) =>
  useQuery({ queryKey: qk.admin(key, query), queryFn: () => http.get<R>(path, query) });
export function useAdminPatch<R extends { id: string }>(key: string, base: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...b }: { id: string } & Record<string, unknown>) => http.patch<R>(`${base}/${id}`, b),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', key] }),
  });
}

// ---------- Saved addresses (location picker) ----------
export const useAddresses = (enabled = true) =>
  useQuery({ queryKey: qk.addresses, queryFn: () => http.get<T.SavedAddress[]>('/me/addresses'), enabled, ...LIVE });

export function useSaveAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: T.AddressInput }) =>
      id ? http.patch<T.SavedAddress[]>(`/me/addresses/${id}`, body) : http.post<T.SavedAddress[]>('/me/addresses', body),
    onSuccess: (list) => qc.setQueryData(qk.addresses, list),
    onError: (e) => toastError(e),
  });
}

export function useDeleteAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => http.del<T.SavedAddress[]>(`/me/addresses/${id}`),
    onSuccess: (list) => qc.setQueryData(qk.addresses, list),
    onError: (e) => toastError(e),
  });
}
