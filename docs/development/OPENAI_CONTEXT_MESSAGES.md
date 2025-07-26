# 🤖 Mensajes de Contexto para OpenAI - Sistema Inteligente

## 📋 Descripción

Este documento describe el sistema inteligente de contexto temporal que optimiza los mensajes enviados a OpenAI, incluyendo tanto la disponibilidad de Beds24 como la información de contexto del usuario.

---

## 🧠 **NUEVO: Sistema de Contexto Temporal Inteligente (Julio 26, 2025)**

### **🎯 Optimización Crítica Implementada**
El sistema ahora envía contexto temporal **solo cuando es necesario**, reduciendo tokens y costos de OpenAI en ~150 tokens por mensaje.

### **🔍 Condiciones para Enviar Contexto:**
1. **⏰ Temporal**: Cada 3 horas desde `lastActivity`
2. **👤 Cambio de Nombre**: Cuando el nombre del contacto cambia
3. **🏷️ Cambio de Labels**: Cuando las etiquetas del usuario cambian
4. **🆕 Primer Mensaje**: Cuando no existe thread previo
5. **⚠️ Error de Verificación**: Por seguridad cuando hay errores

### **📊 Beneficios:**
- ✅ **Ahorro de tokens**: ~150 tokens por mensaje cuando no se necesita contexto
- ✅ **Contexto preciso**: Solo cuando hay cambios relevantes
- ✅ **Actualización automática**: Metadatos del thread se actualizan
- ✅ **Logging detallado**: Razones específicas para debugging

---

## 🎯 Propósito del Contexto de Disponibilidad

### **Problema Resuelto:**
Sin contexto, OpenAI no distingue entre:
- ✅ Disponibilidad ideal (apartamento completo)
- 🔄 Alternativas con traslado (no ideales)
- ❌ Sin disponibilidad

### **Solución Implementada:**
Mensajes específicos que guían a OpenAI sobre:
- 🎯 **Qué tipo de disponibilidad existe**
- 📝 **Cómo presentarla al huésped**
- 🔄 **Cuándo ofrecer alternativas**

---

## 📤 Formatos de Mensaje por Escenario

### **🔴 Escenario 1: Sin Disponibilidad Completa**

**Cuándo:** `completeOptions.length === 0 && splitOptions.length > 0`

**Mensaje enviado:**
```
❌ **No hay Disponibilidad Completa - Solo Parcial con Opción de Traslado**
💡 *Alternativas con cambio de apartamento (ofrecer solo como opción adicional al huésped)*

🔄 **Alternativa 1**: 1 traslado - $630.000
   🏠 1722 A: 2025-07-09 a 2025-07-10 - $420.000
   🔄 1317: 2025-07-11 - $210.000
```

**Comportamiento esperado de OpenAI:**
- ✅ Explicar que NO hay disponibilidad ideal
- ✅ Presentar traslados como "alternativas adicionales"
- ✅ Enfatizar que no es lo regular
- ✅ Dar opción al huésped de considerar otras fechas

---

### **🟢 Escenario 2: Con Disponibilidad Completa**

**Cuándo:** `completeOptions.length > 0`

**Mensaje enviado:**
```
🥇 **Apartamentos Disponibles (1 opciones)**
✅ **1722 B** - $850.000
   📊 $170.000/noche

🔄 **Opciones Adicionales con Traslado**
💡 *Alternativas económicas con cambio de apartamento (opcional para el huésped)*
```

**Comportamiento esperado de OpenAI:**
- ✅ Priorizar opciones completas
- ✅ Presentar traslados como "opciones adicionales económicas"
- ✅ Enfatizar que las opciones completas son lo ideal
- ✅ Mencionar traslados solo como alternativa económica

---

### **⚫ Escenario 3: Sin Disponibilidad**

**Cuándo:** `completeOptions.length === 0 && splitOptions.length === 0`

**Mensaje enviado:**
```
❌ **Sin disponibilidad para 4 noches**
💡 Considera fechas alternativas
```

**Comportamiento esperado de OpenAI:**
- ✅ Informar claramente que no hay disponibilidad
- ✅ Sugerir fechas alternativas
- ✅ Ofrecer ayuda para encontrar otras opciones
- ✅ Mantener tono profesional y servicial

---

## 🔧 Implementación Técnica del Contexto Inteligente

### **Ubicación del código principal:**
```typescript
// src/app-unified.ts (líneas 2261-2308)
const needsTemporalContext = await (async () => {
    const thread = threadPersistence.getThread(userJid);
    if (!thread) return { needed: true, reason: 'primer_mensaje' };
    
    // 1. Verificar tiempo (cada 3 horas)
    const lastActivity = new Date(thread.lastActivity);
    const now = new Date();
    const hoursElapsed = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);
    
    if (hoursElapsed >= 3) {
        return { needed: true, reason: 'tiempo_3h' };
    }
    
    // 2. Verificar cambios en perfil/labels
    const currentProfile = await guestMemory.getOrCreateProfile(userJid);
    const currentChatInfo = await getCachedChatInfo(userJid);
    
    // Comparar nombres
    const currentClientName = currentProfile?.name || 'Cliente';
    const currentContactName = currentChatInfo?.name || currentClientName;
    const storedName = thread.name || thread.userName;
    
    if (currentClientName !== storedName || currentContactName !== storedName) {
        return { needed: true, reason: 'cambio_nombre' };
    }
    
    // Comparar labels
    const profileLabels = currentProfile?.whapiLabels?.map((l: any) => l.name) || [];
    const chatLabels = currentChatInfo?.labels?.map((l: any) => l.name) || [];
    const currentLabels = [...new Set([...profileLabels, ...chatLabels])].sort();
    const storedLabels = (thread.labels || []).sort();
    
    if (JSON.stringify(currentLabels) !== JSON.stringify(storedLabels)) {
        return { needed: true, reason: 'cambio_labels' };
    }
    
    return { needed: false, reason: 'no_cambios' };
})();
```

