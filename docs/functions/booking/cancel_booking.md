# 📋 cancel_booking - Cancelar Reserva

## 🎯 Descripción

Función para cancelar una reserva existente en Beds24. Permite al bot procesar automáticamente las solicitudes de cancelación de los huéspedes, aplicando políticas de cancelación y procesando reembolsos según corresponda.

---

## 📤 Parámetros de Entrada

### **Esquema OpenAI:**
```json
{
  "name": "cancel_booking",
  "description": "Cancela una reserva existente en Beds24 aplicando políticas de cancelación",
  "parameters": {
    "type": "object",
    "properties": {
      "bookingId": {
        "type": "string",
        "description": "ID único de la reserva a cancelar"
      },
      "confirmationNumber": {
        "type": "string",
        "description": "Número de confirmación de la reserva"
      },
      "guestEmail": {
        "type": "string",
        "format": "email",
        "description": "Email del huésped (para verificación)"
      },
      "reason": {
        "type": "string",
        "enum": [
          "guest_request",
          "property_issue",
          "force_majeure",
          "payment_failed",
          "duplicate_booking",
          "other"
        ],
        "description": "Razón de la cancelación"
      },
      "reasonDetails": {
        "type": "string",
        "description": "Detalles adicionales sobre la razón de cancelación"
      },
      "refundRequested": {
        "type": "boolean",
        "description": "Si el huésped solicita reembolso (opcional, por defecto true)"
      },
      "notifyGuest": {
        "type": "boolean",
        "description": "Si notificar al huésped por email (opcional, por defecto true)"
      }
    },
    "required": [
      "reason"
    ],
    "additionalProperties": false
  }
}
```

**Nota:** Se debe proporcionar al menos `bookingId` o `confirmationNumber` para identificar la reserva.

---

## 📥 Respuesta Esperada

### **Respuesta Exitosa (Cancelación Completa):**
```json
{
  "success": true,
  "data": {
    "bookingId": "BK123456",
    "confirmationNumber": "CNF789012",
    "status": "cancelled",
    "cancellationDate": "2025-07-12T10:30:00Z",
    "originalBooking": {
      "guestName": "Juan Pérez",
      "propertyName": "Apartamento 1317",
      "checkIn": "2025-07-15",
      "checkOut": "2025-07-18",
      "totalPrice": 450000
    },
    "refund": {
      "eligible": true,
      "amount": 360000,
      "percentage": 80,
      "reason": "Cancelación dentro del periodo permitido",
      "estimatedProcessingTime": "3-5 días hábiles",
      "method": "original_payment_method"
    },
    "fees": {
      "cancellationFee": 90000,
      "processingFee": 0,
      "totalFees": 90000
    },
    "notifications": {
      "guestNotified": true,
      "emailSent": true,
      "smsNotification": false
    }
  },
  "message": "Reserva cancelada exitosamente con reembolso de $360.000"
}
```

### **Respuesta Exitosa (Sin Reembolso):**
```json
{
  "success": true,
  "data": {
    "bookingId": "BK123456",
    "status": "cancelled",
    "cancellationDate": "2025-07-12T10:30:00Z",
    "refund": {
      "eligible": false,
      "amount": 0,
      "reason": "Cancelación fuera del periodo permitido",
      "policy": "No reembolso después de 48 horas antes del check-in"
    },
    "notifications": {
      "guestNotified": true,
      "emailSent": true
    }
  },
  "message": "Reserva cancelada. No hay reembolso disponible según política de cancelación"
}
```

### **Respuesta de Error:**
```json
{
  "success": false,
  "error": "La reserva no puede ser cancelada porque el check-in ya ocurrió",
  "code": "BOOKING_NOT_CANCELLABLE",
  "data": {
    "bookingStatus": "checked_in",
    "checkInDate": "2025-07-15T15:00:00Z",
    "policy": "No se permiten cancelaciones después del check-in"
  }
}
```

---

## 🔧 Proceso de Cancelación

### **1. Validaciones Previas:**
- ✅ Verificar que la reserva existe
- ✅ Confirmar que la reserva puede ser cancelada
- ✅ Validar identidad del huésped (email)
- ✅ Verificar estado actual de la reserva
- ✅ Aplicar políticas de cancelación

### **2. Políticas de Cancelación:**

