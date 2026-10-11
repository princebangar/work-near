import { io, type Socket } from 'socket.io-client';
import { env } from '@/config/env';

/**
 * One Socket.IO connection for the whole app. Reconnects with the new token on login/logout.
 * Anonymous connections are allowed so login/welcome screens still get `settings:update` (maintenance).
 * Server → client events: settings:update, message:new, conversation:read, notification:new, account:suspended.
 */
let socket: Socket | null = null;
let currentToken: string | null | undefined;

export function connectSocket(token: string | null) {
  if (socket && currentToken === token) return socket;
  socket?.disconnect();
  currentToken = token;
  socket = io(env.socketUrl || undefined, {
    path: '/socket.io',
    auth: token ? { token } : {},
    transports: ['websocket', 'polling'],
    reconnectionDelayMax: 10_000,
  });
  return socket;
}

export const getSocket = () => socket;

/** Subscribe to a server event; returns an unsubscribe fn (safe to call before the socket exists). */
export function onSocket<T = unknown>(event: string, cb: (payload: T) => void) {
  const s = socket;
  if (!s) return () => {};
  s.on(event, cb as (p: unknown) => void);
  return () => {
    s.off(event, cb as (p: unknown) => void);
  };
}
