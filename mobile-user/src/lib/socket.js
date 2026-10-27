import { io } from 'socket.io-client';
import { env } from '@/config/env';

/**
 * One Socket.IO connection for the whole app (same client library as the web). Reconnects with the new token on
 * login/logout. Anonymous connections are allowed so login/welcome screens still get `settings:update` (maintenance).
 * Server → client events: settings:update, message:new, conversation:read, notification:new, account:suspended.
 */
let socket = null;
let currentToken;

export function connectSocket(token) {
  if (socket && currentToken === token) return socket;
  socket?.disconnect();
  currentToken = token;
  socket = io(env.backendOrigin, {
    path: '/socket.io',
    auth: token ? { token } : {},
    transports: ['websocket'],
    reconnectionDelayMax: 10_000,
  });
  return socket;
}

export const getSocket = () => socket;

/** Subscribe to a server event; returns an unsubscribe fn (safe to call before the socket exists). */
export function onSocket(event, cb) {
  const s = socket;
  if (!s) return () => {};
  s.on(event, cb);
  return () => s.off(event, cb);
}
