-- ============================================================
-- TRIGGER PROVISIONAL PARA RAILWAY
-- Evita actualizar thread y tokens SOLO para chatId 3003913251
-- ============================================================

-- PASO 1: Crear función que intercepta actualizaciones
CREATE OR REPLACE FUNCTION skip_updates_for_3003913251()
RETURNS TRIGGER AS $$
BEGIN
    -- Si es el chat 3003913251, mantener valores antiguos
    IF NEW."phoneNumber" = '3003913251' THEN
        -- Preservar thread y tokens anteriores
        IF OLD."threadId" IS NOT NULL THEN
            NEW."threadId" = OLD."threadId";
        END IF;
        IF OLD."threadTokenCount" IS NOT NULL THEN
            NEW."threadTokenCount" = OLD."threadTokenCount";
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- PASO 2: Eliminar trigger anterior si existe
DROP TRIGGER IF EXISTS skip_3003913251_updates ON "WhatsApp";

-- PASO 3: Crear el trigger
CREATE TRIGGER skip_3003913251_updates
BEFORE UPDATE ON "WhatsApp"
FOR EACH ROW
EXECUTE FUNCTION skip_updates_for_3003913251();

-- PASO 4: Limpiar datos actuales del chat (opcional)
UPDATE "WhatsApp" 
SET "threadId" = NULL, 
    "threadTokenCount" = 0 
WHERE "phoneNumber" = '3003913251';

-- VERIFICACIÓN: Ver si el trigger está activo
SELECT 
    'Trigger creado exitosamente' AS status,
    tgname AS trigger_name,
    tgenabled AS enabled
FROM pg_trigger
WHERE tgname = 'skip_3003913251_updates';

-- ============================================================
-- PARA REMOVER EL TRIGGER (cuando ya no sea necesario):
-- DROP TRIGGER IF EXISTS skip_3003913251_updates ON "WhatsApp";
-- DROP FUNCTION IF EXISTS skip_updates_for_3003913251();
-- ============================================================