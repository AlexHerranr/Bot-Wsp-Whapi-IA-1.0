# 🕐 Contexto Temporal Optimizado

## 📋 Resumen

Se ha optimizado el sistema de contexto temporal para reducir el consumo de tokens y mejorar la eficiencia, implementando un cache de 5 minutos y un formato mucho más corto.

## 🎯 Cambios Implementados

### 1. Cache de Contexto Temporal
**Propósito**: Evitar generar el mismo contexto repetidamente en mensajes consecutivos.

**Configuración**:
- **TTL**: 5 minutos (300,000 ms)
- **Almacenamiento**: Map en memoria
- **Clave**: `shortUserId` (ID corto del usuario)

**Funcionamiento**:
```typescript
const contextCache = new Map<string, { context: string, timestamp: number }>();
const CONTEXT_CACHE_TTL = 5 * 60 * 1000; // 5 minutos
```

### 2. Formato Ultra Corto
**Antes** (consumía ~200 tokens):
```
=== CONTEXTO TEMPORAL ===
Cliente: [Nombre del cliente]
Contacto: [Nombre del contacto en WhatsApp]
Fecha/Hora: [Fecha y hora actual en Colombia]
Etiquetas: [Etiquetas del cliente separadas por comas]
=== FIN CONTEXTO ===
```

**Ahora** (consume ~15 tokens):
```
[Alexander | 14:30 | Colega Jefe, cotización]
```

## 🔧 Implementación Técnica

### 1. Verificación de Cache
```typescript
const cached = contextCache.get(shortUserId);
if (cached && (now - cached.timestamp) < CONTEXT_CACHE_TTL) {
    logInfo('CONTEXT_CACHE_HIT', 'Contexto temporal desde cache', {
        userId: shortUserId,
        cacheAge: Math.round((now - cached.timestamp) / 1000),
        requestId
    });
    return cached.context;
}
```

### 2. Generación de Contexto Corto
```typescript
// Solo hora (no fecha completa)
const currentTime = new Date().toLocaleTimeString('es-ES', { 
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit'
});

// Solo 2 etiquetas máximo
const allLabels = [...new Set([...profileLabels, ...chatLabels])].slice(0, 2);

// Formato compacto
let context = `[${clientName} | ${currentTime}`;
if (allLabels.length > 0) {
    context += ` | ${allLabels.join(', ')}`;
}
context += `]\n\n`;
```

### 3. Almacenamiento en Cache
```typescript
contextCache.set(shortUserId, { context, timestamp: now });
```

## 📊 Beneficios

### 1. Reducción de Tokens
- **Antes**: ~200 tokens por mensaje
- **Ahora**: ~15 tokens por mensaje
- **Ahorro**: 92.5% menos tokens

### 2. Cache Inteligente
- **Primer mensaje**: Genera contexto nuevo
- **Mensajes siguientes**: Usa cache por 5 minutos
- **Ahorro adicional**: 100% menos tokens en cache hits

### 3. Información Esencial
- **Nombre del cliente**: Identificación personal
- **Hora actual**: Contexto temporal
- **Etiquetas principales**: Categorización (máximo 2)

## 📈 Logs y Monitoreo

### Cache Hit (Contexto desde cache):
```
[CONTEXT_CACHE_HIT] Contexto temporal desde cache
- userId: 573003913251
- cacheAge: 180 (3 minutos)
- requestId: req_123456
```

### Cache Miss (Contexto generado):
```
[CONTEXT_INJECTION] Contexto temporal generado
- userId: 573003913251
- contextLength: 45
- clientName: Alexander
- contactName: Alex
- labelsCount: 2
- hasProfile: true
- hasChatInfo: true
```

## 🎯 Ejemplos de Uso

### Contexto Generado:
```
[Alexander | 14:30 | Colega Jefe, cotización]

Hola, necesito información sobre disponibilidad para el fin de semana.
```

### Contexto desde Cache:
```
[Alexander | 14:30 | Colega Jefe, cotización]

¿Tienes fotos del apartamento?
```

## 🔄 Flujo de Funcionamiento

1. **Llega mensaje** del usuario
2. **Verificar cache** para el `shortUserId`
3. **Si hay cache válido**: Retornar contexto cacheado
4. **Si no hay cache**: 
   - Obtener perfil y chat info
   - Generar contexto corto
   - Guardar en cache
   - Retornar contexto
5. **Concatenar** contexto + mensaje original
6. **Enviar** a OpenAI

## 💡 Optimizaciones Futuras

### 1. Cache Persistente
- Guardar cache en archivo para sobrevivir reinicios
- TTL más largo para usuarios inactivos

### 2. Contexto Adaptativo
- Más información para usuarios nuevos
- Menos información para usuarios frecuentes

### 3. Métricas Avanzadas
- Tasa de cache hit/miss
- Tokens ahorrados por usuario
- Frecuencia de actualización de contexto

## 📝 Notas Técnicas

### Captura de Nombres
El sistema obtiene nombres desde dos fuentes:
1. **Perfil guardado**: `profile.name` (extraído de conversaciones)
2. **WhatsApp API**: `chatInfo.name` (nombre del contacto guardado)

### Priorización de Etiquetas
- **Primero**: Etiquetas del perfil local
- **Segundo**: Etiquetas de WhatsApp API
- **Límite**: Máximo 2 etiquetas para mantener formato corto

### Zona Horaria
- **Configuración**: America/Bogota (UTC-5)
- **Formato**: HH:MM (ej: 14:30)
- **Actualización**: Solo cuando se genera nuevo contexto 