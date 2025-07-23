# Plan de Estabilización del Bot WhatsApp V2

## Análisis del Código Actual

### ✅ Lo que ya funciona bien:
1. **Sistema de timeouts**: Ya están cancelando correctamente los timeouts anteriores
2. **Agrupación de mensajes**: Funciona correctamente con 8 segundos de espera
3. **Manejo de threads**: La persistencia y reutilización de threads funciona

### ❌ Problemas reales identificados:

#### 1. Serialización incorrecta de etiquetas
En `getConversationalContext()` línea 354:
```typescript
context += `ETIQUETAS: ${labels.join(', ')}\n`;
```

Las etiquetas son objetos, no strings. Esto causa `[object Object]`.

#### 2. Múltiples llamadas a la API al cancelar runs
El código de cancelación de runs (líneas 495-621) hace:
- Hasta 3 reintentos
- Múltiples llamadas en paralelo para cancelar
- Verificaciones adicionales
- Esto puede causar rate limiting

#### 3. Posibles webhooks duplicados
Los logs muestran actualizaciones muy frecuentes del mismo thread, sugiriendo que podrían estar llegando webhooks duplicados.

## Plan de Implementación Simplificado

### FASE 1: Correcciones Inmediatas (1 día)

#### 1.1 Arreglar serialización de etiquetas

```typescript
// En getConversationalContext() - línea 354
if (labels && Array.isArray(labels) && labels.length > 0) {
    // Manejar tanto strings como objetos
    const labelNames = labels
        .map(label => {
            // Si es objeto, extraer el nombre
            if (typeof label === 'object' && label.name) {
                return label.name;
            }
            // Si es string, usarlo directamente
            return String(label);
        })
        .filter(name => name && name.trim())
        .join(', ');
    
    if (labelNames) {
        context += `ETIQUETAS: ${labelNames}\n`;
    }
}
```

#### 1.2 Optimizar cancelación de runs activos

```typescript
// Simplificar la lógica de cancelación - línea 495
const existingRuns = await openai.beta.threads.runs.list(threadId, { limit: 1 });
const activeRun = existingRuns.data.find(r => 
    ['queued', 'in_progress', 'requires_action'].includes(r.status)
);

if (activeRun) {
    logWarning('ACTIVE_RUN_FOUND', `Cancelando run activo: ${activeRun.id}`, {
        shortUserId,
        runId: activeRun.id,
        status: activeRun.status
    });
    
    try {
        await openai.beta.threads.runs.cancel(threadId, activeRun.id);
        // Esperar solo 1 segundo, sin reintentos complejos
        await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
        // Solo log, no reintentar
        logError('RUN_CANCEL_ERROR', `Error cancelando run`, { error: error.message });
    }
}
```

#### 1.3 Prevenir procesamiento de webhooks duplicados

```typescript
// Agregar al inicio del webhook - línea 1379
const messageIds = new Set<string>();

for (const message of messages) {
    // Evitar procesar el mismo mensaje dos veces
    if (messageIds.has(message.id)) {
        continue;
    }
    messageIds.add(message.id);
    
    // ... resto del procesamiento
}
```

### FASE 2: Mejoras de Logging (2 días)

#### 2.1 Agregar métricas de rate limiting

```typescript
// Al inicio de app.ts
let rateLimitCounter = {
    total: 0,
    lastReset: Date.now(),
    errors: []
};

// En el catch de errores de OpenAI
if (error.status === 429) {
    rateLimitCounter.total++;
    rateLimitCounter.errors.push({
        time: Date.now(),
        endpoint: 'threads.runs.create', // o el que sea
        retryAfter: extractRetryAfter(error.message)
    });
}
```

#### 2.2 Mejorar logs de depuración

```typescript
// En processWithOpenAI, agregar más contexto
logInfo('OPENAI_CALL', 'Llamada a OpenAI', {
    shortUserId,
    threadId,
    callType: 'create_run', // o 'add_message', etc
    timestamp: Date.now()
});
```

### FASE 3: Optimizaciones Opcionales (Semana 2)

#### 3.1 Implementar rate limiter con bottleneck

```bash
npm install bottleneck
```

```typescript
import Bottleneck from 'bottleneck';

// Limitar a 50 llamadas por minuto (dejando margen)
const openaiLimiter = new Bottleneck({
    minTime: 1200, // 1.2 segundos entre llamadas
    maxConcurrent: 2 // Máximo 2 llamadas concurrentes
});

// Envolver todas las llamadas a OpenAI
const createRun = openaiLimiter.wrap(
    async (threadId: string, assistantId: string) => {
        return await openai.beta.threads.runs.create(threadId, {
            assistant_id: assistantId
        });
    }
);
```

#### 3.2 Cache de threads activos en memoria

```typescript
// Cache simple para evitar llamadas innecesarias
const threadCache = new Map<string, {
    threadId: string,
    lastChecked: number,
    status: 'active' | 'expired'
}>();

// Verificar cache antes de usar thread
const cachedThread = threadCache.get(shortUserId);
if (cachedThread && Date.now() - cachedThread.lastChecked < 300000) { // 5 min
    threadId = cachedThread.threadId;
}
```

## Métricas de Éxito

1. **Cero errores [object Object]** en los logs
2. **Reducción del 80%** en errores de rate limiting
3. **Máximo 1 actualización** de thread por usuario cada 8 segundos
4. **Tiempo de respuesta** < 3 segundos en promedio

## Testing Recomendado

```bash
# Test 1: Envío rápido de mensajes
node tests/rapid-messages.js

# Test 2: Verificar etiquetas
node tests/test-labels-serialization.js

# Test 3: Simular webhooks duplicados
node tests/duplicate-webhooks.js
```

## Conclusión

El problema principal NO es la concurrencia de timeouts (ya está manejada), sino:
1. La serialización incorrecta de objetos en el contexto
2. El manejo agresivo de runs activos que genera muchas llamadas a la API
3. Posibles webhooks duplicados

La solución es más simple de lo propuesto originalmente y no requiere sistemas de locks complejos. 