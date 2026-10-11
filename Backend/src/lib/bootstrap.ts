import type { Model } from 'mongoose';
import { env } from '../config/env.js';
import { logger } from './core.js';
import { hashPassword } from './password.js';
import { defaultBanners, defaultCategories, defaultFaqs, defaultPages, defaultPlans } from '../modules/catalog/catalog.data.js';
import { Block, Otp, User } from '../models/user.js';
import { Review, Verification, WorkerProfile } from '../models/worker.js';
import { Conversation, Message } from '../models/chat.js';
import { Payment, Plan, Subscription } from '../models/billing.js';
import { Banner, Category, Faq, Page, Setting } from '../models/content.js';
import { Admin, AuditLog, Complaint, Counter, Notification, SearchLog } from '../models/ops.js';
import { PushToken } from '../models/PushToken.js';

const MODELS: Model<never>[] = [
  User, Otp, Block, WorkerProfile, Verification, Review, Conversation, Message, Plan, Subscription, Payment,
  Category, Banner, Faq, Page, Setting, Admin, Complaint, Notification, AuditLog, SearchLog, Counter, PushToken,
] as never[];

/**
 * Runs on every server start (idempotent, a few cheap queries) so a fresh production database is usable
 * without running any script:
 *  1. builds missing indexes (production runs with autoIndex off; search needs the 2dsphere index)
 *  2. inserts default categories, plans, legal pages, banners, FAQs and settings only when missing —
 *     admin edits are never overwritten
 *  3. creates the first super admin from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD while no admin exists
 */
export async function ensureBaseData() {
  for (const m of MODELS) await m.createIndexes().catch((err) => logger.error({ err, model: m.modelName }, 'Index build failed'));

  const upsertMissing = async (M: Model<never>, rows: { _id: string }[]) => {
    for (const r of rows) await M.updateOne({ _id: r._id } as never, { $setOnInsert: r } as never, { upsert: true });
  };
  await upsertMissing(Category as never, defaultCategories);
  await upsertMissing(Plan as never, defaultPlans);
  await upsertMissing(Page as never, defaultPages);
  if (!(await Banner.exists({}))) await Banner.insertMany(defaultBanners);
  if (!(await Faq.exists({}))) await Faq.insertMany(defaultFaqs);
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
