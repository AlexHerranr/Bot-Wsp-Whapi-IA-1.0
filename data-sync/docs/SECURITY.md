## Seguridad

- HMAC opcional para `/webhooks/beds24` usando `BEDS24_WEBHOOK_SECRET`.
- Logs estructurados (Pino). Evitar logs de datos sensibles.
- Variables en `.env` (no commitear secretos).
- Futuro: IP allowlist, rate limiting y tenant-context.

