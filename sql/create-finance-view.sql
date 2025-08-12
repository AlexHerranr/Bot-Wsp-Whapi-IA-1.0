-- Vista optimizada para reportes financieros
-- Convierte strings a números para cálculos fáciles
CREATE OR REPLACE VIEW reservation_finance AS
SELECT 
  "bookingId",
  "guestName",
  "propertyName", 
  "roomName",
  "arrivalDate",
  "departureDate",
  "status",
  "phone",
  "totalPersons",
  
  -- Campos financieros convertidos a enteros
  NULLIF("totalCharges",'')::int AS total_charges,
  NULLIF("totalPayments",'')::int AS total_payments, 
  NULLIF("balance",'')::int AS balance,
  NULLIF("basePrice",'')::int AS base_price,
  
  -- Cálculos automáticos
  CASE 
    WHEN NULLIF("balance",'')::int > 0 THEN 'PENDIENTE'
    WHEN NULLIF("balance",'')::int = 0 THEN 'PAGADO'
    WHEN NULLIF("balance",'')::int < 0 THEN 'SOBREPAGO'
    ELSE 'SIN_INFO'
  END AS payment_status,
  
  -- Útil para reportes
  "channel",
  "bookingDate",
  "modifiedDate"
  
FROM "Reservation"
WHERE "totalCharges" IS NOT NULL
ORDER BY "arrivalDate" DESC;

-- Vista especializada para WhatsApp/CRM  
CREATE OR REPLACE VIEW reservation_whatsapp AS
SELECT 
  "bookingId",
  "phone",
  "guestName",
  "propertyName",
  "roomName", 
  "arrivalDate",
  "departureDate",
  "totalPersons",
  "status",
  NULLIF("balance",'')::int AS balance,
  
  -- Formato legible para mensajes
  CONCAT("guestName", ' - ', "propertyName", ' (', "arrivalDate", ')') AS display_name,
  
  -- Estado para automatizaciones
  CASE 
    WHEN "arrivalDate" = CURRENT_DATE THEN 'CHECK_IN_TODAY'
    WHEN "departureDate" = CURRENT_DATE THEN 'CHECK_OUT_TODAY'  
    WHEN "arrivalDate" = CURRENT_DATE + 1 THEN 'CHECK_IN_TOMORROW'
    WHEN "arrivalDate" > CURRENT_DATE THEN 'UPCOMING'
    WHEN "departureDate" < CURRENT_DATE THEN 'PAST'
    ELSE 'CURRENT'
  END AS automation_status

FROM "Reservation"
WHERE "phone" IS NOT NULL
ORDER BY "arrivalDate" ASC;