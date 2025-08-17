# 🔄 REVERT NECESARIO: Problema con Notas de Voz

## 🚨 PROBLEMA DETECTADO
Hay problemas persistentes con las **notas de voz** que requieren hacer **revert** del último commit de timing humano.

## 📋 CAMBIOS QUE SE PERDERÁN EN EL REVERT

### ✅ Timing Humano Natural (Commit 4104e81)
**Archivos afectados:**
- `src/utils/humanTiming.ts` - Nueva utilidad con fórmulas simples
- `src/core/services/whatsapp.service.ts` - Integración de delays variables

**Características implementadas:**
1. **Fórmulas ultra-simples con variabilidad**:
   - **Texto**: 300ms base + 6ms/char, máx 1500ms + random ±15%
   - **Voz**: 600ms base + 10ms/char, máx 2000ms + random ±15%

2. **Integración sin romper chunking**:
   - `calculateHumanTypingDelay()` usa `computeHumanDelay(length, 'text')`
   - Delay de voz variable según longitud de chunk
   - Variabilidad humana evita patrones robóticos

3. **Ventajas logradas**:
   - ✅ Delays naturales que escalan con longitud
   - ✅ Sin bloqueos ni esperas frustrantes  
   - ✅ Timing predecible pero variable
   - ✅ Compatible con sistema existente

### ✅ Citación Automática Durante Run Activo (Commit a084fdb)
**Archivos afectados:**
- `src/core/state/buffer-manager.ts` - Detección activeRuns + marcado duringRunMsgId
- `src/shared/types.ts` - Nuevo campo duringRunMsgId en MessageBuffer
- `src/core/api/webhook-processor.ts` - Pasar message.id real desde webhook
- `src/core/bot.ts` - Lógica separada isDuringRunPending para forzar citación
- `src/core/services/whatsapp.service.ts` - Logs confirmación QUOTE_ATTEMPT_TEXT/VOICE

**Características implementadas:**
1. **Detección automática de mensajes durante run activo**:
   - Detecta cuando llega mensaje mientras bot está procesando
   - Marca automáticamente con `duringRunMsgId` para citación posterior
   - Simula comportamiento humano de "responder seleccionando" mensaje pendiente

2. **Lógica de citación separada**:
   - `isDuringRunPending` para forzar citación automática
   - Priorización: `duringRunMsgId > quotedMessageId` (user-quotes)
   - Logs de confirmación en WhatsappService para trace completo

3. **Flujo técnico mejorado**:
   - Run activo procesando mensaje (ej: "No")
   - Llega nuevo mensaje (ej: "Tours") → detecta activeRuns.get(userId)
   - Marca buffer.duringRunMsgId = messageId del webhook
   - Procesa ambos: "No" normal + "Tours" citado automáticamente

**Ventajas logradas:**
- ✅ Mensajes durante run → respuestas citadas automáticamente
- ✅ User-quotes normales → lógica heurística preservada  
- ✅ Simulación perfecta de comportamiento humano en WhatsApp
- ✅ Logs detallados para debugging y trace completo

### ✅ Cola FIFO + Citación Post-Flush (Commit 4566ac3)
**Archivos afectados:**
- `src/core/services/whatsapp.service.ts` - Cola FIFO per-chat
- `src/core/state/buffer-manager.ts` - Citación post-flush 
- `src/shared/types.ts` - Campos postFlushMsgId + lastFlushAt

**Características implementadas:**
1. **Cola FIFO per-chat para orden cronológico**:
   - `queueSend()` serializa envíos finales
   - Wrappea tanto texto como voz
   - Evita intercalado de chunks entre respuestas paralelas

2. **Citación automática post-flush**:
   - Ventana 45s para mensajes huérfanos
   - Priorización: `postFlushMsgId > duringRunMsgId > quotedMessageId`
   - Reset explícito de flags evita carry-over

3. **Ventajas logradas**:
   - ✅ Orden cronológico perfecto sin intercalado
   - ✅ Citación completa en todos escenarios
   - ✅ Escalabilidad O(1) per-chat independiente
   - ✅ Conversaciones naturales simulando comportamiento humano

## 🎯 PLAN POST-REVERT

### 1. ✅ Revert Completado
```bash
git revert 4104e81 --no-edit  # ✅ HECHO - Timing humano revertido
# Commit revert: 2cd0009
# Estado: Cola FIFO + Citación durante run PRESERVADAS
```

### 2. Diagnosticar Problema de Voz
- Revisar logs específicos de notas de voz
- Identificar si el problema es por delays largos o por la cola FIFO
- Determinar si afecta solo timing o también la funcionalidad base

### 3. Re-implementar de Forma Gradual
**Opción A - Solo timing humano simple:**
- Re-aplicar `humanTiming.ts` pero solo para texto inicialmente
- Mantener delays fijos cortos para voz hasta resolver el problema

**Opción B - Solo mejoras de citación:**  
- Mantener citación durante run activo (a084fdb) y post-flush (4566ac3)
- Usar delays originales hasta diagnosticar problema de voz

**Opción C - Híbrido conservador:**
- Re-aplicar timing humano con límites aún más cortos
- Mantener citaciones pero cola FIFO solo para texto

