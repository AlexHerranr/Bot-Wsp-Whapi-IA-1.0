# 🚀 PRÓXIMA IMPLEMENTACIÓN: Enriquecimiento de Contexto para OpenAI

*Estado: EN DESARROLLO*

---

## 🎯 **IMPLEMENTACIÓN ACTUAL: CONTEXTO ENRIQUECIDO**

### **1. Envío de Identidad y Metadatos del Cliente**

**Qué hacer:**
1. Modificar `processWithOpenAI()` en `src/app.ts`
2. Agregar bloque de identidad antes del mensaje
3. Incluir nombre completo y etiquetas

**Código a implementar:**
```typescript
// En processWithOpenAI()
const threadInfo = threadPersistence.getThread(shortUserId);
const clientName = threadInfo?.name || threadInfo?.userName || 'Cliente';
const labels = threadInfo?.labels || [];

// Construir contexto enriquecido
let enrichedMessage = '';

// Agregar identidad del cliente
enrichedMessage += 'IDENTIDAD DEL CLIENTE:\n';
enrichedMessage += `- Nombre: ${clientName}\n`;
if (labels.length > 0) {
    enrichedMessage += `- Etiquetas: [${labels.join(', ')}]\n`;
}
enrichedMessage += '\n';

// Agregar mensaje actual
enrichedMessage += 'MENSAJE ACTUAL DEL CLIENTE:\n';
enrichedMessage += userMsg;
```

### **2. Obtener Historial de Chat (Si No Hay Thread)**

**Crear nuevo archivo:** `src/utils/whapi/chat-history.ts`
```typescript
export async function getChatHistory(chatId: string) {
    const response = await fetch(
        `${WHAPI_API_URL}/chats/${encodeURIComponent(chatId)}`,
        { headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` } }
    );
    
    const data = await response.json();
    return {
        name: data.name,
        labels: data.labels?.map(l => l.name) || [],
        lastMessage: data.last_message
    };
}
```

**Integrar en `processWithOpenAI()`:**
```typescript
// Si no hay thread, obtener historial
if (!existingThreadId) {
    const history = await getChatHistory(chatId);
    enrichedMessage += 'CONTEXTO: HISTORIAL RECIENTE\n';
    enrichedMessage += `Última interacción: ${history.lastMessage?.text?.body || 'Sin historial'}\n\n`;
}
```

---

## 📅 **TIMELINE ESTA SEMANA**

**Lunes-Martes:**
- ✅ Implementar envío de identidad/metadatos
- ✅ Probar con usuarios existentes

**Miércoles-Jueves:**
- ✅ Crear función getChatHistory
- ✅ Integrar historial para usuarios nuevos
- ✅ Pruebas con contexto completo

**Viernes:**
- ✅ Ajustes finales
- ✅ Documentación actualizada

---

## 🔥 **SIGUIENTE: escalate_to_human()**

Una vez completado el enriquecimiento de contexto, procederemos con:

### **Función de Escalamiento Automático**
- Detectar necesidad de agente humano
- Notificar vía WhatsApp al agente apropiado
- Transferir contexto completo

**Casos de uso:**
```javascript
// Cliente listo para reservar
escalate_to_human("complete_booking", context)

// Sin disponibilidad
escalate_to_human("no_availability", context)

// Problema técnico
escalate_to_human("technical_issue", context)
```

---

## 📊 **BENEFICIO ESPERADO**

### **ANTES:**
```
Bot: "Hola, ¿en qué puedo ayudarte?"
(Sin contexto de quién es el cliente)
```

### **DESPUÉS:**
```
Bot conoce:
- Nombre: Alexander (Pa'Cartagena 🏖️)
- Etiquetas: [VIP, Cliente Frecuente]
- Historial: "Reservó en julio pasado"

Bot: "¡Hola Alexander! Veo que eres uno de nuestros clientes VIP. ¿Buscas otra escapada a Cartagena?"
```

---

**🎯 RESULTADO:** Bot más personalizado y consciente del contexto, mejorando significativamente la experiencia del usuario. 