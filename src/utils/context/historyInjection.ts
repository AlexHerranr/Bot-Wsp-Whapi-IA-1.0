/**
 * 🎯 Sistema de Inyección de Historial Modularizado
 * 
 * Encapsula toda la lógica de inyección de historial para evitar repeticiones
 * y mejorar la eficiencia del flujo conversacional.
 */

import OpenAI from 'openai';
import { threadPersistence } from '../persistence/threadPersistence';
import { getChatHistory } from '../whapi/index';
import { guestMemory } from '../persistence/index';
import { 
    logInfo, 
    logSuccess, 
    logWarning, 
    logError,
    logContextTokens 
} from '../logging/index';

// Cache de historial para optimizar fetches
const historyCache = new Map<string, { history: string; timestamp: number }>();
const HISTORY_CACHE_TTL = 60 * 60 * 1000; // 1 hora en ms

// Cache de inyección de contexto relevante (TTL 1 min)
const contextInjectionCache = new Map<string, { context: string; timestamp: number }>();
const CONTEXT_INJECTION_TTL = 60 * 1000; // 1 minuto

// Cache de threads que ya han recibido inyección
const injectionCache = new Map<string, { injected: boolean; timestamp: number }>();
const INJECTION_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Configuración de compresión
const COMPRESSION_THRESHOLD = 50; // Líneas de historial para activar compresión
const MAX_HISTORY_LINES = 100; // Máximo líneas antes de comprimir

export interface InjectionResult {
    success: boolean;
    tokensUsed: number;
    contextLength: number;
    historyLines: number;
    labelsCount: number;
    reason: string;
}

export interface ContextAnalysis {
    needsInjection: boolean;
    matchPercentage: number;
    reason: string;
}

/**
 * 🔧 FUNCIÓN PRINCIPAL: Inyectar historial de manera modularizada
 * Solo se ejecuta cuando es necesario y evita repeticiones
 */
export async function injectHistory(
    threadId: string, 
    userId: string, 
    chatId: string, 
    isNewThread: boolean,
    contextAnalysis?: ContextAnalysis,
    requestId?: string
): Promise<InjectionResult> {
    
    const shortUserId = userId.split('@')[0] || userId;
    let tokensUsed = 0;
    let contextLength = 0;
    let historyLines = 0;
    let labelsCount = 0;
    
    try {
        // 🔧 1. Verificar si el thread ya tiene contexto (evitar reinyección)
        if (!isNewThread && !contextAnalysis?.needsInjection) {
            logInfo('HISTORY_INJECTION_SKIP', 'Saltando inyección - thread existente sin necesidad de contexto', {
                userId: shortUserId,
                threadId,
                isNewThread,
                hasContextAnalysis: !!contextAnalysis,
                requestId
            });
            
            return {
                success: true,
                tokensUsed: 0,
                contextLength: 0,
                historyLines: 0,
                labelsCount: 0,
                reason: 'thread_exists_no_context_needed'
            };
        }
        
        // 🔧 2. Verificar si ya se inyectó recientemente (evitar duplicados)
        const needsInjection = await checkNeedsInjection(threadId, shortUserId, isNewThread, requestId);
        if (!needsInjection) {
            logInfo('HISTORY_INJECTION_SKIP_RECENT', 'Saltando inyección - ya inyectado recientemente', {
                userId: shortUserId,
                threadId,
                isNewThread,
                requestId
            });
            
            return {
                success: true,
                tokensUsed: 0,
                contextLength: 0,
                historyLines: 0,
                labelsCount: 0,
                reason: 'recently_injected'
            };
        }
        
        // 🔧 3. Para threads nuevos: inyectar historial completo
        if (isNewThread) {
            const historyResult = await injectNewThreadHistory(threadId, shortUserId, chatId, requestId);
            tokensUsed += historyResult.tokensUsed;
            contextLength += historyResult.contextLength;
            historyLines += historyResult.historyLines;
            labelsCount += historyResult.labelsCount;
            
            // Marcar como inyectado
            markAsInjected(threadId, shortUserId);
            
            logSuccess('HISTORY_INJECTION_NEW_THREAD', 'Historial inyectado para thread nuevo', {
                userId: shortUserId,
                threadId,
                tokensUsed: historyResult.tokensUsed,
                historyLines: historyResult.historyLines,
                requestId
            });
        }
        
        // 🔧 4. Para threads existentes: inyección condicional de contexto relevante
        if (!isNewThread && contextAnalysis?.needsInjection) {
            const contextResult = await injectRelevantContext(threadId, userId, requestId);
            tokensUsed += contextResult.tokensUsed;
            contextLength += contextResult.contextLength;
            
            // Marcar como inyectado
            markAsInjected(threadId, shortUserId);
            
            logSuccess('HISTORY_INJECTION_CONDITIONAL', 'Contexto relevante inyectado para thread existente', {
                userId: shortUserId,
                threadId,
                tokensUsed: contextResult.tokensUsed,
                matchPercentage: contextAnalysis.matchPercentage,
                reason: contextAnalysis.reason,
                requestId
            });
        }
        
        return {
            success: true,
            tokensUsed,
            contextLength,
            historyLines,
            labelsCount,
            reason: isNewThread ? 'new_thread_history' : 'conditional_context'
        };
        
    } catch (error) {
        logError('HISTORY_INJECTION_ERROR', 'Error en inyección de historial', {
            userId: shortUserId,
            threadId,
            error: error.message,
            requestId
        });
        
        return {
            success: false,
            tokensUsed: 0,
            contextLength: 0,
            historyLines: 0,
            labelsCount: 0,
            reason: `error: ${error.message}`
        };
    }
}

