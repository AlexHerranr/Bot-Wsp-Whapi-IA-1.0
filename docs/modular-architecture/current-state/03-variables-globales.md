# 3. Variables Globales y Estructuras de Datos

> **Introducción**: Esta sección examina las variables globales clave del sistema monolítico y sus estructuras de datos en memoria. Basado en el análisis completo del `CURRENT_STATE`, documenta los buffers de mensajes, estados de usuario, caches con TTL, y los sistemas que gestionan estados globales como locks y rate limiting. Identifica riesgos críticos de memory leaks, race conditions en timers, y proporciona estrategias detalladas de migración modular con interfaces específicas para cada componente.

## Ubicación en el Código
**Líneas**: ~150-400 del archivo `app-unified.ts`

## Variables de Configuración Global (Según CURRENT_STATE.md)

### Core System Variables
```typescript
// VARIABLES GLOBALES (líneas ~150-400)
let appConfig: AppConfig; // Configuración cargada (entorno, secrets)
let openaiClient: OpenAI; // Cliente OpenAI inicializado
let server: http.Server; // Servidor HTTP
let isServerInitialized = false; // Flag de inicialización
```

### Desglose de Variables Globales
Según el análisis del `CURRENT_STATE.md`, el sistema utiliza aproximadamente **24 identificadores globales**, categorizados de manera más precisa como:

- **4 variables de estado del servidor**: `appConfig`, `openaiClient`, `server`, `isServerInitialized` (inicialización y configuración core).
- **8 estructuras de datos con TTL/Cache**: `globalMessageBuffers`, `globalUserStates`, `chatInfoCache`, `contextCache`, `precomputedContextBase`, `pendingImages`, `botSentMessages`, `userRetryState` (gestión temporal de estados y caches).
- **4 estructuras de control de flujo**: `activeProcessing`, `subscribedPresences`, `webhookCounts`, `typingLogTimestamps` (prevención de concurrencia y rate limiting).
- **6 constantes de configuración**: `BUFFER_WINDOW_MS`, `TYPING_EXTENDED_MS`, `CONTEXT_BASE_CACHE_TTL`, `CHAT_INFO_CACHE_TTL`, `MAX_MESSAGE_LENGTH`, `SHOW_FUNCTION_LOGS` (configuración de comportamiento).
- **2 sistemas auxiliares**: `terminalLog` (logging unificado), `simpleLockManager`/`requestTracing` (gestión de locks y tracing).

## Estructuras de Datos en Memoria (Según CURRENT_STATE.md)

### 1. Buffer Unificado de Mensajes
```typescript
// Buffer unificado de mensajes
const globalMessageBuffers = new Map<string, {
    messages: string[],        // Hasta 50 msgs (cambio: era Array complejo, ahora string[])
    chatId: string,
    userName: string,
    lastActivity: number,      // Para cleanup >15min
    timer: NodeJS.Timeout | null,
    currentDelay?: number      // 5000ms normal, 10000ms si typing/recording activo
}>();
const BUFFER_WINDOW_MS = 5000; // 5 segundos para agrupar mensajes normales
const TYPING_EXTENDED_MS = 10000; // 10 segundos cuando usuario está escribiendo/grabando
```

**Descripción**: Agrupa mensajes por usuario para procesamiento inteligente
- **TTL**: Basado en actividad (cleanup >15min inactivo)
- **Timer inteligente**: 5s normal, 10s si usuario está escribiendo
- **Limpieza**: Automática al procesar + cleanup de buffers stale
- **Riesgo CRÍTICO**: Timers no cancelados en race conditions

### 2. Estados Globales de Usuario
```typescript
const globalUserStates = new Map<string, UserState>(); // Estados de usuario completos

// UserState incluye:
interface UserState {
    userId: string,
    isTyping: boolean,
    lastTypingTimestamp: number,
    lastMessageTimestamp: number,
    messages: string[],
    chatId: string,
    userName: string,
    typingEventsCount: number,
    averageTypingDuration: number,
    lastInputVoice: boolean,   // Para voice responses - CRÍTICO para TTS
    lastTyping: number,        // Timestamp del último typing detectado
    isCurrentlyRecording?: boolean  // Opcional para estado de grabación
}
```

