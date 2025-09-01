-- Script PROVISIONAL para crear trigger que evita actualizar tokens y thread
-- SOLO para el chatId 3003913251 en la BD de Railway

-- 1. Crear función que intercepta las actualizaciones
CREATE OR REPLACE FUNCTION skip_updates_for_specific_chat()
RETURNS TRIGGER AS $$
BEGIN
    -- Si es el chat específico 3003913251
    IF NEW."phoneNumber" = '3003913251' THEN
        -- Mantener valores antiguos de thread y tokens
        NEW."threadId" = OLD."threadId";
        NEW."threadTokenCount" = OLD."threadTokenCount";
        
        -- Log para debugging (opcional)
        RAISE NOTICE 'PROVISIONAL: Omitiendo actualización de thread/tokens para chat 3003913251';
    END IF;
    
    -- Retornar el registro (modificado o no)
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Crear trigger BEFORE UPDATE en la tabla WhatsApp
DROP TRIGGER IF EXISTS skip_specific_chat_updates ON "WhatsApp";

CREATE TRIGGER skip_specific_chat_updates
BEFORE UPDATE ON "WhatsApp"
FOR EACH ROW
EXECUTE FUNCTION skip_updates_for_specific_chat();

-- 3. Verificar que el trigger está activo
SELECT 
    tgname AS trigger_name,
    tgrelid::regclass AS table_name,
    tgenabled AS enabled
FROM pg_trigger
WHERE tgname = 'skip_specific_chat_updates';

-- Para REMOVER el trigger cuando ya no sea necesario:
-- DROP TRIGGER IF EXISTS skip_specific_chat_updates ON "WhatsApp";
-- DROP FUNCTION IF EXISTS skip_updates_for_specific_chat();