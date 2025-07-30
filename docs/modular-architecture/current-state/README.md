# Estado Actual del Sistema v3.0

## Introducción

Este documento proporciona un snapshot exhaustivo y actualizado del bot TeAlquilamos, basado en el archivo principal `app-unified.ts` (aproximadamente 3,779 líneas) al 28 de julio de 2025. Representa una versión corregida y mejorada de la documentación anterior (v2.0), incorporando análisis detallados, sugerencias para la migración modular, secciones nuevas sobre configuración, testing y diagramas de flujo, así como actualizaciones en problemas conocidos y mitigaciones. El objetivo es facilitar la comprensión del sistema actual, identificar riesgos y guiar la refactorización hacia una arquitectura modular más escalable y mantenible.

El bot integra servicios como OpenAI para IA conversacional, Whapi Cloud para mensajería WhatsApp y Beds24 para consultas hoteleras. Se enfoca en manejar conversaciones naturales, procesar media (voz, imágenes), ejecutar funciones específicas (e.g., check_availability) y mantener persistencia de estados. Esta versión incluye mejoras en logging, tracing y performance, con énfasis en la preparación para migración (e.g., módulos independientes para logging, persistencia y locks).

Documento generado el 28 de julio de 2025 - Versión 3.0.0-updated.

## Índice

| Sección | Descripción | Archivo |
|---------|-------------|---------|
| 1. Imports y Configuración Inicial | Descripción detallada de los módulos importados (e.g., dotenv, express, OpenAI), configuración de entorno con loadAndValidateConfig, y variables de entorno críticas. Incluye el sistema de logging terminalLog con ~20 métodos para logs limpios, rate limiting para webhooks y caches con TTLs (e.g., chatInfoCache, contextCache). | [01-imports-configuracion.md](./01-imports-configuracion.md) |
| 2. Configuración y Variables de Entorno | Tabla exhaustiva de variables como OPENAI_ASSISTANT_ID, WHAPI_TOKEN, ENABLE_VOICE_RESPONSES, con descripciones, valores por defecto, ejemplos y nivel de criticidad. Incluye impactos en funcionalidades como transcripciones y respuestas de voz. | [02-configuracion-variables.md](./02-configuracion-variables.md) |
| 3. Variables Globales y Estructuras de Datos | Análisis de variables como appConfig, openaiClient, globalMessageBuffers, globalUserStates, activeProcessing y caches (e.g., contextCache con TTL de 1 hora). Detalla estructuras como Maps/Sets para estados, buffers y datos en memoria volátil con TTLs. | [03-variables-globales.md](./03-variables-globales.md) |
| 4. Datos y Persistencia | Descripción de datos en memoria volátil (e.g., Maps con TTLs para buffers y caches), persistentes (e.g., threads-data.json y guest-memory.json obsoleto), y temporales (/tmp/ para audio). Incluye riesgos de acumulación de archivos, estrategias de backup y mitigación de memory leaks. | [04-datos-persistencia.md](./04-datos-persistencia.md) |
| 5. Funciones Utilitarias y Auxiliares | Detalle de helpers básicos (e.g., getTimestamp, getShortUserId), gestión de estados y caches (e.g., getOrCreateUserState, getCachedChatInfo), media handling (e.g., transcribeAudio con Whisper, analyzeImage con Vision), locks (e.g., acquireThreadLock), buffering (e.g., addToGlobalBuffer, setIntelligentTimer) y envío de mensajes (e.g., sendWhatsAppMessage con división inteligente). | [05-funciones-utilitarias.md](./05-funciones-utilitarias.md) |
| 6. Procesamiento Principal y Flujos de OpenAI con Webhooks | Lógica core para recepción de webhooks (processWebhook), procesamiento de buffers (processGlobalBuffer), OpenAI (processWithOpenAI con polling, function calling y validación), y flujos especiales (e.g., mensajes manuales con from_me: true, media handling para voz/imágenes, voice responses con fallback). Incluye manejo de retries, tracing y métricas. | [06-procesamiento-principal.md](./06-procesamiento-principal.md) |
| 7. Setup, Servidor, Monitoreo y Sistemas Auxiliares | Configuración de endpoints Express (e.g., /health, /hook, /metrics, /locks, /dashboard), signal handlers para shutdown graceful, inicialización (initializeBot con intervals para cleanups y métricas), dashboard para logs en tiempo real, tracing (e.g., startRequestTracing), logging y diagramas ASCII de flujos (e.g., sincronización de mensajes manuales, ciclo de procesamiento con function calling). | [07-servidor-monitoreo.md](./07-servidor-monitoreo.md) |
| 8. Funcionalidades Específicas de Hotelería | Detalle de check_availability (parámetros, ejecución con Beds24 API, formateo de resultados), labels hoteleros (e.g., 'Potencial', 'Reservado'), contexto temporal inyectado (e.g., fecha/hora/cliente/status), validación de respuestas sensibles y timezone America/Bogota. Incluye ejemplos de regex para detección sensible y integración con APIs externas. | [08-funcionalidades-hoteleria.md](./08-funcionalidades-hoteleria.md) |
| 9. Estrategia de Testing | Funciones exportadas para tests (e.g., getShortUserId, transcribeAudio), frameworks sugeridos (Vitest/Jest), enfoque en mocking de dependencias (OpenAI, Whapi, Beds24) y recomendaciones para coverage, pruebas unitarias/integración y CI/CD. | [09-testing-estrategia.md](./09-testing-estrategia.md) |
| 10. Análisis: Problemas Conocidos, Performance e Integraciones | Tabla detallada de problemas críticos/altos/medios con riesgos y mitigaciones (e.g., memory leaks con lru-cache, Beds24 timeouts con retry/backoff). Métricas típicas (e.g., latencia 3-8s, memoria 150-400MB), bottlenecks identificados y integraciones externas (OpenAI, Whapi, Beds24 con endpoints, auth y rate limits). Incluye nota para migración con checklist pre-migración. | [10-problemas-performance.md](./10-problemas-performance.md) |
| 11. Código Fuente Principal | Extracto estructurado y análisis del archivo app-unified.ts, incluyendo imports (~1-150), variables globales (~150-400), funciones utilitarias (~400-2500), setup/configuración (~2500-3000), servidor Express (~3000-3500), manejadores globales (~3500-3700) y función principal (~3700-3779). Incluye estadísticas (e.g., ~92 funciones, 12 rutas Express). | [11-codigo-fuente.md](./11-codigo-fuente.md) |

## Navegación

- [← Volver a documentación principal](../README.md)
- [📋 Ver tareas pendientes](../PENDING_TASKS.md)
- [🔄 Ver plan de migración](../MIGRATION_PLAN.md)

## Estado de la Documentación

- **Versión**: 3.0.0-updated
- **Fecha de actualización**: 28 de julio de 2025
- **Archivo fuente**: `app-unified.ts` (3,779 líneas)
- **Estado**: Desglosado en módulos detallados para mejor comprensión