**Descripción**: Mantiene estado completo persistente de usuarios
- **TTL**: Sin expiración automática (RIESGO DE MEMORY LEAK)
- **Limpieza**: Cleanup cada hora pero puede acumular
- **Uso crítico**: `lastInputVoice` determina si responder con voz
- **Riesgo CRÍTICO**: Puede acumular miles de usuarios

### 3. Active Processing Control
```typescript
const activeProcessing = new Set<string>(); // Usuarios en procesamiento activo
```

**Descripción**: Set simple para evitar procesamiento concurrente por usuario
- **TTL**: Se limpia inmediatamente al completar procesamiento
- **Uso**: `activeProcessing.add(userId)` durante procesamiento
- **Limpieza**: `activeProcessing.delete(userId)` in finally
- **Riesgo**: Entradas huérfanas si crash durante procesamiento

### 4. Precomputed Context Base
```typescript
let precomputedContextBase: { date: string; time: string; timestamp: number } | null = null;
const CONTEXT_BASE_CACHE_TTL = 60 * 1000; // 1 minuto
```

**Descripción**: Cache temporal para fecha/hora base en contexto (optimización para inyección frecuente)
- **TTL**: 1 minuto (verificación manual con `timestamp`)
- **Uso**: Genera contexto base (date/time) para evitar recomputación en cada request
- **Riesgo**: Bajo, pero si no se actualiza, contexto puede estar desfasado por 1 min

### 5. Sistema de Logs en Terminal
```typescript
// Sistema de logs limpios para terminal (objeto global con ~20 métodos)
const terminalLog = { /* ... implementación con ~20 métodos ... */ };
```

**Descripción**: Un objeto global constante que centraliza todos los logs de la consola con un formato limpio y estandarizado
- **Métodos**: ~20 funciones como `message()`, `response()`, `error()`, `functionStart()`, y `availabilityResult()`.
- **Propósito**: Uniformizar el formato de logs en terminal y facilitar debugging
- **Impacto en migración**: Crítico - usado en todo el sistema para logging consistente

## Caches con TTL (Estructura Real del CURRENT_STATE.md)

### 6. Chat Info Cache
```typescript
const chatInfoCache = new Map<string, { data: any; timestamp: number }>(); // Cache info chats
const CHAT_INFO_CACHE_TTL = 5 * 60 * 1000; // 5 minutos
```

**Configuración REAL**:
- **TTL**: 5 minutos (no 1 hora como se pensaba)
- **Estructura**: `{ data: any, timestamp: number }` (no expires)
- **Limpieza**: Manual verificando `timestamp + TTL < now`
- **Uso**: Info de Whapi (name, labels, participants)

### 7. Context Cache  
```typescript
const contextCache = new Map<string, { context: string, timestamp: number }>(); // Cache contexto temporal
const CONTEXT_CACHE_TTL = 60 * 60 * 1000; // 1 hora
```

**Configuración REAL**:
- **TTL**: 1 hora (correcto)
- **Estructura**: `{ context: string, timestamp: number }` (no expires)
- **Limpieza**: Manual verificando timestamp
- **Uso**: Contexto temporal formateado para OpenAI (fecha, cliente, status)

### Diferencia Crítica en Estructura de TTL
❌ **Anterior asunción**: `{ data: any, expires: number }`
✅ **Estructura real**: `{ data: any, timestamp: number }` + constante TTL

Esto significa que la validación de TTL se hace comparando:
```typescript
// Validación: Date.now() - timestamp < TTL
if (cached && (Date.now() - cached.timestamp < TTL)) {
    return cached.data; // Still valid
}
```

## Variables Adicionales Críticas (Del CURRENT_STATE.md)