/**
 * 🔧 FUNCIÓN NUEVA: Verificar si necesita inyección
 */
async function checkNeedsInjection(threadId: string, shortUserId: string, isNewThread: boolean, requestId?: string): Promise<boolean> {
    // Para threads nuevos, siempre necesita inyección
    if (isNewThread) {
        logInfo('INJECTION_CHECK_NEW_THREAD', 'Thread nuevo necesita inyección', {
            userId: shortUserId,
            threadId,
            requestId
        });
        return true;
    }
    
    // Verificar cache de inyección reciente
    const cacheKey = `${threadId}_${shortUserId}`;
    const cached = injectionCache.get(cacheKey);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < INJECTION_CACHE_TTL) {
        logInfo('INJECTION_CHECK_CACHED', 'Thread ya inyectado recientemente', {
            userId: shortUserId,
            threadId,
            cacheAge: Math.round((now - cached.timestamp) / 1000) + 's',
            requestId
        });
        return false;
    }
    
    // Verificar si el thread existe y tiene actividad reciente (indicador de que ya tiene contexto)
    try {
        const threadInfo = threadPersistence.getThread(shortUserId);
        if (threadInfo && threadInfo.lastActivity) {
            const lastActivity = new Date(threadInfo.lastActivity);
            const now = new Date();
            const hoursSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);
            
            // Si la actividad fue hace menos de 1 hora, probablemente ya tiene contexto
            if (hoursSinceActivity < 1) {
                logInfo('INJECTION_CHECK_RECENT_ACTIVITY', 'Thread tiene actividad reciente, saltando inyección', {
                    userId: shortUserId,
                    threadId,
                    hoursSinceActivity: Math.round(hoursSinceActivity * 100) / 100,
                    requestId
                });
                return false;
            }
        }
    } catch (error) {
        logWarning('INJECTION_CHECK_ERROR', 'Error verificando thread info', {
            userId: shortUserId,
            threadId,
            error: error.message,
            requestId
        });
    }
    
    logInfo('INJECTION_CHECK_NEEDS', 'Thread necesita inyección', {
        userId: shortUserId,
        threadId,
        requestId
    });
    return true;
}

/**
 * 🔧 FUNCIÓN NUEVA: Marcar thread como inyectado
 */
