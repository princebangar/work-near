// Data layer: port of Frontend/src/api/index.ts — same endpoints, cache keys and cache-update rules.
// Realtime changes arrive over the socket (hooks/useRealtime) and mutation results are written straight into the cache.
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, NetworkError, formData, http, queryClient } from '@/lib/http';
import { getPushToken, rememberPushToken, savedPushToken } from '@/lib/push';
import { useAuth, toast } from '@/store';

export const qk = {
  me: ['me'],
  categories: ['categories'],
  banners: ['banners'],
  faqs: ['faqs'],
  page: (slug) => ['pages', slug],
  search: (p) => ['workers', 'search', p],
  worker: (id, lat, lng) => ['workers', id, lat, lng],
  workerDash: ['workers', 'me', 'dashboard'],
  myWorker: ['workers', 'me', 'profile'],
  myVerification: ['verification', 'me'],
  reviewEligibility: (workerId) => ['reviews', 'eligibility', workerId],
  conversations: ['conversations'],
  messages: (id) => ['conversations', id, 'messages'],
  notifications: ['notifications'],
  plans: ['plans'],
  mySub: ['subscription', 'me'],
  payments: ['subscription', 'payments'],
  complaints: ['complaints', 'me'],
  blocked: ['blocked'],
  addresses: ['me', 'addresses'],
};

const STATIC = { staleTime: 30 * 60_000 }; // categories/plans/faqs/pages rarely change
const LIVE = { staleTime: 5 * 60_000 }; // kept fresh by socket events + mutation results

// ---------- Errors ----------
export const isApiError = (e, code) => e instanceof ApiError && (!code || e.code === code);
export function errorMessage(e, fallback = 'Something went wrong. Please try again.') {
  if (e instanceof ApiError) return e.message || fallback;
  if (e instanceof NetworkError || e instanceof TypeError) return 'Network error — check your internet connection.';
  return fallback;
}
export const toastError = (e, fallback) => toast(errorMessage(e, fallback), 'error');
/** VALIDATION_ERROR details → first message per field. */
export function fieldErrors(e) {
  if (!isApiError(e, 'VALIDATION_ERROR') || !e.details || typeof e.details !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(e.details)) {
    const msg = Array.isArray(v) ? v[0] : v;
    if (typeof msg === 'string') out[k] = msg;
  }
  return out;
}

// ---------- Me ----------
/** Writes a fresh User from the server into the auth store and the ['me'] cache. */
export function setUser(u) {
  useAuth.getState().updateUser(u);
  queryClient.setQueryData(qk.me, u);
}
/** Fetched once per app start (RequireAuth) to sync roles/status; later changes arrive via mutations. */
export const useMe = (enabled) => useQuery({ queryKey: qk.me, queryFn: () => http.get('/me'), enabled, staleTime: Infinity });
export const useUpdateMe = () => useMutation({ mutationFn: (b) => http.patch('/me', b), onSuccess: (u) => setUser(u) });
export const useUploadAvatar = () => useMutation({ mutationFn: (photo) => http.upload('/me/avatar', formData({ photo })), onSuccess: (u) => setUser(u) });
export const useDeleteRequest = () => useMutation({ mutationFn: () => http.post('/me/delete-request') });

// ---------- Auth ----------
export const useRequestOtp = () => useMutation({ mutationFn: (mobile) => http.post('/auth/request-otp', { mobile }) });
export const useVerifyOtp = () => useMutation({ mutationFn: (b) => http.post('/auth/verify-otp', b) });

// ---------- Catalog ----------
export const useCategories = () => useQuery({ queryKey: qk.categories, queryFn: () => http.get('/categories'), ...STATIC });
export const useBanners = (enabled = true) => useQuery({ queryKey: qk.banners, queryFn: () => http.get('/banners'), enabled, ...STATIC });
export const useFaqs = () => useQuery({ queryKey: qk.faqs, queryFn: () => http.get('/faqs'), ...STATIC });
export const useLegalPage = (slug) => useQuery({ queryKey: qk.page(slug), queryFn: () => http.get(`/pages/${slug}`), ...STATIC });

