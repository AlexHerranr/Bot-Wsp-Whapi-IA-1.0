// src/core/services/thread-persistence.service.ts
// Nuevo servicio que usa DatabaseService en lugar de threads.json

import 'reflect-metadata';
import { DatabaseService } from './database.service';
import { injectable } from 'tsyringe';
import { setCacheSize, trackCache } from '../../utils/logging/collectors';

interface ThreadRecord {
    threadId: string;
    chatId: string;
    userName?: string;
    lastActivity: Date;
    labels?: string[];
    tokenCount?: number;
}

@injectable()
export class ThreadPersistenceService {
    constructor(private databaseService: DatabaseService) {}

    // Cache-first strategy: Cache → BD → null
    async getThread(userId: string): Promise<ThreadRecord | null> {
        // 1. Verificar CACHE primero
        try {
            const clientCache = this.databaseService.getClientCache();
            if (clientCache) {
                const cachedData = clientCache.get(userId);
                console.info(`CACHE_GET: key=${userId}, found=${!!cachedData}, size=${clientCache.getStats().size}`);
                if (cachedData) {
                    console.info(`Cache HIT for thread: ${userId}`);
                    console.info(`CACHE_DEBUG: threadId=${cachedData.threadId}, tokenCount=${cachedData.threadTokenCount}, cachedAt=${cachedData.cachedAt}`);
                    trackCache(true); // Track cache hit
                    
                    // Si cache tiene threadId válido, usarlo directamente
                    if (cachedData.threadId) {
                        // Cache HIT con thread válido - convertir a ThreadRecord
                        return {
                            threadId: cachedData.threadId,
                            chatId: cachedData.chatId || '',
                            userName: cachedData.userName,
                            lastActivity: cachedData.lastActivity,
                            labels: Array.isArray(cachedData.labels) ? cachedData.labels : (cachedData.labels ? (cachedData.labels as string).split('/') : []),
                            tokenCount: cachedData.threadTokenCount || 0
                        };
                    } else {
                        // Cache HIT pero sin threadId - ir a BD como fallback
                        console.info(`Cache HIT but no threadId - checking BD as fallback: ${userId}`);
                        // Continuar al bloque BD (no return aquí)
                    }
                }
            }
        } catch (error) {
            console.warn('Cache read failed, falling back to BD:', error);
        }

        // 2. Cache MISS - ir a BD
        try {
            const threadFromBD = await this.databaseService.getThread(userId);
            
            // Si encontramos en BD, actualizar cache
            if (threadFromBD) {
                console.info(`BD HIT (cache miss) for thread: ${userId}, syncing cache`);
                console.info(`[THREAD_SOURCE:cache] ${userId}: bd:${threadFromBD.tokenCount || 0} cache:0 thread:${threadFromBD.threadId} src:bd_fallback`);
                try {
                    const clientCache = this.databaseService.getClientCache();
                    if (clientCache) {
                        const cacheData = {
                            phoneNumber: userId,
                            name: null,
                            userName: threadFromBD.userName || null,
                            labels: threadFromBD.labels || [],
                            chatId: threadFromBD.chatId || null,
                            threadId: threadFromBD.threadId,
                            lastActivity: threadFromBD.lastActivity,
                            cachedAt: new Date(),
                            threadTokenCount: threadFromBD.tokenCount || 0
                        };
                        clientCache.set(userId, cacheData);
                        setCacheSize(clientCache.getStats().size);
                        console.info(`CACHE_SET: stored for ${userId}, size: ${clientCache.getStats().size}`);
                        console.info(`CACHE_SET_DEBUG: threadId=${cacheData.threadId}, tokenCount=${cacheData.threadTokenCount}`);
                    }
                } catch (error) {
                    console.warn('Cache update from BD failed:', error);
                }
            }
            
            return threadFromBD;
            
        } catch (error) {
            console.warn('BD read failed:', error);
            return null; // No thread found - caller will create new
        }
    }

