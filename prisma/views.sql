-- 📚 VISTAS PARA REEMPLAZAR TABLAS PARTICIONADAS
-- Estas vistas proporcionan la misma funcionalidad que las 6 tablas originales
-- pero consultando la tabla unificada Booking

-- 🏆 RESERVAS PASADAS (≤ 2025-08-11)
CREATE OR REPLACE VIEW vw_reservations_past AS
SELECT 
  id,
  "bookingId",
  phone,
  "guestName",
  status,
  "internalNotes",
  "propertyName",
  "arrivalDate",
  "departureDate",
  "numNights",
  "totalPersons",
  "totalCharges",
  "totalPayments",
  balance,
  "basePrice",
  channel,
  email,
  country,
  "guestLang",
  "apiReference",
  charges,
  payments,
  messages,
  "infoItems",
  notes,
  "bookingDate",
  "modifiedDate",
  "lastUpdatedBD",
  raw
FROM "Booking"
WHERE "departureDate" <= '2025-08-11'
  AND status IN ('confirmed', 'cancelled', 'black', 'inquiry', 'request');

-- ✅ RESERVAS CONFIRMADAS FUTURAS (> 2025-08-11)
CREATE OR REPLACE VIEW vw_reservations_confirmed_future AS
SELECT 
  id,
  "bookingId",
  phone,
  "guestName",
  status,
  "internalNotes",
  "propertyName",
  "arrivalDate",
  "departureDate",
  "numNights",
  "totalPersons",
  "totalCharges",
  "totalPayments",
  balance,
  "basePrice",
  channel,
  email,
  country,
  "guestLang",
  "apiReference",
  charges,
  payments,
  messages,
  "infoItems",
  notes,
  "bookingDate",
  "modifiedDate",
  "lastUpdatedBD",
  raw
FROM "Booking"
WHERE "departureDate" > '2025-08-11'
  AND status = 'confirmed'
  AND (
    ("totalPayments" IS NOT NULL AND CAST("totalPayments" AS DECIMAL) > 0)
    OR channel ILIKE '%airbnb%'
    OR channel ILIKE '%expedia%'
  );

-- 🎯 RESERVAS PENDIENTES FUTURAS (LEADS) (> 2025-08-11)
CREATE OR REPLACE VIEW vw_reservations_pending_future AS
SELECT 
  id,
  "bookingId",
  phone,
  "guestName",
  status,
  "internalNotes",
  "propertyName",
  "arrivalDate",
  "departureDate",
  "numNights",
  "totalPersons",
  "totalCharges",
  "totalPayments",
  balance,
  "basePrice",
  channel,
  email,
  country,
  "guestLang",
  "apiReference",
  charges,
  payments,
  messages,
  "infoItems",
  "leadStatus",
  "leadPriority",
  "leadSource",
  "createdAt",
  "lastContactAt",
  "followUpDate",
  "crmNotes",
  "contactAttempts",
  notes,
  "bookingDate",
  "modifiedDate",
  "lastUpdatedBD",
  raw
FROM "Booking"
WHERE "departureDate" > '2025-08-11'
  AND status IN ('confirmed', 'new')
  AND ("totalPayments" IS NULL OR CAST("totalPayments" AS DECIMAL) = 0)
  AND channel NOT ILIKE '%airbnb%'
  AND channel NOT ILIKE '%expedia%'
  AND "isDiscarded" = false;

-- 🗑️ LEADS DIRECTOS (Vista simplificada para gestión comercial)
CREATE OR REPLACE VIEW vw_leads_directos AS
SELECT 
  id,
  "bookingId",
  "guestName" as huesped,
  "propertyName" as apto,
  "arrivalDate" as llegada,
  "totalPersons" as pax,
  phone as telefono,
  "leadStatus" as "estadoLead",
  "leadPriority" as prioridad,
  "lastContactAt" as "ultimaGestion",
  "totalCharges" as "valorReserva",
  channel as canal,
  "followUpDate" as "proximaAccion",
  "contactAttempts" as "intentosContacto",
  "crmNotes" as notas,
  NULL as responsable,  -- Se puede añadir después
  "createdAt" as "fechaCreacion",
  NULL as "fechaConversion",  -- Se puede calcular después
  "lastUpdatedBD" as "lastSyncAt",
  raw as "reservaCompleta"
