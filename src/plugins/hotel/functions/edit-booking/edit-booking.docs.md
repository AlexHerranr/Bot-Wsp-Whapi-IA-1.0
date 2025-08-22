# edit_booking - Documentación Técnica

## Descripción General

La función `edit_booking` registra comprobantes de pago en reservas existentes de **Booking.com** y **Direct** únicamente. **NO modifica el status de la reserva** - solo añade pagos.

## Características Principales

### ✅ Funcionalidades Soportadas
- **Registro de pagos**: Añade comprobantes sin modificar status
- **Validación automática de canal**: Solo permite Booking.com y Direct
- **Detección robusta de canal**: Normaliza valores de `referer`
- **Preservación de status**: Mantiene el status actual de la reserva

### ❌ Funcionalidades NO Soportadas
- Modificación de status de reserva
- Cancelaciones (usar función separada `cancel_booking`)
- Pagos en Airbnb/Expedia (automáticamente rechazados)
- Modificación de datos de huéspedes o fechas

## Flujo de Ejecución

### 1. Validación de Parámetros
```typescript
interface EditBookingParams {
  bookingId: number;                    // ID numérico de Beds24
  paymentAmount: number;                // Mínimo $1.000 COP
  paymentDescription: string;           // Descripción del comprobante
  notes?: string;                       // Notas adicionales opcionales
}
```

### 2. Obtención de Datos de Reserva
```typescript
// Busca reserva por ID
const bookingSearchResult = await beds24Client.searchBookings({
  bookingId: bookingId.toString(),
  includeInvoiceItems: false
});
```

### 3. Validación de Canal
```typescript
const rawChannel = existingBooking.referer || 'Unknown';

// Normalización robusta
let bookingChannel = rawChannel;
if (rawChannel.toLowerCase().includes('booking.com')) {
  bookingChannel = 'Booking.com';
} else if (rawChannel.toLowerCase().includes('direct') || 
           rawChannel.toLowerCase().includes('pacartagena')) {
  bookingChannel = 'Direct';
}

// Validación estricta
const isBookingCom = bookingChannel === 'Booking.com';
const isDirect = bookingChannel === 'Direct';

if (!isBookingCom && !isDirect) {
  return { error: "channel_not_allowed_for_payments" };
}
```

### 4. Preparación de Datos
```typescript
// Solo registro de pago (sin modificar status)
const bookingUpdateData = {
  id: bookingId,
  // NO incluir status - mantener el actual
  invoiceItems: [{
    type: "payment",
    amount: params.paymentAmount,
    description: `Pago registrado: ${params.paymentDescription}`
  }],
  ...(params.notes && { notes: params.notes })
};
```

### 5. Actualización en Beds24
```typescript
const responseData = await beds24Client.updateBooking(bookingUpdateData);
```

## Detección de Canales

### Valores de `referer` Reconocidos

| Canal | Valores de `referer` | Normalizado a | Pagos Permitidos |
|-------|---------------------|---------------|------------------|
| Booking.com | `"Booking.com"`, `"booking.com"` | `"Booking.com"` | ✅ SÍ |
| Direct | `"Direct"`, `"pacartagena2"`, `"pacartagena"` | `"Direct"` | ✅ SÍ |
| Airbnb | `"Airbnb"`, `"airbnb.com"` | Sin normalizar | ❌ NO |
| Expedia | `"Expedia"`, `"expedia.com"` | Sin normalizar | ❌ NO |
| Otros OTAs | Cualquier otro valor | Sin normalizar | ❌ NO |

### Lógica de Normalización
```typescript
if (rawChannel.toLowerCase().includes('booking.com')) {
  bookingChannel = 'Booking.com';
} else if (rawChannel.toLowerCase().includes('direct') || 
           rawChannel.toLowerCase().includes('pacartagena')) {
  bookingChannel = 'Direct';
}
// Otros canales mantienen valor original para mostrar en error
```

## Respuestas de la Función

### ✅ Éxito - Pago Registrado
```typescript
{
  success: true,
  booking: {
    id: bookingId,
    status: modifiedBooking.status, // Status actual sin cambios
    paymentAmount: params.paymentAmount,
    paymentDescription: params.paymentDescription
  },
  message: "✅ **PAGO REGISTRADO EXITOSAMENTE**\n\n📋 **DETALLES DEL PAGO:**..."
}
```

### ❌ Error - Canal No Permitido
```typescript
{
  success: false,
  message: "❌ Los pagos solo se pueden registrar para reservas de Booking.com y Directas. Esta reserva es de: Airbnb",
  error: "channel_not_allowed_for_payments"
}
```

### ❌ Error - Reserva No Encontrada
```typescript
{
  success: false,
  message: "❌ No se encontró la reserva con ID 12345. Verifica el código de reserva.",
  error: "booking_not_found"
}
```

### ❌ Error - Parámetros Faltantes
```typescript
{
  success: false,
  message: "Se requiere: paymentAmount (del comprobante) y paymentDescription (descripción del comprobante recibido)",
  error: "missing_payment_data"
}
```

## Prerequisitos y Dependencias

### Prerequisito Obligatorio
```typescript
// SIEMPRE ejecutar primero
const bookingDetails = await check_booking_details(firstName, lastName, checkInDate);
const bookingId = bookingDetails.bookingId; // Obtener ID numérico

// LUEGO ejecutar edit_booking
const result = await edit_booking({
  bookingId: bookingId,
  paymentAmount: 200000,
  paymentDescription: 'Transferencia Bancolombia'
});
```

