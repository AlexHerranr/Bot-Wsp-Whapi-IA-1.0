// src/core/services/thread-persistence.service.ts
// Nuevo servicio que usa DatabaseService en lugar de threads.json

import 'reflect-metadata';
import { DatabaseService } from './database.service';
import { injectable } from 'tsyringe';
import { setCacheSize } from '../../utils/logging/collectors';

interface ThreadRecord {
    threadId: string;
    chatId: string;
    userName?: string;
    lastActivity: Date;
    labels?: string[];
}

@injectable()
export class ThreadPersistenceService {
    constructor(private databaseService: DatabaseService) {}

    // Migrar desde la interfaz antigua a la nueva
    async getThread(userId: string): Promise<ThreadRecord | null> {
        return await this.databaseService.getThread(userId);
    }

    async setThread(userId: string, threadId: string, chatId?: string, userName?: string): Promise<void> {
        // Siempre actualizar cache primero para asegurar disponibilidad
        try {
            const clientCache = this.databaseService.getClientCache();
            if (clientCache) {
                // Obtener datos existentes o crear nuevos
                const existingData = clientCache.get(userId) || {
                    phoneNumber: userId,
                    name: null,
                    userName: userName || null,
                    labels: null,
                    chatId: chatId || null,
                    lastActivity: new Date(),
                    cachedAt: new Date(),
                    threadTokenCount: 0
                };
                
                // Actualizar con thread nuevo
                existingData.threadId = threadId;
                existingData.chatId = chatId || existingData.chatId;
                existingData.userName = userName || existingData.userName;
                existingData.threadTokenCount = 0; // Reset para thread nuevo
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

        // Intentar BD - si falla, cache ya tiene datos actualizados
        try {
            await this.databaseService.saveOrUpdateThread(userId, {
                threadId,
                chatId,
                userName
            });
            
            // Reset token count para thread nuevo
            await this.databaseService.updateThreadTokenCount(userId, 0);
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
            const existing = await this.databaseService.getThread(userId);
            if (!existing) return false;

            await this.databaseService.saveOrUpdateThread(userId, {
                ...existing,
                ...updates,
                labels: updates.labels || existing.labels
            });

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