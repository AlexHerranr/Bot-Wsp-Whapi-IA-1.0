-- Script para agregar la columna last_response_id a la tabla Chats
-- Ejecutar este script en tu cliente PostgreSQL o en la consola de Railway

-- 1. Verificar si la columna ya existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'Chats' 
        AND column_name = 'last_response_id'
    ) THEN
        -- 2. Agregar la columna si no existe
        ALTER TABLE "Chats" ADD COLUMN "last_response_id" TEXT;
        RAISE NOTICE 'Columna last_response_id agregada exitosamente';
    ELSE
        RAISE NOTICE 'La columna last_response_id ya existe';
    END IF;
END $$;

-- 3. Verificar que se creó correctamente
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'Chats' 
AND column_name = 'last_response_id';

-- 4. Mostrar estadísticas
SELECT 
    COUNT(*) as total_chats,
    COUNT(last_response_id) as chats_with_response_id,
    COUNT(CASE WHEN last_response_id LIKE 'thread_%' THEN 1 END) as legacy_thread_ids,
    COUNT(CASE WHEN last_response_id LIKE 'resp_%' THEN 1 END) as new_response_ids
FROM "Chats";

-- 5. (OPCIONAL) Limpiar IDs legacy de threads si deseas
-- ADVERTENCIA: Esto borrará los IDs viejos permanentemente
-- Descomenta la siguiente línea solo si estás seguro:
-- UPDATE "Chats" SET last_response_id = NULL WHERE last_response_id LIKE 'thread_%';