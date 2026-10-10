import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { HttpError, ok, validate } from '../../lib/core.js';
import { requireAuth } from '../../middlewares/auth.js';
import { sendPush, type PushMessage } from '../../lib/fcm.js';
import { PushToken } from '../../models/PushToken.js';

/** Send a push to every device of a user and prune tokens FCM reports as dead. */
export async function notifyUser(userId: string, msg: PushMessage) {
  const rows = await PushToken.find({ userId }, { token: 1, _id: 0 }).lean();
  const { sent, deadTokens } = await sendPush(rows.map((r) => r.token), msg);
  if (deadTokens.length) await PushToken.deleteMany({ token: { $in: deadTokens } });
  return { sent, removed: deadTokens.length };
}

export const pushRouter = Router();

const tokenBody = z.object({ token: z.string().min(20).max(4096), platform: z.enum(['web', 'android', 'ios']).default('web') });

// Upsert: re-registering the same token just refreshes lastSeenAt (and moves it to this user if the device changed hands).
pushRouter.post('/me/push-tokens', requireAuth, validate({ body: tokenBody }), async (req, res) => {
  const { token, platform } = res.locals.body as z.infer<typeof tokenBody>;
  await PushToken.updateOne(
    { token },
    { $set: { userId: req.user!.sub, platform, userAgent: req.get('user-agent')?.slice(0, 300), lastSeenAt: new Date() } },
    { upsert: true },
  );
  ok(res, { registered: true }, 201);
});

pushRouter.delete('/me/push-tokens', requireAuth, validate({ body: z.object({ token: z.string().min(20) }) }), async (req, res) => {
  await PushToken.deleteOne({ token: (res.locals.body as { token: string }).token, userId: req.user!.sub });
  res.status(204).end();
});

// Dev helper: send a test push to your own devices.
pushRouter.post('/notifications/test', requireAuth, async (req, res) => {
  if (env.isProd) throw HttpError.notFound();
  ok(res, await notifyUser(req.user!.sub, { title: 'WorkNear test 🔔', body: 'Push notifications are working!', link: '/notifications' }));
});
