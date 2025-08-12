# 🏨 Sistema de Reservas Particionado - Bot WhatsApp

**Sistema completo de gestión de reservas con particionado inteligente y sincronización automática con Beds24.**

> **Desarrollado para optimizar consultas de WhatsApp con base de datos de +1000 reservas**

---

## 📊 Arquitectura del Sistema

### **Estructura de Tablas Particionadas**

El sistema divide las reservas en **4 tablas optimizadas** según estado y fecha de checkout:

| Tabla | Tipo | Criterio | Cantidad | Uso Principal |
|-------|------|----------|----------|---------------|
| `ReservationsPast` | ✅ Confirmadas completadas | `departure ≤ 2025-08-11` | 461 | Historial de huéspedes |
| `ReservationsConfirmedFuture` | ✅ Confirmadas futuras | `departure > 2025-08-11` + con pago/Airbnb/Expedia | 36 | Reservas activas |
| `ReservationsPendingFuture` | 🎯 **LEADS** | `departure > 2025-08-11` + sin pago + no Airbnb/Expedia | 16 | **Marketing WhatsApp** |
| `ReservationsCancelledPast` | 🚫 Canceladas completadas | `departure ≤ 2025-08-11` | 510 | Análisis de cancelaciones |
| `ReservationsCancelledFuture` | 🚫 Canceladas futuras | `departure > 2025-08-11` | 12 | Seguimiento de cancelaciones |

**Total: 1,035 reservas** con datos válidos (teléfono + nombre obligatorios)

## 🎯 **NUEVO: Sistema de LEADS Automático**

### **¿Qué es un LEAD?**
- **Reservas futuras confirmadas/nuevas** sin pago completo
- **Excluye Airbnb y Expedia** (manejan sus propios pagos)
- **Incluye solo canales directos** como Booking.com, Direct, etc.
- **16 leads activos** listos para WhatsApp marketing

### **Priorización Automática de LEADS**
- 🔥 **Alta**: Llegada ≤ 7 días O valor > $200,000
- 📅 **Media**: Llegada 8-30 días, valor estándar  
- ⏰ **Baja**: Llegada > 30 días

---

## 🎯 Criterios de Particionado

### **Por Estado de Reserva**
- **Confirmadas**: `status = 'confirmed'` → ReservationsPast/Future
- **Canceladas**: `status = 'cancelled' OR status = 'black'` → ReservationsCancelledPast/Future

### **Por Fecha de Checkout (departure)**
- **Pasadas**: `departure ≤ 2025-08-11` (fecha actual)
- **Futuras**: `departure > 2025-08-11` (actuales y futuras)

### **Filtros de Calidad**
```sql
-- Solo reservas con datos completos
phone IS NOT NULL AND LENGTH(TRIM(phone)) >= 4
AND (firstName IS NOT NULL OR lastName IS NOT NULL OR title IS NOT NULL)
```

---

## 🔄 Sistema de Sincronización

### **Script Principal: `sync-reservations.ts`**
Ubicación: `src/plugins/hotel/ops/beds24/sync-reservations.ts`

#### **Configuración Automática**
```typescript
// Modo canceladas (busca todas las reservas canceladas)
const dateFrom = '2023-01-01';  // Búsqueda amplia desde 2023
const dateTo = '2025-12-31';    // Hasta fin de 2025
const useModified = true;       // Usa fechas de modificación para canceladas
```

#### **Estados Sincronizados**
```typescript
const ALL_BOOKING_STATUSES = [
  'confirmed',   // Reservas confirmadas
  'request',     // Solicitudes pendientes  
  'new',         // Reservas nuevas
  'cancelled',   // Reservas canceladas
  'black',       // Reservas bloqueadas/canceladas
  'inquiry'      // Consultas
];
```

### **Ejecución Manual**
```bash
# Sincronizar LEADS y reservas confirmadas futuras
cd C:\Users\alex-\Bot-Wsp-Whapi-IA
npx tsx src/plugins/hotel/ops/beds24/sync-leads.ts

# Sincronizar reservas canceladas (histórico)
npx tsx src/plugins/hotel/ops/beds24/sync-reservations.ts

# Con fechas específicas
npx tsx src/plugins/hotel/ops/beds24/sync-reservations.ts 2024-01-01 2025-12-31
```

