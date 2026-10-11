import { Router } from 'express';
import { z } from 'zod';
import { HttpError, ok, personName, validate } from '../../lib/core.js';
import { requireAuth } from '../../middlewares/auth.js';
import { publicUrl, removePublic, upload } from '../../lib/upload.js';
import { uploadLimiter } from '../../lib/limits.js';
import { Block, User } from '../../models/user.js';
import { WorkerProfile } from '../../models/worker.js';
import { PushToken } from '../../models/PushToken.js';
import { getSettings } from '../../models/content.js';
import { userDto } from './me.service.js';
import { peerFor } from '../chat/chat.service.js';

export const meRouter = Router();
meRouter.use(requireAuth);

meRouter.get('/me', async (req, res) => ok(res, await userDto(req.user!.sub)));

const patchBody = z.object({
  name: personName.optional(),
  email: z.union([z.email().max(120), z.literal('')]).optional(),
  language: z.enum(['en', 'hi']).optional(),
  activeRole: z.enum(['customer', 'worker']).optional(),
  city: z.string().trim().max(60).optional(),
  notif: z.object({ chat: z.boolean(), subscription: z.boolean(), offers: z.boolean() }).partial().optional(),
});
meRouter.patch('/me', validate({ body: patchBody }), async (req, res) => {
  const b = res.locals.body as z.infer<typeof patchBody>;
  const u = await User.findById(req.user!.sub);
  if (!u) throw HttpError.notFound();
  if (b.activeRole && !u.roles.includes(b.activeRole)) {
    // Unlocking the second role needs the dual-role setting (SRS 13). First role choice is always allowed.
    const { features } = await getSettings();
    const firstChoice = !u.name;
    if (features?.dualRole === false && !firstChoice) throw HttpError.forbidden('One account can be either Customer or Worker');
    u.roles = firstChoice ? [b.activeRole] : [...u.roles, b.activeRole];
  }
  if (b.name !== undefined) u.name = b.name;
  if (b.email !== undefined) u.email = b.email || undefined;
  if (b.language) u.language = b.language;
  if (b.activeRole) u.activeRole = b.activeRole;
  if (b.city !== undefined) u.city = b.city;
  if (b.notif) Object.assign(u.notif!, b.notif);
  await u.save();
  ok(res, await userDto(String(u._id)));
});

meRouter.post('/me/avatar', uploadLimiter, upload.avatar, async (req, res) => {
  if (!req.file) throw HttpError.badRequest('Choose a photo');
  const u = await User.findById(req.user!.sub);
  if (!u) throw HttpError.notFound();
  removePublic(u.avatar);
  u.avatar = publicUrl(req.file);
  await u.save();
  ok(res, await userDto(String(u._id)));
});

// Deletion is processed by admin within 30 days; logging back in cancels the request.
meRouter.post('/me/delete-request', async (req, res) => {
  await User.updateOne({ _id: req.user!.sub }, { status: 'deleted_request', deletionRequestedAt: new Date() });
  await PushToken.deleteMany({ userId: req.user!.sub }); // no more pushes to this account's devices
  await WorkerProfile.updateOne({ user: req.user!.sub }, { visible: false });
  ok(res, { requested: true });
});

// ---------- Saved addresses (location picker: Home / Work / Other) ----------
const MAX_ADDRESSES = 10;
const addressBody = z.object({
  label: z.enum(['home', 'work', 'other']),
  name: z.string().trim().max(40).default(''),
  line: z.string().trim().max(120).default(''),
  address: z.string().trim().min(2).max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
type AddressRow = z.infer<typeof addressBody> & { _id: unknown };
const addressDto = (a: AddressRow) => ({ id: String(a._id), label: a.label, name: a.name, line: a.line, address: a.address, lat: a.lat, lng: a.lng });
const myAddresses = async (id: string) => ((await User.findById(id, { addresses: 1 }).lean())?.addresses ?? []).map((a) => addressDto(a as AddressRow));
const addrId = validate({ params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/) }) });

meRouter.get('/me/addresses', async (req, res) => ok(res, await myAddresses(req.user!.sub)));

meRouter.post('/me/addresses', validate({ body: addressBody }), async (req, res) => {
  const b = res.locals.body as z.infer<typeof addressBody>;
  // Home and Work are single slots — saving again replaces the old one.
  if (b.label !== 'other') await User.updateOne({ _id: req.user!.sub }, { $pull: { addresses: { label: b.label } } });
  const r = await User.updateOne(
    { _id: req.user!.sub, [`addresses.${MAX_ADDRESSES - 1}`]: { $exists: false } },
    { $push: { addresses: b } },
  );
  if (!r.modifiedCount) throw HttpError.badRequest(`You can save up to ${MAX_ADDRESSES} addresses`);
  ok(res, await myAddresses(req.user!.sub), 201);
});

meRouter.patch('/me/addresses/:id', addrId, validate({ body: addressBody }), async (req, res) => {
  const { id } = res.locals.params as { id: string };
  const b = res.locals.body as z.infer<typeof addressBody>;
  if (b.label !== 'other') await User.updateOne({ _id: req.user!.sub }, { $pull: { addresses: { label: b.label, _id: { $ne: id } } } });
  const set = Object.fromEntries(Object.entries(b).map(([k, v]) => [`addresses.$.${k}`, v]));
  const r = await User.updateOne({ _id: req.user!.sub, 'addresses._id': id }, { $set: set });
  if (!r.matchedCount) throw HttpError.notFound('Address not found');
  ok(res, await myAddresses(req.user!.sub));
});

meRouter.delete('/me/addresses/:id', addrId, async (req, res) => {
  await User.updateOne({ _id: req.user!.sub }, { $pull: { addresses: { _id: (res.locals.params as { id: string }).id } } });
  ok(res, await myAddresses(req.user!.sub));
});

meRouter.get('/blocked', async (req, res) => {
  const rows = await Block.find({ blocker: req.user!.sub }).sort({ createdAt: -1 }).lean();
  ok(res, await Promise.all(rows.map((b) => peerFor(String(b.blocked)))));
});

meRouter.post('/blocks', validate({ body: z.object({ userId: z.string().regex(/^[a-f\d]{24}$/) }) }), async (req, res) => {
  const { userId } = res.locals.body as { userId: string };
  if (userId === req.user!.sub) throw HttpError.badRequest('You cannot block yourself');
  await Block.updateOne({ blocker: req.user!.sub, blocked: userId }, { $setOnInsert: { blocker: req.user!.sub, blocked: userId } }, { upsert: true });
  ok(res, { blocked: true }, 201);
});

meRouter.delete('/blocks/:userId', validate({ params: z.object({ userId: z.string().regex(/^[a-f\d]{24}$/) }) }), async (req, res) => {
  await Block.deleteOne({ blocker: req.user!.sub, blocked: (res.locals.params as { userId: string }).userId });
  res.status(204).end();
});
