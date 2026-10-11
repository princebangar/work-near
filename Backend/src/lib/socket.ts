import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { logger } from './core.js';
import { verifyUserToken } from '../middlewares/auth.js';

/**
 * Realtime push channel (chat messages, read receipts, notifications).
 * Clients authenticate with the same JWT; each socket joins room `user:<id>`.
 * Messages are still *sent* over REST — sockets only fan out, so the API stays the source of truth.
 * For multiple instances add @socket.io/redis-adapter when REDIS_ENABLED.
 */
let io: Server | null = null;
const online = new Map<string, number>();

export function initSocket(server: HttpServer) {
  io = new Server(server, { cors: { origin: env.socketOrigins, credentials: true }, path: '/socket.io' });
  // Anonymous sockets are allowed (login / welcome screens still receive `settings:update`, e.g. maintenance on/off);
  // only authenticated sockets join a private user room.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (token) {
      try {
        socket.data.userId = verifyUserToken(token).sub;
      } catch {
        return next(new Error('unauthorized'));
      }
    }
    next();
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
