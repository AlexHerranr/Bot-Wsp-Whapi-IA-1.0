// Script simple para tu chatId sin guardado de thread
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:slTVdKuHwjEfvxJEjGtMVTwSTYzdbfuR@turntable.proxy.rlwy.net:43146/railway',
    ssl: { rejectUnauthorized: false }
});

async function setupChatTrigger() {
    const client = await pool.connect();
    
    try {
        const yourChatId = '573003913251@s.whatsapp.net';
        console.log('🔧 Configurando para chatId:', yourChatId);
        
        // 1. Limpiar registro actual
        const updateResult = await client.query(`
            UPDATE "Chats" 
            SET "threadId" = NULL, "threadTokenCount" = 0
            WHERE "chatId" = $1
        `, [yourChatId]);
        console.log('✅ Registro limpiado:', updateResult.rowCount, 'filas');
        
        // 2. Crear función
        await client.query(`
            CREATE OR REPLACE FUNCTION prevent_thread_updates()
            RETURNS TRIGGER AS $$
            BEGIN
                IF NEW."chatId" = '573003913251@s.whatsapp.net' THEN
                    NEW."threadId" = NULL;
                    NEW."threadTokenCount" = 0;
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);
        console.log('✅ Función creada');
        
        // 3. Crear trigger
        await client.query('DROP TRIGGER IF EXISTS prevent_alex_thread_updates ON "Chats"');
        await client.query(`
            CREATE TRIGGER prevent_alex_thread_updates
                BEFORE INSERT OR UPDATE ON "Chats"
                FOR EACH ROW
                EXECUTE FUNCTION prevent_thread_updates();
        `);
        console.log('✅ Trigger creado');
        
        // 4. Verificar
        const result = await client.query(`
            SELECT "chatId", "threadId", "threadTokenCount", "lastActivity" 
            FROM "Chats" 
            WHERE "chatId" = $1
        `, [yourChatId]);
        
        console.log('📋 Estado actual:', result.rows);
        console.log('🎉 Tu chatId ya no guardará threadId ni threadTokenCount');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

setupChatTrigger();