## Plan de separación de Base de Datos — Aterrizado a tu proyecto actual

Este documento aterriza el plan "data-sync" a la realidad del repo actual y define un roadmap por fases para separar la capa de datos del bot. Se creará y evolucionará una carpeta `data-sync/` dentro de este mismo proyecto para luego extraerla como repo independiente.

### 1) Diagnóstico del proyecto actual (real)

- BD y ORM
  - Prisma en `prisma/schema.prisma` con modelos: `ClientView`, `HotelApartment`, `Booking`, `Leads` y vistas SQL en `prisma/views.sql`.
  - Acceso a BD centralizado vía `src/core/services/database.service.ts` (crea `PrismaClient`, conecta y expone `client`).

- Webhooks y API
  - Endpoints en `src/core/bot.ts` (Express): `/health`, `/status`, `/hook` (webhook principal). No hay Fastify ni OpenAPI.
  - Validación/sanitización: `src/core/api/webhook-validator.ts`.
  - Procesamiento de payloads: `src/core/api/webhook-processor.ts` (enfocado a WHAPI, no Beds24).

- Integración Beds24 (pull/sync)
  - Scripts en `src/plugins/hotel/ops/beds24/`: `sync-reservations.ts`, `sync-leads.ts` (usan Prisma directo con upsert y lógica de clasificación de leads/confirmadas).

- Triggers/Vistas/Funciones auxiliares
  - SQL vistas en `prisma/views.sql` (reemplazan tablas particionadas consultando `Booking`).
  - Scripts para triggers/leads: `setup-leads-sync-trigger.ts`, `optimize-leads-table.ts`, `improve-leads-structure.ts`, `fix-trigger-function.ts` (embeben SQL ejecutado con Prisma).

- Colas/outbox/Redis
  - No hay BullMQ ni outbox; existe `src/utils/simpleLockManager.ts` para concurrencia en memoria.

Conclusión: hoy el bot lee/escribe BD con Prisma y tiene scripts Beds24. No hay servidor de datos propio. Es viable separar por etapas empezando por aislar Prisma y la lógica de sync en un módulo autocontenible.

### Opinión sobre el Plan Actual: Mejoras, Detalles Adicionales, Qué No Haría y Qué Haría Extra

Me encanta este tipo de planes de refactorización y separación de servicios. He analizado el código actual (p. ej., `src/core/services/database.service.ts`, `src/core/bot.ts`) y el plan propuesto. En general, el plan es excelente y bien aterrizado: minimalista, evita over-engineering y reutiliza el esquema Prisma existente. A continuación, mejoras y criterios:

- Mejores prácticas a sumar (opcionales por fase)
  - Testing desde Fase 1 (Vitest básico; prueba de `/health`).
  - Logging estructurado (Pino) y métrica simple `/metrics`.
  - Seguridad para webhooks (HMAC) en Fase 2 con `BEDS24_WEBHOOK_SECRET`.
  - Retries básicos de red en `sync.ts` (y idempotencia por `modifiedDate`).
  - Documentación adicional: `docs/BEDS24.md` y `docs/MIGRATION_FROM_BOT.md`.
  - Multi-tenant básico en Fase 4 (header `X-Tenant-Id`).

- Qué no haría de inicio
  - No introducir Fastify aún (mantener Express por consistencia).
  - No agregar BullMQ/Redis en Fase 1-2 (dejar para Fase 3 si hay volumen).
  - No duplicar `schema.prisma` hasta Fase 5 (referencia a `../prisma`).
  - No implementar outbox/subscriptions hasta que se requiera push a terceros.

- Extras de valor inmediato (opcionales)
  - Dockerfile y docker-compose para dev y deploy.
  - CI básica (lint/test/build/migrate) cuando se extraiga el módulo.
  - Script de backfill por rango (`scripts/backfill.ts`).

### 2) Gap vs plan “data-sync” original

- Falta un servidor HTTP dedicado a data con `/health`, `/metrics`, `/webhooks/*`, `/admin/*` y OpenAPI.
- Falta capa `core/` (entidades, casos de uso, eventos) agnóstica del proveedor.
- Falta `infra/queues` (BullMQ/Redis) y `infra/outbox`.
- Ya existen: Prisma + vistas, scripts Beds24 pull/sync y validadores básicos.

### 3) Aterrizaje minimalista (lo necesario ahora)

