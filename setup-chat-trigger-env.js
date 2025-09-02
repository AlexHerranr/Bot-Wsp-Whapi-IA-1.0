// Script configurable con variable de entorno
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:slTVdKuHwjEfvxJEjGtMVTwSTYzdbfuR@turntable.proxy.rlwy.net:43146/railway',
    ssl: { rejectUnauthorized: false }
});

async function setupChatTrigger() {
    const client = await pool.connect();
    
    try {
        // Variable de entorno para controlar qué chatIds excluir
        const excludedChatIds = process.env.NO_THREAD_CHAT_IDS ? 
            process.env.NO_THREAD_CHAT_IDS.split(',').map(id => id.trim()) : [];
        
        console.log('🔧 Configurando trigger para chatIds excluidos:', excludedChatIds);
        
        if (excludedChatIds.length === 0) {
            console.log('⚠️ NO_THREAD_CHAT_IDS no configurado. No se aplicará ningún filtro.');
            return;
        }
        
        // Crear función con lista dinámica
        const chatIdsArray = excludedChatIds.map((_, i) => `$${i + 1}`).join(',');
        
        await client.query(`
            CREATE OR REPLACE FUNCTION prevent_thread_updates()
            RETURNS TRIGGER AS $$
            BEGIN
                -- Si el chatId está en la lista de excluidos, limpiar thread data
                IF NEW."chatId" = ANY(ARRAY[${excludedChatIds.map(() => `'${excludedChatIds[excludedChatIds.indexOf(excludedChatIds.find(id => id === NEW.chatId)) || 0]}'`).join(',')}]) THEN
                    NEW."threadId" = NULL;
                    NEW."threadTokenCount" = 0;
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);
        
        // Versión más simple y efectiva
        await client.query(`
            CREATE OR REPLACE FUNCTION prevent_thread_updates()
            RETURNS TRIGGER AS $$
            BEGIN
                -- Lista de chatIds que no deben guardar thread data
                IF NEW."chatId" IN (${excludedChatIds.map(id => `'${id}'`).join(',')}) THEN
                    NEW."threadId" = NULL;
                    NEW."threadTokenCount" = 0;
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);
        console.log('✅ Función creada para chatIds:', excludedChatIds);
        
        // Crear/recrear trigger
        await client.query('DROP TRIGGER IF EXISTS prevent_thread_updates_trigger ON "Chats"');
        await client.query(`
            CREATE TRIGGER prevent_thread_updates_trigger
                BEFORE INSERT OR UPDATE ON "Chats"
                FOR EACH ROW
                EXECUTE FUNCTION prevent_thread_updates();
        `);
        console.log('✅ Trigger creado');
        
        // Limpiar registros existentes
        for (const chatId of excludedChatIds) {
            const result = await client.query(`
                UPDATE "Chats" 
                SET "threadId" = NULL, "threadTokenCount" = 0
                WHERE "chatId" = $1
            `, [chatId]);
            console.log(`✅ Limpiado ${chatId}: ${result.rowCount} filas`);
        }
        
        console.log('🎉 Configuración completada con variable de entorno');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

setupChatTrigger();