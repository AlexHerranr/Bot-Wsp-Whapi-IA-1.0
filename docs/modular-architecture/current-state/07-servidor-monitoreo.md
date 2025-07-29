# 7. Inicialización, Monitoreo y Sistemas Auxiliares

> **Introducción**: Esta sección describe las funciones de inicialización del bot, sistemas de limpieza automática y monitoreo básico implementados en `app-unified.ts`. Cubre la función `initializeBot()` que configura intervalos de limpieza periódica, la recuperación de runs huérfanos de OpenAI, el sistema de logging y el dashboard de monitoreo. El código se enfoca en el procesamiento de mensajes más que en infraestructura de servidor compleja, manteniendo el bot operativo mediante tareas de mantenimiento automático.

## Ubicación en el Código
* **Inicialización del Bot**: `initializeBot()` (líneas `~3123-3324`)
* **Recovery de Runs**: `recoverOrphanedRuns()` (líneas `~3331-3389`)
* **Processing de Webhooks**: `processWebhook()` (líneas `~3392-3775`)
* **Sistema de Logging**: `terminalLog` object (líneas `~91-200`)

## 1. Variables Globales y Configuración

### Variables de Estado del Sistema
El sistema utiliza variables globales para mantener el estado:

```typescript
// Variables de configuración
let appConfig: AppConfig;
let openaiClient: OpenAI;
let server: http.Server;
let isServerInitialized = false;

// Sistema de logging para terminal
const terminalLog = {
    message: (user: string, text: string) => {
        const logMsg = `👤 ${user}: "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}}"`;
        console.log(logMsg);
        botDashboard.addLog(logMsg);
    },
    
    typing: (user: string) => {
        console.log(`✍️ ${user} está escribiendo...`);
    },
    
    response: (user: string, text: string, duration: number) => {
        const logMsg = `🤖 OpenAI → ${user} (${(duration/1000).toFixed(1)}s)`;
        console.log(logMsg);
        botDashboard.addLog(logMsg);
    },
    
    startup: () => {
        console.clear();
        console.log('\n=== Bot TeAlquilamos Iniciado ===');
        console.log(`🚀 Servidor: ${appConfig?.host || 'localhost'}:${appConfig?.port || 3008}`);
        console.log(`🔗 Webhook: ${appConfig?.webhookUrl || 'configurando...'}`);
        console.log('✅ Sistema listo\n');
    }
    // ... otros métodos de logging
};
```

**Nota**: El código no contiene la configuración de servidor Express que se esperaba. La infraestructura de servidor debe estar implementada en un archivo separado no visible en `app-unified.ts`.

## 2. Sistema de Dashboard y Monitoreo

### Integración con Dashboard
El código se integra con un sistema de dashboard importado de un módulo externo:

```typescript
// Importar sistema de monitoreo
import { botDashboard } from './utils/monitoring/dashboard.js';
```

El dashboard se utiliza principalmente para agregar logs:
- `botDashboard.addLog(logMsg)` - Añade mensajes al dashboard
- Integrado con `terminalLog` para logging dual (consola + dashboard)

### Sistema de Métricas
El código importa un router de métricas para Prometheus:

```typescript
import metricsRouter, { 
    incrementFallbacks, 
    setTokensUsed, 
    setLatency, 
    incrementMessages
} from './routes/metrics.js';
```

Estas funciones se utilizan a lo largo del código para:
- `incrementFallbacks()` - Contar fallbacks cuando OpenAI falla
- `setTokensUsed()` - Registrar tokens consumidos
- `setLatency()` - Medir latencia de respuestas
- `incrementMessages()` - Contar mensajes procesados

## 3. Inicialización del Bot - `initializeBot()`

La función principal que configura el sistema de limpieza automática y recovery:

