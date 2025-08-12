# 📋 GUÍA COMPLETA: INTEGRACIÓN BEDS24 API

## 🔧 CONFIGURACIÓN INICIAL

### Variables de entorno (.env)
```bash
BEDS24_TOKEN=gLNPEkfnMxbKUEVPbvy7EWq/NA6cMLJ31QzPEKJlMAdk6eLSBFzSDj/puTp3HRcTeW6eu8ouWisupA/uKgWZ0DQUmZEisQe1yqz/EiS7lmUp2ScXEMmxoNgLmHHeEWAKhNcSIdKXjYpwtUxBYR7Zcrm9j8X0XBYinnPxsm5Kphg=
BEDS24_API_URL=https://api.beds24.com/v2
```

### Headers requeridos para todas las llamadas
```javascript
headers: {
  'accept': 'application/json',
  'token': BEDS24_TOKEN
}
```

---

## 🏨 1. OBTENER NOMBRES DE PROPIEDADES

### Endpoint: GET /properties
```javascript
const url = `${BEDS24_API_URL}/properties`;
const response = await axios.get(url, { headers });
```

### Mapeo de propiedades obtenido:
```javascript
const PROPERTY_MAPPING = {
  173207: '2005 A',
  173307: '1820', 
  173308: '1317',
  173309: '1722B',
  173311: '2005 B',
  173312: '1722 A',
  240061: '0715'
};
```

**Nota:** Los nombres reales son códigos de apartamentos, no nombres genéricos como "Hotel Palmeras".

---

## 📋 2. OBTENER RESERVAS

### Endpoint básico: GET /bookings
```javascript
// TODAS las reservas con todos los status
const ALL_BOOKING_STATUSES = ['confirmed', 'request', 'new', 'cancelled', 'black', 'inquiry'];

// URL con múltiples status
const params = new URLSearchParams();
ALL_BOOKING_STATUSES.forEach(status => {
  params.append('status', status);
});

const url = `${BEDS24_API_URL}/bookings?${params.toString()}`;
```

### Paginación
```javascript
let page = 1;
let hasMorePages = true;

while (hasMorePages && page <= MAX_PAGES) {
  const url = `${baseUrl}?page=${page}`;
  const response = await axios.get(url, { headers });
  
  const pageBookings = response.data.data;
  allBookings = allBookings.concat(pageBookings);
  
  hasMorePages = response.data.pages?.nextPageExists === true;
  page++;
  
  // Pausa para evitar rate limiting
  await new Promise(resolve => setTimeout(resolve, 500));
}
```

### Campos importantes de cada reserva:
```javascript
{
  bookId: "72596897",
  propertyId: 173207,
  roomId: "123", 
  arrival: "2025-08-13",
  departure: "2025-08-16",
  numAdult: 2,
  numChild: 0,
  guestFirstName: "John",
  guestName: "John Doe",
  guestEmail: "john@email.com", 
  guestPhone: "+1234567890",
  status: "confirmed",
  price: 150.00
}
```

### Cálculo de noches:
```javascript
const arrivalDate = new Date(booking.arrival);
const departureDate = new Date(booking.departure);
const numNights = Math.ceil((departureDate.getTime() - arrivalDate.getTime()) / (1000 * 60 * 60 * 24));
```

---

## 💬 3. OBTENER MENSAJES DE CONVERSACIONES

### Endpoint: GET /bookings/messages

#### ⚠️ IMPORTANTE: Sin maxAge para historial completo
```javascript
// ❌ MAL: Con limitación de tiempo
const url = `${BEDS24_API_URL}/bookings/messages?bookingId=${bookingId}&maxAge=3`;

// ✅ BIEN: Sin limitación para máximo historial
const url = `${BEDS24_API_URL}/bookings/messages?bookingId=${bookingId}`;
```

#### Parámetros disponibles:
```javascript
// Por reserva específica (recomendado)
?bookingId=72596897

// Por propiedad (todos los mensajes de la propiedad)
?propertyId=173207

// Por habitación
?roomId=123

// Por tipo de mensaje
?source=guest  // guest, host, internalNote, system

// Por estado de lectura
?filter=unread // read, unread

// Paginación
?page=1
```