---

## 📂 Estructura de Datos

### **Campos Principales**
```typescript
interface ReservationData {
  // 🎯 INFORMACIÓN CRÍTICA
  bookingId: string;           // ID único de Beds24
  phone: string;               // Teléfono válido (≥4 dígitos)
  guestName: string;           // Nombre completo del huésped
  status: string;              // Estado: confirmed, cancelled, etc.
  
  // 🏨 UBICACIÓN
  propertyName: string;        // Nombre de la propiedad
  
  // 📅 FECHAS DE ESTADÍA
  arrivalDate: string;         // Check-in (YYYY-MM-DD)
  departureDate: string;       // Check-out (YYYY-MM-DD)
  numNights: number;           // Número de noches
  
  // 👥 OCUPACIÓN
  totalPersons: number;        // Adultos + niños
  
  // 💰 FINANCIEROS
  totalCharges: string;        // Total de cargos
  totalPayments: string;       // Total de pagos
  balance: string;             // Saldo pendiente
  basePrice: string;           // Precio base
  
  // 💳 TRANSACCIONES DETALLADAS
  charges: Array<{             // Cargos adicionales
    description: string;
    amount: string;
  }>;
  payments: Array<{            // Pagos recibidos
    description: string;
    amount: string;
  }>;
  
  // 💬 COMUNICACIÓN
  messages: Array<{            // Mensajes intercambiados
    id: number;
    time: string;
    source: string;
    direction: 'in' | 'out' | 'system';
    text: string;
  }>;
  
  // 🗂️ BACKUP COMPLETO
  raw: any;                    // Datos completos de Beds24 API
}
```

### **Índices Optimizados**
```sql
-- Cada tabla tiene estos índices para búsquedas rápidas
CREATE INDEX idx_reservations_phone ON ReservationsPast(phone);
CREATE INDEX idx_reservations_guest_name ON ReservationsPast(guestName);
CREATE INDEX idx_reservations_departure ON ReservationsPast(departureDate);
CREATE INDEX idx_reservations_property ON ReservationsPast(propertyName);
CREATE INDEX idx_reservations_booking_id ON ReservationsPast(bookingId);
```

---

## 🤖 Automatización

### **¿Qué se hace automáticamente?**

#### **1. Sincronización con Beds24** 
- ⏰ **Programada**: Cada 4 horas (configurable)
- 🔄 **Proceso**: Descarga todas las reservas desde Beds24 API
- 🎯 **Filtrado**: Solo reservas con teléfono válido y nombre
- 📊 **Distribución**: Automática según estado y fecha

#### **2. Particionado Inteligente**
- ✅ **Confirmadas** → ReservationsPast/Future (según fecha checkout)
- 🚫 **Canceladas** → ReservationsCancelledPast/Future (según fecha checkout)
- 🔄 **Upserts**: Actualiza reservas existentes sin duplicados

#### **3. Enriquecimiento de Datos**
- 💬 **Mensajes**: Extrae conversaciones desde Beds24
- 💰 **Financieros**: Calcula balances y transacciones
- 🏨 **Propiedades**: Mapea nombres de propiedades
- 📱 **Teléfonos**: Normaliza formatos internacionales

### **¿Qué hacemos desde el Backend?**

#### **1. Consultas Optimizadas**
```typescript
// Buscar reservas activas por teléfono
const activeReservations = await prisma.reservationsFuture.findMany({
  where: { phone: customerPhone },
  orderBy: { arrivalDate: 'asc' }
});

// Historial de huésped
const guestHistory = await prisma.reservationsPast.findMany({
  where: { 
    OR: [
      { phone: customerPhone },
      { guestName: { contains: guestName, mode: 'insensitive' } }
    ]
  },
  orderBy: { departureDate: 'desc' },
  take: 5
});
```

#### **2. Funciones de WhatsApp Bot**
- 🔍 **Búsqueda por teléfono**: Encuentra todas las reservas del cliente
- 📅 **Consulta de fechas**: Verificar disponibilidad y reservas
- 💰 **Estado financiero**: Balance y pagos pendientes
- 📱 **Historial de conversación**: Recuperar mensajes anteriores

