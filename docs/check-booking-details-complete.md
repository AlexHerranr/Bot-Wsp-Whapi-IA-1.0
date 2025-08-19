# check-booking-details - Función Completa OpenAI

## 📋 CONFIGURACIÓN DIRECTA OPENAI

### JSON para Function Definition (Copy/Paste):
```json
{
  "name": "check_booking_details",
  "description": "Consulta detalles de una reserva existente. Requiere nombre + apellido + fecha de entrada para validación.",
  "strict": true,
  "parameters": {
    "type": "object",
    "properties": {
      "firstName": {
        "type": "string",
        "description": "Nombre del huésped (ej: Juan)",
        "minLength": 2,
        "maxLength": 50
      },
      "lastName": {
        "type": "string",
        "description": "Apellido del huésped (ej: Pérez)", 
        "minLength": 2,
        "maxLength": 50
      },
      "checkInDate": {
        "type": "string",
        "description": "Fecha de entrada en formato YYYY-MM-DD",
        "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
      }
    },
    "required": ["firstName", "lastName", "checkInDate"],
    "additionalProperties": false
  }
}
```

---

## 🎯 CÓMO FUNCIONA

### Arquitectura:
```
Cliente → OpenAI Assistant → check_booking_details() → [3 Sources] → Respuesta Filtrada
                                                      ├─ Beds24 API (/bookings)
                                                      ├─ Beds24 API (/invoices)  
                                                      └─ PostgreSQL (apartamentos)
```

### Flujo Automático:
1. **Validación:** firstName, lastName, checkInDate
2. **Búsqueda Beds24:** `/bookings?arrival={fecha}` + filtro por nombres
3. **Detalles Financieros:** `/invoices?bookingId={id}` 
4. **Nombre Apartamento:** Query PostgreSQL por roomId
5. **Filtrado por Canal:** Respuesta completa vs simple

---

## 📊 RESPUESTAS POR CANAL

### 🏢 Booking.com/Direct (Completo):
```
📋 DETALLES DE RESERVA

👤 Nombre completo: Wilardy Diaz
📅 Día de entrada: 28/08/2025
📅 Día de salida: 02/09/2025
👥 Adultos y niños: 5 adultos, 0 niños
📊 Estado: ✅ Confirmada
📺 Canal: Booking.com

🏠 Apartamento 1 Alcoba 1820

💰 VALORES:
Alojamiento: $ 1.050.000 COP
cargo por servicio: $ 210.000 COP
Valor total: $ 1.260.000 COP

💳 PAGOS REALIZADOS:
Comprobante No. 0000030700: $ 210.000 COP

💰 Saldo Pendiente: $ 1.050.000 COP
────────────────────────────────────────
```

### 🌐 Airbnb/Expedia/OTAs (Simple):
```
📋 INFORMACIÓN DE RESERVA

👤 Nombre: Wilardy Diaz
📅 Entrada: 28/08/2025
📅 Salida: 02/09/2025
👥 Huéspedes: 5 adultos, 0 niños
📊 Estado: ✅ Confirmada
📺 Canal: Airbnb
🏠 Apartamento 1 Alcoba 1820
```

---

## 🧪 TEST VERIFICADO

### Test Case 1 - Wildary Diaz:
```json
{
  "firstName": "Wildary",    // → Encuentra "Wilardy" (búsqueda flexible)
  "lastName": "Diaz", 
  "checkInDate": "2025-08-28"
}
```

**Output:**
```json
{
  "success": true,
  "booking": {
    "bookingId": 71201495,
    "guestName": "Wilardy Diaz",
    "apartmentName": "Apartamento 1 Alcoba 1820",  // ← DESDE BD REAL
    "accommodationValue": 1260000,
    "channel": "Booking.com"
  }
}
```

### Test Case 2 - Castillo Sol:
```json
{
  "firstName": "Castillo",
  "lastName": "Sol", 
  "checkInDate": "2025-08-30"
}
```

**Output:**
```json
{
  "success": true,
  "booking": {
    "bookingId": 72550243,
    "guestName": "Castillo Sol",
    "apartmentName": "Apartamento 1 Alcoba 1722 A",  // ← DESDE BD REAL
    "accommodationValue": 826000,
    "status": "confirmed",
    "channel": "Booking.com"
  }
}
```

### Test Case 3 - Nombres Invertidos:
```json
{
  "firstName": "Lina",
  "lastName": "Conde", 
  "checkInDate": "2025-08-23"
}
```

