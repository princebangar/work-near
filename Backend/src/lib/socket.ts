import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { env } from '../config/env.js';
import { logger } from './core.js';
import { redis } from './redis.js';
import { verifyUserToken } from '../middlewares/auth.js';
import { User } from '../models/user.js';

/**
 * Realtime push channel (chat messages, read receipts, notifications).
 * Clients authenticate with the same JWT; each socket joins room `user:<id>`.
 * Messages are still *sent* over REST — sockets only fan out, so the API stays the source of truth.
 * With REDIS_ENABLED the Redis adapter relays emits between instances, so a user connected to any instance behind
 * the load balancer receives events raised on any other. (`isOnline` stays per-instance — only used as a hint.)
 */
let io: Server | null = null;
const online = new Map<string, number>();

export async function initSocket(server: HttpServer) {
  io = new Server(server, { cors: { origin: env.socketOrigins, credentials: true }, path: '/socket.io', maxHttpBufferSize: 16_384 }); // clients never send payloads
  if (redis) {
    // Pub/sub needs a dedicated subscriber connection; the shared client publishes.
    const sub = redis.duplicate();
    sub.on('error', (err) => logger.error({ err }, 'Redis subscriber error'));
    await sub.connect();
    io.adapter(createAdapter(redis, sub));
  }
  // Anonymous sockets are allowed (login / welcome screens still receive `settings:update`, e.g. maintenance on/off);
  // only authenticated sockets join a private user room.
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next();
    try {
      const p = verifyUserToken(token);
      // Same rules as REST: suspended/deleted accounts and revoked tokens get no private room.
      const u = await User.findById(p.sub, { status: 1, tokenVersion: 1 }).lean();
      if (!u || u.status === 'suspended' || u.status === 'deleted' || (p.tv ?? 0) !== (u.tokenVersion ?? 0)) throw new Error('revoked');
      socket.data.userId = p.sub;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });
  io.on('connection', (socket) => {
    const uid = socket.data.userId as string | undefined;
    if (!uid) return;
    void socket.join(`user:${uid}`);
    online.set(uid, (online.get(uid) ?? 0) + 1);
    socket.on('disconnect', () => {
      const n = (online.get(uid) ?? 1) - 1;
      if (n <= 0) online.delete(uid);
      else online.set(uid, n);
    });
  });
  logger.info('Socket.IO ready');
  return io;
}

export const emitTo = (userId: string, event: string, payload: unknown) => io?.to(`user:${userId}`).emit(event, payload);
export const broadcast = (event: string, payload: unknown) => io?.emit(event, payload);
export const isOnline =(userId: string) => online.has(userId);
