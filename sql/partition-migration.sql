-- 🔄 MIGRACIÓN PARTICIONADO TEMPORAL
-- Fecha de corte: 2025-08-11 (ayer)
-- Check-out <= 2025-08-11 → ReservationsPast
-- Check-out > 2025-08-11 → ReservationsFuture

-- 1️⃣ Crear tabla ReservationsPast
CREATE TABLE IF NOT EXISTS "ReservationsPast" (
  "id" SERIAL PRIMARY KEY,
  "bookingId" TEXT UNIQUE NOT NULL,
  "phone" TEXT NOT NULL,
  "guestName" TEXT,
  "status" TEXT,
  "internalNotes" TEXT,
  "propertyName" TEXT,
  "arrivalDate" TEXT,
  "departureDate" TEXT,
  "numNights" INTEGER,
  "totalPersons" INTEGER,
  "totalCharges" TEXT,
  "totalPayments" TEXT,
  "balance" TEXT,
  "basePrice" TEXT,
  "channel" TEXT,
  "email" TEXT,
  "country" TEXT,
  "guestLang" TEXT,
  "apiReference" TEXT,
  "charges" JSONB DEFAULT '[]',
  "payments" JSONB DEFAULT '[]',
  "messages" JSONB DEFAULT '[]',
  "infoItems" JSONB DEFAULT '[]',
  "notes" TEXT,
  "bookingDate" TEXT,
  "modifiedDate" TEXT,
  "lastUpdatedBD" TIMESTAMPTZ DEFAULT NOW(),
  "raw" JSONB
);

-- 2️⃣ Crear tabla ReservationsFuture
CREATE TABLE IF NOT EXISTS "ReservationsFuture" (
  "id" SERIAL PRIMARY KEY,
  "bookingId" TEXT UNIQUE NOT NULL,
  "phone" TEXT NOT NULL,
  "guestName" TEXT,
  "status" TEXT,
  "internalNotes" TEXT,
  "propertyName" TEXT,
  "arrivalDate" TEXT,
  "departureDate" TEXT,
  "numNights" INTEGER,
  "totalPersons" INTEGER,
  "totalCharges" TEXT,
  "totalPayments" TEXT,
  "balance" TEXT,
  "basePrice" TEXT,
  "channel" TEXT,
  "email" TEXT,
  "country" TEXT,
  "guestLang" TEXT,
  "apiReference" TEXT,
  "charges" JSONB DEFAULT '[]',
  "payments" JSONB DEFAULT '[]',
  "messages" JSONB DEFAULT '[]',
  "infoItems" JSONB DEFAULT '[]',
  "notes" TEXT,
  "bookingDate" TEXT,
  "modifiedDate" TEXT,
  "lastUpdatedBD" TIMESTAMPTZ DEFAULT NOW(),
  "raw" JSONB
);

-- 3️⃣ Migrar datos PASADOS (check-out <= 2025-08-11)
INSERT INTO "ReservationsPast" (
  "bookingId", "phone", "guestName", "status", "internalNotes",
  "propertyName", "arrivalDate", "departureDate", "numNights", "totalPersons",
  "totalCharges", "totalPayments", "balance", "basePrice",
  "channel", "email", "country", "guestLang", "apiReference",
  "charges", "payments", "messages", "infoItems",
  "notes", "bookingDate", "modifiedDate", "lastUpdatedBD", "raw"
)
SELECT 
  "bookingId", "phone", "guestName", "status", "internalNotes",
  "propertyName", "arrivalDate", "departureDate", "numNights", "totalPersons",
  "totalCharges", "totalPayments", "balance", "basePrice",
  "channel", "email", "country", "guestLang", "apiReference",
  "charges", "payments", "messages", "infoItems",
  "notes", "bookingDate", "modifiedDate", "lastUpdatedBD", "raw"
FROM "Reservation"
WHERE "departureDate" <= '2025-08-11' OR "departureDate" IS NULL;

-- 4️⃣ Migrar datos FUTUROS (check-out > 2025-08-11)
INSERT INTO "ReservationsFuture" (
  "bookingId", "phone", "guestName", "status", "internalNotes",
  "propertyName", "arrivalDate", "departureDate", "numNights", "totalPersons",
  "totalCharges", "totalPayments", "balance", "basePrice",
  "channel", "email", "country", "guestLang", "apiReference",
  "charges", "payments", "messages", "infoItems",
  "notes", "bookingDate", "modifiedDate", "lastUpdatedBD", "raw"
)
SELECT 
  "bookingId", "phone", "guestName", "status", "internalNotes",
  "propertyName", "arrivalDate", "departureDate", "numNights", "totalPersons",
  "totalCharges", "totalPayments", "balance", "basePrice",
  "channel", "email", "country", "guestLang", "apiReference",
  "charges", "payments", "messages", "infoItems",
  "notes", "bookingDate", "modifiedDate", "lastUpdatedBD", "raw"
FROM "Reservation"
WHERE "departureDate" > '2025-08-11';

-- 5️⃣ Crear índices para ReservationsPast
CREATE INDEX IF NOT EXISTS "ReservationsPast_departureDate_idx" ON "ReservationsPast"("departureDate");
CREATE INDEX IF NOT EXISTS "ReservationsPast_arrivalDate_idx" ON "ReservationsPast"("arrivalDate");
CREATE INDEX IF NOT EXISTS "ReservationsPast_status_idx" ON "ReservationsPast"("status");
CREATE INDEX IF NOT EXISTS "ReservationsPast_propertyName_departureDate_idx" ON "ReservationsPast"("propertyName", "departureDate");
CREATE INDEX IF NOT EXISTS "ReservationsPast_phone_idx" ON "ReservationsPast"("phone");
CREATE INDEX IF NOT EXISTS "ReservationsPast_guestName_idx" ON "ReservationsPast"("guestName");

-- 6️⃣ Crear índices para ReservationsFuture
CREATE INDEX IF NOT EXISTS "ReservationsFuture_arrivalDate_idx" ON "ReservationsFuture"("arrivalDate");
CREATE INDEX IF NOT EXISTS "ReservationsFuture_departureDate_idx" ON "ReservationsFuture"("departureDate");
CREATE INDEX IF NOT EXISTS "ReservationsFuture_status_idx" ON "ReservationsFuture"("status");
CREATE INDEX IF NOT EXISTS "ReservationsFuture_propertyName_arrivalDate_idx" ON "ReservationsFuture"("propertyName", "arrivalDate");
CREATE INDEX IF NOT EXISTS "ReservationsFuture_phone_idx" ON "ReservationsFuture"("phone");
CREATE INDEX IF NOT EXISTS "ReservationsFuture_guestName_idx" ON "ReservationsFuture"("guestName");

-- 📊 VERIFICACIÓN
SELECT 
  'Original' as tabla, COUNT(*) as total 
FROM "Reservation"
UNION ALL
SELECT 
  'Past' as tabla, COUNT(*) as total 
FROM "ReservationsPast"  
UNION ALL
SELECT 
  'Future' as tabla, COUNT(*) as total 
FROM "ReservationsFuture";