    async setThread(userId: string, threadId: string, chatId?: string, userName?: string): Promise<void> {
        // CONFIGURACIÓN PROVISIONAL - NO GUARDAR THREAD EN BD PARA 3003913251
        const skipDbUpdate = userId === '3003913251';
        if (skipDbUpdate) {
            console.info('⚠️ PROVISIONAL: Omitiendo guardado de thread en BD para 3003913251');
        }
        
        // Siempre actualizar cache primero para asegurar disponibilidad
        try {
            const clientCache = this.databaseService.getClientCache();
            if (clientCache) {
                // Obtener datos existentes o crear nuevos
                const existingData = clientCache.get(userId) || {
                    phoneNumber: userId,
                    name: null,
                    userName: userName || null,
                    labels: [],
                    chatId: chatId || null,
                    threadId: undefined,
                    lastActivity: new Date(),
                    cachedAt: new Date(),
                    threadTokenCount: 0
                };
                
                // Verificar si es thread realmente nuevo
                const isNewThread = !existingData.threadId || existingData.threadId !== threadId;
                
                // Actualizar datos preservando existentes cuando corresponde
                existingData.threadId = threadId;
                existingData.chatId = chatId || existingData.chatId;
                existingData.userName = userName || existingData.userName;
                
                // Solo resetear tokens si es thread realmente nuevo
                if (isNewThread) {
                    existingData.threadTokenCount = 0;
                    console.info(`New thread created for ${userId}: ${threadId}, resetting tokenCount`);
                } else {
                    console.info(`Updating metadata for existing thread ${userId}: ${threadId}, preserving tokenCount: ${existingData.threadTokenCount || 0}`);
                }
                
                existingData.lastActivity = new Date();
                existingData.cachedAt = new Date();
                
                clientCache.set(userId, existingData);
                // Actualizar métricas de cache
                setCacheSize(clientCache.getStats().size);
            }
        } catch (error) {
            // Cache update no debe interrumpir el flujo
            console.warn('Cache update failed, continuing with BD operations:', error);
        }

        // Intentar BD - si falla, cache ya tiene datos actualizados (SKIP PARA 3003913251)
        if (!skipDbUpdate) {
            try {
                await this.databaseService.saveOrUpdateThread(userId, {
                    threadId,
                    chatId,
                    userName
                });
                
                // Solo resetear tokens en BD si es thread nuevo (consistente con cache)
                const clientCache = this.databaseService.getClientCache();
                const cachedData = clientCache?.get(userId);
                const isNewThread = !cachedData?.threadId || cachedData.threadId !== threadId || cachedData.threadTokenCount === 0;
                
                if (isNewThread) {
                    await this.databaseService.updateThreadTokenCount(userId, 0);
                    console.info(`BD: Reset token count for new thread ${userId}: ${threadId}`);
                } else {
                    console.info(`BD: Preserving token count for existing thread ${userId}: ${threadId}`);
                }
            } catch (error) {
                console.error('Failed to update BD:', error);
                // No throw - cache ya actualizado
            }
        } else {
            console.info(`⚠️ BD UPDATE SKIPPED (PROVISIONAL) for ${userId}: thread=${threadId}`);
            // Cache se actualiza normal, solo se omite BD
        } catch (error) {
            // BD failure no debe interrumpir - cache tiene los datos
            console.warn('BD update failed, but cache is updated:', error);
        }
    }