| Periodo | Reembolso | Tarifa | Condiciones |
|---------|-----------|--------|-------------|
| **> 7 días** | ✅ **100%** | Sin tarifa | Reembolso completo |
| **3-7 días** | ✅ **80%** | 20% tarifa | Tarifa moderada |
| **1-3 días** | ✅ **50%** | 50% tarifa | Tarifa alta |
| **< 24 horas** | ❌ **0%** | 100% tarifa | Sin reembolso |
| **Después check-in** | ❌ **0%** | 100% tarifa | No cancelable |

### **3. Integración con Beds24:**
- 🔗 **Endpoint**: `PUT /bookings/{id}/cancel`
- 📋 **Datos requeridos**: ID de reserva, razón, políticas
- 🔐 **Autenticación**: Token de API de Beds24
- ⏱️ **Timeout**: 30 segundos

### **4. Procesamiento:**
```typescript
// Pseudocódigo del flujo
async function cancelBooking(args: any): Promise<FunctionResponse> {
  // 1. Buscar y validar reserva
  const booking = await findBooking(args);
  if (!booking) {
    throw new Error('Reserva no encontrada');
  }
  
  // 2. Verificar si puede ser cancelada
  const cancellationCheck = await validateCancellation(booking);
  if (!cancellationCheck.allowed) {
    throw new Error(cancellationCheck.reason);
  }
  
  // 3. Calcular reembolso según políticas
  const refundCalculation = await calculateRefund(booking, args.reason);
  
  // 4. Ejecutar cancelación en Beds24
  const cancellation = await beds24API.cancelBooking(booking.id, {
    reason: args.reason,
    reasonDetails: args.reasonDetails,
    refundAmount: refundCalculation.amount
  });
  
  // 5. Procesar reembolso si aplica
  if (refundCalculation.eligible && args.refundRequested !== false) {
    await processRefund(booking, refundCalculation);
  }
  
  // 6. Notificar al huésped
  if (args.notifyGuest !== false) {
    await notifyGuestCancellation(booking, cancellation, refundCalculation);
  }
  
  // 7. Retornar resultado
  return {
    success: true,
    data: {
      bookingId: booking.id,
      status: 'cancelled',
      cancellationDate: new Date().toISOString(),
      refund: refundCalculation,
      notifications: {
        guestNotified: args.notifyGuest !== false,
        emailSent: true
      }
    },
    message: generateCancellationMessage(refundCalculation)
  };
}
```

---

## 🚨 Casos de Error

### **Errores Comunes:**

| Error | Código | Causa | Solución |
|-------|--------|-------|----------|
| `BOOKING_NOT_FOUND` | 404 | Reserva no existe | Verificar ID/confirmación |
| `BOOKING_NOT_CANCELLABLE` | 400 | No se puede cancelar | Mostrar política |
| `ALREADY_CANCELLED` | 400 | Ya está cancelada | Mostrar estado actual |
| `CHECKED_IN_ALREADY` | 400 | Ya hizo check-in | Contactar soporte |
| `INVALID_GUEST_EMAIL` | 403 | Email no coincide | Verificar identidad |
| `REFUND_PROCESSING_ERROR` | 500 | Error en reembolso | Escalar a soporte |

### **Manejo de Errores:**
```typescript
try {
  const cancellation = await cancelBooking(args);
  return cancellation;
} catch (error) {
  if (error.code === 'BOOKING_NOT_CANCELLABLE') {
    const booking = await getBookingDetails(args);
    return {
      success: false,
      error: error.message,
      data: {
        bookingStatus: booking.status,
        checkInDate: booking.checkIn,
        policy: 'Consulta nuestra política de cancelación para más detalles'
      },
      suggestions: [
        'Contactar soporte para casos especiales',
        'Revisar términos y condiciones',
        'Considerar modificación en lugar de cancelación'
      ]
    };
  }
  
  // Error genérico
  return {
    success: false,
    error: 'Error procesando la cancelación. Por favor contacta soporte.'
  };
}
```

---

## 📊 Integración con OpenAI

