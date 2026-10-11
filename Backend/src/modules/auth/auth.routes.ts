import { Router } from 'express';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { HttpError, logger, ok, validate } from '../../lib/core.js';
import { sendOtpSms } from '../../lib/sms.js';
import { signTokens, verifyRefresh, type Role } from '../../middlewares/auth.js';
import { Otp, User } from '../../models/user.js';
import { notify } from '../../lib/notify.js';
import { userDto } from '../me/me.service.js';

/** Current Terms/Privacy version the user accepts at sign-up (SRS 5.1). Bump when policies change. */
export const CONSENT_VERSION = '2026-10-01';

const hash = (s: string) => createHash('sha256').update(s).digest('hex');

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
  const prev = await Otp.findOne({ mobile: m }).lean();
  if (prev && prev.resendAt.getTime() > now) throw HttpError.tooMany(`Please wait ${Math.ceil((prev.resendAt.getTime() - now) / 1000)}s before requesting another OTP`);
  const sent = (prev?.sent ?? []).filter((t) => t.getTime() > now - env.OTP_RATE_WINDOW * 1000);
  if (sent.length >= env.OTP_RATE_LIMIT) throw HttpError.tooMany('Too many OTP requests. Please try again later.');

  const existing = await User.findOne({ mobile: m }, { status: 1 }).lean();
  if (existing?.status === 'suspended') throw new HttpError(403, 'SUSPENDED', 'This account is suspended. Contact support.');

  const useDefault = usesDefaultOtp(m);
  const code = useDefault ? env.DEFAULT_OTP : String(randomInt(100000, 1000000));
  if (!useDefault) {
    if (!env.SMS_HUB_ENABLED) throw new HttpError(503, 'SMS_DISABLED', 'OTP service is not enabled');
    await sendOtpSms(m, code);
  } else {
    logger.debug({ mobile: `******${m.slice(-4)}` }, 'Default OTP issued (no SMS sent)');
  }

  await Otp.updateOne(
    { mobile: m },
    {
      $set: {
        hash: hash(code), attempts: 0,
        expiresAt: new Date(now + env.OTP_EXPIRY_SECONDS * 1000),
        resendAt: new Date(now + env.OTP_RESEND_SECONDS * 1000),
        sent: [...sent, new Date(now)],
        purgeAt: new Date(now + Math.max(env.OTP_RATE_WINDOW, env.OTP_EXPIRY_SECONDS) * 1000),
      },
    },
    { upsert: true },
  );
  ok(res, { expiresIn: env.OTP_EXPIRY_SECONDS, resendAfter: env.OTP_RESEND_SECONDS, isRegistered: !!existing });
});

const verifyBody = z.object({ mobile, otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'), acceptTerms: z.boolean().optional() });
authRouter.post('/verify-otp', validate({ body: verifyBody }), async (_req, res) => {
  const { mobile: m, otp, acceptTerms } = res.locals.body as z.infer<typeof verifyBody>;
  const e = await Otp.findOne({ mobile: m });
  if (!e || !e.hash || e.expiresAt.getTime() < Date.now()) throw HttpError.badRequest('OTP expired. Please request a new one.', 'OTP_EXPIRED');
  e.attempts += 1;
  if (e.attempts > env.OTP_MAX_ATTEMPTS) {
    e.hash = '';
    await e.save();
    throw HttpError.tooMany('Too many wrong attempts. Request a new OTP.');
  }
  if (!timingSafeEqual(Buffer.from(e.hash, 'hex'), Buffer.from(hash(otp), 'hex'))) {
    await e.save();
    const left = env.OTP_MAX_ATTEMPTS - e.attempts;
    throw HttpError.badRequest(`Invalid OTP${left > 0 ? ` — ${left} attempt${left > 1 ? 's' : ''} left` : ''}`, 'INVALID_OTP');
  }
  let user = await User.findOne({ mobile: m });
  if (user?.status === 'suspended') throw new HttpError(403, 'SUSPENDED', 'This account is suspended. Contact support.');
  const isNew = !user || user.status === 'deleted';
  // Checked before consuming the OTP so the user can tick the box and retry with the same code.
  if (isNew && !acceptTerms) {
    await e.save();
    throw HttpError.badRequest('Please accept the Terms of Use and Privacy Policy', 'CONSENT_REQUIRED');
  }
  e.hash = ''; // single use; keep row for request-rate accounting
  await e.save();
  if (!user) {
    user = await User.create({ mobile: m, consentVersion: CONSENT_VERSION, consentAt: new Date() });
    void notify(user._id, { type: 'system', title: 'Welcome to WorkNear 🎉', body: 'Find trusted workers within 5 KM. Zero commission, always.' });
  } else {
    // A pending deletion request is cancelled by logging back in.
    if (user.status === 'deleted_request' || user.status === 'deleted') Object.assign(user, { status: 'active', deletionRequestedAt: undefined });
    if (acceptTerms) Object.assign(user, { consentVersion: CONSENT_VERSION, consentAt: new Date() });
  }
  user.lastLoginAt = new Date();
  await user.save();

  const { accessToken, refreshToken } = signTokens({ sub: String(user._id), roles: user.roles as Role[] });
  ok(res, { token: accessToken, refreshToken, user: await userDto(String(user._id)), isNew: isNew || !user.name });
});

authRouter.post('/refresh', validate({ body: z.object({ refreshToken: z.string().min(10) }) }), async (_req, res) => {
  const { refreshToken } = res.locals.body as { refreshToken: string };
  let sub: string;
  try {
    sub = verifyRefresh(refreshToken).sub;
  } catch {
    throw HttpError.unauthorized('Session expired, please login again');
  }
  const u = await User.findById(sub, { roles: 1, status: 1 }).lean();
  if (!u || u.status === 'suspended' || u.status === 'deleted') throw HttpError.unauthorized('Session expired, please login again');
  const t = signTokens({ sub, roles: u.roles as Role[] });
  ok(res, { token: t.accessToken, refreshToken: t.refreshToken });
});
