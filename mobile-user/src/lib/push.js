// Native FCM push (replaces the web's firebase/messaging service worker). The backend already accepts
// platform 'android' tokens and sends to channel 'default'. Needs google-services.json for com.worknear.user.
import * as Notifications from 'expo-notifications';
import { kv } from '@/lib/storage';

const TOKEN_KEY = 'wn-push-token';

// Foreground pushes are shown as an in-app toast (like the web), not as a system banner.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

let channelReady = null;
const ensureChannel = () =>
  (channelReady ??= Notifications.setNotificationChannelAsync('default', {
    name: 'Work Near',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#15803d',
  }).catch(() => null));

/** 'granted' | 'default' (can still ask) | 'denied' | 'unsupported' — same states as the web's pushState(). */
export async function pushState() {
  try {
    const p = await Notifications.getPermissionsAsync();
    if (p.granted) return 'granted';
    return p.canAskAgain ? 'default' : 'denied';
  } catch {
    return 'unsupported';
  }
}

/** Last token we registered with the backend (avoids re-posting the same token every start). */
export const savedPushToken = () => kv.get(TOKEN_KEY);
export const rememberPushToken = (t) => kv.set(TOKEN_KEY, t);

/** Returns the FCM token. Asks for permission only when `prompt` is true. Null when denied or Firebase isn't configured. */
export async function getPushToken(prompt) {
  await ensureChannel(); // Android 13+ shows the permission prompt only once a channel exists
  let p = await Notifications.getPermissionsAsync();
  if (!p.granted) {
    if (!prompt || !p.canAskAgain) return null;
    p = await Notifications.requestPermissionsAsync();
    if (!p.granted) return null;
  }
  try {
    const t = await Notifications.getDevicePushTokenAsync();
    return typeof t.data === 'string' ? t.data : null;
  } catch {
    return null; // no google-services.json in this build → FCM unavailable
  }
}

const payloadOf = (n) => {
  const c = n.request.content;
  const d = c.data ?? {};
  return { title: c.title ?? d.title ?? '', body: c.body ?? d.body ?? '', link: d.link };
};

/** Foreground pushes (app open). */
export function onForegroundPush(cb) {
  const sub = Notifications.addNotificationReceivedListener((n) => cb(payloadOf(n)));
  return () => sub.remove();
}

/** User tapped a notification → its deep link (e.g. "/chats/abc"). Also handles the tap that launched the app. */
export function onPushTap(cb) {
  Notifications.getLastNotificationResponseAsync()
    .then((r) => r && cb(payloadOf(r.notification)))
    .catch(() => undefined);
  const sub = Notifications.addNotificationResponseReceivedListener((r) => cb(payloadOf(r.notification)));
  return () => sub.remove();
}
