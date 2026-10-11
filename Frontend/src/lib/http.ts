import { QueryClient } from '@tanstack/react-query';
import { env } from '@/config/env';
import { useAuth, useSettings } from '@/store';
import type { AppSettings } from '@/types';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;
/** `scope: 'admin'` sends the admin-panel token instead of the app user's token. */
export interface ReqOpts { query?: Query; body?: unknown; signal?: AbortSignal; scope?: 'user' | 'admin' }
export type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

const qs = (q?: Query) => {
  if (!q) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== '' && v !== false) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

// Single-flight refresh: parallel 401s share one /auth/refresh call.
let refreshing: Promise<boolean> | null = null;
function refreshSession() {
  return (refreshing ??= (async () => {
    const rt = useAuth.getState().refreshToken;
    if (!rt) return false;
    try {
      const r = await fetch(env.apiUrl + '/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: rt }) });
      if (!r.ok) return false;
      const { data } = (await r.json()) as { data: { token: string; refreshToken: string } };
      useAuth.getState().setTokens(data.token, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })());
}

async function raw(method: Method, path: string, opts: ReqOpts = {}, retried = false): Promise<Response> {
  const s = useAuth.getState();
  const token = opts.scope === 'admin' ? s.admin?.token : s.token;
  const isForm = opts.body instanceof FormData;
  const res = await fetch(env.apiUrl + path + qs(opts.query), {
    method,
    signal: opts.signal,
    headers: {
      Accept: 'application/json',
      ...(opts.body !== undefined && !isForm && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
  });
  // Access token expired → refresh once with the refresh token and replay the request.
  if (res.status === 401 && opts.scope !== 'admin' && !retried && s.refreshToken && !path.startsWith('/auth/') && (await refreshSession())) {
    return raw(method, path, opts, true);
  }
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    const err = json?.error ?? {};
    if (res.status === 401) opts.scope === 'admin' ? s.setAdmin(null) : s.token && s.logout();
    // Maintenance switched on by admin → app shows the maintenance screen immediately.
    if (res.status === 503 && err.code === 'MAINTENANCE' && opts.scope !== 'admin') {
      useSettings.getState().patch({ maintenance: err.details?.maintenance } as Partial<AppSettings>);
    }
    if (res.status === 403 && err.code === 'SUSPENDED') s.logout();
    throw new ApiError(res.status, err.code ?? 'UNKNOWN', err.message ?? 'Something went wrong', err.details);
  }
  return res;
}

async function request<T>(method: Method, path: string, opts: ReqOpts = {}): Promise<T> {
  const res = await raw(method, path, opts);
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({}));
  return json.data as T;
}

export const http = {
  get: <T>(p: string, query?: Query, signal?: AbortSignal) => request<T>('GET', p, { query, signal }),
  post: <T>(p: string, body?: unknown) => request<T>('POST', p, { body }),
  patch: <T>(p: string, body?: unknown) => request<T>('PATCH', p, { body }),
  put: <T>(p: string, body?: unknown) => request<T>('PUT', p, { body }),
  del: <T>(p: string, body?: unknown) => request<T>('DELETE', p, { body }),
  /** multipart/form-data upload. Pass files under the field name the endpoint expects. */
  upload: <T>(p: string, form: FormData) => request<T>('POST', p, { body: form }),
};

/** Same API for the admin panel — always sends the admin token. */
export const adminHttp = {
  get: <T>(p: string, query?: Query, signal?: AbortSignal) => request<T>('GET', p, { query, signal, scope: 'admin' }),
  post: <T>(p: string, body?: unknown) => request<T>('POST', p, { body, scope: 'admin' }),
  patch: <T>(p: string, body?: unknown) => request<T>('PATCH', p, { body, scope: 'admin' }),
  put: <T>(p: string, body?: unknown) => request<T>('PUT', p, { body, scope: 'admin' }),
  del: <T>(p: string, body?: unknown) => request<T>('DELETE', p, { body, scope: 'admin' }),
  upload: <T>(p: string, form: FormData) => request<T>('POST', p, { body: form, scope: 'admin' }),
  /** Authenticated file download (private documents, CSV export) → Blob. */
  blob: async (p: string, query?: Query) => (await raw('GET', p, { query, scope: 'admin' })).blob(),
};

/** Builds a FormData from files + plain fields. */
export function formData(files: Record<string, File | File[] | undefined | null>, fields: Record<string, string | number | boolean | undefined> = {}) {
  const f = new FormData();
  for (const [k, v] of Object.entries(files)) for (const file of Array.isArray(v) ? v : v ? [v] : []) f.append(k, file);
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) f.append(k, String(v));
  return f;
}

// Aggressive caching + no refetch-on-focus = no redundant network calls. Realtime changes arrive over the socket.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: (n, e) => !(e instanceof ApiError && e.status < 500) && !(e instanceof ApiError && e.code === 'MAINTENANCE') && n < 2,
    },
    mutations: { retry: false },
  },
});
