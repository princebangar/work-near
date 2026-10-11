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

/** Conversation as seen by `viewer` (matches Frontend `Conversation`). */
export async function conversationDto(c: ConvLean, viewer: string) {
  const side = sideOf(c, viewer)!;
  const peerId = String(side === 'customer' ? c.worker : c.customer);
  const me = side === 'customer' ? c.customerState : c.workerState;
  const [peer, iBlocked, theyBlocked, reviewed] = await Promise.all([
    peerFor(peerId, side === 'customer'),
    Block.exists({ blocker: viewer, blocked: peerId }),
    Block.exists({ blocker: peerId, blocked: viewer }),
    side === 'customer' ? Review.exists({ conversation: c._id }) : null,
  ]);
  return {
    id: String(c._id), peer, myRole: side, lastMessage: c.lastMessage, lastMessageAt: (c.lastMessageAt as Date).toISOString(),
    unread: me?.unread ?? 0, muted: !!me?.muted, blocked: !!iBlocked, blockedBy: !!theyBlocked,
    canReview: side === 'customer' && c.workerReplied && !reviewed, reviewed: !!reviewed,
  };
}

export const messageDto = (
  m: { _id: Types.ObjectId; conversation: Types.ObjectId; sender: Types.ObjectId; type?: string | null; text?: string | null; image?: string | null; sentAt?: Date; readAt?: Date | null },
) => ({
  id: String(m._id), conversationId: String(m.conversation), senderId: String(m.sender), type: m.type ?? 'text',
  text: m.text ?? '', image: m.image ?? undefined, sentAt: (m.sentAt ?? new Date()).toISOString(), status: m.readAt ? 'read' : 'sent',
});
