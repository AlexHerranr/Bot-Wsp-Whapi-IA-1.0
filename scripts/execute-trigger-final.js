#!/usr/bin/env node

/**
 * Script para ejecutar el trigger PROVISIONAL en la tabla Chats
 */

const { Client } = require('pg');

async function executeTrigger() {
    console.log('🔧 EJECUTANDO TRIGGER PROVISIONAL EN RAILWAY DB');
    console.log('=' .repeat(60));
    
    const databaseUrl = 'postgresql://postgres:slTVdKuHwjEfvxJEjGtMVTwSTYzdbfuR@turntable.proxy.rlwy.net:43146/railway';
    
    const client = new Client({
        connectionString: databaseUrl,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        console.log('📡 Conectando a Railway DB...');
        await client.connect();
        console.log('✅ Conectado exitosamente\n');

        // 1. Crear la función del trigger
        console.log('1️⃣ Creando función del trigger...');
        await client.query(`
            CREATE OR REPLACE FUNCTION skip_updates_for_3003913251()
            RETURNS TRIGGER AS $$
            BEGIN
                -- Si es el chat 3003913251, mantener valores antiguos para thread
                IF NEW."phoneNumber" = '3003913251' OR NEW."chatId" = '3003913251' OR NEW."chatId" = '3003913251@c.us' THEN
                    -- Preservar threadId anterior (o mantener NULL)
                    IF TG_OP = 'UPDATE' THEN
                        NEW."threadId" = OLD."threadId";
                        NEW."threadTokenCount" = COALESCE(OLD."threadTokenCount", 0);
                    ELSIF TG_OP = 'INSERT' THEN
                        NEW."threadId" = NULL;
                        NEW."threadTokenCount" = 0;
                    END IF;
                    
                    RAISE NOTICE 'PROVISIONAL: Omitiendo thread/tokens para 3003913251';
                END IF;
                
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);
        console.log('✅ Función creada\n');

        // 2. Eliminar triggers anteriores si existen
        console.log('2️⃣ Eliminando triggers anteriores si existen...');
        await client.query(`DROP TRIGGER IF EXISTS skip_3003913251_updates ON "Chats";`);
        await client.query(`DROP TRIGGER IF EXISTS skip_3003913251_inserts ON "Chats";`);
        console.log('✅ Limpieza completada\n');

        // 3. Crear los triggers
        console.log('3️⃣ Creando triggers BEFORE UPDATE e INSERT...');
        
        // Trigger para UPDATE
        await client.query(`
            CREATE TRIGGER skip_3003913251_updates
            BEFORE UPDATE ON "Chats"
            FOR EACH ROW
            EXECUTE FUNCTION skip_updates_for_3003913251();
        `);
        
        // Trigger para INSERT  
        await client.query(`
            CREATE TRIGGER skip_3003913251_inserts
            BEFORE INSERT ON "Chats"
            FOR EACH ROW
            EXECUTE FUNCTION skip_updates_for_3003913251();
        `);
        
        console.log('✅ Triggers creados\n');

        // 4. Limpiar datos actuales del chat
        console.log('4️⃣ Limpiando datos actuales del chat 3003913251...');
        const updateResult = await client.query(`
            UPDATE "Chats" 
            SET "threadId" = NULL, 
                "threadTokenCount" = 0 
            WHERE "phoneNumber" = '3003913251' 
               OR "chatId" = '3003913251' 
               OR "chatId" = '3003913251@c.us'
            RETURNING "phoneNumber", "chatId", "threadId", "threadTokenCount";
        `);
        
        if (updateResult.rows.length > 0) {
            console.log('✅ Datos limpiados:');
            updateResult.rows.forEach(row => {
                console.log(`   Phone: ${row.phoneNumber}`);
                console.log(`   ChatId: ${row.chatId}`);
                console.log(`   threadId: ${row.threadId || 'NULL'}`);
                console.log(`   threadTokenCount: ${row.threadTokenCount || 0}`);
            });
        } else {
            console.log('ℹ️ No se encontró el registro o ya estaba limpio');
        }
        console.log('');

        // 5. Verificar que los triggers están activos
        console.log('5️⃣ Verificando triggers...');
        const verifyResult = await client.query(`
            SELECT 
                tgname AS trigger_name,
                CASE 
                    WHEN tgenabled = 'O' THEN 'ACTIVO ✅'
                    WHEN tgenabled = 'D' THEN 'DESHABILITADO ❌'
                    ELSE CONCAT('ESTADO: ', tgenabled)
                END AS estado
            FROM pg_trigger
            WHERE tgname IN ('skip_3003913251_updates', 'skip_3003913251_inserts')
            ORDER BY tgname;
        `);
        
        if (verifyResult.rows.length > 0) {
            console.log('✅ Triggers verificados:');
            verifyResult.rows.forEach(trigger => {
                console.log(`   ${trigger.trigger_name}: ${trigger.estado}`);
            });
        }

        // 6. Test del trigger
        console.log('\n6️⃣ Probando el trigger...');
        
        // Verificar si existe el registro
        const checkExisting = await client.query(`
            SELECT "phoneNumber", "chatId", "threadId", "threadTokenCount" 
            FROM "Chats" 
            WHERE "phoneNumber" = '3003913251' 
               OR "chatId" = '3003913251' 
               OR "chatId" = '3003913251@c.us'
            LIMIT 1;
        `);
        
        if (checkExisting.rows.length > 0) {
            console.log('📊 Registro encontrado, intentando actualizar con valores de prueba...');
            
            // Intentar actualizar (el trigger debería prevenir cambios)
            await client.query(`
                UPDATE "Chats" 
                SET "threadId" = 'test_thread_should_not_save',
                    "threadTokenCount" = 999
                WHERE "phoneNumber" = '3003913251' 
                   OR "chatId" = '3003913251' 
                   OR "chatId" = '3003913251@c.us';
            `);
            
            // Verificar que no se actualizó
            const afterUpdate = await client.query(`
                SELECT "phoneNumber", "chatId", "threadId", "threadTokenCount" 
                FROM "Chats" 
                WHERE "phoneNumber" = '3003913251' 
                   OR "chatId" = '3003913251' 
                   OR "chatId" = '3003913251@c.us'
                LIMIT 1;
            `);
            
            console.log('\n📊 Resultado del test:');
            const threadOk = !afterUpdate.rows[0].threadId || afterUpdate.rows[0].threadId === null;
            const tokensOk = afterUpdate.rows[0].threadTokenCount === 0 || afterUpdate.rows[0].threadTokenCount === null;
            
            console.log(`   threadId: ${afterUpdate.rows[0].threadId || 'NULL'} ${threadOk ? '✅' : '❌'}`);
            console.log(`   threadTokenCount: ${afterUpdate.rows[0].threadTokenCount || 0} ${tokensOk ? '✅' : '❌'}`);
            
            if (threadOk && tokensOk) {
                console.log('\n✅ TRIGGER FUNCIONANDO CORRECTAMENTE');
                console.log('   Los valores NO se actualizaron (como esperábamos)');
            } else {
                console.log('\n⚠️ El trigger puede no estar funcionando como se esperaba');
            }
        } else {
            console.log('ℹ️ No existe registro para 3003913251 aún');
            console.log('   El trigger se activará cuando se cree o actualice');
            
            // Crear un registro de prueba
            console.log('\n   Creando registro de prueba...');
            await client.query(`
                INSERT INTO "Chats" ("phoneNumber", "chatId", "userName", "threadId", "threadTokenCount")
                VALUES ('3003913251', '3003913251@c.us', 'Test User', 'should_be_null', 999)
                ON CONFLICT ("phoneNumber") DO NOTHING;
            `);
            
            // Verificar que el trigger funcionó en INSERT
            const afterInsert = await client.query(`
                SELECT "phoneNumber", "threadId", "threadTokenCount" 
                FROM "Chats" 
                WHERE "phoneNumber" = '3003913251'
                LIMIT 1;
            `);
            
            if (afterInsert.rows.length > 0) {
                const insertOk = !afterInsert.rows[0].threadId && afterInsert.rows[0].threadTokenCount === 0;
                console.log(`\n   Resultado INSERT: threadId=${afterInsert.rows[0].threadId || 'NULL'}, tokens=${afterInsert.rows[0].threadTokenCount} ${insertOk ? '✅' : '❌'}`);
            }
        }

        console.log('\n' + '=' .repeat(60));
        console.log('✅ TRIGGER APLICADO EXITOSAMENTE EN RAILWAY');
        console.log('\n⚠️ CONFIGURACIÓN PROVISIONAL ACTIVA:');
        console.log('   • Chat afectado: 3003913251');
        console.log('   • NO guardará threadId en BD');
        console.log('   • NO guardará threadTokenCount en BD');
        console.log('   • Aplica tanto a INSERT como UPDATE');
        console.log('   • Los demás chats funcionan normal');
        console.log('   • El cache en memoria sigue funcionando');
        
        console.log('\n🔄 Para REMOVER cuando ya no sea necesario:');
        console.log('```sql');
        console.log('DROP TRIGGER IF EXISTS skip_3003913251_updates ON "Chats";');
        console.log('DROP TRIGGER IF EXISTS skip_3003913251_inserts ON "Chats";');
        console.log('DROP FUNCTION IF EXISTS skip_updates_for_3003913251();');
        console.log('```');
        
    } catch (error) {
        console.error('❌ Error ejecutando trigger:', error.message);
        console.error('\nDetalles:', error);
    } finally {
        await client.end();
        console.log('\n📡 Conexión cerrada');
    }
}

// Ejecutar
executeTrigger();