function markAsInjected(threadId: string, shortUserId: string): void {
    const cacheKey = `${threadId}_${shortUserId}`;
    injectionCache.set(cacheKey, { 
        injected: true, 
        timestamp: Date.now() 
    });
    
    logInfo('INJECTION_MARKED', 'Thread marcado como inyectado', {
        userId: shortUserId,
        threadId,
        cacheSize: injectionCache.size
    });
}

/**
 * 🔧 FUNCIÓN ESPECÍFICA: Inyectar historial para threads nuevos
 */
async function injectNewThreadHistory(
    threadId: string, 
    shortUserId: string, 
    chatId: string, 
    requestId?: string
): Promise<InjectionResult> {
    
    let historyInjection = '';
    let labelsStr = '';
    let tokensUsed = 0;
    
    try {
        // 🔧 Verificar cache primero
        const cachedHistory = historyCache.get(shortUserId);
        const now = Date.now();
        
        if (cachedHistory && (now - cachedHistory.timestamp) < HISTORY_CACHE_TTL) {
            // Cache hit - usar historial cacheado
            historyInjection = cachedHistory.history;
            logInfo('HISTORY_CACHE_HIT', 'Usando historial cacheado', { 
                userId: shortUserId,
                cacheAge: Math.round((now - cachedHistory.timestamp) / 1000 / 60) + 'min',
                historyLines: historyInjection.split('\n').length,
                requestId
            });
        } else {
            // Cache miss - obtener historial fresco
            const historyLimit = 50; // Límite reducido para mejor performance
            historyInjection = await getChatHistory(chatId, historyLimit);
            
            if (historyInjection) {
                // 🔧 NUEVO: Comprimir historial si es muy largo
                const historyLines = historyInjection.split('\n').length;
                if (historyLines > COMPRESSION_THRESHOLD) {
                    historyInjection = await compressHistory(historyInjection, shortUserId, requestId);
                    logInfo('HISTORY_COMPRESSED', 'Historial comprimido para optimizar tokens', {
                        userId: shortUserId,
                        originalLines: historyLines,
                        compressedLines: historyInjection.split('\n').length,
                        requestId
                    });
                }
                
                // Cachear el resultado
                historyCache.set(shortUserId, { 
                    history: historyInjection, 
                    timestamp: now 
                });
                
                logSuccess('HISTORY_FETCH', 'Historial fresco obtenido y cacheado', { 
                    userId: shortUserId,
                    historyLimit,
                    historyLines: historyInjection.split('\n').length,
                    cacheSize: historyCache.size,
                    requestId
                });
            } else {
                logWarning('HISTORY_INJECT', 'No historial disponible', { 
                    userId: shortUserId,
                    requestId 
                });
            }
        }
        
        // 🔧 Obtener etiquetas del usuario
        try {
            await guestMemory.syncIfNeeded(shortUserId, false, true, requestId);
            const profile = guestMemory.getProfile(shortUserId);
            labelsStr = profile?.whapiLabels ? JSON.stringify(profile.whapiLabels.map(l => l.name)) : '[]';
            logInfo('LABELS_INJECT', `Etiquetas para inyección: ${labelsStr}`, { 
                userId: shortUserId,
                requestId 
            });
        } catch (error) {
            labelsStr = '[]';
            logWarning('SYNC_FAIL', 'Fallback sin labels', { 
                error: error.message, 
                userId: shortUserId,
                requestId
            });
        }
        
        // 🔧 Inyectar contenido solo si hay algo que inyectar
        if (historyInjection || labelsStr) {
            const injectContent = `${historyInjection ? historyInjection + '\n\n' : ''}Hora actual: ${new Date().toLocaleString('es-ES', { timeZone: 'America/Bogota' })}\nEtiquetas actuales: ${labelsStr}`;
            
            // Inyectar en el thread
            await injectContentToThread(threadId, injectContent);
            
            // Calcular tokens
            tokensUsed = Math.ceil(injectContent.length / 4);
            const historyLines = historyInjection ? historyInjection.split('\n').length : 0;
            const labelsCount = labelsStr ? JSON.parse(labelsStr).length : 0;
            
            logContextTokens('Contexto inyectado para thread nuevo', {
                shortUserId,
                threadId,
                contextLength: injectContent.length,
                estimatedTokens: tokensUsed,
                hasHistory: !!historyInjection,
                hasLabels: !!labelsStr,
                historyLines,
                labelsCount,
                requestId
            });
            
            return {
                success: true,
                tokensUsed,
                contextLength: injectContent.length,
                historyLines,
                labelsCount,
                reason: 'new_thread_history_injected'
            };
        }
        
        return {
            success: true,
            tokensUsed: 0,
            contextLength: 0,
            historyLines: 0,
            labelsCount: 0,
            reason: 'no_content_to_inject'
        };
        
    } catch (error) {
        logError('NEW_THREAD_HISTORY_ERROR', 'Error inyectando historial para thread nuevo', {
            userId: shortUserId,
            threadId,
            error: error.message,
            requestId
        });
        
        return {
            success: false,
            tokensUsed: 0,
            contextLength: 0,
            historyLines: 0,
            labelsCount: 0,
            reason: `error: ${error.message}`
        };
    }
}

