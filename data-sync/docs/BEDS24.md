## Beds24 — Integración

- Webhook: `POST /webhooks/beds24` (ACK inmediato). HMAC opcional por `BEDS24_WEBHOOK_SECRET`.
- Sync: En Fase 2 se moverá la lógica desde `src/plugins/hotel/ops/beds24/` a `data-sync/src/providers/beds24/sync.ts`.
- Mapping sugerido: id → bookingId, modified → modifiedDate, pagos/cargos → `payments`/`charges`.

