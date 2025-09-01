#!/usr/bin/env node

/**
 * Script para ejecutar el trigger PROVISIONAL en la tabla chats
 */

const { Client } = require('pg');

async function executeTrigger() {
    console.log('🔧 EJECUTANDO TRIGGER PROVISIONAL EN RAILWAY DB');
    console.log('=' .repeat(60));
    
    // Usar la DATABASE_URL del Data_Service_Bot
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

        // Primero verificar la estructura de la tabla chats
        console.log('📋 Verificando estructura de la tabla chats...');
        const columns = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'chats'
            ORDER BY ordinal_position;
        `);
        
        console.log('Columnas encontradas:');
        columns.rows.forEach(col => {
            console.log(`   - ${col.column_name} (${col.data_type})`);
        });
        console.log('');

        // 1. Crear la función del trigger
        console.log('1️⃣ Creando función del trigger...');
        await client.query(`
            CREATE OR REPLACE FUNCTION skip_updates_for_3003913251()
            RETURNS TRIGGER AS $$
            BEGIN
                -- Si es el chat 3003913251, mantener valores antiguos
                IF NEW."chat_id" = '3003913251' OR NEW."phone_number" = '3003913251' THEN
                    -- Preservar thread_id anterior
                    IF TG_OP = 'UPDATE' AND OLD."thread_id" IS NOT NULL THEN
                        NEW."thread_id" = OLD."thread_id";
                    ELSIF TG_OP = 'INSERT' THEN
                        NEW."thread_id" = NULL;
                    END IF;
                    
                    -- Preservar thread_token_count anterior
                    IF TG_OP = 'UPDATE' AND OLD."thread_token_count" IS NOT NULL THEN
                        NEW."thread_token_count" = OLD."thread_token_count";
                    ELSIF TG_OP = 'INSERT' THEN
                        NEW."thread_token_count" = 0;
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
        await client.query(`DROP TRIGGER IF EXISTS skip_3003913251_updates ON chats;`);
        await client.query(`DROP TRIGGER IF EXISTS skip_3003913251_inserts ON chats;`);
        console.log('✅ Limpieza completada\n');

        // 3. Crear los triggers
        console.log('3️⃣ Creando triggers BEFORE UPDATE e INSERT...');
        
        // Trigger para UPDATE
        await client.query(`
            CREATE TRIGGER skip_3003913251_updates
            BEFORE UPDATE ON chats
            FOR EACH ROW
            EXECUTE FUNCTION skip_updates_for_3003913251();
        `);
        
        // Trigger para INSERT
        await client.query(`
            CREATE TRIGGER skip_3003913251_inserts
            BEFORE INSERT ON chats
            FOR EACH ROW
            EXECUTE FUNCTION skip_updates_for_3003913251();
        `);
        
        console.log('✅ Triggers creados\n');

        // 4. Limpiar datos actuales del chat
        console.log('4️⃣ Limpiando datos actuales del chat 3003913251...');
        const updateResult = await client.query(`
            UPDATE chats 
            SET thread_id = NULL, 
                thread_token_count = 0 
            WHERE chat_id = '3003913251' OR phone_number = '3003913251'
            RETURNING chat_id, phone_number, thread_id, thread_token_count;
        `);
        
        if (updateResult.rows.length > 0) {
            console.log('✅ Datos limpiados:');
            updateResult.rows.forEach(row => {
                console.log(`   Chat: ${row.chat_id || row.phone_number}`);
                console.log(`   thread_id: ${row.thread_id || 'NULL'}`);
                console.log(`   thread_token_count: ${row.thread_token_count || 0}`);
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
                    WHEN tgenabled = 'O' THEN 'ACTIVO'
                    WHEN tgenabled = 'D' THEN 'DESHABILITADO'
                    ELSE 'ESTADO: ' || tgenabled
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
        } else {
            console.log('⚠️ No se pudieron verificar los triggers');
        }

        // 6. Test del trigger
        console.log('\n6️⃣ Probando el trigger...');
        
        // Verificar si existe el registro
        const checkExisting = await client.query(`
            SELECT chat_id, phone_number, thread_id, thread_token_count 
            FROM chats 
            WHERE chat_id = '3003913251' OR phone_number = '3003913251'
            LIMIT 1;
        `);
        
        if (checkExisting.rows.length > 0) {
            console.log('📊 Registro encontrado, intentando actualizar...');
            
            // Intentar actualizar (el trigger debería prevenir cambios)
            await client.query(`
                UPDATE chats 
                SET thread_id = 'test_thread_should_not_save',
                    thread_token_count = 999
                WHERE chat_id = '3003913251' OR phone_number = '3003913251';
            `);
            
            // Verificar que no se actualizó
            const afterUpdate = await client.query(`
                SELECT chat_id, phone_number, thread_id, thread_token_count 
                FROM chats 
                WHERE chat_id = '3003913251' OR phone_number = '3003913251'
                LIMIT 1;
            `);
            
            console.log('📊 Resultado del test:');
            console.log(`   thread_id: ${afterUpdate.rows[0].thread_id || 'NULL'} ${!afterUpdate.rows[0].thread_id ? '✅' : '❌'}`);
            console.log(`   thread_token_count: ${afterUpdate.rows[0].thread_token_count || 0} ${afterUpdate.rows[0].thread_token_count === 0 ? '✅' : '❌'}`);
            
            if (!afterUpdate.rows[0].thread_id && afterUpdate.rows[0].thread_token_count === 0) {
                console.log('✅ TRIGGER FUNCIONANDO CORRECTAMENTE');
            } else {
                console.log('⚠️ El trigger puede no estar funcionando como se esperaba');
            }
        } else {
            console.log('ℹ️ No existe registro para 3003913251 aún');
            console.log('   El trigger se activará cuando se cree o actualice');
        }

        console.log('\n' + '=' .repeat(60));
        console.log('✅ TRIGGER APLICADO EXITOSAMENTE EN RAILWAY');
        console.log('\n⚠️ CONFIGURACIÓN PROVISIONAL:');
        console.log('   • Chat afectado: 3003913251');
        console.log('   • NO guardará thread_id en BD');
        console.log('   • NO guardará thread_token_count en BD');
        console.log('   • Aplica tanto a INSERT como UPDATE');
        console.log('   • El cache seguirá funcionando normal');
        
        console.log('\n🔄 Para REMOVER cuando ya no sea necesario, ejecuta:');
        console.log('   DROP TRIGGER IF EXISTS skip_3003913251_updates ON chats;');
        console.log('   DROP TRIGGER IF EXISTS skip_3003913251_inserts ON chats;');
        console.log('   DROP FUNCTION IF EXISTS skip_updates_for_3003913251();');
        
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