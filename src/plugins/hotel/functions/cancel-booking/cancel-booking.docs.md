# cancel_booking - Documentación Técnica

## Descripción General

La función `cancel_booking` cancela reservas cambiando su status a "cancelled". Es una función **simple y directa** que solo cambia el estado de la reserva sin interactuar con APIs externas.

## Funcionalidad Única

### ✅ Lo que hace:
- **Validar pagos**: Verifica si hay pagos registrados (CRÍTICO)
- **Cambiar status**: De cualquier estado a "cancelled"
- **Registrar motivo**: Guarda el motivo de cancelación en notas
- **Promoción automática**: Ofrece nueva cotización según el motivo
- **Actualizar reserva**: Usa updateBooking de Beds24Client

### ❌ Lo que NO hace:
- **No cancela reservas con pagos registrados** (requiere escalación)
- No interactúa con APIs de Booking.com
- No modifica precios ni pagos
- No valida canales específicos
- No envía emails de cancelación

## Casos de Uso

### Cuándo usar cancel_booking:
1. **Precio muy alto**: Cliente indica que supera su presupuesto
2. **Cambio de planes**: Cliente cambia fechas de viaje o destino
3. **No responde seguimiento**: Cliente no contesta después de varios mensajes
4. **No le gustó apartamento**: Cliente rechaza la propuesta mostrada

### ⚠️ Cuándo NO usar (escalación requerida):
- **Reservas con pagos registrados**: Automáticamente rechazada
- **Requiere intervención manual**: Superior debe procesar reembolso

## Parámetros de Entrada

```typescript
interface CancelBookingParams {
  bookingId: number;     // ID numérico de Beds24 (OBLIGATORIO)
  reason: string;        // Motivo de cancelación (OBLIGATORIO)
  notes?: string;        // Notas adicionales (opcional)
}
```

### Parámetros Requeridos
- `bookingId`: ID numérico obtenido de check_booking_details
- `reason`: Motivo específico (mínimo 5 caracteres)

### Parámetros Opcionales
- `notes`: Información adicional sobre la cancelación

## Flujo de Ejecución

### 1. Validación de Parámetros
```typescript
// Validar parámetros obligatorios
if (!bookingId || !reason) {
  return { error: "missing_required_parameters" };
}

// Validar reason no vacío
if (reason.trim().length < 5) {
  return { error: "invalid_reason" };
}
```

### 2. Validación de Pagos (CRÍTICO)
```typescript
// Obtener reserva con invoice items
const bookingSearchResult = await beds24Client.searchBookings({
  bookingId: bookingId.toString(),
  includeInvoiceItems: true  // ✅ Incluir items para verificar pagos
});

// Verificar si hay pagos registrados
const invoiceItems = existingBooking.invoiceItems || [];
const hasPayments = invoiceItems.some(item => 
  item.type === 'payment' && item.amount && parseFloat(item.amount) > 0
);

if (hasPayments) {
  return {
    success: false,
    message: "❌ Indícale al cliente que como su reserva tiene un pago registrado no es posible anular. Te contactarás con tu superior para realizar el proceso.",
    error: "booking_has_payments",
    requiresEscalation: true
  };
}
```

### 3. Obtención de Reserva
```typescript
// Buscar reserva por ID
const bookingSearchResult = await beds24Client.searchBookings({
  bookingId: bookingId.toString(),
  includeInvoiceItems: false
});

// Obtener status actual
const currentStatus = existingBooking.status || 'unknown';
```

### 4. Actualización de Status
```typescript
const updateData = {
  id: bookingId,
  status: "cancelled",
  notes: `Cancelado por: ${reason}${notes ? '. Notas: ' + notes : ''}`
};

const updateResult = await beds24Client.updateBooking(updateData);
```

## Respuestas de la Función

### ✅ Éxito - Cancelación Exitosa
```typescript
{
  success: true,
  booking: {
    id: 74593710,
    previousStatus: 'confirmed',
    newStatus: 'cancelled',
    reason: 'precio muy alto',
    cancelDate: '22/8/2025',
    channel: 'Direct'
  },
  message: "✅ RESERVA CANCELADA EXITOSAMENTE + PROMOCIÓN AUTOMÁTICA"
}
```

### ❌ Error - Reserva Con Pagos (NUEVO)
```typescript
{
  success: false,
  message: "❌ Indícale al cliente que como su reserva tiene un pago registrado no es posible anular. Te contactarás con tu superior para realizar el proceso.",
  error: "booking_has_payments",
  requiresEscalation: true
}
```

### ❌ Error - Reserva No Encontrada
```typescript
{
  success: false,
  message: "❌ No se encontró la reserva con ID 74593710. Verifica el código de reserva.",
  error: "booking_not_found"
}
```

### ❌ Error - Motivo Inválido
```typescript
{
  success: false,
  message: "❌ reason debe tener al menos 5 caracteres explicando el motivo",
  error: "invalid_reason"
}
```

