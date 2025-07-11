# Implementaciones Pausadas - Sistema de Testing

## 🚀 Inicio Rápido

### Para Pausar el Buffer (Velocidad Máxima)
```bash
# Pausar buffer para pruebas de velocidad
node scripts/toggle-buffer.js off

# Reiniciar el bot para aplicar cambios
npm run dev
```

### Para Restaurar el Buffer (Operación Normal)
```bash
# Reactivar buffer normal
node scripts/toggle-buffer.js on

# Reiniciar el bot para aplicar cambios
npm run dev
```

### Ver Estado Actual
```bash
# Verificar si el buffer está activo o pausado
node scripts/toggle-buffer.js status
```

---

## Propósito
Este documento registra implementaciones probadas y funcionales que pueden ser pausadas temporalmente para realizar pruebas de rendimiento, comparaciones de velocidad, y análisis de comportamiento específico.

## Implementaciones Disponibles para Pausar

### 1. Buffer de Mensajes (10 segundos)
**Estado:** ✅ Funcional - Disponible para pausar
**Ubicación:** `src/app-unified.ts`
**Configuración técnica:**
- Variable: `MESSAGE_BUFFER_TIMEOUT = 10000` (10 segundos)
- Función: Agrupa mensajes consecutivos del usuario antes de procesarlos
- Beneficio: Evita procesar mensajes parciales/incompletos
- Uso de memoria: Buffers activos en `userMessageBuffers.size`

**Cómo pausar:**
```typescript
// En src/app-unified.ts línea 63
const MESSAGE_BUFFER_TIMEOUT = 0; // 0 = sin buffer (procesamiento inmediato)
// O usar variable de entorno
const MESSAGE_BUFFER_TIMEOUT = process.env.DISABLE_BUFFER ? 0 : 10000;
```

**Impacto al pausar:**
- ✅ Respuestas más rápidas (0-100ms vs 10s)
- ⚠️ Puede procesar mensajes incompletos
- ⚠️ Más calls a OpenAI (menos eficiente)
- ⚠️ Usuarios que escriben en partes pueden confundirse

### 2. Sistema de Buffering Inteligente (Timeouts Dinámicos)
**Estado:** ✅ Funcional - Disponible para pausar
**Ubicación:** `src/utils/messageBuffering.ts`
**Configuración técnica:**
- Función: `calculateDynamicTimeout()` - Timeouts de 1-6 segundos basados en contenido
- Función: `isLikelyFinalMessage()` - Detecta mensajes que parecen finales
- Función: `shouldWaitForMore()` - Decide si esperar más mensajes
- Beneficio: Timeouts más inteligentes que el sistema fijo

**Cómo pausar:**
```typescript
// Modificar calculateDynamicTimeout() para retornar 0
export const calculateDynamicTimeout = (): number => {
    return 0; // Sin timeout dinámico
};
```

**Impacto al pausar:**
- ✅ Anula completamente el buffering inteligente
- ⚠️ Vuelve al sistema fijo de 10s (si está activo)
- ⚠️ Pierde optimizaciones de detección de mensajes finales

## Implementaciones Candidatas para Pausar

### Rate Limiting (20 mensajes/minuto)
**Estado:** 🔄 Evaluando para pausar
**Ubicación:** `src/app-unified.ts` - Clase `SimpleRateLimiter`
**Configuración:** 20 mensajes por ventana de 60 segundos
**Razón para pausar:** Medir velocidad máxima sin restricciones

### Cleanup Automático de Memoria
**Estado:** 🔄 Evaluando para pausar
**Ubicación:** `src/app-unified.ts` - Cleanup cada 30 minutos
**Razón para pausar:** Evitar interferencia durante pruebas de carga

### Validación de Mensajes del Sistema
**Estado:** 🔄 Evaluando para pausar
**Ubicación:** `src/app-unified.ts` - Función `isSystemMessage()`
**Razón para pausar:** Medir impacto en velocidad de procesamiento

## Protocolo de Pruebas

### Antes de Pausar
1. ✅ Documenter configuración actual
2. ✅ Hacer backup de archivos modificados
3. ✅ Confirmar que la implementación funciona correctamente
4. ✅ Establecer métricas de referencia

### Durante las Pruebas
1. 🔄 Medir tiempo de respuesta promedio
2. 🔄 Contar número de calls a OpenAI
3. 🔄 Monitorear uso de memoria
4. 🔄 Verificar que no se rompa funcionalidad crítica

### Después de Pruebas
1. ⏳ Restaurar configuración original
2. ⏳ Documentar resultados y conclusiones
3. ⏳ Decidir si mantener pausado o activar

## Configuración Rápida

### Script Automático (Recomendado)
```bash
# Ver estado actual
node scripts/toggle-buffer.js status

# Pausar buffer para pruebas de velocidad
node scripts/toggle-buffer.js off

# Restaurar buffer normal
node scripts/toggle-buffer.js on
```

### Variables de Entorno Manual
```bash
# Pausar buffer de mensajes (en .env o .env.local)
DISABLE_MESSAGE_BUFFER=true

# Pausar buffering inteligente (incluido automáticamente)
# DISABLE_SMART_BUFFER=true  # No necesario - se pausa junto con el buffer principal

# Pausar rate limiting (pendiente implementar)
# DISABLE_RATE_LIMIT=true
```

### Implementación en Código
```typescript
// src/app-unified.ts
const MESSAGE_BUFFER_TIMEOUT = process.env.DISABLE_MESSAGE_BUFFER === 'true' ? 0 : 10000;
const MANUAL_MESSAGE_TIMEOUT = process.env.DISABLE_MESSAGE_BUFFER === 'true' ? 0 : 8000;
const BUFFER_DISABLED = process.env.DISABLE_MESSAGE_BUFFER === 'true';

// src/utils/messageBuffering.ts
export const calculateDynamicTimeout = (messageLength: number, hasTypingSupport: boolean = false): number => {
    if (process.env.DISABLE_MESSAGE_BUFFER === 'true') {
        return 0; // Sin timeout - procesamiento inmediato
    }
    // ... resto de la lógica
};
```

## Historial de Pruebas

### Fecha: 10 de Enero, 2025
**Implementación:** Buffer de 10 segundos
**Estado:** ✅ Implementado sistema de pausa/activación
**Configuración:** Variable `DISABLE_MESSAGE_BUFFER=true` + Script automático
**Resultado:** Sistema listo para pruebas de velocidad
**Conclusión:** 
- ✅ Buffer principal y buffering inteligente se pausan simultáneamente
- ✅ Script toggle-buffer.js facilita cambios sin editar archivos
- ✅ Logs muestran estado actual del buffer al iniciar
- ✅ Health check incluye estado del buffer
- ⏳ Pendiente: Realizar pruebas de velocidad comparativas

---

## Notas Importantes

⚠️ **Advertencia:** Las implementaciones pausadas pueden afectar la experiencia del usuario final. Usar solo en entornos de prueba o con usuarios conocedores del contexto.

🔧 **Recomendación:** Implementar toggles/switches antes de pausar para facilitar la reversión rápida.

📊 **Métricas:** Siempre medir impacto antes y después de pausar para tomar decisiones informadas.

🕐 **Temporalidad:** Las pausas deben ser temporales. Documentar plan de reactivación. 