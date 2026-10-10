import { Router } from 'express';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { HttpError, logger, ok, validate } from '../../lib/core.js';
import { sendOtpSms } from '../../lib/sms.js';
import { signTokens, verifyRefresh } from '../../middlewares/auth.js';

/**
 * OTP store. In-memory for now — move to Redis (SET key val EX ttl) when REDIS_ENABLED / scaling horizontally.
 * Only a hash of the OTP is kept, never the plain value.
 */
interface OtpEntry { hash: string; expiresAt: number; attempts: number; resendAt: number; sent: number[] }
const otps = new Map<string, OtpEntry>();
const hash = (s: string) => createHash('sha256').update(s).digest();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of otps) if (v.expiresAt < now && v.sent.every((t) => t < now - env.OTP_RATE_WINDOW * 1000)) otps.delete(k);
}, 60_000).unref();

/** Default OTP for local testing (USE_DEFAULT_OTP) or a single QA number (USE_DEFAULT_TEST_PHONE). Never in production. */
const usesDefaultOtp = (mobile: string) =>
  !env.isProd && (env.USE_DEFAULT_OTP || (env.USE_DEFAULT_TEST_PHONE && mobile === env.DEFAULT_TEST_PHONE));

const mobile = z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');
const authLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW * 60_000,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => `${req.body?.mobile ?? ''}|${ipKeyGenerator(req.ip ?? '')}`,
  skip: () => !env.RATE_LIMIT_ENABLED,
});

export const authRouter = Router();
authRouter.use(authLimiter);

authRouter.post('/request-otp', validate({ body: z.object({ mobile }) }), async (_req, res) => {
  const { mobile: m } = res.locals.body as { mobile: string };
  const now = Date.now();
  const prev = otps.get(m);
  if (prev && prev.resendAt > now) throw HttpError.tooMany(`Please wait ${Math.ceil((prev.resendAt - now) / 1000)}s before requesting another OTP`);
  const sent = (prev?.sent ?? []).filter((t) => t > now - env.OTP_RATE_WINDOW * 1000);
  if (sent.length >= env.OTP_RATE_LIMIT) throw HttpError.tooMany('Too many OTP requests. Please try again later.');

  const useDefault = usesDefaultOtp(m);
  const code = useDefault ? env.DEFAULT_OTP : String(randomInt(100000, 1000000));
  if (!useDefault) {
    if (!env.SMS_HUB_ENABLED) throw new HttpError(503, 'SMS_DISABLED', 'OTP service is not enabled');
    await sendOtpSms(m, code);
  } else {
    logger.debug({ mobile: `******${m.slice(-4)}` }, 'Default OTP issued (no SMS sent)');
  }

  otps.set(m, {
    hash: hash(code).toString('hex'),
    expiresAt: now + env.OTP_EXPIRY_SECONDS * 1000,
    attempts: 0,
    resendAt: now + env.OTP_RESEND_SECONDS * 1000,
    sent: [...sent, now],
  });
  ok(res, { expiresIn: env.OTP_EXPIRY_SECONDS, resendAfter: env.OTP_RESEND_SECONDS });
});

authRouter.post('/verify-otp', validate({ body: z.object({ mobile, otp: z.string().regex(/^\d{6}$/) }) }), (_req, res) => {
  const { mobile: m, otp } = res.locals.body as { mobile: string; otp: string };
  const e = otps.get(m);
  if (!e || e.expiresAt < Date.now()) throw HttpError.badRequest('OTP expired. Please request a new one.', 'OTP_EXPIRED');
  if (++e.attempts > env.OTP_MAX_ATTEMPTS) {
    e.expiresAt = 0;
    throw HttpError.tooMany('Too many wrong attempts. Request a new OTP.');
  }
  if (!timingSafeEqual(Buffer.from(e.hash, 'hex'), hash(otp))) throw HttpError.badRequest('Invalid OTP', 'INVALID_OTP');
  e.expiresAt = 0; // single use (keep entry for request-rate accounting)

  // TODO: upsert User in MongoDB. Placeholder user until the users module lands.
  const user = { id: `u_${m}`, mobile: m, name: '', roles: ['customer'], activeRole: 'customer', language: 'en', createdAt: new Date().toISOString() };
  const { accessToken, refreshToken } = signTokens({ sub: user.id, roles: ['customer'] });
  ok(res, { token: accessToken, refreshToken, user, isNew: true });
});

authRouter.post('/refresh', validate({ body: z.object({ refreshToken: z.string().min(10) }) }), (_req, res) => {
  const { refreshToken } = res.locals.body as { refreshToken: string };
  let sub: string;
  try {
    sub = verifyRefresh(refreshToken).sub;
  } catch {
    throw HttpError.unauthorized('Session expired, please login again');
  }
  // TODO: load roles from DB and support refresh-token revocation.
  ok(res, signTokens({ sub, roles: ['customer'] }));
});
