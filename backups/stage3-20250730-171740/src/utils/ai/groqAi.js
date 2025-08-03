import OpenAI from 'openai';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { threadPersistence } from '../persistence/index.js';
import { contextManager } from '../context/index.js';
import { enhancedLog } from '../core/index.js';
import { FunctionHandler } from '../../handlers/function-handler.js';

dotenv.config();

const openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY 
});

// Migrar de state local a threadPersistence
const state = new Map(); // Mantener temporalmente para compatibilidad
const THREADS_FILE = path.join(process.cwd(), 'tmp', 'threads.json');

// Migrar threads existentes al nuevo sistema
const migrateToAdvancedPersistence = () => {
    try {
        // Cargar threads del sistema antiguo
        if (fs.existsSync(THREADS_FILE)) {
            const data = fs.readFileSync(THREADS_FILE, 'utf8');
            const threads = JSON.parse(data);
            
            let migrated = 0;
            threads.forEach(([userId, threadData]) => {
                if (typeof threadData === 'string') {
                    // Formato antiguo
                    threadPersistence.setThread(userId, threadData);
                } else {
                    // Formato nuevo
                    threadPersistence.setThread(userId, threadData.threadId, threadData.messageCount);
                }
                migrated++;
            });
            
            if (migrated > 0) {
                enhancedLog('success', 'MIGRATION', 
                    `${migrated} threads migrados al sistema avanzado`);
                
                // Guardar con el nuevo sistema
                threadPersistence.saveThreads();
                
                // Renombrar archivo antiguo
                fs.renameSync(THREADS_FILE, THREADS_FILE + '.backup');
            }
        }
    } catch (error) {
        enhancedLog('error', 'MIGRATION', 
            `Error migrando threads: ${error.message}`);
    }
};

// Ejecutar migración al iniciar
migrateToAdvancedPersistence();

// Función mejorada para obtener o crear thread con contexto histórico
const getOrCreateThread = async (userJid) => {
    try {
        // Log de debug: estado actual del sistema
        const allThreads = threadPersistence.getStats();
        enhancedLog('info', 'THREAD_DEBUG', `Sistema tiene ${allThreads.totalThreads} threads total`, undefined, userJid);
        
        // Buscar thread existente
        let threadInfo = threadPersistence.getThread(userJid);
        
        if (threadInfo) {
            enhancedLog('info', 'THREAD_DEBUG', `Búsqueda de thread para ${userJid}: ENCONTRADO`, undefined, userJid);
            enhancedLog('info', 'THREAD_DEBUG', `Thread existente: ${threadInfo.threadId} con ${threadInfo.messageCount} mensajes`, undefined, userJid);
        } else {
            enhancedLog('info', 'THREAD_DEBUG', `Búsqueda de thread para ${userJid}: NO ENCONTRADO`, undefined, userJid);
        }
        
        // Si no existe thread o necesita rotación
        if (!threadInfo || threadPersistence.needsRotation(userJid)) {
            enhancedLog('info', 'THREAD_MANAGER', `Creando nuevo thread para ${userJid}`, undefined, userJid);
            
            // Crear nuevo thread en OpenAI
            const thread = await openai.beta.threads.create();
            
            if (threadInfo && threadPersistence.needsRotation(userJid)) {
                // Rotar thread existente
                threadPersistence.rotateThread(userJid, thread.id);
                console.log(`🔄 Thread rotado para ${userJid} (límite de 1000 mensajes)`);
                enhancedLog('success', 'THREAD_ROTATION', `Thread rotado para ${userJid}: ${thread.id} (límite de 1000 mensajes)`, undefined, userJid);
            } else {
                // Crear thread nuevo
                threadPersistence.setThread(userJid, thread.id, 0);
                console.log(`📝 Nuevo thread creado para ${userJid}`);
                enhancedLog('success', 'THREAD_CREATION', `Nuevo thread creado para ${userJid}: ${thread.id}`, undefined, userJid);
            }
        } else {
            // Reutilizar thread existente
            enhancedLog('success', 'THREAD_REUSE', `Usando thread existente para ${userJid}: ${threadInfo.threadId} (${threadInfo.messageCount} mensajes)`, undefined, userJid);
        }
        
        // DESACTIVAR Context Manager que siempre falla
        // Solo obtener contexto si es primera vez (comentado por fallas)
        /*
        if (!threadInfo) {
            const historicalContext = await contextManager.getHistoricalContext(userJid);
            if (historicalContext) {
                await openai.beta.threads.messages.create(thread.id, {
                    role: 'assistant',
                    content: historicalContext
                });
            }
        }
        */
        
        // Actualizar referencia
        threadInfo = threadPersistence.getThread(userJid);
        
        return threadInfo.threadId;
        
    } catch (error) {
        console.error(`❌ Error gestionando thread:`, error.message);
        enhancedLog('error', 'THREAD_MANAGER', `Error gestionando thread para ${userJid}: ${error.message}`, { error: error.stack }, userJid);
        throw error;
    }
};

