/**
 * SimpleLockManager - Sistema híbrido que combina simplicidad y robustez
 * - Locks por usuario (no por mensaje)
 * - Timeout automático de 15 segundos
 * - Sistema de colas para procesamiento ordenado
 * - Liberación automática al terminar
 */

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
            console.log(`🔒 Usuario ${userId} ya está siendo procesado`);
            return false;
        }
        
        // Adquirir el lock
        this.userLocks.set(userId, { 
            timestamp: now, 
            timeout: this.LOCK_TIMEOUT 
        });
        
        console.log(`🔒 Lock adquirido para usuario ${userId}`);
        return true;
    }

    /**
     * Libera el lock de un usuario
     * @param userId - ID del usuario
     */
    releaseUserLock(userId: string): void {
        if (this.userLocks.has(userId)) {
            this.userLocks.delete(userId);
            console.log(`🔓 Lock liberado para usuario ${userId}`);
        } else {
            // 🔧 MEJORADO: Solo log de debug para evitar warnings innecesarios
            console.log(`🔍 Lock ya liberado para usuario ${userId} (no es un error)`);
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
        
        console.log(`📋 Mensaje ${messageId} agregado a cola de usuario ${userId} (${queue.length} en cola)`);
    }

    /**
     * Procesa la cola de mensajes de un usuario
     * @param userId - ID del usuario
     */
    async processQueue(userId: string): Promise<void> {
        const queue = this.userQueues.get(userId);
        if (!queue || queue.length === 0) {
            console.log(`📋 No hay mensajes en cola para usuario ${userId}`);
            return;
        }

        console.log(`🔄 Procesando cola de usuario ${userId} (${queue.length} mensajes)`);
        
        while (queue.length > 0) {
            const item = queue.shift()!;
            
            try {
                console.log(`📝 Procesando mensaje ${item.messageId} de usuario ${userId}`);
                await item.processFunction();
                console.log(`✅ Mensaje ${item.messageId} procesado exitosamente`);
            } catch (error) {
                console.error(`❌ Error procesando mensaje ${item.messageId}:`, error);
            } finally {
                // Liberar el lock al terminar cada mensaje
                this.releaseUserLock(userId);
            }
        }
        
        // Limpiar la cola
        this.userQueues.delete(userId);
        console.log(`🧹 Cola de usuario ${userId} limpiada`);
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
            return false;
        }
        
        return true;
    }

    /**
     * Obtiene estadísticas del sistema de locks
     */
    getStats(): { activeLocks: number; activeQueues: number } {
        return {
            activeLocks: this.userLocks.size,
            activeQueues: this.userQueues.size
        };
    }

    /**
     * Limpia todos los locks y colas (útil para debugging)
     */
    clearAll(): void {
        this.userLocks.clear();
        this.userQueues.clear();
        console.log(`🧹 Todos los locks y colas limpiados`);
    }
}

// Instancia global del lock manager
export const simpleLockManager = new SimpleLockManager(); 