// ---------- Workers ----------
export function useWorkerSearch(p, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.search(p),
    enabled,
    initialPageParam: undefined,
    queryFn: ({ pageParam, signal }) =>
      http.get(
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
export const useWorker = (id, at) =>
  useQuery({ queryKey: qk.worker(id, at?.lat, at?.lng), queryFn: () => http.get(`/workers/${id}`, at && { lat: at.lat, lng: at.lng }), enabled: !!id, ...LIVE });
export const useWorkerDashboard = (enabled = true) =>
  useQuery({ queryKey: qk.workerDash, queryFn: () => http.get('/workers/me/dashboard'), enabled, retry: false });
export const useMyWorkerProfile = (enabled = true) =>
  useQuery({ queryKey: qk.myWorker, queryFn: () => http.get('/workers/me/profile'), enabled, ...LIVE });

const patchMyWorker = (qc, p) => qc.setQueryData(qk.myWorker, (w) => (w ? { ...w, ...p } : w));
const patchDash = (qc, p) => qc.setQueryData(qk.workerDash, (d) => (d ? { ...d, ...p } : d));

export function useSaveWorkerProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b) => http.patch('/workers/profile', b),
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
    mutationFn: (b) => http.patch('/workers/me/status', b),
    onMutate: (b) => {
      const prev = { dash: qc.getQueryData(qk.workerDash), mine: qc.getQueryData(qk.myWorker) };
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
    mutationFn: (photo) => http.upload('/workers/profile/photo', formData({ photo })),
    onSuccess: ({ photo }) => {
      patchMyWorker(qc, { photo });
      qc.invalidateQueries({ queryKey: qk.workerDash });
    },
  });
}
export function useUploadPortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (photos) => http.upload('/workers/profile/portfolio', formData({ photos })),
    onSuccess: ({ portfolio }) => {
      patchMyWorker(qc, { portfolio });
      qc.invalidateQueries({ queryKey: qk.workerDash });
    },
  });
}
export function useDeletePortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (url) => http.del('/workers/profile/portfolio', { url }),
    onSuccess: ({ portfolio }) => {
      patchMyWorker(qc, { portfolio });
      qc.invalidateQueries({ queryKey: qk.workerDash });
    },
  });
}

export const useMyVerification = (enabled = true) =>
  useQuery({ queryKey: qk.myVerification, queryFn: () => http.get('/verification/me'), enabled, ...LIVE });
export function useSubmitVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ type, files }) => http.upload('/verification/submissions', formData({ documents: type === 'phone' ? [] : files }, { type })),
    onSuccess: () => {
      useAuth.getState().updateUser({ workerProfileStatus: 'pending' });
      qc.setQueryData(qk.me, (u) => (u ? { ...u, workerProfileStatus: 'pending' } : u));
      patchDash(qc, { verification: 'pending', verificationReason: undefined });
      patchMyWorker(qc, { verificationStatus: 'pending' });
      qc.invalidateQueries({ queryKey: qk.myVerification });
    },
  });
}

// ---------- Chat ----------
/** The thread currently on screen (set by ChatThread) — lets realtime handlers know what the user is looking at. */
export const activeThread = { id: null };

export const useConversations = (enabled = true) =>
  useQuery({ queryKey: qk.conversations, queryFn: () => http.get('/conversations'), enabled, ...LIVE });

const previewOf = (m) => (m.type === 'image' ? '📷 Photo' : m.text);

/** Updates one conversation in the list and moves it to the top (no refetch). */
export function bumpConversation(qc, id, patch, toTop = true) {
  qc.setQueryData(qk.conversations, (l) => {
    const c = l?.find((x) => x.id === id);
    if (!l || !c) return l;
    const next = { ...c, ...patch };
    return toTop ? [next, ...l.filter((x) => x.id !== id)] : l.map((x) => (x.id === id ? next : x));
  });
}
export function upsertConversation(qc, c) {
  qc.setQueryData(qk.conversations, (l) => (l ? [c, ...l.filter((x) => x.id !== c.id)] : l));
}
/** Appends a message to a cached thread (ignored when the thread isn't cached or the message is already there). */
export function upsertMessage(qc, m) {
  qc.setQueryData(qk.messages(m.conversationId), (t) => (t && !t.items.some((x) => x.id === m.id) ? { ...t, items: [...t.items, m] } : t));
}
export const lastMessagePatch = (m) => ({ lastMessage: previewOf(m), lastMessageAt: m.sentAt });