### Implementación Real
```typescript
async function initializeBot() {
    // Marcar sistema como inicializado
    isServerInitialized = true;
    
    // Log de startup limpio
    terminalLog.startup();
    
    // 1. Recovery de runs huérfanos (con timeout de 10 segundos)
    setTimeout(async () => {
        try {
            logInfo('ORPHANED_RUNS_RECOVERY_START', 'Iniciando recuperación de runs huérfanos');
            
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Recovery timeout after 10 seconds')), 10000)
            );
            
            await Promise.race([
                recoverOrphanedRuns(),
                timeoutPromise
            ]);
            
            logSuccess('ORPHANED_RUNS_RECOVERY_COMPLETE', 'Recuperación de runs huérfanos completada');
        } catch (error) {
            logError('ORPHANED_RUNS_RECOVERY_ERROR', 'Error recuperando runs huérfanos', {
                error: error.message,
                stack: error instanceof Error ? error.stack : undefined,
                type: error instanceof Error ? error.constructor.name : typeof error
            });
        }
    }, 5000);
    
    // 2. Cleanup automático de caches de inyección (cada 10 minutos)
    setInterval(() => {
        try {
            cleanupExpiredCaches();
        } catch (error) {
            logError('INJECTION_CACHE_CLEANUP', 'Error en cleanup de caches de inyección', { error: error.message });
        }
    }, 10 * 60 * 1000);
    
    // 3. Limpieza de estados de usuario y caches (cada hora)
    setInterval(() => {
        try {
            const now = Date.now();
            let cleanedUserStates = 0;
            let cleanedChatInfo = 0;
            
            // Limpiar estados de usuario inactivos por más de 24 horas
            for (const [userId, state] of globalUserStates.entries()) {
                const lastActivity = Math.max(state.lastMessageTimestamp, state.lastTypingTimestamp);
                if ((now - lastActivity) > 24 * 60 * 60 * 1000) {
                    globalUserStates.delete(userId);
                    cleanedUserStates++;
                }
            }
            
            // Limpiar chatInfoCache expirado (más de 1 hora)
            for (const [userId, cached] of chatInfoCache.entries()) {
                if ((now - cached.timestamp) > 60 * 60 * 1000) {
                    chatInfoCache.delete(userId);
                    cleanedChatInfo++;
                }
            }
            
            if (cleanedUserStates > 0 || cleanedChatInfo > 0) {
                logInfo('CACHE_CLEANUP', `Limpieza de caches completada`, {
                    userStatesCleaned: cleanedUserStates,
                    chatInfoCleaned: cleanedChatInfo
                });
            }
        } catch (error) {
            logError('CACHE_CLEANUP', 'Error limpiando caches', { error: error.message });
        }
    }, 60 * 60 * 1000);
    
    // 4. Cleanup de buffers globales (cada 10 minutos)
    setInterval(() => {
        try {
            const now = Date.now();
            let expiredCount = 0;
            
            // Limpiar buffers después de 15 minutos de inactividad
            for (const [userId, buffer] of globalMessageBuffers.entries()) {
                if ((now - buffer.lastActivity) > 15 * 60 * 1000) {
                    if (buffer.timer) {
                        clearTimeout(buffer.timer);
                    }
                    globalMessageBuffers.delete(userId);
                    expiredCount++;
                }
            }
            
            if (expiredCount > 0) {
                logInfo('GLOBAL_BUFFER_CLEANUP', `Global buffer cleanup: ${expiredCount} buffers expirados removidos`, {
                    remainingEntries: globalMessageBuffers.size
                });
            }
        } catch (error) {
            logError('GLOBAL_BUFFER_CLEANUP', 'Error en cleanup del buffer global', { error: error.message });
        }
    }, 10 * 60 * 1000);
    
    // 5. Monitoreo de memoria (cada 5 minutos)
    setInterval(() => {
        try {
            const memUsage = process.memoryUsage();
            const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
            const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
            const rssMB = memUsage.rss / 1024 / 1024;
            const heapUsagePercentage = (heapUsedMB / heapTotalMB) * 100;
            
            // Solo loggear cuando hay problemas o cada 30 minutos
            const isHighMemory = heapUsedMB > 300;
            const isMemoryLeak = heapUsagePercentage > 95;
            const isModerateMemory = heapUsedMB > 200;
            const shouldLogMemory = isHighMemory || isMemoryLeak || isModerateMemory || 
                (Date.now() % (30 * 60 * 1000) < 60000);
            
            if (shouldLogMemory) {
                logInfo('MEMORY_USAGE', 'Métricas de memoria del sistema', {
                    memory: {
                        rss: Math.round(rssMB) + 'MB',
                        heapUsed: Math.round(heapUsedMB) + 'MB',
                        heapTotal: Math.round(heapTotalMB) + 'MB',
                        heapUsagePercent: Math.round(heapUsagePercentage) + '%'
                    },
                    threads: {
                        active: threadPersistence.getStats().activeThreads,
                        total: threadPersistence.getStats().totalThreads
                    },
                    uptime: Math.round(process.uptime()) + 's'
                });
            }
            
            if (isHighMemory) {
                logAlert('HIGH_MEMORY_USAGE', 'Uso alto de memoria detectado', {
                    heapUsedMB: Math.round(heapUsedMB),
                    threshold: 300,
                    heapUsagePercent: Math.round(heapUsagePercentage) + '%'
                });
            }
            
            if (isMemoryLeak) {
                logFatal('MEMORY_LEAK_DETECTED', 'Posible memory leak crítico detectado', {
                    heapUsedMB: Math.round(heapUsedMB),
                    heapUsagePercent: Math.round(heapUsagePercentage) + '%',
                    threshold: 95
                });
            }
        } catch (error) {
            logError('MEMORY_METRICS_ERROR', 'Error obteniendo métricas de memoria', { error: error.message });
        }
    }, 5 * 60 * 1000);
}
```

## 4. Recovery de Runs Huérfanos - `recoverOrphanedRuns()`

Función que cancela runs activos de OpenAI que pueden haber quedado pendientes:

