import type { Request } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import { env } from '../config/env.js';
import { redis } from './redis.js';

interface LimitOptions {
  /** Unique per limiter — namespaces the Redis keys. */
  name: string;
  windowMs: number;
  limit: number;
  key?: (req: Request) => string;
  message?: string;
}

/**
 * Every rate limiter goes through here so they share one behaviour: JSON error envelope, global on/off switch,
 * and a Redis store when REDIS_ENABLED (counters shared by all instances behind the load balancer).
 */
export function limiter({ name, windowMs, limit, key, message = 'Too many requests. Please try again later.' }: LimitOptions) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => !env.RATE_LIMIT_ENABLED,
    ...(key && { keyGenerator: key }),
    message: { error: { code: 'RATE_LIMITED', message } },
    ...(redis && { store: new RedisStore({ prefix: `rl:${name}:`, sendCommand: (...args: string[]) => redis!.sendCommand(args) as Promise<RedisReply> }) }),
  });
}

/** Client IP, with IPv6 collapsed to its /56 so one device can't rotate addresses to dodge limits. */
export const ipKey = (req: Request) => ipKeyGenerator(req.ip ?? '');
/** Signed-in user id (falls back to IP for anonymous requests). */
export const userKey = (req: Request) => req.user?.sub ?? ipKey(req);

/** Shared by every multipart endpoint (avatars, portfolio, chat images, verification docs, evidence). */
export const uploadLimiter = limiter({ name: 'upload', windowMs: 60 * 60_000, limit: env.UPLOAD_RATE_LIMIT, key: userKey, message: 'Too many uploads. Please try again later.' });
