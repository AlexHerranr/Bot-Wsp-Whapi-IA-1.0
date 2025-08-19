# CONFIGURACIÓN OPENAI ASSISTANT - Pa'Cartagena Bot

## 🚀 CONFIGURACIÓN FUNCTION: check_booking_details

### 📋 PASO A PASO PARA CONFIGURAR EN OPENAI

1. **Abre OpenAI Platform** → https://platform.openai.com
2. **Ve a Assistants** → Create Assistant
3. **En Functions** → Add Function
4. **Copia y pega exactamente:**

```json
{
  "name": "check_booking_details",
  "description": "Consulta detalles de una reserva existente. Requiere nombre + apellido + fecha de entrada para validación. Maneja múltiples reservas automáticamente.",
  "strict": true,
  "parameters": {
    "type": "object",
    "properties": {
      "firstName": {
        "type": "string",
        "description": "Nombre del huésped (ej: Juan). Puede estar invertido.",
        "minLength": 2,
        "maxLength": 50
      },
      "lastName": {
        "type": "string", 
        "description": "Apellido del huésped (ej: Pérez). Puede estar invertido.",
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

5. **Save Function**
6. **Configurar Assistant Instructions:**

```
Eres el asistente oficial de Pa'Cartagena, especializado en consultar reservas existentes.

FUNCIÓN PRINCIPAL: check_booking_details
- Úsala cuando el cliente mencione que tiene una reserva
- Requieres: nombre, apellido y fecha de entrada
- La función maneja automáticamente múltiples reservas y nombres invertidos
- Siempre muestra la información formateada que retorna la función

EJEMPLOS DE USO:
Cliente: "Tengo una reserva para este fin de semana"
Tú: "Para consultar tu reserva necesito tu nombre completo y la fecha exacta de entrada"

Cliente: "Soy Wildary Diaz, llegamos el 28 de agosto"
Tú: [EJECUTAR check_booking_details con firstName:"Wildary", lastName:"Diaz", checkInDate:"2025-08-28"]

RESPUESTA:
- Muestra exactamente el mensaje formateado que retorna la función
- Si hay múltiples reservas, se mostrarán numeradas automáticamente
- Si no encuentra reserva, ayuda a verificar datos

NO INVENTES información de reservas. Solo usa la función.
```

7. **Configurar Model:** GPT-4 recomendado
8. **Save Assistant**

---

## 🧪 CASOS DE PRUEBA PARA VALIDAR

### Test 1: Reserva Simple
**Prompt:** "Hola, tengo una reserva confirmada para Wildary Diaz el 28 de agosto de 2025"

**Resultado esperado:** 
- Ejecuta función automáticamente
- Muestra detalles completos de Wilardy Diaz (con búsqueda flexible)
- Incluye apartamento, fechas, estado, canal

### Test 2: Nombres Invertidos  
**Prompt:** "Consulta la reserva de Lina Conde para el 23 de agosto"

**Resultado esperado:**
- Encuentra "Conde Lina" automáticamente 
- Muestra múltiples reservas si las hay
- Numeradas como "RESERVA 1:", "RESERVA 2:"

### Test 3: Solicitud de Información
**Prompt:** "Necesito consultar mi reserva pero no recuerdo los detalles"

**Resultado esperado:**
- Pregunta por nombre completo y fecha de entrada
- NO ejecuta función hasta tener datos completos
- Guía amigablemente para obtener información

### Test 4: Reserva No Encontrada
**Prompt:** "Busca la reserva de Juan Pérez para el 1 de enero 2025"

**Resultado esperado:**
- Ejecuta función
- Muestra mensaje de "no encontrado"
- Ofrece ayuda para verificar datos

---

## 📊 RESPUESTAS TÍPICAS POR CANAL

### 🏢 Booking.com/Direct (Formato Completo):
```
📋 DETALLES DE RESERVA

👤 Nombre completo: Castillo Sol
📅 Día de entrada: 30/08/2025
📅 Día de salida: 02/09/2025
👥 Adultos y niños: 5 adultos, 1 niños
📊 Estado: ✅ Confirmada
📺 Canal: Booking.com

🏠 Apartamento 1 Alcoba 1722 A

💰 VALORES:
Alojamiento: $ 630.000 COP
cargo por limpieza: $ 70.000 COP
IVA: $ 126.000 COP
Valor total: $ 826.000 COP

💰 Saldo Pendiente: $ 826.000 COP
────────────────────────────────────────
```

### 🌐 Airbnb/Expedia (Formato Simple):
```
📋 INFORMACIÓN DE RESERVA