function replaceTemp(qc, cid, tmpId, m) {
  qc.setQueryData(qk.messages(cid), (t) => {
    if (!t) return t;
    // The socket echo of my own message can arrive before the HTTP response — never show it twice.
    const dup = t.items.some((x) => x.id === m.id);
    return { ...t, items: dup ? t.items.filter((x) => x.id !== tmpId) : t.items.map((x) => (x.id === tmpId ? m : x)) };
  });
}
function patchTemp(qc, cid, tmpId, p) {
  qc.setQueryData(qk.messages(cid), (t) => t && { ...t, items: p ? t.items.map((x) => (x.id === tmpId ? { ...x, ...p } : x)) : t.items.filter((x) => x.id !== tmpId) });
}

/** Latest 50 messages. The server marks the peer's messages read on this call → clear my unread badge locally. */
export function useThread(id) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: qk.messages(id),
    queryFn: async () => {
      const r = await http.get(`/conversations/${id}/messages`, { limit: 50 });
      bumpConversation(qc, id, { unread: 0 }, false);
      return { items: r.items, nextCursor: r.nextCursor };
    },
    ...LIVE,
  });
}
/** Loads the page before the oldest cached message and prepends it. */
export function useLoadOlder(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (before) => http.get(`/conversations/${id}/messages`, { before, limit: 50 }),
    onSuccess: (r) =>
      qc.setQueryData(qk.messages(id), (t) => {
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
    mutationFn: (id) => http.post(`/conversations/${id}/read`),
    onMutate: (id) => bumpConversation(qc, id, { unread: 0 }, false),
  });
}

export function useStartConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (workerId) => http.post('/conversations', { workerId }),
    onSuccess: (c) => qc.setQueryData(qk.conversations, (l) => (l ? (l.some((x) => x.id === c.id) ? l : [c, ...l]) : l)),
  });
}

export function useSendMessage(conversationId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ text }) => http.post(`/conversations/${conversationId}/messages`, { text }),
    // Optimistic append — no refetch of the thread after sending.
    onMutate: ({ text, tmpId }) => {
      const senderId = useAuth.getState().user?.id ?? '';
      const tmp = { id: tmpId, conversationId, senderId, type: 'text', text, sentAt: new Date().toISOString(), status: 'sending' };
      qc.setQueryData(qk.messages(conversationId), (t) => ({ items: [...(t?.items.filter((x) => x.id !== tmpId) ?? []), tmp], nextCursor: t?.nextCursor ?? null }));
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
export function useSendImage(conversationId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, text }) => http.upload(`/conversations/${conversationId}/images`, formData({ image: file }, { text: text || undefined })),
    onMutate: ({ text, tmpId, file }) => {
      const senderId = useAuth.getState().user?.id ?? '';
      const tmp = { id: tmpId, conversationId, senderId, type: 'image', text, image: file.uri, sentAt: new Date().toISOString(), status: 'sending' };
      qc.setQueryData(qk.messages(conversationId), (t) => ({ items: [...(t?.items ?? []), tmp], nextCursor: t?.nextCursor ?? null }));
    },
    onSuccess: (m, { tmpId }) => {
      replaceTemp(qc, conversationId, tmpId, m);
      bumpConversation(qc, conversationId, lastMessagePatch(m));
    },
    onError: (e, { tmpId }) => {
      patchTemp(qc, conversationId, tmpId, null);
      toastError(e, 'Photo not sent');
    },
  });
}

export function useUpdateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...b }) => http.patch(`/conversations/${id}`, b),
    onSuccess: (c, b) => {
      qc.setQueryData(qk.conversations, (l) => l?.map((x) => (x.id === c.id ? c : x)));
      if (b.blocked !== undefined) afterBlockChange(qc, c.peer.id, b.blocked);
    },
    onError: (e) => toastError(e),
  });
}

// ---------- Notifications ----------
export const useNotifications = () => useQuery({ queryKey: qk.notifications, queryFn: () => http.get('/notifications'), ...LIVE });
export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => (id === 'all' ? http.post('/notifications/read-all') : http.patch(`/notifications/${id}/read`)),
    onMutate: (id) => {
      const prev = qc.getQueryData(qk.notifications);
      qc.setQueryData(qk.notifications, (l) => l?.map((n) => (id === 'all' || n.id === id ? { ...n, read: true } : n)));
      return prev;
    },
    onError: (e, _id, prev) => {
      if (prev) qc.setQueryData(qk.notifications, prev);
      toastError(e);
    },
  });
}

