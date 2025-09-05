"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserManager = void 0;
const lru_cache_1 = require("lru-cache");
const logging_1 = require("../../utils/logging");
class UserManager {
    constructor(maxUsers = 1000, userTTL = 24 * 60 * 60 * 1000 /* 24 horas */) {
        this.activeProcessing = new Set();
        this.userStates = new lru_cache_1.LRUCache({
            max: maxUsers,
            ttl: userTTL,
        });
    }
    getOrCreateState(userId, chatId, userName) {
        let userState = this.userStates.get(userId);
        if (!userState) {
            userState = {
                userId,
                isTyping: false,
                isRecording: false,
                lastTypingTimestamp: 0,
                lastMessageTimestamp: 0,
                messages: [],
                chatId: chatId || `${userId}@s.whatsapp.net`,
                userName: userName || 'Usuario',
                typingEventsCount: 0,
                averageTypingDuration: 0,
                lastInputVoice: false,
                lastTyping: 0,
            };
            this.userStates.set(userId, userState);
        }
        return userState;
    }
    getState(userId) {
        return this.userStates.get(userId);
    }
    updateState(userId, updates) {
        const state = this.getOrCreateState(userId);
        const updatedState = { ...state, ...updates };
        this.userStates.set(userId, updatedState);
        return updatedState;
    }
    isProcessing(userId) {
        return this.activeProcessing.has(userId);
    }
    startProcessing(userId) {
        this.activeProcessing.add(userId);
    }
    endProcessing(userId) {
        this.activeProcessing.delete(userId);
    }
    // Método adicional para obtener o crear un usuario (simulación de base de datos)
    async getOrCreateUser(userId, userName) {
        // Por ahora, simplemente devuelve el estado del usuario
        // En una implementación real, esto interactuaría con la base de datos
        return this.getOrCreateState(userId, undefined, userName);
    }
    cleanup(maxAge = 15 * 60 * 1000) {
        // Para LRUCache, implementar cleanup manual si es necesario
        const now = Date.now();
        let cleaned = 0;
        const usersToDelete = [];
        // Iterar sobre todas las entradas para encontrar las expiradas
        this.userStates.forEach((state, userId) => {
            if (state.lastActivity && now - state.lastActivity > maxAge) {
                usersToDelete.push(userId);
            }
        });
        // Limpiar usuarios expirados con logs explícitos
        for (const userId of usersToDelete) {
            const state = this.userStates.get(userId);
            if (state) {
                // Log explícito del state que se va a limpiar
                (0, logging_1.logInfo)('STATE_CLEANED', 'Limpiando user state inactivo optimizado', {
                    userId,
                    age: now - (state.lastActivity || 0),
                    hadVoiceFlag: state.lastInputVoice || false,
                    hadTypingFlag: state.lastTyping > 0,
                    lastActivity: state.lastActivity ? new Date(state.lastActivity).toISOString() : 'unknown',
                    reason: 'expired_inactivity_optimized',
                    cleanupInterval: '10min_for_100plus_users'
                });
                // Reset explícito de flags antes de borrar con logging mejorado
                if (state.lastInputVoice) {
                    (0, logging_1.logInfo)('VOICE_FLAG_CLEANUP', 'Reset flag de voz en cleanup optimizado', {
                        userId,
                        reason: 'state_cleanup_memory_optimization',
                        previousVoiceState: true
                    }, 'user-state-manager.ts');
                }
                if (state.lastTyping > 0) {
                    (0, logging_1.logInfo)('TYPING_FLAG_CLEANUP', 'Reset flag de typing en cleanup optimizado', {
                        userId,
                        lastTyping: state.lastTyping,
                        reason: 'state_cleanup_memory_optimization',
                        previousTypingState: state.lastTyping
                    }, 'user-state-manager.ts');
                }
            }
            this.userStates.delete(userId);
            cleaned++;
        }
        // También limpiar activeProcessing de usuarios no existentes
        this.activeProcessing.forEach(userId => {
            if (!this.userStates.has(userId)) {
                this.activeProcessing.delete(userId);
            }
        });
        return cleaned;
    }
    getStats() {
        return {
            totalUsers: this.userStates.size,
            activeProcessing: this.activeProcessing.size,
            cacheSize: this.userStates.size
        };
    }
}
exports.UserManager = UserManager;
