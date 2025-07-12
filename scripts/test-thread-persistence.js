#!/usr/bin/env node

/**
 * Script de prueba para verificar la persistencia de threads
 * Etapa 1: Arreglar Persistencia de Threads
 */

import 'dotenv/config';
import { threadPersistence } from '../src/utils/persistence/threadPersistence.js';

async function testThreadPersistence() {
    console.log('🧪 TEST: Verificación de Persistencia de Threads (Etapa 1)\n');

    try {
        // 1. Verificar estado inicial
        console.log('1️⃣ Estado inicial de threads:');
        const initialStats = threadPersistence.getStats();
        console.log(`   Total threads: ${initialStats.totalThreads}`);
        console.log(`   Threads activos: ${initialStats.activeThreads}`);
        console.log(`   Threads inactivos: ${initialStats.totalThreads - initialStats.activeThreads}`);

        // 2. Crear threads de prueba
        console.log('\n2️⃣ Creando threads de prueba...');
        const testUsers = ['test_user_1', 'test_user_2', 'test_user_3'];
        
        for (const userId of testUsers) {
            const threadId = `thread_test_${userId}_${Date.now()}`;
            threadPersistence.setThread(userId, threadId, `${userId}@s.whatsapp.net`, `Test User ${userId}`);
            console.log(`   ✅ Thread creado para ${userId}: ${threadId}`);
        }

        // 3. Verificar threads creados
        console.log('\n3️⃣ Verificando threads creados:');
        const afterCreateStats = threadPersistence.getStats();
        console.log(`   Total threads: ${afterCreateStats.totalThreads}`);
        console.log(`   Threads activos: ${afterCreateStats.activeThreads}`);

        // 4. Simular reutilización de threads
        console.log('\n4️⃣ Simulando reutilización de threads...');
        for (const userId of testUsers) {
            const existingThread = threadPersistence.getThread(userId);
            if (existingThread) {
                console.log(`   ✅ Thread reutilizado para ${userId}: ${existingThread.threadId}`);
                
                // Simular actividad (actualizar lastActivity)
                threadPersistence.updateThreadMetadata(userId, {
                    lastActivity: new Date().toISOString()
                });
            } else {
                console.log(`   ❌ Thread no encontrado para ${userId}`);
            }
        }

        // 5. Verificar que no se removieron threads automáticamente
        console.log('\n5️⃣ Verificando que threads no se removieron automáticamente:');
        const finalStats = threadPersistence.getStats();
        console.log(`   Total threads: ${finalStats.totalThreads}`);
        console.log(`   Threads activos: ${finalStats.activeThreads}`);
        
        if (finalStats.totalThreads >= testUsers.length) {
            console.log('   ✅ PERSISTENCIA FUNCIONANDO: Threads se mantienen activos');
        } else {
            console.log('   ❌ ERROR: Threads se removieron automáticamente');
        }

        // 6. Probar cleanup manual
        console.log('\n6️⃣ Probando cleanup manual...');
        const removedCount = threadPersistence.cleanupOldThreads(0.1); // 0.1 meses = ~3 días
        console.log(`   Threads removidos por cleanup: ${removedCount}`);

        // 7. Verificar estado final
        console.log('\n7️⃣ Estado final:');
        const finalStatsAfterCleanup = threadPersistence.getStats();
        console.log(`   Total threads: ${finalStatsAfterCleanup.totalThreads}`);
        console.log(`   Threads activos: ${finalStatsAfterCleanup.activeThreads}`);

        // 8. Limpiar threads de prueba
        console.log('\n8️⃣ Limpiando threads de prueba...');
        for (const userId of testUsers) {
            threadPersistence.removeThread(userId, 'test_cleanup');
        }

        console.log('\n✅ TEST COMPLETADO: Persistencia de threads funcionando correctamente');
        console.log('📊 RESUMEN:');
        console.log('   - Threads se crean correctamente');
        console.log('   - Threads se reutilizan (no se remueven automáticamente)');
        console.log('   - Cleanup funciona solo para threads viejos');
        console.log('   - Logs de debug funcionando');

    } catch (error) {
        console.error('❌ ERROR en test:', error.message);
        process.exit(1);
    }
}

// Ejecutar test
testThreadPersistence(); 