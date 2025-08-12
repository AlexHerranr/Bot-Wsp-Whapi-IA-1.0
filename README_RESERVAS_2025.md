# 🏨 **RESERVAS 2025** - Sistema Blindado

**Fecha:** 12 Agosto 2025  
**Estado:** 🚀 **LISTO PARA PRODUCCIÓN**  
**Beds24 API:** ✅ Integración completa optimizada

---

## 🎯 **RESUMEN EJECUTIVO**

Sistema robusto de sincronización **Beds24 → PostgreSQL** preparado para 2025, con todas las optimizaciones y lecciones aprendidas de 2024.

### **Características blindadas:**
✅ **Índices estratégicos** - Performance garantizada  
✅ **Montos sanitizados** - Sin caracteres problemáticos  
✅ **totalPersons calculado** - Adultos + niños automático  
✅ **Rangos explícitos** - No más ventanas infinitas  
✅ **Mensajes deshabilitados** - Evita bugs de API Beds24  

---

## 🚀 **INICIO RÁPIDO 2025**

```bash
# Sync completo año 2025
npx tsx src/plugins/hotel/ops/beds24/sync-reservations.ts 2025-01-01 2025-12-31

# Sync mensual enero 2025
npx tsx src/plugins/hotel/ops/beds24/sync-reservations.ts 2025-01-01 2025-01-31

# Sync trimestral Q1 2025
npx tsx src/plugins/hotel/ops/beds24/sync-reservations.ts 2025-01-01 2025-03-31
```

---

## 📊 **ESTRUCTURA DATOS 2025**

### **🎯 Campos principales:**
```sql
-- Información crítica
bookingId      VARCHAR UNIQUE    -- ID Beds24
guestName      VARCHAR           -- "Juan Pérez"
phone          VARCHAR           -- Requerido para WhatsApp
status         VARCHAR           -- confirmed/cancelled
internalNotes  VARCHAR           -- Al lado de status

-- Ubicación y fechas
propertyName   VARCHAR           -- Hotel/Apartamento
arrivalDate    VARCHAR           -- "2025-01-15"
departureDate  VARCHAR           -- "2025-01-16"
numNights      INTEGER           -- Directo de Beds24

-- Ocupación
totalPersons   INTEGER           -- Adultos + niños automático
```

### **💰 Financieros sanitizados:**
```sql
totalCharges   VARCHAR           -- "150000" (sin decimales)
totalPayments  VARCHAR           -- "75000"
balance        VARCHAR           -- "75000"
basePrice      VARCHAR           -- "140000"
charges        JSON              -- Array detallado
payments       JSON              -- Array detallado
```

---

## 🔧 **COMANDOS ÚTILES 2025**

### **Consultas frecuentes:**
```sql
-- Reservas próximas 2025
SELECT guestName, phone, arrivalDate, propertyName, status
FROM "Reservation" 
WHERE arrivalDate >= '2025-01-01' 
  AND arrivalDate <= '2025-01-31'
  AND status = 'confirmed'
ORDER BY arrivalDate;

-- Balance pendiente por cobrar
SELECT guestName, phone, balance, arrivalDate
FROM "Reservation"
WHERE balance > '0' 
  AND arrivalDate >= '2025-01-01'
ORDER BY CAST(balance AS INTEGER) DESC;

-- Conversación de huésped (cuando se habilite)
SELECT messages 
FROM "Reservation" 
WHERE phone = '+573001234567';
```

### **Prisma Studio:**
```bash
npx prisma studio
# → http://localhost:5566
```

---

## ⚡ **OPTIMIZACIONES 2025**

### **✅ Índices activos:**
- `arrivalDate` - Filtros por fecha
- `status` - Filtros por estado  
- `propertyName, arrivalDate` - Listados por hotel
- `phone` - Búsquedas WhatsApp
- `guestName` - Búsquedas por nombre

### **✅ Sanitización montos:**
```typescript
function sanitizeAmount(amount: any): string {
  if (!amount) return '0';
  // Limpiar caracteres no numéricos excepto punto decimal
  const cleaned = String(amount).replace(/[^\d.-]/g, '');
  return cleaned || '0';
}
```

### **✅ totalPersons automático:**
```typescript
const totalPersons = (Number(b.numAdult||0) + Number(b.numChild||0)) || null;
```

---

## ⚠️ **LIMITACIONES CONOCIDAS**

### **💬 Mensajes deshabilitados:**
- **Razón:** Bug en API Beds24 `/bookings/messages`
- **Problema:** No filtra por bookingId (contamina datos)
- **Solución:** Campos `messages` e `infoItems` = `[]` por defecto
- **Futuro:** Se pueden habilitar cuando Beds24 lo arregle

### **🕐 Rangos recomendados:**
- **✅ Explícitos:** `2025-01-01 2025-12-31`
- **❌ Evitar:** Rangos abiertos o muy amplios
- **📅 Producción:** Sync mensual/trimestral

---

## 📈 **MONITOREO Y SALUD**

### **Verificar sync exitoso:**
```sql
-- Últimas reservas sincronizadas
SELECT COUNT(*) as total, MAX(lastUpdatedBD) as ultima_sync
FROM "Reservation" 
WHERE arrivalDate >= '2025-01-01';

-- Distribución por estado 2025
SELECT status, COUNT(*) as cantidad
FROM "Reservation"
WHERE arrivalDate >= '2025-01-01'
GROUP BY status
ORDER BY cantidad DESC;
```

### **Logs importantes:**
```
✅ "X reservas sincronizadas"
✅ "Y propiedades obtenidas" 
⚠️ "Z salteadas sin teléfono"
```

---

## 🏆 **ARQUITECTURA FINAL**

```
Beds24 API
    ↓ 
[sync-reservations.ts]
    ↓ sanitizeAmount()
    ↓ totalPersons calc
    ↓ indices optimizados
    ↓
PostgreSQL Railway
    ↓
Prisma Client
    ↓
CRM/WhatsApp
```

---

## 🚀 **LISTO PARA 2025**

**Sistema probado, optimizado y blindado.** Sin dependencias bugueadas, con datos limpios y performance garantizada.

**Comando producción:**
```bash
npx tsx src/plugins/hotel/ops/beds24/sync-reservations.ts 2025-01-01 2025-12-31
```

🎉 **¡A conquistar el 2025!**