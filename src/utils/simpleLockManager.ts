/**
 * SimpleLockManager - Sistema híbrido que combina simplicidad y robustez
 * - Locks por usuario (no por mensaje)
 * - Timeout automático de 15 segundos
 * - Sistema de colas para procesamiento ordenado
 * - Liberación automática al terminar
 */

import { 
    logInfo, 
    logSuccess, 
    logWarning, 
    logError, 
    logDebug,
    logTrace,
    logAlert
} from './logging/index.js';

interface LockInfo {
    timestamp: number;
    timeout: number;
}

interface QueueItem {
    messageId: string;
    messageData: any;
    processFunction: () => Promise<void>;
}

export class SimpleLockManager {
    private userLocks = new Map<string, LockInfo>();
    private userQueues = new Map<string, QueueItem[]>();
    private readonly LOCK_TIMEOUT = 15 * 1000; // 15 segundos

    /**
     * Intenta adquirir un lock para un usuario
     * @param userId - ID del usuario
     * @returns true si se adquirió el lock, false si ya está bloqueado
     */
    async acquireUserLock(userId: string): Promise<boolean> {
        const now = Date.now();
        const existingLock = this.userLocks.get(userId);
        
        // Si existe un lock y no ha expirado, no se puede adquirir
        if (existingLock && (now - existingLock.timestamp) < existingLock.timeout) {
            const lockAge = now - existingLock.timestamp;
            logWarning('LOCK_ACQUISITION_FAILED', 'Usuario ya está siendo procesado', {
                userId,
                lockAge: `${lockAge}ms`,
                remainingTimeout: `${existingLock.timeout - lockAge}ms`,
                activeLocks: this.userLocks.size,
                activeQueues: this.userQueues.size
            });
            return false;
        }
        
        // Adquirir el lock
        this.userLocks.set(userId, { 
            timestamp: now, 
            timeout: this.LOCK_TIMEOUT 
        });
        
        logSuccess('LOCK_ACQUIRED', 'Lock adquirido para usuario', {
            userId,
            timestamp: new Date(now).toISOString(),
            timeout: `${this.LOCK_TIMEOUT}ms`,
            activeLocks: this.userLocks.size
        });
        
        return true;
    }

    /**
     * Libera el lock de un usuario
     * @param userId - ID del usuario
     */
    releaseUserLock(userId: string): void {
        const lock = this.userLocks.get(userId);
        if (lock) {
            const lockDuration = Date.now() - lock.timestamp;
            this.userLocks.delete(userId);
            
            logSuccess('LOCK_RELEASED', 'Lock liberado para usuario', {
                userId,
                lockDuration: `${lockDuration}ms`,
                wasExpired: lockDuration >= this.LOCK_TIMEOUT,
                activeLocks: this.userLocks.size
            });
        } else {
            logDebug('LOCK_ALREADY_RELEASED', 'Lock ya liberado para usuario', {
                userId,
                activeLocks: this.userLocks.size
            });
        }
    }

    /**
     * Agrega un mensaje a la cola de un usuario
     * @param userId - ID del usuario
     * @param messageId - ID del mensaje
     * @param messageData - Datos del mensaje
     * @param processFunction - Función para procesar el mensaje
     */
    addToQueue(userId: string, messageId: string, messageData: any, processFunction: () => Promise<void>): void {
        if (!this.userQueues.has(userId)) {
            this.userQueues.set(userId, []);
        }
        
        const queue = this.userQueues.get(userId)!;
        queue.push({
            messageId,
            messageData,
            processFunction
        });
        
        logInfo('QUEUE_ITEM_ADDED', 'Mensaje agregado a cola de usuario', {
            userId,
            messageId,
            queueLength: queue.length,
            totalQueues: this.userQueues.size,
            hasActiveLock: this.hasActiveLock(userId)
        });
    }

