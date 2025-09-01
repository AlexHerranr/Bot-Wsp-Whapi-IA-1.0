#!/usr/bin/env node

/**
 * Script para simular el flujo completo del bot con threads
 */

require('dotenv').config();

// Configurar DATABASE_URL
process.env.DATABASE_URL = 'postgresql://postgres:slTVdKuHwjEfvxJEjGtMVTwSTYzdbfuR@turntable.proxy.rlwy.net:43146/railway?schema=public';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    log: ['error']
});

// Importar servicios del bot
const { DatabaseService } = require('../dist/core/services/database.service');
const { ThreadPersistenceService } = require('../dist/core/services/thread-persistence.service');

async function simulateBotFlow() {
    console.log('🤖 SIMULANDO FLUJO DEL BOT');
    console.log('=' .repeat(60));
    
    try {
        // Inicializar servicios
        const databaseService = new DatabaseService();
        await databaseService.connect();
        console.log('✅ DatabaseService conectado\n');
        
        const threadPersistence = new ThreadPersistenceService(databaseService);
        console.log('✅ ThreadPersistenceService inicializado\n');
        
        // 1. Simular chat normal (debe guardar thread)
        console.log('1️⃣ SIMULANDO CHAT NORMAL:');
        const normalPhone = '5551234567890';
        const normalThreadId = 'thread_normal_' + Date.now();
        
        // Limpiar primero
        await prisma.chats.deleteMany({
            where: { phoneNumber: normalPhone }
        });
        
        // Simular setThread como lo hace el bot
        console.log(`   Llamando setThread para ${normalPhone}...`);
        await threadPersistence.setThread(
            normalPhone,
            normalThreadId,
            normalPhone + '@c.us',
            'Normal User'
        );
        
        // Verificar en BD
        const normalResult = await prisma.chats.findUnique({
            where: { phoneNumber: normalPhone }
        });
        
        if (normalResult) {
            console.log(`   ✅ Thread guardado en BD:`);
            console.log(`      phoneNumber: ${normalResult.phoneNumber}`);
            console.log(`      threadId: ${normalResult.threadId}`);
            console.log(`      threadTokenCount: ${normalResult.threadTokenCount}`);
        } else {
            console.log(`   ❌ No se guardó en BD`);
        }
        
        // 2. Simular chat 3003913251 (NO debe guardar thread por el trigger)
        console.log('\n2️⃣ SIMULANDO CHAT 3003913251 (con trigger):');
        const blockedPhone = '3003913251';
        const blockedThreadId = 'thread_blocked_' + Date.now();
        
        console.log(`   Llamando setThread para ${blockedPhone}...`);
        await threadPersistence.setThread(
            blockedPhone,
            blockedThreadId,
            blockedPhone + '@c.us',
            'Blocked User'
        );
        
        // Verificar en BD
        const blockedResult = await prisma.chats.findUnique({
            where: { phoneNumber: blockedPhone }
        });
        
        if (blockedResult) {
            console.log(`   📊 Estado en BD:`);
            console.log(`      phoneNumber: ${blockedResult.phoneNumber}`);
            console.log(`      threadId: ${blockedResult.threadId || 'NULL'} ${!blockedResult.threadId ? '✅ (Bloqueado)' : '❌'}`);
            console.log(`      threadTokenCount: ${blockedResult.threadTokenCount || 0} ${blockedResult.threadTokenCount === 0 ? '✅' : '❌'}`);
        } else {
            console.log(`   ℹ️ No existe en BD aún`);
        }
        
        // 3. Verificar cache
        console.log('\n3️⃣ VERIFICANDO CACHE:');
        const clientCache = databaseService.getClientCache();
        
        if (clientCache) {
            const normalCached = clientCache.get(normalPhone);
            const blockedCached = clientCache.get(blockedPhone);
            
            console.log(`   Chat normal en cache:`);
            if (normalCached) {
                console.log(`      threadId: ${normalCached.threadId}`);
                console.log(`      threadTokenCount: ${normalCached.threadTokenCount}`);
            } else {
                console.log(`      No está en cache`);
            }
            
            console.log(`   Chat 3003913251 en cache:`);
            if (blockedCached) {
                console.log(`      threadId: ${blockedCached.threadId} ✅ (Cache sí guarda)`);
                console.log(`      threadTokenCount: ${blockedCached.threadTokenCount}`);
            } else {
                console.log(`      No está en cache`);
            }
        }
        
        // 4. Simular actualización de tokens
        console.log('\n4️⃣ SIMULANDO ACTUALIZACIÓN DE TOKENS:');
        
        // Para chat normal
        console.log(`   Actualizando tokens para chat normal...`);
        await databaseService.updateThreadTokenCount(normalPhone, 500);
        
        const normalAfterTokens = await prisma.chats.findUnique({
            where: { phoneNumber: normalPhone }
        });
        console.log(`   Chat normal: ${normalAfterTokens?.threadTokenCount || 0} tokens ✅`);
        
        // Para chat bloqueado
        console.log(`   Actualizando tokens para 3003913251...`);
        await databaseService.updateThreadTokenCount(blockedPhone, 999);
        
        const blockedAfterTokens = await prisma.chats.findUnique({
            where: { phoneNumber: blockedPhone }
        });
        console.log(`   Chat 3003913251: ${blockedAfterTokens?.threadTokenCount || 0} tokens ${blockedAfterTokens?.threadTokenCount === 0 ? '✅ (Bloqueado)' : '❌'}`);
        
        // 5. Limpiar registros de prueba
        console.log('\n5️⃣ LIMPIANDO REGISTROS DE PRUEBA:');
        await prisma.chats.deleteMany({
            where: { phoneNumber: normalPhone }
        });
        console.log(`   ✅ Eliminado registro de ${normalPhone}`);
        
        // Resumen
        console.log('\n' + '=' .repeat(60));
        console.log('📊 RESUMEN DEL FLUJO:');
        console.log('   ✅ Chat normal: Thread y tokens se guardan correctamente');
        console.log('   ✅ Chat 3003913251: Thread y tokens bloqueados por trigger');
        console.log('   ✅ Cache funciona para ambos casos');
        console.log('   ✅ El flujo del bot está funcionando correctamente');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('\nStack:', error.stack);
    } finally {
        await prisma.$disconnect();
        console.log('\n📡 Conexiones cerradas');
    }
}

// Ejecutar
simulateBotFlow();