// ---------- Subscription ----------
export const usePlans = (enabled = true) => useQuery({ queryKey: qk.plans, queryFn: () => http.get('/subscription/plans'), enabled, ...STATIC });
export const useMySubscription = (enabled = true) => useQuery({ queryKey: qk.mySub, queryFn: () => http.get('/subscription/me'), enabled, ...LIVE });
export const usePayments = (enabled = true) => useQuery({ queryKey: qk.payments, queryFn: () => http.get('/subscription/payments'), enabled, ...LIVE });
/** Creates a pending order. The plan is NOT activated here — only by /subscription/verify on the server. */
export const useCheckout = () => useMutation({ mutationFn: (planId) => http.post('/subscription/checkout', { planId }) });
export function useVerifyPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b) => http.post('/subscription/verify', b),
    onSuccess: (r) => qc.setQueryData(qk.mySub, r.subscription),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.payments }),
  });
}

// ---------- Trust & safety ----------
export const useReviewEligibility = (workerId, enabled) =>
  useQuery({ queryKey: qk.reviewEligibility(workerId), queryFn: () => http.get('/reviews/eligibility', { workerId }), enabled: enabled && !!workerId, ...LIVE });
export function useSubmitReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b) => http.post('/reviews', b),
    onSuccess: (_r, b) => {
      qc.setQueryData(qk.reviewEligibility(b.workerId), { eligible: false, reason: 'You have already reviewed this worker.' });
      qc.setQueryData(qk.conversations, (l) => l?.map((c) => (c.peer.id === b.workerId && c.myRole === 'customer' ? { ...c, canReview: false, reviewed: true } : c)));
      qc.invalidateQueries({ queryKey: ['workers', b.workerId] });
    },
  });
}
export const useReport = () => useMutation({ mutationFn: (b) => http.post('/reports', b) });

export const useMyComplaints = (enabled = true) => useQuery({ queryKey: qk.complaints, queryFn: () => http.get('/complaints/me'), enabled, ...LIVE });
export function useCreateComplaint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ files, ...b }) => (files.length ? http.upload('/complaints', formData({ evidence: files }, b)) : http.post('/complaints', b)),
    onSuccess: (c) => qc.setQueryData(qk.complaints, (l) => (l ? [c, ...l] : l)),
  });
}

export const useBlocked = () => useQuery({ queryKey: qk.blocked, queryFn: () => http.get('/blocked'), ...LIVE });

/** Keeps chats / blocked list / search results consistent after (un)blocking someone. */
function afterBlockChange(qc, userId, blocked) {
  qc.setQueryData(qk.conversations, (l) => l?.map((c) => (c.peer.id === userId ? { ...c, blocked } : c)));
  if (!blocked) qc.setQueryData(qk.blocked, (l) => l?.filter((p) => p.id !== userId));
  else qc.invalidateQueries({ queryKey: qk.blocked });
  // Blocked users are hidden from search server-side.
  qc.invalidateQueries({ queryKey: ['workers', 'search'] });
}
export function useBlockUser() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (userId) => http.post('/blocks', { userId }), onSuccess: (_r, userId) => afterBlockChange(qc, userId, true) });
}
export function useUnblockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId) => http.del(`/blocks/${userId}`),
    onSuccess: (_r, userId) => afterBlockChange(qc, userId, false),
    onError: (e) => toastError(e),
  });
}

// ---------- Push notifications ----------
/** Gets the FCM token (asking permission only if prompt=true) and registers it — skips the API call when unchanged. */
export const useEnablePush = () =>
  useMutation({
    mutationFn: async (prompt) => {
      const token = await getPushToken(prompt);
      if (token && token !== (await savedPushToken())) {
        await http.post('/me/push-tokens', { token, platform: 'android' });
        await rememberPushToken(token);
      }
      return token;
    },
  });

/** Call before logout so this device stops receiving the user's notifications. */
export async function unregisterPush() {
  const token = await savedPushToken();
  if (!token) return;
  await rememberPushToken(null);
  await http.del('/me/push-tokens', { token }).catch(() => undefined);
}

// ---------- Saved addresses (location picker) ----------
export const useAddresses = (enabled = true) => useQuery({ queryKey: qk.addresses, queryFn: () => http.get('/me/addresses'), enabled, ...LIVE });
export function useSaveAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => (id ? http.patch(`/me/addresses/${id}`, body) : http.post('/me/addresses', body)),
    onSuccess: (list) => qc.setQueryData(qk.addresses, list),
    onError: (e) => toastError(e),
  });
}
export function useDeleteAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => http.del(`/me/addresses/${id}`),
    onSuccess: (list) => qc.setQueryData(qk.addresses, list),
    onError: (e) => toastError(e),
  });
}
