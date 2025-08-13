data-sync (servicio de datos independiente)

Este directorio agrupa documentación y plan de trabajo para extraer la capa de datos (BD + sincronización + vistas) a un servicio independiente, reutilizable por el bot, n8n y otros consumidores.

Estado: Fase 0 (solo documentación y estructura mínima). No se ha movido código aún.

- Propósito: centralizar Prisma, vistas SQL y procesos de ingesta/sync (Beds24) fuera del bot.
- Consumidores: bot WhatsApp, n8n, BI/consultas.
- Siguiente paso: leer `docs/PLAN_POR_FASES.md` y ejecutar Fase 1.


