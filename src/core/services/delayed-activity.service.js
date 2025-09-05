"use strict";
// src/core/services/delayed-activity.service.ts
// Servicio para manejar actualizaciones delayed de lastActivity + tokens
Object.defineProperty(exports, "__esModule", { value: true });
exports.DelayedActivityService = void 0;
const logging_1 = require("../../utils/logging");
class DelayedActivityService {
    constructor(databaseService) {
        this.databaseService = databaseService;
        this.pendingUpdates = new Map();
        this.DELAY_MS = 2 * 60 * 1000; // 2 minutos (reducido de 10)
    }
    /**
     * Programa una actualización delayed de lastActivity + tokens
     * Si ya hay una programada para el usuario, la cancela y crea una nueva
     */
    scheduleUpdate(userId, tokenCount, threadId) {
        // Cancelar timer anterior si existe
        this.cancelExistingUpdate(userId);
        // Crear nuevo timer
        const timer = setTimeout(async () => {
            await this.executeDelayedUpdate(userId);
        }, this.DELAY_MS);
        // Guardar en memoria
        this.pendingUpdates.set(userId, {
            userId,
            lastActivity: new Date(),
            tokenCount,
            threadId,
            timer
        });
        (0, logging_1.logInfo)('DELAYED_UPDATE_SCHEDULED', 'Update programado para 2min', {
            userId,
            tokenCount,
            delayMinutes: 2,
            totalPending: this.pendingUpdates.size
        }, 'delayed-activity.service.ts');
    }
    /**
     * Actualiza solo tokens sin cambiar el timer de lastActivity
     */
    updateTokenCount(userId, tokenCount, threadId) {
        const pending = this.pendingUpdates.get(userId);
        if (pending) {
            // Solo actualizar token count, mantener timer existente - ACUMULAR tokens
            pending.tokenCount = (pending.tokenCount || 0) + tokenCount;
            // Actualizar threadId si se proporciona
            if (threadId) {
                pending.threadId = threadId;
            }
            (0, logging_1.logInfo)('TOKEN_COUNT_UPDATED', 'Token count actualizado en memoria', {
                userId,
                tokenCount,
                timeRemaining: this.getTimeRemaining(userId)
            });
        }
        else {
            // No hay timer activo, crear uno nuevo
            this.scheduleUpdate(userId, tokenCount, threadId);
        }
    }
    /**
     * Ejecuta la actualización delayed (llamado por el timer)
     */
    async executeDelayedUpdate(userId) {
        const pending = this.pendingUpdates.get(userId);
        if (!pending) {
            (0, logging_1.logWarning)('DELAYED_UPDATE_NOT_FOUND', 'Update no encontrado al ejecutar', { userId }, 'delayed-activity.service.ts');
            return;
        }
        try {
            // Obtener tokens existentes de BD para acumular
            const existing = await this.databaseService.getThread(userId);
            const accumulatedTokens = (existing?.tokenCount || 0) + (pending.tokenCount || 0);
            (0, logging_1.logInfo)('TOKENS_SUMMED', 'Tokens acumulados', {
                userId,
                existing: existing?.tokenCount || 0,
                new: pending.tokenCount || 0,
                accumulated: accumulatedTokens
            }, 'delayed-activity.service.ts');
            // 1 SOLA LLAMADA A BD con tokens acumulados
            const success = await this.databaseService.updateThreadActivity(userId, accumulatedTokens, pending.threadId);
            if (success) {
                (0, logging_1.logSuccess)('DELAYED_UPDATE_EXECUTED', 'lastActivity + tokens actualizados', {
                    userId,
                    lastActivity: pending.lastActivity,
                    tokenCount: accumulatedTokens,
                    delayMinutes: 2
                }, 'delayed-activity.service.ts');
            }
            else {
                (0, logging_1.logWarning)('DELAYED_UPDATE_FAILED', 'Error en actualización delayed', { userId }, 'delayed-activity.service.ts');
            }
        }
        catch (error) {
            (0, logging_1.logWarning)('DELAYED_UPDATE_ERROR', 'Exception en actualización delayed', {
                userId,
                error: error instanceof Error ? error.message : String(error)
            });
        }
        finally {
            // Limpiar de memoria
            this.pendingUpdates.delete(userId);
        }
    }
    /**
     * Cancela un update pendiente si existe
     */
    cancelUpdate(userId) {
        return this.cancelExistingUpdate(userId);
    }
    /**
     * Cancela timer existente para un usuario
     */
    cancelExistingUpdate(userId) {
        const existing = this.pendingUpdates.get(userId);
        if (existing) {
            clearTimeout(existing.timer);
            this.pendingUpdates.delete(userId);
            (0, logging_1.logInfo)('DELAYED_UPDATE_CANCELLED', 'Timer anterior cancelado', {
                userId,
                wasScheduledFor: existing.lastActivity,
                tokenCount: existing.tokenCount
            }, 'delayed-activity.service.ts');
            return true;
        }
        return false;
    }
    /**
     * Obtiene el tiempo restante para un update (para debugging)
     */
    getTimeRemaining(userId) {
        const pending = this.pendingUpdates.get(userId);
        if (!pending)
            return 0;
        const elapsed = Date.now() - pending.lastActivity.getTime();
        return Math.max(0, this.DELAY_MS - elapsed);
    }
    /**
     * Obtiene estadísticas del servicio
     */
    getStats() {
        const users = Array.from(this.pendingUpdates.keys());
        const avgTimeRemaining = users.length > 0
            ? users.reduce((sum, userId) => sum + this.getTimeRemaining(userId), 0) / users.length
            : 0;
        return {
            pendingUpdates: this.pendingUpdates.size,
            users,
            avgTimeRemaining: Math.round(avgTimeRemaining / 1000) // en segundos
        };
    }
    /**
     * Ejecuta inmediatamente todos los updates pendientes (para testing/shutdown)
     */
    async flushAllUpdates() {
        const pending = Array.from(this.pendingUpdates.values());
        (0, logging_1.logInfo)('FLUSH_ALL_UPDATES', 'Ejecutando todos los updates pendientes', {
            count: pending.length
        }, 'delayed-activity.service.ts');
        for (const update of pending) {
            clearTimeout(update.timer);
            await this.executeDelayedUpdate(update.userId);
        }
    }
    /**
     * Limpieza al shutdown del servicio
     */
    shutdown() {
        (0, logging_1.logInfo)('DELAYED_ACTIVITY_SHUTDOWN', 'Limpiando timers pendientes', {
            pendingCount: this.pendingUpdates.size
        }, 'delayed-activity.service.ts');
        // Cancelar todos los timers
        for (const update of this.pendingUpdates.values()) {
            clearTimeout(update.timer);
        }
        this.pendingUpdates.clear();
    }
}
exports.DelayedActivityService = DelayedActivityService;
