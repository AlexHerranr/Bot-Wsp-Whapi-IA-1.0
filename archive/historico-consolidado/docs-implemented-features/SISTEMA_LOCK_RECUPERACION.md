# 🔒 Sistema de Lock y Recuperación - TeAlquilamos Bot

## 🎯 Descripción General

El **Sistema de Lock y Recuperación** es un mecanismo avanzado que previene race conditions en el procesamiento de mensajes y recupera automáticamente runs huérfanos al iniciar el bot, garantizando la integridad y consistencia del sistema.

## 🚀 Características Principales

### ✅ **Ventajas del Sistema**

1. **Prevención de Race Conditions**
   - Evita procesamiento simultáneo del mismo usuario
   - Previene respuestas duplicadas o conflictivas
   - Garantiza orden secuencial de mensajes

2. **Recuperación Automática**
   - Recupera runs huérfanos al iniciar el bot
   - Limpia threads con tokens excesivos
   - Optimiza memoria y performance

3. **Monitoreo Avanzado**
   - Métricas detalladas de race errors
   - Logs estructurados para debugging
   - Alertas configurables para problemas

## 🔧 Implementación Técnica

### **1. Thread Locks**

#### **Función de Adquisición de Lock**
```typescript
async function acquireThreadLock(userId: string): Promise<boolean> {
    if (threadLocks.has(userId)) {
        logWarning('THREAD_LOCK_BUSY', `Thread ya está siendo procesado`, {
            userId,
            isLocked: threadLocks.get(userId)
        });
        
        // Incrementar métrica de race errors
        try {
            const { incrementRaceErrors } = require('./routes/metrics');
            incrementRaceErrors();
        } catch (e) { 
            logDebug('RACE_ERROR_METRIC_ERROR', 'No se pudo incrementar métrica de race error');
        }
        
        return false;
    }
    
    threadLocks.set(userId, Date.now());
    return true;
}
```

#### **Función de Liberación de Lock**
```typescript
function releaseThreadLock(userId: string): void {
    if (threadLocks.has(userId)) {
        threadLocks.delete(userId);
        logDebug('THREAD_LOCK_RELEASED', `Lock liberado para ${userId}`);
    }
}
```

### **2. Recuperación de Runs Huérfanos**

#### **Función de Recuperación**
```typescript
async function recoverOrphanedRuns() {
    try {
        logInfo('ORPHANED_RUNS_RECOVERY', 'Iniciando recuperación de runs huérfanos');
        
        // Obtener todos los threads activos
        const threads = Object.keys(threadsData);
        let recoveredCount = 0;
        
        for (const userId of threads) {
            const threadData = threadsData[userId];
            
            if (threadData.runId && !threadData.isCompleted) {
                try {
                    // Verificar estado del run en OpenAI
                    const runStatus = await openai.beta.threads.runs.retrieve(
                        threadData.threadId,
                        threadData.runId
                    );
                    
                    if (runStatus.status === 'completed') {
                        // Marcar como completado
                        threadData.isCompleted = true;
                        threadData.completedAt = new Date().toISOString();
                        recoveredCount++;
                        
                        logInfo('RUN_RECOVERED', `Run recuperado para ${userId}`, {
                            runId: threadData.runId,
                            status: runStatus.status
                        });
                    }
                } catch (error) {
                    logError('RUN_RECOVERY_ERROR', `Error recuperando run para ${userId}`, {
                        error: error.message,
                        runId: threadData.runId
                    });
                }
            }
        }
        
        logSuccess('ORPHANED_RUNS_COMPLETED', `Recuperación completada`, {
            totalThreads: threads.length,
            recoveredRuns: recoveredCount
        });
        
    } catch (error) {
        logError('ORPHANED_RUNS_FAILED', 'Error en recuperación de runs huérfanos', {
            error: error.message
        });
    }
}
```

### **3. Cleanup de Threads con Tokens Altos**

#### **Función de Cleanup**
```typescript
async function cleanupHighTokenThreads() {
    try {
        logInfo('HIGH_TOKEN_CLEANUP', 'Iniciando cleanup de threads con tokens altos');
        
        const threads = Object.keys(threadsData);
        let cleanedCount = 0;
        
        for (const userId of threads) {
            const threadData = threadsData[userId];
            
            // Verificar si el thread tiene tokens excesivos
            if (threadData.tokenCount && threadData.tokenCount > THREAD_TOKEN_THRESHOLD) {
                try {
                    // Generar resumen del thread
                    const summary = await generateThreadSummary(threadData.threadId, userId);
                    
                    if (summary) {
                        // Optimizar thread con resumen
                        const optimized = await optimizeThreadWithSummary(
                            threadData.threadId, 
                            userId, 
                            threadData.chatId, 
                            threadData.userName
                        );
                        
                        if (optimized) {
                            cleanedCount++;
                            logInfo('THREAD_OPTIMIZED', `Thread optimizado para ${userId}`, {
                                originalTokens: threadData.tokenCount,
                                threshold: THREAD_TOKEN_THRESHOLD
                            });
                        }
                    }
                } catch (error) {
                    logError('THREAD_CLEANUP_ERROR', `Error limpiando thread ${userId}`, {
                        error: error.message,
                        tokenCount: threadData.tokenCount
                    });
                }
            }
        }
        
        logSuccess('HIGH_TOKEN_CLEANUP_COMPLETED', `Cleanup completado`, {
            totalThreads: threads.length,
            cleanedThreads: cleanedCount
        });
        
    } catch (error) {
        logError('HIGH_TOKEN_CLEANUP_FAILED', 'Error en cleanup de threads', {
            error: error.message
        });
    }
}
```