Objetivo Fase 1-2: crear un “módulo data-sync” en este repo que contenga:
- Prisma aislado (reuso de `prisma/schema.prisma` y `prisma/views.sql`).
- Mini servidor HTTP (Express para no introducir Fastify aún) con:
  - `GET /health`.
  - `POST /webhooks/beds24` (placeholder; HMAC más adelante).
- Adaptar scripts `src/plugins/hotel/ops/beds24/` a `data-sync/src/providers/beds24/` sin dependencias del bot.
- Mantener `.env` sin secretos y documentar variables requeridas.

Sin colas ni outbox todavía; se deja para Fase 3.

### 4) Nueva estructura propuesta (mínima, dentro de este repo)

```
data-sync/
  README.md
  docs/
    PLAN_POR_FASES.md
  prisma/              # (en esta fase referencia a ../prisma/ para evitar duplicar)
    schema.prisma      # referencia a ../prisma/schema.prisma
    views.sql          # referencia a ../prisma/views.sql
  src/
    main.ts            # bootstrap: carga env, inicia server Express
    server/
      routes/
        health.route.ts
        webhooks/
          beds24.route.ts       # placeholder de recepción/validación básica
    providers/
      beds24/
        client.ts               # futuro: HTTP API Beds24
        sync.ts                 # adaptación desde scripts actuales (pull + upsert)
    infra/
      db/
        prisma.client.ts        # instancia de Prisma aislada
    config/
      env.ts                    # lectura básica de env (PORT, DATABASE_URL)
```

Nota: en esta fase se referencian archivos de `prisma/` existentes para evitar duplicación. Al extraer a repo propio, se copian y se añade tooling (package.json, tsconfig, eslint, CI).

### 5) Fases y pasos detallados

Fase 1 — Base del módulo (sin mover lógica del bot)
- Crear `data-sync/src/infra/db/prisma.client.ts` con instancia de Prisma.
- Crear `data-sync/src/server` con Express mínimo y ruta `GET /health`.
- Documentar variables en `data-sync/.env.example` (sin llaves reales).
- Añadir `data-sync/src/config/env.ts` para leer `DATABASE_URL`, `PORT`.

Fase 2 — Migrar scripts Beds24 al módulo
- Adaptar `sync-reservations.ts` y `sync-leads.ts` como `providers/beds24/sync.ts` usando la instancia Prisma del módulo.
- Centralizar mapeos mínimos para no romper; no introducir aún entidades de dominio.
- Añadir `POST /webhooks/beds24` (placeholder) que valide body y registre logs.

Fase 3 — Opcional (colas y outbox)
- Introducir BullMQ/Redis en `infra/queues` con un worker `sync-booking.worker.ts`.
- Añadir `outbox` y `subscriptions` si hay consumidores externos (n8n).

Fase 4 — OpenAPI y seguridad
- Agregar `openapi.yaml` y servir `/docs`.
- Middlewares de `tenant-context` y `verify-signature` si aplica.

Fase 5 — Extracción a repo independiente
- Copiar `data-sync/` a un nuevo repo, agregando `package.json`, `tsconfig.json`, `eslintrc`, CI.
- Reemplazar referencias relativas a `../prisma` por locales.
- Publicar como servicio aparte y apuntar el bot a él (DB o HTTP, según decisión final).

### 6) Compatibilidad y riesgos

- El bot seguirá usando `src/core/services/database.service.ts` hasta completar Fase 2.
- Evitar cambios de esquema; solo reutilización.
- No commitear secrets. Mantener `.env.example` con placeholders.

### 7) Variables de entorno (ejemplo)

```
NODE_ENV=development
PORT=3020
DATABASE_URL=postgresql://...
TZ=America/Bogota
```

### 8) Checklist por fase

Fase 1
- [ ] `data-sync/src/infra/db/prisma.client.ts` creado
- [ ] `data-sync/src/server/routes/health.route.ts` funcionando
- [ ] `data-sync/src/config/env.ts` lee `DATABASE_URL` y `PORT`
- [ ] Documentación finalizada (este archivo)

Fase 2
- [ ] `providers/beds24/sync.ts` adaptado desde scripts actuales
- [ ] `POST /webhooks/beds24` placeholder

Fase 3 (opcional)
- [ ] BullMQ/Redis base y worker `sync-booking`
- [ ] Outbox + subscriptions mínimos

Fase 4
- [ ] OpenAPI servido en `/docs`
- [ ] Middlewares de seguridad/contexto

Fase 5
- [ ] Repo independiente con tooling
- [ ] Bot apuntando al servicio