👤 Nombre: ANDRES FELIPE LEDESMA TAIMAL
📅 Entrada: 30/08/2025
📅 Salida: 02/09/2025
👥 Huéspedes: 4 adultos, 2 niños
📊 Estado: ✅ Confirmada
📺 Canal: Expedia Affiliate Network
🏠 Apartamento 1 Alcoba 2005 A
```

---

## 🔧 CARACTERÍSTICAS TÉCNICAS IMPLEMENTADAS

### ✅ Búsqueda Inteligente:
- **Coincidencia parcial:** "Juan" encuentra "Juan Carlos"
- **Levenshtein:** "Wildary" encuentra "Wilardy" (ambos nombres)
- **Nombres invertidos:** "Lina Conde" encuentra "Conde Lina"
- **Case insensitive:** Automático
- **Validación nombres vacíos:** Rechaza reservas sin nombres

### ✅ Filtrado por Status:
- **Prioridad:** confirmed/new > cancelled
- **Solo cancelled:** Si no hay activas, muestra las cancelled
- **Múltiples status:** Maneja automáticamente

### ✅ Múltiples Reservas:
- **Numeración automática:** "🔹 RESERVA 1:", "🔹 RESERVA 2:"
- **Apartamentos diferentes:** Desde BD PostgreSQL real
- **Status independientes:** Cada reserva con su estado

### ✅ Formateo por Canal:
- **Booking.com/Direct:** Detalles financieros completos
- **Airbnb/Expedia:** Solo información básica
- **Automático:** Sin configuración manual

### ✅ Datos Reales:
- **Beds24 API:** `/bookings` + `/invoices`
- **PostgreSQL:** Nombres de apartamentos
- **Formateo COP:** Moneda colombiana estándar
- **Performance:** ~1 segundo por consulta

---

## 🚨 TROUBLESHOOTING

### Problema: Función no encuentra reserva existente
**Causa:** Nombre con diferencia tipográfica > 2 caracteres
**Solución:** Pedir al cliente verificar escritura exacta

### Problema: Muestra reservas con nombres vacíos
**Causa:** Bug ya corregido en versión actual
**Verificar:** Función debe rechazar automáticamente nombres vacíos

### Problema: Formateo de moneda incorrecto
**Causa:** Versión anterior del código
**Verificar:** Debe mostrar "$ 676.900 COP" (formato colombiano)

### Problema: No muestra múltiples reservas
**Causa:** Función devuelve solo primera coincidencia
**Verificar:** Debe mostrar todas las reservas válidas numeradas

---

## 📈 MÉTRICAS DE ÉXITO

### KPIs Técnicos:
- **Tiempo respuesta:** < 3 segundos
- **Tasa encontradas:** > 85% de consultas exitosas
- **Precisión nombres:** > 95% con búsqueda flexible
- **Uptime:** > 99.5%

### KPIs de Negocio:
- **Satisfacción cliente:** Información completa inmediata
- **Reducción consultas:** Menos escalaciones a humano
- **Conversión:** Clientes que confirman datos para modificaciones

---

## 🔐 VARIABLES DE ENTORNO REQUERIDAS

```env
# Backend debe tener configurado:
BEDS24_TOKEN=token_beds24_api
BEDS24_API_URL=https://api.beds24.com/v2
DATABASE_URL=postgresql://usuario:password@host/database

# OpenAI Platform:
# - Assistant configurado con función
# - Modelo GPT-4 recomendado
# - Instructions configuradas
```

---

## ✅ CHECKLIST DE CONFIGURACIÓN

### OpenAI Platform:
- [ ] Assistant creado
- [ ] Function `check_booking_details` agregada
- [ ] JSON schema copiado exactamente
- [ ] Instructions configuradas
- [ ] Model GPT-4 seleccionado
- [ ] Assistant activado

### Backend:
- [ ] Archivo `check-booking-details.ts` en src/functions/booking/
- [ ] Variables de entorno configuradas
- [ ] Base de datos PostgreSQL conectada
- [ ] Beds24 API token válido
- [ ] Function registry actualizado

### Testing:
- [ ] Test básico: "Consulta reserva Wildary Diaz 28 agosto 2025"
- [ ] Test invertido: "Busca Lina Conde 23 agosto"
- [ ] Test múltiple: Reserva con varias coincidencias
- [ ] Test no encontrada: Nombre inexistente

---

## 🚀 ¡FUNCIÓN LISTA PARA PRODUCCIÓN!

**Estado:** ✅ Implementado y optimizado  
**Próximo paso:** Copy/paste JSON en OpenAI Assistant  
**Test inmediato:** "Consulta reserva Castillo Sol 30 agosto 2025"

**📋 La función está completamente configurada con:**
- ✅ Búsqueda inteligente con nombres invertidos
- ✅ Múltiples reservas manejadas automáticamente  
- ✅ Formateo diferenciado por canal
- ✅ Datos reales desde Beds24 + PostgreSQL
- ✅ Formateo COP colombiano
- ✅ Status y canal incluidos
- ✅ Manejo robusto de errores

¡Lista para conectar con OpenAI Assistant! 🎉