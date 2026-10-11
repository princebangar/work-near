import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { HttpError, ok, validate } from '../../lib/core.js';
import { requireAuth } from '../../middlewares/auth.js';
import { notify, toNotificationDto } from '../../lib/notify.js';
import { PushToken } from '../../models/PushToken.js';
import { Notification } from '../../models/ops.js';

export const pushRouter = Router();
pushRouter.use(requireAuth);

const tokenBody = z.object({ token: z.string().min(20).max(4096), platform: z.enum(['web', 'android', 'ios']).default('web') });

// Upsert: re-registering the same token just refreshes lastSeenAt (and moves it to this user if the device changed hands).
pushRouter.post('/me/push-tokens', validate({ body: tokenBody }), async (req, res) => {
  const { token, platform } = res.locals.body as z.infer<typeof tokenBody>;
  await PushToken.updateOne(
    { token },
    { $set: { userId: req.user!.sub, platform, userAgent: req.get('user-agent')?.slice(0, 300), lastSeenAt: new Date() } },
    { upsert: true },
  );
  ok(res, { registered: true }, 201);
});

pushRouter.delete('/me/push-tokens', validate({ body: z.object({ token: z.string().min(20) }) }), async (req, res) => {
  await PushToken.deleteOne({ token: (res.locals.body as { token: string }).token, userId: req.user!.sub });
  res.status(204).end();
});

// ---------- In-app inbox ----------
pushRouter.get('/notifications', async (req, res) => {
  const rows = await Notification.find({ user: req.user!.sub }).sort({ createdAt: -1 }).limit(100).lean();
  ok(res, rows.map(toNotificationDto));
});

pushRouter.patch('/notifications/:id/read', validate({ params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/) }) }), async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: (res.locals.params as { id: string }).id, user: req.user!.sub }, { readAt: new Date() }, { returnDocument: 'after' }).lean();
  if (!n) throw HttpError.notFound();
  ok(res, toNotificationDto(n));
});

pushRouter.post('/notifications/read-all', async (req, res) => {
  await Notification.updateMany({ user: req.user!.sub, readAt: null }, { readAt: new Date() });
  res.status(204).end();
});

// Dev helper: send a test notification (inbox + push) to yourself.
pushRouter.post('/notifications/test', async (req, res) => {
  if (env.isProd) throw HttpError.notFound();
  await notify(req.user!.sub, { type: 'system', title: 'WorkNear test 🔔', body: 'Push notifications are working!', link: '/notifications' });
  ok(res, { sent: true });
});
