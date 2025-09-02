-- ============================================================
-- EJECUTA ESTE SQL DIRECTAMENTE EN RAILWAY
-- Dashboard → Database → Query
-- ============================================================

-- PASO 1: Crear función que intercepta actualizaciones para 3003913251
CREATE OR REPLACE FUNCTION skip_updates_for_3003913251()
RETURNS TRIGGER AS $$
BEGIN
    -- Si es el chat 3003913251, mantener valores antiguos
    IF NEW."phoneNumber" = '3003913251' THEN
        -- Preservar thread anterior (o mantener NULL)
        NEW."threadId" = OLD."threadId";
        -- Preservar tokens anteriores (o mantener 0)
        NEW."threadTokenCount" = COALESCE(OLD."threadTokenCount", 0);
        
        RAISE NOTICE 'PROVISIONAL: Omitiendo actualización de thread/tokens para 3003913251';
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

-- PASO 4: Limpiar datos actuales del chat (OPCIONAL)
UPDATE "WhatsApp" 
SET "threadId" = NULL, 
    "threadTokenCount" = 0 
WHERE "phoneNumber" = '3003913251';

-- PASO 5: Verificar que el trigger está activo
SELECT 
    'TRIGGER CREADO EXITOSAMENTE' AS status,
    tgname AS trigger_name,
    CASE 
        WHEN tgenabled = 'O' THEN 'ACTIVO'
        WHEN tgenabled = 'D' THEN 'DESHABILITADO'
        ELSE 'ESTADO: ' || tgenabled
    END AS estado
FROM pg_trigger
WHERE tgname = 'skip_3003913251_updates';

-- ============================================================
-- RESULTADO ESPERADO:
-- status: TRIGGER CREADO EXITOSAMENTE
-- trigger_name: skip_3003913251_updates
-- estado: ACTIVO
-- ============================================================

-- PARA REMOVER EL TRIGGER (cuando ya no sea necesario):
-- DROP TRIGGER IF EXISTS skip_3003913251_updates ON "WhatsApp";
-- DROP FUNCTION IF EXISTS skip_updates_for_3003913251();
-- ============================================================