# 10. Análisis: Problemas Conocidos, Performance e Integraciones

> **Introducción**: Este documento presenta un análisis exhaustivo de los problemas conocidos, métricas de performance, y integraciones externas del sistema monolítico. Basado en el CURRENT_STATE.md, categoriza problemas por criticidad (4 críticos, 4 altos, 4 medios), documenta métricas de performance reales con logs de memoria cada 5 min (alertas >300MB o >95% heap) y métricas Prometheus (fallbacks, tokens, latency, messages) (latencia 3-8s, memoria 150-400MB, usuarios concurrentes 50-200 típico máx 500), identifica bottlenecks específicos en OpenAI polling, Beds24 API, transcripciones audio, TTS generation, memory growth y polling post-tool (500ms-5s backoff, max 10 attempts), analiza integraciones detalladas con OpenAI (Assistant API, Whisper, TTS, Vision), Whapi (mensajería, presences, labels, media) y Beds24 (getAvailabilities XML, timeouts ~20%), evalúa límites de escalabilidad actuales (500 usuarios max, 400MB memoria), y proporciona un plan de mejoras en 3 fases con mitigations como lru-cache, cleanupService y Redis. Incluye análisis de rate limiting en webhooks (webhookCounts Map, 1 log/min) y typing logs (typingLogTimestamps Map, 5s). Incluye checklist pre-migración completo para auditoría de Maps/Sets, timers, botSentMessages, temp files, caches, locks, subscribeToPresence, analyzeImage, isQuoteOrPriceMessage y flujo manuales.

## Problemas Conocidos por Criticidad

### 🔴 Críticos

| Problema | Descripción | Riesgo | Mitigación Actual | Solución Recomendada |
|----------|-------------|--------|-------------------|---------------------|
| **Memory leaks sin mitigación completa** | Caches crecen indefinidamente si cleanup intervals fallan; contextCache/chatInfoCache sin límite máximo; globalUserStates puede acumular miles de usuarios; typingLogTimestamps y webhookCounts sin TTL explícito | Causa crashes en Cloud Run tras ~24h de uptime | Restart diario manual | Implementar límites estrictos en todos los caches (e.g., `max: 1000` entradas) usando una librería como `lru-cache`. Crear un módulo `CacheManager` centralizado |
| **Persistencia no escalable** | JSON files para threads causa I/O blocking y no permite escalar a múltiples instancias | Pérdida de memoria/estados al reiniciar; no soporta múltiples instancias | Ninguna | Migrar la persistencia a una base de datos externa. Redis es ideal para la gestión de threads y estados volátiles con TTL. Firestore/MongoDB para una persistencia más robusta |
| **Código monolítico inmantenible** | 3,779 líneas en un archivo; funciones dispersas sin organización clara; imports obsoletos comentados por todas partes | Dificulta el desarrollo, la depuración y la incorporación de nuevas funcionalidades | Ninguna | Refactorizar el código en módulos por dominio: `webhook`, `openai`, `whatsapp`, `state`, `functions`, `core`, etc. |
| **Runs huérfanos facturación extra** | Si cleanup falla, runs activos indefinidos | Costo adicional OpenAI (~$0.03/run abandonado) | Cleanup automático en boot con recoverOrphanedRuns (cancela TODOS los runs activos) y cleanupOldRuns (>10min) | Asegurar que el cleanup de runs huérfanos funcione en la nueva arquitectura |

### 🟡 Altos

| Problema | Descripción | Riesgo | Mitigación Actual | Solución Recomendada |
|----------|-------------|--------|-------------------|---------------------|
| **Beds24 API inestable** | ~20% timeouts sin retry automático | Afecta UX en cotizaciones; sin circuit breaker | Ninguna | Implementar un patrón de `Retry` con `Exponential Backoff` para las llamadas a la API de Beds24. Añadir un `Circuit Breaker` para dejar de intentar si la API está caída |
| **Voice handling frágil** | Transcripciones fallan si no hay URL; TTS limitado a 4000 caracteres; temp files pueden acumular si cleanup falla; pendingImages sin TTL explícito; transcribeAudio con temp files en /tmp/ y fs.unlink.catch(() => {}) ignora errores | UX degradada en media handling | .catch(() => {}) ignora errores | Crear un `cleanupService` que se ejecute periódicamente (e.g., cada hora) y elimine todos los archivos en `/tmp/audio/` con más de 60 minutos de antigüedad |
| **Validación puede causar loops** | userRetryState mitiga pero no elimina; errores complejos no siempre corregibles | Puede agotar tokens rápidamente | userRetryState (1 reintento cada 5 min) | Reforzarlo asegurando que el `correctiveMessage` sea cada vez más específico o añadiendo un contador global para desactivar reintentos si falla repetidamente |
| **Webhook processing sin deduplicación** | Mensajes duplicados procesados múltiples veces; rate limiting solo en logs, no en procesamiento | Genera respuestas y costos duplicados | Rate limiting en logs con webhookCounts Map (1 log/min), pero no en procesamiento | Implementar un cache de IDs de mensajes procesados. Antes de procesar un mensaje, verificar si su ID ya existe en un `Set` o `Cache` con un TTL de ~5 minutos |

