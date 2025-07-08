# 📋 get_booking_details - Consultar Reserva

## 🎯 Descripción

Función para consultar los detalles de una reserva existente en Beds24. Permite al bot obtener información completa sobre reservas usando diferentes métodos de búsqueda (ID de reserva, email del huésped, teléfono, etc.).

---

## 📤 Parámetros de Entrada

### **Esquema OpenAI:**
```json
{
  "name": "get_booking_details",
  "description": "Consulta los detalles de una reserva existente en Beds24",
  "parameters": {
    "type": "object",
    "properties": {
      "bookingId": {
        "type": "string",
        "description": "ID único de la reserva"
      },
      "confirmationNumber": {
        "type": "string",
        "description": "Número de confirmación de la reserva"
      },
      "guestEmail": {
        "type": "string",
        "format": "email",
        "description": "Email del huésped"
      },
      "guestPhone": {
        "type": "string",
        "description": "Teléfono del huésped"
      },
      "guestName": {
        "type": "string",
        "description": "Nombre del huésped"
      },
      "checkIn": {
        "type": "string",
        "pattern": "^\\d{4}-\\d{2}-\\d{2}$",
        "description": "Fecha de entrada para filtrar (opcional)"
      },
      "propertyId": {
        "type": "number",
        "description": "ID de la propiedad para filtrar (opcional)"
      }
    },
    "additionalProperties": false
  }
}
```

**Nota:** Al menos uno de los parámetros principales debe ser proporcionado: `bookingId`, `confirmationNumber`, `guestEmail`, `guestPhone`, o `guestName`.

---

## 📥 Respuesta Esperada

### **Respuesta Exitosa (Reserva Encontrada):**
```json
{
  "success": true,
  "data": {
    "bookingId": "BK123456",
    "confirmationNumber": "CNF789012",
    "status": "confirmed",
    "guest": {
      "name": "Juan Pérez",
      "email": "juan.perez@email.com",
      "phone": "+57 300 123 4567"
    },
    "property": {
      "id": 1317,
      "name": "Apartamento 1317",
      "address": "Carrera 10 #15-20, Cartagena"
    },
    "dates": {
      "checkIn": "2025-07-15",
      "checkOut": "2025-07-18",
      "nights": 3
    },
    "guests": {
      "adults": 2,
      "children": 1
    },
    "pricing": {
      "totalPrice": 450000,
      "pricePerNight": 150000,
      "currency": "COP"
    },
    "specialRequests": "Cuna para bebé",
    "createdAt": "2025-07-10T14:30:00Z",
    "lastModified": "2025-07-10T14:30:00Z"
  },
  "message": "Reserva encontrada exitosamente"
}
```

### **Respuesta Exitosa (Múltiples Reservas):**
```json
{
  "success": true,
  "data": {
    "bookings": [
      {
        "bookingId": "BK123456",
        "confirmationNumber": "CNF789012",
        "status": "confirmed",
        "property": {
          "name": "Apartamento 1317"
        },
        "dates": {
          "checkIn": "2025-07-15",
          "checkOut": "2025-07-18"
        },
        "totalPrice": 450000
      },
      {
        "bookingId": "BK123457",
        "confirmationNumber": "CNF789013",
        "status": "pending",
        "property": {
          "name": "Apartamento 1820"
        },
        "dates": {
          "checkIn": "2025-08-20",
          "checkOut": "2025-08-23"
        },
        "totalPrice": 380000
      }
    ],
    "total": 2
  },
  "message": "Se encontraron 2 reservas"
}
```

### **Respuesta de Error:**
```json
{
  "success": false,
  "error": "No se encontraron reservas con los criterios especificados",
  "code": "BOOKING_NOT_FOUND"
}
```

---

## 🔧 Proceso de Consulta

### **1. Métodos de Búsqueda (Por Prioridad):**

| Método | Prioridad | Precisión | Uso |
|--------|-----------|-----------|-----|
| `bookingId` | 🔴 **Alta** | ✅ **Exacta** | Búsqueda directa |
| `confirmationNumber` | 🔴 **Alta** | ✅ **Exacta** | Número de confirmación |
| `guestEmail` | 🟡 **Media** | ✅ **Alta** | Email del huésped |
| `guestPhone` | 🟡 **Media** | ✅ **Alta** | Teléfono del huésped |
| `guestName` | 🟢 **Baja** | ⚠️ **Parcial** | Nombre (puede haber múltiples) |

### **2. Integración con Beds24:**
- 🔗 **Endpoint**: `GET /bookings` o `GET /bookings/{id}`
- 📋 **Filtros**: Por ID, email, teléfono, fechas
- 🔐 **Autenticación**: Token de API de Beds24
- ⏱️ **Timeout**: 15 segundos

### **3. Procesamiento:**
```typescript
// Pseudocódigo del flujo
async function getBookingDetails(args: any): Promise<FunctionResponse> {
  // 1. Determinar método de búsqueda
  const searchMethod = determineSearchMethod(args);
  
  // 2. Construir parámetros de búsqueda
  const searchParams = buildSearchParams(args, searchMethod);
  
  // 3. Consultar Beds24
  const bookings = await beds24API.getBookings(searchParams);
  
  // 4. Procesar resultados
  if (bookings.length === 0) {
    return {
      success: false,
      error: 'No se encontraron reservas con los criterios especificados',
      code: 'BOOKING_NOT_FOUND'
    };
  }
  
  if (bookings.length === 1) {
    // Reserva única
    return {
      success: true,
      data: formatBookingDetails(bookings[0]),
      message: 'Reserva encontrada exitosamente'
    };
  }
  
  // Múltiples reservas
  return {
    success: true,
    data: {
      bookings: bookings.map(formatBookingSummary),
      total: bookings.length
    },
    message: `Se encontraron ${bookings.length} reservas`
  };
}
```

