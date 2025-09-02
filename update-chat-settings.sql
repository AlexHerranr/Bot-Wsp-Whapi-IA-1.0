-- Script para configurar trigger que evite guardado de threadId y threadTokenCount para tu chatId
-- Tu chatId: 573003913251@s.whatsapp.net (basado en la tabla que mostraste)

-- Primero, veamos la estructura de la tabla Chat
\d "Chat";

-- Actualizar tu registro para limpiar threadId y threadTokenCount
UPDATE "Chat" 
SET "threadId" = NULL, "threadTokenCount" = 0
WHERE "chatId" = '573003913251@s.whatsapp.net';

-- Crear función que evite actualizar estos campos para tu chatId
CREATE OR REPLACE FUNCTION prevent_thread_updates()
RETURNS TRIGGER AS $$
BEGIN
    -- Si es tu chatId específico, no actualizar threadId ni threadTokenCount
    IF NEW."chatId" = '573003913251@s.whatsapp.net' THEN
        NEW."threadId" = NULL;
        NEW."threadTokenCount" = 0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger que se ejecute antes de INSERT o UPDATE
DROP TRIGGER IF EXISTS prevent_alex_thread_updates ON "Chat";
CREATE TRIGGER prevent_alex_thread_updates
    BEFORE INSERT OR UPDATE ON "Chat"
    FOR EACH ROW
    EXECUTE FUNCTION prevent_thread_updates();

-- Verificar que se aplicó correctamente
SELECT "chatId", "threadId", "threadTokenCount", "lastActivity" 
FROM "Chat" 
WHERE "chatId" = '573003913251@s.whatsapp.net';