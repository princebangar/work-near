import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { HttpError, escapeRegex, logger, ok, paged, validate, type AnyFilter } from '../../lib/core.js';
import { requirePerm } from '../../middlewares/auth.js';
import { emitTo } from '../../lib/socket.js';
import { sendPush } from '../../lib/fcm.js';
import { toNotificationDto } from '../../lib/notify.js';
import { featureOn } from '../../models/content.js';
import { User } from '../../models/user.js';
import { WorkerProfile } from '../../models/worker.js';
import { PushToken } from '../../models/PushToken.js';
import { Broadcast, Notification } from '../../models/ops.js';

/**
 * Broadcast notifications (Admin → Broadcast): one message to all users, all customers, all workers, or hand-picked
 * people. Each recipient gets an in-app inbox row (+ live socket event) and a device push.
 * Sending runs in the background in batches, so a broadcast to every user never blocks the request.
 */
export const broadcastRouter = Router();
const P = requirePerm('broadcast');

const AUDIENCE = ['all', 'customers', 'workers', 'custom'] as const;
const BATCH = 500; // FCM multicast limit per call
const MAX_CUSTOM = 1000;
const oid = z.string().regex(/^[a-f\d]{24}$/);
const iso = (d?: Date | null) => (d ? d.toISOString() : undefined);

/** Who can receive: active accounts only (never suspended / deleted / pending deletion). */
const baseFilter = (audience: (typeof AUDIENCE)[number]): AnyFilter => ({
  status: 'active',
  ...(audience === 'customers' && { roles: 'customer' }),
  ...(audience === 'workers' && { roles: 'worker' }),
});

type BroadcastLean = { _id: Types.ObjectId; title: string; body: string; link?: string | null; kind: string; audience: string; status: string; recipients: number; pushSent: number; createdByName?: string | null; createdAt?: Date; error?: string | null };
const dto = (b: BroadcastLean) => ({
  id: String(b._id), title: b.title, body: b.body, link: b.link || undefined, kind: b.kind, audience: b.audience, status: b.status,
  recipients: b.recipients, pushSent: b.pushSent, createdBy: b.createdByName ?? '—', createdAt: iso(b.createdAt)!, error: b.error ?? undefined,
});

/** Live counts for the audience picker. */
broadcastRouter.get('/counts', P, async (_req, res) => {
  const [all, customers, workers] = await Promise.all([
    User.countDocuments(baseFilter('all')), User.countDocuments(baseFilter('customers')), User.countDocuments(baseFilter('workers')),
  ]);
  ok(res, { all, customers, workers });
});

/** Recipient search for "Selected people" (name or mobile), paged. */
broadcastRouter.get('/recipients', P, validate({
  query: z.object({
    q: z.string().trim().max(60).optional(), role: z.enum(['all', 'customers', 'workers']).default('all'),
    cursor: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(1).max(100).default(30),
  }),
}), async (_req, res) => {
  const q = res.locals.query as { q?: string; role: 'all' | 'customers' | 'workers'; cursor: number; limit: number };
  const filter: AnyFilter = { ...baseFilter(q.role), name: { $ne: '' } };
  if (q.q) filter.$or = [{ name: new RegExp(escapeRegex(q.q), 'i') }, { mobile: new RegExp(escapeRegex(q.q)) }];
  const [rows, total] = await Promise.all([
    User.find(filter, { name: 1, mobile: 1, roles: 1, avatar: 1 }).sort({ createdAt: -1 }).skip(q.cursor).limit(q.limit).lean(),
    User.countDocuments(filter),
  ]);
  const wp = new Map((await WorkerProfile.find({ user: { $in: rows.map((r) => r._id) } }, { user: 1, displayName: 1 }).lean()).map((w) => [String(w.user), w.displayName]));
  ok(res, paged(rows.map((u) => ({
    id: String(u._id), name: u.name, workerName: wp.get(String(u._id)), mobile: `******${u.mobile.slice(-4)}`, roles: u.roles, avatar: u.avatar || undefined,
  })), q.cursor, q.limit, total));
});

broadcastRouter.get('/', P, validate({ query: z.object({ cursor: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(1).max(100).default(25) }) }), async (_req, res) => {
  const q = res.locals.query as { cursor: number; limit: number };
  const [rows, total] = await Promise.all([Broadcast.find().sort({ createdAt: -1 }).skip(q.cursor).limit(q.limit).lean(), Broadcast.countDocuments()]);
  ok(res, paged(rows.map((b) => dto(b as BroadcastLean)), q.cursor, q.limit, total));
});