**Output:** Encuentra "Conde Lina" automáticamente
```json
{
  "success": true,
  "booking": [
    {
      "bookingId": 67629019,
      "guestName": "Conde Lina",
      "apartmentName": "Apartamento 1 Alcoba 2005 A",  // ← MÚLTIPLES RESERVAS
      "status": "new",
      "channel": "Booking.com"
    },
    {
      "bookingId": 67629018,
      "guestName": "Conde Lina", 
      "apartmentName": "Aparta Estudio 1722B",
      "status": "new",
      "channel": "Booking.com"
    }
  ]
}
```

---

## 💡 FLUJO DE CONVERSACIÓN

### Escenario Típico:
```
Cliente: "Tengo una reserva confirmada para este fin de semana"

Asistente: "¡Perfecto! Para consultar tu reserva necesito:
- Tu nombre y apellido completo
- La fecha exacta de entrada"

Cliente: "Soy Wildary Diaz y llegamos el 28 de agosto"

→ [SISTEMA EJECUTA AUTOMÁTICAMENTE check_booking_details()]

Asistente: "¡Encontré tu reserva Wildary! 😊

📋 DETALLES DE RESERVA

👤 Nombre completo: Wilardy Diaz
📅 Día de entrada: 28/08/2025
📅 Día de salida: 02/09/2025
👥 Adultos y niños: 5 adultos, 0 niños

🏠 Apartamento 1 Alcoba 1820

💰 VALORES:
[... información según canal ...]"
```

---

## 🔧 CARACTERÍSTICAS TÉCNICAS

### Performance:
- **Tiempo típico:** ~1 segundo
- **Queries:** 3 por consulta (Beds24 x2 + PostgreSQL x1)
- **Rate limit:** 10 llamadas/minuto

### Búsqueda Inteligente:
- **Coincidencia parcial:** "Juan" encuentra "Juan Carlos"
- **Algoritmo Levenshtein:** "Wildary" encuentra "Wilardy" (firstName + lastName)
- **Nombres invertidos:** "Lina Conde" encuentra "Conde Lina"
- **Case insensitive:** Automático
- **Validación nombres:** Rechaza reservas con nombres vacíos

### Filtrado Automático:
- **Detecta canal:** Por `booking.referer`
- **Respuesta diferenciada:** Completa vs Simple
- **Sin configuración:** Automático según origen

---

## 📁 ARCHIVOS DEL SISTEMA

### Backend (Solo 1 archivo):
- ✅ `src/functions/booking/check-booking-details.ts` - **TODO EN UNO**

### Documentación (Solo 1 archivo):
- ✅ `docs/check-booking-details-complete.md` - **ESTE DOCUMENTO**

---

## ⚙️ CONFIGURACIÓN OPENAI

### Pasos:
1. **Abrir OpenAI Assistant**
2. **Functions → Add Function**
3. **Copy/paste JSON** de arriba
4. **Save**
5. **Test:** "Consulta reserva Wildary Diaz 28 agosto 2025"

### Variables de Entorno Requeridas:
```env
BEDS24_TOKEN=tu_token_aqui
BEDS24_API_URL=https://api.beds24.com/v2
DATABASE_URL=postgresql://...
```

---

## ✅ STATUS

### IMPLEMENTACIÓN:
- [x] **Función completa** - 1 archivo unificado
- [x] **Registry configurado** - Función registrada
- [x] **Export listo** - Para OpenAI Assistant
- [x] **Datos reales** - Test verificado exitoso
- [x] **Filtrado por canal** - Booking.com vs OTAs
- [x] **Búsqueda mejorada** - Nombres invertidos + Levenshtein
- [x] **Formateo COP** - Moneda colombiana estándar
- [x] **Status incluido** - Estado de reservas
- [x] **Canal incluido** - Origen de reserva
- [x] **Documentación única** - Este documento

### LISTO PARA:
- ✅ **OpenAI Assistant** - JSON schema incluido
- ✅ **Producción** - Datos reales funcionando  
- ✅ **Escalabilidad** - Performance optimizada

---

**🚀 FUNCIÓN PROFESIONAL COMPLETA EN 2 ARCHIVOS**

**📋 Siguiente paso:** Copy/paste JSON en OpenAI Assistant Functions

**🎯 Test inmediato:** Prompt "Consulta reserva Wildary Diaz 28 agosto 2025"