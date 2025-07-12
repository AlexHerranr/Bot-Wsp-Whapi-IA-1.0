# ETAPA 2: Optimización Fetch de Historial de Chat (Solo en Threads Nuevos + Cache)

## 📋 Resumen Ejecutivo

**Objetivo**: Optimizar el fetch de historial de chat para que solo ocurra en threads nuevos, implementando un sistema de cache inteligente que evite fetches repetidos y mejore la latencia.

**Problema Original**: El bot descargaba 200 líneas de historial en cada mensaje, causando latencia alta y pérdida de contexto por recreación constante de threads.

**Solución Implementada**: Fetch de historial solo en threads nuevos + cache de 1 hora + cleanup automático.

## 🔧 Cambios Implementados

### 1. Cache de Historial Global
```typescript
// Cache de historial para optimizar fetches
const historyCache = new Map<string, { history: string; timestamp: number }>();
const HISTORY_CACHE_TTL = 60 * 60 * 1000; // 1 hora en ms
```

### 2. Lógica Optimizada en processWithOpenAI
```typescript
// Obtener o crear thread PRIMERO
let threadId = threadPersistence.getThread(shortUserId)?.threadId;
const isNewThread = !threadId;

if (isNewThread) {
    // Crear thread nuevo
    const thread = await openaiClient.beta.threads.create();
    threadId = thread.id;
    threadPersistence.setThread(shortUserId, threadId, chatId, userName);
    
    // Fetch historial SOLO para threads nuevos con cache
    if (config.enableHistoryInject) {
        // Verificar cache primero
        const cachedHistory = historyCache.get(shortUserId);
        const now = Date.now();
        
        if (cachedHistory && (now - cachedHistory.timestamp) < HISTORY_CACHE_TTL) {
            // Cache hit - usar historial cacheado
            historyInjection = cachedHistory.history;
            logInfo('HISTORY_CACHE_HIT', 'Usando historial cacheado', { 
                userId: shortUserId,
                cacheAge: Math.round((now - cachedHistory.timestamp) / 1000 / 60) + 'min',
                historyLines: historyInjection.split('\n').length
            });
        } else {
            // Cache miss - obtener historial fresco
            const historyLimit = config.historyMsgCount; // Límite configurado (100)
            historyInjection = await getChatHistory(chatId, historyLimit);
            
            if (historyInjection) {
                // Cachear el resultado
                historyCache.set(shortUserId, { 
                    history: historyInjection, 
                    timestamp: now 
                });
                
                logSuccess('HISTORY_FETCH', 'Historial fresco obtenido y cacheado', { 
                    userId: shortUserId,
                    historyLimit,
                    historyLines: historyInjection.split('\n').length,
                    cacheSize: historyCache.size
                });
            }
        }
    }
} else {
    // Thread existente - skip fetch de historial
    logInfo('HISTORY_SKIP', 'Skip fetch historial: Thread existe', { 
        userId: shortUserId,
        threadId,
        reason: 'thread_already_exists'
    });
}
```

### 3. Cleanup Automático de Cache
```typescript
// Cleanup automático del cache de historial
// Ejecutar cada 2 horas para evitar crecimiento indefinido
setInterval(() => {
    try {
        const now = Date.now();
        let expiredCount = 0;
        
        for (const [userId, cacheEntry] of historyCache.entries()) {
            if ((now - cacheEntry.timestamp) > HISTORY_CACHE_TTL) {
                historyCache.delete(userId);
                expiredCount++;
            }
        }
        
        if (expiredCount > 0) {
            logInfo('HISTORY_CACHE_CLEANUP', `Cache cleanup: ${expiredCount} entradas expiradas removidas`, {
                remainingEntries: historyCache.size
            });
        }
    } catch (error) {
        logError('HISTORY_CACHE_CLEANUP', 'Error en cleanup del cache', { error: error.message });
    }
}, 2 * 60 * 60 * 1000); // Cada 2 horas
```

### 4. Métricas en Endpoint /health
```typescript
// Información del cache de historial
historyCache: {
    size: historyCache.size,
    ttlMinutes: Math.round(HISTORY_CACHE_TTL / 1000 / 60),
    sampleEntries: Array.from(historyCache.entries()).slice(0, 3).map(([userId, entry]) => ({
        userId: userId.substring(0, 8) + '...',
        ageMinutes: Math.round((Date.now() - entry.timestamp) / 1000 / 60),
        historyLines: entry.history.split('\n').length
    }))
}
```

## 📊 Beneficios Esperados

### 1. Reducción Drástica de Fetches
- **Antes**: Fetch de historial en cada mensaje (200 líneas)
- **Después**: Fetch solo en threads nuevos + cache de 1 hora
- **Reducción estimada**: 80-90% menos fetches de historial

### 2. Mejor Latencia
- **Threads existentes**: Sin fetch de historial → respuesta más rápida
- **Cache hits**: Reutilización inmediata → latencia mínima
- **Threads nuevos**: Fetch optimizado (100 líneas vs 200)

