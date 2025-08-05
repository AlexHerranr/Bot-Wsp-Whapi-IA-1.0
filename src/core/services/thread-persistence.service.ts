// src/core/services/thread-persistence.service.ts
// Nuevo servicio que usa DatabaseService en lugar de threads.json

import 'reflect-metadata';
import { DatabaseService } from './database.service';
import { injectable } from 'tsyringe';

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
        await this.databaseService.saveOrUpdateThread(userId, {
            threadId,
            chatId,
            userName
        });
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

    async shouldRenewThread(userId: string, currentTokens?: number): Promise<{ shouldRenew: boolean; reason?: string }> {
        try {
            const thread = await this.getThread(userId);
            if (!thread) {
                return { shouldRenew: true, reason: 'no_thread_found' };
            }

            // 1. Verificar renovación semanal (7 días)
            const THREAD_MAX_AGE_DAYS = parseInt(process.env.THREAD_MAX_AGE_DAYS || '7');
            const maxAgeDate = new Date();
            maxAgeDate.setDate(maxAgeDate.getDate() - THREAD_MAX_AGE_DAYS);
            
            if (thread.lastActivity < maxAgeDate) {
                return { 
                    shouldRenew: true, 
                    reason: 'thread_weekly_renewal',
                };
            }

            // 2. Verificar límite de tokens (20k tokens recomendado para hotel)
            const TOKEN_LIMIT = parseInt(process.env.THREAD_TOKEN_LIMIT || '20000');
            if (currentTokens && currentTokens > TOKEN_LIMIT) {
                return {
                    shouldRenew: true,
                    reason: 'token_limit_exceeded'
                };
            }

            return { shouldRenew: false };
        } catch (error) {
            console.error(`Error checking thread renewal for ${userId}:`, error);
            return { shouldRenew: false }; // En caso de error, mantener thread existente
        }
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
        console.log(`Cleanup de threads > ${months} meses solicitado`);
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