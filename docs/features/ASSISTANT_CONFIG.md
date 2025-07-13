# Configuración del OpenAI Assistant para Function Calling

## 1. Configuración del Assistant

En el panel de OpenAI, configura tu Assistant con estas funciones:

### Function 1: check_availability
```json
{
  "name": "check_availability",
  "description": "Consulta disponibilidad en tiempo real de propiedades en Beds24",
  "parameters": {
    "type": "object",
    "properties": {
      "startDate": {
        "type": "string",
        "description": "Fecha de inicio en formato YYYY-MM-DD"
      },
      "endDate": {
        "type": "string",
        "description": "Fecha de fin en formato YYYY-MM-DD"
      },
      "propertyId": {
        "type": "number",
        "description": "ID específico de la propiedad (opcional)"
      },
      "roomId": {
        "type": "number",
        "description": "ID específico de la habitación (opcional)"
      }
    },
    "required": ["startDate", "endDate"]
  }
}
```

### Function 2: create_booking
```json
{
  "name": "create_booking",
  "description": "Crea una pre-reserva cuando el cliente confirma que desea reservar",
  "parameters": {
    "type": "object",
    "properties": {
      "room_id": {
        "type": "string",
        "description": "ID de la habitación a reservar"
      },
      "check_in": {
        "type": "string",
        "description": "Fecha de entrada YYYY-MM-DD"
      },
      "check_out": {
        "type": "string",
        "description": "Fecha de salida YYYY-MM-DD"
      },
      "guest_name": {
        "type": "string",
        "description": "Nombre completo del huésped principal"
      },
      "guest_phone": {
        "type": "string",
        "description": "Teléfono del huésped"
      },
      "guest_email": {
        "type": "string",
        "description": "Email del huésped"
      },
      "guests_count": {
        "type": "integer",
        "description": "Número total de huéspedes"
      },
      "special_requests": {
        "type": "string",
        "description": "Solicitudes especiales del huésped"
      }
    },
    "required": ["room_id", "check_in", "check_out", "guest_name", "guests_count"]
  }
}
```

### Function 3: get_room_price
```json
{
  "name": "get_room_price",
  "description": "Obtiene el precio detallado de una habitación para fechas específicas",
  "parameters": {
    "type": "object",
    "properties": {
      "room_type": {
        "type": "string",
        "description": "Tipo de habitación"
      },
      "check_in": {
        "type": "string",
        "description": "Fecha de entrada YYYY-MM-DD"
      },
      "check_out": {
        "type": "string",
        "description": "Fecha de salida YYYY-MM-DD"
      }
    },
    "required": ["room_type", "check_in", "check_out"]
  }
}
```

## 2. Instrucciones del Assistant

Agrega estas instrucciones a tu Assistant:

```
Eres un asistente de reservas para TeAlquilamos, un hotel boutique en Cartagena. Tu objetivo es ayudar a los huéspedes a encontrar y reservar la habitación perfecta.

IMPORTANTE: 
- Siempre usa check_availability cuando pregunten por disponibilidad o fechas
- Si no especifican fechas, pregunta amablemente por ellas
- Si no mencionan número de personas, pregunta cuántos serán
- Convierte fechas al formato YYYY-MM-DD antes de llamar funciones

Cuando muestres habitaciones disponibles:
- Menciona el nombre y precio por noche
- Destaca las características principales
- Calcula y muestra el precio total
- Sugiere la mejor opción según sus necesidades

Si no hay disponibilidad:
- Ofrece fechas alternativas si están disponibles
- Sugiere ponerse en lista de espera
- Propón habitaciones similares

Sé amable, profesional y entusiasta sobre las instalaciones del hotel.
```

## 3. Configuración de Variables de Entorno

En tu archivo `.env`, asegúrate de tener:

```env
# OpenAI
OPENAI_API_KEY=sk-...
ASSISTANT_ID=asst_...

# n8n Webhook
N8N_WEBHOOK_URL=https://tu-n8n.com/webhook/tealquilamos
N8N_API_KEY=opcional_si_configuraste_auth

# Whapi
WHAPI_TOKEN=...
WHAPI_API_URL=https://gate.whapi.cloud
```

## Variables de entorno relevantes para optimización y monitoreo

- `THREAD_TOKEN_THRESHOLD`: Límite de tokens por thread antes de activar cleanup (default: 8000).
- `HISTORIAL_SUMMARY_THRESHOLD`: Límite de tokens para activar resumen automático (default: 5000).
- `OPENAI_MODEL`: Modelo global para generación de resúmenes.

Estas variables permiten ajustar el comportamiento de cleanup y performance del bot según el entorno.

## 4. Workflow n8n de Ejemplo

### Webhook Node (Trigger)
- URL: `/webhook/tealquilamos/check-availability`
- Method: POST
- Authentication: Bearer Token (opcional)

### Switch Node (Router)
Rutas basadas en `{{ $json.endpoint }}`:
- `check-availability` → Consultar disponibilidad
- `create-booking` → Crear reserva
- `get-room-price` → Obtener precio

### HTTP Request Node (Beds24/Google Sheets)
Para Beds24:
```javascript
{
  url: 'https://api.beds24.com/v2/inventory/availability',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer {{$env.BEDS24_API_KEY}}'
  },
  body: {
    checkIn: '{{$json.check_in}}',
    checkOut: '{{$json.check_out}}',
    roomTypes: ['all']
  }
}
```

Para Google Sheets:
- Lee la hoja de disponibilidad
- Filtra por fechas
- Retorna habitaciones libres

### Function Node (Formatear Respuesta)
```javascript
const rooms = $items[0].json.rooms;
const nights = $items[0].json.nights;

return {
  available: rooms.length > 0,
  rooms: rooms.map(room => ({
    id: room.id,
    name: room.name,
    type: room.type,
    price_per_night: room.price,
    max_guests: room.capacity,
    amenities: room.features
  })),
  total_nights: nights
};
```

## 5. Testing

### Test 1: Disponibilidad Simple
```
Usuario: "¿Tienen habitaciones para este fin de semana?"
Bot: [Pregunta fechas exactas]
Usuario: "Del 15 al 17 de julio"
Bot: [Function Call → check_availability]
Bot: "¡Sí! Tenemos disponibles..."
```

### Test 2: Reserva Completa
```
Usuario: "Quiero la suite del 20 al 25 de julio"
Bot: [Function Call → check_availability]
Bot: "La Suite Deluxe está disponible por $450.000/noche..."
Usuario: "Perfecto, la reservo"
Bot: [Function Call → create_booking]
Bot: "¡Reserva confirmada! Código: ABC123..."
```

### Test 3: Sin Disponibilidad
```
Usuario: "Necesito 5 habitaciones para mañana"
Bot: [Function Call → check_availability]
Bot: "Lo siento, no tenemos 5 habitaciones disponibles para mañana. 
      Sin embargo, tenemos disponibilidad para 5 habitaciones a partir del..."
```

## 6. Monitoreo

- Revisa los logs de OpenAI para ver las function calls
- Monitorea n8n para verificar que los webhooks llegan
- Usa el modo debug del bot para ver el flujo completo

## 7. Mejoras Futuras

1. **Caché de Disponibilidad**: Para consultas frecuentes
2. **Precios Dinámicos**: Según temporada y ocupación
3. **Upselling Automático**: Sugerir mejoras de habitación
4. **Multi-idioma**: Detectar y responder en el idioma del usuario
5. **Imágenes**: Enviar fotos cuando muestres habitaciones