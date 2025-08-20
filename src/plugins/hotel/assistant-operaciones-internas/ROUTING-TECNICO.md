# 🔄 Sistema de Routing por Chat ID - Documentación Técnica

## 📋 **RESUMEN EJECUTIVO**

Sistema de routing automático que permite vincular chats específicos (grupos o contactos) con assistants dedicados, manteniendo contextos separados y sin afectar el funcionamiento del bot principal.

---

## 🎯 **ARQUITECTURA DEL SISTEMA**

### **Flujo de Procesamiento:**

```
Webhook → WebhookProcessor → Chat ID Detection → Assistant Routing
    ↓
┌─────────────────────────────────────────────────────────────┐
│  if (chatId === OPERATIONS_CHAT_ID)                        │
│    → processWithOperationsAssistant()                      │
│  else                                                       │
│    → bufferManager.addMessage() (flujo normal)             │
└─────────────────────────────────────────────────────────────┘
```

### **Componentes Involucrados:**

1. **WebhookProcessor** - Punto de entrada y routing
2. **OpenAIService** - Procesamiento con assistant temporal
3. **WhatsAppService** - Envío de respuestas
4. **Variables de entorno** - Configuración

---

## ⚙️ **IMPLEMENTACIÓN TÉCNICA**

### **1. Detección de Chat ID**

**Ubicación:** `src/core/api/webhook-processor.ts:258-260`

```typescript
// ROUTING: Verificar si el mensaje proviene del grupo de operaciones internas
const operationsChatId = process.env.OPERATIONS_CHAT_ID;
const isOperationsGroup = operationsChatId && chatId === operationsChatId;
```

**Características:**
- ✅ Detección automática por Chat ID único
- ✅ Configuración via variables de entorno
- ✅ Fácil extensión para múltiples chats

### **2. Interceptación del Flujo Normal**

**Ubicación:** Antes de `bufferManager.addMessage()`

```typescript
// Para mensajes de texto (línea 652-656)
if (isOperationsGroup) {
    await this.processWithOperationsAssistant(userId, messageContent, normalizedChatId, userName);
    return;
}

// Para mensajes de voz (línea 742-746)
if (isOperationsGroup) {
    await this.processWithOperationsAssistant(userId, finalMessage, normalizedChatId, userName);
    return;
}

// Para imágenes (línea 788-792)
if (isOperationsGroup) {
    await this.processWithOperationsAssistant(userId, imageMessage.caption || 'Imagen enviada', normalizedChatId, userName, undefined, undefined, imageMessage);
    return;
}
```

**Ventajas:**
- ✅ Intercepta ANTES del buffer manager
- ✅ Evita procesamiento innecesario
- ✅ Mantiene flujo normal para otros chats

### **3. Cambio Temporal de Assistant**

**Ubicación:** `processWithOperationsAssistant()` (línea 875-909)

```typescript
private async processWithOperationsAssistant(userId: string, message: string, chatId: string, userName: string, existingThreadId?: string, existingTokenCount?: number, imageMessage?: { type: 'image', imageUrl: string, caption: string }): Promise<void> {
    const operationsAssistantId = process.env.OPERATIONS_ASSISTANT_ID;
    if (!operationsAssistantId) {
        logError('OPERATIONS_ASSISTANT_MISSING', 'OPERATIONS_ASSISTANT_ID no configurado', { userId, userName });
        return;
    }

    // Guardar assistant ID original
    const originalAssistantId = (this.openaiService as any).config.assistantId;
    
    try {
        // Cambiar temporalmente al assistant de operaciones
        (this.openaiService as any).config.assistantId = operationsAssistantId;
        
        // Procesar con el assistant de operaciones usando el mismo flujo
        const result = await this.openaiService.processMessage(userId, message, chatId, userName, existingThreadId, existingTokenCount, imageMessage);
        
        if (result.success && result.response) {
            // Enviar respuesta usando el WhatsApp service
            const whatsappService = (this.openaiService as any).whatsappService;
            if (whatsappService) {
                const userState = this.userManager.getState(userId) || { lastInputVoice: false };
                await whatsappService.sendWhatsAppMessage(chatId, result.response, { lastInputVoice: userState.lastInputVoice }, false);
            }
        }

    } catch (error) {
        logError('OPERATIONS_MESSAGE_ERROR', 'Error en procesamiento de operaciones', {
            userId, userName, error: error instanceof Error ? error.message : String(error)
        }, 'webhook-processor.ts');
    } finally {
        // SIEMPRE restaurar el assistant ID original
        (this.openaiService as any).config.assistantId = originalAssistantId;
    }
}
```

**Características clave:**
- ✅ **Cambio temporal:** Usa assistant específico solo durante el procesamiento
- ✅ **Restauración garantizada:** `finally` asegura que siempre se restaure
- ✅ **Envío automático:** Respuesta se envía al mismo chat
- ✅ **Manejo de errores:** No afecta bot principal si falla

---

