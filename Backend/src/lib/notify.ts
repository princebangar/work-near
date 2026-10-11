import type { Types } from 'mongoose';
import { logger } from './core.js';
import { emitTo } from './socket.js';
import { sendPush } from './fcm.js';
import { Notification } from '../models/ops.js';
import { PushToken } from '../models/PushToken.js';
import { User } from '../models/user.js';
import { featureOn } from '../models/content.js';

type NType = 'chat' | 'subscription' | 'verification' | 'complaint' | 'system';
interface Input { type: NType; title: string; body: string; link?: string }

// Notification categories the user may switch off; security/system/verification/complaint stay mandatory (SRS 5.8).
const OPTIONAL: Partial<Record<NType, 'chat' | 'subscription'>> = { chat: 'chat', subscription: 'subscription' };

export const toNotificationDto = (n: { _id: Types.ObjectId; type: string; title: string; body?: string | null; link?: string | null; createdAt?: Date; readAt?: Date | null }) => ({
  id: String(n._id), type: n.type, title: n.title, body: n.body ?? '', link: n.link ?? undefined,
  createdAt: (n.createdAt ?? new Date()).toISOString(), read: !!n.readAt,
});

/** Device push only (used for chat, which already has its own inbox: the conversation list). */
export async function pushToUser(userId: string, msg: Input) {
  try {
    if (!(await featureOn('pushNotifications'))) return;
    const u = await User.findById(userId, { notif: 1 }).lean();
    const pref = OPTIONAL[msg.type];
    if (pref && u?.notif?.[pref] === false) return;
    const rows = await PushToken.find({ userId }, { token: 1, _id: 0 }).lean();
    const { deadTokens } = await sendPush(rows.map((r) => r.token), { title: msg.title, body: msg.body, link: msg.link, data: { type: msg.type } });
    if (deadTokens.length) await PushToken.deleteMany({ token: { $in: deadTokens } });
  } catch (err) {
    logger.warn({ err }, 'push failed');
  }
}

/** In-app inbox row + realtime event + device push. Never throws — notifications must not break the main action. */
export async function notify(userId: string | Types.ObjectId, msg: Input) {
  const uid = String(userId);
  try {
    const n = await Notification.create({ user: uid, ...msg });
    emitTo(uid, 'notification:new', toNotificationDto(n));
  } catch (err) {
    logger.warn({ err }, 'notification insert failed');
  }
  void pushToUser(uid, msg);
}
