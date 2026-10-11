import { createClient } from 'redis';
import { env } from '../config/env.js';
import { logger } from './core.js';

/**
 * Optional shared Redis (REDIS_ENABLED=true). Needed only when more than one API instance runs behind a load
 * balancer: rate-limit counters and Socket.IO events must then be shared, otherwise each instance sees only its
 * own traffic and a chat message emitted on instance A never reaches a user connected to instance B.
 * Connected with top-level await so every module that imports this sees a ready client (or null).
 */
async function connect() {
  const client = createClient({ url: env.REDIS_URL });
  client.on('error', (err) => logger.error({ err }, 'Redis error'));
  await client.connect();
  logger.info('Redis connected');
  return client;
}

export const redis = env.REDIS_ENABLED ? await connect() : null;
