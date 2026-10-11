import { Types, type PipelineStage } from 'mongoose';
import { distanceKm, escapeRegex, paged } from '../../lib/core.js';
import { WorkerProfile, Review, type WorkerProfileLean } from '../../models/worker.js';
import { Category, getSettings } from '../../models/content.js';
import { Block } from '../../models/user.js';
import { SearchLog } from '../../models/ops.js';

/**
 * Worker search — MongoDB `$geoNear` on a 2dsphere index (straight-line distance, SRS 5.2).
 * Boundary is inclusive: a worker exactly at 5.0 km is returned.
 * Exact coordinates never leave the server; only rounded distance + locality.
 */
export interface SearchInput {
  lat: number; lng: number; radius_km: number; q?: string; category_id?: string; min_rating?: number;
  verified_only?: boolean; available_only?: boolean; sort: 'distance' | 'rating' | 'recent'; cursor?: number; limit: number;
}

type WPLean = WorkerProfileLean;

const catNames = async () => new Map((await Category.find({}, { name: 1 }).lean()).map((c) => [c._id as string, c.name]));

export function toSummary(w: WPLean, categoryName: string, distance: number | null) {
  return {
    id: String(w.user), name: w.displayName, photo: w.photo, categoryId: w.category, categoryName, skills: w.skills,
    rating: Math.round((w.rating ?? 0) * 10) / 10, reviewCount: w.reviewCount ?? 0,
    distanceKm: distance === null ? 0 : Math.round(distance * 10) / 10,
    verification: w.verification ?? null, available: w.available, experienceYrs: w.experienceYrs,
    priceRange: w.priceRange || undefined, locality: w.locality, lastActiveAt: (w.lastActiveAt as Date).toISOString(),
  };
}

/** Users hidden from `viewer` in either direction because of a block. */
async function blockedIds(viewer?: string) {
  if (!viewer) return [];
  const rows = await Block.find({ $or: [{ blocker: viewer }, { blocked: viewer }] }).lean();
  return rows.map((b) => (String(b.blocker) === viewer ? b.blocked : b.blocker));
}

export async function searchNearby(p: SearchInput, viewer?: string) {
  const settings = await getSettings();
  const match: Record<string, unknown> = { visible: true, restricted: false };
  if (p.category_id) match.category = p.category_id;
  if (p.min_rating) match.rating = { $gte: p.min_rating };
  if (p.verified_only) match.verification = { $ne: null };
  if (p.available_only) match.available = true;
  if (p.q) {
    const rx = new RegExp(escapeRegex(p.q), 'i');
    const cats = await Category.find({ $or: [{ name: rx }, { nameHi: rx }] }, { _id: 1 }).lean();
    match.$or = [{ displayName: rx }, { skills: rx }, { locality: rx }, { category: { $in: cats.map((c) => c._id) } }];
  }
  const hidden = await blockedIds(viewer);
  if (viewer) hidden.push(new Types.ObjectId(viewer)); // don't show yourself
  if (hidden.length) match.user = { $nin: hidden };

  const pipeline: PipelineStage[] = [
    { $geoNear: { near: { type: 'Point', coordinates: [p.lng, p.lat] }, distanceField: 'dist', maxDistance: p.radius_km * 1000, spherical: true, query: match } },
    { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'u', pipeline: [{ $project: { status: 1 } }] } },
    { $match: { 'u.status': 'active' } },
  ];
  if (settings.features?.subscriptions && settings.subscriptionRequiredFor.includes('worker')) {
    pipeline.push(
      { $lookup: { from: 'subscriptions', localField: 'user', foreignField: 'user', as: 's', pipeline: [{ $match: { status: 'active', endAt: { $gt: new Date() } } }] } },
      { $match: { 's.0': { $exists: true } } },
    );
  }
  if (p.sort === 'rating') pipeline.push({ $sort: { rating: -1, reviewCount: -1, dist: 1 } });
  if (p.sort === 'recent') pipeline.push({ $sort: { lastActiveAt: -1 } });
  const start = p.cursor ?? 0;
  pipeline.push({ $facet: { items: [{ $skip: start }, { $limit: p.limit }, { $project: { u: 0, s: 0, location: 0 } }], total: [{ $count: 'n' }] } });

  const [res] = await WorkerProfile.aggregate<{ items: (WPLean & { dist: number })[]; total: { n: number }[] }>(pipeline);
  const names = await catNames();
  const items = res!.items.map((w) => toSummary(w, names.get(w.category) ?? '', w.dist / 1000));
  const total = res!.total[0]?.n ?? 0;
  if (start === 0) void SearchLog.create({ user: viewer, q: p.q, category: p.category_id, radiusKm: p.radius_km, results: total }).catch(() => undefined);
  return paged(items, start, p.limit, total);
}

/** Full public profile. Distance is computed from the viewer's point when given; coordinates are never returned. */
export async function workerDetail(userId: string, from?: { lat: number; lng: number }, opts: { includeHidden?: boolean } = {}) {
  const w = await WorkerProfile.findOne({ user: userId }).lean();
  if (!w || (!opts.includeHidden && (!w.visible || w.restricted))) return null;
  const [names, reviews, breakdown] = await Promise.all([
    catNames(),
    Review.find({ worker: w.user, status: 'visible' }).sort({ createdAt: -1 }).limit(20).populate<{ reviewer: { name: string; avatar: string } }>('reviewer', 'name avatar').lean(),
    Review.aggregate<{ _id: number; n: number }>([{ $match: { worker: w.user, status: 'visible' } }, { $group: { _id: '$stars', n: { $sum: 1 } } }]),
  ]);
  const [lng, lat] = w.location!.coordinates as [number, number];
  const d = from ? distanceKm(from.lat, from.lng, lat, lng) : null;
  const totalR = breakdown.reduce((s, b) => s + b.n, 0) || 1;
  const pct = (s: number) => Math.round(((breakdown.find((b) => b._id === s)?.n ?? 0) / totalR) * 100);
  return {
    ...toSummary(w, names.get(w.category) ?? '', d),
    bio: w.bio, languages: w.languages, hours: w.hours, serviceRadiusKm: w.serviceRadiusKm, portfolio: w.portfolio,
    reviews: reviews.map((r) => ({
      id: String(r._id), reviewerName: r.reviewer?.name || 'WorkNear user', reviewerPhoto: r.reviewer?.avatar || undefined,
      stars: r.stars, text: r.text, createdAt: (r.createdAt as Date).toISOString(),
    })),
    ratingBreakdown: { 5: pct(5), 4: pct(4), 3: pct(3), 2: pct(2), 1: pct(1) },
    _raw: w,
  };
}

/** Recomputes cached rating/reviewCount on the profile after a review is added/hidden. */
export async function refreshRating(workerUserId: string | Types.ObjectId) {
  const [agg] = await Review.aggregate<{ avg: number; n: number }>([
    { $match: { worker: new Types.ObjectId(String(workerUserId)), status: 'visible' } },
    { $group: { _id: null, avg: { $avg: '$stars' }, n: { $sum: 1 } } },
  ]);
  await WorkerProfile.updateOne({ user: workerUserId }, { rating: agg ? Math.round(agg.avg * 10) / 10 : 0, reviewCount: agg?.n ?? 0 });
}

/** % of optional profile fields filled — drives the "complete your profile" bar. */
export function completion(w: WPLean) {
  const checks = [!!w.photo, w.bio.length >= 30, w.skills.length >= 2, w.experienceYrs > 0, !!w.priceRange, w.portfolio.length > 0, !!w.locality, w.languages.length > 0, w.verificationStatus === 'approved'];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
