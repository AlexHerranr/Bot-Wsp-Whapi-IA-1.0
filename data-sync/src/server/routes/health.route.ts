import type { Router } from 'express';

export function registerHealthRoutes(router: Router): void {
  router.get('/health', (_req, res) => {
    res.status(200).json({ status: 'healthy', ts: new Date().toISOString() });
  });
}

