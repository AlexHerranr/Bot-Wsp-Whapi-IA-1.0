# 🔒 Sistema de Lock y Recuperación Completo - TeAlquilamos Bot

## 🎯 Descripción General

El **Sistema de Lock y Recuperación** es un mecanismo híbrido que combina la simplicidad del proyecto antiguo con la robustez del sistema actual. Implementa locks por usuario con sistema de colas, timeout automático y recuperación de runs huérfanos al iniciar el bot.

## 🚀 Características Principales

### ✅ **Ventajas del Sistema Híbrido**
1*Locks por Usuario** (no por mensaje)
   - Más simple de entender y debuggear
   - Menos overhead de memoria
   - Evita procesamiento duplicado por usuario

2. **Sistema de Colas**
   - Procesamiento ordenado de mensajes
   - Evita pérdida de mensajes
   - Mejor experiencia del usuario

3Timeout Automático**
   - 15egundos máximo por lock
   - Liberación automática si el sistema se cuelga
   - Recuperación rápida de errores
4Recuperación Automática**
   - Recupera runs huérfanos al iniciar el bot
   - Limpia threads con tokens excesivos
   - Optimiza memoria y performance
5 **Monitoreo Avanzado**
   - Métricas detalladas de race errors
   - Logs estructurados para debugging
   - Alertas configurables para problemas

## 🔧 Implementación Técnica

### **1. Thread Locks**

#### **Función de Adquisición de Lock**
```typescript
async function acquireThreadLock(userId: string): Promise<boolean>[object Object]   if (threadLocks.has(userId)) {
        logWarning('THREAD_LOCK_BUSY, `Thread ya está siendo procesado`, {
            userId,
            isLocked: threadLocks.get(userId)
        });
        
        // Incrementar métrica de race errors
        try {
            const { incrementRaceErrors } = require('./routes/metrics');
            incrementRaceErrors();
        } catch (e) [object Object]          logDebug(RACE_ERROR_METRIC_ERROR', 'No se pudo incrementar métrica de race error');
        }
        
        return false;
    }
    
    threadLocks.set(userId, Date.now());
    return true;
}
```

#### **Función de Liberación de Lock**
```typescript
function releaseThreadLock(userId: string): void[object Object]   if (threadLocks.has(userId))[object Object]       threadLocks.delete(userId);
        logDebug('THREAD_LOCK_RELEASED', `Lock liberado para ${userId}`);
    }
}
```

### **2. Estructura de Datos**

```typescript
interface LockInfo {
    timestamp: number;    // Cuándo se adquirió el lock
    timeout: number;      // Tiempo máximo (15 segundos)
}

interface QueueItem {
    messageId: string;           // ID único del mensaje
    messageData: any;           // Datos del mensaje
    processFunction: () => Promise<void>; // Función a ejecutar
}
```

### **3o de Procesamiento**

```typescript
// 1. Usuario envía mensaje
addToGlobalBuffer(userId, messageText, chatId, userName);

//2Se agrega a la cola
simpleLockManager.addToQueue(userId, messageId, buffer, processFunction);

// 3. Se procesa la cola si no hay lock activo
if (!simpleLockManager.hasActiveLock(userId)) [object Object]  await simpleLockManager.processQueue(userId);
}

// 4. El sistema procesa mensajes en orden
while (queue.length > 0) [object Object]const item = queue.shift()!;
    await item.processFunction(); // Procesa el mensaje
    // Lock se libera automáticamente
}
```

### **4cuperación de Runs Huérfanos**

#### **Función de Recuperación**
```typescript
async function recoverOrphanedRuns() {
    try[object Object]
        logInfo(ORPHANED_RUNS_RECOVERY', Iniciando recuperación de runs huérfanos');
        
        // Obtener todos los threads activos
        const threads = Object.keys(threadsData);
        let recoveredCount = 0;
        
        for (const userId of threads) {
            const threadData = threadsData[userId];
            
            if (threadData.runId && !threadData.isCompleted)[object Object]               try {
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
                        
                        logInfo(RUN_RECOVERED, `Run recuperado para ${userId}`, {
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
        
    } catch (error) [object Object]        logError('ORPHANED_RUNS_FAILED',Error en recuperación de runs huérfanos', {
            error: error.message
        });
    }
}
```

### **5. Cleanup de Threads con Tokens Altos**

```typescript
async function cleanupHighTokenThreads() {
    try[object Object]
        logInfo('HIGH_TOKEN_CLEANUP', Iniciando cleanup de threads con tokens altos');
        
        const threads = Object.keys(threadsData);
        let cleanedCount = 0;
        
        for (const userId of threads) {
            const threadData = threadsData[userId];
            
            // Verificar si el thread tiene tokens excesivos
            if (threadData.tokenCount && threadData.tokenCount > THREAD_TOKEN_THRESHOLD)[object Object]               try {
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
        
    } catch (error) [object Object]        logError('HIGH_TOKEN_CLEANUP_FAILED',Error en cleanup de threads', {
            error: error.message
        });
    }
}
```

## 📊 Métricas y Monitoreo

### **Métricas Implementadas**

#### **1. Race Errors**
```typescript
function incrementRaceErrors() {
    raceErrorsCounter.inc();
    logInfo(RACE_ERROR_METRIC', 'Métrica de race error incrementada);
}
```

#### **2. Token Cleanups**
```typescript
function incrementTokenCleanups() {
    tokenCleanupsCounter.inc();
    logInfo(TOKEN_CLEANUP_METRIC',Métrica de token cleanup incrementada);
}
```

