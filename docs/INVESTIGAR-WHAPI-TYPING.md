# 🔍 INVESTIGACIÓN: Eventos de Typing en Whapi

## ✅ **CONFIRMADO: Whapi SÍ soporta eventos de typing**
Según la documentación, Whapi puede enviar webhooks de "presences" que incluyen cuando un contacto está "typing" o "recording audio".

## 📋 **Objetivo actualizado**
Implementar un sistema híbrido que combine eventos de typing con el buffer inteligente actual para lograr la mejor experiencia de usuario posible.

## 🎯 **Problema Actual**
- **Buffer fijo de 6 segundos** - Espera innecesaria
- **No detecta** cuando el usuario terminó de escribir
- **Experiencia subóptima** - Demora artificial en respuestas

## 🔬 **Investigación Completada**

### **1. Webhooks de Presence en Whapi - CONFIRMADO ✅**
- [x] Whapi soporta eventos de `presence` 
- [x] Estados disponibles: `online`, `offline`, `typing`, `recording`, `pending`
- [x] Se puede suscribir via webhook con `type: "presences"`

### **2. Endpoints Relevantes (según documentación)**
```
GET /presence/{phone_number} - Obtener estado actual
POST /presence/subscribe - Suscribirse a cambios de presence
```

### **3. Posible Estructura de Webhook**
```json
{
  "presence": {
    "contact_id": "573003913251",
    "status": "typing",
    "timestamp": 1234567890
  },
  "event": {
    "type": "presence",
    "event": "update"
  }
}
```

## 💡 **Alternativas si NO hay eventos de typing**

### **A. Timeout Dinámico Inteligente**
```typescript
// Mensajes cortos = timeout corto
// Mensajes largos = timeout más largo
const calculateTimeout = (messageLength: number): number => {
    if (messageLength < 10) return 1500;  // 1.5s para mensajes cortos
    if (messageLength < 30) return 2500;  // 2.5s para mensajes medios
    return 3500; // 3.5s para mensajes largos
};
```

### **B. Detección de Patrones de Finalización**
```typescript
const MESSAGE_ENDINGS = {
    questions: ['?', '¿'],
    statements: ['.', '!', '!!', '...'],
    informal: ['jaja', 'jeje', 'ok', 'gracias', 'bye'],
    emojis: ['👍', '😊', '🙏', '✅']
};

const seemsFinal = (text: string): boolean => {
    const trimmed = text.trim().toLowerCase();
    
    // Verificar finales comunes
    for (const endings of Object.values(MESSAGE_ENDINGS)) {
        if (endings.some(end => trimmed.endsWith(end))) {
            return true;
        }
    }
    
    // Mensajes muy cortos suelen ir en grupo
    if (trimmed.length < 5) return false;
    
    // Mensajes largos suelen ser finales
    if (trimmed.length > 100) return true;
    
    return false;
};
```

### **C. Sistema de Confianza Adaptativo**
```typescript
interface UserPattern {
    avgTimeBetweenMessages: number;
    avgMessagesPerGroup: number;
    typicalEndings: string[];
}

// Aprender patrones del usuario
const learnUserPatterns = (userId: string): UserPattern => {
    // Analizar historial para detectar:
    // - Cuánto tarda típicamente entre mensajes
    // - Cuántos mensajes envía por grupo
    // - Cómo suele terminar sus grupos de mensajes
};
```

## 🚀 **Plan de Implementación - Sistema Híbrido**

### **📊 Fase 1: Medición y Análisis (1 semana)**
```typescript
// 1. Activar webhooks de presence
await axios.patch(`${WHAPI_URL}/settings`, {
    webhooks: [{
        url: webhookUrl,
        events: [
            { type: "message", method: "post" },
            { type: "presences", method: "post" } // NUEVO
        ]
    }]
});

// 2. Loggear TODOS los eventos sin cambiar lógica
if (req.body.presences) {
    req.body.presences.forEach(p => {
        logDebug('PRESENCE_EVENT', `${p.participant}: ${p.type}`, {
            timestamp: Date.now(),
            currentBuffer: userBuffers.get(p.participant)?.length || 0
        });
    });
}
```

