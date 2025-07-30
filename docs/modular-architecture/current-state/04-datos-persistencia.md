# 4. Datos y Persistencia

> **Introducción**: Este documento analiza el sistema de persistencia del bot, incluyendo datos volátiles en memoria, persistencia en archivos JSON, y archivos temporales. Basado en el CURRENT_STATE.md, documenta la estructura inferida de `threadPersistence` basada en su uso en el código (e.g., métodos como `initializeCleanup`, `getThread`, `setThread`), el módulo obsoleto `guestMemory`, estrategias de backup automático, procedimientos de restore, y sistemas de limpieza. Incluye análisis de intervals de cleanup reales en el código para mitigar leaks. Identifica riesgos críticos de memory leaks en Maps sin límites, acumulación de archivos temporales, y proporciona estrategias de migración hacia sistemas más robustos con LRU caches, monitoring de memoria, y cleanup automatizado.

**Fecha de análisis**: 28 de julio de 2025. Basado en app-unified.ts (3,779 líneas). **Riesgos clave**: Maps sin max size (~10 Maps/Sets volátiles), temp files con cleanup fallible.

## Tipos de Datos en el Sistema

### 1. Datos Volátiles (En Memoria)

#### Maps con TTL
```typescript
// Chat Info Cache - TTL: 5 min (CHAT_INFO_CACHE_TTL = 5 * 60 * 1000)
const chatInfoCache = new Map<string, {
    data: any;
    timestamp: number;
}>();

// Context Cache - TTL: 1 hora (60 * 60 * 1000)
const contextCache = new Map<string, {
    context: string;
    timestamp: number;
}>();
```

#### Objetos Temporales Simples
```typescript
// precomputedContextBase - TTL: 1 min (CONTEXT_BASE_CACHE_TTL = 60 * 1000)
let precomputedContextBase: { date: string; time: string; timestamp: number } | null = null;
```

#### Maps/Sets sin TTL explícito (Riesgo de leak)
```typescript
// webhookCounts: Map<string, { lastLog: number; count: number }>; Sin TTL, usado para rate limiting logs (crece indefinidamente si muchos webhooks inválidos).
// typingLogTimestamps: Map<string, number>; Sin TTL, rate limiting typing logs (5s check manual, crece con usuarios únicos).
// subscribedPresences: Set<string>; Sin TTL, suscripciones a presences (crece indefinidamente con usuarios únicos, riesgo alto de leak si no se implementa cleanup).
// globalUserStates: Map<string, UserState>; Sin TTL explícito, cleanup manual cada 1h en interval (>24h inactivo basado en lastMessageTimestamp/lastTypingTimestamp).
// globalMessageBuffers: Map<string, { messages: string[]; ... }>; Sin TTL explícito, cleanup manual cada 10min en interval (>15min inactivo basado en lastActivity).
// activeProcessing: Set<string>; Sin TTL, temporal (limpiado en finally de processGlobalBuffer, no riesgo de leak).
// pendingImages: Map<string, string[]>; Sin TTL explícito, limpiado post-uso en processWithOpenAI (bajo riesgo si no hay errores).
// botSentMessages: Set<string>; TTL per-entry: 10 min via setTimeout individual en sendWhatsAppMessage.
// userRetryState: Map<string, { retryCount: number; lastRetryTime: number }>; Sin TTL explícito, cooldown manual 5min, max 1 retry (crece con usuarios únicos que fallan validación).
```

Algunos tienen mitigación parcial: botSentMessages (TTL 10min per-entry via setTimeout), userRetryState (manual cooldown 5min, max 1 retry).

### 2. Datos Persistentes (Archivos)

#### threads-data.json
```json
{
    "573001234567": {
        "threadId": "thread_abc123",
        "chatId": "573001234567@s.whatsapp.net",
        "userName": "Juan Pérez",
        "createdAt": "2025-07-28T10:30:00Z",
        "lastActivity": "2025-07-28T15:45:00Z",
        "name": "Juan Pérez",  // Opcional, actualizado si cambia
        "labels": ["Consulta", "VIP"]  // Opcional, actualizado si cambia
    }
}
```

**Ubicación**: `./data/threads-data.json`
**Uso**: Persistencia de threads OpenAI entre reinicios
**Formato**: JSON basado en código real
**Métodos inferidos**: `initializeCleanup()`, `getThread(userId)`, `setThread(userId, threadId, chatId, userName)`, `updateThreadMetadata(userId, updates)`, `getStats()`, `getAllThreadsInfo()` (usado en recoverOrphanedRuns).

#### guest-memory.json (OBSOLETO)
```json
{
    "573001234567": {
        "name": "Juan Pérez",
        "whapiLabels": [
            {"id": "1", "name": "Potencial"},
            {"id": "2", "name": "Consulta"}
        ],
        "lastInteraction": "2025-07-28T15:45:00Z"
    }
}
```

**Estado**: Obsoleto, pero aún importado y usado en `getOrCreateProfile`, `getRelevantContext`
**Riesgo**: Duplicación con threadPersistence, código legacy que puede causar conflictos
**Métodos**: `getOrCreateProfile(userId)`
**Acción requerida**: Remover completamente

### 3. Datos Temporales

