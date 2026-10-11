import { Router, type Request } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { HttpError, escapeRegex, ok, paged, startOfDay, validate, type AnyFilter } from '../../lib/core.js';
import { requireAdmin } from '../../middlewares/auth.js';
import { audit } from '../../lib/audit.js';
import { notify } from '../../lib/notify.js';
import { broadcast, emitTo } from '../../lib/socket.js';
import { privatePath, publicUrl, removePublic, upload } from '../../lib/upload.js';
import { User } from '../../models/user.js';
import { Review, Verification, WorkerProfile } from '../../models/worker.js';
import { Conversation, Message } from '../../models/chat.js';
import { Payment, Plan, Subscription } from '../../models/billing.js';
import { Banner, Category, FEATURE_KEYS, Faq, Page, Setting, getSettings, invalidateSettings, publicSettings } from '../../models/content.js';
import { Admin, AuditLog, Complaint, SearchLog, type ComplaintLean } from '../../models/ops.js';
import { PushToken } from '../../models/PushToken.js';
import { categoriesWithCounts } from '../catalog/catalog.routes.js';
import { refreshRating } from '../workers/workers.service.js';
import { grant, planDto, refundPayment } from '../subscription/subscription.service.js';
import { hashPassword } from '../../lib/password.js';

export const adminRouter = Router();
const ADMINS = requireAdmin('super_admin', 'admin');
const SUPER = requireAdmin('super_admin');
const ANY = requireAdmin();

const oid = z.string().regex(/^[a-f\d]{24}$/, 'Invalid id');
const idParam = validate({ params: z.object({ id: oid }) });
const listQuery = z.object({
  q: z.string().trim().max(60).optional(), status: z.string().max(30).optional(), role: z.string().max(20).optional(),
  cursor: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(1).max(100).default(25),
  from: z.iso.date().optional(), to: z.iso.date().optional(),
});
type ListQ = z.infer<typeof listQuery>;
const LQ = validate({ query: listQuery });
const reasonBody = z.string().trim().min(3, 'A reason is required').max(500);
const iso = (d?: Date | null) => (d ? d.toISOString() : undefined);
const range = (q: ListQ, field = 'createdAt') =>
  q.from || q.to ? { [field]: { ...(q.from && { $gte: new Date(q.from) }), ...(q.to && { $lt: new Date(new Date(q.to).getTime() + 86_400_000) }) } } : {};