    /**
     * Procesa la cola de mensajes de un usuario
     * @param userId - ID del usuario
     */
    async processQueue(userId: string): Promise<void> {
        const queue = this.userQueues.get(userId);
        if (!queue || queue.length === 0) {
            logDebug('QUEUE_EMPTY', 'No hay mensajes en cola para usuario', {
                userId,
                totalQueues: this.userQueues.size
            });
            return;
        }

        const startTime = Date.now();
        const initialQueueLength = queue.length;
        
        logInfo('QUEUE_PROCESSING_START', 'Procesando cola de usuario', {
            userId,
            queueLength: initialQueueLength,
            hasActiveLock: this.hasActiveLock(userId)
        });
        
        let processedCount = 0;
        let errorCount = 0;
        
        while (queue.length > 0) {
            const item = queue.shift()!;
            
            try {
                logTrace('QUEUE_ITEM_PROCESSING', 'Procesando mensaje de cola', {
                    userId,
                    messageId: item.messageId,
                    remainingInQueue: queue.length
                });
                
                await item.processFunction();
                processedCount++;
                
                logSuccess('QUEUE_ITEM_SUCCESS', 'Mensaje procesado exitosamente', {
                    userId,
                    messageId: item.messageId,
                    processedCount,
                    remainingInQueue: queue.length
                });
            } catch (error) {
                errorCount++;
                logError('QUEUE_ITEM_ERROR', 'Error procesando mensaje de cola', {
                    userId,
                    messageId: item.messageId,
                    error: error instanceof Error ? error.message : String(error),
                    processedCount,
                    errorCount,
                    remainingInQueue: queue.length
                });
            } finally {
                // Liberar el lock al terminar cada mensaje
                this.releaseUserLock(userId);
            }
        }
        
        const processingDuration = Date.now() - startTime;
        
        // Limpiar la cola
        this.userQueues.delete(userId);
        
        logSuccess('QUEUE_PROCESSING_COMPLETE', 'Cola de usuario procesada completamente', {
            userId,
            initialQueueLength,
            processedCount,
            errorCount,
            processingDuration: `${processingDuration}ms`,
            averageTimePerMessage: `${Math.round(processingDuration / initialQueueLength)}ms`,
            remainingQueues: this.userQueues.size
        });
    }

    /**
     * Verifica si un usuario tiene un lock activo
     * @param userId - ID del usuario
     * @returns true si tiene lock activo
     */
    hasActiveLock(userId: string): boolean {
        const lock = this.userLocks.get(userId);
        if (!lock) return false;
        
        const now = Date.now();
        const isExpired = (now - lock.timestamp) >= lock.timeout;
        
        if (isExpired) {
            // Limpiar lock expirado
            this.userLocks.delete(userId);
            
            logWarning('LOCK_EXPIRED', 'Lock expirado para usuario', {
                userId,
                lockDuration: `${now - lock.timestamp}ms`,
                timeout: `${this.LOCK_TIMEOUT}ms`,
                activeLocks: this.userLocks.size
            });
            
            return false;
        }
        
        return true;
    }

    /**
     * Obtiene estadísticas del sistema de locks
     */
    getStats(): { activeLocks: number; activeQueues: number } {
        const stats = {
            activeLocks: this.userLocks.size,
            activeQueues: this.userQueues.size
        };
        
        logDebug('LOCK_STATS', 'Estadísticas del sistema de locks', {
            ...stats,
            totalUsers: stats.activeLocks + stats.activeQueues
        });
        
        return stats;
    }

    /**
     * Limpia todos los locks y colas (útil para debugging)
     */
    clearAll(): void {
        const locksCount = this.userLocks.size;
        const queuesCount = this.userQueues.size;
        
        this.userLocks.clear();
        this.userQueues.clear();
        
        logInfo('LOCK_SYSTEM_CLEARED', 'Todos los locks y colas limpiados', {
            locksCleared: locksCount,
            queuesCleared: queuesCount,
            reason: 'manual_clear'
        });
    }

    /**
     * Detecta posibles deadlocks o situaciones problemáticas
     */
    detectIssues(): void {
        const now = Date.now();
        let expiredLocks = 0;
        let longQueues = 0;
        
        // Verificar locks expirados
        for (const [userId, lock] of this.userLocks.entries()) {
            if ((now - lock.timestamp) >= this.LOCK_TIMEOUT) {
                expiredLocks++;
            }
        }
        
        // Verificar colas largas
        for (const [userId, queue] of this.userQueues.entries()) {
            if (queue.length > 5) {
                longQueues++;
                logAlert('LONG_QUEUE_DETECTED', 'Cola muy larga detectada', {
                    userId,
                    queueLength: queue.length,
                    threshold: 5
                });
            }
        }
        
        if (expiredLocks > 0) {
            logAlert('EXPIRED_LOCKS_DETECTED', 'Locks expirados detectados', {
                expiredLocks,
                totalLocks: this.userLocks.size
            });
        }
        
        if (longQueues > 0) {
            logAlert('MULTIPLE_LONG_QUEUES', 'Múltiples colas largas detectadas', {
                longQueues,
                totalQueues: this.userQueues.size
            });
        }
    }
}

// Instancia global del lock manager
export const simpleLockManager = new SimpleLockManager(); 