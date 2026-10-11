import { Router } from 'express';
import { z } from 'zod';
import { HttpError, ok, validate } from '../../lib/core.js';
import { optionalAuth, requireAuth } from '../../middlewares/auth.js';
import { requireFeature } from '../../middlewares/features.js';
import { privateRel, publicUrl, removeFile, removePublic, upload } from '../../lib/upload.js';
import { notify } from '../../lib/notify.js';
import { Category, getSettings } from '../../models/content.js';
import { User } from '../../models/user.js';
import { Verification, WorkerProfile } from '../../models/worker.js';
import { Conversation } from '../../models/chat.js';
import { userDto } from '../me/me.service.js';
import { completion, searchNearby, workerDetail } from './workers.service.js';

export const workersRouter = Router();

const bool = z.enum(['true', 'false']).transform((v) => v === 'true').optional();
const lat = z.coerce.number().min(-90).max(90);
const lng = z.coerce.number().min(-180).max(180);
const searchQuery = z.object({
  lat, lng,
  radius_km: z.coerce.number().refine((v) => [5, 10, 15].includes(v), 'radius_km must be 5, 10 or 15').default(5),
  q: z.string().trim().max(60).optional(),
  category_id: z.string().max(40).optional(),
  min_rating: z.coerce.number().min(0).max(5).optional(),
  verified_only: bool,
  available_only: bool,
  sort: z.enum(['distance', 'rating', 'recent']).default('distance'),
  cursor: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

workersRouter.get('/search', optionalAuth, validate({ query: searchQuery }), async (req, res) => {
  ok(res, await searchNearby(res.locals.query as z.infer<typeof searchQuery>, req.user?.sub));
});

// ---------- Own worker profile (must be declared before /:id) ----------
const strip = <T extends { _raw?: unknown }>(d: T) => {
  const { _raw: _r, ...rest } = d;
  return rest;
};

async function myProfileDto(userId: string) {
  const d = await workerDetail(userId, undefined, { includeHidden: true });
  if (!d) return null;
  const w = d._raw;
  const [lng0, lat0] = w.location!.coordinates as [number, number];
  return {
    ...strip(d), lat: lat0, lng: lng0, visible: w.visible, restricted: w.restricted, showPhone: w.showPhone,
    verificationStatus: w.verificationStatus, profileViews: w.profileViews, completion: completion(w),
  };
}

workersRouter.get('/me/profile', requireAuth, async (req, res) => {
  ok(res, await myProfileDto(req.user!.sub)); // null → not a worker yet
});

const profileBody = z.object({
  name: z.string().trim().min(2).max(80),
  bio: z.string().trim().max(1000).default(''),
  experience: z.coerce.number().int().min(0).max(60),
  categoryId: z.string().max(40),
  skills: z.array(z.string().trim().min(1).max(40)).min(1).max(15),
  languages: z.array(z.string().max(30)).max(8).optional(),
  radius: z.union([z.literal(5), z.literal(10), z.literal(15)]).default(5),
  locality: z.string().trim().min(2).max(120),
  hours: z.string().trim().max(80).optional(),
  priceRange: z.string().trim().max(40).optional(),
  lat, lng,
  showPhone: z.boolean().optional(),
});

/** Create-or-update (onboarding + edit). Creating the profile unlocks the worker role on the same account. */
async function saveProfile(userId: string, b: z.infer<typeof profileBody>) {
  const cat = await Category.findOne({ _id: b.categoryId, active: true }).lean();
  if (!cat) throw HttpError.badRequest('Choose a valid service category');
  const user = await User.findById(userId);
  if (!user) throw HttpError.notFound();
  if (!user.roles.includes('worker')) {
    const { features } = await getSettings();
    if (features?.workerRegistration === false) throw new HttpError(403, 'FEATURE_DISABLED', 'New worker registrations are paused');
    if (features?.dualRole === false && user.roles.length > 0 && user.name) throw HttpError.forbidden('One account can be either Customer or Worker');
    user.roles = [...user.roles, 'worker'];
  }
  user.activeRole = 'worker';
  if (!user.name) user.name = b.name;
  await user.save();

  const set = {
    displayName: b.name, bio: b.bio, experienceYrs: b.experience, category: b.categoryId, skills: [...new Set(b.skills)],
    serviceRadiusKm: b.radius, locality: b.locality, location: { type: 'Point', coordinates: [b.lng, b.lat] },
    ...(b.languages && { languages: b.languages }), ...(b.hours && { hours: b.hours }),
    ...(b.priceRange !== undefined && { priceRange: b.priceRange }), ...(b.showPhone !== undefined && { showPhone: b.showPhone }),
  };
  await WorkerProfile.updateOne({ user: userId }, { $set: set, $setOnInsert: { user: userId, photo: user.avatar ?? '', verification: null } }, { upsert: true });
}

for (const method of ['post', 'patch'] as const) {
  workersRouter[method]('/profile', requireAuth, validate({ body: profileBody }), async (req, res) => {
    await saveProfile(req.user!.sub, res.locals.body as z.infer<typeof profileBody>);
    ok(res, { profile: await myProfileDto(req.user!.sub), user: await userDto(req.user!.sub) });
  });
}

workersRouter.patch('/me/status', requireAuth, validate({ body: z.object({ visible: z.boolean().optional(), available: z.boolean().optional(), showPhone: z.boolean().optional() }) }), async (req, res) => {
  const r = await WorkerProfile.findOneAndUpdate({ user: req.user!.sub }, { $set: res.locals.body }, { returnDocument: 'after' }).lean();
  if (!r) throw HttpError.notFound('Create your worker profile first');
  ok(res, { visible: r.visible, available: r.available, showPhone: r.showPhone });
});

workersRouter.post('/profile/photo', requireAuth, upload.avatar, async (req, res) => {
  if (!req.file) throw HttpError.badRequest('Choose a photo');
  const w = await WorkerProfile.findOne({ user: req.user!.sub });
  if (!w) {
    removeFile(req.file.path);
    throw HttpError.notFound('Create your worker profile first');
  }
  removePublic(w.photo);
  w.photo = publicUrl(req.file);
  await w.save();
  ok(res, { photo: w.photo });
});

workersRouter.post('/profile/portfolio', requireAuth, requireFeature('portfolio'), upload.portfolio, async (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  const w = await WorkerProfile.findOne({ user: req.user!.sub });
  if (!w) {
    files.forEach((f) => removeFile(f.path));
    throw HttpError.notFound('Create your worker profile first');
  }
  if (w.portfolio.length + files.length > 12) {
    files.forEach((f) => removeFile(f.path));
    throw HttpError.badRequest('Maximum 12 portfolio photos');
  }
  w.portfolio.push(...files.map(publicUrl));
  await w.save();
  ok(res, { portfolio: w.portfolio });
});

workersRouter.delete('/profile/portfolio', requireAuth, validate({ body: z.object({ url: z.string().max(500) }) }), async (req, res) => {
  const { url } = res.locals.body as { url: string };
  const w = await WorkerProfile.findOneAndUpdate({ user: req.user!.sub }, { $pull: { portfolio: url } }, { returnDocument: 'after' }).lean();
  if (!w) throw HttpError.notFound();
  removePublic(url);
  ok(res, { portfolio: w.portfolio });
});

workersRouter.get('/me/dashboard', requireAuth, async (req, res) => {
  const w = await WorkerProfile.findOne({ user: req.user!.sub }).lean();
  if (!w) throw HttpError.notFound('Create your worker profile first');
  const [enquiries, latest] = await Promise.all([
    Conversation.countDocuments({ worker: req.user!.sub }),
    Verification.findOne({ worker: req.user!.sub }).sort({ createdAt: -1 }).lean(),
  ]);
  ok(res, {
    profileViews: w.profileViews, enquiries, rating: w.rating, reviewCount: w.reviewCount, visible: w.visible, available: w.available,
    restricted: w.restricted, completion: completion(w),
    verification: w.verificationStatus, verificationType: w.verification, verificationReason: latest?.status !== 'approved' ? latest?.reason : undefined,
  });
});

// ---------- Verification submission (SRS 5.3 / AC-06) — mounted at /verification ----------
export const verificationRouter = Router();

verificationRouter.get('/me', requireAuth, async (req, res) => {
  const v = await Verification.findOne({ worker: req.user!.sub }).sort({ createdAt: -1 }).lean();
  ok(res, v ? { id: String(v._id), type: v.type, status: v.status, reason: v.reason, submittedAt: (v.createdAt as Date).toISOString(), documents: v.documents.length } : null);
});

verificationRouter.post('/submissions', requireAuth, requireFeature('verification'), upload.verification, async (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  const type = z.enum(['phone', 'id', 'id_address']).safeParse(req.body?.type);
  const cleanup = () => files.forEach((f) => removeFile(f.path));
  if (!type.success) {
    cleanup();
    throw HttpError.badRequest('Choose a verification type');
  }
  if (type.data !== 'phone' && files.length === 0) {
    cleanup();
    throw HttpError.badRequest('Upload at least one document');
  }
  const w = await WorkerProfile.findOne({ user: req.user!.sub });
  if (!w) {
    cleanup();
    throw HttpError.notFound('Create your worker profile first');
  }
  if (await Verification.exists({ worker: req.user!.sub, status: 'pending' })) {
    cleanup();
    throw new HttpError(409, 'ALREADY_PENDING', 'A verification request is already under review');
  }
  const v = await Verification.create({
    worker: req.user!.sub, type: type.data,
    documents: files.map((f) => ({ name: f.originalname.slice(0, 80), path: privateRel(f), mime: f.mimetype, size: f.size })),
  });
  w.verificationStatus = 'pending';
  await w.save();
  void notify(req.user!.sub, { type: 'verification', title: 'Verification submitted', body: 'Our team will review your documents within 24–48 hours.', link: '/' });
  ok(res, { id: String(v._id), status: v.status }, 201);
});

// ---------- Public profile ----------
workersRouter.get('/:id', optionalAuth, validate({ params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/, 'Invalid worker id') }), query: z.object({ lat: lat.optional(), lng: lng.optional() }) }), async (req, res) => {
  const { id } = res.locals.params as { id: string };
  const q = res.locals.query as { lat?: number; lng?: number };
  const d = await workerDetail(id, q.lat !== undefined && q.lng !== undefined ? { lat: q.lat, lng: q.lng } : undefined);
  if (!d) throw HttpError.notFound('Worker not found');
  const owner = await User.findById(id, { status: 1, mobile: 1 }).lean();
  if (owner?.status !== 'active') throw HttpError.notFound('Worker not found');
  if (req.user?.sub !== id) void WorkerProfile.updateOne({ user: id }, { $inc: { profileViews: 1 } }).exec();
  const phoneOn = (await getSettings()).features?.phoneSharing !== false;
  ok(res, { ...strip(d), phone: phoneOn && d._raw.showPhone ? owner.mobile : undefined });
});
