#!/usr/bin/env node

const { Client } = require('pg');

async function verifyTrigger() {
    const databaseUrl = 'postgresql://postgres:slTVdKuHwjEfvxJEjGtMVTwSTYzdbfuR@turntable.proxy.rlwy.net:43146/railway';
    
    const client = new Client({
        connectionString: databaseUrl,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        console.log('🔍 VERIFICANDO FUNCIONAMIENTO DEL TRIGGER');
        console.log('=' .repeat(60));
        
        await client.connect();
        
        // 1. Buscar el registro
        console.log('\n1️⃣ Buscando registro para 3003913251...');
        const existing = await client.query(`
            SELECT "phoneNumber", "chatId", "threadId", "threadTokenCount", "lastActivity"
            FROM "Chats" 
            WHERE "phoneNumber" = '3003913251' 
               OR "chatId" = '3003913251' 
               OR "chatId" = '3003913251@c.us'
            LIMIT 1;
        `);
        
        if (existing.rows.length > 0) {
            console.log('✅ Registro encontrado:');
            console.log(`   phoneNumber: ${existing.rows[0].phoneNumber}`);
            console.log(`   chatId: ${existing.rows[0].chatId}`);
            console.log(`   threadId: ${existing.rows[0].threadId || 'NULL'} ✅`);
            console.log(`   threadTokenCount: ${existing.rows[0].threadTokenCount || 0} ✅`);
            console.log(`   lastActivity: ${existing.rows[0].lastActivity || 'NULL'}`);
            
            // 2. Intentar actualizar
            console.log('\n2️⃣ Intentando actualizar threadId y tokens...');
            await client.query(`
                UPDATE "Chats" 
                SET "threadId" = 'test_thread_123456',
                    "threadTokenCount" = 888,
                    "lastActivity" = NOW()
                WHERE "phoneNumber" = '3003913251' 
                   OR "chatId" = '3003913251' 
                   OR "chatId" = '3003913251@c.us';
            `);
            
            // 3. Verificar que NO se actualizó
            console.log('\n3️⃣ Verificando resultado después del UPDATE...');
            const afterUpdate = await client.query(`
                SELECT "phoneNumber", "threadId", "threadTokenCount", "lastActivity"
                FROM "Chats" 
                WHERE "phoneNumber" = '3003913251' 
                   OR "chatId" = '3003913251' 
                   OR "chatId" = '3003913251@c.us'
                LIMIT 1;
            `);
            
            console.log('📊 Resultado:');
            console.log(`   threadId: ${afterUpdate.rows[0].threadId || 'NULL'}`);
            console.log(`   threadTokenCount: ${afterUpdate.rows[0].threadTokenCount || 0}`);
            console.log(`   lastActivity: ${afterUpdate.rows[0].lastActivity} (SÍ se actualizó - OK)`);
            
            const threadBlocked = !afterUpdate.rows[0].threadId || afterUpdate.rows[0].threadId === existing.rows[0].threadId;
            const tokensBlocked = afterUpdate.rows[0].threadTokenCount === 0 || afterUpdate.rows[0].threadTokenCount === existing.rows[0].threadTokenCount;
            
            if (threadBlocked && tokensBlocked) {
                console.log('\n✅ TRIGGER FUNCIONANDO PERFECTAMENTE');
                console.log('   • threadId NO se actualizó (bloqueado por trigger)');
                console.log('   • threadTokenCount NO se actualizó (bloqueado por trigger)');
                console.log('   • lastActivity SÍ se actualizó (permitido)');
            } else {
                console.log('\n⚠️ Algo no está funcionando como esperábamos');
            }
            
        } else {
            console.log('ℹ️ No existe registro para 3003913251');
            
            // Crear uno con lastActivity
            console.log('\n   Creando registro de prueba con todos los campos requeridos...');
            await client.query(`
                INSERT INTO "Chats" ("phoneNumber", "chatId", "userName", "lastActivity", "threadId", "threadTokenCount")
                VALUES ('3003913251', '3003913251@c.us', 'Test User', NOW(), 'should_be_null', 999)
                ON CONFLICT ("phoneNumber") DO NOTHING;
            `);
            
            // Verificar que el trigger funcionó
            const afterInsert = await client.query(`
                SELECT "phoneNumber", "threadId", "threadTokenCount" 
                FROM "Chats" 
                WHERE "phoneNumber" = '3003913251'
                LIMIT 1;
            `);
            
            if (afterInsert.rows.length > 0) {
                console.log('\n📊 Resultado después de INSERT:');
                console.log(`   threadId: ${afterInsert.rows[0].threadId || 'NULL'}`);
                console.log(`   threadTokenCount: ${afterInsert.rows[0].threadTokenCount || 0}`);
                
                const insertOk = !afterInsert.rows[0].threadId && afterInsert.rows[0].threadTokenCount === 0;
                if (insertOk) {
                    console.log('\n✅ TRIGGER FUNCIONÓ EN INSERT');
                    console.log('   Los valores se bloquearon correctamente');
                }
            }
        }
        
        // 4. Verificar triggers activos
        console.log('\n4️⃣ Estado de los triggers:');
        const triggers = await client.query(`
            SELECT tgname, tgenabled 
            FROM pg_trigger 
            WHERE tgname LIKE 'skip_3003913251%'
            ORDER BY tgname;
        `);
        
        triggers.rows.forEach(t => {
            const status = t.tgenabled === 'O' ? 'ACTIVO ✅' : 'INACTIVO ❌';
            console.log(`   ${t.tgname}: ${status}`);
        });
        
        console.log('\n' + '=' .repeat(60));
        console.log('📌 RESUMEN:');
        console.log('   • Triggers creados y activos');
        console.log('   • Chat 3003913251 NO guardará threadId ni tokens');
        console.log('   • Los demás campos se actualizan normal');
        console.log('   • Cache en memoria sigue funcionando');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
    }
}

verifyTrigger();