### 3. Gestión de Memoria Inteligente
- **TTL de 1 hora**: Balance entre frescura y rendimiento
- **Cleanup automático**: Evita crecimiento indefinido
- **Monitoreo completo**: Métricas en tiempo real

## 🔍 Logs Esperados

### Thread Nuevo (Fetch + Cache)
```
[INFO] THREAD_CREATED - Thread creado
[SUCCESS] HISTORY_FETCH - Historial fresco obtenido y cacheado
[SUCCESS] CONTEXT_INJECT - Contexto inyectado
```

### Thread Existente (Skip Fetch)
```
[INFO] THREAD_REUSE - Thread reutilizado
[INFO] HISTORY_SKIP - Skip fetch historial: Thread existe
```

### Cache Hit (Reutilización)
```
[INFO] HISTORY_CACHE_HIT - Usando historial cacheado
[SUCCESS] CONTEXT_INJECT - Contexto inyectado
```

### Cleanup Automático
```
[INFO] HISTORY_CACHE_CLEANUP - Cache cleanup: X entradas expiradas removidas
```

## 🧪 Testing y Validación

### Script de Prueba
```bash
node scripts/test-history-cache.js
```

### Verificaciones Manuales
1. **Endpoint /health**: Verificar métricas de cache
2. **Logs**: Buscar patrones de HISTORY_FETCH vs HISTORY_SKIP
3. **Latencia**: Medir tiempo de respuesta en conversaciones activas
4. **Memoria**: Monitorear crecimiento del cache

### Métricas Clave
- **Cache hit ratio**: % de veces que se usa cache vs fetch
- **Cache size**: Número de entradas activas
- **Cleanup frequency**: Entradas removidas por cleanup
- **Response time**: Latencia antes vs después

## ⚙️ Configuración

### Variables de Entorno
```bash
# Límite de mensajes de historial (default: 100)
HISTORY_MSG_COUNT=100

# TTL del cache en minutos (default: 60)
HISTORY_CACHE_TTL_MINUTES=60

# Frecuencia de cleanup en horas (default: 2)
HISTORY_CACHE_CLEANUP_HOURS=2
```

### Configuración en environment.ts
```typescript
historyMsgCount: parseInt(process.env.HISTORY_MSG_COUNT || '100'),
historyCacheTtl: parseInt(process.env.HISTORY_CACHE_TTL_MINUTES || '60') * 60 * 1000,
historyCacheCleanupHours: parseInt(process.env.HISTORY_CACHE_CLEANUP_HOURS || '2'),
```

## 🚀 Próximos Pasos

### Etapa 3: Optimización de Sincronización de Etiquetas
- Sincronización condicional solo si thread es viejo
- Cache de etiquetas similar al historial
- Logging detallado para monitoreo

### Etapa 4: Buffer de Mensajes Optimizado
- Timeout configurable por entorno
- Límite de mensajes anti-spam
- Agrupación inteligente

## 📈 Monitoreo en Producción

### Logs a Observar
```bash
# Buscar patrones de optimización
grep "HISTORY_FETCH\|HISTORY_SKIP\|HISTORY_CACHE_HIT" logs/

# Verificar cache hits
grep "HISTORY_CACHE_HIT" logs/ | wc -l

# Monitorear cleanup
grep "HISTORY_CACHE_CLEANUP" logs/
```

### Métricas del Endpoint
```bash
# Verificar estado del cache
curl http://localhost:3000/health | jq '.historyCache'
```

## ✅ Criterios de Éxito

1. **Reducción de Fetches**: Al menos 80% menos HISTORY_FETCH en logs
2. **Cache Hits**: Al menos 60% de HISTORY_CACHE_HIT en conversaciones activas
3. **Latencia**: Mejora de al menos 30% en tiempo de respuesta
4. **Memoria**: Cache no excede 100 entradas en uso normal
5. **Estabilidad**: Sin errores relacionados con el cache

## 🔧 Troubleshooting

### Problemas Comunes
1. **Cache no funciona**: Verificar TTL y timestamps
2. **Memoria alta**: Revisar cleanup automático
3. **Fetches excesivos**: Verificar lógica de threads nuevos
4. **Logs confusos**: Validar logging de cache hits/misses

### Debug Commands
```bash
# Verificar cache en memoria
curl http://localhost:3000/health | jq '.historyCache'

# Buscar logs de cache
grep -E "(HISTORY_CACHE_HIT|HISTORY_FETCH|HISTORY_SKIP)" logs/ | tail -20

# Verificar cleanup
grep "HISTORY_CACHE_CLEANUP" logs/ | tail -5
```

---

**Estado**: ✅ Implementado y Documentado  
**Fecha**: 2025-01-XX  
**Autor**: Alexander - TeAlquilamos  
**Próxima Etapa**: Etapa 3 - Optimización de Sincronización de Etiquetas 