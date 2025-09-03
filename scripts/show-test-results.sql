-- Mostrar resultados del test de response_id
SELECT 
    "phoneNumber",
    substring("chatId", 1, 20) || '...' as chat_id_short,
    "last_response_id",
    to_char("lastActivity", 'YYYY-MM-DD HH24:MI:SS') as last_activity
FROM "Chats"
WHERE "phoneNumber" = '573000000001'
   OR "last_response_id" IS NOT NULL
ORDER BY "lastActivity" DESC
LIMIT 10;