import jwt from 'jsonwebtoken';
import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { HttpError } from '../lib/core.js';
import { User } from '../models/user.js';
import { Admin } from '../models/ops.js';

export type Role = 'customer' | 'worker';
export type AdminRole = 'super_admin' | 'admin' | 'support';
/** App-user token. `typ` keeps user and admin tokens from being interchangeable. */
export interface AuthUser { sub: string; roles: Role[]; typ?: 'user'; tv?: number }
export interface AuthAdmin { sub: string; role: AdminRole; name: string; typ: 'admin' }

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request { user?: AuthUser; admin?: AuthAdmin }
  }
}

type Expiry = jwt.SignOptions['expiresIn'];
// Only HS256 is ever accepted — blocks alg-confusion / "alg: none" tokens.
const SIGN = { algorithm: 'HS256' } as const;
const VERIFY = { algorithms: ['HS256'] as jwt.Algorithm[] };

/**
 * `tv` = the user's tokenVersion. Suspension, deletion and "log out everywhere" bump it, which instantly
 * invalidates every access and refresh token issued before (SRS 11: secure token rotation / revocation).
 */
export const signTokens = (u: { sub: string; roles: Role[]; tv?: number }) => ({
  accessToken: jwt.sign({ sub: u.sub, roles: u.roles, tv: u.tv ?? 0, typ: 'user' }, env.JWT_ACCESS_SECRET, { ...SIGN, expiresIn: env.JWT_ACCESS_EXPIRES as Expiry }),
  refreshToken: jwt.sign({ sub: u.sub, tv: u.tv ?? 0, typ: 'refresh' }, env.JWT_REFRESH_SECRET, { ...SIGN, expiresIn: env.JWT_REFRESH_EXPIRES as Expiry }),
});
export const signAdmin = (a: Omit<AuthAdmin, 'typ'>) =>
  jwt.sign({ ...a, typ: 'admin' }, env.JWT_ACCESS_SECRET, { ...SIGN, expiresIn: '12h' }); // admin sessions expire sooner (SRS 11)

export const verifyRefresh = (token: string) => {
  const p = jwt.verify(token, env.JWT_REFRESH_SECRET, VERIFY) as { sub: string; tv?: number; typ?: string };
  if (p.typ !== 'refresh') throw new Error('wrong token type');
  return p;
};
export const verifyUserToken = (token: string) => {
  const p = jwt.verify(token, env.JWT_ACCESS_SECRET, VERIFY) as AuthUser & { typ?: string };
  if (p.typ !== 'user') throw new Error('wrong token type');
  return p;
};

const bearer = (h?: string) => (h?.startsWith('Bearer ') ? h.slice(7) : null);

/**
 * Verifies the JWT and re-reads status/roles from the DB so suspensions and role changes apply immediately.
 * Also bumps lastActiveAt at most once a minute.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token = bearer(req.headers.authorization);
  if (!token) return next(HttpError.unauthorized());
  let p: AuthUser;
  try {
    p = verifyUserToken(token);
  } catch {
    return next(HttpError.unauthorized('Session expired, please login again'));
  }
  const u = await User.findById(p.sub, { status: 1, roles: 1, lastActiveAt: 1, tokenVersion: 1 }).lean();
  if (!u || u.status === 'deleted') return next(HttpError.unauthorized('Account not found'));
  if ((p.tv ?? 0) !== (u.tokenVersion ?? 0)) return next(HttpError.unauthorized('Session expired, please login again'));
  if (u.status === 'suspended') return next(new HttpError(403, 'SUSPENDED', 'Your account is suspended. Contact support.'));
  req.user = { sub: p.sub, roles: u.roles as Role[] };
  if (!u.lastActiveAt || Date.now() - u.lastActiveAt.getTime() > 60_000) void User.updateOne({ _id: u._id }, { lastActiveAt: new Date() }).exec();
  next();
};

/** Attaches req.user when a valid token is present; anonymous requests continue (public search/profile pages). */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const token = bearer(req.headers.authorization);
  if (token) {
    try {
      const p = verifyUserToken(token);
      req.user = { sub: p.sub, roles: p.roles };
    } catch {
      /* treat as anonymous */
    }
  }
  next();
};

export const requireRole =(...roles: Role[]): RequestHandler => (req, _res, next) =>
  req.user?.roles.some((r) => roles.includes(r)) ? next() : next(HttpError.forbidden());

/** Admin-panel guard. Pass roles to restrict further (support staff cannot use admin functions — AC-12). */
export const requireAdmin = (...roles: AdminRole[]): RequestHandler => async (req, _res, next) => {
  const token = bearer(req.headers.authorization);
  if (!token) return next(HttpError.unauthorized());
  let p: AuthAdmin;
  try {
    p = jwt.verify(token, env.JWT_ACCESS_SECRET, VERIFY) as AuthAdmin;
    if (p.typ !== 'admin') throw new Error();
  } catch {
    return next(HttpError.unauthorized('Admin session expired'));
  }
  const a = await Admin.findById(p.sub, { status: 1, role: 1, name: 1 }).lean();
  if (!a || a.status !== 'active') return next(HttpError.unauthorized('Admin account disabled'));
  req.admin = { sub: p.sub, role: a.role as AdminRole, name: a.name, typ: 'admin' };
  if (roles.length && !roles.includes(a.role as AdminRole)) return next(HttpError.forbidden('Your role cannot perform this action'));
  next();
};
