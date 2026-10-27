// Values come from mobile-user/.env (EXPO_PUBLIC_* are inlined at build time).
const strip = (s) => (s ?? '').replace(/\/$/, '');

export const env = {
  apiUrl: strip(process.env.EXPO_PUBLIC_API_BASE_URL) || 'https://worknear.in/api/v1',
  // Origin that serves /uploads/* media and Socket.IO.
  backendOrigin: strip(process.env.EXPO_PUBLIC_BACKEND_ORIGIN) || 'https://worknear.in',
  webOrigin: strip(process.env.EXPO_PUBLIC_WEB_ORIGIN) || 'https://worknear.in',
  mapsKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  razorpayKeyId: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID,
};

export const APP = {
  name: 'Work Near',
  // Fallbacks only — live values come from GET /settings (admin → Customization Settings).
  radiusOptions: [5, 10, 15],
  defaultRadiusKm: 5,
  version: '1.0.0',
};