#### **3. Análisis y Reportes**
```typescript
// Estadísticas de cancelaciones
const cancellationRate = await prisma.$queryRaw`
  SELECT 
    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
    COUNT(*) as total,
    ROUND(COUNT(*) FILTER (WHERE status = 'cancelled') * 100.0 / COUNT(*), 2) as rate
  FROM (
    SELECT status FROM "ReservationsPast" 
    UNION ALL 
    SELECT status FROM "ReservationsFuture"
    UNION ALL
    SELECT status FROM "ReservationsCancelledPast"
    UNION ALL
    SELECT status FROM "ReservationsCancelledFuture"
  ) all_reservations;
`;
```

---

## 🔧 Comandos Útiles

### **Administración de Base de Datos**
```bash
# Ver estructura completa
npx prisma studio  # http://localhost:5555

# Generar cliente actualizado
npx prisma generate

# Aplicar cambios de schema
npx prisma db push

# Resetear base de datos (⚠️ CUIDADO)
npx prisma db reset
```

### **Scripts de Verificación**
```typescript
// Verificar conteos por tabla
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkCounts() {
  const past = await prisma.reservationsPast.count();
  const future = await prisma.reservationsFuture.count();
  const cancelledPast = await prisma.reservationsCancelledPast.count();
  const cancelledFuture = await prisma.reservationsCancelledFuture.count();
  
  console.log({
    'Confirmadas Pasadas': past,
    'Confirmadas Futuras': future, 
    'Canceladas Pasadas': cancelledPast,
    'Canceladas Futuras': cancelledFuture,
    'Total': past + future + cancelledPast + cancelledFuture
  });
}
```

### **Consultas de Ejemplo**

#### **🎯 Consultas de LEADS (Marketing)**
```sql
-- LEADS de alta prioridad (próxima llegada)
SELECT guestName, phone, arrivalDate, totalCharges, channel
FROM "ReservationsPendingFuture"
WHERE leadPriority = 'high' AND leadStatus = 'active'
ORDER BY arrivalDate ASC;

-- LEADS por canal de origen
SELECT channel, COUNT(*) as total_leads, 
       AVG(CAST(totalCharges AS NUMERIC)) as valor_promedio
FROM "ReservationsPendingFuture"
WHERE leadStatus = 'active'
GROUP BY channel
ORDER BY total_leads DESC;

-- LEADS para seguimiento hoy
SELECT guestName, phone, arrivalDate, contactAttempts
FROM "ReservationsPendingFuture"
WHERE followUpDate = CURRENT_DATE OR
      (lastContactAt IS NULL AND leadPriority = 'high');

-- Conversión de LEADS (marcar como convertido)
UPDATE "ReservationsPendingFuture"
SET leadStatus = 'converted', lastContactAt = NOW()
WHERE bookingId = '70836255' AND totalPayments > '0';
```

#### **📊 Consultas Generales**
```sql
-- Buscar huésped por teléfono en todas las tablas
SELECT 'Confirmada Futura' as tipo, bookingId, guestName, arrivalDate, departureDate 
FROM "ReservationsConfirmedFuture" WHERE phone LIKE '%123456%'
UNION ALL
SELECT 'Lead Pendiente' as tipo, bookingId, guestName, arrivalDate, departureDate 
FROM "ReservationsPendingFuture" WHERE phone LIKE '%123456%'
UNION ALL
SELECT 'Confirmada Pasada' as tipo, bookingId, guestName, arrivalDate, departureDate 
FROM "ReservationsPast" WHERE phone LIKE '%123456%'
UNION ALL
SELECT 'Cancelada' as tipo, bookingId, guestName, arrivalDate, departureDate 
FROM "ReservationsCancelledPast" WHERE phone LIKE '%123456%';

-- Dashboard de reservas por estado
SELECT 
  'Confirmadas' as tipo, COUNT(*) as cantidad,
  SUM(CAST(totalCharges AS NUMERIC)) as valor_total
FROM "ReservationsConfirmedFuture"
UNION ALL
SELECT 
  'Leads Activos' as tipo, COUNT(*) as cantidad,
  SUM(CAST(totalCharges AS NUMERIC)) as valor_potencial
FROM "ReservationsPendingFuture"
WHERE leadStatus = 'active';
```

