# 7. Setup, Servidor, Monitoreo y Sistemas Auxiliares

> **Introducción**: Esta sección describe la configuración del servidor Express con endpoints específicos, el manejo de signals para shutdown graceful, la inicialización del bot con intervals para cleanups y recovery, el dashboard para logs en tiempo real via `botDashboard.addLog(logMsg)`, el sistema de tracing para requests (e.g., `startRequestTracing`, `updateRequestStage`), el logging con `terminalLog` y métricas via Prometheus (e.g., `incrementFallbacks`, `setTokensUsed`). Representa la capa de infraestructura que asegura la operatividad, monitoreo y estabilidad del bot, facilitando el debugging y la optimización.

## Ubicación en el Código
* **Setup y Configuración**: `setupEndpoints()`, `setupSignalHandlers()` (líneas ~2000-2500)
* **Servidor Express**: Creación de app, middleware, rutas (~300-500 y ~2500-3000)
* **Inicialización**: `initializeBot()`, `recoverOrphanedRuns()` (~3500-3700)
* **Main y Orquestación**: `main()` (~3700+)

## 1. Configuración del Servidor Express

### Creación de la Aplicación
El servidor Express se configura con middleware para manejar payloads grandes y exposición de métricas via /metrics con funciones como incrementFallbacks:

```typescript
const app = express();
app.use(express.json({ limit: '50mb' })); // línea ~300
app.use('/metrics', metricsRouter); // Métricas (incrementFallbacks, setTokensUsed, setLatency, incrementMessages)
```

* **limit: '50mb'**: Soporta mensajes con media grande (e.g., imágenes base64).
* **Variables**: `let server: http.Server; let isServerInitialized = false;`

## 2. Endpoints y Rutas del Sistema

### Tabla Completa de Endpoints
| Ruta | Método | Propósito | Observaciones |
|------|--------|-----------|---------------|
| `/health` | GET | Status general con stats (buffers, threads) | Usado para healthchecks, responde incluso sin inicialización completa |
| `/hook` | POST | Recepción de webhooks de Whapi | Respuesta 200 inmediata, procesamiento async; **filtra y procesa `messages` y `presences`**; rate limiting en logs con `webhookCounts` Map |
| `/` | GET | Info general del bot (versión, environment, status, webhookUrl) | Responde con stats de threads |
| `/locks` | GET | Estado de locks (activeLocks, activeQueues) | Monitoreo del sistema de locks |
| `/locks/clear` | POST | Limpia todos los locks | Solo en desarrollo (403 en producción) |
| `/audio/:filename` | GET | Sirve audio temporal | Validación de filename (/^voice_\d+_\d+\.(mp3|ogg)$/); Content-Type dinámico; verifica existencia con fs.access; Cache-Control no-cache |

* **Dashboard Routes**: Configuradas via botDashboard.setupRoutes(app): /dashboard (UI principal), /dashboard/logs (históricos), /dashboard/stats (estadísticas), /dashboard/api/logs (WebSocket)

### Detalle de Endpoints Clave

#### `/health`
Responde con status y stats incluso si no inicializado:
- Incluye: status, timestamp, environment, initialized, buffers (activeProcessing), threads (via threadPersistence.getStats())

#### `/hook`
- Respuesta inmediata para evitar timeouts.
- Procesamiento en background con `processWebhook`.
- Rate limiting en logs con webhookCounts Map (línea ~150, y en processWebhook).

#### `/audio/:filename`
- Validación estricta de filename.
- Content-Type: 'audio/mpeg' (.mp3), 'audio/ogg; codecs=opus' (.ogg).
- Usa fs.access para existencia.
- Cache-Control: 'no-cache, no-store, must-revalidate'.

## 3. Signal Handlers y Shutdown Graceful

