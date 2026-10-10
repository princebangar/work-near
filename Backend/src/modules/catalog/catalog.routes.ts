import { Router } from 'express';
import { ok } from '../../lib/core.js';
import { categories } from './catalog.data.js';

export const catalogRouter = Router();

// Rarely-changing public data: let browsers/CDN cache it so clients don't re-hit the API.
const cachePublic = (seconds: number) => (_req: unknown, res: { set: (k: string, v: string) => void }, next: () => void) => {
  res.set('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds * 4}`);
  next();
};

catalogRouter.get('/categories', cachePublic(900), (_req, res) => ok(res, categories));
