# Sistema de Locks Híbrido - SimpleLockManager

## Resumen

El **SimpleLockManager** es un sistema híbrido que combina la simplicidad del proyecto antiguo con la robustez del sistema actual. Implementa locks por usuario con sistema de colas y timeout automático.

## Características Principales

### ✅ Ventajas del Sistema Híbrido

1. **Locks por Usuario** (no por mensaje)
   - Más simple de entender y debuggear
   - Menos overhead de memoria
   - Evita procesamiento duplicado por usuario

2. **Sistema de Colas**
   - Procesamiento ordenado de mensajes
   - Evita pérdida de mensajes
   - Mejor experiencia del usuario

3. **Timeout Automático**
   - 15 segundos máximo por lock
   - Liberación automática si el sistema se cuelga
   - Recuperación rápida de errores

4. **Liberación Automática**
   - El lock se libera al terminar cada mensaje
   - No hay riesgo de locks huérfanos
   - Sistema auto-recuperable

## Comparación con Sistemas Anteriores

### Sistema Antiguo (Simple)
```typescript
const userLocks = new Map(); // Lock por usuario
const userQueues = new Map(); // Cola por usuario

// ✅ Ventajas:
- Muy simple de entender
- Sistema de colas
- Menos memoria

// ❌ Desventajas:
- Sin timeout (puede colgarse para siempre)
- No maneja múltiples instancias
- Menos robusto para producción
```

### Sistema Actual (Robusto)
```typescript
class LockManager {
    private locks = new Map<string, { timestamp: number, timeout: number }>();
    
    // ✅ Ventajas:
    - Timeout automático
    - Lock por mensaje (más granular)
    - Maneja múltiples instancias
    
    // ❌ Desventajas:
    - Más complejo
    - Más memoria
    - Sin sistema de colas
```

### Sistema Híbrido (Recomendado)
```typescript
class SimpleLockManager {
    private userLocks = new Map<string, LockInfo>();
    private userQueues = new Map<string, QueueItem[]>();
    
    // ✅ Ventajas:
    - Simple como el antiguo
    - Robusto como el actual
    - Sistema de colas
    - Timeout de seguridad
    - Menos memoria que el actual
    - Fácil de debuggear
```

## Implementación Técnica

### Estructura de Datos

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

### Flujo de Procesamiento

```typescript
// 1. Usuario envía mensaje
addToGlobalBuffer(userId, messageText, chatId, userName);

// 2. Se agrega a la cola
simpleLockManager.addToQueue(userId, messageId, buffer, processFunction);

// 3. Se procesa la cola si no hay lock activo
if (!simpleLockManager.hasActiveLock(userId)) {
    await simpleLockManager.processQueue(userId);
}

// 4. El sistema procesa mensajes en orden
while (queue.length > 0) {
    const item = queue.shift()!;
    await item.processFunction(); // Procesa el mensaje
    // Lock se libera automáticamente
}
```

## Endpoints de Monitoreo

### GET /locks
```json
{
    "system": "SimpleLockManager",
    "timestamp": "2025-01-15T10:30:00.000Z",
    "environment": "development",
    "stats": {
        "activeLocks": 2,
        "activeQueues": 1,
        "totalUsers": 3
    },
    "configuration": {
        "timeoutSeconds": 15,
        "lockType": "user-based",
        "queueEnabled": true,
        "autoRelease": true
    }
}
```

### POST /locks/clear (solo desarrollo)
```json
{
    "message": "Todos los locks y colas han sido limpiados",
    "timestamp": "2025-01-15T10:30:00.000Z"
}
```

## Casos de Uso

### Caso 1: Mensaje Normal
```
Usuario envía: "¿Disponibilidad 15 enero?"
├── Lock adquirido ✅
├── Mensaje procesado ✅
├── Respuesta enviada ✅
└── Lock liberado ✅
```

### Caso 2: Mensaje Duplicado
```
Usuario envía: "¿Disponibilidad 15 enero?" (duplicado)
├── Lock ya existe ⏳
├── Mensaje agregado a cola 📋
├── Espera a que termine el anterior ⏳
└── Se procesa automáticamente ✅
```