### Implementación
```typescript
function setupSignalHandlers() {
    const shutdown = (signal: string) => {
        // 🔧 ELIMINADO: Log de shutdown - no mostrar en terminal
        if (appConfig) {
            logInfo('SHUTDOWN', `Señal ${signal} recibida`, { environment: appConfig.environment });
        }
        
        // Se eliminan los bucles y timers aquí, ya que el server.close() los manejará
        
        if (server) {
            server.close(() => {
                // 🔧 ELIMINADO: Log de servidor cerrado - no mostrar en terminal
                if (appConfig) {
                    logSuccess('SHUTDOWN', 'Servidor cerrado exitosamente', { environment: appConfig.environment });
                }
                process.exit(0);
            });
        } else {
            process.exit(0);
        }

        setTimeout(() => {
            logWarning('SHUTDOWN', 'Cierre forzado por timeout', { environment: appConfig ? appConfig.environment : 'unknown' });
            process.exit(1);
        }, 5000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}
```

* **Secuencia**: Limpia timers de globalMessageBuffers, cierra server, timeout de 5s.
* **Error Handlers**: `uncaughtException` y `unhandledRejection` loggean y salen con delay de 2s.

## 4. Inicialización del Bot y Recovery

### Proceso de Inicialización
```typescript
async function initializeBot() {
    isServerInitialized = true;
    terminalLog.startup();
    
    // Recuperación de runs huérfanos con timeout de 10s para no bloquear
    setTimeout(async () => {
        try {
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Recovery timeout')), 10000));
            await Promise.race([recoverOrphanedRuns(), timeoutPromise]);
        } catch (error) {
            logError('ORPHANED_RUNS_RECOVERY_ERROR', 'Error recuperando runs huérfanos', { error: error.message });
        }
    }, 5000);
    
    // Interval 1: Cleanup de Caches de Inyección (cada 10 min)
    setInterval(() => {
        cleanupExpiredCaches();
    }, 10 * 60 * 1000);
    
    // Interval 2: Cleanup de Estados de Usuario y ChatInfo (cada hora)
    setInterval(() => {
        const now = Date.now();
        for (const [userId, state] of globalUserStates.entries()) {
            const lastActivity = Math.max(state.lastMessageTimestamp, state.lastTypingTimestamp);
            if ((now - lastActivity) > 24 * 60 * 60 * 1000) { // >24h inactivo
                globalUserStates.delete(userId);
            }
        }
        for (const [userId, cached] of chatInfoCache.entries()) {
            if ((now - cached.timestamp) > 60 * 60 * 1000) { // >1h de antigüedad
                chatInfoCache.delete(userId);
            }
        }
    }, 60 * 60 * 1000);
    
    // Interval 3: Cleanup del Buffer Global (cada 10 min)
    setInterval(() => {
        const now = Date.now();
        for (const [userId, buffer] of globalMessageBuffers.entries()) {
            if ((now - buffer.lastActivity) > 15 * 60 * 1000) { // >15min inactivo
                if (buffer.timer) clearTimeout(buffer.timer);
                globalMessageBuffers.delete(userId);
            }
        }
    }, 10 * 60 * 1000);
    
    // Interval 4: Logging de Memoria (cada 5 min)
    setInterval(() => {
        const memUsage = process.memoryUsage();
        const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
        const heapUsagePercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        if (heapUsedMB > 300) { logAlert('HIGH_MEMORY_USAGE', '...'); }
        if (heapUsagePercentage > 95) { logFatal('MEMORY_LEAK_DETECTED', '...'); }
    }, 5 * 60 * 1000);
}
```

### Recovery de Runs Huérfanos
```typescript
async function recoverOrphanedRuns(): Promise<void> {
    const threads = threadPersistence.getAllThreadsInfo();
    for (const [userId, threadInfo] of Object.entries(threads)) {
        const runs = await openaiClient.beta.threads.runs.list(threadInfo.threadId, { limit: 10 });
        for (const run of runs.data) {
            if (['queued', 'in_progress', 'requires_action'].includes(run.status)) {
                await openaiClient.beta.threads.runs.cancel(threadInfo.threadId, run.id);
            }
        }
    }
}
```

## 5. Sistemas Auxiliares

### Sistema de Logging (terminalLog)
Objeto con ~20 métodos (línea ~150-300) para logs limpios en terminal y dashboard:
- Ejemplos: message, typing, response, error, openaiError, etc.
- Integra `botDashboard.addLog(logMsg)` en algunos (e.g., message, response).

