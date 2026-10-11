import type { Types } from 'mongoose';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { HttpError, ok, toId, validate } from '../../lib/core.js';
import { requireAuth } from '../../middlewares/auth.js';
import { requireFeature } from '../../middlewares/features.js';
import { publicUrl, removeFile, upload } from '../../lib/upload.js';
import { limiter, uploadLimiter } from '../../lib/limits.js';
import { emitTo } from '../../lib/socket.js';
import { pushToUser } from '../../lib/notify.js';
import { Block } from '../../models/user.js';
import { WorkerProfile } from '../../models/worker.js';
import { Conversation, Message } from '../../models/chat.js';
import { Subscription } from '../../models/billing.js';
import { getSettings } from '../../models/content.js';
import { conversationDto, conversationDtos, messageDto, sideOf } from './chat.service.js';

export const chatRouter = Router();
chatRouter.use(requireAuth);

const oid = z.string().regex(/^[a-f\d]{24}$/, 'Invalid id');
const idParam = validate({ params: z.object({ id: oid }) });

// Anti-spam: per-user message rate (SRS 5.4).
const messageLimiter = limiter({ name: 'message', windowMs: 60_000, limit: 30, key: (req) => req.user!.sub, message: 'You are sending messages too fast. Please slow down.' });
// New threads per user per hour — stops one account from cold-messaging every worker in the city.
const newChatLimiter = limiter({ name: 'new-chat', windowMs: 60 * 60_000, limit: 30, key: (req) => req.user!.sub, message: 'You have started many chats recently. Please try again later.' });

async function mine(req: Request, id: string) {
  const c = await Conversation.findById(id).lean();
  if (!c || !sideOf(c, req.user!.sub)) throw HttpError.notFound('Conversation not found'); // IDOR-safe: same 404 for others' threads
  return c;
}

chatRouter.get('/conversations', async (req, res) => {
  const me = req.user!.sub;
  const rows = await Conversation.find({ $or: [{ customer: me }, { worker: me }] }).sort({ lastMessageAt: -1 }).limit(200).lean();
  ok(res, await conversationDtos(rows, me));
});

chatRouter.post('/conversations', requireFeature('chat'), newChatLimiter, validate({ body: z.object({ workerId: oid }) }), async (req, res) => {
  const me = req.user!.sub;
  const { workerId } = res.locals.body as { workerId: string };
  if (workerId === me) throw HttpError.badRequest('You cannot chat with yourself');
  const existing = await Conversation.findOne({ customer: me, worker: workerId }).lean();
  if (existing) return ok(res, await conversationDto(existing, me));

  const wp = await WorkerProfile.findOne({ user: workerId }, { visible: 1, restricted: 1 }).lean();
  if (!wp || !wp.visible || wp.restricted) throw HttpError.notFound('Worker not available');
  if (await Block.exists({ $or: [{ blocker: workerId, blocked: me }, { blocker: me, blocked: workerId }] })) {
    throw HttpError.forbidden('You cannot start a chat with this user');
  }
  const { subscriptionRequiredFor, features } = await getSettings();
  if (features?.subscriptions && subscriptionRequiredFor.includes('customer') && !(await Subscription.exists({ user: me, status: 'active', endAt: { $gt: new Date() } }))) {
    throw new HttpError(402, 'SUBSCRIPTION_REQUIRED', 'An active subscription is required to start new chats');
  }
  const c = await Conversation.findOneAndUpdate(
    { customer: me, worker: workerId },
    { $setOnInsert: { customer: me, worker: workerId, lastMessageAt: new Date() } },
    { upsert: true, returnDocument: 'after' },
  ).lean();
  ok(res, await conversationDto(c!, me), 201);
});

const patchBody = z.object({ muted: z.boolean().optional(), blocked: z.boolean().optional() });
chatRouter.patch('/conversations/:id', idParam, validate({ body: patchBody }), async (req, res) => {
  const me = req.user!.sub;
  const c = await mine(req, (res.locals.params as { id: string }).id);
  const side = sideOf(c, me)!;
  const b = res.locals.body as z.infer<typeof patchBody>;
  if (b.muted !== undefined) await Conversation.updateOne({ _id: c._id }, { [`${side}State.muted`]: b.muted });
  if (b.blocked !== undefined) {
    const peer = String(side === 'customer' ? c.worker : c.customer);
    if (b.blocked) await Block.updateOne({ blocker: me, blocked: peer }, { $setOnInsert: { blocker: me, blocked: peer } }, { upsert: true });
    else await Block.deleteOne({ blocker: me, blocked: peer });
  }
  ok(res, await conversationDto((await Conversation.findById(c._id).lean())!, me));
});

