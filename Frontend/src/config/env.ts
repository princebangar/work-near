const e = import.meta.env;

export const env = {
  apiUrl: (e.VITE_API_BASE_URL as string | undefined) ?? '/api/v1',
  // Origin that serves /uploads/* media and Socket.IO. Empty → same origin (Vite proxy in dev).
  backendOrigin: ((e.VITE_BACKEND_ORIGIN as string | undefined) ?? '').replace(/\/$/, ''),
  socketUrl: ((e.VITE_SOCKET_URL as string | undefined) ?? (e.VITE_BACKEND_ORIGIN as string | undefined) ?? '').replace(/\/$/, ''),
  razorpayKeyId: e.VITE_RAZORPAY_KEY_ID as string | undefined,
  isDev: e.DEV,
} as const;

export const APP = {
  name: 'WorkNear',
  // Fallbacks only — live values come from GET /settings (admin → Customization Settings).
  radiusOptions: [5, 10, 15] as const,
  defaultRadiusKm: 5,
  supportEmail: 'support@worknear.in',
  version: '1.0.0',
} as const;
