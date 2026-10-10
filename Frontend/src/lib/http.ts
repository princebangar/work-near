import { QueryClient } from '@tanstack/react-query';
import { env } from '@/config/env';
import { useAuth } from '@/store';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;
export interface ReqOpts { query?: Query; body?: unknown; signal?: AbortSignal }
export type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

const qs = (q?: Query) => {
  if (!q) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== '' && v !== false) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

async function request<T>(method: Method, path: string, opts: ReqOpts = {}): Promise<T> {
  if (env.useMock) {
    // Mock server is lazy-loaded so it never ships in a real-backend build.
    const { mockRequest } = await import('@/mocks/server');
    return mockRequest<T>(method, path, opts);
  }
  const token = useAuth.getState().token;
  const res = await fetch(env.apiUrl + path + qs(opts.query), {
    method,
    signal: opts.signal,
    headers: {
      Accept: 'application/json',
      ...(opts.body !== undefined && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) useAuth.getState().logout();
    throw new ApiError(res.status, json?.error?.code ?? 'UNKNOWN', json?.error?.message ?? 'Something went wrong');
  }
  return json.data as T;
}

export const http = {
  get: <T>(p: string, query?: Query, signal?: AbortSignal) => request<T>('GET', p, { query, signal }),
  post: <T>(p: string, body?: unknown) => request<T>('POST', p, { body }),
  patch: <T>(p: string, body?: unknown) => request<T>('PATCH', p, { body }),
  del: <T>(p: string) => request<T>('DELETE', p),
};

// Aggressive caching + no refetch-on-focus = no redundant network calls.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: (n, e) => !(e instanceof ApiError && e.status < 500) && n < 2,
    },
    mutations: { retry: false },
  },
});