// Instanciar function handler
const functionHandler = new FunctionHandler();

// Función principal mejorada con logging detallado y function calling
export const toAsk = async (assistantId, userMsg, userJid) => {
    const startTime = Date.now();
    
    try {
        enhancedLog('info', 'AI_PROCESSING', `Procesando ${userMsg.split('\n').length} mensajes agrupados con OpenAI Assistant`, undefined, userJid);
        
        // Obtener o crear thread
        const threadId = await getOrCreateThread(userJid);
        
        enhancedLog('info', 'OPENAI_REQUEST', `Enviando mensaje a thread ${threadId} para usuario ${userJid}`, undefined, userJid);
        
        // Crear mensaje en el thread (sin contexto enriquecido que falla)
        await openai.beta.threads.messages.create(threadId, {
            role: 'user',
            content: userMsg
        });
        
        // Actualizar contador de mensajes
        const threadInfo = threadPersistence.getThread(userJid);
        threadPersistence.setThread(userJid, threadId, threadInfo.messageCount + 1);
        
        // Crear y ejecutar run con function calling habilitado
        enhancedLog('info', 'OPENAI_RUN', `Creando run para thread ${threadId}...`, undefined, userJid);
        let run = await openai.beta.threads.runs.create(threadId, {
            assistant_id: assistantId
            // Las funciones se configuran en el Assistant, no aquí
        });
        
        enhancedLog('info', 'OPENAI_RUN', `Run creado: ${run.id} con estado: ${run.status}`, undefined, userJid);
        
        // Esperar a que complete
        let attempts = 0;
        const maxAttempts = 60; // 30 segundos máximo
        
        while (['queued', 'in_progress', 'requires_action'].includes(run.status) && attempts < maxAttempts) {
            if (run.status === 'requires_action') {
                // Procesar function calls si las hay
                const toolCalls = run.required_action.submit_tool_outputs.tool_calls;
                const toolOutputs = [];

                for (const toolCall of toolCalls) {
                    const functionArgs = JSON.parse(toolCall.function.arguments);
                    
                    // Inyectar userId si no está presente
                    if (toolCall.function.name === 'update_client_labels' && !functionArgs.userId) {
                        functionArgs.userId = userJid;
                    }
                    
                    enhancedLog('info', 'FUNCTION_CALL', `Ejecutando function: ${toolCall.function.name}`, { args: functionArgs }, userJid);
                    
                    const result = await functionHandler.handleFunction(
                        toolCall.function.name,
                        functionArgs
                    );
                    
                    toolOutputs.push({
                        tool_call_id: toolCall.id,
                        output: JSON.stringify(result)
                    });
                }
                
                await openai.beta.threads.runs.submitToolOutputs(threadId, run.id, {
                    tool_outputs: toolOutputs
                });
            } else {
                await new Promise(resolve => setTimeout(resolve, 500));
                attempts++;
            }
            
            run = await openai.beta.threads.runs.retrieve(threadId, run.id);
        }
        
        if (run.status !== 'completed') {
            enhancedLog('error', 'OPENAI_COMPLETE', `OpenAI no pudo completar la respuesta. Estado final: ${run.status}`, undefined, userJid);
            console.error(`❌ Error: OpenAI no pudo completar la respuesta`);
            return 'Lo siento, hubo un problema procesando tu mensaje. Por favor intenta de nuevo.';
        }
        
        // Obtener respuesta
        const messages = await openai.beta.threads.messages.list(threadId);
        const assistantMessage = messages.data.find(m => m.role === 'assistant');
        
        if (!assistantMessage || !assistantMessage.content[0]) {
            enhancedLog('error', 'OPENAI_RESPONSE', 'No se encontró respuesta del asistente', undefined, userJid);
            console.error('❌ Error: No se encontró respuesta del asistente');
            return 'No pude generar una respuesta. Por favor intenta de nuevo.';
        }
        
        const response = assistantMessage.content[0].text.value;
        const responseTime = Date.now() - startTime;
        
        enhancedLog('success', 'OPENAI_COMPLETE', `Respuesta obtenida en ${(responseTime/1000).toFixed(1)}s (${response.length} caracteres)`, undefined, userJid);
        enhancedLog('success', 'AI_RESPONSE', `Respuesta generada en ${(responseTime/1000).toFixed(1)}s: "${response.substring(0, 80)}..."`, undefined, userJid);
        
        // NO extraer contexto (sistema simplificado)
        // Contexto ahora manejado por el DatabaseService
        
        // Verificar si el thread está cerca del límite
        const currentThreadInfo = threadPersistence.getThread(userJid);
        if (currentThreadInfo.messageCount > 800) {
            enhancedLog('warning', 'THREAD_LIMIT', `Thread cerca del límite: ${currentThreadInfo.messageCount}/1000 mensajes`, undefined, userJid);
            console.log(`⚠️ Thread cerca del límite: ${currentThreadInfo.messageCount}/1000 mensajes`);
        }
        
        return response;
        
    } catch (error) {
        enhancedLog('error', 'AI_PROCESSING', `Error procesando mensaje de ${userJid}: ${error.message}`, { error: error.stack }, userJid);
        console.error(`❌ Error en OpenAI:`, error.message);
        
        // Intentar recuperación si es error de thread
        if (error.message.includes('thread') || error.message.includes('not found')) {
            enhancedLog('warning', 'THREAD_RECOVERY', `Reintentando con nuevo thread para ${userJid}...`, undefined, userJid);
            console.log('🔄 Reintentando con nuevo thread...');
            
            // Forzar creación de nuevo thread
            const thread = await openai.beta.threads.create();
            threadPersistence.setThread(userJid, thread.id, 0);
            enhancedLog('info', 'THREAD_RECOVERY', `Nuevo thread de recuperación creado: ${thread.id}`, undefined, userJid);
            
            // Reintentar
            return toAsk(assistantId, userMsg, userJid);
        }
        
        return 'Lo siento, hubo un error procesando tu mensaje. Por favor intenta de nuevo.';
    }
};

