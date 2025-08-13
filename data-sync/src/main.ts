import express from 'express';
import { env } from './config/env';
import { logger } from './utils/logger';
import { connectPrisma } from './infra/db/prisma.client';
import { registerHealthRoutes } from './server/routes/health.route';
import { registerBeds24Webhook } from './server/routes/webhooks/beds24.route';

async function bootstrap(): Promise<void> {
  await connectPrisma();
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const router = express.Router();
  registerHealthRoutes(router);
  registerBeds24Webhook(router);
  app.use('/', router);

  app.listen(env.PORT, () => {
    logger.info(`[data-sync] listening on :${env.PORT}`);
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Fatal error on bootstrap');
  process.exit(1);
});

