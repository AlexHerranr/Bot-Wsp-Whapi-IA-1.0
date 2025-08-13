#!/usr/bin/env tsx

import { config } from 'dotenv';
import { syncCancelledReservations, syncLeadsAndConfirmed } from '../src/providers/beds24/sync';
import { connectPrisma } from '../src/infra/db/prisma.client';
import { logger } from '../src/utils/logger';

config({ path: '.env' });

interface BackfillOptions {
  type: 'cancelled' | 'leads' | 'all';
  from?: string;
  to?: string;
  limit?: number;
  dryRun?: boolean;
}

function parseArgs(): BackfillOptions {
  const args = process.argv.slice(2);
  const options: BackfillOptions = { type: 'all' };

  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];

    switch (flag) {
      case '--type':
        if (['cancelled', 'leads', 'all'].includes(value)) {
          options.type = value as any;
        }
        break;
      case '--from':
        options.from = value;
        break;
      case '--to':
        options.to = value;
        break;
      case '--limit':
        options.limit = parseInt(value) || undefined;
        break;
      case '--dry-run':
        options.dryRun = true;
        i--; // No value for this flag
        break;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();
  
  logger.info(options, 'Starting backfill operation');

  if (options.dryRun) {
    logger.warn('DRY RUN MODE - No data will be written to database');
    return;
  }

  await connectPrisma();

  try {
    if (options.type === 'cancelled' || options.type === 'all') {
      logger.info('Starting cancelled reservations sync...');
      const cancelledResult = await syncCancelledReservations(options.from, options.to);
      logger.info(cancelledResult, 'Cancelled reservations sync completed');
    }

    if (options.type === 'leads' || options.type === 'all') {
      logger.info('Starting leads and confirmed sync...');
      const leadsResult = await syncLeadsAndConfirmed(options.from, options.to);
      logger.info(leadsResult, 'Leads and confirmed sync completed');
    }

    logger.info('Backfill operation completed successfully');
  } catch (error: any) {
    logger.error({ error: error.message }, 'Backfill operation failed');
    process.exit(1);
  }
}

// Help text
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Beds24 Backfill Script

Usage:
  npm run backfill -- [options]

Options:
  --type <type>      Type of sync: 'cancelled', 'leads', or 'all' (default: all)
  --from <date>      Start date (YYYY-MM-DD format)
  --to <date>        End date (YYYY-MM-DD format)
  --limit <number>   Limit number of bookings to process
  --dry-run          Don't write to database, just log what would be done
  --help, -h         Show this help

Examples:
  npm run backfill -- --type cancelled --from 2023-01-01 --to 2025-12-31
  npm run backfill -- --type leads --from 2025-08-12 --to 2026-02-12
  npm run backfill -- --type all --dry-run
  `);
  process.exit(0);
}

main().catch(console.error);