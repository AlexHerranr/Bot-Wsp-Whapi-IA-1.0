# 📋 GuestMemory.js - Sistema de Perfiles de Huéspedes

## 🎯 Objetivo

`GuestMemory.js` es un sistema de persistencia que mantiene una base de datos local de perfiles de huéspedes de WhatsApp, extrayendo información automáticamente de los webhooks de mensajes y sincronizando datos adicionales desde los endpoints de WHAPI.

## Archivo de Datos

```markdown:src/utils/persistence/README.md
<code_block_to_apply_changes_from>
```
tmp/guest_profiles.json
```

## 🔄 ¿Qué hace GuestMemory?

### **1. Creación Automática de Perfiles**
- Detecta cuando llega un mensaje de un usuario nuevo
- Crea automáticamente un perfil con datos del webhook
- Extrae nombre del usuario desde `message.chat_name`

### **2. Sincronización con WHAPI**
- Llama al endpoint `/chats/{id}` para obtener datos completos
- Sincroniza etiquetas del usuario desde WHAPI
- Obtiene el nombre real del perfil de WhatsApp
- Recupera el último mensaje del chat

### **3. Gestión Completa de Threads de OpenAI**
- Mantiene el ID del último thread usado
- Registra la última actualización del thread
- Almacena el último assistant utilizado
- Cuenta mensajes en el thread actual
- Permite continuar conversaciones existentes

### **4. Sistema de Cache Inteligente**
- Cache de 5 minutos para evitar llamadas repetidas a WHA
```

##  Campos y Fuentes

| Campo | Descripción | Fuente |
|-------|-------------|--------|
| `id` | ID del usuario | Webhook `message.from` |
| `name` | Nombre del usuario | Webhook `message.chat_name` |
| `phone` | Número de teléfono | Webhook `message.from` |
| `label` | Etiqueta principal | WHAPI `/chats/{id}` → `labels[0].name` |
| `whapiLabels` | Todas las etiquetas | WHAPI `/chats/{id}` → `labels` |
| `firstInteraction` | Primera interacción | Timestamp cuando se crea el perfil |
| `lastInteraction` | Última interacción | Timestamp del último mensaje |
| `whatsappName` | Nombre del perfil de WhatsApp | WHAPI `/chats/{id}` → `name` |
| `lastMessage` | Último mensaje desde WHAPI | WHAPI `/chats/{id}` → `last_message` |

## 📄 Ejemplo del Archivo

```json
[
  [
    "573003913251",
    {
      "id": "573003913251",
      "name": "Sr Alex",
      "phone": "573003913251",
      "label": "cliente",
      "whapiLabels": [
        {"name": "cliente", "id": "123", "color": "blue"},
        {"name": "activo", "id": "456", "color": "green"}
      ],
      "firstInteraction": "2025-07-21T23:30:00.000Z",
      "lastInteraction": "2025-07-21T23:33:29.715Z",
      "whatsappName": "Sr Alex",
      "lastMessage": "mi nombre"
    }
  ],
  [
    "573009876543",
    {
      "id": "573009876543",
      "name": "María García",
      "phone": "573009876543",
      "label": "nuevo",
      "whapiLabels": [],
      "firstInteraction": "2025-07-21T20:30:00.000Z",
      "lastInteraction": "2025-07-21T23:15:45.123Z",
      "whatsappName": "María García",
      "lastMessage": "Hola, ¿tienen apartamentos disponibles?"
    }
  ]
]
```

## ⚙️ Características

- **Auto-actualización:** Se actualiza cuando llegan mensajes
- **Sincronización WHAPI:** Obtiene etiquetas y datos del perfil
- **Cache 5 min:** Evita llamadas innecesarias
- **Guardado automático:** Al cerrar el bot
- **Solo datos reales:** No se generan campos inventados
```

¡Listo! Un README simple y directo con la tabla y un ejemplo claro. 🎉 