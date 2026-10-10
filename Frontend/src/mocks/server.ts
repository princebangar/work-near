// In-browser mock of the REST API (/api/v1). Same paths & shapes as the backend.
import { ApiError, type Method, type ReqOpts } from '@/lib/http';
import { distanceKm } from '@/lib/format';
import { APP } from '@/config/env';
import type { Complaint, Message, Subscription, User, WorkerDetail, WorkerSummary } from '@/types';
import * as db from './data';

type Q = Record<string, string>;
type Handler = (p: Record<string, string>, q: Q, body: any) => unknown;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let subscription: Subscription = { planId: null, status: 'none', renewal: 'manual' };
const complaints: Complaint[] = [
  { id: 'C102', category: 'Spam', targetType: 'message', description: 'Repeated promotional messages.', status: 'resolved', createdAt: new Date(Date.now() - 4e8).toISOString(), resolution: 'User warned and restricted.' },
];
let lastSearchCenter = { lat: 28.6139, lng: 77.209 };

const catName = (id: string) => db.categories.find((c) => c.id === id)?.name ?? '';
const toSummary = (w: db.MockWorker, lat: number, lng: number): WorkerSummary => {
  const { dLat, dLng, languages: _l, ...rest } = w;
  return { ...rest, categoryName: catName(w.categoryId), distanceKm: Math.round(distanceKm(lat, lng, lat + dLat, lng + dLng) * 10) / 10 };
};
const page = <T,>(items: T[], cursor?: string, size = 20) => {
  const start = Number(cursor ?? 0);
  return { items: items.slice(start, start + size), nextCursor: start + size < items.length ? String(start + size) : null, total: items.length };
};
const like = (s: string, q?: string) => !q || s.toLowerCase().includes(q.toLowerCase());