**Métricas a recopilar:**
- % de usuarios que envían eventos typing
- Duración promedio de typing
- Correlación typing-mensaje
- Patrones por tipo de cliente (Web/Mobile)

### **🧪 Fase 2: Experimento A/B (1 semana)**
```typescript
// UserStateManager ya creado en src/utils/userStateManager.ts
const EXPERIMENT_USERS = ['user1@s.whatsapp.net', 'user2@s.whatsapp.net'];

if (EXPERIMENT_USERS.includes(userId)) {
    // Grupo A: Sistema híbrido
    userStateManager.handleTypingEvent(userId, isTyping);
    userStateManager.addMessage(userId, message, chatId, userName);
} else {
    // Grupo B: Sistema actual mejorado
    addToBuffer(userId, message); // Buffer inteligente 0.8-3s
}

// Comparar métricas entre grupos
trackMetrics({
    group: isExperimentUser ? 'hybrid' : 'smart-buffer',
    responseTime: endTime - startTime,
    messagesGrouped: messages.length,
    userSatisfaction: detectSatisfaction(response)
});
```

### **🚀 Fase 3: Roll Out Gradual (si métricas positivas)**
```typescript
// 1. Roll out 25% -> 50% -> 100%
const rolloutPercentage = getFeatureFlag('hybrid-system-rollout', 0);
const useHybridSystem = hashUserId(userId) % 100 < rolloutPercentage;

// 2. Mantener fallback
try {
    if (useHybridSystem) {
        userStateManager.handleMessage(userId, message, metadata);
    } else {
        legacyBufferSystem.handle(userId, message);
    }
} catch (error) {
    // Fallback automático al sistema legacy
    logError('HYBRID_SYSTEM_ERROR', error);
    legacyBufferSystem.handle(userId, message);
}

// 3. Monitoreo en tiempo real
monitorMetrics({
    systemType: useHybridSystem ? 'hybrid' : 'legacy',
    performance: measurePerformance(),
    errors: getErrorRate()
});
```

## 📊 **Métricas de Éxito**
- ⬇️ Reducir tiempo promedio de espera de 6s a <3s
- ⬆️ Aumentar satisfacción del usuario
- ✅ Mantener agrupación correcta de mensajes
- 🚀 Respuestas más naturales y rápidas

## ⚖️ **Análisis Sistema Híbrido vs Buffer Inteligente**

### **Sistema Actual (Buffer Inteligente 0.8-3s)**
**Ventajas:**
- ✅ Simple y robusto
- ✅ Funciona con TODOS los clientes
- ✅ Ya implementado y probado
- ✅ 5.2s más rápido que sistema original

**Desventajas:**
- ❌ No óptimo (podría ser más rápido)
- ❌ No refleja comportamiento real del usuario

### **Sistema Híbrido (Typing + Buffer)**
**Ventajas:**
- ✅ Respuesta óptima basada en comportamiento real
- ✅ Mejor experiencia de usuario
- ✅ Métricas adicionales de comportamiento

**Desventajas:**
- ❌ Mayor complejidad
- ❌ No todos los clientes envían eventos typing
- ❌ Más puntos de falla
- ❌ Posibles costos adicionales de Whapi

## 🎯 **Recomendación Final**
1. **Mantener buffer inteligente como base** (ya funciona bien)
2. **Medir eventos typing por 1 semana** (sin cambiar lógica)
3. **Solo implementar híbrido si:**
   - >70% usuarios envían eventos typing
   - Mejora medible en tiempos de respuesta
   - No hay costos adicionales significativos

## 🔗 **Referencias**
- [Whapi Webhooks - Presences](https://support.whapi.cloud/help-desk/receiving/webhooks/incoming-webhooks-format/other/presences)
- [UserStateManager implementado](../src/utils/userStateManager.ts) 