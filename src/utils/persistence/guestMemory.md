# 📋 GuestMemory - Sistema de Perfiles de Huéspedes

Sistema de persistencia para almacenar información de huéspedes extraída de webhooks y endpoints de WHAPI.

## �� Archivo de Datos

```
tmp/guest_profiles.json
```

## 📊 Campos y Fuentes de Datos

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

## 🔄 Flujo de Datos

### 1. **Webhook de Mensaje**
```json
{
    "messages": [{
        "from": "573003913251",
        "chat_id": "573003913251@s.whatsapp.net",
        "chat_name": "Sr Alex",
        "text": { "body": "mi nombre" }
    }]
}
```

### 2. **Endpoint WHAPI `/chats/{id}`**
```json
{
    "id": "573003913251@s.whatsapp.net",
    "name": "Sr Alex",
    "labels": [
        {"name": "cliente", "id": "123", "color": "blue"},
        {"name": "activo", "id": "456", "color": "green"}
    ],
    "last_message": "mi nombre"
}
```

### 3. **Perfil Guardado**
```json
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
```

## 📄 Ejemplos de Perfiles

### **Ejemplo 1: Cliente con Datos Completos**
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
    ]
]
```

### **Ejemplo 2: Cliente Nuevo sin Etiquetas**
```json
[
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

### **Ejemplo 3: Cliente sin Nombre de WhatsApp**
```json
[
    [
        "573001234567",
        {
            "id": "573001234567",
            "name": null,
            "phone": "573001234567",
            "label": "nuevo",
            "whapiLabels": [
                {"name": "cotizando", "id": "789", "color": "yellow"}
            ],
            "firstInteraction": "2025-07-21T18:45:00.000Z",
            "lastInteraction": "2025-07-21T22:20:30.456Z",
            "whatsappName": null,
            "lastMessage": "¿Cuál es el precio por noche?"
        }
    ]
]
```

## ⚙️ Características del Sistema

### **Auto-actualización**
- Se actualiza automáticamente cuando llegan mensajes
- Sincroniza con WHAPI cuando los threads son viejos
- Cache de 5 minutos para evitar llamadas innecesarias

### **Persistencia**
- Guardado automático al cerrar el bot
- Formato JSON legible
- Estructura Map convertida a array

### **Validación**
- Solo datos reales de fuentes verificables
- No se generan campos inventados
- Fallbacks para datos faltantes

## 📈 Estadísticas Disponibles

```javascript
{
    "totalProfiles": 15,
    "byLabel": {
        "nuevo": 5,
        "cliente": 8,
        "vip": 2
    },
    "whapiLabelsCount": {
        "cliente": 8,
        "activo": 6,
        "cotizando": 3
    },
    "profilesWithWhapi": 12
}
```

## 🚨 Nota 