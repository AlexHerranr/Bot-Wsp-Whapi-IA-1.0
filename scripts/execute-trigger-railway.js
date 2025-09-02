#!/usr/bin/env node

/**
 * Script para ejecutar el trigger PROVISIONAL directamente en Railway DB
 */

const { Client } = require('pg');

async function executeTrigger() {
    console.log('🔧 EJECUTANDO TRIGGER PROVISIONAL EN RAILWAY DB');
    console.log('=' .repeat(60));
    
    // Conexión directa a PostgreSQL de Railway
    const client = new Client({
        host: 'monorail.proxy.rlwy.net',
        port: 57391,
        database: 'railway',
        user: 'postgres',
        password: 'sRWlVDYJZJMPCMkzIZMfGFWGHBmNKIJG',
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
                -- Si es el chat 3003913251, mantener valores antiguos
                IF NEW."phoneNumber" = '3003913251' THEN
                    -- Preservar thread y tokens anteriores
                    IF OLD."threadId" IS NOT NULL THEN
                        NEW."threadId" = OLD."threadId";
                    END IF;
                    IF OLD."threadTokenCount" IS NOT NULL THEN
                        NEW."threadTokenCount" = OLD."threadTokenCount";
                    END IF;
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
                tgenabled AS enabled
            FROM pg_trigger
            WHERE tgname = 'skip_3003913251_updates';
        `);
        
        if (verifyResult.rows.length > 0) {
            console.log('✅ Trigger verificado y activo:');
            console.log('   Nombre:', verifyResult.rows[0].trigger_name);
            console.log('   Estado:', verifyResult.rows[0].enabled === 'O' ? 'ACTIVO' : 'INACTIVO');
        } else {
            console.log('⚠️ No se pudo verificar el trigger');
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
        console.error(error);
    } finally {
        await client.end();
        console.log('\n📡 Conexión cerrada');
    }
}

// Ejecutar
executeTrigger();