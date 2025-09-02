// Limpiar triggers antiguos antes de instalar el nuevo
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:slTVdKuHwjEfvxJEjGtMVTwSTYzdbfuR@turntable.proxy.rlwy.net:43146/railway',
    ssl: { rejectUnauthorized: false }
});

async function cleanupOldTriggers() {
    const client = await pool.connect();
    
    try {
        console.log('🧹 Limpiando triggers antiguos relacionados con tu chatId...\n');
        
        // Remover triggers específicos de tu chatId
        const triggersToRemove = [
            'prevent_alex_thread_updates',
            'skip_3003913251_inserts', 
            'skip_3003913251_updates'
        ];
        
        for (const triggerName of triggersToRemove) {
            try {
                await client.query(`DROP TRIGGER IF EXISTS ${triggerName} ON "Chats"`);
                console.log(`✅ Trigger removido: ${triggerName}`);
            } catch (error) {
                console.log(`⚠️ No se pudo remover ${triggerName}: ${error.message}`);
            }
        }
        
        // Remover funciones relacionadas
        const functionsToRemove = [
            'prevent_thread_updates',
            'skip_updates_for_3003913251'
        ];
        
        for (const functionName of functionsToRemove) {
            try {
                await client.query(`DROP FUNCTION IF EXISTS ${functionName}()`);
                console.log(`✅ Función removida: ${functionName}`);
            } catch (error) {
                console.log(`⚠️ No se pudo remover función ${functionName}: ${error.message}`);
            }
        }
        
        console.log('\n✅ Limpieza completada. Ahora puedes ejecutar el trigger inteligente sin conflictos.');
        console.log('\nEjecuta: node setup-smart-trigger.js');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

cleanupOldTriggers();