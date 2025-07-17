# Sistema de Entrada Manual de Agentes

## 🎯 Propósito
Permitir que los agentes humanos respondan directamente a los clientes desde la aplicación móvil de WhatsApp, registrando estas respuestas en la terminal y sincronizándolas con OpenAI para mantener el contexto de la conversación.

## 🔧 Cómo Funciona

### 1. **Detección de Mensajes Manuales**
```typescript
// El sistema detecta mensajes con from_me: true (enviados por el agente)
if (message.from_me && message.type === 'text' && message.text?.body) {
    // Procesar entrada manual del agente
}
```

### 2. **Filtrado de Mensajes del Bot**
```typescript
// Evita procesar mensajes automáticos del bot
if (botSentMessages.has(message.id)) {
    logDebug('BOT_MESSAGE_FILTERED', `Mensaje del bot ignorado: ${message.id}`);
    continue; // Saltar, no es un mensaje manual real
}
```

### 3. **Validación de Thread Activo**
```typescript
// Verifica que exista una conversación activa
const threadRecord = threadPersistence.getThread(shortClientId);
if (!threadRecord) {
    console.log(`⚠️  [AGENT] Sin conversación activa con ${shortClientId}`);
    continue; // El cliente debe escribir primero
}
```

## 📋 Flujo de Procesamiento

### 1. **Recepción del Mensaje**
```
Agente escribe en WhatsApp → Webhook recibe mensaje from_me: true → Sistema detecta entrada manual
```

### 2. **Buffering (5 segundos)**
```
Mensaje → Buffer global → Timer 5s → Agrupar múltiples mensajes → Procesar
```

### 3. **Sincronización con OpenAI**
```
1. Agregar nota del sistema: "[NOTA DEL SISTEMA: Un agente humano (Nombre) ha respondido directamente al cliente]"
2. Agregar mensaje del agente como 'assistant'
3. Actualizar thread en persistencia
```

## 📊 Logs y Monitoreo

### Logs en Terminal
```typescript
// Primer mensaje del grupo
console.log(`🔧 [AGENT] ${fromName} → ${clientName}: "${text.substring(0, 25)}..."`);

// Procesamiento completado
console.log(`✅ [BOT] Enviado a 🤖 OpenAI → Contexto actualizado (${msgCount})`);

// Error de sincronización
console.log(`❌ [AGENT] Error sincronizando con OpenAI: ${error.message}`);
```

### Logs Técnicos
```typescript
// Detección
logInfo('MANUAL_DETECTED', `Mensaje manual del agente detectado`, {
    shortClientId: shortClientId,
    agentName: fromName,
    messageText: text.substring(0, 100),
    messageLength: text.length,
    timestamp: new Date().toISOString(),
    chatId: chatId
});

// Sincronización exitosa
logSuccess('MANUAL_SYNC_SUCCESS', `Mensajes manuales sincronizados exitosamente`, {
    shortClientId: shortClientId,
    agentName: finalBuffer.userName,
    messageCount: finalBuffer.messages.length,
    totalLength: combinedMessage.length,
    preview: combinedMessage.substring(0, 100),
    threadId: threadRecord.threadId,
    timestamp: new Date().toISOString()
});
```

## 🔄 Integración con Buffer Unificado

### Uso del Buffer Global
```typescript
// Los mensajes manuales usan el mismo buffer que los mensajes normales
const buffer = globalMessageBuffers.get(chatId)!;
buffer.messages.push(text);
buffer.lastActivity = Date.now();

// Timer de 5 segundos (igual que mensajes normales)
buffer.timer = setTimeout(async () => {
    // Procesar mensajes agrupados
}, BUFFER_WINDOW_MS);
```

### Beneficios
- **Consistencia**: Mismo comportamiento que mensajes normales
- **Simplicidad**: Un solo sistema de buffer
- **Agrupación**: Múltiples mensajes del agente se agrupan automáticamente

## 🎯 Contexto en OpenAI

### Nota del Sistema (INSTRUCCIÓN SIMPLE)
```typescript
// Se agrega automáticamente antes del mensaje del agente
await openaiClient.beta.threads.messages.create(threadRecord.threadId, {
    role: 'user',
    content: `[Mensaje manual escrito por agente ${finalBuffer.userName} - NO RESPONDER]`
});
```

### Mensaje del Agente
```typescript
// El mensaje del agente se agrega como 'assistant'
await openaiClient.beta.threads.messages.create(threadRecord.threadId, {
    role: 'assistant',
    content: combinedMessage
});
```

### 🚨 **Protección Simple contra Respuestas Automáticas**

1. **Nota del Sistema**: `[Mensaje manual escrito por agente Juan - NO RESPONDER]`
2. **Mensaje del Agente**: Se registra como respuesta ya dada

**Resultado**: OpenAI entiende claramente que NO debe responder porque un agente humano ya se encargó de la respuesta.

## ✅ Casos de Uso

### 1. **Respuesta Directa del Agente**
```
Cliente: "¿Tienen disponibilidad para el 15 de enero?"
Agente: "Sí, tenemos un apartamento disponible. Te envío los detalles."
→ Sistema registra y sincroniza con OpenAI
```

### 2. **Múltiples Mensajes del Agente**
```
Agente: "Hola, veo tu consulta."
Agente: "Tenemos disponibilidad en el apartamento 1722."
Agente: "¿Te interesa que te envíe más información?"
→ Sistema agrupa los 3 mensajes y los sincroniza juntos
```

### 3. **Sin Conversación Activa**
```
Agente intenta escribir sin que el cliente haya iniciado conversación
→ Sistema muestra: "⚠️ [AGENT] Sin conversación activa con [cliente]"
```

## 🚨 Validaciones y Seguridad

### 1. **Filtrado de Mensajes del Bot**
- Evita procesar mensajes automáticos del bot
- Solo procesa mensajes manuales reales del agente

### 2. **Validación de Thread**
- Requiere conversación activa
- El cliente debe haber escrito primero

### 3. **Manejo de Errores**
- Logs detallados de errores de sincronización
- No interrumpe el flujo normal del bot

## 📈 Métricas y Monitoreo

### Health Check
```typescript
// El endpoint /health incluye información de buffers activos
{
    activeBuffers: globalMessageBuffers.size, // Incluye buffers manuales
    // ... otros stats
}
```

### Logs Estructurados
- `MANUAL_DETECTED`: Detección de mensaje manual
- `MANUAL_BUFFERING`: Agregado al buffer
- `MANUAL_PROCESSING`: Procesamiento iniciado
- `MANUAL_SYNC_SUCCESS`: Sincronización exitosa
- `MANUAL_SYNC_ERROR`: Error de sincronización

## 🎯 Resultado Final

**El sistema permite que los agentes:**
1. **Respondan directamente** desde WhatsApp móvil
2. **Mantengan contexto** en OpenAI
3. **Registren actividad** en terminal
4. **Agrupen mensajes** automáticamente
5. **Sincronicen** con el historial de conversación

**Beneficios:**
- ✅ **Flexibilidad**: Agentes pueden intervenir cuando sea necesario
- ✅ **Contexto**: OpenAI mantiene historial completo
- ✅ **Transparencia**: Logs claros de actividad manual
- ✅ **Simplicidad**: Mismo buffer que mensajes normales
- ✅ **Robustez**: Manejo de errores y validaciones 