### Dependencias
- **Beds24Client**: Para búsqueda y actualización de reservas
- **Logger**: Para trazabilidad completa (`logInfo`, `logError`, `logSuccess`)
- **check_booking_details**: Para obtener `bookingId` numérico

## Validaciones Implementadas

### 1. Validación de Parámetros
- `paymentAmount >= 1000` (mínimo $1.000 COP)
- `paymentDescription` no vacío
- `bookingId` numérico válido

### 2. Validación de Reserva
- Reserva debe existir en Beds24
- Debe tener campo `referer` válido

### 3. Validación de Canal
- Solo `Booking.com` y `Direct` permitidos
- Normalización automática de valores
- Rechazo explícito de otros OTAs

### 4. Validación de Datos de Pago
- Monto mínimo de $1.000 COP
- Descripción obligatoria del comprobante
- Formato correcto para `invoiceItems`

## Logging y Trazabilidad

### Eventos Loggeados
```typescript
// Detección de canal
logInfo('EDIT_BOOKING', 'Canal de reserva detectado', { 
  bookingId, 
  rawChannel,
  normalizedChannel: bookingChannel
});

// Validación exitosa
logInfo('EDIT_BOOKING', 'Canal válido para registrar pagos', { 
  bookingId, 
  channel: bookingChannel 
});

// Preparación de datos
logInfo('EDIT_BOOKING', 'Registrando pago sin modificar status', {
  bookingId,
  paymentAmount: params.paymentAmount,
  paymentDescription: params.paymentDescription
});

// Resultado exitoso
logSuccess('EDIT_BOOKING', `Pago registrado exitosamente: ${bookingId}`, {
  bookingId: bookingId,
  paymentAmount: params.paymentAmount,
  status: modifiedBooking.status
});
```

## Casos de Uso Típicos

### 1. Cliente de Booking.com registra pago
```typescript
const result = await edit_booking({
  bookingId: 12345,
  paymentAmount: 250000,
  paymentDescription: 'Transferencia Bancolombia - comprobante #123456'
});
// Status se mantiene + pago registrado
```

### 2. Cliente directo añade pago parcial
```typescript
const result = await edit_booking({
  bookingId: 67890,
  paymentAmount: 150000,
  paymentDescription: 'Voucher Nequi recibido',
  notes: 'Primer pago de anticipo'
});
// Status permanece igual + pago registrado
```

### 3. Cliente de Airbnb intenta pagar (rechazado)
```typescript
const result = await edit_booking({
  bookingId: 11111,
  paymentAmount: 100000,
  paymentDescription: 'Transferencia'
});
// result.success = false
// result.error = "channel_not_allowed_for_payments"
```

## Integración con OpenAI Assistant

### Prompt de Uso
```
Solo usar edit_booking cuando:
1. Cliente de Booking.com o Direct envía comprobante de pago
2. Ya tienes bookingId de check_booking_details
3. Tienes monto y descripción del comprobante
4. NO necesitas cambiar el status de la reserva

NO usar para:
- Clientes de Airbnb/Expedia
- Cancelaciones
- Modificar status de reserva
- Modificar datos de huéspedes
```

### Manejo de Errores
```
Si edit_booking falla:
1. Verificar que sea canal permitido
2. Confirmar que bookingId es correcto
3. Validar monto mínimo $1.000
4. Escalar si persiste: "Permíteme consultar con mi superior"
```

## Migración y Cambios Recientes

### Eliminado en esta versión:
- ❌ Parámetro `action` (solo una función: registrar pago)
- ❌ Acción `confirm_with_payment` (no modifica status)
- ❌ Parámetros `cancellationReason` 
- ❌ Respuesta `canOfferDiscount`
- ❌ Lógica de cancelación con descuentos

### Mejorado en esta versión:
- ✅ Simplificación total: solo registra pagos
- ✅ Preservación completa del status actual
- ✅ Detección robusta de canales
- ✅ Validación estricta por tipo de reserva
- ✅ Logging detallado para debugging
- ✅ Mensajes de error específicos

### Compatibilidad
- ✅ Mantiene compatibilidad con Beds24Client existente
- ✅ Formato de respuesta consistente con otras funciones
- ✅ Schema OpenAI actualizado y validado

## Testing y Debugging

### Para verificar funcionamiento:
```bash
# 1. Verificar que reserva existe
const booking = await check_booking_details("Juan", "Pérez", "2025-01-15");

# 2. Verificar canal
console.log(booking.channel); // Debe ser "Booking.com" o "Direct"

# 3. Ejecutar edit_booking
const result = await edit_booking({
  bookingId: booking.bookingId,
  paymentAmount: 200000,
  paymentDescription: 'Test payment'
});

# 4. Verificar resultado
console.log(result.success); // true para canales permitidos
```

### Logs útiles para debugging:
- Buscar `EDIT_BOOKING` en logs del sistema
- Verificar `rawChannel` vs `normalizedChannel`
- Revisar `channel_not_allowed_for_payments` para rechazos
- Monitorear respuestas de Beds24 en `updateBooking`
- Confirmar que status se mantiene sin cambios