// ======================================================================
// Dashboard
// ======================================================================
adminRouter.get('/kpis', ADMINS, async (_req, res) => {
  const today = startOfDay();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const weekAgo = new Date(today.getTime() - 6 * 86_400_000);
  const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  const [
    totalUsers, newUsersToday, activeWorkers, verifiedWorkers, searchesToday, messagesToday, newChatsToday, activeSubscriptions,
    revenueAgg, openComplaints, escalated, pendingVerifications, oldPending, failedToday, deletionRequests,
    custDaily, workDaily, revenueMonthly, byCategory, cats, complaintStatus,
  ] = await Promise.all([
    User.countDocuments({ status: { $ne: 'deleted' } }),
    User.countDocuments({ createdAt: { $gte: today } }),
    WorkerProfile.countDocuments({ visible: true, restricted: false }),
    WorkerProfile.countDocuments({ verification: { $ne: null } }),
    SearchLog.countDocuments({ createdAt: { $gte: today } }),
    Message.countDocuments({ sentAt: { $gte: today } }),
    Conversation.countDocuments({ createdAt: { $gte: today } }),
    Subscription.countDocuments({ status: 'active', endAt: { $gt: new Date() } }),
    Payment.aggregate<{ s: number }>([{ $match: { status: 'success', paidAt: { $gte: monthStart } } }, { $group: { _id: null, s: { $sum: '$amount' } } }]),
    Complaint.countDocuments({ status: { $in: ['open', 'in_progress', 'escalated'] } }),
    Complaint.countDocuments({ status: 'escalated' }),
    Verification.countDocuments({ status: 'pending' }),
    Verification.countDocuments({ status: 'pending', createdAt: { $lt: new Date(Date.now() - 48 * 3_600_000) } }),
    Payment.countDocuments({ status: 'failed', createdAt: { $gte: today } }),
    User.countDocuments({ status: 'deleted_request' }),
    User.aggregate<{ _id: string; n: number }>([{ $match: { createdAt: { $gte: weekAgo } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } }]),
    WorkerProfile.aggregate<{ _id: string; n: number }>([{ $match: { createdAt: { $gte: weekAgo } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } }]),
    Payment.aggregate<{ _id: string; s: number; n: number }>([{ $match: { status: 'success', paidAt: { $gte: sixMonthsAgo } } }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$paidAt' } }, s: { $sum: '$amount' }, n: { $sum: 1 } } }]),
    WorkerProfile.aggregate<{ _id: string; n: number }>([{ $group: { _id: '$category', n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
    Category.find({}, { name: 1 }).lean(),
    Complaint.aggregate<{ _id: string; n: number }>([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const cMap = new Map(custDaily.map((x) => [x._id, x.n])), wMap = new Map(workDaily.map((x) => [x._id, x.n]));
  const signupsLast7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekAgo.getTime() + i * 86_400_000);
    return { day: d.toLocaleDateString('en-IN', { weekday: 'short' }), date: key(d), customers: cMap.get(key(d)) ?? 0, workers: wMap.get(key(d)) ?? 0 };
  });
  const rMap = new Map(revenueMonthly.map((x) => [x._id, x]));
  const revenueLast6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth() + i, 1);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { month: d.toLocaleDateString('en-IN', { month: 'short' }), revenue: rMap.get(k)?.s ?? 0, payments: rMap.get(k)?.n ?? 0 };
  });
  const catName = new Map(cats.map((c) => [c._id as string, c.name]));
  const settings = await getSettings();
  const alerts = [
    ...(settings.maintenance?.enabled ? [{ id: 'mnt', level: 'danger', text: 'Maintenance mode is ON — the app is closed for users' }] : []),
    ...(escalated ? [{ id: 'esc', level: 'danger', text: `${escalated} complaint${escalated > 1 ? 's' : ''} escalated — needs review` }] : []),
    ...(oldPending ? [{ id: 'ver', level: 'warning', text: `${oldPending} verification${oldPending > 1 ? 's' : ''} pending for more than 48 hours` }] : []),
    ...(failedToday ? [{ id: 'pay', level: 'warning', text: `${failedToday} failed payment${failedToday > 1 ? 's' : ''} today` }] : []),
    ...(deletionRequests ? [{ id: 'del', level: 'info', text: `${deletionRequests} account deletion request${deletionRequests > 1 ? 's' : ''} to process` }] : []),
  ];
  if (!alerts.length) alerts.push({ id: 'ok', level: 'info', text: 'All systems normal' });
  ok(res, {
    totalUsers, newUsersToday, activeWorkers, verifiedWorkers, searchesToday, chatsToday: messagesToday, newChatsToday,
    activeSubscriptions, revenueMonth: revenueAgg[0]?.s ?? 0, openComplaints, pendingVerifications, deletionRequests,
    signupsLast7, revenueLast6,
    workersByCategory: byCategory.map((c) => ({ id: c._id, name: catName.get(c._id) ?? c._id, count: c.n })),
    complaintsByStatus: Object.fromEntries(complaintStatus.map((c) => [c._id, c.n])),
    alerts,
  });
});

/** Sidebar badge counts — one cheap call, polled by the panel. */
adminRouter.get('/badges', ANY, async (req, res) => {
  const support = req.admin!.role === 'support';
  const [verifications, complaints, deletions] = await Promise.all([
    support ? 0 : Verification.countDocuments({ status: 'pending' }),
    Complaint.countDocuments({ status: { $in: ['open', 'escalated'] }, ...(support && { assignedTo: req.admin!.sub }) }),
    support ? 0 : User.countDocuments({ status: 'deleted_request' }),
  ]);
  ok(res, { verifications, complaints, users: deletions });
});

// ======================================================================
// Users
// ======================================================================
async function reportCounts(ids: Types.ObjectId[]) {
  const rows = await Complaint.aggregate<{ _id: Types.ObjectId; n: number }>([{ $match: { targetUser: { $in: ids } } }, { $group: { _id: '$targetUser', n: { $sum: 1 } } }]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

adminRouter.get('/users', ADMINS, LQ, async (_req, res) => {
  const q = res.locals.query as ListQ;
  const filter: AnyFilter = { status: q.status ?? { $ne: 'deleted' }, ...range(q) };
  if (q.role) filter.roles = q.role;
  if (q.q) filter.$or = [{ name: new RegExp(escapeRegex(q.q), 'i') }, { mobile: new RegExp(escapeRegex(q.q)) }];
  const [rows, total] = await Promise.all([User.find(filter).sort({ createdAt: -1 }).skip(q.cursor).limit(q.limit).lean(), User.countDocuments(filter)]);
  const reports = await reportCounts(rows.map((u) => u._id));
  const items = rows.map((u) => ({
    id: String(u._id), name: u.name || '—', mobile: u.mobile, avatar: u.avatar || undefined, roles: u.roles, activeRole: u.activeRole,
    status: u.status, city: u.city, joinedAt: iso(u.createdAt as Date)!, lastActiveAt: iso(u.lastActiveAt), reports: reports.get(String(u._id)) ?? 0,
  }));
  ok(res, paged(items, q.cursor, q.limit, total));
});

adminRouter.get('/users/:id', ADMINS, idParam, async (_req, res) => {
  const id = (res.locals.params as { id: string }).id;
  const [u, wp, sub, complaintsAgainst, complaintsBy, convs, payments] = await Promise.all([
    User.findById(id).lean(), WorkerProfile.findOne({ user: id }).lean(), Subscription.findOne({ user: id }).lean(),
    Complaint.find({ targetUser: id }).sort({ createdAt: -1 }).limit(10).lean(), Complaint.countDocuments({ reporter: id }),
    Conversation.countDocuments({ $or: [{ customer: id }, { worker: id }] }), Payment.find({ user: id }).sort({ createdAt: -1 }).limit(10).lean(),
  ]);
  if (!u) throw HttpError.notFound('User not found');
  ok(res, {
    id, name: u.name, mobile: u.mobile, email: u.email, avatar: u.avatar, roles: u.roles, status: u.status, statusReason: u.statusReason,
    city: u.city, language: u.language, joinedAt: iso(u.createdAt as Date), lastLoginAt: iso(u.lastLoginAt), lastActiveAt: iso(u.lastActiveAt),
    consentVersion: u.consentVersion, deletionRequestedAt: iso(u.deletionRequestedAt), conversations: convs, complaintsFiled: complaintsBy,
    worker: wp && {
      displayName: wp.displayName, category: wp.category, locality: wp.locality, rating: wp.rating, reviewCount: wp.reviewCount,
      visible: wp.visible, restricted: wp.restricted, verification: wp.verification, verificationStatus: wp.verificationStatus, profileViews: wp.profileViews,
    },
    subscription: sub && { plan: sub.plan, status: sub.status, endAt: iso(sub.endAt), source: sub.source },
    complaintsAgainst: complaintsAgainst.map((c) => ({ id: c.code, category: c.category, status: c.status, createdAt: iso(c.createdAt as Date) })),
    payments: payments.map((p) => ({ id: p.orderId, planName: p.planName, amount: p.amount, status: p.status, createdAt: iso(p.createdAt as Date) })),
  });
});

const userPatch = z.object({ status: z.enum(['active', 'suspended', 'deleted']), reason: reasonBody.optional() });
adminRouter.patch('/users/:id', ADMINS, idParam, validate({ body: userPatch }), async (req, res) => {
  const id = (res.locals.params as { id: string }).id;
  const b = res.locals.body as z.infer<typeof userPatch>;
  if (b.status !== 'active' && !b.reason) throw HttpError.badRequest('A reason is required');
  const u = await User.findById(id);
  if (!u) throw HttpError.notFound();
  const label = `${u.name || 'User'} (${u.mobile})`;
  if (b.status === 'deleted') {
    // Process deletion request: anonymise PII, remove public profile & devices. The thread stays for the other party,
    // but this user's own messages are wiped (Privacy Policy: messages are deleted when deletion is processed).
    removePublic(u.avatar);
    const wp = await WorkerProfile.findOneAndDelete({ user: id }).lean();
    if (wp) [wp.photo, ...wp.portfolio].forEach((p) => removePublic(p));
    await PushToken.deleteMany({ userId: id });
    const sent = await Message.find({ sender: id, image: { $exists: true, $ne: null } }, { image: 1 }).lean();
    sent.forEach((m) => removePublic(m.image));
    await Message.updateMany({ sender: id }, { $set: { text: '', moderation: 'removed' }, $unset: { image: 1 } });
    Object.assign(u, { name: 'Deleted user', email: undefined, avatar: '', mobile: `deleted_${id}`, status: 'deleted', statusReason: b.reason, roles: ['customer'] });
  } else {
    u.status = b.status;
    u.statusReason = b.reason;
    await WorkerProfile.updateOne({ user: id }, { restricted: b.status === 'suspended' });
  }
  if (b.status !== 'active') u.tokenVersion = (u.tokenVersion ?? 0) + 1; // revoke every session immediately
  await u.save();
  void audit(req, `user.${b.status === 'active' ? 'reinstate' : b.status === 'suspended' ? 'suspend' : 'delete'}`, { type: 'user', id, label }, b.reason);
  if (b.status === 'suspended') emitTo(id, 'account:suspended', { reason: b.reason });
  ok(res, { id, status: u.status });
});

const workerPatch = z.object({ restricted: z.boolean(), reason: reasonBody });
adminRouter.patch('/workers/:id', ADMINS, idParam, validate({ body: workerPatch }), async (req, res) => {
  const id = (res.locals.params as { id: string }).id;
  const b = res.locals.body as z.infer<typeof workerPatch>;
  const wp = await WorkerProfile.findOneAndUpdate({ user: id }, { restricted: b.restricted }, { returnDocument: 'after' }).lean();
  if (!wp) throw HttpError.notFound('Worker profile not found');
  void audit(req, b.restricted ? 'worker.restrict' : 'worker.unrestrict', { type: 'user', id, label: wp.displayName }, b.reason);
  void notify(id, { type: 'system', title: b.restricted ? 'Profile hidden by WorkNear' : 'Profile visible again', body: b.restricted ? `Reason: ${b.reason}` : 'Customers can find you in search again.' });
  ok(res, { restricted: wp.restricted });
});

// ======================================================================
// Worker verification
// ======================================================================
adminRouter.get('/verifications', ADMINS, LQ, async (_req, res) => {
  const q = res.locals.query as ListQ;
  const filter: AnyFilter = { ...(q.status && { status: q.status }), ...range(q) };
  const [rows, total] = await Promise.all([Verification.find(filter).sort({ createdAt: -1 }).skip(q.cursor).limit(q.limit).lean(), Verification.countDocuments(filter)]);
  const profiles = await WorkerProfile.find({ user: { $in: rows.map((v) => v.worker) } }, { user: 1, displayName: 1, photo: 1, category: 1, locality: 1 }).lean();
  const byUser = new Map(profiles.map((p) => [String(p.user), p]));
  const catName = new Map((await Category.find({}, { name: 1 }).lean()).map((c) => [c._id as string, c.name]));
  const reviewers = new Map((await Admin.find({ _id: { $in: rows.map((v) => v.reviewer).filter(Boolean) } }, { name: 1 }).lean()).map((a) => [String(a._id), a.name]));
  const items = rows.map((v) => {
    const p = byUser.get(String(v.worker));
    return {
      id: String(v._id), workerId: String(v.worker), workerName: p?.displayName ?? 'Deleted worker', photo: p?.photo ?? '',
      category: p ? catName.get(p.category) ?? p.category : '', locality: p?.locality, type: v.type,
      documents: v.documents.map((d) => d.name || 'Document'), status: v.status, submittedAt: iso(v.createdAt as Date)!,
      reason: v.reason, reviewedAt: iso(v.reviewedAt), reviewer: v.reviewer ? reviewers.get(String(v.reviewer)) : undefined,
    };
  });
  ok(res, paged(items, q.cursor, q.limit, total));
});

/** Streams a private document. Every view is audit-logged (SRS 11). */
adminRouter.get('/verifications/:id/documents/:idx', ADMINS, validate({ params: z.object({ id: oid, idx: z.coerce.number().int().min(0).max(9) }) }), async (req, res) => {
  const { id, idx } = res.locals.params as { id: string; idx: number };
  const v = await Verification.findById(id).lean();
  const doc = v?.documents[idx];
  if (!v || !doc?.path) throw HttpError.notFound('Document not found');
  await audit(req, 'verification.document_view', { type: 'verification', id, label: doc.name ?? 'document' });
  res.set({ 'Cache-Control': 'private, no-store', 'Content-Type': doc.mime ?? 'application/octet-stream', 'Content-Disposition': 'inline' });
  res.sendFile(privatePath(doc.path));
});

const verPatch = z.object({ status: z.enum(['approved', 'rejected', 'info_requested']), reason: z.string().trim().max(500).optional() });
adminRouter.patch('/verifications/:id', ADMINS, idParam, validate({ body: verPatch }), async (req, res) => {
  const id = (res.locals.params as { id: string }).id;
  const b = res.locals.body as z.infer<typeof verPatch>;
  if (b.status !== 'approved' && (!b.reason || b.reason.length < 3)) throw HttpError.badRequest('A reason is required');
  const v = await Verification.findOneAndUpdate({ _id: id, status: { $in: ['pending', 'info_requested'] } }, { status: b.status, reason: b.reason, reviewer: req.admin!.sub, reviewedAt: new Date() }, { returnDocument: 'after' }).lean();
  if (!v) throw new HttpError(409, 'ALREADY_REVIEWED', 'This request was already reviewed');
  // Badge reflects server-side approval only (AC-07) and states exactly what was verified.
  await WorkerProfile.updateOne({ user: v.worker }, { verificationStatus: b.status, ...(b.status === 'approved' && { verification: v.type }) });
  const label = { phone: 'Phone', id: 'ID', id_address: 'ID + Address' }[v.type];
  const msg = {
    approved: { title: 'Verification approved ✅', body: `Your ${label} verification badge is now live on your profile.` },
    rejected: { title: 'Verification rejected', body: `Reason: ${b.reason}. You can submit again with correct documents.` },
    info_requested: { title: 'More information needed', body: `${b.reason}` },
  }[b.status];
  void notify(v.worker, { type: 'verification', ...msg, link: '/' });
  void audit(req, `verification.${b.status === 'info_requested' ? 'request_info' : b.status === 'approved' ? 'approve' : 'reject'}`, { type: 'verification', id, label: `Worker ${String(v.worker)} · ${label}` }, b.reason);
  ok(res, { id, status: v.status });
});

// ======================================================================
// Categories
// ======================================================================
adminRouter.get('/categories', ADMINS, async (_req, res) => ok(res, await categoriesWithCounts({})));

const catBody = z.object({
  name: z.string().trim().min(2).max(40), nameHi: z.string().trim().max(40).default(''), icon: z.string().max(30).default('briefcase'),
  tint: z.string().max(20).default('#e0e7ff'), skills: z.array(z.string().trim().min(1).max(40)).max(30).default([]), active: z.boolean().default(true),
});
// PATCH schemas must not carry .default()s — otherwise omitted fields get reset (zod applies defaults inside .partial()).
const catPatch = z.object({ name: z.string().trim().min(2).max(40), nameHi: z.string().trim().max(40), icon: z.string().max(30), tint: z.string().max(20), skills: z.array(z.string().trim().min(1).max(40)).max(30), active: z.boolean() }).partial();
adminRouter.post('/categories', ADMINS, validate({ body: catBody }), async (req, res) => {
  const b = res.locals.body as z.infer<typeof catBody>;
  const id = b.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (await Category.exists({ _id: id })) throw new HttpError(409, 'EXISTS', 'Category already exists');
  const c = await Category.create({ _id: id, ...b, sort: await Category.countDocuments() });
  void audit(req, 'category.create', { type: 'category', id, label: b.name });
  ok(res, { id: c._id, ...b, workerCount: 0 }, 201);
});
adminRouter.patch('/categories/:id', ADMINS, validate({ params: z.object({ id: z.string().max(40) }), body: catPatch }), async (req, res) => {
  const id = (res.locals.params as { id: string }).id;
  const c = await Category.findByIdAndUpdate(id, { $set: res.locals.body }, { returnDocument: 'after' }).lean();
  if (!c) throw HttpError.notFound();
  void audit(req, 'category.update', { type: 'category', id, label: c.name }, undefined, res.locals.body);
  ok(res, { id: c._id, name: c.name, nameHi: c.nameHi, icon: c.icon, tint: c.tint, skills: c.skills, active: c.active });
});

// ======================================================================
// Plans, subscriptions, transactions
// ======================================================================
adminRouter.get('/plans', ADMINS, async (_req, res) => ok(res, (await Plan.find().sort({ sort: 1 }).lean()).map(planDto)));

const planBody = z.object({
  name: z.string().trim().min(2).max(40), price: z.number().min(0).max(100000), period: z.enum(['month', 'year']),
  features: z.array(z.string().trim().min(1).max(80)).max(12), badge: z.string().trim().max(30).optional(), active: z.boolean(),
});
adminRouter.post('/plans', SUPER, validate({ body: planBody }), async (req, res) => {
  const b = res.locals.body as z.infer<typeof planBody>;
  const id = b.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  if (await Plan.exists({ _id: id })) throw new HttpError(409, 'EXISTS', 'Plan already exists');
  const p = await Plan.create({ _id: id, ...b, sort: await Plan.countDocuments() });
  void audit(req, 'plan.create', { type: 'plan', id, label: b.name });
  ok(res, planDto(p.toObject()), 201);
});
adminRouter.patch('/plans/:id', ADMINS, validate({ params: z.object({ id: z.string().max(40) }), body: planBody.partial() }), async (req, res) => {
  const id = (res.locals.params as { id: string }).id;
  const p = await Plan.findByIdAndUpdate(id, { $set: res.locals.body }, { returnDocument: 'after' }).lean();
  if (!p) throw HttpError.notFound();
  void audit(req, 'plan.update', { type: 'plan', id, label: p.name }, 'Applies to future purchases', res.locals.body);
  ok(res, planDto(p));
});

adminRouter.get('/subscriptions', ADMINS, LQ, async (_req, res) => {
  const q = res.locals.query as ListQ;
  const filter: AnyFilter = { status: q.status ?? 'active' };
  const [rows, total] = await Promise.all([Subscription.find(filter).sort({ endAt: 1 }).skip(q.cursor).limit(q.limit).populate<{ user: { name: string; mobile: string } }>('user', 'name mobile').lean(), Subscription.countDocuments(filter)]);
  ok(res, paged(rows.map((s) => ({ id: String(s._id), userName: s.user?.name || '—', mobile: s.user?.mobile, plan: s.plan, status: s.status, startAt: iso(s.startAt), endAt: iso(s.endAt), source: s.source })), q.cursor, q.limit, total));
});

const grantBody = z.object({ userId: oid, planId: z.string().max(40), reason: reasonBody });
adminRouter.post('/subscriptions/grant', SUPER, validate({ body: grantBody }), async (req, res) => {
  const b = res.locals.body as z.infer<typeof grantBody>;
  if (!(await User.exists({ _id: b.userId }))) throw HttpError.notFound('User not found');
  const endAt = await grant(b.userId, b.planId, 'admin_grant');
  void notify(b.userId, { type: 'subscription', title: 'Subscription activated 🎁', body: `Granted by WorkNear. Valid till ${endAt.toLocaleDateString('en-IN')}.`, link: '/subscription' });
  void audit(req, 'subscription.grant', { type: 'user', id: b.userId, label: `Plan ${b.planId}` }, b.reason);
  ok(res, { endAt: endAt.toISOString() });
});

adminRouter.get('/transactions', ADMINS, LQ, async (_req, res) => {
  const q = res.locals.query as ListQ;
  const filter: AnyFilter = { ...(q.status && { status: q.status }), ...range(q), ...(q.q && { orderId: new RegExp(escapeRegex(q.q), 'i') }) };
  const [rows, total] = await Promise.all([Payment.find(filter).sort({ createdAt: -1 }).skip(q.cursor).limit(q.limit).populate<{ user: { name: string; mobile: string } }>('user', 'name mobile').lean(), Payment.countDocuments(filter)]);
  ok(res, paged(rows.map((p) => ({
    id: String(p._id), orderId: p.orderId, userName: p.user?.name || p.user?.mobile || '—', planName: p.planName ?? p.plan, amount: p.amount,
    status: p.status, gateway: p.gateway, gatewayRef: p.paymentId ?? p.orderId, refundId: p.refundId, createdAt: iso(p.createdAt as Date)!,
  })), q.cursor, q.limit, total));
});

adminRouter.post('/transactions/:id/refund', SUPER, idParam, validate({ body: z.object({ reason: reasonBody }) }), async (req, res) => {
  const id = (res.locals.params as { id: string }).id;
  const p = await Payment.findById(id);
  if (!p || p.status !== 'success' || !p.paymentId) throw HttpError.badRequest('Only successful payments can be refunded');
  p.refundId = await refundPayment(p.paymentId, p.amount);
  p.status = 'refunded';
  await p.save();
  // Refund ends the paid entitlement immediately.
  await Subscription.updateOne({ user: p.user, source: 'payment' }, { status: 'expired', endAt: new Date() });
  void notify(p.user, { type: 'subscription', title: 'Refund initiated', body: `₹${p.amount} for ${p.planName} will reach your account in 5–7 working days.`, link: '/subscription' });
  void audit(req, 'payment.refund', { type: 'payment', id, label: `${p.orderId} · ₹${p.amount}` }, (res.locals.body as { reason: string }).reason);
  ok(res, { status: p.status, refundId: p.refundId });
});

// ======================================================================
// Complaints (support staff: only assigned to them — AC-12)
// ======================================================================
const complaintScope = (req: Request) => (req.admin!.role === 'support' ? { assignedTo: new Types.ObjectId(req.admin!.sub) } : {});

async function complaintDtos(rows: ComplaintLean[]) {
  const userIds = rows.flatMap((c) => [c.reporter, c.targetUser].filter(Boolean)) as Types.ObjectId[];
  const [users, workers, admins] = await Promise.all([
    User.find({ _id: { $in: userIds } }, { name: 1, mobile: 1 }).lean(),
    WorkerProfile.find({ user: { $in: userIds } }, { user: 1, displayName: 1 }).lean(),
    Admin.find({ _id: { $in: rows.map((c) => c.assignedTo).filter(Boolean) } }, { name: 1 }).lean(),
  ]);
  const uName = new Map(users.map((u) => [String(u._id), u.name || u.mobile]));
  const wName = new Map(workers.map((w) => [String(w.user), w.displayName]));
  const aName = new Map(admins.map((a) => [String(a._id), a.name]));
  return rows.map((c) => ({
    id: c.code, dbId: String(c._id), category: c.category, targetType: c.targetType, targetId: c.targetId, description: c.description,
    status: c.status, createdAt: iso(c.createdAt as Date)!, updatedAt: iso(c.updatedAt as Date), resolution: c.resolution,
    reporterId: String(c.reporter), reporterName: uName.get(String(c.reporter)) ?? '—',
    targetUserId: c.targetUser ? String(c.targetUser) : undefined,
    targetName: c.targetUser ? wName.get(String(c.targetUser)) ?? uName.get(String(c.targetUser)) ?? '—' : '—',
    assignedTo: c.assignedTo ? aName.get(String(c.assignedTo)) : undefined, assignedToId: c.assignedTo ? String(c.assignedTo) : undefined,
    evidence: c.evidence.length, history: c.history,
  }));
}
const loadComplaints = (filter: AnyFilter, skip: number, limit: number) => Complaint.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();

adminRouter.get('/complaints', ANY, LQ, async (req, res) => {
  const q = res.locals.query as ListQ;
  const filter: AnyFilter = { ...complaintScope(req), ...(q.status && { status: q.status }), ...range(q), ...(q.q && { $or: [{ code: new RegExp(escapeRegex(q.q), 'i') }, { description: new RegExp(escapeRegex(q.q), 'i') }] }) };
  const [rows, total] = await Promise.all([loadComplaints(filter, q.cursor, q.limit), Complaint.countDocuments(filter)]);
  ok(res, paged(await complaintDtos(rows), q.cursor, q.limit, total));
});

const complaintPatch = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'escalated']).optional(),
  assignedTo: oid.nullable().optional(),
  resolution: z.string().trim().max(1000).optional(),
  note: z.string().trim().max(1000).optional(),
  action: z.enum(['warn', 'restrict', 'suspend']).optional(), // against the reported user
});
adminRouter.patch('/complaints/:id', ANY, validate({ params: z.object({ id: z.string().max(20) }), body: complaintPatch }), async (req, res) => {
  const code = (res.locals.params as { id: string }).id;
  const b = res.locals.body as z.infer<typeof complaintPatch>;
  const c = await Complaint.findOne({ code, ...complaintScope(req) });
  if (!c) throw HttpError.notFound('Complaint not found');
  if (req.admin!.role === 'support' && (b.assignedTo !== undefined || b.action === 'suspend')) throw HttpError.forbidden('Support staff cannot reassign or suspend');
  if (b.action && !c.targetUser) throw HttpError.badRequest('This complaint is not linked to a user');
  if (b.status === 'resolved' && !(b.resolution || c.resolution)) throw HttpError.badRequest('Add a resolution note before resolving');
  const by = `${req.admin!.name} (${req.admin!.role.replace('_', ' ')})`;
  const log = (action: string, note?: string) => c.history.push({ at: new Date(), by, action, note });
  if (b.status && b.status !== c.status) { log(`status → ${b.status}`, b.note); c.status = b.status; }
  if (b.assignedTo !== undefined) { c.assignedTo = (b.assignedTo ? new Types.ObjectId(b.assignedTo) : undefined) as never; log(b.assignedTo ? 'assigned' : 'unassigned'); }
  if (b.resolution) c.resolution = b.resolution;
  if (b.note && !b.status) log('note', b.note);
  if (b.action === 'warn') {
    void notify(c.targetUser!, { type: 'system', title: 'Warning from WorkNear', body: 'We received a report about your activity. Please follow our Community Guidelines to avoid restrictions.', link: '/legal/safety' });
    log('user warned');
  }
  if (b.action === 'restrict') { await WorkerProfile.updateOne({ user: c.targetUser }, { restricted: true }); log('worker profile restricted'); }
  if (b.action === 'suspend') { await User.updateOne({ _id: c.targetUser }, { status: 'suspended', statusReason: `Complaint ${c.code}`, $inc: { tokenVersion: 1 } }); emitTo(String(c.targetUser), 'account:suspended', {}); log('user suspended'); }
  await c.save();
  if (b.status && ['in_progress', 'resolved'].includes(b.status)) {
    void notify(c.reporter, { type: 'complaint', title: `Complaint #${c.code} ${b.status === 'resolved' ? 'resolved' : 'in progress'}`, body: b.status === 'resolved' ? c.resolution ?? 'Our team has resolved your complaint.' : 'Our team is looking into it.', link: '/help' });
  }
  void audit(req, `complaint.${b.action ?? 'update'}`, { type: 'complaint', id: c.code, label: `Complaint #${c.code}` }, b.note ?? b.resolution, b);
  ok(res, (await complaintDtos([c.toObject()]))[0]);
});

adminRouter.get('/complaints/:id/evidence/:idx', ANY, validate({ params: z.object({ id: z.string().max(20), idx: z.coerce.number().int().min(0).max(5) }) }), async (req, res) => {
  const { id, idx } = res.locals.params as { id: string; idx: number };
  const c = await Complaint.findOne({ code: id, ...complaintScope(req) }).lean();
  const rel = c?.evidence[idx];
  if (!rel) throw HttpError.notFound();
  await audit(req, 'complaint.evidence_view', { type: 'complaint', id });
  res.set('Cache-Control', 'private, no-store');
  res.sendFile(privatePath(rel));
});

// ======================================================================
// Review moderation
// ======================================================================
adminRouter.get('/reviews', ADMINS, LQ, async (_req, res) => {
  const q = res.locals.query as ListQ;
  const filter: AnyFilter = { ...(q.status === 'reported' ? { reports: { $gt: 0 } } : q.status ? { status: q.status } : {}) };
  const [rows, total] = await Promise.all([
    Review.find(filter).sort({ reports: -1, createdAt: -1 }).skip(q.cursor).limit(q.limit).populate<{ reviewer: { name: string; avatar: string } }>('reviewer', 'name avatar').lean(),
    Review.countDocuments(filter),
  ]);
  const names = new Map((await WorkerProfile.find({ user: { $in: rows.map((r) => r.worker) } }, { user: 1, displayName: 1 }).lean()).map((w) => [String(w.user), w.displayName]));
  ok(res, paged(rows.map((r) => ({
    id: String(r._id), reviewerName: r.reviewer?.name || '—', reviewerPhoto: r.reviewer?.avatar || undefined, stars: r.stars, text: r.text,
    createdAt: iso(r.createdAt as Date)!, workerId: String(r.worker), workerName: names.get(String(r.worker)) ?? '—', reports: r.reports, status: r.status, hiddenReason: r.hiddenReason,
  })), q.cursor, q.limit, total));
});

adminRouter.patch('/reviews/:id', ADMINS, idParam, validate({ body: z.object({ status: z.enum(['visible', 'hidden']), reason: z.string().trim().max(500).optional() }) }), async (req, res) => {
  const id = (res.locals.params as { id: string }).id;
  const b = res.locals.body as { status: 'visible' | 'hidden'; reason?: string };
  if (b.status === 'hidden' && (!b.reason || b.reason.length < 3)) throw HttpError.badRequest('A reason is required');
  const r = await Review.findByIdAndUpdate(id, { status: b.status, hiddenReason: b.status === 'hidden' ? b.reason : undefined, ...(b.status === 'visible' && { reports: 0 }) }, { returnDocument: 'after' }).lean();
  if (!r) throw HttpError.notFound();
  await refreshRating(r.worker);
  void audit(req, b.status === 'hidden' ? 'review.hide' : 'review.restore', { type: 'review', id, label: `${r.stars}★ review` }, b.reason);
  ok(res, { id, status: r.status });
});

// ======================================================================
// CMS: banners, FAQs, legal pages
// ======================================================================
const bannerDto = (b: { _id: unknown; title: string; subtitle?: string | null; tint?: string | null; link?: string | null; active: boolean; sort: number }) =>
  ({ id: String(b._id), title: b.title, subtitle: b.subtitle ?? '', tint: b.tint ?? '', link: b.link ?? undefined, active: b.active, sort: b.sort });
// Banner links are rendered as app links — only in-app paths or https URLs (never javascript:/data: URLs).
const bannerLink = z.string().trim().max(120).regex(/^(\/(?!\/)|https:\/\/)/, 'Link must start with / or https://');
const bannerBody = z.object({ title: z.string().trim().min(2).max(60), subtitle: z.string().trim().max(120).default(''), tint: z.string().max(80).default('from-indigo-600 to-violet-500'), link: z.union([bannerLink, z.literal('')]).optional(), active: z.boolean().default(true), sort: z.number().int().default(0) });
const bannerPatch = z.object({ title: z.string().trim().min(2).max(60), subtitle: z.string().trim().max(120), tint: z.string().max(80), link: z.union([bannerLink, z.literal('')]), active: z.boolean(), sort: z.number().int() }).partial();

adminRouter.get('/banners', ADMINS, async (_req, res) => ok(res, (await Banner.find().sort({ sort: 1 }).lean()).map(bannerDto)));
adminRouter.post('/banners', ADMINS, validate({ body: bannerBody }), async (req, res) => {
  const b = await Banner.create(res.locals.body);
  void audit(req, 'banner.create', { type: 'banner', id: String(b._id), label: b.title });
  ok(res, bannerDto(b.toObject()), 201);
});
adminRouter.patch('/banners/:id', ADMINS, idParam, validate({ body: bannerPatch }), async (req, res) => {
  const b = await Banner.findByIdAndUpdate((res.locals.params as { id: string }).id, { $set: res.locals.body }, { returnDocument: 'after' }).lean();
  if (!b) throw HttpError.notFound();
  void audit(req, 'banner.update', { type: 'banner', id: String(b._id), label: b.title });
  ok(res, bannerDto(b));
});
adminRouter.delete('/banners/:id', ADMINS, idParam, async (req, res) => {
  const b = await Banner.findByIdAndDelete((res.locals.params as { id: string }).id).lean();
  if (b) void audit(req, 'banner.delete', { type: 'banner', id: String(b._id), label: b.title });
  res.status(204).end();
});

const faqDto = (f: { _id: unknown; q: string; a: string; active: boolean; sort: number }) => ({ id: String(f._id), q: f.q, a: f.a, active: f.active, sort: f.sort });
const faqBody = z.object({ q: z.string().trim().min(5).max(200), a: z.string().trim().min(5).max(1500), active: z.boolean().default(true), sort: z.number().int().default(0) });
const faqPatch = z.object({ q: z.string().trim().min(5).max(200), a: z.string().trim().min(5).max(1500), active: z.boolean(), sort: z.number().int() }).partial();
adminRouter.get('/faqs', ADMINS, async (_req, res) => ok(res, (await Faq.find().sort({ sort: 1 }).lean()).map(faqDto)));
adminRouter.post('/faqs', ADMINS, validate({ body: faqBody }), async (req, res) => {
  const f = await Faq.create(res.locals.body);
  void audit(req, 'faq.create', { type: 'faq', id: String(f._id), label: f.q });
  ok(res, faqDto(f.toObject()), 201);
});
adminRouter.patch('/faqs/:id', ADMINS, idParam, validate({ body: faqPatch }), async (req, res) => {
  const f = await Faq.findByIdAndUpdate((res.locals.params as { id: string }).id, { $set: res.locals.body }, { returnDocument: 'after' }).lean();
  if (!f) throw HttpError.notFound();
  void audit(req, 'faq.update', { type: 'faq', id: String(f._id), label: f.q });
  ok(res, faqDto(f));
});
adminRouter.delete('/faqs/:id', ADMINS, idParam, async (req, res) => {
  const f = await Faq.findByIdAndDelete((res.locals.params as { id: string }).id).lean();
  if (f) void audit(req, 'faq.delete', { type: 'faq', id: String(f._id), label: f.q });
  res.status(204).end();
});

adminRouter.get('/pages', ADMINS, async (_req, res) => ok(res, (await Page.find().lean()).map((p) => ({ slug: p._id, title: p.title, body: p.body, updatedAt: iso(p.updatedAt as Date) }))));
adminRouter.put('/pages/:slug', ADMINS, validate({ params: z.object({ slug: z.enum(['terms', 'privacy', 'refund', 'safety']) }), body: z.object({ title: z.string().trim().min(2).max(80), body: z.array(z.string().trim().min(1).max(2000)).min(1).max(50) }) }), async (req, res) => {
  const slug = (res.locals.params as { slug: string }).slug;
  const p = await Page.findByIdAndUpdate(slug, { $set: res.locals.body }, { upsert: true, returnDocument: 'after' }).lean();
  void audit(req, 'page.update', { type: 'page', id: slug, label: p!.title });
  ok(res, { slug, title: p!.title, body: p!.body, updatedAt: iso(p!.updatedAt as Date) });
});

adminRouter.post('/uploads/banner', ADMINS, upload.banner, async (req, res) => {
  if (!req.file) throw HttpError.badRequest('Choose an image');
  ok(res, { url: publicUrl(req.file) }, 201);
});

// ======================================================================
// Customization Settings (feature toggles + maintenance)
// ======================================================================
adminRouter.get('/settings', ADMINS, async (_req, res) => {
  const s = await getSettings();
  ok(res, { ...publicSettings(s), subscriptionRequiredFor: s.subscriptionRequiredFor, featureKeys: FEATURE_KEYS, updatedAt: iso(s.updatedAt as Date) });
});

const settingsBody = z.object({
  features: z.object(Object.fromEntries(FEATURE_KEYS.map((k) => [k, z.boolean()]))).partial().optional(),
  maintenance: z.object({ enabled: z.boolean(), title: z.string().trim().max(80), message: z.string().trim().max(400), eta: z.string().trim().max(60) }).partial().optional(),
  subscriptionRequiredFor: z.array(z.enum(['customer', 'worker'])).max(2).optional(),
  radiusOptions: z.array(z.union([z.literal(5), z.literal(10), z.literal(15)])).min(1).max(3).optional(),
  defaultRadiusKm: z.union([z.literal(5), z.literal(10), z.literal(15)]).optional(),
  supportEmail: z.email().optional(),
  supportPhone: z.string().trim().max(20).optional(),
  appVersion: z.string().trim().max(20).optional(),
});
adminRouter.patch('/settings', ADMINS, validate({ body: settingsBody }), async (req, res) => {
  const b = res.locals.body as z.infer<typeof settingsBody>;
  if (b.maintenance?.enabled !== undefined && req.admin!.role !== 'super_admin') throw HttpError.forbidden('Only the super admin can toggle maintenance mode');
  // Dotted $set so a partial toggle never wipes sibling keys.
  const set: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(b)) {
    if ((k === 'features' || k === 'maintenance') && v) for (const [kk, vv] of Object.entries(v)) set[`${k}.${kk}`] = vv;
    else if (v !== undefined) set[k] = v;
  }
  await Setting.updateOne({ _id: 'app' }, { $set: set }, { upsert: true });
  invalidateSettings();
  const s = await getSettings();
  // Every open app picks this up instantly (maintenance screen, hidden features) — no polling.
  broadcast('settings:update', publicSettings(s));
  void audit(req, b.maintenance?.enabled !== undefined ? (b.maintenance.enabled ? 'maintenance.on' : 'maintenance.off') : 'settings.update', { type: 'settings', id: 'app', label: 'Customization settings' }, undefined, set);
  ok(res, { ...publicSettings(s), subscriptionRequiredFor: s.subscriptionRequiredFor, featureKeys: FEATURE_KEYS, updatedAt: iso(s.updatedAt as Date) });
});

// ======================================================================
// Audit logs, staff
// ======================================================================
adminRouter.get('/audit-logs', SUPER, LQ, async (_req, res) => {
  const q = res.locals.query as ListQ;
  const filter: AnyFilter = { ...range(q, 'at'), ...(q.q && { $or: [{ action: new RegExp(escapeRegex(q.q), 'i') }, { target: new RegExp(escapeRegex(q.q), 'i') }, { actorName: new RegExp(escapeRegex(q.q), 'i') }] }) };
  const [rows, total] = await Promise.all([AuditLog.find(filter).sort({ at: -1 }).skip(q.cursor).limit(q.limit).lean(), AuditLog.countDocuments(filter)]);
  ok(res, paged(rows.map((l) => ({ id: String(l._id), actor: l.actorName ?? 'system', action: l.action, target: l.target ?? '', reason: l.reason, ip: l.ip, at: iso(l.at as Date)! })), q.cursor, q.limit, total));
});

const staffDto = (a: { _id: unknown; name: string; email: string; role: string; status: string; mfaSecret?: string | null; lastLoginAt?: Date | null }) =>
  ({ id: String(a._id), name: a.name, email: a.email, role: a.role, status: a.status, mfa: !!a.mfaSecret, lastLoginAt: iso(a.lastLoginAt) });
adminRouter.get('/staff', ANY, async (req, res) => {
  // Support/admin need the list for complaint assignment; only super admin sees disabled accounts.
  const rows = await Admin.find(req.admin!.role === 'super_admin' ? {} : { status: 'active' }).sort({ createdAt: 1 }).lean();
  ok(res, rows.map(staffDto));
});
const staffBody = z.object({ name: z.string().trim().min(2).max(60), email: z.email(), password: z.string().min(8).max(100), role: z.enum(['super_admin', 'admin', 'support']) });
adminRouter.post('/staff', SUPER, validate({ body: staffBody }), async (req, res) => {
  const b = res.locals.body as z.infer<typeof staffBody>;
  if (await Admin.exists({ email: b.email.toLowerCase() })) throw new HttpError(409, 'EXISTS', 'Email already registered');
  const a = await Admin.create({ name: b.name, email: b.email, role: b.role, passwordHash: await hashPassword(b.password) });
  void audit(req, 'staff.create', { type: 'admin', id: String(a._id), label: `${a.name} (${a.role})` });
  ok(res, staffDto(a.toObject()), 201);
});
adminRouter.patch('/staff/:id', SUPER, idParam, validate({ body: z.object({ role: z.enum(['super_admin', 'admin', 'support']).optional(), status: z.enum(['active', 'disabled']).optional(), resetMfa: z.boolean().optional() }) }), async (req, res) => {
  const id = (res.locals.params as { id: string }).id;
  if (id === req.admin!.sub) throw HttpError.badRequest('You cannot change your own role or status');
  const b = res.locals.body as { role?: string; status?: string; resetMfa?: boolean };
  const a = await Admin.findByIdAndUpdate(id, { $set: { ...(b.role && { role: b.role }), ...(b.status && { status: b.status }) }, ...(b.resetMfa && { $unset: { mfaSecret: 1 } }) }, { returnDocument: 'after' }).lean();
  if (!a) throw HttpError.notFound();
  void audit(req, 'staff.update', { type: 'admin', id, label: a.name }, undefined, b);
  ok(res, staffDto(a));
});

// ======================================================================
// Reports & CSV export (SRS 7: date-range, role-restricted)
// ======================================================================
const csv = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]!);
  // Prefix formula-like cells so spreadsheets don't execute them (CSV injection).
  const cell = (v: unknown) => { let s = v == null ? '' : String(v); if (/^[=+\-@]/.test(s)) s = `'${s}`; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n');
};
adminRouter.get('/export/:type', ADMINS, validate({ params: z.object({ type: z.enum(['users', 'transactions', 'complaints']) }), query: listQuery }), async (req, res) => {
  const { type } = res.locals.params as { type: string };
  const q = res.locals.query as ListQ;
  let rows: Record<string, unknown>[] = [];
  if (type === 'users') {
    rows = (await User.find({ status: { $ne: 'deleted' }, ...range(q) }).sort({ createdAt: -1 }).limit(20000).lean()).map((u) => ({
      id: String(u._id), name: u.name, mobile: `******${u.mobile.slice(-4)}`, roles: u.roles.join('|'), status: u.status, city: u.city, joined: iso(u.createdAt as Date),
    })); // mobile masked — privacy safeguard
  } else if (type === 'transactions') {
    rows = (await Payment.find(range(q)).sort({ createdAt: -1 }).limit(20000).lean()).map((p) => ({
      order: p.orderId, payment: p.paymentId, plan: p.planName, amount: p.amount, status: p.status, gateway: p.gateway, refund: p.refundId, created: iso(p.createdAt as Date), paid: iso(p.paidAt),
    }));
  } else {
    rows = (await Complaint.find(range(q)).sort({ createdAt: -1 }).limit(20000).lean()).map((c) => ({
      id: c.code, category: c.category, target: c.targetType, status: c.status, created: iso(c.createdAt as Date), resolution: c.resolution,
    }));
  }
  void audit(req, `export.${type}`, { type: 'export', id: type }, undefined, { from: q.from, to: q.to, rows: rows.length });
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="worknear-${type}-${new Date().toISOString().slice(0, 10)}.csv"` });
  res.send('﻿' + csv(rows));
});

