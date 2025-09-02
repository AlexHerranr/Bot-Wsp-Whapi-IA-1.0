// Trigger inteligente: Limpia threadId y count 1 minuto después de última actualización
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:slTVdKuHwjEfvxJEjGtMVTwSTYzdbfuR@turntable.proxy.rlwy.net:43146/railway',
    ssl: { rejectUnauthorized: false }
});

async function setupSmartTrigger() {
    const client = await pool.connect();
    
    try {
        // Variable de entorno para chatIds que necesitan limpieza automática
        const excludedChatIds = process.env.NO_THREAD_CHAT_IDS ? 
            process.env.NO_THREAD_CHAT_IDS.split(',').map(id => id.trim()) : [];
        
        console.log('🧠 Configurando trigger inteligente para:', excludedChatIds);
        
        if (excludedChatIds.length === 0) {
            console.log('⚠️ NO_THREAD_CHAT_IDS no configurado.');
            return;
        }
        
        // Remover triggers antiguos
        await client.query('DROP TRIGGER IF EXISTS prevent_alex_thread_updates ON "Chats"');
        await client.query('DROP TRIGGER IF EXISTS prevent_thread_updates_trigger ON "Chats"');
        await client.query('DROP FUNCTION IF EXISTS prevent_thread_updates()');
        console.log('✅ Triggers antiguos removidos');
        
        // 1. Crear función para limpieza delayed con cron job
        await client.query(`
            CREATE OR REPLACE FUNCTION cleanup_thread_data()
            RETURNS void AS $$
            BEGIN
                -- Limpiar threadId y threadTokenCount de chatIds específicos
                -- que han estado inactivos por más de 1 minuto
                UPDATE "Chats" 
                SET "threadId" = NULL, "threadTokenCount" = 0
                WHERE "chatId" IN (${excludedChatIds.map(id => `'${id}'`).join(',')})
                AND ("threadId" IS NOT NULL OR "threadTokenCount" > 0)
                AND "lastActivity" < NOW() - INTERVAL '10 minutes';
                
                -- Log si hubo actualizaciones (sin variable declarada)
                -- GET DIAGNOSTICS no disponible en esta versión
            END;
            $$ LANGUAGE plpgsql;
        `);
        console.log('✅ Función de limpieza creada');
        
        // 2. Crear extensión pg_cron si no existe (puede fallar en Railway)
        try {
            await client.query('CREATE EXTENSION IF NOT EXISTS pg_cron');
            console.log('✅ Extensión pg_cron habilitada');
            
            // 3. Programar job cada minuto
            await client.query(`
                SELECT cron.schedule(
                    'cleanup-thread-data',
                    '* * * * *',
                    'SELECT cleanup_thread_data();'
                );
            `);
            console.log('✅ Cron job programado cada minuto');
            
        } catch (cronError) {
            console.log('⚠️ pg_cron no disponible, usando trigger alternativo');
            
            // ALTERNATIVA: Trigger que limpia en cada UPDATE después de 1 minuto
            await client.query(`
                CREATE OR REPLACE FUNCTION smart_thread_cleanup()
                RETURNS TRIGGER AS $$
                BEGIN
                    -- Si es uno de los chatIds específicos Y han pasado más de 10 minutos desde lastActivity
                    IF NEW."chatId" IN (${excludedChatIds.map(id => `'${id}'`).join(',')})
                       AND OLD."lastActivity" < NOW() - INTERVAL '10 minutes' THEN
                        NEW."threadId" = NULL;
                        NEW."threadTokenCount" = 0;
                    END IF;
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
            `);
            
            await client.query(`
                CREATE TRIGGER smart_thread_cleanup_trigger
                    BEFORE UPDATE ON "Chats"
                    FOR EACH ROW
                    EXECUTE FUNCTION smart_thread_cleanup();
            `);
            console.log('✅ Trigger alternativo creado (limpia en updates después de 1min)');
        }
        
        // 4. Limpieza inicial de registros existentes
        const result = await client.query(`
            UPDATE "Chats" 
            SET "threadId" = NULL, "threadTokenCount" = 0
            WHERE "chatId" IN (${excludedChatIds.map((_, i) => `$${i + 1}`).join(',')})
            AND ("threadId" IS NOT NULL OR "threadTokenCount" > 0)
            AND "lastActivity" < NOW() - INTERVAL '10 minutes'
        `, excludedChatIds);
        
        console.log(`✅ Limpieza inicial: ${result.rowCount} registros limpiados`);
        
        // 5. Verificar estado
        const verification = await client.query(`
            SELECT "chatId", "threadId", "threadTokenCount", "lastActivity",
                   EXTRACT(EPOCH FROM (NOW() - "lastActivity")) as seconds_ago
            FROM "Chats" 
            WHERE "chatId" IN (${excludedChatIds.map((_, i) => `$${i + 1}`).join(',')})
        `, excludedChatIds);
        
        console.log('📋 Estado actual:');
        verification.rows.forEach(row => {
            console.log(`  ${row.chatId}: threadId=${row.threadId}, count=${row.threadTokenCount}, inactive=${Math.round(row.seconds_ago)}s`);
        });
        
        console.log('🎉 Trigger inteligente configurado - Limpia automáticamente después de 10 minutos de inactividad');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

setupSmartTrigger();