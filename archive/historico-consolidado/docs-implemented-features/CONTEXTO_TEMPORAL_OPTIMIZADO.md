# 🕐 Contexto Temporal Optimizado

## 📋 **Descripción**

Sistema de contexto temporal que proporciona información clara y estructurada a OpenAI sobre la fecha, hora, cliente y contacto, optimizado para minimizar el consumo de tokens.

## 🎯 **Objetivos**

- ✅ **Información temporal precisa**: Fecha y hora en formato AM/PM
- ✅ **Identificación clara del cliente**: Nombres específicos y diferenciados
- ✅ **Optimización de tokens**: Sin emojis para reducir consumo
- ✅ **Cache eficiente**: TTL de 1 hora para evitar regeneración
- ✅ **Formato IA-friendly**: Estructura clara para mejor comprensión
- ✅ **División inteligente de mensajes**: Párrafos separados para mejor UX

## 🔧 **Implementación**

### **Función Principal**
```typescript
async function getRelevantContext(userId: string, requestId?: string): Promise<string>
```

### **Formato del Contexto**
```
Fecha: 20/07/2025 | Hora: 1:28 AM (Colombia)
Cliente: Pa'Cartagena | Contacto WhatsApp: Pa'Cartagena | Status: nuevo
---
Mensaje del cliente:
```

### **División Inteligente de Mensajes**
```typescript
async function sendWhatsAppMessage(chatId: string, message: string)
```

**Características:**
- **División por párrafos**: Detecta dobles saltos de línea
- **Agrupación de listas**: Mantiene bullets juntos
- **Typing diferenciado**: 3s primer mensaje, 2s siguientes
- **Pausa entre mensajes**: 500ms para mejor UX

## 📊 **Ejemplos de Funcionamiento**

### **Contexto Temporal Enviado a OpenAI**
```
Fecha: 20/07/2025 | Hora: 1:28 AM (Colombia)
Cliente: Pa'Cartagena | Contacto WhatsApp: Pa'Cartagena
---
Mensaje del cliente:
Hola, necesito información sobre disponibilidad
```

### **División de Mensajes Largos**
**Entrada de OpenAI:**
```
¡Hola! Me alegra poder ayudarte con tu reserva.

Tenemos varias opciones disponibles:

**Opción 1 - Apartaestudio Vista Mar**:
• Capacidad: 2-4 personas
• Precio: $170.000/noche
• Vista directa al mar

¿Cuál te gustaría reservar?
```

**Salida en WhatsApp:**
1. **Mensaje 1**: "¡Hola! Me alegra poder ayudarte con tu reserva."
2. **Mensaje 2**: "Tenemos varias opciones disponibles:"
3. **Mensaje 3**: "**Opción 1 - Apartaestudio Vista Mar**:\n• Capacidad: 2-4 personas\n• Precio: $170.000/noche\n• Vista directa al mar"
4. **Mensaje 4**: "¿Cuál te gustaría reservar?"

## ⚙️ **Configuración**

### **Cache TTL**
```typescript
const CONTEXT_CACHE_TTL = 60 * 60 * 1000; // 1 hora
```

### **Detección de Reinicio**
```typescript
const isFirstMessageAfterRestart = !cached || (now - cached.timestamp) > CONTEXT_CACHE_TTL;
```

## 📈 **Métricas y Logs**

### **Logs de Contexto**
```javascript
[INFO] CONTEXT_FRESH_RESTART: Generando contexto fresco después del reinicio
[INFO] CONTEXT_CACHE_HIT: Contexto temporal desde cache
[INFO] CONTEXT_DEBUG: Contexto enviado a OpenAI
```

### **Logs de División de Mensajes**
```javascript
[INFO] WHATSAPP_CHUNKS: Dividiendo mensaje largo en 4 párrafos
[SUCCESS] WHATSAPP_CHUNKS_COMPLETE: Todos los párrafos enviados exitosamente
```

### **Indicadores en Consola**
```
✅ [BOT] Completado (4.2s) → 💬 4 párrafos
📄 [BOT] Enviando 4 párrafos...
```

## 🎯 **Beneficios**

### **Para la IA**
- ✅ **Contexto claro**: Fecha, hora y nombres específicos
- ✅ **Menos tokens**: Formato optimizado sin emojis
- ✅ **Cache eficiente**: Evita regeneración innecesaria

### **Para el Usuario**
- ✅ **Respuestas naturales**: Simula escritura humana
- ✅ **Mejor legibilidad**: Mensajes más cortos y digeribles
- ✅ **Typing indicators**: Muestra "escribiendo..." entre mensajes
- ✅ **Agrupación inteligente**: Mantiene listas y bullets juntos

### **Para el Sistema**
- ✅ **Performance optimizada**: Solo divide cuando es necesario
- ✅ **Manejo de errores**: Control por chunk individual
- ✅ **Logs detallados**: Monitoreo completo del proceso

## 🔄 **Flujo de Funcionamiento**

1. **Recepción de mensaje** → Buffer global (5s)
2. **Generación de contexto** → Cache TTL 1 hora
3. **Envío a OpenAI** → Contexto + mensaje del cliente
4. **Procesamiento de respuesta** → Detección de párrafos
5. **División inteligente** → Por dobles saltos o bullets
6. **Envío secuencial** → Con typing indicators y pausas
7. **Logs completos** → Monitoreo de todo el proceso

## 📝 **Notas Técnicas**

- **Primer mensaje después del reinicio**: Siempre genera contexto fresco
- **Cache hit**: Usa contexto cacheado si no ha expirado
- **División automática**: Detecta párrafos y listas automáticamente
- **Fallback**: Si no puede dividir, envía mensaje completo
- **Error handling**: Manejo individual por chunk 