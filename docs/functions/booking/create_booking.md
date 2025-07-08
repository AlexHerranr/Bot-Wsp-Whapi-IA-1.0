# 📋 create_booking - Crear Reserva

## 🎯 Descripción

Función para crear una nueva reserva en el sistema Beds24. Permite al bot procesar automáticamente las solicitudes de reserva de los huéspedes y crear la reserva directamente en el sistema.

---

## 📤 Parámetros de Entrada

### **Esquema OpenAI:**
```json
{
  "name": "create_booking",
  "description": "Crea una nueva reserva en Beds24 con los datos del huésped",
  "parameters": {
    "type": "object",
    "properties": {
      "guestName": {
        "type": "string",
        "description": "Nombre completo del huésped"
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
      "propertyId": {
        "type": "number",
        "description": "ID de la propiedad seleccionada"
      },
      "roomId": {
        "type": "number",
        "description": "ID de la habitación seleccionada"
      },
      "checkIn": {
        "type": "string",
        "pattern": "^\\d{4}-\\d{2}-\\d{2}$",
        "description": "Fecha de entrada en formato YYYY-MM-DD"
      },
      "checkOut": {
        "type": "string",
        "pattern": "^\\d{4}-\\d{2}-\\d{2}$",
        "description": "Fecha de salida en formato YYYY-MM-DD"
      },
      "adults": {
        "type": "number",
        "minimum": 1,
        "maximum": 10,
        "description": "Número de adultos"
      },
      "children": {
        "type": "number",
        "minimum": 0,
        "maximum": 10,
        "description": "Número de niños"
      },
      "totalPrice": {
        "type": "number",
        "minimum": 0,
        "description": "Precio total de la reserva"
      },
      "specialRequests": {
        "type": "string",
        "description": "Solicitudes especiales del huésped (opcional)"
      }
    },
    "required": [
      "guestName",
      "guestEmail", 
      "guestPhone",
      "propertyId",
      "roomId",
      "checkIn",
      "checkOut",
      "adults",
      "totalPrice"
    ],
    "additionalProperties": false
  }
}
```

---

## 📥 Respuesta Esperada

### **Respuesta Exitosa:**
```json
{
  "success": true,
  "data": {
    "bookingId": "BK123456",
    "confirmationNumber": "CNF789012",
    "status": "confirmed",
    "guestName": "Juan Pérez",
    "propertyName": "Apartamento 1317",
    "checkIn": "2025-07-15",
    "checkOut": "2025-07-18",
    "totalPrice": 450000,
    "nights": 3
  },
  "message": "Reserva creada exitosamente"
}
```

### **Respuesta de Error:**
```json
{
  "success": false,
  "error": "La propiedad no está disponible para las fechas seleccionadas",
  "code": "PROPERTY_NOT_AVAILABLE"
}
```

---

## 🔧 Proceso de Creación

### **1. Validaciones Previas:**
- ✅ Validar formato de fechas
- ✅ Verificar disponibilidad en tiempo real
- ✅ Validar datos del huésped (email, teléfono)
- ✅ Confirmar precio actual vs precio solicitado
- ✅ Verificar restricciones de la propiedad

### **2. Integración con Beds24:**
- 🔗 **Endpoint**: `POST /bookings`
- 📋 **Datos requeridos**: Información del huésped, fechas, propiedad
- 🔐 **Autenticación**: Token de API de Beds24
- ⏱️ **Timeout**: 30 segundos

