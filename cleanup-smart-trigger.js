// Limpiar el trigger inteligente actual
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:slTVdKuHwjEfvxJEjGtMVTwSTYzdbfuR@turntable.proxy.rlwy.net:43146/railway',
    ssl: { rejectUnauthorized: false }
});

async function cleanupSmartTrigger() {
    const client = await pool.connect();
    
    try {
        console.log('🧹 Limpiando trigger inteligente existente...');
        
        // Remover trigger actual
        await client.query('DROP TRIGGER IF EXISTS smart_thread_cleanup_trigger ON "Chats"');
        console.log('✅ Trigger smart_thread_cleanup_trigger removido');
        
        // Remover función
        await client.query('DROP FUNCTION IF EXISTS smart_thread_cleanup()');
        console.log('✅ Función smart_thread_cleanup removida');
        
        // Remover función de limpieza también
        await client.query('DROP FUNCTION IF EXISTS cleanup_thread_data()');
        console.log('✅ Función cleanup_thread_data removida');
        
        console.log('✅ Limpieza del trigger inteligente completada');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

cleanupSmartTrigger();