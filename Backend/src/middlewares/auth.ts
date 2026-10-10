import jwt from 'jsonwebtoken';
import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { HttpError } from '../lib/core.js';

export type Role = 'customer' | 'worker' | 'admin' | 'super_admin' | 'support';
export interface AuthUser { sub: string; roles: Role[] }

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request { user?: AuthUser }
  }
}

export const signToken = (u: AuthUser) =>
  jwt.sign(u, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });

export const requireAuth: RequestHandler = (req, _res, next) => {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return next(HttpError.unauthorized());
  try {
    req.user = jwt.verify(h.slice(7), env.JWT_SECRET) as AuthUser;
    next();
  } catch {
    next(HttpError.unauthorized('Session expired, please login again'));
  }
};

export const requireRole = (...roles: Role[]): RequestHandler => (req, _res, next) =>
  req.user?.roles.some((r) => roles.includes(r)) ? next() : next(HttpError.forbidden());
