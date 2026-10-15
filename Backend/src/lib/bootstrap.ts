import type { Model } from 'mongoose';
import { logger } from './core.js';
import { Block, Otp, User } from '../models/user.js';
import { Review, Verification, WorkerProfile } from '../models/worker.js';
import { Conversation, Message } from '../models/chat.js';
import { Payment, Plan, Subscription } from '../models/billing.js';
import { Banner, Category, Faq, Page, Setting } from '../models/content.js';
import { Admin, Broadcast, Complaint, Counter, Notification, SearchLog } from '../models/ops.js';
import { PushToken } from '../models/PushToken.js';

const MODELS: Model<never>[] = [
  User, Otp, Block, WorkerProfile, Verification, Review, Conversation, Message, Plan, Subscription, Payment,
  Category, Banner, Faq, Page, Setting, Admin, Complaint, Notification, SearchLog, Counter, PushToken, Broadcast,
] as never[];

/**
 * Runs on every server start (idempotent, a few cheap queries) so a fresh production database is usable
 * without running any script:
 *  1. builds missing indexes (production runs with autoIndex off; search needs the 2dsphere index)
 *  2. creates the single settings row (feature switches) if missing
 * No admin and no business content is inserted here — the first super admin is created once by hand
 * (`npm run seed:admin`), and categories, plans, banners, FAQs and legal pages are all created by admin.
 */
export async function ensureBaseData() {
  for (const m of MODELS) await m.createIndexes().catch((err) => logger.error({ err, model: m.modelName }, 'Index build failed'));

  await Setting.updateOne({ _id: 'app' }, { $setOnInsert: { _id: 'app' } }, { upsert: true });

  if (!(await Admin.exists({}))) logger.warn('No admin account exists — run `npm run seed:admin` once to create the super admin');
  logger.info('Base data ready');
}
