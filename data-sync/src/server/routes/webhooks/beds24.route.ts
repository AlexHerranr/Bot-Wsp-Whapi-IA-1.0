import type { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../../../config/env';
import { logger } from '../../../utils/logger';

function verifyHmac(req: Request, _res: Response, next: NextFunction): void {
  if (!env.BEDS24_WEBHOOK_SECRET) return next();
  try {
    const signature = req.header('x-signature') || '';
    const payload = JSON.stringify(req.body ?? {});
    const hmac = crypto.createHmac('sha256', env.BEDS24_WEBHOOK_SECRET).update(payload).digest('hex');
    if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hmac))) return next();
  } catch (err) {
    logger.warn({ err }, 'Error verifying HMAC');
  }
  return next(); // Placeholder: no bloquear en Fase 1
}

export function registerBeds24Webhook(router: Router): void {
  router.post('/webhooks/beds24', verifyHmac, async (req: Request, res: Response) => {
    res.status(200).json({ received: true, ts: new Date().toISOString() });
    
    const { bookingId, action, status } = req.body;
    logger.info({ type: 'beds24:webhook', bookingId, action, status }, 'Webhook received');
    
    // Process webhook asynchronously (don't block response)
    setImmediate(async () => {
      try {
        if (bookingId && (action === 'created' || action === 'modified')) {
          const { syncSingleBooking } = await import('../../providers/beds24/sync');
          await syncSingleBooking(String(bookingId));
          logger.info({ bookingId, action }, 'Webhook processing completed');
        }
      } catch (error: any) {
        logger.error({ bookingId, action, error: error.message }, 'Webhook processing failed');
      }
    });
  });
}