### 🟠 Medios

| Problema | Descripción | Riesgo | Mitigación Actual | Solución Recomendada |
|----------|-------------|--------|-------------------|---------------------|
| **Sin tests automatizados** | Cambios rompen flujos sin detección; regresiones frecuentes en buffers/timers | Regresiones frecuentes | Ninguna | Funciones exportadas para tests (e.g., getShortUserId, transcribeAudio); frameworks sugeridos (Vitest/Jest); enfoque en mocking de dependencias (OpenAI, Whapi, Beds24); incluir mocking para imports dinámicos como executeFunction en function-registry.js; recomendaciones para coverage, pruebas unitarias/integración y CI/CD |
| **Logs excesivamente verbosos** | ~100 logs por request en modo debug; logs en debug con ~20 métodos en terminalLog; SHOW_FUNCTION_LOGS configurable | Dificulta debugging real en producción | Ninguna | Ninguna especificada |
| **Métricas incompletas** | No tracking de memory leaks específicos; no histogramas de latencia; no alertas automáticas configuradas; pero incluye memory logs cada 5 min, getCacheStats, simpleLockManager.getStats | Dificulta monitoreo | Ninguna | Ninguna especificada |
| **Configuración mezclada local/cloud** | Riesgo de usar config incorrecta; secrets en .env no rotados; loadAndValidateConfig maneja .env y Cloud Secrets, pero secrets no rotados | Errores en producción | Ninguna | Ninguna especificada |

## Métricas de Performance

### Métricas Típicas del Sistema Actual
```typescript
// Métricas observadas en el sistema actual:
// - Tiempo respuesta promedio: 3-8s (OpenAI 1-5s + Beds24 2-5s)
// - Memoria RAM: 150-400MB (alertas >300MB, crítico >95% heap)
// - CPU: 10-40% en picos (TTS/Whisper intensive)
// - Usuarios concurrentes: 50-200 típico, máx 500
// - Requests/min: 200-1000 (webhooks + API calls)
// - Tokens/request: 500-3000 (alertas >2000)
// - memoryLogs: 'Cada 5 min (alert si >300MB o >95% heap)',
// - cacheCleanups: 'Caches expirados cada 10 min (cleanupExpiredCaches), user states cada 1h (>24h inactivo), global buffer cada 10 min (>15 min inactivo)'
```

Basado en logs como logPerformanceMetrics (durationMs, tokensPerSecond, memory.heapUsedMB) y setLatency, setTokensUsed en métricas Prometheus.

## Bottlenecks Identificados

### 1. OpenAI Polling
```typescript
const openaiPollingBottleneck = {
    issue: 'Polling 1-3s base + backoff (puede llegar a 30s timeout)',
    impact: 'Increased latency',
    current: '1s interval, max 30 attempts, backoff progresivo en race conditions (1-5s)',
    solution: 'Ninguna especificada'
};
```

### 2. Beds24 API
```typescript
const beds24Bottleneck = {
    issue: '2-5s típico, ~20% timeouts',
    impact: 'Afecta UX en cotizaciones',
    current: 'No retry/backoff',
    solution: 'Implementar Retry con Exponential Backoff y Circuit Breaker'
};
```

### 3. Transcripciones Audio
```typescript
const audioTranscriptionBottleneck = {
    issue: '3-10s (descarga + Whisper + temp file)',
    impact: 'Delayed processing for voice messages',
    current: 'Whisper-1 model, temp files with .catch(() => {})',
    solution: 'Crear un cleanupService para archivos temporales'
};
```

### 4. TTS Generation
```typescript
const ttsBottleneck = {
    issue: '2-5s para respuestas largas',
    impact: 'Delayed voice responses',
    current: 'tts-1 model, voice: nova, max 4000 chars',
    solution: 'Ninguna especificada'
};
```

### 5. Polling Post-Tool
```typescript
const postToolPollingBottleneck = {
    issue: '500ms-5s backoff, max 10 attempts',
    impact: 'Delayed function calling resolution',
    current: 'Polling después de submitToolOutputs con backoff progresivo',
    solution: 'Ninguna especificada'
};
```

### 6. Memory Growth
```typescript
const memoryGrowthBottleneck = {
    issue: 'Caches sin límite estricto (mitigado con intervals)',
    impact: 'Memory leaks potenciales en globalMessageBuffers, contextCache, globalUserStates, pendingImages, temp files',
    current: 'Intervals para cleanups',
    solution: 'Implementar límites estrictos con lru-cache'
};
```

## Integraciones Externas

### 1. OpenAI Integration
```typescript
const openaiIntegration = {
    endpoints: 'https://api.openai.com/v1',
    models: {
        whisper: 'whisper-1 (transcripción audio, español)',
        tts: 'tts-1 (text-to-speech, voice: nova)',
        vision: 'gpt-4o-mini para Vision en analyzeImage',
        assistant: 'Assistant principal no especificado model pero usa OPENAI_ASSISTANT_ID'
    },
    functions: ['check_availability', 'get_conversation_context', 'view_image', 'search_knowledge'],
    rateLimits: 'Timeout: configurable en appConfig, Retries: configurable en appConfig',
    manejoErrores: 'context_length_exceeded → Nuevo thread automático, Runs huérfanos → Cleanup automático, Race conditions con backoff (1-5s, max 15 attempts en add message)',
    reliability: 'Polling 1-3s base + backoff, context_length_exceeded común en threads largos'
};
```