    async updateThreadMetadata(userId: string, updates: {
        name?: string;
        labels?: string[];
        userName?: string;
        chatId?: string;
    }): Promise<boolean> {
        try {
            // Cache-first: Actualizar cache primero
            const clientCache = this.databaseService.getClientCache();
            if (clientCache) {
                const cachedData = clientCache.get(userId);
                if (cachedData) {
                    // Preservar threadId y tokenCount, solo actualizar metadata
                    if (updates.name !== undefined) cachedData.name = updates.name;
                    if (updates.userName !== undefined) cachedData.userName = updates.userName;
                    if (updates.chatId !== undefined) cachedData.chatId = updates.chatId;
                    if (updates.labels !== undefined) cachedData.labels = updates.labels;
                    
                    cachedData.cachedAt = new Date();
                    clientCache.set(userId, cachedData);
                    setCacheSize(clientCache.getStats().size);
                    
                    console.info(`Cache: Updated metadata for ${userId}, preserving threadId: ${cachedData.threadId}, tokenCount: ${cachedData.threadTokenCount || 0}`);
                }
            }

            // BD update (fallback resiliente)
            const existing = await this.databaseService.getThread(userId);
            if (!existing) return false;

            await this.databaseService.saveOrUpdateThread(userId, {
                ...existing,
                ...updates,
                labels: updates.labels || existing.labels
            });

            console.info(`BD: Updated metadata for ${userId}, preserved threadId: ${existing.threadId}`);
            return true;
        } catch (error) {
            console.error(`Error updating thread metadata for ${userId}:`, error);
            return false;
        }
    }

    async updateThreadLabels(userId: string, labels: string[]): Promise<boolean> {
        return await this.updateThreadMetadata(userId, { labels });
    }

    async updateThreadActivity(userId: string, tokenCount?: number): Promise<boolean> {
        const existing = await this.databaseService.getThread(userId);
        if (existing) {
            const now = new Date();
            const timeSinceLastUpdate = now.getTime() - existing.lastActivity.getTime();
            
            // Only update if more than 10 minutes have passed since last activity update
            if (timeSinceLastUpdate < 10 * 60 * 1000) {
                return true; // Skip update - too recent
            }
        }
        return await this.databaseService.updateThreadActivity(userId, tokenCount);
    }

    // MÉTODO DESHABILITADO - Lógica simplificada: solo reutilizar si existe y es válido
    async shouldRenewThread(userId: string, currentTokens?: number): Promise<{ shouldRenew: boolean; reason?: string }> {
        // Siempre retornar false - no renovar automáticamente
        // La validación se hace en OpenAI Service directamente
        return { shouldRenew: false, reason: 'simplified_logic_no_auto_renewal' };
    }

    getAllUserIds(): Promise<string[]> {
        // Implementación simplificada - obtener desde estadísticas
        // En producción podrías necesitar una consulta específica
        return Promise.resolve([]);
    }

    getStats(): Promise<{ totalThreads: number; activeThreads: number }> {
        return this.databaseService.getStats().then(stats => ({
            totalThreads: stats.threads,
            activeThreads: stats.threads // Simplificado
        }));
    }

    getThreadInfo(userId: string): Promise<any> {
        return this.databaseService.getThread(userId);
    }

    isThreadOld(userId: string, months?: number): Promise<boolean> {
        // Lógica simplificada - verifica si el thread es más viejo que X meses
        return this.databaseService.getThread(userId).then(thread => {
            if (!thread) return true;
            
            const monthsOld = months || 3;
            const threshold = new Date();
            threshold.setMonth(threshold.getMonth() - monthsOld);
            
            return thread.lastActivity < threshold;
        });
    }

    async removeThread(userId: string, reason?: string): Promise<boolean> {
        try {
            // Eliminar thread de la base de datos
            await this.databaseService.deleteThread(userId);
            console.log(`Thread removed for ${userId}: ${reason}`);
            return true;
        } catch (error) {
            console.error(`Error removing thread for ${userId}:`, error);
            return false;
        }
    }

    clearAllThreads(): Promise<void> {
        console.warn('clearAllThreads() no implementado por seguridad');
        return Promise.resolve();
    }

    cleanupOldThreads(months: number): Promise<number> {
        console.log(`Cleanup de threads > ${months} meses DESHABILITADO - lógica simplificada`);
        return Promise.resolve(0);
    }

    // Métodos de compatibilidad que no hacen nada (la DB ya se guarda automáticamente)
    saveThreads(): void {
        // No-op: La base de datos se guarda automáticamente
    }

    initializeCleanup(): void {
        console.log('Cleanup inicializado (usando DatabaseService)');
    }
}