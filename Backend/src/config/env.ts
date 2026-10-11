import { z } from 'zod';

// Fail fast on boot if configuration is invalid. Keys mirror Backend/.env.example.
const bool = (def: boolean) => z.enum(['true', 'false']).default(def ? 'true' : 'false').transform((v) => v === 'true');
const int = (def: number) => z.coerce.number().int().nonnegative().default(def);
const str = z.string().trim().optional().transform((v) => v || undefined);

const schema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: int(5000),
  TRUST_PROXY: int(1),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  REQUEST_JSON_LIMIT: z.string().default('100kb'),

  // Database
  MONGODB_URI: str,

  // File uploads (local disk for now — swap lib/upload.ts for S3/GCS later)
  UPLOAD_DIR: z.string().default('uploads'), // public: avatars, portfolio, chat images
  PRIVATE_UPLOAD_DIR: z.string().default('private-uploads'), // verification documents (admin-only)
  MAX_UPLOAD_MB: int(5),
  // Public origin of this API, used to build absolute media URLs (e.g. https://api.worknear.in). Empty = relative /uploads/... paths.
  PUBLIC_URL: str,

  // Seed (npm run seed)
  SEED_ADMIN_EMAIL: z.string().default('worknear@admin.com'),
  SEED_ADMIN_PASSWORD: str,

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_ACCESS_EXPIRES: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  JWT_REFRESH_EXPIRES: z.string().default('30d'),

  // CORS / sockets
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  SOCKET_CORS_ORIGIN: str,

  // Redis (optional — rate limits / OTP store when scaling horizontally)
  REDIS_ENABLED: bool(false),
  REDIS_URL: str,

  // HTTP rate limiting
  RATE_LIMIT_ENABLED: bool(true),
  RATE_LIMIT_WINDOW: int(15), // minutes
  RATE_LIMIT_MAX: int(3000),
  RATE_LIMIT_DEV_MAX: int(2000),
  AUTH_RATE_LIMIT_WINDOW: int(15),
  AUTH_RATE_LIMIT_MAX: int(30),

  // Google Maps (server-side geocoding)
  GOOGLE_MAPS_API_KEY: str,

  // Razorpay (subscriptions)
  RAZORPAY_KEY_ID: str,
  RAZORPAY_KEY_SECRET: str,
  RAZORPAY_WEBHOOK_SECRET: str,

  // Admin
  ADMIN_REGISTRATION_CODE: str,

  // Firebase (FCM) — service-account JSON string or file path
  FIREBASE_SERVICE_ACCOUNT: str,
  FIREBASE_SERVICE_ACCOUNT_PATH: str,

  // SMS India Hub
  SMS_HUB_ENABLED: bool(false),
  SMS_INDIA_HUB_API_KEY: str,
  SMS_INDIA_HUB_SENDER_ID: str,
  SMS_INDIA_HUB_DLT_TEMPLATE_ID: str,
  SMS_INDIA_HUB_PEID: str,
  SMS_INDIA_HUB_OTP_MESSAGE: z.string().default('Your WorkNear OTP is {otp}. Valid for 5 minutes. Do not share it with anyone.'),

  // OTP
  USE_DEFAULT_OTP: bool(true),
  DEFAULT_OTP: z.string().regex(/^\d{6}$/).default('123456'),
  USE_DEFAULT_TEST_PHONE: bool(false),
  DEFAULT_TEST_PHONE: str,
  OTP_EXPIRY_SECONDS: int(300),
  OTP_MAX_ATTEMPTS: int(4),
  OTP_RATE_LIMIT: int(3), // OTP requests allowed per phone…
  OTP_RATE_WINDOW: int(600), // …per this many seconds
  OTP_RESEND_SECONDS: int(30),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

const e = parsed.data;
if (e.NODE_ENV === 'production' && e.USE_DEFAULT_OTP) {
  console.error('USE_DEFAULT_OTP must be false in production');
  process.exit(1);
}

export const env = {
  ...e,
  isProd: e.NODE_ENV === 'production',
  corsOrigins: e.FRONTEND_URL.split(',').map((s) => s.trim()).filter(Boolean),
  socketOrigins: (e.SOCKET_CORS_ORIGIN ?? e.FRONTEND_URL).split(',').map((s) => s.trim()).filter(Boolean),
  razorpayEnabled: !!(e.RAZORPAY_KEY_ID && e.RAZORPAY_KEY_SECRET),
};
