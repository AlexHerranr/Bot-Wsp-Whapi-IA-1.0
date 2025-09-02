// Script para REMOVER el trigger de tu chatId
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:slTVdKuHwjEfvxJEjGtMVTwSTYzdbfuR@turntable.proxy.rlwy.net:43146/railway',
    ssl: { rejectUnauthorized: false }
});

async function removeChatTrigger() {
    const client = await pool.connect();
    
    try {
        console.log('🗑️ Removiendo trigger para chatId...');
        
        // 1. Eliminar trigger
        await client.query('DROP TRIGGER IF EXISTS prevent_alex_thread_updates ON "Chats"');
        console.log('✅ Trigger eliminado');
        
        // 2. Eliminar función (opcional)
        await client.query('DROP FUNCTION IF EXISTS prevent_thread_updates()');
        console.log('✅ Función eliminada');
        
        console.log('🎉 Trigger desactivado. Tu chatId volverá a guardar threadId y threadTokenCount normalmente');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

removeChatTrigger();