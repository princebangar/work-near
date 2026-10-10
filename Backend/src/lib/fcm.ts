import { readFileSync } from 'node:fs';
import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { env } from '../config/env.js';
import { logger } from './core.js';

let messaging: Messaging | null | undefined;

/** Lazily initialises Firebase Admin from FIREBASE_SERVICE_ACCOUNT (JSON) or FIREBASE_SERVICE_ACCOUNT_PATH. */
function getFcm(): Messaging | null {
  if (messaging !== undefined) return messaging;
  try {
    const raw = env.FIREBASE_SERVICE_ACCOUNT ?? (env.FIREBASE_SERVICE_ACCOUNT_PATH && readFileSync(env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));
    if (!raw) {
      logger.warn('Firebase service account not configured — push notifications disabled');
      return (messaging = null);
    }
    const sa = JSON.parse(raw) as ServiceAccount & { project_id?: string };
    const app = getApps()[0] ?? initializeApp({ credential: cert(sa) });
    logger.info({ project: sa.project_id }, 'Firebase Admin initialised');
    return (messaging = getMessaging(app));
  } catch (err) {
    logger.error({ err }, 'Firebase Admin init failed — push notifications disabled');
    return (messaging = null);
  }
}

export interface PushMessage { title: string; body: string; link?: string; data?: Record<string, string> }

// Tokens FCM reports as dead — callers delete these so we never send to them again.
const DEAD = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument']);

/** Sends one notification to many device tokens. Returns tokens that should be removed. */
export async function sendPush(tokens: string[], msg: PushMessage): Promise<{ sent: number; deadTokens: string[] }> {
  const fcm = getFcm();
  if (!fcm || tokens.length === 0) return { sent: 0, deadTokens: [] };
  const data = { ...msg.data, title: msg.title, body: msg.body, ...(msg.link && { link: msg.link }) };
  const res = await fcm.sendEachForMulticast({
    tokens,
    notification: { title: msg.title, body: msg.body },
    data,
    webpush: { fcmOptions: msg.link ? { link: msg.link } : undefined, notification: { icon: '/logo.svg', badge: '/logo.svg' } },
    android: { priority: 'high', notification: { channelId: 'default' } },
    apns: { payload: { aps: { sound: 'default' } } },
  });
  const deadTokens = res.responses.flatMap((r, i) => (!r.success && r.error && DEAD.has(r.error.code) ? [tokens[i]!] : []));
  return { sent: res.successCount, deadTokens };
}

/** For health checks: validates credentials with a dry-run send (no device receives anything). */
export async function verifyFcmCredentials(): Promise<string> {
  const fcm = getFcm();
  if (!fcm) return 'not-configured';
  try {
    await fcm.send({ token: 'dry-run-invalid-token', notification: { title: 't', body: 't' } }, true);
    return 'ok';
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'unknown';
    // An invalid-token error means Google accepted our credentials and only rejected the fake token.
    return DEAD.has(code) ? 'ok' : code;
  }
}