---

## 🚀 Integración con WhatsApp Bot

### **Funciones del Bot**
El sistema se integra con el bot de WhatsApp a través de estas funciones:

#### **1. Consulta de Reservas (Actualizado)**
```typescript
// src/functions/hotel/check-reservations.ts
async function checkReservations(phone: string) {
  // Busca en todas las tablas incluyendo LEADS
  const [confirmedFuture, pendingLeads, activePast, cancelledRecent] = await Promise.all([
    prisma.reservationsConfirmedFuture.findMany({
      where: { phone },
      orderBy: { arrivalDate: 'asc' }
    }),
    prisma.reservationsPendingFuture.findMany({
      where: { phone, leadStatus: 'active' },
      orderBy: { arrivalDate: 'asc' }
    }),
    prisma.reservationsPast.findMany({
      where: { phone },
      orderBy: { departureDate: 'desc' },
      take: 3 // Solo últimas 3 reservas pasadas
    }),
    prisma.reservationsCancelledFuture.findMany({
      where: { phone },
      orderBy: { arrivalDate: 'desc' }
    })
  ]);
  
  return { confirmedFuture, pendingLeads, activePast, cancelledRecent };
}
```

#### **🎯 NUEVAS: Funciones de LEADS**
```typescript
// src/functions/hotel/leads-management.ts
async function getActiveLeads(priority?: string) {
  return await prisma.reservationsPendingFuture.findMany({
    where: {
      leadStatus: 'active',
      ...(priority && { leadPriority: priority })
    },
    orderBy: [
      { leadPriority: 'asc' }, // high, medium, low
      { arrivalDate: 'asc' }
    ]
  });
}

async function markLeadContacted(bookingId: string, notes?: string) {
  return await prisma.reservationsPendingFuture.update({
    where: { bookingId },
    data: {
      lastContactAt: new Date(),
      contactAttempts: { increment: 1 },
      crmNotes: notes,
      followUpDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 días
    }
  });
}

async function convertLead(bookingId: string) {
  // Mover de ReservationsPendingFuture a ReservationsConfirmedFuture
  const lead = await prisma.reservationsPendingFuture.findUnique({
    where: { bookingId }
  });
  
  if (lead) {
    // Crear en confirmadas
    await prisma.reservationsConfirmedFuture.create({
      data: {
        bookingId: lead.bookingId,
        phone: lead.phone,
        guestName: lead.guestName,
        status: 'confirmed',
        // ... resto de campos sin los específicos de leads
      }
    });
    
    // Marcar lead como convertido
    await prisma.reservationsPendingFuture.update({
      where: { bookingId },
      data: { leadStatus: 'converted' }
    });
  }
}
```

#### **2. Búsqueda por Nombre**
```typescript
async function searchByGuestName(name: string) {
  const searchTerm = `%${name.toLowerCase()}%`;
  
  return await prisma.$queryRaw`
    SELECT * FROM (
      SELECT *, 'future' as table_type FROM "ReservationsFuture" 
      WHERE LOWER(guestName) LIKE ${searchTerm}
      UNION ALL
      SELECT *, 'past' as table_type FROM "ReservationsPast" 
      WHERE LOWER(guestName) LIKE ${searchTerm}
    ) combined
    ORDER BY departureDate DESC
    LIMIT 10;
  `;
}
```

### **Optimizaciones de Performance**
- 🎯 **Consultas dirigidas**: Solo busca en las tablas relevantes
- 📊 **Límites inteligentes**: Evita cargar datos innecesarios  
- 🔍 **Índices específicos**: Búsquedas por teléfono y nombre optimizadas
- ⚡ **Consultas paralelas**: Múltiples tablas consultadas simultáneamente

---

## 📈 Métricas y Monitoreo

### **Estadísticas Actuales**
- 📊 **Total reservas**: 1,035
- ✅ **Confirmadas**: 513 (461 pasadas + 52 futuras)
- 🚫 **Canceladas**: 522 (510 pasadas + 12 futuras)
- 📈 **Tasa de ocupación**: 49.6% (confirmadas vs total)
- 🚫 **Tasa de cancelación**: 50.4%

