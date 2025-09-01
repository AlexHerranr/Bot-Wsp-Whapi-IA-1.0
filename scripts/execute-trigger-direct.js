#!/usr/bin/env node

/**
 * Script para ejecutar el trigger PROVISIONAL directamente en Railway DB
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
        console.log('📡 Conectando a Railway DB (turntable.proxy.rlwy.net)...');
        await client.connect();
        console.log('✅ Conectado exitosamente\n');

        // 1. Crear la función del trigger
        console.log('1️⃣ Creando función del trigger...');
        await client.query(`
            CREATE OR REPLACE FUNCTION skip_updates_for_3003913251()
            RETURNS TRIGGER AS $$
            BEGIN
                -- Si es el chat 3003913251, mantener valores antiguos
                IF NEW."phoneNumber" = '3003913251' THEN
                    -- Preservar thread y tokens anteriores
                    NEW."threadId" = OLD."threadId";
                    NEW."threadTokenCount" = COALESCE(OLD."threadTokenCount", 0);
                    
                    RAISE NOTICE 'PROVISIONAL: Omitiendo actualización para 3003913251';
                END IF;
                
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);
        console.log('✅ Función creada\n');

        // 2. Eliminar trigger anterior si existe
        console.log('2️⃣ Eliminando trigger anterior si existe...');
        await client.query(`DROP TRIGGER IF EXISTS skip_3003913251_updates ON "WhatsApp";`);
        console.log('✅ Limpieza completada\n');

        // 3. Crear el nuevo trigger
        console.log('3️⃣ Creando trigger BEFORE UPDATE...');
        await client.query(`
            CREATE TRIGGER skip_3003913251_updates
            BEFORE UPDATE ON "WhatsApp"
            FOR EACH ROW
            EXECUTE FUNCTION skip_updates_for_3003913251();
        `);
        console.log('✅ Trigger creado\n');

        // 4. Limpiar datos actuales del chat
        console.log('4️⃣ Limpiando datos actuales del chat 3003913251...');
        const updateResult = await client.query(`
            UPDATE "WhatsApp" 
            SET "threadId" = NULL, 
                "threadTokenCount" = 0 
            WHERE "phoneNumber" = '3003913251'
            RETURNING "phoneNumber", "threadId", "threadTokenCount";
        `);
        
        if (updateResult.rows.length > 0) {
            console.log('✅ Datos limpiados:', updateResult.rows[0]);
        } else {
            console.log('ℹ️ No se encontró el registro o ya estaba limpio');
        }
        console.log('');

        // 5. Verificar que el trigger está activo
        console.log('5️⃣ Verificando trigger...');
        const verifyResult = await client.query(`
            SELECT 
                tgname AS trigger_name,
                CASE 
                    WHEN tgenabled = 'O' THEN 'ACTIVO'
                    WHEN tgenabled = 'D' THEN 'DESHABILITADO'
                    ELSE 'ESTADO: ' || tgenabled
                END AS estado
            FROM pg_trigger
            WHERE tgname = 'skip_3003913251_updates';
        `);
        
        if (verifyResult.rows.length > 0) {
            console.log('✅ Trigger verificado:');
            console.log('   Nombre:', verifyResult.rows[0].trigger_name);
            console.log('   Estado:', verifyResult.rows[0].estado);
        } else {
            console.log('⚠️ No se pudo verificar el trigger');
        }

        // 6. Test del trigger
        console.log('\n6️⃣ Probando el trigger...');
        
        // Verificar si existe el registro
        const checkExisting = await client.query(`
            SELECT "phoneNumber", "threadId", "threadTokenCount" 
            FROM "WhatsApp" 
            WHERE "phoneNumber" = '3003913251';
        `);
        
        if (checkExisting.rows.length > 0) {
            // Intentar actualizar (el trigger debería prevenir cambios)
            await client.query(`
                UPDATE "WhatsApp" 
                SET "threadId" = 'test_thread_should_not_save',
                    "threadTokenCount" = 999
                WHERE "phoneNumber" = '3003913251';
            `);
            
            // Verificar que no se actualizó
            const afterUpdate = await client.query(`
                SELECT "phoneNumber", "threadId", "threadTokenCount" 
                FROM "WhatsApp" 
                WHERE "phoneNumber" = '3003913251';
            `);
            
            console.log('📊 Resultado del test:');
            console.log('   threadId:', afterUpdate.rows[0].threadId || 'NULL ✅');
            console.log('   threadTokenCount:', afterUpdate.rows[0].threadtokencount || '0 ✅');
            
            if (!afterUpdate.rows[0].threadId && (afterUpdate.rows[0].threadtokencount === 0 || !afterUpdate.rows[0].threadtokencount)) {
                console.log('✅ TRIGGER FUNCIONANDO CORRECTAMENTE');
            }
        } else {
            console.log('ℹ️ No existe registro para 3003913251 aún');
        }

        console.log('\n' + '=' .repeat(60));
        console.log('✅ TRIGGER APLICADO EXITOSAMENTE EN RAILWAY');
        console.log('\n⚠️ CONFIGURACIÓN PROVISIONAL:');
        console.log('   • Chat afectado: 3003913251');
        console.log('   • NO guardará threadId en BD');
        console.log('   • NO guardará threadTokenCount en BD');
        console.log('   • El cache seguirá funcionando normal');
        
        console.log('\n🔄 Para REMOVER cuando ya no sea necesario:');
        console.log('   DROP TRIGGER skip_3003913251_updates ON "WhatsApp";');
        console.log('   DROP FUNCTION skip_updates_for_3003913251();');
        
    } catch (error) {
        console.error('❌ Error ejecutando trigger:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.error('   No se pudo conectar a Railway DB');
            console.error('   Verifica las credenciales y conexión');
        }
        console.error('\nDetalles:', error);
    } finally {
        await client.end();
        console.log('\n📡 Conexión cerrada');
    }
}

// Ejecutar
executeTrigger();