## Casos de Uso Específicos

### 1. Cliente indica precio muy alto
```typescript
const result = await cancel_booking({
  bookingId: 74593710,
  reason: "precio muy alto",
  notes: "Cliente indica que supera su presupuesto máximo"
});
```

### 2. Cliente no responde seguimiento
```typescript
const result = await cancel_booking({
  bookingId: 74593711,
  reason: "no responde seguimiento",
  notes: "Enviados 3 mensajes sin respuesta en 24 horas"
});
```

### 3. Cliente cambia de planes
```typescript
const result = await cancel_booking({
  bookingId: 74593712,
  reason: "cambio de planes",
  notes: "Cliente pospone viaje por trabajo"
});
```

### 4. Cliente rechaza apartamento
```typescript
const result = await cancel_booking({
  bookingId: 74593713,
  reason: "no le gustó apartamento",
  notes: "Cliente prefiere ubicación más cerca del centro"
});
```

## Prerequisito Obligatorio

```typescript
// SIEMPRE ejecutar primero
const bookingDetails = await check_booking_details("Carlos", "Rodríguez", "2025-12-01");
const bookingId = bookingDetails.bookingId; // Obtener ID numérico

// LUEGO ejecutar cancel_booking
const result = await cancel_booking({
  bookingId: bookingId,
  reason: "precio muy alto"
});
```

## Integración con OpenAI Assistant

### Instrucciones Claras para el LLM

**USAR cancel_booking cuando:**
- Cliente expresamente indica que NO va a tomar la reserva
- Cliente dice "muy caro", "no me convence", "cambié de planes"
- Cliente no responde después de 2-3 mensajes de seguimiento
- Cliente rechaza la propuesta de apartamento mostrada
- **Y la reserva NO tiene pagos registrados**

**NO USAR cancel_booking para:**
- **Reservas con pagos registrados** (función rechaza automáticamente)
- Consultas de información (usar check_booking_details)
- Modificar pagos (usar edit_booking)
- Cambiar fechas o datos (no disponible)
- Clientes que solo están preguntando precios

**SI la función retorna error "booking_has_payments":**
- Usar el mensaje proporcionado
- Escalar a superior inmediatamente
- No intentar forzar la cancelación

### Ejemplos de Prompts del Cliente que requieren cancel_booking:

1. **"Está muy caro, no lo voy a tomar"** → `reason: "precio muy alto"`
2. **"Cambié de planes, no voy a viajar"** → `reason: "cambio de planes"`
3. **Cliente no responde por 24+ horas** → `reason: "no responde seguimiento"`
4. **"No me gusta ese apartamento"** → `reason: "no le gustó apartamento"`

### Flujo Recomendado para el LLM:

```
1. Cliente indica que no tomará la reserva
2. Ejecutar check_booking_details para obtener bookingId
3. Ejecutar cancel_booking con motivo específico
4. Confirmar al cliente que la reserva fue cancelada
5. Ofrecer ayuda para futuras búsquedas si aplica
```

## Logging y Trazabilidad

### Eventos Registrados:
- Detección de motivo de cancelación
- Status anterior vs nuevo status
- Fecha y hora de cancelación
- Canal original de la reserva
- Resultado exitoso o error

## Consideraciones Técnicas

### Simplicidad Operacional:
- No requiere tokens especiales de API externa
- Usa solo updateBooking estándar de Beds24
- Funciona con todas las reservas sin restricción de canal
- Respuesta inmediata sin dependencias externas

### Disponibilidad:
- ✅ Función ACTIVA y disponible
- ✅ Incluida en prompt.md
- ✅ Disponible en OpenAI Assistant
- ✅ Lista para producción
- ✅ **Validación de pagos implementada**
- ✅ **Promoción automática integrada**

## Mensaje de Respuesta al Usuario

La función retorna un mensaje claro y estructurado que incluye:
- **Validación previa de pagos** (evita cancelaciones problemáticas)
- Confirmación de cancelación exitosa
- Detalles del cambio de status
- Motivo registrado
- Fecha de cancelación
- **Promoción automática** para nueva cotización
- Información sobre disponibilidad del apartamento
- Próximos pasos recomendados

## Casos Especiales

### Reservas con Pagos Registrados
Cuando una reserva tiene pagos (comprobantes registrados con `edit_booking`):
- La función **automáticamente rechaza** la cancelación
- Retorna mensaje específico para **escalación a superior**
- Evita problemas de reembolso no autorizados
- Mantiene integridad financiera del sistema

### Promoción Automática
Para motivos específicos (precio alto, no responde, no le gustó):
- **Automáticamente incluye** oferta de nueva cotización
- Convierte cancelaciones en **nuevas oportunidades**
- Mensaje proactivo para mantener al cliente

Esta función es **inteligente, segura y comercial** para manejar cancelaciones de forma profesional.