### 2. Whapi Integration
```typescript
const whapiIntegration = {
    endpoints: '${WHAPI_API_URL} (e.g., https://gate.whapi.cloud/)',
    token: '${WHAPI_TOKEN}',
    usedEndpoints: ['/messages/text (enviar texto)', '/messages/voice (enviar voz)', '/presences/{id} (suscribir/actualizar presencia)', '/presences/{id} (PUT para typing/recording indicators)', '/messages/{id} (obtener info mensaje, media URLs)', '/chats/{id} (obtener info chat)'],
    functionalities: 'Labels management, Presences (typing, recording, online), Media handling (images, voice)',
    rateLimits: 'No documentado',
    webhooks: 'POST /hook'
};
```

### 3. Beds24 Integration
```typescript
const beds24Integration = {
    endpoints: 'https://beds24.com/api/json/',
    auth: 'apiKey y propKey en secrets',
    usedEndpoints: 'getAvailabilities (disponibilidad y precios)',
    response: 'XML (parseado a JSON en executeFunction para check_availability)',
    timezone: 'UTC → America/Bogota',
    rateLimits: 'No documentado',
    timeouts: '~20% de requests',
    formatoRespuesta: 'roomId, units available, prices por noche, min stay requirements',
    reliability: '~20% timeouts sin retry/backoff'
};
```

## Análisis de Escalabilidad

### 1. Current Scale Limits
```typescript
const scaleLimits = {
    usuariosConcurrentes: '50-200 típico, máx 500',
    memoria: '150-400MB (alertas >300MB) (heapUsedMB >300MB alerta en logs cada 5 min)',
    bottlenecks: 'Memory growth en caches sin límite estricto'
};
```

## Plan de Mejoras de Performance

### 1. Fase 1: Quick Wins
```typescript
const phase1Improvements = {
    memoryLeaks: {
        task: 'Implementar límites estrictos en caches con lru-cache incluyendo typingLogTimestamps y webhookCounts',
        impact: 'Prevenir memory leaks',
        effort: 'Bajo'
    },
    tempFiles: {
        task: 'Crear cleanupService para archivos temporales',
        impact: 'Evitar acumulación en /tmp/',
        effort: 'Bajo'
    }
};
```

### 2. Fase 2: Architecture Improvements
```typescript
const phase2Improvements = {
    beds24Instable: {
        task: 'Implementar Retry con Exponential Backoff y Circuit Breaker para Beds24',
        impact: 'Mejorar reliability en cotizaciones',
        effort: 'Medio'
    },
    webhookDeduplication: {
        task: 'Implementar cache de IDs para deduplicación de webhooks extender webhookCounts Map a procesamiento (no solo logs)',
        impact: 'Evitar procesamiento duplicado',
        effort: 'Medio'
    },
    validationLoops: {
        task: 'Reforzar userRetryState con correctiveMessage más específico y contador global',
        impact: 'Evitar loops costosos',
        effort: 'Medio'
    }
};
```

### 3. Fase 3: Full Scalability
```typescript
const phase3Improvements = {
    persistencia: {
        task: 'Migrar a Redis para threads/estados con TTL',
        impact: 'Escalabilidad a múltiples instancias',
        effort: 'Alto'
    }
};
```

## Checklist Pre-migración

- [ ] Verificar que todos los Maps/Sets (userRetryState, subscribedPresences, etc.) tengan estrategia de migración
- [ ] Confirmar que todos los timers (globalMessageBuffers) se manejen correctamente en módulos
- [ ] Asegurar que botSentMessages se migre para evitar self-loops
- [ ] Validar que el cleanup de temp files (/tmp/audio_*) funcione en la nueva arquitectura
- [ ] Probar que invalidateUserCaches funcione entre módulos para mantener consistencia
- [ ] Verificar que el sistema de locks (simpleLockManager) mantenga su integridad
- [ ] Migrar la lógica de subscribeToPresence para que siga activa en cada procesamiento
- [ ] Asegurar que analyzeImage se integre con el nuevo sistema de manejo de media
- [ ] Mantener la lógica de isQuoteOrPriceMessage para el fallback de voz a texto
- [ ] Probar el flujo completo de mensajes manuales (from_me: true)
- [ ] Verificar funciones exportadas para tests (getShortUserId, transcribeAudio, etc.)
- [ ] Verificar que typingLogTimestamps y webhookCounts se migren con rate limiting (5s typing, 1 log/min webhooks)
- [ ] Asegurar que precomputedContextBase (TTL 1 min) se migre para optimización de contexto temporal
- [ ] Probar que sendTypingIndicator y sendRecordingIndicator funcionen en módulos (PUT /presences/{id})