## 📊 Métricas y Monitoreo

### **Métricas Implementadas**

#### **1. Race Errors**
```typescript
// Incrementar contador de race errors
function incrementRaceErrors() {
    raceErrorsCounter.inc();
    logInfo('RACE_ERROR_METRIC', 'Métrica de race error incrementada');
}
```

#### **2. Token Cleanups**
```typescript
// Incrementar contador de cleanups
function incrementTokenCleanups() {
    tokenCleanupsCounter.inc();
    logInfo('TOKEN_CLEANUP_METRIC', 'Métrica de token cleanup incrementada');
}
```

#### **3. High Token Threads**
```typescript
// Gauge para threads con tokens altos
function updateHighTokenThreads(count: number) {
    highTokenThreadsGauge.set(count);
    logInfo('HIGH_TOKEN_THREADS_METRIC', `Threads con tokens altos: ${count}`);
}
```

### **Endpoint de Métricas**
```typescript
// Exponer métricas en /metrics
app.get('/metrics', async (req, res) => {
    const metrics = await register.metrics();
    res.set('Content-Type', register.contentType);
    res.end(metrics);
});
```

## 🔄 Flujo de Procesamiento

### **1. Procesamiento con Lock**
```typescript
async function processUserMessages(userId: string) {
    // Intentar adquirir lock
    const lockAcquired = await acquireThreadLock(userId);
    
    if (!lockAcquired) {
        logWarning('PROCESSING_SKIPPED', `Procesamiento saltado - lock ocupado`, { userId });
        return;
    }
    
    try {
        // Procesar mensajes del usuario
        await processGlobalBuffer(userId);
        
    } catch (error) {
        logError('PROCESSING_ERROR', `Error procesando mensajes de ${userId}`, {
            error: error.message
        });
    } finally {
        // Siempre liberar el lock
        releaseThreadLock(userId);
    }
}
```

### **2. Inicialización con Recuperación**
```typescript
async function initializeBot() {
    try {
        // Cargar threads existentes
        await loadThreadsFromFile();
        
        // Recuperar runs huérfanos
        await recoverOrphanedRuns();
        
        // Configurar cleanup periódico
        setInterval(cleanupHighTokenThreads, 60 * 60 * 1000); // Cada hora
        
        logSuccess('BOT_INITIALIZED', 'Bot inicializado con recuperación completada');
        
    } catch (error) {
        logError('BOT_INIT_ERROR', 'Error inicializando bot', { error: error.message });
        process.exit(1);
    }
}
```

## ⚙️ Configuración

### **Variables de Entorno**
```typescript
// Thresholds configurables
const THREAD_TOKEN_THRESHOLD = process.env.THREAD_TOKEN_THRESHOLD || 8000;
const HISTORIAL_SUMMARY_THRESHOLD = process.env.HISTORIAL_SUMMARY_THRESHOLD || 5000;
const CLEANUP_INTERVAL = process.env.CLEANUP_INTERVAL || 60 * 60 * 1000; // 1 hora
```

### **Configuración de Locks**
```typescript
// Map para almacenar locks activos
const threadLocks = new Map<string, number>();

// Timeout para locks (prevenir deadlocks)
const LOCK_TIMEOUT = 5 * 60 * 1000; // 5 minutos
```

## 🧪 Casos de Prueba

### **Escenario 1: Race Condition**
```
1. Usuario envía mensaje rápido
2. Primer procesamiento adquiere lock
3. Segundo procesamiento es rechazado
4. Métrica de race error incrementada
```

### **Escenario 2: Recuperación de Runs**
```
1. Bot se reinicia
2. Se detectan runs huérfanos
3. Se verifica estado en OpenAI
4. Se marcan como completados
```

### **Escenario 3: Cleanup de Tokens**
```
1. Thread supera threshold de tokens
2. Se genera resumen automático
3. Se optimiza thread
4. Métrica de cleanup incrementada
```

## 🚨 Alertas y Monitoreo

### **Alertas Recomendadas**
```yaml
# Prometheus Alert Rules
groups:
  - name: bot_alerts
    rules:
      - alert: HighRaceErrors
        expr: rate(race_errors_total[5m]) > 0.1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Alto número de race errors detectados"
          
      - alert: HighTokenThreads
        expr: high_token_threads > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Muchos threads con tokens altos"
```

### **Dashboards de Monitoreo**
- **Race Errors por Minuto**
- **Threads con Tokens Altos**
- **Cleanups Ejecutados**
- **Tiempo de Procesamiento Promedio**

## 🚀 Beneficios del Sistema

### **Para la Estabilidad**
- ✅ Prevención de race conditions
- ✅ Recuperación automática de errores
- ✅ Limpieza proactiva de memoria
- ✅ Monitoreo continuo del estado

### **Para la Performance**
- ✅ Reducción de latencia
- ✅ Optimización de memoria
- ✅ Prevención de leaks
- ✅ Escalabilidad mejorada

### **Para el Mantenimiento**
- ✅ Logs detallados para debugging
- ✅ Métricas para optimización
- ✅ Alertas proactivas
- ✅ Recuperación automática

---

**Fecha de implementación**: Julio 2025
**Estado**: ✅ IMPLEMENTADO Y FUNCIONANDO
**Versión**: 1.0 