### **Actualización automática de metadatos:**
```typescript
// src/app-unified.ts (líneas 2377-2416)
if (needsTemporalContext.needed && ['cambio_nombre', 'cambio_labels'].includes(needsTemporalContext.reason)) {
    const updates: any = {};
    
    // Actualizar nombres si cambió
    if (needsTemporalContext.reason === 'cambio_nombre') {
        const currentClientName = currentProfile?.name || 'Cliente';
        const currentContactName = currentChatInfo?.name || currentClientName;
        updates.name = currentClientName;
        updates.userName = currentContactName;
    }
    
    // Actualizar labels si cambió
    if (needsTemporalContext.reason === 'cambio_labels') {
        const profileLabels = currentProfile?.whapiLabels?.map((l: any) => l.name) || [];
        const chatLabels = currentChatInfo?.labels?.map((l: any) => l.name) || [];
        updates.labels = [...new Set([...profileLabels, ...chatLabels])];
    }
    
    threadPersistence.updateThreadMetadata(userJid, updates);
}
```

### **Lógica de decisión de disponibilidad:**
```javascript
// src/handlers/integrations/beds24-availability.ts
function formatOptimizedResponse(result: OptimizedResult, startDate: string, endDate: string): string
```

---

## 📊 Impacto en la Experiencia del Usuario

### **Antes (sin contexto):**
- 🔄 OpenAI presentaba traslados como opciones normales
- ❌ No distinguía entre ideal vs alternativa
- 😕 Huésped no entendía por qué había traslados

### **Después (con contexto):**
- ✅ OpenAI explica la situación claramente
- ✅ Prioriza opciones ideales
- ✅ Presenta traslados como alternativas adicionales
- 😊 Huésped entiende las opciones disponibles

---

## 🧪 Testing y Validación

### **Comandos de prueba:**
```bash
# Escenario sin disponibilidad completa
npx tsx tests/beds24/test-beds24.js format 2025-07-09 2025-07-11

# Escenario con disponibilidad completa
npx tsx tests/beds24/test-beds24.js format 2025-07-17 2025-07-21

# Escenario sin disponibilidad
npx tsx tests/beds24/test-beds24.js format 2025-07-09 2025-07-12
```

### **Métricas de validación:**
- ✅ Mensaje correcto según escenario
- ✅ Contexto apropiado para OpenAI
- ✅ Instrucciones claras sobre presentación
- ✅ Longitud de mensaje optimizada (~168 tokens)

---

## 🔄 Mantenimiento

### **Actualizaciones futuras:**
- 📝 Ajustar mensajes según feedback de usuarios
- 🎯 Optimizar tokens para reducir costos
- 🔧 Agregar más contexto si es necesario
- 📊 Monitorear efectividad en conversaciones reales

### **Consideraciones:**
- 💰 **Tokens**: Mensajes más largos = más costo
- 🎯 **Claridad**: Balance entre contexto y brevedad
- 🔄 **Consistencia**: Mantener formato uniforme
- 📈 **Efectividad**: Medir impacto en satisfacción del cliente

---

---

## 📈 **Métricas del Sistema Inteligente**

### **Ahorro de Tokens por Mensaje:**
| Condición | Tokens Previos | Tokens Actuales | Ahorro |
|-----------|----------------|-----------------|--------|
| 🔄 Contexto innecesario | ~300 | ~150 | **50%** |
| ⏰ Primer mensaje | ~300 | ~300 | 0% |
| 👤 Cambio nombre | ~300 | ~300 | 0% |
| 🏷️ Cambio labels | ~300 | ~300 | 0% |

### **Frecuencia Esperada:**
- **🔄 Sin contexto**: ~70% de mensajes (ahorro significativo)
- **⏰ Con contexto**: ~30% de mensajes (cuando es necesario)

### **Logging para Monitoreo:**
```typescript
logInfo('CONTEXT_DEBUG', 'Contexto enviado a OpenAI', {
    needsTemporalContext: needsTemporalContext.needed,
    contextReason: needsTemporalContext.reason, // 'tiempo_3h', 'cambio_nombre', etc.
    contextTokensSaved: needsTemporalContext.needed ? 0 : ~150
});
```

---

**📅 Última actualización:** Julio 26, 2025 - Versión 2.0 (Sistema Inteligente)
**🔗 Relacionado:** [Thread Persistence](../../utils/persistence/threadPersistence.ts) | [Beds24 Integration](../../integrations/beds24/README.md) 