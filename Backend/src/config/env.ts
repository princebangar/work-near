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

  // First super admin — created at boot only while no admin account exists (see lib/bootstrap.ts)
  SEED_ADMIN_EMAIL: z.string().default('worknear@admin.com'),
  SEED_ADMIN_PASSWORD: str,

  // Password hashing (admin/staff accounts). 10 = OWASP minimum for bcrypt; each +1 doubles the cost.
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10, 'BCRYPT_SALT_ROUNDS must be at least 10').max(15).default(10),

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
  OTP_IP_RATE_LIMIT: int(20), // OTP requests per IP per hour (stops SMS pumping across many numbers)
  ADMIN_LOGIN_RATE_LIMIT: int(10), // admin login attempts per email per 15 min (on top of the per-IP limit)
  SEARCH_RATE_LIMIT: int(60), // worker searches per IP per minute
  UPLOAD_RATE_LIMIT: int(30), // file uploads per user per hour
  REPORT_RATE_LIMIT: int(10), // reports + complaints per user per hour

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
const fatal: string[] = [];
if (e.REDIS_ENABLED && !e.REDIS_URL) fatal.push('REDIS_URL is required when REDIS_ENABLED=true');
if (e.NODE_ENV === 'production') {
  // Production must never boot half-configured or with test shortcuts left on.
  if (e.USE_DEFAULT_OTP) fatal.push('USE_DEFAULT_OTP must be false in production');
  if (!e.MONGODB_URI) fatal.push('MONGODB_URI is required in production');
  if (e.JWT_ACCESS_SECRET === e.JWT_REFRESH_SECRET) fatal.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different');
  if (e.ADMIN_REGISTRATION_CODE && e.ADMIN_REGISTRATION_CODE.length < 16) fatal.push('ADMIN_REGISTRATION_CODE must be at least 16 characters (or empty)');
  if (!e.RATE_LIMIT_ENABLED) fatal.push('RATE_LIMIT_ENABLED must be true in production');
  if (/localhost|127\.0\.0\.1/.test(e.FRONTEND_URL)) console.warn('Warning: FRONTEND_URL allows a localhost origin in production');
}
if (fatal.length) {
  console.error(`Invalid environment:\n - ${fatal.join('\n - ')}`);
  process.exit(1);
}

export const env = {
  ...e,
  isProd: e.NODE_ENV === 'production',
  corsOrigins: e.FRONTEND_URL.split(',').map((s) => s.trim()).filter(Boolean),
  socketOrigins: (e.SOCKET_CORS_ORIGIN ?? e.FRONTEND_URL).split(',').map((s) => s.trim()).filter(Boolean),
  razorpayEnabled: !!(e.RAZORPAY_KEY_ID && e.RAZORPAY_KEY_SECRET),
};
