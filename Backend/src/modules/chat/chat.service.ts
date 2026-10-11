import type { Types } from 'mongoose';
import { User, Block } from '../../models/user.js';
import { WorkerProfile, Review } from '../../models/worker.js';
import { Category } from '../../models/content.js';
import { Conversation } from '../../models/chat.js';

type ConvLean = NonNullable<Awaited<ReturnType<typeof loadConv>>>;
const loadConv = (id: string) => Conversation.findById(id).lean();

/**
 * How `userId` appears to others. When shown as a worker (asWorker) we use the public worker profile
 * (display name, work photo, category); otherwise the customer's own name/avatar.
 */
export async function peerFor(userId: string, asWorker?: boolean) {
  const [u, wp] = await Promise.all([
    User.findById(userId, { name: 1, avatar: 1 }).lean(),
    asWorker === false ? null : WorkerProfile.findOne({ user: userId }, { displayName: 1, photo: 1, category: 1 }).lean(),
  ]);
  if (wp && asWorker !== false) {
    const cat = await Category.findById(wp.category, { name: 1 }).lean();
    return { id: userId, name: wp.displayName, photo: wp.photo || u?.avatar || '', role: 'worker' as const, subtitle: cat?.name ?? 'Worker' };
  }
  return { id: userId, name: u?.name || 'WorkNear user', photo: u?.avatar ?? '', role: 'customer' as const, subtitle: 'Customer' };
}

export const sideOf = (c: { customer: Types.ObjectId; worker: Types.ObjectId }, userId: string) =>
  String(c.customer) === userId ? 'customer' : String(c.worker) === userId ? 'worker' : null;

/**
 * Conversations as seen by `viewer` (matches Frontend `Conversation`).
 * Batched: a fixed 6 queries for the whole list instead of ~6 per conversation (the chat list can hold 200 threads).
 */
export async function conversationDtos(rows: ConvLean[], viewer: string) {
  if (!rows.length) return [];
  const peerOf = (c: ConvLean) => String(sideOf(c, viewer) === 'customer' ? c.worker : c.customer);
  const peerIds = [...new Set(rows.map(peerOf))];
  // Peers I talk to as a customer are shown with their worker profile.
  const workerPeers = [...new Set(rows.filter((c) => sideOf(c, viewer) === 'customer').map(peerOf))];
  const [users, profiles, blocks, reviews] = await Promise.all([
    User.find({ _id: { $in: peerIds } }, { name: 1, avatar: 1 }).lean(),
    workerPeers.length ? WorkerProfile.find({ user: { $in: workerPeers } }, { user: 1, displayName: 1, photo: 1, category: 1 }).lean() : [],
    Block.find({ $or: [{ blocker: viewer, blocked: { $in: peerIds } }, { blocker: { $in: peerIds }, blocked: viewer }] }, { blocker: 1, blocked: 1 }).lean(),
    Review.find({ conversation: { $in: rows.map((c) => c._id) } }, { conversation: 1 }).lean(),
  ]);
  const cats = profiles.length ? await Category.find({ _id: { $in: [...new Set(profiles.map((p) => p.category))] } }, { name: 1 }).lean() : [];
  const userBy = new Map(users.map((u) => [String(u._id), u]));
  const profileBy = new Map(profiles.map((p) => [String(p.user), p]));
  const catBy = new Map(cats.map((c) => [String(c._id), c.name]));
  const iBlocked = new Set(blocks.filter((b) => String(b.blocker) === viewer).map((b) => String(b.blocked)));
  const theyBlocked = new Set(blocks.filter((b) => String(b.blocked) === viewer).map((b) => String(b.blocker)));
  const reviewed = new Set(reviews.map((r) => String(r.conversation)));

  return rows.map((c) => {
    const side = sideOf(c, viewer)!;
    const peerId = peerOf(c);
    const u = userBy.get(peerId);
    const wp = side === 'customer' ? profileBy.get(peerId) : undefined;
    const peer = wp
      ? { id: peerId, name: wp.displayName, photo: wp.photo || u?.avatar || '', role: 'worker' as const, subtitle: catBy.get(wp.category) ?? 'Worker' }
      : { id: peerId, name: u?.name || 'WorkNear user', photo: u?.avatar ?? '', role: 'customer' as const, subtitle: 'Customer' };
    const me = side === 'customer' ? c.customerState : c.workerState;
    const wasReviewed = side === 'customer' && reviewed.has(String(c._id));
    return {
      id: String(c._id), peer, myRole: side, lastMessage: c.lastMessage, lastMessageAt: (c.lastMessageAt as Date).toISOString(),
      unread: me?.unread ?? 0, muted: !!me?.muted, blocked: iBlocked.has(peerId), blockedBy: theyBlocked.has(peerId),
      canReview: side === 'customer' && c.workerReplied && !wasReviewed, reviewed: wasReviewed,
    };
  });
}

export const conversationDto = async (c: ConvLean, viewer: string) => (await conversationDtos([c], viewer))[0]!;

export const messageDto = (
  m: { _id: Types.ObjectId; conversation: Types.ObjectId; sender: Types.ObjectId; type?: string | null; text?: string | null; image?: string | null; sentAt?: Date; readAt?: Date | null },
) => ({
  id: String(m._id), conversationId: String(m.conversation), senderId: String(m.sender), type: m.type ?? 'text',
  text: m.text ?? '', image: m.image ?? undefined, sentAt: (m.sentAt ?? new Date()).toISOString(), status: m.readAt ? 'read' : 'sent',
});
