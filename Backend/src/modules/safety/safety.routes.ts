import { Router } from 'express';
import { z } from 'zod';
import { HttpError, ok, toId, validate } from '../../lib/core.js';
import { requireAuth } from '../../middlewares/auth.js';
import { requireFeature } from '../../middlewares/features.js';
import { privateRel, removeFile, upload } from '../../lib/upload.js';
import { limiter, uploadLimiter, userKey } from '../../lib/limits.js';
import { env } from '../../config/env.js';
import { notify } from '../../lib/notify.js';
import { Conversation } from '../../models/chat.js';
import { Review } from '../../models/worker.js';
import { Complaint, nextSeq } from '../../models/ops.js';
import { refreshRating } from '../workers/workers.service.js';
import { sideOf } from '../chat/chat.service.js';

export const safetyRouter = Router();
safetyRouter.use(requireAuth);

// Reports and complaints notify staff — cap them per user so one account can't flood the admin queue.
const reportLimiter = limiter({ name: 'report', windowMs: 60 * 60_000, limit: env.REPORT_RATE_LIMIT, key: userKey, message: 'You have sent many reports recently. Please try again later.' });

const oid = z.string().regex(/^[a-f\d]{24}$/, 'Invalid id');

// ---------- Reviews (SRS 5.7: only after a recorded interaction, one per conversation) ----------
async function eligibility(me: string, workerId: string) {
  const c = await Conversation.findOne({ customer: me, worker: workerId }, { workerReplied: 1 }).lean();
  if (!c) return { eligible: false, reason: 'Chat with this worker first. You can review after they reply.' } as const;
  if (!c.workerReplied) return { eligible: false, reason: 'You can review once the worker has replied to your chat.' } as const;
  if (await Review.exists({ conversation: c._id })) return { eligible: false, reason: 'You have already reviewed this worker.' } as const;
  return { eligible: true, conversationId: c._id } as const;
}

safetyRouter.get('/reviews/eligibility', validate({ query: z.object({ workerId: oid }) }), async (req, res) => {
  const e = await eligibility(req.user!.sub, (res.locals.query as { workerId: string }).workerId);
  ok(res, { eligible: e.eligible, reason: e.eligible ? undefined : e.reason });
});

const reviewBody = z.object({ workerId: oid, stars: z.number().int().min(1).max(5), text: z.string().trim().max(1000).default('') });
safetyRouter.post('/reviews', requireFeature('reviews'), validate({ body: reviewBody }), async (req, res) => {
  const b = res.locals.body as z.infer<typeof reviewBody>;
  const e = await eligibility(req.user!.sub, b.workerId);
  if (!e.eligible) throw new HttpError(403, 'REVIEW_NOT_ALLOWED', e.reason);
  try {
    const r = await Review.create({ reviewer: req.user!.sub, worker: b.workerId, conversation: e.conversationId, stars: b.stars, text: b.text });
    await refreshRating(b.workerId);
    void notify(b.workerId, { type: 'system', title: `New ${b.stars}★ review`, body: b.text ? b.text.slice(0, 100) : 'A customer rated your work.', link: '/my-profile' });
    ok(res, { id: String(r._id) }, 201);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new HttpError(409, 'DUPLICATE_REVIEW', 'You have already reviewed this worker.');
    throw err;
  }
});

// ---------- Complaints ----------
const complaintDto = (c: { code: string; category: string; targetType?: string | null; targetId?: string | null; description?: string | null; status: string; createdAt?: Date; resolution?: string | null }) => ({
  id: c.code, category: c.category, targetType: c.targetType ?? 'other', targetId: c.targetId ?? undefined, description: c.description ?? '',
  status: c.status, createdAt: (c.createdAt ?? new Date()).toISOString(), resolution: c.resolution ?? undefined,
});

/** Works out which user a report is really about (so admin sees "reports against user X"). */
async function resolveTarget(me: string, targetType: string, targetId?: string) {
  if (!targetId || !/^[a-f\d]{24}$/.test(targetId)) return undefined;
  if (targetType === 'profile') return targetId;
  if (targetType === 'message') {
    const c = await Conversation.findById(targetId, { customer: 1, worker: 1 }).lean();
    const side = c && sideOf(c, me);
    if (!side) throw HttpError.notFound('Conversation not found');
    return String(side === 'customer' ? c.worker : c.customer);
  }
  if (targetType === 'review') {
    const r = await Review.findByIdAndUpdate(targetId, { $inc: { reports: 1 } }).lean();
    return r ? String(r.reviewer) : undefined;
  }
  return undefined;
}

async function createComplaint(me: string, b: { category: string; description: string; targetType: string; targetId?: string; evidence?: string[] }) {
  const targetUser = await resolveTarget(me, b.targetType, b.targetId);
  const c = await Complaint.create({
    code: `C${await nextSeq('complaint')}`, reporter: toId(me), targetType: b.targetType as 'other', targetId: b.targetId, targetUser: targetUser ? toId(targetUser) : undefined,
    category: b.category, description: b.description, evidence: b.evidence ?? [],
    history: [{ at: new Date(), by: 'user', action: 'created' }],
  });
  void notify(me, { type: 'complaint', title: `Complaint #${c.code} received`, body: 'Our team will review it and update you here.', link: '/help' });
  return c;
}

const reportBody = z.object({
  targetType: z.enum(['profile', 'message', 'review']), targetId: z.string().max(40),
  reason: z.string().trim().min(2).max(60), details: z.string().trim().max(1000).optional(),
});
safetyRouter.post('/reports', requireFeature('reports'), reportLimiter, validate({ body: reportBody }), async (req, res) => {
  const b = res.locals.body as z.infer<typeof reportBody>;
  const c = await createComplaint(req.user!.sub, { category: b.reason, description: b.details || b.reason, targetType: b.targetType, targetId: b.targetId });
  ok(res, { id: c.code }, 201);
});

safetyRouter.get('/complaints/me', async (req, res) => {
  const rows = await Complaint.find({ reporter: req.user!.sub }).sort({ createdAt: -1 }).limit(100).lean();
  ok(res, rows.map(complaintDto));
});

const complaintBody = z.object({
  category: z.string().trim().min(2).max(60), description: z.string().trim().min(10, 'Describe the issue (min 10 characters)').max(2000),
  targetType: z.enum(['profile', 'message', 'review', 'fraud', 'other']).default('other'), targetId: z.string().max(40).optional(),
});
// Accepts JSON, or multipart with up to 3 evidence files.
safetyRouter.post('/complaints', requireFeature('complaints'), reportLimiter, uploadLimiter, upload.evidence, async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  // Validated after multer (multipart fields only exist then); drop the uploaded evidence if the form is invalid.
  const parsed = complaintBody.safeParse(req.body);
  if (!parsed.success) {
    files.forEach((f) => removeFile(f.path));
    throw HttpError.badRequest('Validation failed', 'VALIDATION_ERROR', z.flattenError(parsed.error).fieldErrors);
  }
  res.locals.body = parsed.data;
  const c = await createComplaint(req.user!.sub, { ...(res.locals.body as z.infer<typeof complaintBody>), evidence: files.map(privateRel) });
  ok(res, complaintDto(c.toObject()), 201);
});