### **3. Procesamiento:**
```typescript
// Pseudocódigo del flujo
async function createBooking(args: BookingData): Promise<FunctionResponse> {
  // 1. Validar parámetros
  validateBookingData(args);
  
  // 2. Verificar disponibilidad
  const availability = await checkAvailability(args.propertyId, args.checkIn, args.checkOut);
  if (!availability.available) {
    throw new Error('Propiedad no disponible');
  }
  
  // 3. Crear reserva en Beds24
  const booking = await beds24API.createBooking({
    guest: {
      name: args.guestName,
      email: args.guestEmail,
      phone: args.guestPhone
    },
    property: {
      id: args.propertyId,
      roomId: args.roomId
    },
    dates: {
      checkIn: args.checkIn,
      checkOut: args.checkOut
    },
    guests: {
      adults: args.adults,
      children: args.children || 0
    },
    price: args.totalPrice
  });
  
  // 4. Confirmar y retornar
  return {
    success: true,
    data: booking,
    message: 'Reserva creada exitosamente'
  };
}
```

---

## 🚨 Casos de Error

### **Errores Comunes:**

| Error | Código | Causa | Solución |
|-------|--------|-------|----------|
| `PROPERTY_NOT_AVAILABLE` | 400 | Propiedad ocupada | Sugerir fechas alternativas |
| `INVALID_EMAIL` | 400 | Email mal formateado | Solicitar email válido |
| `PRICE_MISMATCH` | 400 | Precio ha cambiado | Consultar precio actual |
| `BEDS24_API_ERROR` | 500 | Error en Beds24 | Reintentar o escalar |
| `VALIDATION_ERROR` | 400 | Datos inválidos | Mostrar campos requeridos |

### **Manejo de Errores:**
```typescript
try {
  const booking = await createBooking(args);
  return booking;
} catch (error) {
  if (error.code === 'PROPERTY_NOT_AVAILABLE') {
    // Sugerir fechas alternativas
    const alternatives = await suggestAlternativeDates(args);
    return {
      success: false,
      error: error.message,
      data: { alternatives }
    };
  }
  
  // Error genérico
  return {
    success: false,
    error: 'Error creando la reserva. Por favor intenta nuevamente.'
  };
}
```

---

## 📊 Integración con OpenAI

### **Contexto para OpenAI:**
```
✅ **Reserva Creada Exitosamente**

📋 **Detalles de la Reserva:**
• Número de confirmación: CNF789012
• Huésped: Juan Pérez
• Propiedad: Apartamento 1317
• Fechas: 15/07/2025 - 18/07/2025 (3 noches)
• Precio total: $450.000

💡 **Próximos pasos:**
• Recibirás confirmación por email
• Check-in: 3:00 PM
• Check-out: 11:00 AM

¿Necesitas ayuda con algo más?
```

### **Respuesta de Error:**
```
❌ **Error al Crear Reserva**

🚨 **Problema:** La propiedad no está disponible para las fechas seleccionadas

💡 **Alternativas disponibles:**
• 16/07/2025 - 19/07/2025 (3 noches) - $460.000
• 20/07/2025 - 23/07/2025 (3 noches) - $450.000

¿Te gustaría reservar alguna de estas fechas alternativas?
```

---

## 🧪 Testing

### **Casos de Prueba:**

1. **✅ Reserva Exitosa**
   - Datos válidos
   - Propiedad disponible
   - Precio correcto

2. **❌ Propiedad No Disponible**
   - Fechas ocupadas
   - Sugerir alternativas

3. **❌ Datos Inválidos**
   - Email mal formateado
   - Fechas en el pasado
   - Precio negativo

4. **❌ Error de API**
   - Beds24 no responde
   - Token inválido
   - Timeout

### **Comando de Prueba:**
```bash
# Cuando se implemente
npm run function:test create_booking
```

---

## 🔗 Dependencias

### **APIs Externas:**
- 🏨 **Beds24 API**: Creación de reservas
- 📧 **Email Service**: Confirmaciones
- 📱 **SMS Service**: Notificaciones (opcional)

### **Funciones Relacionadas:**
- `check_availability` - Verificar disponibilidad previa
- `calculate_price` - Calcular precio actual
- `send_notification` - Enviar confirmaciones

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
**🔗 Relacionado:** [get_booking_details](./get_booking_details.md) | [cancel_booking](./cancel_booking.md) 