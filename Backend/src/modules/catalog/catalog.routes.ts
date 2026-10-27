import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { HttpError, ok, validate } from '../../lib/core.js';
import { Banner, Category, Faq, Page, getSettings, publicSettings } from '../../models/content.js';
import { WorkerProfile } from '../../models/worker.js';

export const catalogRouter = Router();

// Rarely-changing public data: let browsers/CDN cache it so clients don't re-hit the API.
const cachePublic = (seconds: number): RequestHandler => (_req, res, next) => {
  res.set('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds * 4}`);
  next();
};

/** Categories with live counts of visible workers. */
export async function categoriesWithCounts(filter: Record<string, unknown> = { active: true }) {
  const [cats, counts] = await Promise.all([
    Category.find(filter).sort({ sort: 1, name: 1 }).lean(),
    WorkerProfile.aggregate<{ _id: string; n: number }>([{ $match: { visible: true, restricted: false } }, { $group: { _id: '$category', n: { $sum: 1 } } }]),
  ]);
  const by = new Map(counts.map((c) => [c._id, c.n]));
  return cats.map((c) => ({ id: c._id, name: c.name, nameHi: c.nameHi, icon: c.icon, image: c.image ?? '', tint: c.tint, skills: c.skills, active: c.active, workerCount: by.get(c._id) ?? 0 }));
}

catalogRouter.get('/categories', cachePublic(300), async (_req, res) => ok(res, await categoriesWithCounts()));

catalogRouter.get('/banners', cachePublic(300), async (_req, res) => {
  if ((await getSettings()).features?.banners === false) return ok(res, []);
  const rows = await Banner.find({ active: true }).sort({ sort: 1 }).lean();
  ok(res, rows.map((b) => ({ id: String(b._id), title: b.title, subtitle: b.subtitle, tint: b.tint, link: b.link })));
});

catalogRouter.get('/faqs', cachePublic(600), async (_req, res) => {
  const rows = await Faq.find({ active: true }).sort({ sort: 1 }).lean();
  ok(res, rows.map((f) => ({ id: String(f._id), q: f.q, a: f.a })));
});

catalogRouter.get('/pages/:slug', cachePublic(600), validate({ params: z.object({ slug: z.string().max(40) }) }), async (_req, res) => {
  const p = await Page.findById((res.locals.params as { slug: string }).slug).lean();
  if (!p) throw HttpError.notFound('Page not found');
  ok(res, { slug: p._id, title: p.title, body: p.body, updatedAt: (p.updatedAt as Date).toISOString() });
});

// Not browser-cached: maintenance / feature switches must apply on the next app load (live updates come over the socket).
catalogRouter.get('/settings', async (_req, res) => {
  res.set('Cache-Control', 'no-cache');
  ok(res, publicSettings(await getSettings()));
});
