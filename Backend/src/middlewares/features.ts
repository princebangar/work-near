import type { RequestHandler } from 'express';
import { HttpError } from '../lib/core.js';
import { getSettings, type FeatureKey } from '../models/content.js';

const LABEL: Record<FeatureKey, string> = {
  subscriptions: 'Subscriptions', chat: 'Chat', chatAttachments: 'Chat images', reviews: 'Reviews', reports: 'Reporting',
  complaints: 'Complaints', verification: 'Verification', workerRegistration: 'Worker registration', dualRole: 'Dual role',
  portfolio: 'Portfolio', phoneSharing: 'Phone sharing', pushNotifications: 'Push notifications', hindi: 'Hindi', banners: 'Banners',
};

/** 403 FEATURE_DISABLED when admin has switched the feature off in Customization Settings. */
export const requireFeature = (k: FeatureKey): RequestHandler => async (_req, _res, next) => {
  const s = await getSettings();
  if (s.features?.[k] === false) return next(new HttpError(403, 'FEATURE_DISABLED', `${LABEL[k]} is currently turned off`, { feature: k }));
  next();
};

/**
 * Maintenance mode: every app API answers 503 MAINTENANCE except the ones the maintenance screen itself needs
 * (/settings) and the admin panel (mounted outside this guard), so admins keep working.
 */
const ALLOW = [/^\/settings$/, /^\/pages\//];
export const maintenanceGuard: RequestHandler = async (req, _res, next) => {
  const s = await getSettings();
  if (!s.maintenance?.enabled || ALLOW.some((r) => r.test(req.path))) return next();
  next(new HttpError(503, 'MAINTENANCE', s.maintenance.message || 'Under maintenance', { maintenance: s.maintenance }));
};
