-- Verificar la columna y mostrar estadísticas
SELECT 
    'Column Info' as query_type,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'Chats' 
AND column_name = 'last_response_id'

UNION ALL

SELECT 
    'Stats' as query_type,
    'Total Chats: ' || COUNT(*)::text as column_name,
    'Chats with response_id: ' || COUNT(last_response_id)::text as data_type,
    'Legacy thread IDs: ' || COUNT(CASE WHEN last_response_id LIKE 'thread_%' THEN 1 END)::text as is_nullable
FROM "Chats";