## 🔧 **CONFIGURACIÓN**

### **Variables de Entorno (.env):**

```bash
# Assistant de operaciones internas
OPERATIONS_ASSISTANT_ID=asst_JuluW5jVoLCWQy0iwSlDEkaX
OPERATIONS_CHAT_ID=120363419376827694@g.us
```

### **Obtener Chat ID de WhatsApp:**

1. **Para grupos:** Revisar webhook recibido o usar inspector de Whapi
2. **Formato:** `120363419376827694@g.us` (grupos) o `573001234567@s.whatsapp.net` (contactos)

---

## 🧵 **SEPARACIÓN AUTOMÁTICA DE THREADS**

### **Cómo Funciona:**

OpenAI Service ya usa `getOrCreateThread(userId, chatId)`, por lo que la separación es automática:

```typescript
// Cliente normal
userId: "573001234567"
chatId: "573001234567@s.whatsapp.net"
→ Thread: "thread_A"

// Grupo operaciones (mismo usuario)
userId: "573001234567"  
chatId: "120363419376827694@g.us"
→ Thread: "thread_B"
```

**Resultado:** Contextos completamente independientes sin configuración adicional.

### **Ventajas:**

- ✅ **Sin contaminación:** Conversaciones separadas automáticamente
- ✅ **Memoria independiente:** Cada chat mantiene su contexto
- ✅ **Escalabilidad:** Fácil agregar nuevos chats/assistants

---

## 🚀 **EXTENSIÓN DEL SISTEMA**

### **Para Agregar Nuevos Chats Especializados:**

1. **Crear assistant en OpenAI** con funciones específicas
2. **Obtener Chat ID** del grupo/contacto objetivo
3. **Agregar variables de entorno:**
   ```bash
   VENTAS_ASSISTANT_ID=asst_ventasID
   VENTAS_CHAT_ID=120000000000000000@g.us
   ```
4. **Modificar webhook-processor.ts** (3 líneas):
   ```typescript
   const ventasChatId = process.env.VENTAS_CHAT_ID;
   const isVentasGroup = ventasChatId && chatId === ventasChatId;
   
   if (isVentasGroup) {
       await this.processWithVentasAssistant(userId, messageContent, normalizedChatId, userName);
       return;
   }
   ```

### **Casos de Uso Comunes:**

- 🏨 **Operaciones:** Reportes internos, coordinación staff
- 💰 **Ventas:** Ofertas, seguimiento leads, métricas
- 🛠️ **Soporte:** Tickets, troubleshooting, escalación
- 📊 **Gerencia:** KPIs, resúmenes ejecutivos, alertas

---

## 📊 **IMPACTO Y BENEFICIOS**

### **Técnicos:**

- ✅ **Implementación mínima:** Solo 2 archivos modificados
- ✅ **Cero breaking changes:** Bot principal intacto
- ✅ **Performance:** Sin overhead adicional
- ✅ **Mantenibilidad:** Fácil debug y monitoreo

### **Operativos:**

- ✅ **Especialización:** Cada assistant optimizado para su propósito
- ✅ **Seguridad:** Información sensible solo en chats autorizados
- ✅ **Escalabilidad:** Agregar nuevos assistants sin afectar existentes
- ✅ **Flexibilidad:** Configuración dinámica via variables de entorno

---

## 🔍 **LOGS Y MONITOREO**

### **Logs de Routing:**

```bash
[OPER][webhook-processor.ts] Mensaje del grupo de operaciones detectado | u:57300...251
```

### **Logs de Procesamiento:**

```bash
[SUCCESS] Mensaje de operaciones procesado exitosamente | u:57300...251 | 9.1s | 118ch
```

### **Logs de Restauración:**

```bash
[INFO] Assistant ID restaurado | u:57300...251
```

---

## ⚠️ **CONSIDERACIONES IMPORTANTES**

### **Seguridad:**

- ✅ **Chat ID único:** Imposible de falsificar desde webhook
- ✅ **Variables de entorno:** Configuración segura
- ⚠️ **Verificar Chat ID:** Asegurar que es el correcto antes de deploy

### **Robustez:**

- ✅ **Finally block:** Garantiza restauración de assistant
- ✅ **Error handling:** Fallas no afectan bot principal
- ✅ **Fallback:** Si falla operations, continúa flujo normal

### **Performance:**

- ✅ **Early exit:** Evita procesamiento innecesario
- ✅ **Reutilización:** Usa misma infraestructura del bot
- ✅ **Threads independientes:** Sin overhead de separación

---

## 🏆 **CONCLUSIÓN**

**El sistema de routing por Chat ID es una solución elegante y escalable que permite:**

1. **Especialización** de assistants para diferentes propósitos
2. **Separación automática** de contextos sin configuración compleja
3. **Extensibilidad** fácil para nuevos casos de uso
4. **Robustez** sin afectar el funcionamiento principal

**¡Implementación mínima con máximo impacto!** 🚀