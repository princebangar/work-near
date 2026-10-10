import { env } from './config/env.js';
import { logger } from './lib/core.js';
import { createApp } from './app.js';

const server = createApp().listen(env.PORT, () => logger.info(`WorkNear API listening on http://localhost:${env.PORT}`));
server.keepAliveTimeout = 65_000; // longer than typical LB idle timeout
server.headersTimeout = 66_000;

const shutdown = (signal: string) => {
  logger.info({ signal }, 'Shutting down gracefully');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => logger.error({ err }, 'Unhandled rejection'));