### 8. Media y Mensajes
```typescript
// Media y mensajes
const pendingImages = new Map<string, string[]>(); // URLs imágenes pendientes por usuario
const botSentMessages = new Set<string>(); // IDs de mensajes enviados por bot (evitar self-loops)
```

**Descripción**:
- **`pendingImages`**: URLs de imágenes por usuario para análisis con Vision
- **`botSentMessages`**: TTL 10 minutos auto-delete, previene self-loops
- **Riesgo**: `pendingImages` no tiene TTL explícito (memory leak potencial)

### 9. Control de Retries y Validación  
```typescript
// Control de retries y validación
const userRetryState = new Map<string, { retryCount: number; lastRetryTime: number }>(); // Control retries (evitar loops)
// Cooldown: 5 minutos, Límite: 1 retry por usuario
```

**Descripción**: Control de retries para validación de respuestas
- **Límite**: 1 retry por usuario
- **Cooldown**: 5 minutos entre retries
- **Propósito**: Evitar loops costosos en corrección de respuestas

### 10. Control de Suscripciones a Presences
```typescript
const subscribedPresences = new Set<string>(); // En setupWebhooks, evita resuscripciones duplicadas
```

**Descripción**: Trackea usuarios suscritos a presence updates en WHAPI
- **Uso**: Evita spam de suscripciones duplicadas (check `has(userId)` antes de POST)
- **Riesgo crítico para migración**: Si no se migra, causará spam de suscripciones WHAPI

### 11. Rate Limiting y Control
```typescript
// Rate limiting y control
const webhookCounts = new Map<string, { lastLog: number; count: number }>(); // Rate limiting logs webhooks
const typingLogTimestamps = new Map<string, number>(); // Rate limiting typing logs (5s)
```

**Descripción**: Rate limiting para logs y eventos
- **`webhookCounts`**: 1 log/min para webhooks inválidos
- **`typingLogTimestamps`**: Rate limit 5s para logs de typing

### 12. Constantes del Sistema
```typescript
// Constantes
const MAX_MESSAGE_LENGTH = 5000; // Límite longitud mensajes

// Control de configuración  
const SHOW_FUNCTION_LOGS = process.env.TERMINAL_LOGS_FUNCTIONS !== 'false'; // Logs functions en terminal
```

## Sistemas de Gestión de Estado Global

### Sistema de Locks (simpleLockManager)

### Configuración Híbrida Actual
```typescript
// Sistema híbrido con locks y colas por usuario
// Configuración:
//    - Tipo: user-based (un lock por userId)
//    - Timeout: 15 segundos (auto-release si no se libera)
//    - Queue: habilitada (procesa en orden FIFO)
//    - Auto-release: sí (previene deadlocks)
//    - Concurrencia: 1 proceso por usuario a la vez

// Métodos principales:
//    - acquireUserLock(userId): Promise<boolean>
//    - releaseUserLock(userId): void
//    - addToQueue(userId, messageId, data, processFunction): void
//    - processQueue(userId): Promise<void>
//    - hasActiveLock(userId): boolean
//    - getStats(): {activeLocks: number, activeQueues: number}
//    - clearAll(): void (solo desarrollo)
```

**Uso en el flujo**:
1. `processCombinedMessage` intenta `acquireThreadLock`
2. Si ocupado → `addToQueue` con `processFunction`  
3. Al terminar → `releaseThreadLock`
4. Auto-procesa siguiente en cola

### Sistema de Tracing

### Request Lifecycle Tracking
```typescript
// Sistema de Tracing:
// Request lifecycle tracking
// Funciones:
//    - startRequestTracing(userId): string (requestId)
//    - updateRequestStage(requestId, stage): void
//    - registerToolCall(requestId, toolCallId, name, status): void
//    - updateToolCallStatus(requestId, toolCallId, status): void
//    - endRequestTracing(requestId): TracingSummary
//    
// Stages: init → processing → function_calling → post_tools_completed → completed
// Tool status: executing → success|error
```

