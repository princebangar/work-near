/**
 * One-off: creates the first super admin from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 * Never runs on server start — run it by hand once per database:
 *   npm run seed:admin          (dev, tsx)
 *   npm run seed:admin:prod     (after `npm run build`)
 * Does nothing if an admin with that email already exists.
 */
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { logger } from './lib/core.js';
import { connectDb, disconnectDb } from './lib/db.js';
import { hashPassword } from './lib/password.js';
import { Admin } from './models/ops.js';

await connectDb();
if (mongoose.connection.readyState !== 1) {
  logger.error('No database connection — set MONGODB_URI');
  process.exit(1);
}
const email = env.SEED_ADMIN_EMAIL.toLowerCase();
if (!env.SEED_ADMIN_PASSWORD) {
  logger.error('SEED_ADMIN_PASSWORD is empty — set it in .env and run again');
} else if (await Admin.exists({ email })) {
  logger.info({ email }, 'Admin already exists — nothing to do');
} else {
  await Admin.create({ name: 'WorkNear Owner', email, passwordHash: await hashPassword(env.SEED_ADMIN_PASSWORD), role: 'super_admin' });
  logger.info({ email }, 'Super admin created — change this password after first login');
}
await disconnectDb();