### Caso 3: Sistema Colgado
```
Usuario envía: "¿Disponibilidad 15 enero?"
├── Lock adquirido ✅
├── Sistema se cuelga ❌
├── Timeout de 15 segundos ⏰
├── Lock liberado automáticamente 🔓
└── Mensaje puede procesarse nuevamente ✅
```

### Caso 4: Múltiples Mensajes
```
Usuario envía: "Hola" → "¿Disponibilidad?" → "Para 2 personas"
├── Mensaje 1: Lock adquirido, procesado, liberado ✅
├── Mensaje 2: Agregado a cola, procesado automáticamente ✅
└── Mensaje 3: Agregado a cola, procesado automáticamente ✅
```

## Beneficios del Sistema Híbrido

### Para el Usuario
- ✅ No recibe respuestas duplicadas
- ✅ Mensajes se procesan en orden
- ✅ Sistema se recupera rápido de errores
- ✅ Experiencia fluida y natural

### Para el Desarrollador
- ✅ Código más simple y fácil de entender
- ✅ Menos bugs por race conditions
- ✅ Fácil debugging y monitoreo
- ✅ Sistema auto-recuperable

### Para la Infraestructura
- ✅ Menos llamadas duplicadas a APIs
- ✅ Menor uso de memoria
- ✅ Mejor rendimiento general
- ✅ Más estable en producción

## Configuración

### Variables de Configuración
```typescript
const LOCK_TIMEOUT = 15 * 1000; // 15 segundos
const BUFFER_WINDOW_MS = 3000;  // 3 segundos para agrupar
const TYPING_EXTENSION_MS = 3000; // 3 segundos extra por typing
```

### Logs del Sistema
```
🔒 Lock adquirido para usuario 123456789
📋 Mensaje msg_123456_abc agregado a cola de usuario 123456789 (2 en cola)
🔄 Procesando cola de usuario 123456789 (2 mensajes)
📝 Procesando mensaje msg_123456_abc de usuario 123456789
✅ Mensaje msg_123456_abc procesado exitosamente
🔓 Lock liberado para usuario 123456789
🧹 Cola de usuario 123456789 limpiada
```

## Migración desde Sistemas Anteriores

### Cambios Principales
1. **Eliminación de locks por mensaje** → Locks por usuario
2. **Sistema de colas integrado** → Procesamiento ordenado
3. **Timeout automático** → Recuperación de errores
4. **Liberación automática** → Sin locks huérfanos

### Compatibilidad
- ✅ Compatible con sistema de buffering existente
- ✅ Compatible con sistema de typing
- ✅ Compatible con sistema de historial
- ✅ Compatible con todas las funciones existentes

## Monitoreo y Debugging

### Métricas Importantes
- `activeLocks`: Usuarios con locks activos
- `activeQueues`: Usuarios con mensajes en cola
- `totalUsers`: Total de usuarios activos

### Logs Clave
- `🔒 Lock adquirido`: Nuevo lock activo
- `📋 Mensaje agregado a cola`: Mensaje en espera
- `🔄 Procesando cola`: Inicio de procesamiento
- `✅ Mensaje procesado`: Procesamiento exitoso
- `🔓 Lock liberado`: Lock liberado
- `🧹 Cola limpiada`: Limpieza de cola

### Troubleshooting
1. **Locks que no se liberan**: Verificar timeout de 15 segundos
2. **Mensajes perdidos**: Verificar sistema de colas
3. **Procesamiento lento**: Verificar tamaño de colas
4. **Errores de concurrencia**: Verificar locks por usuario

## Conclusión

El **SimpleLockManager** representa la evolución natural del sistema de locks, combinando lo mejor de ambos enfoques anteriores:

- **Simplicidad** del proyecto antiguo
- **Robustez** del sistema actual
- **Eficiencia** mejorada
- **Mantenibilidad** superior

Este sistema híbrido proporciona la base sólida necesaria para un bot de WhatsApp en producción, con la flexibilidad y simplicidad requeridas para el desarrollo y mantenimiento. 