### **Distribución Temporal**
- 📅 **2024**: 445 reservas totales
- 📅 **2025**: 62 reservas futuras
- 🔄 **Crecimiento mensual**: Trackeable por `bookingDate`

### **Logs Importantes**
```typescript
// Monitorear estos eventos en los logs
'BEDS24_SYNC_START'           // Inicio de sincronización
'BEDS24_SYNC_COMPLETE'        // Sincronización completada
'RESERVATIONS_FILTERED'       // Reservas filtradas por calidad
'RESERVATION_PARTITIONED'     // Reserva asignada a tabla correcta
'PHONE_VALIDATION_FAILED'     // Teléfono inválido detectado
```

---

## 🔒 Seguridad y Backup

### **Datos Protegidos**
- 🔐 **Información PII**: Nombres y teléfonos encriptados en tránsito
- 🛡️ **Tokens API**: Variables de entorno seguras
- 📱 **Teléfonos**: Validación estricta antes de almacenar

### **Backup de Datos Raw**
- 🗂️ **Campo `raw`**: Backup completo de datos originales de Beds24
- 🔄 **Recuperación**: Posible reconstruir toda la estructura desde `raw`
- 📊 **Auditoria**: Trazabilidad completa de cambios

---

## 🆘 Troubleshooting

### **Problemas Comunes**

#### **"No se encuentran reservas"**
```bash
# Verificar sincronización
npx tsx src/plugins/hotel/ops/beds24/sync-reservations.ts

# Verificar conteos
SELECT COUNT(*) FROM "ReservationsFuture";
SELECT COUNT(*) FROM "ReservationsPast";
```

#### **"Datos desactualizados"**
```bash
# Forzar sincronización completa
export BEDS24_FULL_SYNC=true
npx tsx src/plugins/hotel/ops/beds24/sync-reservations.ts
```

#### **"Performance lenta"**
```sql
-- Verificar índices
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE tablename LIKE '%reservations%';

-- Estadísticas de consultas
EXPLAIN ANALYZE SELECT * FROM "ReservationsFuture" WHERE phone = '+1234567890';
```

### **Logs de Debug**
```bash
# Ver logs de sincronización
tail -f logs/railway/beds24-sync.log

# Monitorear consultas del bot
tail -f logs/railway/whatsapp-queries.log
```

---

## 🎯 Roadmap

### **Próximas Mejoras**
- [ ] **Auto-particionado**: Mover automáticamente reservas de Future a Past
- [ ] **Cache Redis**: Cache de consultas frecuentes por teléfono
- [ ] **Webhook real-time**: Sincronización instantánea desde Beds24
- [ ] **Analytics Dashboard**: Panel visual de métricas de reservas
- [ ] **Notificaciones**: Alertas de cancelaciones y nuevas reservas

### **Optimizaciones Técnicas**
- [ ] **Conexión pooling**: Optimizar conexiones a PostgreSQL
- [ ] **Compression**: Comprimir campo `raw` para ahorrar espacio
- [ ] **Archival**: Mover reservas muy antiguas a tabla de archivo
- [ ] **Replication**: Réplica read-only para consultas del bot

---

## 📞 Contacto y Soporte

### **Documentación Relacionada**
- 📋 [README Principal](README.md)
- 🔧 [Beds24 Integration](docs/features/BEDS24_INTEGRATION_COMPLETE.md)
- 🤖 [Bot Functions](docs/functions/)
- 📊 [Database Schema](prisma/schema.prisma)

### **Para Desarrolladores**
- 🔍 **Prisma Studio**: http://localhost:5555 (desarrollo local)
- 📁 **Código fuente**: `src/plugins/hotel/ops/beds24/`
- 🧪 **Tests**: `tests/hotel/reservations/`
- 📝 **Logs**: `logs/railway/beds24-*.log`

---

*Sistema desarrollado para optimizar las consultas de reservas en WhatsApp Bot con +1000 reservas*

**Estado**: ✅ **OPERATIVO** | **Última actualización**: Agosto 2025