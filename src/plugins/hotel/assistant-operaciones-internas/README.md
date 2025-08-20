# 🏨 Assistant de Operaciones Internas - Pa'Cartagena

## 📋 **RESUMEN EJECUTIVO**

Sistema completo para generar y enviar reportes operativos diarios del hotel Pa'Cartagena al equipo de trabajo a través de WhatsApp.

---

## 🎯 **FUNCIONALIDAD PRINCIPAL**

### **Función: `informar_movimiento_manana`**

Genera reportes operativos con información clave para coordinación interna:

- **🚪 Salidas:** Huéspedes que se van (con teléfonos)
- **🔑 Entradas:** Huéspedes que llegan (con saldos pendientes)
- **🏠 Ocupados:** Apartamentos que continúan ocupados (con fechas de salida)
- **🏡 Desocupados:** Apartamentos disponibles (con duración desde hoy)

### **Características Técnicas:**
- **Datos reales** desde Beds24 API
- **4 consultas paralelas:** entradas, salidas, activas, próximas
- **Performance:** ~2-3 segundos
- **Formato WhatsApp:** Emojis y texto optimizado para móviles
- **Envío automático:** Mensaje directo al grupo operativo

## 📁 ESTRUCTURA

```
assistant-operaciones-internas/
├── prompt-operaciones.md           📄 Prompt específico para personal
├── schemas/
│   └── informar-movimiento-manana.json ✅ Función única para reportes
├── files/                          📁 Para manuales internos, protocolos
├── README.md                       📋 Esta guía
└── CONFIGURACION-OPERACIONES.md    ⚡ Setup rápido
```

## 🔧 FUNCIÓN DISPONIBLE

### **`informar_movimiento_manana`**
**Propósito:** Reporte diario de movimientos para equipo hotelero

#### **🔧 DETALLES TÉCNICOS:**

**Endpoints Beds24 consultados:** 4 llamadas paralelas
1. **ENTRADAS:** `/bookings?arrivalFrom=fecha&arrivalTo=fecha` 
2. **SALIDAS:** `/bookings?departureFrom=fecha&departureTo=fecha`
3. **OCUPADOS:** `/bookings?arrivalTo=fecha&departureFrom=fecha`
4. **PRÓXIMAS:** `/bookings?arrivalFrom=fecha&arrivalTo=fecha+30días`

**Campos extraídos por reserva:**
- `firstName`, `lastName` → Nombre huésped
- `phone`, `mobile` → Teléfono (prioridad: phone)
- `roomId` → Convertido a nombre apartamento (715, 1820, etc.)
- `notes`, `comments` → Horas y comentarios internos
- `invoice` → Pagos y saldos pendientes
- `price` → Precio total reserva

#### **📝 EXTRACCIÓN DE HORAS:**

**Campos origen:** `booking.notes` + `booking.comments`

**Palabras clave para ENTRADA:**
- `hora entrada: 15:00`
- `llegada: 3:00 PM`
- `check in: 14:30`
- `entrada: 15:00`

**Palabras clave para SALIDA:**
- `hora salida: 10:00`
- `check out: 11:00`
- `salida: 10:30`
- `departure: 9:00`

**Formato soportado:** 24h (15:00) o 12h (3:00 PM)

#### **💰 CÁLCULO DE SALDOS:**
```typescript
pagos = booking.invoice.filter(item => item.type === 'payment')
saldoPendiente = booking.price - suma(pagos)
```

**Input:**
- `fecha` (YYYY-MM-DD, requerido) - Fecha del reporte  
- `incluirSaldos` (boolean, requerido) - Si incluir información financiera

**Output:**
```
📅 *Martes 21 de agosto de 2025*

🚪 *SALE:*
715 - Juan Pérez | Tel: 300123456 | Hora: 10:00
2005A - María López | Tel: N/A | Hora: N/A

🔑 *ENTRA:*  
1820 - Carlos Silva | Tel: 311987654 | Hora: 15:00 | Saldo: $50,000
1722A - Ana García | Tel: N/A | Hora: N/A | Saldo: N/A

🏠 *OCUPADOS:*
2005B - Luis Rodríguez | Sale: 23 ago

🏡 *DESOCUPADOS:*
1317 | Disponible: 5 noches (desde hoy)
1722B | Disponible: 30+ días (desde hoy)
```

**Llamadas a OpenAI:** 0 (la función solo consulta Beds24 y formatea datos)

---

## 🚀 CONFIGURACIÓN EN OPENAI

### Paso 1: Crear Nuevo Assistant
1. **OpenAI Platform** → **Create new Assistant**
2. **Name:** "Pa'Cartagena - Operaciones Internas"
3. **Description:** "Assistant para personal hotelero - reportes operativos"

### Paso 2: Instructions
- **Copy/paste:** Todo el contenido de `prompt-operaciones.md`

### Paso 3: Function
- **Add Function** → Copy/paste: `schemas/informar-movimiento-manana.json`

### Paso 4: Configuración
- **Model:** GPT-4o (recomendado para personal)
- **Temperature:** 0.2 (respuestas precisas)
- **Save Assistant**

---

## 👥 USUARIOS OBJETIVO

