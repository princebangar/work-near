import express, { Router } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { pinoHttp } from 'pino-http';
import { rateLimit } from 'express-rate-limit';
import { env } from './config/env.js';
import { errorHandler, logger, notFound, ok } from './lib/core.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { catalogRouter } from './modules/catalog/catalog.routes.js';
import { workersRouter } from './modules/workers/workers.routes.js';
import { pushRouter } from './modules/notifications/push.routes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY); // real client IP behind nginx / Cloudflare
  app.set('etag', 'strong'); // 304s for unchanged GET responses → less bandwidth

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, credentials: true, maxAge: 86400 })); // cache preflight 24h
  app.use(compression());
  app.use(express.json({ limit: env.REQUEST_JSON_LIMIT }));
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));

  app.get('/health', (_req, res) => ok(res, { status: 'ok', uptime: process.uptime() }));

  const v1 = Router();
  v1.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW * 60_000,
      limit: env.isProd ? env.RATE_LIMIT_MAX : env.RATE_LIMIT_DEV_MAX,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: () => !env.RATE_LIMIT_ENABLED,
    }),
  );
  v1.use('/auth', authRouter);
  v1.use('/', catalogRouter);
  v1.use('/workers', workersRouter);
  v1.use('/', pushRouter);
  // Next modules: /me, /conversations, /notifications, /subscription, /reviews, /reports, /complaints, /admin
  app.use('/api/v1', v1);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
