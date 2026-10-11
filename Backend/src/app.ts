import express, { Router } from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { errorHandler, logger, notFound, ok } from './lib/core.js';
import { PUBLIC_ROOT } from './lib/upload.js';
import { ipKey, limiter } from './lib/limits.js';
import { redis } from './lib/redis.js';
import { maintenanceGuard } from './middlewares/features.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { meRouter } from './modules/me/me.routes.js';
import { catalogRouter } from './modules/catalog/catalog.routes.js';
import { verificationRouter, workersRouter } from './modules/workers/workers.routes.js';
import { chatRouter } from './modules/chat/chat.routes.js';
import { pushRouter } from './modules/notifications/push.routes.js';
import { paymentsWebhook, subscriptionRouter } from './modules/subscription/subscription.routes.js';
import { safetyRouter } from './modules/safety/safety.routes.js';
import { adminAuthRouter } from './modules/admin/admin.auth.js';
import { adminRouter } from './modules/admin/admin.routes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY); // real client IP behind nginx / Cloudflare
  app.set('etag', 'strong'); // 304s for unchanged GET responses → less bandwidth

  // Images are loaded cross-origin by the web app (different port/domain), so allow cross-origin resource reads.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.corsOrigins, credentials: true, maxAge: 86400 })); // cache preflight 24h
  app.use(compression());
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/health' || req.url?.startsWith('/uploads/') === true },
      // Log path only — query strings carry search coordinates (user location) and must not land in log storage.
      serializers: {
        req: (r: { id: unknown; method: string; url: string; remoteAddress?: string }) => ({ id: r.id, method: r.method, path: r.url.split('?')[0], ip: r.remoteAddress }),
        res: (r: { statusCode: number }) => ({ statusCode: r.statusCode }),
      },
    }),
  );

  // Public media (avatars, portfolio, chat images). Verification documents are NOT here — see PRIVATE_UPLOAD_DIR.
  app.use('/uploads', express.static(PUBLIC_ROOT, { maxAge: '30d', immutable: true, index: false, dotfiles: 'deny' }));

  // Load-balancer health check: 503 takes this instance out of rotation while MongoDB / Redis is unreachable.
  app.get('/health', (_req, res) => {
    const db = mongoose.connection.readyState === 1;
    const cache = !redis || redis.isReady;
    res.status(db && cache ? 200 : 503).json({ data: { status: db && cache ? 'ok' : 'degraded', db, redis: redis ? cache : 'disabled', uptime: Math.round(process.uptime()) } });
  });

  // Signed payment webhook needs the raw body → mounted before express.json().
  app.use('/api/v1/payments', paymentsWebhook);
  app.use(express.json({ limit: env.REQUEST_JSON_LIMIT, strict: true }));

  const v1 = Router();
  // Global per-IP ceiling for every API call; tighter per-route limits (OTP, login, search, chat, uploads, reports) sit on top.
  v1.use(limiter({ name: 'global', windowMs: env.RATE_LIMIT_WINDOW * 60_000, limit: env.isProd ? env.RATE_LIMIT_MAX : env.RATE_LIMIT_DEV_MAX, key: ipKey }));

  // Admin panel keeps working during maintenance → mounted before the maintenance guard.
  v1.use('/admin/auth', adminAuthRouter);
  v1.use('/admin', adminRouter);

  v1.use(maintenanceGuard);
  v1.use('/auth', authRouter);
  v1.use('/', catalogRouter);
  v1.use('/workers', workersRouter);
  v1.use('/verification', verificationRouter);
  v1.use('/subscription', subscriptionRouter);
  v1.use('/', meRouter);
  v1.use('/', chatRouter);
  v1.use('/', pushRouter);
  v1.use('/', safetyRouter);
  app.use('/api/v1', v1);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