### **Personal Recepción:**
- Ver entradas del día con saldos pendientes
- Teléfonos de clientes para coordinación
- Horas de llegada reportadas

### **Personal Limpieza:**
- Ver salidas del día para programar limpieza
- Apartamentos que se desocupan
- Horas de checkout reportadas

### **Administración:**
- Reporte completo con información financiera
- Saldos pendientes totales
- Coordinación general de operaciones

### **Gerencia:**
- Vista ejecutiva de ocupación
- Información para toma de decisiones
- Resúmenes operativos

---

## 📱 PROMPTS DE PRUEBA

### Testing básico:
1. **"Reporte de movimientos para mañana"**
2. **"¿Qué entradas hay el 19 de agosto?"**
3. **"¿Qué apartamentos se desocupan mañana?"**
4. **"Información operativa completa del día"**

### Testing avanzado:
5. **"Saldos pendientes de las entradas de mañana"**
6. **"¿Hay notas especiales para huéspedes que llegan?"**
7. **"Coordinación de limpieza para salidas"**

---

## 🔐 ACCESO Y SEGURIDAD

### **SOLO PERSONAL INTERNO:**
- Assistant separado del público
- Información confidencial (teléfonos, saldos)
- Acceso restringido al equipo autorizado

### **Información Sensible:**
- ✅ Teléfonos de clientes
- ✅ Saldos pendientes
- ✅ Notas internas
- ✅ Canales de reserva

**⚠️ NO compartir este Assistant con clientes externos**

---

## 📊 DIFERENCIAS CON ASSISTANT PRINCIPAL

| Aspecto | Assistant Clientes | Assistant Operaciones |
|---------|-------------------|----------------------|
| **Usuarios** | Clientes externos | Personal interno |
| **Funciones** | 4 funciones completas | 1 función específica |
| **Información** | Pública (precios, disponibilidad) | Interna (teléfonos, saldos) |
| **Tono** | Conversacional, venta | Operativo, directo |
| **Propósito** | Generar reservas | Coordinar operaciones |

---

## ⚙️ **INTEGRACIÓN TÉCNICA CON EL BOT PRINCIPAL**

### **🔄 Sistema de Routing por Chat ID**

El bot principal automáticamente detecta y redirige mensajes específicos al assistant de operaciones basado en el **Chat ID único del grupo**:

#### **Configuración en `.env`:**
```bash
# Assistant de operaciones internas
OPERATIONS_ASSISTANT_ID=asst_JuluW5jVoLCWQy0iwSlDEkaX
OPERATIONS_CHAT_ID=120363419376827694@g.us
```

#### **Funcionamiento Técnico:**

1. **Detección Automática:**
   ```typescript
   const operationsChatId = process.env.OPERATIONS_CHAT_ID;
   const isOperationsGroup = operationsChatId && chatId === operationsChatId;
   ```

2. **Routing Inteligente:**
   - **Chat normal** → Assistant principal (`asst_SRqZsLGTOwLCXxOADo7beQuM`)
   - **Grupo operaciones** → Assistant operaciones (`asst_JuluW5jVoLCWQy0iwSlDEkaX`)

3. **Cambio Temporal de Assistant:**
   ```typescript
   // Guardar assistant original
   const originalAssistantId = openaiService.config.assistantId;
   
   // Cambiar temporalmente
   openaiService.config.assistantId = operationsAssistantId;
   
   // Procesar mensaje
   const result = await openaiService.processMessage(...);
   
   // Restaurar siempre
   openaiService.config.assistantId = originalAssistantId;
   ```

### **🔧 Implementación Mínima**

**Archivos modificados:** Solo 2
- **`.env`** - Configuración (2 líneas)
- **`webhook-processor.ts`** - Routing (40 líneas)

**Características:**
- ✅ **Threads separados automáticamente** por Chat ID único
- ✅ **Sin contaminación de contexto** entre chats
- ✅ **Cero breaking changes** en el bot principal
- ✅ **Restauración automática** del assistant original

### **📊 Separación de Threads**

| Tipo Chat | User ID | Chat ID | Thread Generado |
|------------|---------|---------|-----------------|
| **Cliente normal** | `573001234567` | `573001234567@s.whatsapp.net` | `thread_A` |
| **Grupo operaciones** | `573001234567` | `120363419376827694@g.us` | `thread_B` |

**Resultado:** Contextos completamente independientes sin configuración adicional.

### **🚀 Cómo Agregar Nuevos Chats de Operaciones**

1. **Obtener Chat ID del grupo/contacto**
2. **Crear nuevo assistant en OpenAI** (opcional)
3. **Agregar a `.env`:**
   ```bash
   VENTAS_ASSISTANT_ID=asst_nuevoID
   VENTAS_CHAT_ID=120000000000000000@g.us
   ```
4. **Modificar routing en `webhook-processor.ts`** (3 líneas)

---

## 🎯 RESULTADO ESPERADO

**Personal del hotel tendrá:**
- ✅ **Información operativa** en tiempo real
- ✅ **Formato específico** para coordinación
- ✅ **Datos sensibles** solo para equipo interno
- ✅ **Reportes precisos** para toma de decisiones
- ✅ **Assistant exclusivo** sin interferencias

**¡Assistant especializado para operaciones hoteleras internas con routing automático!** 🏨
