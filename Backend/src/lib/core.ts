import { Types } from 'mongoose';
import { pino } from 'pino';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { z, type ZodType } from 'zod';
import { env } from '../config/env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: ['req.headers.authorization', 'req.headers.cookie', 'req.body.otp', 'req.body.password', 'req.body.refreshToken', 'req.body.token'],
  ...(!env.isProd && { transport: { target: 'pino-pretty', options: { colorize: true, singleLine: true } } }),
});

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
  static badRequest = (msg: string, code = 'BAD_REQUEST', details?: unknown) => new HttpError(400, code, msg, details);
  static unauthorized = (msg = 'Authentication required') => new HttpError(401, 'UNAUTHORIZED', msg);
  static forbidden = (msg = 'Not allowed') => new HttpError(403, 'FORBIDDEN', msg);
  static notFound = (msg = 'Not found') => new HttpError(404, 'NOT_FOUND', msg);
  static tooMany = (msg = 'Too many requests') => new HttpError(429, 'RATE_LIMITED', msg);
}

/** Consistent success envelope: { data } */
export const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ data });

type Schemas = { body?: ZodType; query?: ZodType; params?: ZodType };
/** Validates & coerces input; handlers read typed values from res.locals. */
export const validate = (s: Schemas): RequestHandler => (req, res, next) => {
  for (const key of ['params', 'query', 'body'] as const) {
    const schema = s[key];
    if (!schema) continue;
    const r = schema.safeParse(req[key]);
    if (!r.success) return next(HttpError.badRequest('Validation failed', 'VALIDATION_ERROR', z.flattenError(r.error).fieldErrors));
    res.locals[key] = r.data;
  }
  next();
};

export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(HttpError.notFound(`Route not found: ${req.method} ${req.path}`));
}

// Express 5 forwards async errors here automatically.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Malformed JSON body' } });
  }
  if ((err as { type?: string }).type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request is too large' } });
  }
  req.log?.error({ err }, 'Unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
}

/**
 * Person / display name: letters in any script (Hindi too), spaces and . ' - only; 2–80 chars, at least 2 letters.
 * Blocks numbers-only, emoji and symbol spam names. Same rule as Frontend lib/validate.ts.
 */
export const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u;
export const personName = z
  .string()
  .trim()
  .transform((s) => s.replace(/\s+/g, ' '))
  .pipe(
    z.string().min(2, 'Name must be at least 2 characters').max(80).regex(NAME_RE, 'Use letters only (no numbers or symbols)')
      .refine((s) => (s.match(/\p{L}/gu) ?? []).length >= 2, 'Name must have at least 2 letters'),
  );

/**
 * Worker display name (public profile) — may be a business name ("A1 Plumbers", "Sharma & Sons 24x7"), so digits and &
 * are allowed, but it must still contain at least 2 letters (no "9999" or symbol-only names).
 */
export const DISPLAY_NAME_RE = /^[\p{L}\p{M}\d][\p{L}\p{M}\d .'&-]*$/u;
export const displayName = z
  .string()
  .trim()
  .transform((s) => s.replace(/\s+/g, ' '))
  .pipe(
    z.string().min(2, 'Name must be at least 2 characters').max(80).regex(DISPLAY_NAME_RE, 'Use letters, numbers, spaces and . \' & - only')
      .refine((s) => (s.match(/\p{L}/gu) ?? []).length >= 2, 'Name must have at least 2 letters'),
  );

/** Escapes user text before using it inside a RegExp (prevents ReDoS / regex injection). */
export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Offset-cursor page envelope used by every list endpoint: { items, nextCursor, total }. */
export const paged = <T>(items: T[], start: number, limit: number, total: number) => ({
  items,
  nextCursor: start + limit < total ? String(start + limit) : null,
  total,
});

export const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Haversine straight-line distance in KM (same formula as the client). */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** String → ObjectId (Mongoose 9 typings don't auto-cast strings in filters/creates). */
export const toId = (s: string | Types.ObjectId) => new Types.ObjectId(String(s));
/** Loose filter type for dynamically-built admin queries (values are validated by zod first). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFilter = Record<string, any>;