**Flujo de Tracing**:
1. `startRequestTracing(userId)` genera `requestId`
2. `updateRequestStage(requestId, stage)` marca etapas
3. `registerToolCall(requestId, toolCallId, functionName, 'executing')`
4. `updateToolCallStatus(requestId, toolCallId, 'success'|'error')`
5. `endRequestTracing(requestId)` → summary con duración total



## Riesgos Identificados y Estrategias de Migración (Según CURRENT_STATE.md)

### Memory Leaks Críticos Detectados
```typescript
const memoryLeakRisks = {
    // RIESGO CRÍTICO: Sin TTL automático
    globalUserStates: {
        risk: 'CRÍTICO - Sin TTL automático, puede acumular miles de usuarios',  
        currentSize: 'Hasta 500 usuarios concurrentes típicos',
        cleanup: 'Cleanup cada hora pero puede acumular entre limpiezas',
        migrationStrategy: 'Implementar LRU cache con límite de 1000 usuarios + TTL 24h'
    },
    
    // RIESGO CRÍTICO: Race conditions en timers
    globalMessageBuffers: {
        risk: 'CRÍTICO - Timers no cancelados en race conditions',
        currentUsage: 'Buffers con timers NodeJS.Timeout, limpieza >15min inactivo',
        issue: 'Timer cancellation en concurrent modifications',
        migrationStrategy: 'BufferManager con atomic timer operations + proper cleanup'
    },
    
    // RIESGO MEDIO: Sin TTL explícito  
    pendingImages: {
        risk: 'MEDIO - No tiene TTL explícito (memory leak potencial)',
        currentUsage: 'URLs de imágenes por usuario para análisis con Vision',
        migrationStrategy: 'Agregar TTL automático de 10 minutos + cleanup automático'
    },
    
    // RIESGO MEDIO: Entradas huérfanas
    activeProcessing: {
        risk: 'MEDIO - Entradas huérfanas si crash durante procesamiento',
        cleanup: 'Se limpia inmediatamente al completar procesamiento',
        issue: 'activeProcessing.delete(userId) in finally puede fallar',
        migrationStrategy: 'Agregar timeout automático de 5 minutos + health check'
    }
};
```

### Concurrencia y Race Conditions (Del CURRENT_STATE.md)


## Estrategia de Migración Modular (Según CURRENT_STATE.md)

### Fase 1: Estructura Modular Base
```typescript
// core/state/ - Gestión de estados
interface StateModule {
    UserStateManager: {
        get(userId: string): UserState | null;
        set(userId: string, state: UserState): void;
        update(userId: string, updates: Partial<UserState>): void;
        cleanup(): Promise<void>;
        getStats(): { count: number; memoryUsage: number };
    };
    
    BufferManager: {
        add(chatId: string, message: any): void;
        process(chatId: string): Promise<void>;
        setTimer(chatId: string, delay: number): void;
        clearTimer(chatId: string): void;
        cleanup(): Promise<void>;
    };
    
    CacheManager: {
        get<T>(key: string, category: 'chat' | 'context' | 'thread'): T | null;
        set<T>(key: string, value: T, ttl: number, category: 'chat' | 'context' | 'thread'): void;
        invalidate(key: string, category: 'chat' | 'context' | 'thread'): void;
        cleanup(): Promise<void>;
    };
}
```


### Fase 3: Lock Management Mejorado
```typescript
// core/locks/ - Sistema de locks robusto
interface LockModule {
    LockManager: {
        acquire(key: string, timeout: number): Promise<boolean>;
        release(key: string): void;
        withLock<T>(key: string, operation: () => Promise<T>, timeout: number): Promise<T>;
        hasActiveLock(key: string): boolean;
        getStats(): { activeLocks: number; queuedOperations: number };
        forceRelease(key: string): void; // Emergency only
        cleanup(): Promise<void>;
    };
}
```

## Variables que Requieren Migración Especial

