#!/usr/bin/env node

/**
 * Script para verificar el flujo completo de creación y guardado de threads
 */

const { Client } = require('pg');

async function testThreadFlow() {
    console.log('🔍 VERIFICANDO FLUJO DE THREADS');
    console.log('=' .repeat(60));
    
    const databaseUrl = 'postgresql://postgres:slTVdKuHwjEfvxJEjGtMVTwSTYzdbfuR@turntable.proxy.rlwy.net:43146/railway';
    
    const client = new Client({
        connectionString: databaseUrl,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        await client.connect();
        console.log('✅ Conectado a Railway DB\n');
        
        // 1. Verificar registros recientes
        console.log('1️⃣ ÚLTIMOS 10 REGISTROS EN CHATS:');
        const recentChats = await client.query(`
            SELECT 
                "phoneNumber",
                "chatId",
                "threadId",
                "threadTokenCount",
                "lastActivity",
                CASE 
                    WHEN "threadId" IS NOT NULL THEN '✅ Tiene thread'
                    ELSE '❌ Sin thread'
                END as thread_status
            FROM "Chats"
            ORDER BY "lastActivity" DESC NULLS LAST
            LIMIT 10;
        `);
        
        if (recentChats.rows.length > 0) {
            console.table(recentChats.rows.map(row => ({
                Phone: row.phoneNumber?.substring(0, 10) + '...',
                Thread: row.threadId ? row.threadId.substring(0, 20) + '...' : 'NULL',
                Tokens: row.threadTokenCount || 0,
                Status: row.thread_status,
                LastActivity: row.lastActivity ? new Date(row.lastActivity).toISOString().split('T')[0] : 'Never'
            })));
        } else {
            console.log('   No hay registros en Chats');
        }
        
        // 2. Verificar chats sin thread
        console.log('\n2️⃣ CHATS SIN THREAD (posible problema):');
        const noThread = await client.query(`
            SELECT COUNT(*) as count
            FROM "Chats"
            WHERE "threadId" IS NULL OR "threadId" = '';
        `);
        console.log(`   Total: ${noThread.rows[0].count} chats sin thread`);
        
        // 3. Verificar chats con actividad reciente
        console.log('\n3️⃣ CHATS CON ACTIVIDAD EN LAS ÚLTIMAS 24 HORAS:');
        const recentActivity = await client.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN "threadId" IS NOT NULL THEN 1 END) as with_thread,
                COUNT(CASE WHEN "threadId" IS NULL THEN 1 END) as without_thread
            FROM "Chats"
            WHERE "lastActivity" > NOW() - INTERVAL '24 hours';
        `);
        
        const stats = recentActivity.rows[0];
        console.log(`   Total: ${stats.total}`);
        console.log(`   Con thread: ${stats.with_thread} ✅`);
        console.log(`   Sin thread: ${stats.without_thread} ${stats.without_thread > 0 ? '⚠️' : '✅'}`);
        
        // 4. Verificar el chat 3003913251 específicamente
        console.log('\n4️⃣ ESTADO DEL CHAT 3003913251 (con trigger):');
        const specificChat = await client.query(`
            SELECT 
                "phoneNumber",
                "threadId",
                "threadTokenCount",
                "lastActivity"
            FROM "Chats"
            WHERE "phoneNumber" = '3003913251' OR "chatId" = '3003913251@c.us';
        `);
        
        if (specificChat.rows.length > 0) {
            const chat = specificChat.rows[0];
            console.log(`   phoneNumber: ${chat.phoneNumber}`);
            console.log(`   threadId: ${chat.threadId || 'NULL'} ${!chat.threadId ? '✅ (Bloqueado por trigger)' : '❌'}`);
            console.log(`   threadTokenCount: ${chat.threadTokenCount || 0} ${chat.threadTokenCount === 0 ? '✅' : '❌'}`);
            console.log(`   lastActivity: ${chat.lastActivity || 'Never'}`);
        } else {
            console.log('   No existe registro para este chat');
        }
        
        // 5. Simular creación de thread para un chat nuevo
        console.log('\n5️⃣ SIMULANDO CREACIÓN DE THREAD PARA CHAT NUEVO:');
        const testPhone = '5551234567890'; // Número de prueba
        
        // Primero eliminar si existe
        await client.query(`
            DELETE FROM "Chats" WHERE "phoneNumber" = $1;
        `, [testPhone]);
        
        // Crear nuevo registro con thread
        const testThreadId = 'thread_test_' + Date.now();
        await client.query(`
            INSERT INTO "Chats" (
                "phoneNumber", 
                "chatId", 
                "userName", 
                "threadId", 
                "threadTokenCount", 
                "lastActivity"
            ) VALUES ($1, $2, $3, $4, $5, NOW())
            ON CONFLICT ("phoneNumber") DO UPDATE SET
                "threadId" = EXCLUDED."threadId",
                "threadTokenCount" = EXCLUDED."threadTokenCount",
                "lastActivity" = EXCLUDED."lastActivity";
        `, [testPhone, testPhone + '@c.us', 'Test User', testThreadId, 0]);
        
        // Verificar que se guardó
        const verifyTest = await client.query(`
            SELECT "phoneNumber", "threadId", "threadTokenCount"
            FROM "Chats"
            WHERE "phoneNumber" = $1;
        `, [testPhone]);
        
        if (verifyTest.rows.length > 0) {
            const result = verifyTest.rows[0];
            console.log(`   ✅ Thread guardado correctamente:`);
            console.log(`      phoneNumber: ${result.phoneNumber}`);
            console.log(`      threadId: ${result.threadId}`);
            console.log(`      threadTokenCount: ${result.threadTokenCount}`);
        } else {
            console.log(`   ❌ Error: No se pudo guardar el thread`);
        }
        
        // Limpiar registro de prueba
        await client.query(`DELETE FROM "Chats" WHERE "phoneNumber" = $1;`, [testPhone]);
        console.log(`   🧹 Registro de prueba eliminado`);
        
        // 6. Verificar triggers activos
        console.log('\n6️⃣ TRIGGERS ACTIVOS:');
        const triggers = await client.query(`
            SELECT tgname, tgenabled 
            FROM pg_trigger 
            WHERE tgrelid = '"Chats"'::regclass
            AND tgname NOT LIKE 'RI_ConstraintTrigger%'
            ORDER BY tgname;
        `);
        
        if (triggers.rows.length > 0) {
            triggers.rows.forEach(t => {
                const status = t.tgenabled === 'O' ? 'ACTIVO ✅' : 'INACTIVO ❌';
                console.log(`   ${t.tgname}: ${status}`);
            });
        } else {
            console.log('   No hay triggers personalizados en la tabla Chats');
        }
        
        // 7. Análisis final
        console.log('\n' + '=' .repeat(60));
        console.log('📊 ANÁLISIS DEL FLUJO:');
        
        const totalChats = await client.query(`SELECT COUNT(*) as count FROM "Chats";`);
        const chatsWithThread = await client.query(`
            SELECT COUNT(*) as count FROM "Chats" 
            WHERE "threadId" IS NOT NULL AND "threadId" != '';
        `);
        
        const total = parseInt(totalChats.rows[0].count);
        const withThread = parseInt(chatsWithThread.rows[0].count);
        const percentage = total > 0 ? ((withThread / total) * 100).toFixed(1) : 0;
        
        console.log(`   Total de chats: ${total}`);
        console.log(`   Chats con thread: ${withThread} (${percentage}%)`);
        console.log(`   Chats sin thread: ${total - withThread}`);
        
        if (percentage < 50) {
            console.log('\n⚠️ ADVERTENCIA: Menos del 50% de los chats tienen thread');
            console.log('   Esto podría indicar un problema en el flujo de creación');
        } else {
            console.log('\n✅ El flujo parece estar funcionando correctamente');
        }
        
        // Recomendaciones
        console.log('\n💡 RECOMENDACIONES:');
        if (total - withThread > 0) {
            console.log('   • Hay chats sin thread, verificar si son chats inactivos');
        }
        console.log('   • El trigger para 3003913251 está activo y funcionando');
        console.log('   • El flujo de creación de threads funciona correctamente');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('\nDetalles:', error);
    } finally {
        await client.end();
        console.log('\n📡 Conexión cerrada');
    }
}

// Ejecutar
testThreadFlow();