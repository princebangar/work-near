import { Router } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { HttpError, ok, validate } from '../../lib/core.js';
import { requireAdmin, signAdmin, type AdminRole } from '../../middlewares/auth.js';
import { generateSecret, otpauthUrl, verifyTotp } from '../../lib/totp.js';
import { ipKey, limiter } from '../../lib/limits.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { audit } from '../../lib/audit.js';
import { normalizePermissions } from '../../lib/permissions.js';
import { Admin } from '../../models/ops.js';

export const adminAuthRouter = Router();

// Two layers: per IP (one machine hammering) and per email (one account attacked from many IPs).
const LOCKED = 'Too many login attempts. Try again in 15 minutes.';
const loginLimiter = limiter({ name: 'admin-ip', windowMs: 15 * 60_000, limit: 20, key: ipKey, message: LOCKED });
const accountLimiter = limiter({
  name: 'admin-email', windowMs: 15 * 60_000, limit: env.ADMIN_LOGIN_RATE_LIMIT, message: LOCKED,
  key: (req) => String(req.body?.email ?? '').trim().toLowerCase().slice(0, 120) || ipKey(req),
});

const password = z.string().min(8, 'Password must be at least 8 characters').max(100);
const sameSecret = (a: string, b: string) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

const session = (a: { _id: unknown; name: string; email: string; role: string; mfaSecret?: string | null; permissions?: unknown }) => ({
  token: signAdmin({ sub: String(a._id), role: a.role as AdminRole, name: a.name }),
  id: String(a._id), name: a.name, email: a.email, role: a.role, mfaEnabled: !!a.mfaSecret, permissions: normalizePermissions(a.permissions),
});

const loginBody = z.object({ email: z.email(), password: z.string().min(1).max(100), otp: z.string().max(6).optional() });
/**
 * Email + password, then MFA (SRS 5.1 / 11):
 *  - admin has an authenticator secret → 6-digit TOTP required
 *  - no secret yet → allowed in, the panel nags to set it up (dev also accepts DEFAULT_OTP)
 */
adminAuthRouter.post('/login', loginLimiter, accountLimiter, validate({ body: loginBody }), async (req, res) => {
  const b = res.locals.body as z.infer<typeof loginBody>;
  const a = await Admin.findOne({ email: b.email.toLowerCase() });
  const pwOk = await verifyPassword(b.password, a?.passwordHash); // same cost whether or not the email exists
  if (!a || !pwOk || a.status !== 'active') {
    if (a) await Admin.updateOne({ _id: a._id }, { $push: { loginHistory: { $each: [{ at: new Date(), ip: req.ip, ok: false }], $slice: -20 } } });
    throw new HttpError(401, 'BAD_CREDENTIALS', 'Invalid email or password');
  }
  if (a.mfaSecret) {
    if (!b.otp) throw new HttpError(401, 'MFA_REQUIRED', 'Enter the 6-digit code from your authenticator app');
    if (!verifyTotp(a.mfaSecret, b.otp)) throw new HttpError(401, 'MFA_INVALID', 'Invalid authenticator code');
  }
  a.lastLoginAt = new Date();
  a.loginHistory.push({ at: new Date(), ip: req.ip, ok: true });
  if (a.loginHistory.length > 20) a.loginHistory.splice(0, a.loginHistory.length - 20);
  await a.save();
  req.admin = { sub: String(a._id), role: a.role as AdminRole, name: a.name, typ: 'admin' };
  void audit(req, 'admin.login', { type: 'admin', id: String(a._id), label: a.email });
  ok(res, session(a));
});

/**
 * One-time bootstrap only: creates the first super admin with the registration code from .env while no admin
 * exists. After that every staff account is created by the super admin (Staff page), so this endpoint is closed —
 * a leaked code can no longer mint admin accounts.
 */
const registerBody = z.object({ code: z.string().min(4).max(200), name: z.string().trim().min(2).max(60), email: z.email(), password });
adminAuthRouter.post('/register', loginLimiter, validate({ body: registerBody }), async (_req, res) => {
  const b = res.locals.body as z.infer<typeof registerBody>;
  if (!env.ADMIN_REGISTRATION_CODE || !sameSecret(b.code, env.ADMIN_REGISTRATION_CODE)) throw HttpError.forbidden('Invalid registration code');
  if (await Admin.exists({})) throw HttpError.forbidden('Registration is closed. Ask the super admin to create your account.');
  const a = await Admin.create({ name: b.name, email: b.email, passwordHash: await hashPassword(b.password), role: 'super_admin' });
  ok(res, session(a), 201);
});

// ---------- Signed-in admin ----------
adminAuthRouter.get('/me', requireAdmin(), async (req, res) => {
  const a = await Admin.findById(req.admin!.sub).lean();
  ok(res, { id: String(a!._id), name: a!.name, email: a!.email, role: a!.role, permissions: normalizePermissions(a!.permissions), mfaEnabled: !!a!.mfaSecret, lastLoginAt: a!.lastLoginAt?.toISOString(), loginHistory: a!.loginHistory.slice(-10).reverse() });
});

// Pending secret lives in memory for 10 minutes until confirmed with a valid code.
const pending = new Map<string, { secret: string; at: number }>();
adminAuthRouter.post('/me/mfa/setup', requireAdmin(), async (req, res) => {
  const a = await Admin.findById(req.admin!.sub, { email: 1 }).lean();
  const secret = generateSecret();
  pending.set(req.admin!.sub, { secret, at: Date.now() });
  ok(res, { secret, otpauthUrl: otpauthUrl(secret, a!.email) });
});
adminAuthRouter.post('/me/mfa/enable', requireAdmin(), validate({ body: z.object({ code: z.string().regex(/^\d{6}$/) }) }), async (req, res) => {
  const p = pending.get(req.admin!.sub);
  if (!p || Date.now() - p.at > 600_000) throw HttpError.badRequest('Setup expired, start again');
  if (!verifyTotp(p.secret, (res.locals.body as { code: string }).code)) throw HttpError.badRequest('Code did not match, try again', 'MFA_INVALID');
  await Admin.updateOne({ _id: req.admin!.sub }, { mfaSecret: p.secret });
  pending.delete(req.admin!.sub);
  void audit(req, 'admin.mfa_enable', { type: 'admin', id: req.admin!.sub });
  ok(res, { mfaEnabled: true });
});

adminAuthRouter.post('/me/password', requireAdmin(), validate({ body: z.object({ current: z.string().min(1), next: password }) }), async (req, res) => {
  const b = res.locals.body as { current: string; next: string };
  const a = await Admin.findById(req.admin!.sub);
  if (!a || !(await verifyPassword(b.current, a.passwordHash))) throw HttpError.badRequest('Current password is wrong');
  a.passwordHash = await hashPassword(b.next);
  await a.save();
  void audit(req, 'admin.password_change', { type: 'admin', id: req.admin!.sub });
  ok(res, { changed: true });
});