#### **3. High Token Threads**
```typescript
function updateHighTokenThreads(count: number) {
    highTokenThreadsGauge.set(count);
    logInfo(HIGH_TOKEN_THREADS_METRIC', `Threads con tokens altos: ${count}`);
}
```

### **Endpoints de Monitoreo**

#### **GET /locks**
```json[object Object]system": SimpleLockManager",
    timestamp: 2025015030,
  environment:development,stats": [object Object]      activeLocks": 2       activeQueues":1     totalUsers": 3
    },
  configuration:[object Object]   timeoutSeconds":15
       lockType": "user-based",
     queueEnabled: true,
    autoRelease": true
    }
}
```

#### **POST /locks/clear** (solo desarrollo)
```json
[object Object]message": Todos los locks y colas han sido limpiados",
    timestamp: 20250115T10:3000
}
```

#### **GET /metrics**
```typescript
app.get('/metrics, async (req, res) => {
    const metrics = await register.metrics();
    res.set('Content-Type', register.contentType);
    res.end(metrics);
});
```

## 🔄 Casos de Uso

### **Caso1 Mensaje Normal**
```
Usuario envía:¿Disponibilidad 15?"
├── Lock adquirido ✅
├── Mensaje procesado ✅
├── Respuesta enviada ✅
└── Lock liberado ✅
```

### **Caso2 Mensaje Duplicado**
```
Usuario envía:¿Disponibilidad 15enero?" (duplicado)
├── Lock ya existe ⏳
├── Mensaje agregado a cola 📋
├── Espera a que termine el anterior ⏳
└── Se procesa automáticamente ✅
```

### **Caso 3Sistema Colgado**
```
Usuario envía:¿Disponibilidad 15?"
├── Lock adquirido ✅
├── Sistema se cuelga ❌
├── Timeout de15egundos ⏰
├── Lock liberado automáticamente 🔓
└── Mensaje puede procesarse nuevamente ✅
```

### **Caso4Múltiples Mensajes**
```
Usuario envía:Hola→ ¿Disponibilidad?" → Para 2 personas"
├── Mensaje 1 adquirido, procesado, liberado ✅
├── Mensaje 2: Agregado a cola, procesado automáticamente ✅
└── Mensaje 3: Agregado a cola, procesado automáticamente ✅
```

### **Caso 5Recuperación al Inicio**
```
Bot se reinicia
├── Recuperación de runs huérfanos 🔄
├── Cleanup de threads con tokens altos 🧹
├── Optimización de memoria 💾
└── Sistema listo para procesar ✅
```

## ⚙️ Configuración

### **Variables de Configuración**
```typescript
const LOCK_TIMEOUT = 15 * 100015 segundos
const BUFFER_WINDOW_MS = 300// 3segundos para agrupar
const TYPING_EXTENSION_MS = 30/ 3 segundos extra por typing
const THREAD_TOKEN_THRESHOLD = 8000/ Límite de tokens por thread
```

### **Logs del Sistema**
```
🔒 Lock adquirido para usuario123456789📋 Mensaje msg_123456abc agregado a cola de usuario 123456789(2 en cola)
🔄 Procesando cola de usuario1234567892ensajes)
📝 Procesando mensaje msg_123456abc de usuario 123456789
✅ Mensaje msg_123456abc procesado exitosamente
🔓 Lock liberado para usuario123456789🧹 Cola de usuario 123456789impiada
🔄 Recuperando runs huérfanos...
🧹 Limpiando threads con tokens altos...
```

## 🎯 Beneficios del Sistema

### **Para el Usuario**
- ✅ No recibe respuestas duplicadas
- ✅ Mensajes se procesan en orden
- ✅ Sistema se recupera rápido de errores
- ✅ Experiencia fluida y natural

### **Para el Desarrollador**
- ✅ Código más simple y fácil de entender
- ✅ Menos bugs por race conditions
- ✅ Fácil debugging y monitoreo
- ✅ Sistema auto-recuperable

### **Para la Infraestructura**
- ✅ Menos llamadas duplicadas a APIs
- ✅ Menor uso de memoria
- ✅ Mejor rendimiento general
- ✅ Más estable en producción

## 🔄 Migración desde Sistemas Anteriores

### **Cambios Principales**
1. **Eliminación de locks por mensaje** → Locks por usuario
2. **Sistema de colas integrado** → Procesamiento ordenado
3Timeout automático** → Recuperación de errores
4. **Liberación automática** → Sin locks huérfanos5 **Recuperación al inicio** → Runs huérfanos y cleanup automático

### **Compatibilidad**
- ✅ Compatible con sistema de buffering existente
- ✅ Compatible con sistema de typing
- ✅ Compatible con sistema de historial
- ✅ Compatible con todas las funciones existentes

## 📋 Monitoreo y Debugging

### **Métricas Importantes**
- `activeLocks`: Usuarios con locks activos
- `activeQueues`: Usuarios con mensajes en cola
- `totalUsers`: Total de usuarios activos
- `raceErrors`: Errores de race conditions
- `tokenCleanups`: Cleanups de threads realizados

### **Logs Clave**
- `🔒 Lock adquirido`: Nuevo lock activo
- `📋 Mensaje agregado a cola`: Mensaje en espera
- `🔄 Procesando cola`: Inicio de procesamiento
- `✅ Mensaje procesado`: Procesamiento exitoso
- `🔓 Lock liberado`: Lock liberado
- `🔄 Recuperando runs`: Recuperación de runs huérfanos
- `🧹 Limpiando threads`: Cleanup de threads 