FROM "Booking"
WHERE "departureDate" > '2025-08-11'
  AND status IN ('confirmed', 'new')
  AND ("totalPayments" IS NULL OR CAST("totalPayments" AS DECIMAL) = 0)
  AND channel NOT ILIKE '%airbnb%'
  AND channel NOT ILIKE '%expedia%'
  AND "isDiscarded" = false;

-- 🗑️ LEADS DESCARTADOS
CREATE OR REPLACE VIEW vw_leads_descartados AS
SELECT 
  id,
  "bookingId" as "bookingIdOriginal",
  "guestName" as huesped,
  "propertyName" as apto,
  "arrivalDate" as llegada,
  "totalPersons" as pax,
  phone as telefono,
  "discardReason" as "razonDescarte",
  'descartado' as "categoriaDescarte",
  "leadStatus" as "estadoOriginal",
  "leadPriority" as "prioridadOriginal",
  "contactAttempts" as "intentosRealizados",
  "totalCharges" as "valorEstimadoOriginal",
  channel as "canalOriginal",
  "discardedBy" as "descartadoPor",
  "crmNotes" as "notasFinales",
  messages as "conversacionCompleta",
  "createdAt" as "fechaCreacionOriginal",
  "lastContactAt" as "fechaUltimaGestion",
  "discardedAt" as "fechaDescarte",
  true as "puedeReactivarse",
  NULL as "fechaReactivacion",
  raw as "leadOriginalCompleto"
FROM "Booking"
WHERE "isDiscarded" = true;

-- 🚫 RESERVAS CANCELADAS PASADAS (≤ 2025-08-11)
CREATE OR REPLACE VIEW vw_reservations_cancelled_past AS
SELECT 
  id,
  "bookingId",
  phone,
  "guestName",
  status,
  "internalNotes",
  "propertyName",
  "arrivalDate",
  "departureDate",
  "numNights",
  "totalPersons",
  "totalCharges",
  "totalPayments",
  balance,
  "basePrice",
  channel,
  email,
  country,
  "guestLang",
  "apiReference",
  charges,
  payments,
  messages,
  "infoItems",
  notes,
  "bookingDate",
  "modifiedDate",
  "lastUpdatedBD",
  raw
FROM "Booking"
WHERE "departureDate" <= '2025-08-11'
  AND status IN ('cancelled', 'black');

-- 🔮 RESERVAS CANCELADAS FUTURAS (> 2025-08-11)
CREATE OR REPLACE VIEW vw_reservations_cancelled_future AS
SELECT 
  id,
  "bookingId",
  phone,
  "guestName",
  status,
  "internalNotes",
  "propertyName",
  "arrivalDate",
  "departureDate",
  "numNights",
  "totalPersons",
  "totalCharges",
  "totalPayments",
  balance,
  "basePrice",
  channel,
  email,
  country,
  "guestLang",
  "apiReference",
  charges,
  payments,
  messages,
  "infoItems",
  notes,
  "bookingDate",
  "modifiedDate",
  "lastUpdatedBD",
  raw
FROM "Booking"
WHERE "departureDate" > '2025-08-11'
  AND status IN ('cancelled', 'black');

-- 📊 ÍNDICES ADICIONALES PARA LAS VISTAS (opcionales)
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_booking_departure_status ON "Booking"("departureDate", status);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_booking_payments_channel ON "Booking"("totalPayments", channel);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_booking_discarded ON "Booking"("isDiscarded");