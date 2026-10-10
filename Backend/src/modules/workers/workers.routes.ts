import { Router } from 'express';
import { z } from 'zod';
import { HttpError, ok, validate } from '../../lib/core.js';
import { categories } from '../catalog/catalog.data.js';
import { findById, searchNearby } from './workers.service.js';

export const workersRouter = Router();

const bool = z.enum(['true', 'false']).transform((v) => v === 'true').optional();
const searchQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius_km: z.coerce.number().refine((v) => [5, 10, 15].includes(v), 'radius_km must be 5, 10 or 15').default(5),
  q: z.string().trim().max(60).optional(),
  category_id: z.string().refine((v) => categories.some((c) => c.id === v), 'Unknown category').optional(),
  min_rating: z.coerce.number().min(0).max(5).optional(),
  verified_only: bool,
  available_only: bool,
  sort: z.enum(['distance', 'rating', 'recent']).default('distance'),
  cursor: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

workersRouter.get('/search', validate({ query: searchQuery }), (_req, res) => {
  ok(res, searchNearby(res.locals.query as z.infer<typeof searchQuery>));
});

workersRouter.get('/:id', validate({ params: z.object({ id: z.string().max(40) }) }), (_req, res) => {
  const w = findById((res.locals.params as { id: string }).id);
  if (!w) throw HttpError.notFound('Worker not found');
  // Never expose exact coordinates publicly (SRS 5.2).
  const { lat: _lat, lng: _lng, ...pub } = w;
  ok(res, pub);
});
