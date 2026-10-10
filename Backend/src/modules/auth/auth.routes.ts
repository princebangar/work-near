import { Router } from 'express';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { HttpError, logger, ok, validate } from '../../lib/core.js';
import { signToken } from '../../middlewares/auth.js';

/**
 * OTP store. In-memory for now — swap for Redis (SET key val EX ttl) when scaling horizontally.
 * Only a hash of the OTP is kept, never the plain value.
 */
interface OtpEntry { hash: string; expiresAt: number; attempts: number; resendAt: number }
const otps = new Map<string, OtpEntry>();
const hash = (s: string) => createHash('sha256').update(s).digest();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of otps) if (v.expiresAt < now) otps.delete(k);
}, 60_000).unref();

const mobile = z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');
const otpLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false, keyGenerator: (req) => req.body?.mobile ?? req.ip ?? '' });

export const authRouter = Router();

authRouter.post('/request-otp', otpLimiter, validate({ body: z.object({ mobile }) }), (_req, res) => {
  const { mobile: m } = res.locals.body as { mobile: string };
  const existing = otps.get(m);
  if (existing && existing.resendAt > Date.now()) throw HttpError.tooMany('Please wait before requesting another OTP');

  // Dev uses a fixed OTP so the team can test without SMS credits.
  const code = env.isProd ? String(randomInt(100000, 999999)) : '123456';
  otps.set(m, { hash: hash(code).toString('hex'), expiresAt: Date.now() + env.OTP_TTL_SECONDS * 1000, attempts: 0, resendAt: Date.now() + 30_000 });
  // TODO: integrate SMS provider (MSG91 / Twilio) here.
  logger.debug({ mobile: m.slice(-4) }, 'OTP issued');
  ok(res, { expiresIn: env.OTP_TTL_SECONDS, resendAfter: 30 });
});

authRouter.post('/verify-otp', validate({ body: z.object({ mobile, otp: z.string().length(6) }) }), (_req, res) => {
  const { mobile: m, otp } = res.locals.body as { mobile: string; otp: string };
  const e = otps.get(m);
  if (!e || e.expiresAt < Date.now()) throw HttpError.badRequest('OTP expired. Please request a new one.', 'OTP_EXPIRED');
  if (++e.attempts > env.OTP_MAX_ATTEMPTS) {
    otps.delete(m);
    throw HttpError.tooMany('Too many wrong attempts. Request a new OTP.');
  }
  if (!timingSafeEqual(Buffer.from(e.hash, 'hex'), hash(otp))) throw HttpError.badRequest('Invalid OTP', 'INVALID_OTP');
  otps.delete(m);

  // TODO: upsert user in DB. Placeholder user until persistence lands.
  const user = { id: `u_${m}`, mobile: m, name: '', roles: ['customer'], activeRole: 'customer', language: 'en', createdAt: new Date().toISOString() };
  ok(res, { token: signToken({ sub: user.id, roles: ['customer'] }), user, isNew: true });
});