/** Marks peer messages read, clears my unread counter and tells the peer (read receipts). */
async function markRead(c: { _id: Types.ObjectId; customer: Types.ObjectId; worker: Types.ObjectId }, me: string, side: 'customer' | 'worker') {
  const now = new Date();
  const r = await Message.updateMany({ conversation: c._id, sender: { $ne: toId(me) }, readAt: null }, { readAt: now });
  await Conversation.updateOne({ _id: c._id }, { [`${side}State.unread`]: 0, [`${side}State.lastReadAt`]: now });
  if (r.modifiedCount) emitTo(String(side === 'customer' ? c.worker : c.customer), 'conversation:read', { conversationId: String(c._id), readAt: now.toISOString() });
}

chatRouter.get('/conversations/:id/messages', idParam, validate({ query: z.object({ before: z.iso.datetime().optional(), limit: z.coerce.number().int().min(1).max(100).default(50) }) }), async (req, res) => {
  const me = req.user!.sub;
  const c = await mine(req, (res.locals.params as { id: string }).id);
  const { before, limit } = res.locals.query as { before?: string; limit: number };
  const rows = await Message.find({ conversation: c._id, moderation: { $ne: 'removed' as const }, ...(before ? { sentAt: { $lt: new Date(before) } } : {}) })
    .sort({ sentAt: -1 }).limit(limit + 1).lean();
  const more = rows.length > limit;
  const items = rows.slice(0, limit).reverse().map(messageDto);
  await markRead(c, me, sideOf(c, me)!);
  ok(res, { items, nextCursor: more ? items[0]!.sentAt : null, total: items.length });
});

chatRouter.post('/conversations/:id/read', idParam, async (req, res) => {
  const c = await mine(req, (res.locals.params as { id: string }).id);
  await markRead(c, req.user!.sub, sideOf(c, req.user!.sub)!);
  res.status(204).end();
});

async function send(req: Request, convId: string, payload: { text: string; image?: string }) {
  const me = req.user!.sub;
  const c = await mine(req, convId);
  const side = sideOf(c, me)!;
  const peer = String(side === 'customer' ? c.worker : c.customer);
  if (await Block.exists({ $or: [{ blocker: peer, blocked: me }, { blocker: me, blocked: peer }] })) {
    throw HttpError.forbidden('Messaging is blocked for this conversation');
  }
  const m = await Message.create({ conversation: c._id, sender: toId(me), type: payload.image ? 'image' : 'text', text: payload.text, image: payload.image });
  const peerSide = side === 'customer' ? 'worker' : 'customer';
  const updated = await Conversation.findByIdAndUpdate(
    c._id,
    {
      lastMessage: payload.image ? '📷 Photo' : payload.text.slice(0, 140), lastMessageAt: m.sentAt,
      $inc: { [`${peerSide}State.unread`]: 1 }, ...(side === 'worker' && { workerReplied: true }),
    },
    { returnDocument: 'after' },
  ).lean();
  const dto = messageDto(m);
  emitTo(me, 'message:new', { message: dto }); // my other devices
  // Peer gets the message + their view of the thread. That view is built once and also gives the push title
  // (its `peer` is me, as the peer sees me). Runs off the request path.
  const peerState = peerSide === 'customer' ? updated!.customerState : updated!.workerState;
  void conversationDto(updated!, peer)
    .then((conv) => {
      emitTo(peer, 'message:new', { message: dto, conversation: conv });
      if (!peerState?.muted) {
        void pushToUser(peer, { type: 'chat', title: `New message from ${conv.peer.name}`, body: payload.image ? '📷 Photo' : payload.text.slice(0, 120), link: `/chats/${convId}` });
      }
    })
    .catch((err) => req.log.warn({ err }, 'chat fan-out failed'));
  return dto;
}

chatRouter.post('/conversations/:id/messages', requireFeature('chat'), messageLimiter, idParam, validate({ body: z.object({ text: z.string().trim().min(1, 'Message is empty').max(2000) }) }), async (req, res) => {
  ok(res, await send(req, (res.locals.params as { id: string }).id, { text: (res.locals.body as { text: string }).text }), 201);
});

chatRouter.post('/conversations/:id/images', requireFeature('chat'), requireFeature('chatAttachments'), messageLimiter, uploadLimiter, idParam, upload.chatImage, async (req, res) => {
  if (!req.file) throw HttpError.badRequest('Choose an image');
  const { features } = await getSettings();
  if (features?.chatAttachments === false) {
    removeFile(req.file.path);
    throw HttpError.forbidden('Image attachments are disabled');
  }
  const caption = typeof req.body?.text === 'string' ? req.body.text.slice(0, 500) : '';
  try {
    ok(res, await send(req, (res.locals.params as { id: string }).id, { text: caption, image: publicUrl(req.file) }), 201);
  } catch (e) {
    removeFile(req.file.path);
    throw e;
  }
});
