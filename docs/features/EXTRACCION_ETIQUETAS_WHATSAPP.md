# Extracción de Etiquetas desde WhatsApp API

## 🔍 Proceso de Extracción

### 1. Endpoint de WhatsApp API
Las etiquetas se obtienen del endpoint de información del chat:
```
GET https://gate.whapi.cloud/chats/{CHAT_ID}?token={TOKEN}
```

### 2. Estructura de la Respuesta
```json
{
  "id": "573003913251@s.whatsapp.net",
  "name": "Alexander",
  "first_name": "Alex",
  "labels": [
    {
      "id": "9",
      "name": "Colega Jefe",
      "color": "rebeccapurple"
    },
    {
      "id": "10",
      "name": "cotización",
      "color": "lightskyblue"
    }
  ],
  "last_message": {
    "timestamp": 1736489164
  },
  "profile_pic_url": "https://..."
}
```

### 3. Función de Extracción
```javascript
// En src/app.ts - getEnhancedContactInfo
async function getEnhancedContactInfo(userId, chatId) {
    const endpoint = `${WHAPI_API_URL}/chats/${encodeURIComponent(chatId)}?token=${WHAPI_TOKEN}`;
    
    const response = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.ok) {
        const chatData = await response.json();
        
        return {
            name: chatData.name || chatData.first_name || 'Usuario',
            labels: chatData.labels || [],  // Array de etiquetas
            lastSeen: chatData.last_message?.timestamp,
            isContact: !!chatData.name,
            profilePic: chatData.profile_pic_url
        };
    }
}
```

## 📊 Formato de Etiquetas

### Estructura de una Etiqueta
```typescript
interface Label {
    id: string;         // ID único de la etiqueta
    name: string;       // Nombre visible de la etiqueta
    color?: string;     // Color de la etiqueta (opcional)
    count?: number;     // Número de chats con esta etiqueta (opcional)
}
```

### Colores Disponibles
- `blue`
- `green`
- `yellow`
- `red`
- `orange`
- `purple`
- `rebeccapurple`
- `lightskyblue`
- `gray`

## 🔄 Flujo de Actualización

### 1. Recepción de Mensaje (Webhook)
```javascript
// Cuando llega un mensaje del cliente
for (const message of messages) {
    const userId = message.from;
    const chatId = message.chat_id;
    
    // Obtener info actualizada incluyendo etiquetas
    getEnhancedContactInfo(shortUserId, chatId).then(enhancedInfo => {
        if (existingThread) {
            // Actualizar metadatos incluyendo labels
            threadPersistence.updateThreadMetadata(shortUserId, {
                name: enhancedInfo.name,
                labels: enhancedInfo.labels,  // Actualización automática
                userName: cleanName,
                chatId: chatId
            });
        }
    });
}
```

### 2. Persistencia Local
Las etiquetas se guardan en `tmp/threads.json`:
```json
{
  "573003913251": {
    "threadId": "thread_91KP5Q2ZZfDCUKLWVUFGkKyN",
    "chatId": "573003913251@s.whatsapp.net",
    "userName": "Alexander",
    "name": "Sr Alex",
    "labels": [
      {
        "id": "9",
        "name": "Colega Jefe",
        "color": "rebeccapurple"
      },
      {
        "id": "10",
        "name": "cotización",
        "color": "lightskyblue"
      }
    ],
    "lastActivity": "2025-07-04T00:06:04.344Z"
  }
}
```

## 🛠️ Herramientas de Prueba

### 1. Verificar Etiquetas de un Chat
```bash
# Usando el archivo de prueba existente
node tests/whapi/test-chat-specific.js 573003913251@s.whatsapp.net

# Salida esperada:
👤 Contacto: Alexander
🏷️  Etiquetas: Colega Jefe, cotización
📊 Mensajes: 200 de 1543 totales
```

### 2. Probar Actualización Automática
```bash
# Probar actualización de etiquetas
node tests/test-labels-update.js 573003913251

# Salida esperada:
🧪 TEST DE ACTUALIZACIÓN AUTOMÁTICA DE ETIQUETAS
═══════════════════════════════════════════════════════════
📌 ESTADO INICIAL DEL THREAD
🏷️  Etiquetas: Colega Jefe, cotización

📱 INFORMACIÓN DE WHATSAPP
🏷️  Etiquetas: Colega Jefe (rebeccapurple), cotización (lightskyblue)

📊 COMPARACIÓN DE ESTADOS
✅ ETIQUETAS ACTUALIZADAS
```

## 📝 Logging de Etiquetas

### Eventos de Log Principales
```javascript
// Cuando se actualizan etiquetas
logInfo('LABELS_UPDATED', `Labels actualizadas para ${shortUserId}`, {
    userName: cleanName,
    enhancedName: enhancedInfo.name,
    labelsCount: enhancedInfo.labels?.length || 0,
    labels: enhancedInfo.labels,
    isContact: enhancedInfo.isContact
});

// En el contexto conversacional
logInfo('CONTEXT_LABELS', `Etiquetas incluidas en contexto conversacional`, {
    userId: threadInfo.userId,
    name: name,
    userName: userName,
    labels: labels,
    labelsCount: labels.length
});
```

## 🎯 Casos de Uso

### 1. Cliente Sin Etiquetas
- Se extrae array vacío: `labels: []`
- Se actualiza igualmente para mantener sincronización
- En el contexto no se muestra línea de etiquetas

### 2. Cliente con Múltiples Etiquetas
- Se extraen todas las etiquetas del array
- Se preserva información completa (id, name, color)
- En el contexto se muestran como lista separada por comas

### 3. Etiquetas Modificadas Externamente
- Al recibir siguiente mensaje se actualiza automáticamente
- No requiere reiniciar el bot
- Cambios se reflejan en siguiente interacción

## 🔐 Seguridad y Validación

### Validación de Datos
```javascript
// Siempre usar valor por defecto
const labels = chatData.labels || [];

// Validar estructura antes de usar
if (threadInfo.labels && threadInfo.labels.length > 0) {
    const labelNames = threadInfo.labels.map(label => {
        if (typeof label === 'object' && label.name) {
            return label.name;
        }
        return label;
    });
}
```

### Manejo de Errores
```javascript
getEnhancedContactInfo(shortUserId, chatId)
    .then(enhancedInfo => {
        // Procesar etiquetas
    })
    .catch(err => {
        logWarning('LABELS_UPDATE_ERROR', `Error actualizando labels`, { 
            error: err.message 
        });
    });
```

## 📚 Referencias

- [WhatsApp Business API - Get Chat](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/chats)
- [Whapi Documentation - Chat Methods](https://whapi.readme.io/reference/getchat) 