// FCM web push. Firebase SDK is dynamically imported, so it never weighs down the initial bundle.
// React Native: replace with @react-native-firebase/messaging; the register/unregister API calls stay the same.

const e = import.meta.env;
const firebaseConfig = {
  apiKey: e.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: e.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: e.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: e.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: e.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: e.VITE_FIREBASE_APP_ID as string | undefined,
  measurementId: e.VITE_FIREBASE_MEASUREMENT_ID as string | undefined,
};
const VAPID = e.VITE_FIREBASE_VAPID_KEY as string | undefined;
const TOKEN_KEY = 'wn-push-token';

export type PushState = 'unsupported' | 'default' | 'granted' | 'denied';

export function pushState(): PushState {
  if (!firebaseConfig.apiKey || !VAPID || !('serviceWorker' in navigator) || !('Notification' in window) || !window.isSecureContext) return 'unsupported';
  return Notification.permission as PushState;
}

/** Last token we successfully registered with the backend (avoids re-posting the same token every visit). */
export const savedPushToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const rememberPushToken = (t: string | null) => {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* storage blocked */ }
};

/**
 * Returns the current FCM token. Asks for permission only when `prompt` is true (must be called from a user tap).
 * Returns null when unsupported, denied or dismissed.
 */
export async function getPushToken(prompt: boolean): Promise<string | null> {
  if (pushState() === 'unsupported') return null;
  if (Notification.permission !== 'granted') {
    if (!prompt) return null;
    if ((await Notification.requestPermission()) !== 'granted') return null;
  }
  const [{ initializeApp, getApps }, { getMessaging, getToken, isSupported }] = await Promise.all([import('firebase/app'), import('firebase/messaging')]);
  if (!(await isSupported())) return null;
  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const app = getApps()[0] ?? initializeApp(firebaseConfig);
  return getToken(getMessaging(app), { vapidKey: VAPID, serviceWorkerRegistration: registration });
}

/** Foreground pushes (app visible) arrive here from the service worker. */
export function onForegroundPush(cb: (p: { title: string; body: string; link?: string }) => void) {
  if (!('serviceWorker' in navigator)) return () => {};
  const h = (ev: MessageEvent) => { if (ev.data?.type === 'wn-push') cb(ev.data.payload); };
  navigator.serviceWorker.addEventListener('message', h);
  return () => navigator.serviceWorker.removeEventListener('message', h);
}