/**
 * 🔧 FUNCIÓN NUEVA: Comprimir historial largo
 */
async function compressHistory(history: string, shortUserId: string, requestId?: string): Promise<string> {
    try {
        const lines = history.split('\n');
        
        // Si es muy largo, tomar solo las líneas más recientes
        if (lines.length > MAX_HISTORY_LINES) {
            const recentLines = lines.slice(-MAX_HISTORY_LINES);
            const compressed = recentLines.join('\n');
            
            logInfo('HISTORY_COMPRESSION', 'Historial comprimido por longitud', {
                userId: shortUserId,
                originalLines: lines.length,
                compressedLines: recentLines.length,
                requestId
            });
            
            return compressed;
        }
        
        // Si no es muy largo, mantener como está
        return history;
        
    } catch (error) {
        logWarning('HISTORY_COMPRESSION_ERROR', 'Error comprimiendo historial, usando original', {
            userId: shortUserId,
            error: error.message,
            requestId
        });
        return history;
    }
}

/**
 * 🔧 FUNCIÓN ESPECÍFICA: Inyectar contexto relevante para threads existentes
 */
async function injectRelevantContext(
    threadId: string, 
    userId: string, 
    requestId?: string
): Promise<InjectionResult> {
    
    try {
        // 🔧 Verificar cache de contexto relevante
        const cached = contextInjectionCache.get(userId);
        if (cached && (Date.now() - cached.timestamp < CONTEXT_INJECTION_TTL)) {
            logInfo('CONTEXT_CACHE_HIT', 'Usando contexto relevante cacheado', {
                userId: userId.split('@')[0],
                ageMs: Date.now() - cached.timestamp,
                requestId
            });
            
            // Inyectar contexto cacheado
            await injectContentToThread(threadId, cached.context);
            const tokensUsed = Math.ceil(cached.context.length / 4);
            
            return {
                success: true,
                tokensUsed,
                contextLength: cached.context.length,
                historyLines: 0,
                labelsCount: 0,
                reason: 'cached_context_injected'
            };
        }
        
        // 🔧 Obtener contexto relevante fresco
        const relevantContext = await getRelevantContext(userId, requestId);
        if (!relevantContext) {
            return {
                success: true,
                tokensUsed: 0,
                contextLength: 0,
                historyLines: 0,
                labelsCount: 0,
                reason: 'no_relevant_context'
            };
        }
        
        // 🔧 Cachear contexto relevante
        contextInjectionCache.set(userId, { 
            context: relevantContext, 
            timestamp: Date.now() 
        });
        
        // 🔧 Inyectar en el thread
        await injectContentToThread(threadId, relevantContext);
        
        const tokensUsed = Math.ceil(relevantContext.length / 4);
        
        return {
            success: true,
            tokensUsed,
            contextLength: relevantContext.length,
            historyLines: 0,
            labelsCount: 0,
            reason: 'fresh_context_injected'
        };
        
    } catch (error) {
        logError('RELEVANT_CONTEXT_ERROR', 'Error inyectando contexto relevante', {
            userId: userId.split('@')[0],
            threadId,
            error: error.message,
            requestId
        });
        
        return {
            success: false,
            tokensUsed: 0,
            contextLength: 0,
            historyLines: 0,
            labelsCount: 0,
            reason: `error: ${error.message}`
        };
    }
}