const routes: Record<string, Handler> = {
  'POST /auth/request-otp': (_p, _q, b) => {
    if (!/^[6-9]\d{9}$/.test(b?.mobile ?? '')) throw new ApiError(422, 'INVALID_MOBILE', 'Enter a valid 10-digit mobile number');
    return { expiresIn: 300, resendAfter: 30 };
  },
  'POST /auth/verify-otp': (_p, _q, b) => {
    if (b?.otp !== APP.demoOtp) throw new ApiError(400, 'INVALID_OTP', `Invalid OTP. (Demo OTP: ${APP.demoOtp})`);
    const user: User = { id: 'me', mobile: b.mobile, name: '', roles: ['customer'], activeRole: 'customer', language: 'en', workerProfileStatus: 'none', createdAt: new Date().toISOString() };
    return { token: 'mock.jwt.token', user, isNew: true };
  },
  'PATCH /me': (_p, _q, b) => b,
  'POST /me/delete-request': () => ({ ok: true }),

  'GET /categories': () => db.categories,
  'GET /banners': () => db.banners,
  'GET /faqs': () => db.faqs,

  'GET /workers/search': (_p, q) => {
    const lat = +q.lat, lng = +q.lng, radius = +q.radius_km || 5;
    lastSearchCenter = { lat, lng };
    let list = db.workers
      .map((w) => toSummary(w, lat, lng))
      .filter((w) => w.distanceKm <= radius)
      .filter((w) => !q.category_id || w.categoryId === q.category_id)
      .filter((w) => like(w.name + w.categoryName + w.skills.join(' '), q.q))
      .filter((w) => !q.min_rating || w.rating >= +q.min_rating)
      .filter((w) => !q.verified_only || !!w.verification)
      .filter((w) => !q.available_only || w.available);
    const sort = q.sort ?? 'distance';
    list = list.sort((a, b) =>
      sort === 'rating' ? b.rating - a.rating : sort === 'recent' ? b.lastActiveAt.localeCompare(a.lastActiveAt) : a.distanceKm - b.distanceKm,
    );
    return page(list, q.cursor);
  },
  'GET /workers/me/dashboard': () => ({ profileViews: 248, enquiries: 17, rating: 4.7, reviewCount: 32, visible: true, completion: 80, verification: 'pending' }),
  'PATCH /workers/profile': (_p, _q, b) => b,
  'POST /verification/submissions': () => ({ status: 'pending' }),
  'GET /workers/:id': ({ id }) => {
    const w = db.workers.find((x) => x.id === id);
    if (!w) throw new ApiError(404, 'NOT_FOUND', 'Worker not found');
    const s = toSummary(w, lastSearchCenter.lat, lastSearchCenter.lng);
    const detail: WorkerDetail = {
      ...s,
      bio: `${w.experienceYrs}+ years of experience in ${s.categoryName.toLowerCase()} work. Honest pricing, neat work and on-time service. Serving ${w.locality} and nearby areas.`,
      languages: w.languages,
      hours: 'Mon – Sat, 9:00 AM – 7:00 PM',
      serviceRadiusKm: 10,
      portfolio: [1, 2, 3, 4].map((n) => `https://picsum.photos/seed/${w.id}-${n}/400/300`),
      reviews: db.makeReviews(4),
      ratingBreakdown: { 5: 62, 4: 24, 3: 9, 2: 3, 1: 2 },
    };
    return detail;
  },

  'GET /conversations': () => db.conversations,
  'POST /conversations': (_p, _q, b) => {
    const existing = db.conversations.find((c) => c.peer.id === b.workerId);
    if (existing) return existing;
    const w = db.workers.find((x) => x.id === b.workerId)!;
    const c = { id: `c${Date.now()}`, peer: { id: w.id, name: w.name, photo: w.photo, role: 'worker' as const, subtitle: catName(w.categoryId) }, lastMessage: '', lastMessageAt: new Date().toISOString(), unread: 0, muted: false, blocked: false };
    db.conversations.unshift(c);
    db.messages[c.id] = [];
    return c;
  },
  'PATCH /conversations/:id': ({ id }, _q, b) => {
    const c = db.conversations.find((x) => x.id === id)!;
    Object.assign(c, b);
    return c;
  },
  'GET /conversations/:id/messages': ({ id }) => {
    const c = db.conversations.find((x) => x.id === id);
    if (c) c.unread = 0;
    return page(db.messages[id] ?? [], undefined, 100);
  },
  'POST /conversations/:id/messages': ({ id }, _q, b) => {
    const m: Message = { id: `m${Date.now()}`, conversationId: id, senderId: 'me', text: String(b.text).slice(0, 2000), sentAt: new Date().toISOString(), status: 'sent' };
    (db.messages[id] ??= []).push(m);
    const c = db.conversations.find((x) => x.id === id);
    if (c) Object.assign(c, { lastMessage: m.text, lastMessageAt: m.sentAt });
    return m;
  },

  'GET /notifications': () => db.notifications,
  'PATCH /notifications/:id/read': ({ id }) => {
    const n = db.notifications.find((x) => x.id === id);
    if (n) n.read = true;
    return n;
  },
  'POST /notifications/read-all': () => db.notifications.forEach((n) => (n.read = true)),

  'GET /subscription/plans': () => db.plans.filter((p) => p.active),
  'GET /subscription/me': () => subscription,
  'POST /subscription/checkout': (_p, _q, b) => {
    const plan = db.plans.find((p) => p.id === b.planId)!;
    const end = new Date();
    plan.period === 'year' ? end.setFullYear(end.getFullYear() + 1) : end.setMonth(end.getMonth() + 1);
    subscription = { planId: plan.id, status: 'active', startAt: new Date().toISOString(), endAt: end.toISOString(), renewal: 'manual' };
    return subscription;
  },

  'POST /reviews': (_p, _q, b) => ({ id: `r${Date.now()}`, ...b }),
  'POST /reports': () => ({ ok: true }),
  'GET /complaints/me': () => complaints,
  'POST /complaints': (_p, _q, b) => {
    const c: Complaint = { id: `C${200 + complaints.length}`, status: 'open', createdAt: new Date().toISOString(), ...b };
    complaints.unshift(c);
    return c;
  },
  'GET /blocked': () => db.conversations.filter((c) => c.blocked).map((c) => c.peer),

  // ---------- Admin ----------
  'POST /admin/auth/login': (_p, _q, b) => {
    if (!b?.email || b.password?.length < 4) throw new ApiError(401, 'BAD_CREDENTIALS', 'Invalid email or password');
    if (b.otp !== APP.demoOtp) throw new ApiError(401, 'MFA_REQUIRED', `Enter MFA code (demo: ${APP.demoOtp})`);
    return { token: 'mock.admin.jwt', name: 'Prince (Owner)', role: 'super_admin' };
  },
  'GET /admin/kpis': () => ({
    totalUsers: 12840, activeWorkers: 3215, verifiedWorkers: 2104, searchesToday: 5821, chatsToday: 1342,
    activeSubscriptions: 4120, revenueMonth: 186300, openComplaints: db.adminComplaints.filter((c) => c.status !== 'resolved').length,
    pendingVerifications: db.verifications.filter((v) => v.status === 'pending').length,
    signupsLast7: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => ({ day, customers: 80 + ((i * 37) % 70), workers: 30 + ((i * 23) % 40) })),
    alerts: [
      { id: 'al1', level: 'warning', text: 'SMS/OTP provider latency above 3s in last 15 min' },
      { id: 'al2', level: 'danger', text: '1 complaint escalated for fraud — needs review' },
      { id: 'al3', level: 'info', text: 'Nightly database backup completed' },
    ],
  }),
  'GET /admin/users': (_p, q) => page(db.adminUsers.filter((u) => like(u.name + u.mobile, q.q) && (!q.status || u.status === q.status)), q.cursor, 50),
  'PATCH /admin/users/:id': ({ id }, _q, b) => Object.assign(db.adminUsers.find((u) => u.id === id)!, b),
  'GET /admin/verifications': (_p, q) => db.verifications.filter((v) => !q.status || v.status === q.status),
  'PATCH /admin/verifications/:id': ({ id }, _q, b) => Object.assign(db.verifications.find((v) => v.id === id)!, b),
  'GET /admin/categories': () => db.categories,
  'POST /admin/categories': (_p, _q, b) => {
    const c = { id: b.name.toLowerCase().replace(/\s+/g, '-'), icon: 'briefcase', tint: '#e0e7ff', workerCount: 0, ...b };
    db.categories.push(c);
    return c;
  },
  'GET /admin/plans': () => db.plans,
  'PATCH /admin/plans/:id': ({ id }, _q, b) => Object.assign(db.plans.find((p) => p.id === id)!, b),
  'GET /admin/transactions': () => db.transactions,
  'GET /admin/complaints': (_p, q) => db.adminComplaints.filter((c) => !q.status || c.status === q.status),
  'PATCH /admin/complaints/:id': ({ id }, _q, b) => Object.assign(db.adminComplaints.find((c) => c.id === id)!, b),
  'GET /admin/reviews': () => db.adminReviews,
  'PATCH /admin/reviews/:id': ({ id }, _q, b) => Object.assign(db.adminReviews.find((r) => r.id === id)!, b),
  'GET /admin/audit-logs': () => db.auditLogs,
  'GET /admin/staff': () => db.staff,
  'GET /admin/banners': () => db.banners,
  'GET /admin/faqs': () => db.faqs,
};

const compiled = Object.entries(routes).map(([key, fn]) => {
  const [method, path] = key.split(' ');
  const names: string[] = [];
  const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, n) => (names.push(n), '([^/]+)')) + '$');
  return { method, re, names, fn };
});

export async function mockRequest<T>(method: Method, path: string, opts: ReqOpts): Promise<T> {
  await sleep(180 + Math.random() * 220);
  for (const r of compiled) {
    if (r.method !== method) continue;
    const m = path.match(r.re);
    if (!m) continue;
    const params = Object.fromEntries(r.names.map((n, i) => [n, decodeURIComponent(m[i + 1])]));
    const q: Q = {};
    for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined && v !== null && v !== '' && v !== false) q[k] = String(v);
    // structuredClone so React Query never shares mutable references with the mock DB.
    return structuredClone(r.fn(params, q, opts.body) ?? null) as T;
  }
  throw new ApiError(404, 'NOT_FOUND', `Mock route not found: ${method} ${path}`);
}
