import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from './core.js';

mongoose.set('strictQuery', true);

/** Connects to MongoDB when MONGODB_URI is set; the API still boots without it (in-memory mode). */
export async function connectDb() {
  if (!env.MONGODB_URI) {
    logger.warn('MONGODB_URI not set — running without database');
    return;
  }
  if (env.MONGODB_URI.includes('<db_password>')) {
    logger.warn('MONGODB_URI still contains <db_password> — replace it with the Atlas DB user password. Running without database.');
    return;
  }
  await mongoose.connect(env.MONGODB_URI, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 10_000,
    autoIndex: !env.isProd, // production: indexes are built once at boot by ensureBaseData()
  });
  logger.info({ db: mongoose.connection.name }, 'MongoDB connected');
}

export const disconnectDb = () => mongoose.disconnect();