### Estructura de respuesta:
```javascript
{
  "success": true,
  "data": [
    {
      "id": 112711301,
      "bookingId": 73686633,
      "read": false,
      "message": "Para preguntarte, sabes si en la zona hay gimnasio?",
      "source": "guest", // guest, host, internalNote, system
      "time": "2025-08-12T17:31:36Z",
      "attachment": null,
      "attachmentName": null,
      "attachmentMimeType": null
    }
  ]
}
```

---

## 🎯 4. FORMATO FINAL PARA CRM

### JSON Array optimizado (3 campos esenciales):
```javascript
function formatMessages(messages) {
  const sorted = messages.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  
  return sorted.map(msg => {
    const date = new Date(msg.time);
    const timeShort = date.toISOString().slice(11, 16); // HH:MM
    const dateShort = date.toISOString().slice(5, 10);  // MM-DD
    
    return {
      source: msg.source,        // guest/host
      datetime: `${dateShort} ${timeShort}`, // 08-12 14:30
      message: msg.message       // texto completo
    };
  });
}
```

### Ejemplo de salida:
```json
[
  {
    "source": "guest",
    "datetime": "08-12 17:31",
    "message": "Para preguntarte, sabes si en la zona hay gimnasio?"
  },
  {
    "source": "host", 
    "datetime": "08-12 17:36",
    "message": "Hay disponible piscina, no gimnasio"
  }
]
```

---

## 🔄 5. LÓGICA DE ACTUALIZACIÓN

### Para reservas sin mensajes:
```javascript
// Guardar array vacío (no null)
await prisma.booking.updateMany({
  where: { bookingId: booking.bookingId },
  data: { messages: [] }
});
```

### Para reservas con mensajes:
```javascript
// Guardar array JSON con conversaciones
await prisma.booking.updateMany({
  where: { bookingId: booking.bookingId },
  data: { messages: formattedMessages }
});
```

---

## ⚡ 6. OPTIMIZACIONES Y RATE LIMITING

### Pausas recomendadas:
```javascript
// Entre requests individuales
await new Promise(resolve => setTimeout(resolve, 200));

// Entre lotes
await new Promise(resolve => setTimeout(resolve, 2000));

// En caso de rate limit (429)
if (error.response?.status === 429) {
  await new Promise(resolve => setTimeout(resolve, 30000)); // 30 segundos
}
```

### Procesamiento en lotes:
```javascript
const BATCH_SIZE = 10;
for (let i = 0; i < bookings.length; i += BATCH_SIZE) {
  const batch = bookings.slice(i, i + BATCH_SIZE);
  // Procesar lote
  await new Promise(resolve => setTimeout(resolve, 2000)); // Pausa entre lotes
}
```

---

## 📊 7. ESTADÍSTICAS FINALES OBTENIDAS

| Métrica | Valor |
|---------|--------|
| Total reservas | 1,191 |
| Reservas futuras | 74 |
| Con mensajes | 20 (27%) |
| Sin mensajes | 54 (73%) |
| Total mensajes | ~194 |

### Status de reservas:
- confirmed: 562
- cancelled: 581  
- new: 43
- request: 5

---

## 🎯 8. COMANDOS ÚTILES

### Regenerar cliente Prisma después de cambios:
```bash
npx prisma generate
```

### Abrir Prisma Studio:
```bash
npx prisma studio --port 5558
```

### Verificar estructura de mensajes:
```javascript
// Buscar reservas con mensajes
const withMessages = await prisma.booking.findMany({
  where: { 
    messages: { not: [] },
    arrivalDate: { gte: today }
  },
  select: { bookingId: true, messages: true },
  take: 5
});
```

---

## ⚠️ 9. ERRORES COMUNES Y SOLUCIONES

### Error: "maxAge limitation"
- **Problema:** `maxAge=3` limita a solo 3 días
- **Solución:** Remover `maxAge` para historial completo

### Error: "Column does not exist"  
- **Problema:** Prisma cliente desactualizado
- **Solución:** `npx prisma generate`

### Error: "Rate limit 429"
- **Problema:** Demasiadas requests muy rápido
- **Solución:** Aumentar pausas entre llamadas

### Error: "Invalid JSON format"
- **Problema:** Mezcla de formatos (string vs array)
- **Solución:** Asegurar formato consistente JSON array

---

## 🔐 10. SEGURIDAD

- ✅ Token de API en `.env` (no hardcoded)
- ✅ `.env` en `.gitignore` 
- ✅ Headers de autenticación en todas las llamadas
- ✅ Manejo de errores de autenticación

---

*Guía creada durante implementación de integración Beds24 - Agosto 2025*