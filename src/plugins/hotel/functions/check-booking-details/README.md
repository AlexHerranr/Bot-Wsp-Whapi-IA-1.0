# check-booking-details

Función para consultar detalles de reservas existentes con validación estricta de identidad.

## Arquitectura

```
Cliente → OpenAI → check_booking_details() → [Beds24 API + PostgreSQL] → Respuesta Filtrada
```

## Fuentes de Datos

1. **Beds24 API `/bookings`** - Datos de reserva + invoice items
2. **PostgreSQL `apartamentos`** - Nombres reales de apartamentos

## Validación Estricta

### Requisitos de Entrada
- **2 nombres/apellidos exactos** (firstName + lastName)
- **Fecha de entrada** (YYYY-MM-DD)

### Algoritmo de Validación
1. **Concatenación**: `title + firstName + lastName` de la reserva
2. **Normalización**: Sin mayúsculas, tildes, símbolos especiales
3. **Tokenización**: Dividir en palabras ≥2 caracteres
4. **Coincidencia**: Exactamente 2/2 palabras completas deben coincidir
5. **Sin orden**: Los nombres pueden estar desordenados

### Ejemplo
```javascript
// Búsqueda
firstName: "STIVEN", lastName: "COLEGA"

// Reserva en BD
title: "", firstName: "STIVEN ", lastName: "COLEGA"
// Concatenado: "STIVEN COLEGA"

// Validación
["stiven", "colega"] vs ["stiven", "colega"] = 2/2 ✅ VÁLIDO
```

## Filtrado por Canal

### Canales Completos (Datos financieros)
- **Booking.com**, **Direct**, **Hoteles.com**
- Retorna: Precios, pagos, saldo pendiente, contacto

### Canales Simples (Solo básicos)  
- **Airbnb**, **Expedia**
- Retorna: Nombre, fechas, huéspedes, apartamento

## Cálculos Financieros

```javascript
// Corrección implementada
const charges = items.filter(item => item.type === 'charge');
const payments = items.filter(item => item.type === 'payment');

totalCharges = sum(charges.lineTotal)        // 450k + 30k = 480k
totalPaid = sum(abs(payments.lineTotal))     // 200k
balance = totalCharges - totalPaid           // 280k
```

## API Calls Optimizadas

### Una Sola Llamada
```http
GET /bookings?arrival=2025-09-02&status=confirmed,new&includeInvoiceItems=true
```

**Antes**: 2 llamadas (bookings + invoices)  
**Ahora**: 1 llamada (todo incluido)

## Formato de Respuesta

### Una Reserva
```
*Nikoll Stephanya Wilson Peralta*
- Día de entrada: 05/09/2025
- Día de salida: 08/09/2025
- Adultos y niños: 2 adultos, 1 niños
- Estado: Nueva Reserva - Falta ---> llevar a Confirmada!
- Canal: Booking.com

Aparta Estudio 1722B
- Alojamiento: $510.000
- suplemento de limpieza: $70.000
- IVA: $96.900
- Valor total: $676.900

Total Pagado: $0!
*Saldo Pendiente:* $676.900
```

### Múltiples Reservas
```
Se encontraron 2 reservas para Juan Pérez:

--- RESERVA 1/2 ---
*Juan Pérez*
[Detalles reserva 1]

--- RESERVA 2/2 (Grupo: 12345) ---
*Juan Pérez*
[Detalles reserva 2]
```

## Manejo de Errores

1. **API Error**: `if (!response.success)` → Error específico
2. **Nombres insuficientes**: `< 2 palabras` → Rechazo
3. **Sin coincidencias**: `0/2 o 1/2 matches` → No encontrado
4. **BD Error**: Logs detallados + fallback

## Interfaces TypeScript

```typescript
interface Beds24Booking {
    id: number;
    title: string;
    firstName: string;
    lastName: string;
    invoiceItems: any[];
    bookingGroup?: { master: number; ids: number[] };
    // ... más campos
}
```

## Performance

- **Singleton Prisma**: Reutiliza conexión DB
- **Promise.all**: Apartment details en paralelo  
- **Sin searchString**: Validación local más rápida
- **Logs compactos**: Menor I/O

## Logs y Debugging

```javascript
logInfo('NAME_VALIDATION_COMPLETE', 
    `Validando: "Juan Pérez" vs title:"" firstName:"Juan" lastName:"Pérez"`, 
    { match: true, details: '2/2 palabras coinciden: ["juan", "perez"]' }
);
```

## Seguridad

- **Sin searchString API**: Evita falsos positivos
- **Validación estricta**: Mínimo 2 coincidencias exactas
- **Filtrado por canal**: Datos sensibles solo para canales apropiados
- **Normalización robusta**: Previene bypass con caracteres especiales
- **Sin bookingId**: Omitido de respuesta a OpenAI por seguridad

## Casos de Uso

### ✅ Casos Válidos
- `"Juan Pérez"` → reserva: `"Pérez Juan"` (orden invertido)
- `"maría josé"` → reserva: `"MARÍA JOSÉ"` (mayúsculas)
- `"stivén coléga"` → reserva: `"STIVEN COLEGA"` (sin tildes)

### ❌ Casos Inválidos  
- `"Juan X"` → Solo 1 coincidencia
- `"Pedro Luis"` → 0 coincidencias con `"Juan Pérez"`
- `""` → Campos vacíos

## Schema OpenAI

```json
{
  "name": "check_booking_details",
  "description": "Consulta detalles de una reserva existente. Requiere exactamente 2 nombres + fecha entrada. Busca palabras completas sin importar orden.",
  "parameters": {
    "type": "object",
    "properties": {
      "firstName": { "type": "string", "description": "Primer nombre del huésped", "minLength": 2 },
      "lastName": { "type": "string", "description": "Segundo nombre del huésped", "minLength": 2 },
      "checkInDate": { "type": "string", "description": "Fecha entrada YYYY-MM-DD", "pattern": "^\\d{4}-\\d{2}-\\d{2}$" }
    },
    "required": ["firstName", "lastName", "checkInDate"]
  }
}
```