#### Archivos de Audio (tmp/)
```
tmp/
├── audio_1690545600000.ogg
└── audio_1690545700000.ogg
```

**Path de Transcripción**: `path.join('tmp', `audio_${Date.now()}.ogg`)`
**Path de Servicio (TTS)**: Se infiere de la ruta `/audio/:filename` que es `path.join('tmp', 'audio', filename)`. **Nota**: Es recomendable unificar a una sola ruta, preferiblemente `tmp/audio/`.
**Soporta**: .ogg (para Whisper) y .mp3 (para TTS).
**Cleanup**: `fs.unlink.catch(() => {})` por archivo, no periódico
**Riesgo alto**: Si unlink falla (e.g., permisos), acumulación; No cleanup en startup/interval


## Sistema de Persistencia

### ThreadPersistence Module
**Ubicación del Import**: `import { threadPersistence } from './utils/persistence/index.js';`
**Métodos inferidos basados en uso**:
- `initializeCleanup()` - Inicializa sistema de limpieza
- `getThread(userId)` - Obtiene thread de usuario
- `setThread(userId, threadId, chatId, userName)` - Crea/actualiza thread
- `updateThreadMetadata(userId, updates)` - Actualiza metadatos (name, labels)
- `getStats()` - Estadísticas del sistema
- `getAllThreadsInfo()` - Retorna todos los threads (usado en recoverOrphanedRuns para cancelar runs al boot)

### Cleanup Automatizado
```typescript
// Intervals en initializeBot():
setInterval(cleanupExpiredCaches, 10 * 60 * 1000); // Caches cada 10 min (contextCache, chatInfoCache, etc.).
setInterval(() => { /* globalUserStates >24h inactivo basado en lastMessageTimestamp/lastTypingTimestamp */ }, 60 * 60 * 1000); // User states cada 1h.
setInterval(() => { /* globalMessageBuffers >15min inactivo basado en lastActivity */ }, 10 * 60 * 1000); // Buffers cada 10 min.
setTimeout(recoverOrphanedRuns, 5000); // Al boot (5s delay, cancela TODOS runs activos).
```

## Estrategias de Backup

### Backup Automático
**Estado**: Propuesta (no en código actual)  
**Actual**: Ningún backup automático; Solo persistencia básica en JSON

### Restore Procedures
**Estado**: Propuesta  
**Actual**: Manual (copiar JSON y reiniciar)

## Mitigación de Memory Leaks

### 1. LRU Cache Implementation
**Estado**: Propuesta para migración (no implementado)  
**Actual**: Maps manuales con checks en intervals; Riesgo: No max size

### 2. Memory Monitoring (Actual)
**Estado**: Interval cada 5 min en initializeBot() (línea ~3000, setInterval anónimo) con logs/alerts si heapUsed >300MB o heapUsage >95%. Usa `process.memoryUsage()` y `process.cpuUsage()` en `logPerformanceMetrics` para monitoreo completo.
**Propuesta**: Añadir emergency cleanup si >95% (e.g., clear oldest Maps).


## Riesgos de Acumulación

### Archivos Temporales
**Problema**: Archivos de audio no se eliminan si el proceso termina inesperadamente  
**Actual cleanup**: Por archivo con `.catch(() => {})`; No periódico/startup  
**Propuesta**: Añadir interval para scan /tmp cada 10 min

### Memory Leaks en Maps
**Problema**: Maps que crecen indefinidamente (~10 estructuras sin max size o cleanup: globalUserStates, subscribedPresences, webhookCounts, typingLogTimestamps, etc.). **Maps reales sin max**: subscribedPresences (crece con usuarios únicos), webhookCounts (crece con tipos de webhooks inválidos). **Riesgo mayor**: En entornos long-running como Cloud Run (~24h crashes reportados en producción).  
**Actual mitigación**: Intervals para user states/buffers; No para subscribedPresences (riesgo crecimiento indefinido)
- subscribedPresences: Crece con usuarios únicos sin cleanup; Propuesta: Añadir Set max size o cleanup en interval.

## Recomendaciones para Migración

### Estructura Propuesta
```
persistence/
├── adapters/
│   ├── FileSystemAdapter.ts
│   ├── RedisAdapter.ts
│   └── DatabaseAdapter.ts
├── managers/
│   ├── ThreadManager.ts
│   ├── CacheManager.ts
│   └── BackupManager.ts
├── models/
│   ├── ThreadData.ts
│   ├── UserState.ts
│   └── CacheEntry.ts
└── strategies/
    ├── LRUStrategy.ts
    ├── TTLStrategy.ts
    └── PersistentStrategy.ts
```

**Prioridad**: Implementar max size en Maps actuales antes de migrar

**Iniciar con auditoría**: Añadir logs de `Map.size` para cuantificar leaks antes de implementar LRU (e.g., `console.log('globalUserStates size:', globalUserStates.size)` en intervals).

### Mejoras Críticas
1. **Implementar LRU caches** para prevenir memory leaks
2. **Persistent storage** para datos críticos (Redis/Database)
3. **Atomic transactions** para operaciones críticas
4. **Monitoring y alertas** de memoria
5. **Backup distribuido** con múltiples estrategias
6. **Data validation** con esquemas estrictos
7. **Cleanup automatizado** con scheduler robusto