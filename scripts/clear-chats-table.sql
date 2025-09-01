-- ========================================
-- Script para limpiar la tabla Chats
-- ========================================

-- Verificar cuántos registros hay antes de borrar
SELECT COUNT(*) as total_registros FROM "Chats";

-- Borrar todos los registros de la tabla Chats
DELETE FROM "Chats";

-- Verificar que la tabla está vacía
SELECT COUNT(*) as registros_despues FROM "Chats";

-- Opcional: Si quieres resetear el ID autoincremental (si lo hay)
-- ALTER SEQUENCE "Chats_id_seq" RESTART WITH 1;

-- ========================================
-- NOTA: Si la tabla aún se llama Client_View, primero renómbrala:
-- ALTER TABLE "Client_View" RENAME TO "Chats";
-- ========================================