### Tabla de Migración Crítica
| Variable Original | Riesgo Actual | Nueva Estructura | Estrategia de Migración |
|------------------|---------------|------------------|------------------------|
| `globalUserStates` | CRÍTICO - Sin TTL, acumula usuarios | `UserStateManager` con LRU + TTL 24h | 1. Wrap en Manager, 2. Agregar TTL, 3. Implementar LRU |
| `globalMessageBuffers` | CRÍTICO - Race conditions en timers | `BufferManager` atómico | 1. Lock per buffer, 2. Atomic timer ops, 3. Guaranteed cleanup |
| `pendingImages` | MEDIO - Sin TTL explícito | `MediaManager` con TTL 10min | 1. Agregar timestamps, 2. Auto-cleanup, 3. Size limits |
| `botSentMessages` | MEDIO - Set creciente | `MessageTracker` con LRU | 1. Convertir a LRU Set, 2. Límite 10k entradas, 3. TTL 10min |
| `activeProcessing` | MEDIO - Entradas huérfanas | `ProcessingTracker` con timeout | 1. Agregar timestamps, 2. Auto-expire 5min, 3. Health check |
| `chatInfoCache` | BAJO - TTL manual | `CacheManager.chatInfo` | 1. Migrar a manager unificado, 2. Auto-cleanup |
| `contextCache` | BAJO - TTL manual | `CacheManager.context` | 1. Migrar a manager unificado, 2. Auto-cleanup |

### Checklist de Migración Pre-requisitos
- [ ] **Verificar que todos los Maps/Sets tengan estrategia de TTL definida**
- [ ] **Confirmar que todos los timers se cancelen correctamente (no memory leaks)**
- [ ] **Asegurar que `botSentMessages` mantenga funcionalidad anti-loop durante migración**
- [ ] **Validar que el cleanup de `globalMessageBuffers` sea atómico (no race conditions)**
- [ ] **Probar que `subscribedPresences` mantenga estado entre reinicios del sistema**
- [ ] **Verificar que `userRetryState` preserve cooldowns durante la migración**
- [ ] **Implementar rollback plan si la migración falla en producción**

## Mejoras de Arquitectura Recomendadas

### 1. Reemplazo de Estructuras Básicas
```typescript
// ANTES: Maps básicos sin límites
const globalUserStates = new Map<string, UserState>();

// DESPUÉS: LRU Cache con límites y TTL
const userStateManager = new LRUCache<string, UserState>({
    max: 1000,              // Máximo 1000 usuarios
    ttl: 24 * 60 * 60 * 1000,  // TTL 24 horas
    updateAgeOnGet: true,    // Reset TTL on access
    dispose: (key, value) => { /* cleanup callback */ }
});
```

### 2. Atomic Operations para Concurrencia
```typescript
// ANTES: Race conditions en buffer management
function addToGlobalBuffer(chatId: string, message: any) {
    const buffer = globalMessageBuffers.get(chatId) || createBuffer();
    if (buffer.timer) clearTimeout(buffer.timer);  // RACE CONDITION
    buffer.messages.push(message);
    setIntelligentTimer(chatId, buffer);  // RACE CONDITION
}

// DESPUÉS: Atomic operations
class BufferManager {
    async addMessage(chatId: string, message: any): Promise<void> {
        return this.withBufferLock(chatId, async (buffer) => {
            buffer.messages.push(message);
            await this.resetTimer(buffer);
        });
    }
}
```

### 3. Memory Monitoring Proactivo
```typescript
const memoryMonitor = {
    thresholds: {
        warning: 0.8,    // 80% heap usage
        critical: 0.95,  // 95% heap usage
    },
    
    alerts: {
        userStatesCount: 800,      // >800 user states
        bufferCount: 200,          // >200 active buffers  
        tempFilesCount: 50,        // >50 temp files
    },
    
    actions: {
        onWarning: () => performCleanup(),
        onCritical: () => performEmergencyCleanup(),
        onExceeded: () => gracefulRestart()
    }
};
```