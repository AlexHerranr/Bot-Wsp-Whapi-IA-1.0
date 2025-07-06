# Plan de Estabilización del Bot WhatsApp

## Diagnóstico Real de los Logs

### Problemas Identificados
1. **Múltiples actualizaciones de thread**: Los logs muestran actualizaciones frecuentes del mismo thread en cortos períodos
2. **Posible acumulación de timeouts**: El sistema de 8 segundos podría estar creando múltiples timeouts sin cancelar los anteriores
3. **Serialización de etiquetas**: Funciona correctamente cuando hay etiquetas, pero podría fallar cuando están vacías

## Plan de Implementación Simplificado

### FASE 1: Corrección del Sistema de Timeouts (Prioridad Alta)

#### Problema Real
El sistema actual crea un timeout de 8 segundos, pero si llegan múltiples mensajes, podría estar creando múltiples timeouts sin cancelar los anteriores.

#### Solución Propuesta
Asegurar que solo exista UN timeout activo por usuario:

```typescript
// src/app.ts - Modificar el manejo de timeouts

// En el webhook, antes de crear un nuevo timeout:
const existingTimer = userActivityTimers.get(userId);
if (existingTimer) {
    clearTimeout(existingTimer);
    logger.debug('TIMER_CANCELLED', `Timeout anterior cancelado para ${userId}`);
}

// Crear el nuevo timeout
const timerId = setTimeout(async () => {
    userActivityTimers.delete(userId); // Limpiar el timer del mapa
    
    try {
        await processUserMessage(userId);
    } catch (error) {
        logger.error('PROCESS_ERROR', `Error procesando mensaje de ${userId}`, { error });
    }
}, 8000);

userActivityTimers.set(userId, timerId);
```

### FASE 2: Validación de Etiquetas (Prioridad Media)

#### Problema
Las etiquetas podrían no estar manejándose correctamente cuando están vacías o undefined.

#### Solución
```typescript
// src/app.ts - En getConversationalContext

if (labels && Array.isArray(labels) && labels.length > 0) {
    const labelNames = labels
        .filter(label => label && label.name) // Validar que cada etiqueta tenga nombre
        .map(label => label.name)
        .join(', ');
    
    if (labelNames) {
        context += `ETIQUETAS: ${labelNames}\n`;
    }
} else {
    // No agregar línea de etiquetas si no hay ninguna
    logger.debug('CONTEXT_LABELS', 'No hay etiquetas para incluir en el contexto');
}
```

### FASE 3: Optimizaciones Opcionales (Prioridad Baja)

#### 1. Logging Mejorado para Debugging
```typescript
// Agregar más información en los logs críticos
logger.info('PROCESS_START', `Iniciando procesamiento para ${userId}`, {
    threadId: existingThreadId,
    messageCount: messages.length,
    timestamp: new Date().toISOString()
});
```

#### 2. Validación de Estado del Thread
```typescript
// Antes de procesar, validar que el thread esté en buen estado
if (threadId) {
    try {
        const thread = await openai.beta.threads.retrieve(threadId);
        if (thread.status === 'expired' || thread.status === 'failed') {
            logger.warn('THREAD_INVALID', `Thread ${threadId} en estado ${thread.status}, creando nuevo`);
            threadId = null; // Forzar creación de nuevo thread
        }
    } catch (error) {
        logger.error('THREAD_CHECK_ERROR', `Error verificando thread ${threadId}`, { error });
    }
}
```

## Métricas de Éxito

1. **Reducción de actualizaciones múltiples**: No más de 1 actualización de thread por usuario cada 8 segundos
2. **Cero errores de serialización**: Los logs no deben mostrar [object Object] en el contexto
3. **Mejora en tiempos de respuesta**: Reducción en el número de llamadas a la API de OpenAI

## Implementación Recomendada

### Orden de Implementación
1. **Día 1**: Implementar corrección de timeouts (FASE 1)
2. **Día 2**: Monitorear logs y verificar reducción de actualizaciones múltiples
3. **Día 3**: Implementar validación de etiquetas (FASE 2)
4. **Semana 2**: Evaluar necesidad de optimizaciones adicionales

### Testing
- Simular envío rápido de múltiples mensajes desde un mismo usuario
- Verificar que solo se procese un batch después de 8 segundos
- Probar con usuarios sin etiquetas y con etiquetas

## Notas Importantes

1. **No es necesario un sistema de locks complejo**: El manejo correcto de timeouts debería ser suficiente
2. **El rate limiting real de OpenAI**: Si persisten problemas, considerar implementar un rate limiter real con bibliotecas como `bottleneck`
3. **Monitoreo continuo**: Implementar alertas cuando se detecten patrones anómalos en los logs

## Conclusión

Este plan se enfoca en los problemas reales observados en los logs, evitando sobre-ingeniería. La solución principal es asegurar que el sistema de agrupación de mensajes funcione correctamente cancelando timeouts anteriores. 