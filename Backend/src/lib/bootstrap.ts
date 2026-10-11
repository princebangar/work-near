import type { Model } from 'mongoose';
import { env } from '../config/env.js';
import { logger } from './core.js';
import { hashPassword } from './password.js';
import { Block, Otp, User } from '../models/user.js';
import { Review, Verification, WorkerProfile } from '../models/worker.js';
import { Conversation, Message } from '../models/chat.js';
import { Payment, Plan, Subscription } from '../models/billing.js';
import { Banner, Category, Faq, Page, Setting } from '../models/content.js';
import { Admin, AuditLog, Broadcast, Complaint, Counter, Notification, SearchLog } from '../models/ops.js';
import { PushToken } from '../models/PushToken.js';

const MODELS: Model<never>[] = [
  User, Otp, Block, WorkerProfile, Verification, Review, Conversation, Message, Plan, Subscription, Payment,
  Category, Banner, Faq, Page, Setting, Admin, Complaint, Notification, AuditLog, SearchLog, Counter, PushToken, Broadcast,
] as never[];

/**
 * Runs on every server start (idempotent, a few cheap queries) so a fresh production database is usable
 * without running any script:
 *  1. builds missing indexes (production runs with autoIndex off; search needs the 2dsphere index)
 *  2. creates the single settings row (feature switches) if missing
 *  3. creates the first super admin from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD while no admin exists
 * No business content is inserted — categories, plans, banners, FAQs and legal pages are all created by admin.
 */
export async function ensureBaseData() {
  for (const m of MODELS) await m.createIndexes().catch((err) => logger.error({ err, model: m.modelName }, 'Index build failed'));

  await Setting.updateOne({ _id: 'app' }, { $setOnInsert: { _id: 'app' } }, { upsert: true });

  if (!(await Admin.exists({}))) {
    if (env.SEED_ADMIN_PASSWORD) {
      await Admin.create({ name: 'WorkNear Owner', email: env.SEED_ADMIN_EMAIL, passwordHash: await hashPassword(env.SEED_ADMIN_PASSWORD), role: 'super_admin' });
      logger.info({ email: env.SEED_ADMIN_EMAIL }, 'Super admin created — change this password after first login');
    } else {
      logger.warn('No admin account exists — set SEED_ADMIN_PASSWORD and restart to create the super admin');
    }
  }
  logger.info('Base data ready');
}
