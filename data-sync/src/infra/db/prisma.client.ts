import { PrismaClient } from '../../../../node_modules/@prisma/client';
import { logger } from '../../utils/logger';

export const prisma = new PrismaClient({
  log: ['warn', 'error'],
});

export async function connectPrisma(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info({ msg: 'Connected to PostgreSQL (data-sync)' });
  } catch (err) {
    logger.error({ err }, 'Failed to connect to PostgreSQL');
    throw err;
  }
}

