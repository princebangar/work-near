import { QueryClient } from '@tanstack/react-query';
import { env } from '@/config/env';
import { useAuth, useSettings } from '@/store';

// One API client (port of Frontend/src/lib/http.ts): bearer token, single-flight refresh on 401, timeout,
// unified ApiError, maintenance / suspended handling.

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
/** fetch() failed before reaching the server (offline / DNS / timeout). */
export class NetworkError extends Error {}

const qs = (q) => {
  if (!q) return '';
  const parts = [];
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== '' && v !== false) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
};

const TIMEOUT = 20_000;
const UPLOAD_TIMEOUT = 90_000;

async function timedFetch(url, init, ms, outer) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  const onOuter = () => ctrl.abort();
  outer?.addEventListener?.('abort', onOuter);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    if (outer?.aborted) throw e;
    throw new NetworkError(e?.message || 'Network request failed');
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener?.('abort', onOuter);
  }
}

// Single-flight refresh: parallel 401s share one /auth/refresh call.
let refreshing = null;
function refreshSession() {
  return (refreshing ??= (async () => {
    const rt = useAuth.getState().refreshToken;
    if (!rt) return false;
    try {
      const r = await timedFetch(env.apiUrl + '/auth/refresh', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ refreshToken: rt }),
      }, TIMEOUT);
      if (!r.ok) return false;
      const { data } = await r.json();
      useAuth.getState().setTokens(data.token, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })());
}

async function raw(method, path, opts = {}, retried = false) {
  const s = useAuth.getState();
  const token = s.token;
  const isForm = opts.body instanceof FormData;
  const res = await timedFetch(env.apiUrl + path + qs(opts.query), {
    method,
    headers: {
      Accept: 'application/json',
      ...(opts.body !== undefined && !isForm && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: opts.body === undefined ? undefined : isForm ? opts.body : JSON.stringify(opts.body),
  }, isForm ? UPLOAD_TIMEOUT : TIMEOUT, opts.signal);
  // Access token expired → refresh once with the refresh token and replay the request.
  if (res.status === 401 && !retried && s.refreshToken && !path.startsWith('/auth/') && (await refreshSession())) {
    return raw(method, path, opts, true);
  }
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    const err = json?.error ?? {};
    if (res.status === 401 && s.token) s.logout();
    // Maintenance switched on by admin → app shows the maintenance screen immediately.
    if (res.status === 503 && err.code === 'MAINTENANCE') useSettings.getState().patch({ maintenance: err.details?.maintenance });
    if (res.status === 403 && err.code === 'SUSPENDED') s.logout();
    throw new ApiError(res.status, err.code ?? 'UNKNOWN', err.message ?? 'Something went wrong', err.details);
  }
  return res;
}

async function request(method, path, opts = {}) {
  const res = await raw(method, path, opts);
  if (res.status === 204) return undefined;
  const json = await res.json().catch(() => ({}));
  return json.data;
}

export const http = {
  get: (p, query, signal) => request('GET', p, { query, signal }),
  post: (p, body) => request('POST', p, { body }),
  patch: (p, body) => request('PATCH', p, { body }),
  put: (p, body) => request('PUT', p, { body }),
  del: (p, body) => request('DELETE', p, { body }),
  /** multipart/form-data upload. Pass files under the field name the endpoint expects. */
  upload: (p, form) => request('POST', p, { body: form }),
};

/**
 * Builds a FormData from picked files ({ uri, name, mimeType }) + plain fields.
 * React Native's FormData takes { uri, name, type } objects for files.
 */
export function formData(files, fields = {}) {
  const f = new FormData();
  for (const [k, v] of Object.entries(files)) {
    for (const file of Array.isArray(v) ? v : v ? [v] : []) f.append(k, { uri: file.uri, name: file.name, type: file.mimeType });
  }
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