// Función mejorada para obtener estadísticas
export const getThreadStats = () => {
    const stats = threadPersistence.getStats();
    
    // Agregar información adicional
    const detailedStats = {
        ...stats,
        timestamp: new Date().toISOString(),
        systemHealth: {
            persistence: 'advanced',
            contextManager: 'active',
            autoSave: 'enabled',
            backups: 'enabled'
        },
        limits: {
            messagesPerThread: 1000,
            contextMessages: 50,
            contextLength: 10000
        }
    };
    
    return detailedStats;
};

// Función para obtener información detallada de un thread
export const getThreadInfo = (userJid) => {
    const info = threadPersistence.getThreadInfo(userJid);
    
    if (!info) return null;
    
    // Agregar información del contexto
    const profile = contextManager.getProfile(userJid);
    
    return {
        ...info,
        profile: profile ? {
            name: profile.name,
            vipStatus: profile.vipStatus,
            totalStays: profile.totalStays,
            lastInteraction: profile.lastInteraction
        } : null
    };
};

// Función para limpiar threads antiguos
export const cleanupOldThreads = async (daysOld = 30) => {
    enhancedLog('info', 'CLEANUP', 
        `Iniciando limpieza de threads más antiguos de ${daysOld} días...`);
    
    const stats = threadPersistence.getStats();
    let cleanedCount = 0;
    
    // Obtener todos los threads
    for (const userId in stats.threads) {
        const threadInfo = threadPersistence.getThreadInfo(userId);
        if (threadInfo && !threadInfo.isActive && threadInfo.daysSinceActivity > daysOld) {
            // Aquí podrías eliminar el thread de OpenAI si lo deseas
            // Por ahora solo lo marcamos en los logs
            enhancedLog('info', 'CLEANUP', 
                `Thread de ${userId} marcado para limpieza (${threadInfo.daysSinceActivity} días inactivo)`);
            cleanedCount++;
        }
    }
    
    enhancedLog('success', 'CLEANUP', 
        `Limpieza completada. ${cleanedCount} threads identificados para limpieza`);
    
    return { cleanedCount, totalThreads: stats.totalThreads };
};

// Función para obtener mensajes de un thread específico
export const getThreadMessages = async (threadId, limit = 50) => {
    try {
        enhancedLog('info', 'THREAD_MESSAGES', 
            `Obteniendo mensajes del thread ${threadId} (límite: ${limit})`);
        
        const messages = await openai.beta.threads.messages.list(threadId, {
            limit: limit,
            order: 'asc' // Más antiguos primero
        });
        
        enhancedLog('success', 'THREAD_MESSAGES', 
            `Obtenidos ${messages.data.length} mensajes del thread ${threadId}`);
        
        return messages.data;
    } catch (error) {
        enhancedLog('error', 'THREAD_MESSAGES', 
            `Error obteniendo mensajes del thread ${threadId}: ${error.message}`);
        throw error;
    }
};

// Exportar funciones adicionales para debugging
export const debugThread = async (userJid) => {
    const threadInfo = threadPersistence.getThreadInfo(userJid);
    const profile = contextManager.getProfile(userJid);
    
    console.log('\n=== DEBUG THREAD INFO ===');
    console.log('Thread Info:', threadInfo);
    console.log('User Profile:', profile);
    console.log('========================\n');
    
    return { threadInfo, profile };
};