const sendBody = z.object({
  title: z.string().trim().min(3, 'Title is too short').max(80),
  body: z.string().trim().min(5, 'Message is too short').max(500),
  link: z.union([z.string().trim().max(120).regex(/^\/(?!\/)/, 'Link must be an in-app path like /subscription'), z.literal('')]).default(''),
  kind: z.enum(['announcement', 'offer']).default('announcement'),
  audience: z.enum(AUDIENCE),
  targetIds: z.array(oid).max(MAX_CUSTOM).default([]),
});

broadcastRouter.post('/', P, validate({ body: sendBody }), async (req, res) => {
  const b = res.locals.body as z.infer<typeof sendBody>;
  const targetIds = [...new Set(b.targetIds)];
  if (b.audience === 'custom' && !targetIds.length) throw HttpError.badRequest('Select at least one recipient');
  const doc = await Broadcast.create({
    title: b.title, body: b.body, link: b.link, kind: b.kind, audience: b.audience,
    targetIds: b.audience === 'custom' ? targetIds : [], createdBy: req.admin!.sub, createdByName: req.admin!.name,
  });
  void deliver(doc._id, b, targetIds); // background
  ok(res, dto(doc.toObject() as BroadcastLean), 202);
});

/** Recall: removes the history row and the inbox entries it created (pushes already shown on devices can't be unsent). */
broadcastRouter.delete('/:id', P, validate({ params: z.object({ id: oid }) }), async (_req, res) => {
  const id = (res.locals.params as { id: string }).id;
  const b = await Broadcast.findByIdAndDelete(id).lean();
  if (!b) throw HttpError.notFound();
  await Notification.deleteMany({ broadcast: b._id });
  res.status(204).end();
});

async function deliver(id: Types.ObjectId, b: z.infer<typeof sendBody>, targetIds: string[]) {
  let recipients = 0, pushSent = 0;
  try {
    const pushOn = await featureOn('pushNotifications');
    const filter: AnyFilter = b.audience === 'custom' ? { ...baseFilter('all'), _id: { $in: targetIds.map((x) => new Types.ObjectId(x)) } } : baseFilter(b.audience);
    // Offers are non-essential (SRS 5.8): users who switched "Offers" off are skipped entirely.
    if (b.kind === 'offer') filter['notif.offers'] = { $ne: false };
    const cursor = User.find(filter, { _id: 1 }).lean().cursor({ batchSize: BATCH });
    let batch: Types.ObjectId[] = [];
    const flush = async () => {
      if (!batch.length) return;
      const ids = batch;
      batch = [];
      const now = new Date();
      const rows = await Notification.insertMany(ids.map((user) => ({ user, type: 'system' as const, title: b.title, body: b.body, link: b.link || undefined, broadcast: id, createdAt: now })), { ordered: false });
      rows.forEach((n) => emitTo(String(n.user), 'notification:new', toNotificationDto(n)));
      recipients += ids.length;
      if (pushOn) {
        const tokens = (await PushToken.find({ userId: { $in: ids.map(String) } }, { token: 1, _id: 0 }).lean()).map((t) => t.token);
        for (let i = 0; i < tokens.length; i += BATCH) {
          const r = await sendPush(tokens.slice(i, i + BATCH), { title: b.title, body: b.body, link: b.link || '/notifications', data: { type: 'system' } });
          pushSent += r.sent;
          if (r.deadTokens.length) await PushToken.deleteMany({ token: { $in: r.deadTokens } });
        }
      }
      await Broadcast.updateOne({ _id: id }, { recipients, pushSent }); // progress for the history table
    };
    for await (const u of cursor) {
      batch.push(u._id as Types.ObjectId);
      if (batch.length >= BATCH) await flush();
    }
    await flush();
    await Broadcast.updateOne({ _id: id }, { status: 'sent', recipients, pushSent });
  } catch (err) {
    logger.error({ err, broadcast: String(id) }, 'broadcast failed');
    await Broadcast.updateOne({ _id: id }, { status: 'failed', recipients, pushSent, error: (err as Error).message?.slice(0, 200) }).catch(() => undefined);
  }
}
