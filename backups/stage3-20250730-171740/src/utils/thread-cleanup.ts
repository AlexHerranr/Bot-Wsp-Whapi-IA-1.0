import OpenAI from 'openai';
import dotenv from 'dotenv';
import { threadPersistence } from './persistence/index.js';
import { logThreadCleanup } from './logging/index.js';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/**
 * 🗑️ LIMPIEZA COMPLETA DE THREADS
 * Elimina TODOS los threads del assistant
 * PRECAUCIÓN: Esto borra todas las conversaciones activas
 */
export const cleanupAllThreads = async () => {
    try {
        console.log('🚨 INICIANDO LIMPIEZA COMPLETA DE THREADS...');
        
        // 1. Obtener todos los threads locales
        const localThreads = threadPersistence.getAllThreads();
        const threadCount = Object.keys(localThreads).length;
        console.log(`📊 Threads locales encontrados: ${threadCount}`);
        
        if (threadCount === 0) {
            console.log('ℹ️ No hay threads para eliminar');
            return { success: true, deleted: 0, errors: 0, message: 'No hay threads para eliminar' };
        }
        
        let deletedCount = 0;
        let errors = 0;
        
        // 2. Eliminar cada thread de OpenAI
        for (const [userId, threadInfo] of Object.entries(localThreads)) {
            try {
                console.log(`🗑️ Eliminando thread para ${userId} (${threadInfo.userName}): ${threadInfo.threadId}`);
                
                await openai.beta.threads.del(threadInfo.threadId);
                deletedCount++;
                
                // Pequeño delay para evitar rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`❌ Error eliminando thread ${threadInfo.threadId}:`, error.message);
                errors++;
            }
        }
        
        // 3. Limpiar storage local
        threadPersistence.clearAllThreads();
        
        console.log('✅ LIMPIEZA COMPLETADA');
        console.log(`📊 Estadísticas:`);
        console.log(`   - Threads eliminados: ${deletedCount}`);
        console.log(`   - Errores: ${errors}`);
        console.log(`   - Storage local limpio: ✅`);
        
        logThreadCleanup('Limpieza completa de threads ejecutada', {
            operation: 'cleanup_all',
            threadsFound: threadCount,
            threadsDeleted: deletedCount,
            errors: errors,
            success: true
        });
        
        return {
            success: true,
            deleted: deletedCount,
            errors: errors,
            message: `Limpieza completada. ${deletedCount} threads eliminados.`
        };
        
    } catch (error) {
        console.error('💥 ERROR CRÍTICO en limpieza:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * 🎯 ELIMINAR THREAD ESPECÍFICO
 * Elimina solo un thread problemático
 */
export const cleanupSpecificThread = async (userId) => {
    try {
        const threadInfo = threadPersistence.getThread(userId);
        
        if (!threadInfo) {
            return { success: false, message: `Thread no encontrado para usuario ${userId}` };
        }
        
        console.log(`🗑️ Eliminando thread específico para ${userId} (${threadInfo.userName}): ${threadInfo.threadId}`);
        
        // Eliminar de OpenAI
        await openai.beta.threads.del(threadInfo.threadId);
        
        // Eliminar localmente
        threadPersistence.removeThread(userId);
        
        console.log(`✅ Thread ${threadInfo.threadId} eliminado exitosamente`);
        
        logThreadCleanup('Thread específico eliminado', {
            operation: 'cleanup_specific',
            userId,
            threadId: threadInfo.threadId,
            userName: threadInfo.userName,
            success: true
        });
        
        return {
            success: true,
            threadId: threadInfo.threadId,
            userName: threadInfo.userName,
            message: `Thread de ${threadInfo.userName} (${userId}) eliminado exitosamente`
        };
        
    } catch (error) {
        console.error(`❌ Error eliminando thread específico:`, error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * 📊 MOSTRAR THREADS ACTUALES
 * Lista todos los threads sin eliminar nada
 */
export const listThreads = () => {
    try {
        const localThreads = threadPersistence.getAllThreads();
        const threadCount = Object.keys(localThreads).length;
        
        console.log(`📊 THREADS ACTUALES (${threadCount} total):`);
        console.log('─'.repeat(60));
        
        if (threadCount === 0) {
            console.log('ℹ️ No hay threads almacenados');
            return { success: true, threads: [] };
        }
        
        const threadsList = [];
        for (const [userId, threadInfo] of Object.entries(localThreads)) {
            const info = {
                userId,
                userName: threadInfo.userName || 'Sin nombre',
                threadId: threadInfo.threadId,
                lastActivity: threadInfo.lastActivity,
                createdAt: threadInfo.createdAt
            };
            
            threadsList.push(info);
            console.log(`👤 ${info.userName} (${userId})`);
            console.log(`   🆔 Thread: ${info.threadId}`);
            console.log(`   📅 Último: ${new Date(info.lastActivity).toLocaleString()}`);
            console.log('');
        }
        
        return { success: true, threads: threadsList };
        
    } catch (error) {
        console.error('❌ Error listando threads:', error);
        return { success: false, error: error.message };
    }
};

// Función de utilidad para usar desde terminal
if (process.argv[2] === 'cleanup-all') {
    cleanupAllThreads().then(result => {
        console.log('🎯 Resultado final:', result);
        process.exit(result.success ? 0 : 1);
    });
}

if (process.argv[2] === 'cleanup-user' && process.argv[3]) {
    cleanupSpecificThread(process.argv[3]).then(result => {
        console.log('🎯 Resultado final:', result);
        process.exit(result.success ? 0 : 1);
    });
}

if (process.argv[2] === 'list') {
    const result = listThreads();
    process.exit(result.success ? 0 : 1);
} 