```typescript
async function recoverOrphanedRuns() {
    try {
        logInfo('ORPHANED_RUNS_RECOVERY_START', 'Iniciando recuperación de runs huérfanos');
        
        const threads = threadPersistence.getAllThreadsInfo();
        let runsChecked = 0;
        let runsCancelled = 0;
        
        for (const [userId, threadInfo] of Object.entries(threads)) {
            try {
                // Verificar si hay runs activos en el thread
                const runs = await openaiClient.beta.threads.runs.list(threadInfo.threadId, { limit: 10 });
                
                for (const run of runs.data) {
                    runsChecked++;
                    
                    // Cancelar TODOS los runs activos al inicio
                    if (['queued', 'in_progress', 'requires_action'].includes(run.status)) {
                        try {
                            await openaiClient.beta.threads.runs.cancel(threadInfo.threadId, run.id);
                            runsCancelled++;
                            
                            logWarning('ORPHANED_RUN_CANCELLED', `Run huérfano cancelado al inicio`, {
                                userId,
                                threadId: threadInfo.threadId,
                                runId: run.id,
                                status: run.status,
                                ageMinutes: Math.round((Date.now() - new Date(run.created_at).getTime()) / 1000 / 60)
                            });
                        } catch (cancelError) {
                            logError('ORPHANED_RUN_CANCEL_ERROR', `Error cancelando run huérfano`, {
                                userId,
                                threadId: threadInfo.threadId,
                                runId: run.id,
                                error: cancelError.message
                            });
                        }
                    }
                }
            } catch (threadError) {
                logError('ORPHANED_RUNS_THREAD_ERROR', `Error verificando thread para runs huérfanos`, {
                    userId,
                    threadId: threadInfo.threadId,
                    error: threadError.message
                });
            }
        }
        
        logSuccess('ORPHANED_RUNS_RECOVERY_COMPLETE', 'Recuperación de runs huérfanos completada', {
            runsChecked,
            runsCancelled
        });
        
    } catch (error) {
        logError('ORPHANED_RUNS_RECOVERY_ERROR', 'Error durante recuperación de runs huérfanos', {
            error: error.message
        });
    }
}
```

**Beneficios del Recovery**:
- **Protección de costos**: Evita facturación por runs abandonados
- **Limpieza de estado**: Elimina estado inconsistente entre reinicios
- **Liberación de recursos**: Libera recursos de OpenAI

## 5. Sistema de Tracing y Logging

### Request Tracing
El código importa funciones de tracing desde el sistema de logging:

```typescript
import {
    startRequestTracing,
    updateRequestStage,
    registerToolCall,
    updateToolCallStatus,
    endRequestTracing
} from './utils/logging/index.js';
```

Estas funciones permiten seguir el ciclo de vida de cada request:
- `startRequestTracing(userId)` - Inicia el seguimiento
- `updateRequestStage(requestId, stage)` - Actualiza el estado
- `registerToolCall(...)` - Registra llamadas a herramientas
- `endRequestTracing(requestId)` - Finaliza el seguimiento

### Validación de Respuestas
El sistema incluye un validador de respuestas para corregir errores de OpenAI:

```typescript
import { validateAndCorrectResponse } from './utils/response-validator.js';
```

## 6. Procesamiento de Webhooks - `processWebhook()`

La función principal que maneja los webhooks de Whapi:

### Características Principales
- **Procesamiento de mensajes**: Texto, voz, imágenes
- **Eventos de presencia**: Typing, recording, online/offline
- **Buffering inteligente**: Agrupa mensajes rápidos
- **Rate limiting**: Control de logs para evitar spam
- **Manejo de errores**: Robusto con logging detallado

### Flujo de Procesamiento
1. **Validación**: Verifica que el webhook sea válido
2. **Filtrado**: Filtra tipos de webhook reconocidos
3. **Procesamiento por tipo**: Mensajes vs eventos de presencia
4. **Buffering**: Agrupa mensajes en ventanas de 5 segundos
5. **Envío a OpenAI**: Procesa con `processWithOpenAI()`

## 7. Diagrama de Flujo Simplificado

### Inicialización del Sistema
```
🚀 initializeBot()
    ↓
✅ isServerInitialized = true
    ↓
🧹 setTimeout(recoverOrphanedRuns, 5000)
    ↓
⏰ setInterval cleanupExpiredCaches (10min)
    ↓
⏰ setInterval cleanup user states (1h)
    ↓
⏰ setInterval cleanup buffers (10min)
    ↓
📊 setInterval memory monitoring (5min)
```

### Procesamiento de Webhook
```
📥 processWebhook(body)
    ↓
❓ Validar webhook
    ↓
🔍 Procesar por tipo:
    ├─ 📝 Texto → addToGlobalBuffer()
    ├─ 🎤 Voz → transcribir → addToGlobalBuffer()
    ├─ 📷 Imagen → guardar URL → addToGlobalBuffer()
    └─ ✍️ Typing → mostrar indicador
    ↓
📦 Buffer agrupación (5s)
    ↓
🤖 processWithOpenAI()
```

---

**Nota**: Esta documentación refleja el código real encontrado en `app-unified.ts`. El sistema no contiene la infraestructura avanzada de servidor Express, endpoints complejos, o sistemas avanzados de circuit breakers que se describían anteriormente. El enfoque está en el procesamiento de mensajes y mantenimiento automático del sistema.