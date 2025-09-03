-- Test de almacenamiento de response_id
-- Este script simula el guardado de un response_id y verifica el resultado

-- 1. Crear usuario de prueba si no existe
INSERT INTO "Chats" (
    "phoneNumber", 
    "chatId", 
    "name", 
    "userName", 
    "lastActivity",
    "threadTokenCount"
) 
VALUES (
    '573000000001',
    'test-response-id-' || extract(epoch from now())::text,
    'Test Response Storage',
    'Test User',
    NOW(),
    0
)
ON CONFLICT ("phoneNumber") DO UPDATE
SET "lastActivity" = NOW();

-- 2. Mostrar estado inicial
SELECT 
    '=== ESTADO INICIAL ===' as step,
    "phoneNumber",
    "chatId",
    "last_response_id",
    "lastActivity"
FROM "Chats"
WHERE "phoneNumber" = '573000000001';

-- 3. Simular guardado de response_id (como lo haría el bot)
UPDATE "Chats"
SET 
    "last_response_id" = 'resp_' || substr(md5(random()::text), 1, 24),
    "lastActivity" = NOW()
WHERE "phoneNumber" = '573000000001';

-- 4. Verificar que se guardó
SELECT 
    '=== DESPUÉS DE GUARDAR RESPONSE_ID ===' as step,
    "phoneNumber",
    "chatId",
    "last_response_id",
    "lastActivity"
FROM "Chats"
WHERE "phoneNumber" = '573000000001';

-- 5. Simular segundo mensaje (actualización de response_id)
UPDATE "Chats"
SET 
    "last_response_id" = 'resp_' || substr(md5(random()::text || '2'), 1, 24),
    "lastActivity" = NOW()
WHERE "phoneNumber" = '573000000001';

-- 6. Mostrar estado final
SELECT 
    '=== ESTADO FINAL (2do mensaje) ===' as step,
    "phoneNumber",
    "chatId",
    "last_response_id",
    "lastActivity"
FROM "Chats"
WHERE "phoneNumber" = '573000000001';

-- 7. Estadísticas generales
SELECT 
    '=== ESTADÍSTICAS GLOBALES ===' as step,
    COUNT(*)::text as total_chats,
    COUNT("last_response_id")::text as chats_con_response_id,
    COUNT(CASE WHEN "last_response_id" LIKE 'resp_%' THEN 1 END)::text as response_ids_validos,
    COUNT(CASE WHEN "last_response_id" LIKE 'thread_%' THEN 1 END)::text as thread_ids_legacy
FROM "Chats";