### **Contexto para OpenAI (Cancelación Exitosa con Reembolso):**
```
✅ **Reserva Cancelada Exitosamente**

📋 **Detalles de la Cancelación:**
• Reserva: CNF789012
• Huésped: Juan Pérez
• Propiedad: Apartamento 1317
• Fechas originales: 15/07/2025 - 18/07/2025

💰 **Información del Reembolso:**
• Monto original: $450.000
• Tarifa de cancelación: $90.000 (20%)
• Reembolso: $360.000
• Tiempo estimado: 3-5 días hábiles

📧 **Notificaciones:**
• Email de confirmación enviado
• Recibirás detalles del reembolso por separado

¿Necesitas ayuda con algo más?
```

### **Contexto para OpenAI (Sin Reembolso):**
```
✅ **Reserva Cancelada**

📋 **Detalles de la Cancelación:**
• Reserva: CNF789012
• Estado: Cancelada exitosamente

⚠️ **Política de Reembolso:**
• No hay reembolso disponible
• Razón: Cancelación fuera del periodo permitido
• Política: No reembolso después de 48 horas antes del check-in

📧 **Confirmación enviada por email**

Si tienes circunstancias especiales, puedes contactar nuestro equipo de soporte.
```

### **Contexto para OpenAI (Error):**
```
❌ **No se Puede Cancelar la Reserva**

🚨 **Problema:** La reserva no puede ser cancelada porque el check-in ya ocurrió

📋 **Información:**
• Estado actual: Check-in realizado
• Fecha de entrada: 15/07/2025 3:00 PM
• Política: No se permiten cancelaciones después del check-in

💡 **Opciones:**
• Contactar soporte para casos especiales
• Revisar opciones de modificación
• Consultar términos y condiciones

¿Te gustaría que te conecte con un agente para revisar tu caso?
```

---

## 🧪 Testing

### **Casos de Prueba:**

1. **✅ Cancelación con Reembolso Completo**
   - Más de 7 días antes
   - Sin tarifas

2. **✅ Cancelación con Reembolso Parcial**
   - 3-7 días antes
   - Con tarifa del 20%

3. **✅ Cancelación Sin Reembolso**
   - Menos de 24 horas
   - Sin reembolso

4. **❌ Reserva Ya Cancelada**
   - Estado cancelled
   - Mostrar información

5. **❌ Check-in Realizado**
   - No cancelable
   - Sugerir contactar soporte

6. **❌ Email No Coincide**
   - Verificación fallida
   - Solicitar datos correctos

### **Comando de Prueba:**
```bash
# Cuando se implemente
npm run function:test cancel_booking
```

---

## 🔗 Dependencias

### **APIs Externas:**
- 🏨 **Beds24 API**: Cancelación de reservas
- 💳 **Payment Gateway**: Procesamiento de reembolsos
- 📧 **Email Service**: Notificaciones
- 📱 **SMS Service**: Notificaciones móviles (opcional)

### **Funciones Relacionadas:**
- `get_booking_details` - Obtener detalles de la reserva
- `calculate_refund` - Calcular montos de reembolso
- `process_refund` - Procesar reembolsos
- `send_notification` - Enviar notificaciones

---

## 🚀 Estado de Implementación

| Componente | Estado | Notas |
|------------|--------|-------|
| **Documentación** | ✅ **Completa** | Este documento |
| **Esquema OpenAI** | ✅ **Definido** | Parámetros y validaciones |
| **Tipos TypeScript** | ✅ **Definidos** | En function-types.ts |
| **Políticas de Cancelación** | ✅ **Definidas** | Tabla de reembolsos |
| **Handler** | ❌ **Pendiente** | Por implementar |
| **Integración Beds24** | ❌ **Pendiente** | API endpoints |
| **Procesamiento Reembolsos** | ❌ **Pendiente** | Gateway de pagos |
| **Tests** | ❌ **Pendiente** | Casos de prueba |

---

## 🛡️ Consideraciones de Seguridad

### **Validación de Identidad:**
- ✅ Verificar email del huésped
- ✅ Validar datos de la reserva
- ✅ Registrar todas las cancelaciones
- ✅ Auditoría de cambios

### **Protección contra Fraude:**
- 🔒 Límites de cancelaciones por IP
- 🔒 Verificación de patrones sospechosos
- 🔒 Alertas para cancelaciones masivas
- 🔒 Logs detallados de todas las operaciones

---

**📅 Última actualización:** Julio 2025  
**🔗 Relacionado:** [create_booking](./create_booking.md) | [get_booking_details](./get_booking_details.md) 