---

## 🚨 Casos de Error

### **Errores Comunes:**

| Error | Código | Causa | Solución |
|-------|--------|-------|----------|
| `BOOKING_NOT_FOUND` | 404 | Reserva no existe | Verificar datos de búsqueda |
| `INVALID_SEARCH_PARAMS` | 400 | Parámetros inválidos | Proporcionar criterio válido |
| `MULTIPLE_BOOKINGS_FOUND` | 200 | Múltiples resultados | Mostrar lista para selección |
| `BEDS24_API_ERROR` | 500 | Error en Beds24 | Reintentar consulta |
| `INSUFFICIENT_PERMISSIONS` | 403 | Sin permisos | Verificar token API |

### **Manejo de Errores:**
```typescript
try {
  const booking = await getBookingDetails(args);
  return booking;
} catch (error) {
  if (error.code === 'BOOKING_NOT_FOUND') {
    return {
      success: false,
      error: 'No encontré ninguna reserva con esos datos. ¿Podrías verificar la información?',
      suggestions: [
        'Verificar número de confirmación',
        'Revisar email usado para la reserva',
        'Comprobar fechas de la reserva'
      ]
    };
  }
  
  // Error genérico
  return {
    success: false,
    error: 'Error consultando la reserva. Por favor intenta nuevamente.'
  };
}
```

---

## 📊 Integración con OpenAI

### **Contexto para OpenAI (Reserva Única):**
```
✅ **Reserva Encontrada**

📋 **Detalles de tu Reserva:**
• Confirmación: CNF789012
• Huésped: Juan Pérez
• Propiedad: Apartamento 1317
• Fechas: 15/07/2025 - 18/07/2025 (3 noches)
• Huéspedes: 2 adultos, 1 niño
• Precio total: $450.000
• Estado: ✅ Confirmada

🏠 **Información de la Propiedad:**
• Dirección: Carrera 10 #15-20, Cartagena
• Check-in: 3:00 PM
• Check-out: 11:00 AM

💡 **Solicitudes especiales:** Cuna para bebé

¿Necesitas modificar algo de tu reserva?
```

### **Contexto para OpenAI (Múltiples Reservas):**
```
📋 **Encontré 2 reservas a tu nombre:**

1️⃣ **Reserva CNF789012**
   • Apartamento 1317
   • 15/07/2025 - 18/07/2025
   • Estado: ✅ Confirmada
   • Precio: $450.000

2️⃣ **Reserva CNF789013**
   • Apartamento 1820
   • 20/08/2025 - 23/08/2025
   • Estado: ⏳ Pendiente
   • Precio: $380.000

¿Sobre cuál reserva necesitas información específica?
```

### **Contexto para OpenAI (No Encontrada):**
```
❌ **Reserva No Encontrada**

No encontré ninguna reserva con los datos proporcionados.

💡 **Sugerencias:**
• Verifica el número de confirmación
• Revisa el email usado para la reserva
• Comprueba las fechas de la reserva

¿Tienes algún otro dato de la reserva que pueda ayudarme a encontrarla?
```

---

## 🧪 Testing

### **Casos de Prueba:**

1. **✅ Búsqueda por ID Exitosa**
   - Reserva existe
   - Datos completos

2. **✅ Búsqueda por Email**
   - Email válido
   - Múltiples reservas

3. **❌ Reserva No Encontrada**
   - ID inexistente
   - Email sin reservas

4. **❌ Parámetros Inválidos**
   - Sin criterios de búsqueda
   - Email mal formateado

5. **❌ Error de API**
   - Beds24 no responde
   - Token inválido

### **Comando de Prueba:**
```bash
# Cuando se implemente
npm run function:test get_booking_details
```

---

## 🔗 Dependencias

### **APIs Externas:**
- 🏨 **Beds24 API**: Consulta de reservas
- 🔍 **Search API**: Búsqueda avanzada (opcional)

### **Funciones Relacionadas:**
- `create_booking` - Crear reservas
- `cancel_booking` - Cancelar reservas
- `check_availability` - Verificar disponibilidad

---

## 🚀 Estado de Implementación

| Componente | Estado | Notas |
|------------|--------|-------|
| **Documentación** | ✅ **Completa** | Este documento |
| **Esquema OpenAI** | ✅ **Definido** | Parámetros y validaciones |
| **Tipos TypeScript** | ✅ **Definidos** | En function-types.ts |
| **Handler** | ❌ **Pendiente** | Por implementar |
| **Integración Beds24** | ❌ **Pendiente** | API endpoints |
| **Tests** | ❌ **Pendiente** | Casos de prueba |

---

**📅 Última actualización:** Julio 2025  
**🔗 Relacionado:** [create_booking](./create_booking.md) | [cancel_booking](./cancel_booking.md) 