/**
 * 🔧 FUNCIÓN AUXILIAR: Obtener contexto relevante del historial
 */
async function getRelevantContext(userId: string, requestId?: string): Promise<string> {
    try {
        // Obtener perfil del usuario (incluye etiquetas)
        const profile = await guestMemory.getOrCreateProfile(userId);
        
        let context = '';
        if (profile.labels && profile.labels.length > 0) {
            context += `=== CONTEXTO DEL CLIENTE ===\n`;
            context += `Etiquetas: ${profile.labels.join(', ')}\n`;
            context += `Última actividad: ${new Date(profile.lastActivity).toLocaleString('es-ES')}\n`;
            context += `=== FIN CONTEXTO ===\n\n`;
        }
        
        logInfo('CONTEXT_INJECTION', 'Contexto relevante obtenido', {
            userId: userId.split('@')[0],
            contextLength: context.length,
            hasProfile: !!profile,
            requestId
        });
        
        return context;
        
    } catch (error) {
        logError('CONTEXT_INJECTION_ERROR', 'Error obteniendo contexto relevante', {
            userId: userId.split('@')[0],
            error: error.message,
            requestId
        });
        return '';
    }
}

/**
 * 🔧 FUNCIÓN AUXILIAR: Inyectar contenido en thread de OpenAI
 */
async function injectContentToThread(threadId: string, content: string): Promise<void> {
    // Esta función será implementada cuando tengamos acceso al cliente OpenAI
    // Por ahora es un placeholder
    logInfo('CONTENT_INJECTION', 'Contenido listo para inyección', {
        threadId,
        contentLength: content.length
    });
}

/**
 * 🔧 FUNCIÓN DE LIMPIEZA: Limpiar caches expirados
 */
export function cleanupExpiredCaches(): void {
    const now = Date.now();
    let historyExpired = 0;
    let contextExpired = 0;
    
    // Limpiar cache de historial
    for (const [userId, entry] of historyCache.entries()) {
        if ((now - entry.timestamp) > HISTORY_CACHE_TTL) {
            historyCache.delete(userId);
            historyExpired++;
        }
    }
    
    // Limpiar cache de contexto
    for (const [userId, entry] of contextInjectionCache.entries()) {
        if ((now - entry.timestamp) > CONTEXT_INJECTION_TTL) {
            contextInjectionCache.delete(userId);
            contextExpired++;
        }
    }

    // Limpiar cache de inyección
    for (const [cacheKey, entry] of injectionCache.entries()) {
        if ((now - entry.timestamp) > INJECTION_CACHE_TTL) {
            injectionCache.delete(cacheKey);
            // No incrementamos el contador de expirados aquí, ya que es un TTL de inyección, no de cache
        }
    }
    
    if (historyExpired > 0 || contextExpired > 0) {
        logInfo('CACHE_CLEANUP', 'Caches expirados limpiados', {
            historyExpired,
            contextExpired,
            remainingHistory: historyCache.size,
            remainingContext: contextInjectionCache.size
        });
    }
}

/**
 * 🔧 FUNCIÓN DE ESTADÍSTICAS: Obtener métricas de los caches
 */
export function getCacheStats() {
    return {
        historyCache: {
            size: historyCache.size,
            ttlMinutes: Math.round(HISTORY_CACHE_TTL / 1000 / 60)
        },
        contextCache: {
            size: contextInjectionCache.size,
            ttlMinutes: Math.round(CONTEXT_INJECTION_TTL / 1000 / 60)
        },
        injectionCache: {
            size: injectionCache.size,
            ttlMinutes: Math.round(INJECTION_CACHE_TTL / 1000 / 60)
        }
    };
} 