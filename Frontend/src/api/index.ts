// Data layer: fetchers + React Query hooks. UI-agnostic → reusable in React Native as-is.
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/lib/http';
import type * as T from '@/types';

export const qk = {
  categories: ['categories'] as const,
  banners: ['banners'] as const,
  faqs: ['faqs'] as const,
  search: (p: Omit<T.WorkerSearchParams, 'cursor'>) => ['workers', 'search', p] as const,
  worker: (id: string) => ['workers', id] as const,
  workerDash: ['workers', 'me', 'dashboard'] as const,
  conversations: ['conversations'] as const,
  messages: (id: string) => ['conversations', id, 'messages'] as const,
  notifications: ['notifications'] as const,
  plans: ['plans'] as const,
  mySub: ['subscription', 'me'] as const,
  complaints: ['complaints', 'me'] as const,
  blocked: ['blocked'] as const,
  admin: (k: string, p?: unknown) => ['admin', k, p] as const,
};

const STATIC = { staleTime: 30 * 60_000 }; // categories/plans/faqs rarely change

// ---------- Auth ----------
export const useRequestOtp = () => useMutation({ mutationFn: (mobile: string) => http.post<{ expiresIn: number; resendAfter: number }>('/auth/request-otp', { mobile }) });
export const useVerifyOtp = () => useMutation({ mutationFn: (b: { mobile: string; otp: string }) => http.post<T.Session>('/auth/verify-otp', b) });
export const useUpdateMe = () => useMutation({ mutationFn: (b: Partial<T.User>) => http.patch<Partial<T.User>>('/me', b) });

// ---------- Catalog ----------
export const useCategories = () => useQuery({ queryKey: qk.categories, queryFn: () => http.get<T.Category[]>('/categories'), ...STATIC });
export const useBanners = () => useQuery({ queryKey: qk.banners, queryFn: () => http.get<T.Banner[]>('/banners'), ...STATIC });
export const useFaqs = () => useQuery({ queryKey: qk.faqs, queryFn: () => http.get<T.Faq[]>('/faqs'), ...STATIC });

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
          verified_only: p.verifiedOnly, available_only: p.availableOnly, sort: p.sort, cursor: pageParam,
        },
        signal,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}
export const useWorker = (id: string) => useQuery({ queryKey: qk.worker(id), queryFn: () => http.get<T.WorkerDetail>(`/workers/${id}`) });
export const useWorkerDashboard = () => useQuery({ queryKey: qk.workerDash, queryFn: () => http.get<T.WorkerDashboard>('/workers/me/dashboard') });
export const useSaveWorkerProfile = () => useMutation({ mutationFn: (b: Record<string, unknown>) => http.patch('/workers/profile', b) });
export const useSubmitVerification = () => useMutation({ mutationFn: (b: { type: T.VerificationType; documents: string[] }) => http.post('/verification/submissions', b) });

// ---------- Chat ----------
export const useConversations = () => useQuery({ queryKey: qk.conversations, queryFn: () => http.get<T.Conversation[]>('/conversations'), staleTime: 15_000 });
export const useMessages = (id: string) =>
  useQuery({ queryKey: qk.messages(id), queryFn: () => http.get<T.Paginated<T.Message>>(`/conversations/${id}/messages`).then((r) => r.items) });

export function useStartConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (workerId: string) => http.post<T.Conversation>('/conversations', { workerId }),
    onSuccess: (c) => qc.setQueryData<T.Conversation[]>(qk.conversations, (l) => (l?.some((x) => x.id === c.id) ? l : [c, ...(l ?? [])])),
  });
}

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => http.post<T.Message>(`/conversations/${conversationId}/messages`, { text }),
    // Optimistic append — no refetch of the thread after sending.
    onMutate: (text) => {
      const tmp: T.Message = { id: `tmp-${Date.now()}`, conversationId, senderId: 'me', text, sentAt: new Date().toISOString(), status: 'sent' };
      qc.setQueryData<T.Message[]>(qk.messages(conversationId), (l) => [...(l ?? []), tmp]);
      return { tmpId: tmp.id };
    },
    onSuccess: (m, _v, ctx) => {
      qc.setQueryData<T.Message[]>(qk.messages(conversationId), (l) => l?.map((x) => (x.id === ctx?.tmpId ? m : x)));
      qc.setQueryData<T.Conversation[]>(qk.conversations, (l) => l?.map((c) => (c.id === conversationId ? { ...c, lastMessage: m.text, lastMessageAt: m.sentAt } : c)));
    },
  });
}

export function useUpdateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...b }: { id: string; muted?: boolean; blocked?: boolean }) => http.patch<T.Conversation>(`/conversations/${id}`, b),
    onSuccess: (c) => {
      qc.setQueryData<T.Conversation[]>(qk.conversations, (l) => l?.map((x) => (x.id === c.id ? c : x)));
      qc.invalidateQueries({ queryKey: qk.blocked });
    },
  });
}

// ---------- Notifications ----------
export const useNotifications = () => useQuery({ queryKey: qk.notifications, queryFn: () => http.get<T.AppNotification[]>('/notifications'), staleTime: 30_000 });
export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string | 'all') => (id === 'all' ? http.post('/notifications/read-all') : http.patch(`/notifications/${id}/read`)),
    onMutate: (id) => qc.setQueryData<T.AppNotification[]>(qk.notifications, (l) => l?.map((n) => (id === 'all' || n.id === id ? { ...n, read: true } : n))),
  });
}

// ---------- Subscription ----------
export const usePlans = () => useQuery({ queryKey: qk.plans, queryFn: () => http.get<T.Plan[]>('/subscription/plans'), ...STATIC });
export const useMySubscription = () => useQuery({ queryKey: qk.mySub, queryFn: () => http.get<T.Subscription>('/subscription/me') });
export function useCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) => http.post<T.Subscription>('/subscription/checkout', { planId }),
    onSuccess: (s) => qc.setQueryData(qk.mySub, s),
  });
}

// ---------- Trust & safety ----------
export const useSubmitReview = () => useMutation({ mutationFn: (b: { workerId: string; stars: number; text: string }) => http.post('/reviews', b) });
export const useReport = () => useMutation({ mutationFn: (b: { targetType: string; targetId: string; reason: string; details?: string }) => http.post('/reports', b) });
export const useMyComplaints = () => useQuery({ queryKey: qk.complaints, queryFn: () => http.get<T.Complaint[]>('/complaints/me') });
export function useCreateComplaint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: Pick<T.Complaint, 'category' | 'targetType' | 'description'>) => http.post<T.Complaint>('/complaints', b),
    onSuccess: (c) => qc.setQueryData<T.Complaint[]>(qk.complaints, (l) => [c, ...(l ?? [])]),
  });
}
export const useBlocked = () => useQuery({ queryKey: qk.blocked, queryFn: () => http.get<T.Peer[]>('/blocked') });

// ---------- Admin ----------
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