*Nota: Métodos como `typing`, `error`, y `functionStart` intencionalmente no llaman a `botDashboard.addLog()` para mantener el dashboard enfocado en el flujo de la conversación (mensajes y respuestas) y reducir el ruido visual.*

### Sistema de Tracing
Funciones importadas (línea ~50-100) para tracking de requests:
- `startRequestTracing(userId)`: Inicia trace, retorna requestId.
- `updateRequestStage(requestId, stage)`: Actualiza etapas (e.g., 'init', 'processing').
- `registerToolCall(requestId, toolCallId, name, status)`: Registra tool calls.
- `updateToolCallStatus(requestId, toolCallId, status)`: Actualiza status de tools.
- `endRequestTracing(requestId)`: Finaliza trace con summary.

### Métricas
Funciones importadas (línea ~120): `incrementFallbacks()`, `setTokensUsed(tokens)`, `setLatency(ms)`, `incrementMessages()` - Usadas en métricas Prometheus via /metrics.

### Dashboard (botDashboard)
- `setupRoutes(app)` (línea ~2500): Configura rutas para UI, logs, stats, WebSocket.
- `addLog(msg)`: Agrega logs a dashboard en tiempo real.

## 6. Función Main y Orquestación

### Secuencia Exacta de Main
1. Logs iniciales (versión Node, memoria, entorno).
2. `loadAndValidateConfig()` → appConfig.
3. `logEnvironmentConfig()`.
4. new OpenAI client.
5. `setupEndpoints()`.
6. `setupWebhooks()`.
7. createServer, listen.
8. `initializeBot()`.
9. `setupSignalHandlers()`.
10. Catch con servidor mínimo en puerto 8080.

## 7. Análisis: Problemas Conocidos y Mitigaciones
| Problema | Riesgo | Mitigación |
|----------|--------|------------|
| Memory leaks en intervals | Acumulación si cleanups fallan | Intervals de cleanup (10min-1h); logs de memoria (5min) con alertas (>300MB o >95%) |
| Runs huérfanos facturando | Costos extra post-restart | `recoverOrphanedRuns()` al boot (5s delay), cancela activos |
| Shutdown incompleto | Timers pendientes | Limpia timers de globalMessageBuffers en signal handlers |
| Webhook timeouts | Whapi reintentos fallidos | Respuesta 200 inmediata, procesamiento async |

## 8. Diagramas de Flujo

### Sincronización de Mensajes Manuales (from_me: true)
```
Webhook → from_me: true & !botSentMessages.has(id)
    ↓
Buffer en globalMessageBuffers (key=chatId)
    ↓
Timer BUFFER_WINDOW_MS (5s) → Agrupa mensajes
    ↓
Procesar:
    1. messages.create(role: 'user', content: '[Mensaje manual de agentName]')
    2. messages.create(role: 'assistant', content: combinedMessage)
    ↓
setThread() → actualiza metadata
    ↓
Log MANUAL_SYNC_SUCCESS
```

### Ciclo de Procesamiento con Function Calling
```
processCombinedMessage → addToQueue(processFunction)
    ↓
isRunActive() → cleanupOldRuns
    ↓
processWithOpenAI:
    ↓ sendTyping/RecordingIndicator
    ↓ Crear/obtener thread
    ↓ subscribeToPresence
    ↓ getRelevantContext si necesario
    ↓ Adjuntar pendingImages si multimodal
    ↓ threads.messages.create (user, content)
    ↓ runs.create
    ↓ Polling (1s, max 30, backoff race conditions)
    ↓ Si requires_action:
        ↓ executeFunction (registerToolCall, updateToolCallStatus)
        ↓ submitToolOutputs
        ↓ Polling post-tool (500ms-5s backoff, max 10)
    ↓ validateAndCorrectResponse → retry si needsRetry (userRetryState)
    ↓ Si context_length_exceeded → nuevo thread
    ↓
endRequestTracing + métricas
```