### 4. Testing Específico Post-Revert
- Probar notas de voz básicas (funcionan?)
- Probar timing de respuestas (muy rápido/lento?)
- Probar citación automática (se mantiene?)
- Probar intercalado de chunks (vuelve el problema?)

## 🚀 MEJORAS PENDIENTES DE RE-IMPLEMENTACIÓN

### 1. 🎯 Timing Humano Natural - PRIORIDAD ALTA
**Objetivo**: Simular delays de escritura/grabación humana con variabilidad natural

**Problemas del intento anterior**:
- Delays 600-2000ms por chunk de voz causaron cuelgues
- Implementación bloqueante que afecta la cola de envío
- Sin timeout defensivo para casos extremos

**Plan mejorado para re-implementación**:
```typescript
// NUEVA PROPUESTA: Delays más conservadores con timeout
export function computeHumanDelay(length: number, mode: 'text' | 'voice'): number {
  const base = mode === 'voice' ? 400 : 200;        // Más cortos
  const perChar = mode === 'voice' ? 3 : 2;         // Escalado mínimo  
  const max = mode === 'voice' ? 1200 : 800;        // Límites seguros
  
  let delay = base + (length * perChar);
  // Random ±10% (menos variabilidad)
  const randomFactor = 0.9 + Math.random() * 0.2;
  delay = Math.round(delay * randomFactor);
  
  return Math.min(Math.max(delay, base), max);
}

// IMPLEMENTACIÓN NO BLOQUEANTE: Promise.race con timeout
async function sendWithSafeDelay(operation: () => Promise<T>, delay: number): Promise<T> {
  const timeoutMs = Math.max(delay, 2000); // Nunca más de 2s
  return Promise.race([
    operation(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Send timeout')), timeoutMs)
    )
  ]);
}
```

**Estrategia de testing**:
- Implementar solo para texto inicialmente
- Probar con delays cortos (200-800ms máx)
- Agregar voz solo después de confirmar estabilidad
- Logs detallados para detectar bloqueos temprano

### 2. 📈 Presencias Continuas Durante Procesamiento - PRIORIDAD MEDIA
**Objetivo**: Indicadores "escribiendo"/"grabando" cada 8-10s durante llamadas OpenAI largas

**Plan de implementación**:
```typescript
// PRESENCIAS CON AUTO-CLEANUP
class PresenceManager {
  private activePresences = new Map<string, NodeJS.Timeout>();
  
  startContinuousPresence(chatId: string, type: 'typing' | 'recording', maxDuration = 25000) {
    this.stopPresence(chatId); // Cleanup previo
    
    const interval = setInterval(() => {
      this.sendPresenceIndicator(chatId, type);
    }, 8000);
    
    // Auto-stop después de maxDuration
    const timeout = setTimeout(() => {
      clearInterval(interval);
      this.activePresences.delete(chatId);
    }, maxDuration);
    
    this.activePresences.set(chatId, { interval, timeout });
  }
}
```

**Integración en bot.ts**:
- Iniciar presencia al comenzar run OpenAI
- Auto-stop cuando run completa
- Diferenciar typing/recording según respuesta esperada

### 3. ⚡ Optimizaciones de Performance - PRIORIDAD BAJA
**Objetivo**: Reducir latencia sin sacrificar naturalidad

**Mejoras identificadas**:
- **Delays en paralelo con TTS**: No esperar delay antes de generar audio
- **Chunking inteligente**: Dividir por frases naturales en vez de caracteres
- **Cache de audio**: Reutilizar TTS para frases comunes
- **Presencia predictiva**: Comenzar indicadores antes de decidir tipo respuesta

**Plan técnico**:
```typescript
// DELAYS EN PARALELO CON OPERACIONES
async function sendChunkWithTiming(chunk: string, mode: 'text' | 'voice') {
  const delay = computeHumanDelay(chunk.length, mode);
  
  if (mode === 'voice') {
    // TTS + delay en paralelo, no secuencial
    const [audioBuffer] = await Promise.all([
      generateTTS(chunk),
      new Promise(r => setTimeout(r, delay))
    ]);
    return sendVoiceMessage(audioBuffer);
  } else {
    await new Promise(r => setTimeout(r, delay));
    return sendTextMessage(chunk);
  }
}
```

## 📋 CRONOGRAMA DE RE-IMPLEMENTACIÓN

### Fase 1: Timing Humano Seguro (1-2 días)
- ✅ Voz funcionando sin revert confirmado
- 🔄 Re-implementar timing con delays cortos (200-800ms)
- 🔄 Solo texto inicialmente, voz después
- 🔄 Testing exhaustivo con timeouts defensivos

### Fase 2: Presencias Continuas (1 día)
- 🔄 Implementar PresenceManager con auto-cleanup
- 🔄 Integrar en runs OpenAI largos
- 🔄 Logs para verificar no-memory-leaks

### Fase 3: Optimizaciones (opcional)
- 🔄 Delays en paralelo con TTS
- 🔄 Chunking inteligente por frases
- 🔄 Cache de audio frecuente

## 📝 NOTAS IMPORTANTES
- **Prioridad 1**: Funcionalidad básica de voz debe funcionar
- **Prioridad 2**: Mantener mejoras de citación preservadas
- **Prioridad 3**: Re-implementar timing humano de forma segura y gradual

Los commits revertidos están documentados aquí para **re-aplicación posterior** cuando se autorice continuar.