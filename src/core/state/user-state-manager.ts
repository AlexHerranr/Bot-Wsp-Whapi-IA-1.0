// src/core/state/user-state-manager.ts
import { UserState } from '../../shared/types';
import { LRUCache } from 'lru-cache';

export class UserManager {
    // Usamos un LRUCache para limitar la memoria y auto-limpiar usuarios inactivos.
    private userStates: LRUCache<string, UserState>;
    private activeProcessing: Set<string> = new Set();

    constructor(maxUsers: number = 1000, userTTL: number = 24 * 60 * 60 * 1000 /* 24 horas */) {
        this.userStates = new LRUCache({
            max: maxUsers,
            ttl: userTTL,
        });
    }

    public getOrCreateState(userId: string, chatId?: string, userName?: string): UserState {
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

    public getState(userId: string): UserState | undefined {
        return this.userStates.get(userId);
    }

    public updateState(userId: string, updates: Partial<UserState>): UserState {
        const state = this.getOrCreateState(userId);
        const updatedState = { ...state, ...updates };
        this.userStates.set(userId, updatedState);
        return updatedState;
    }

    public isProcessing(userId: string): boolean {
        return this.activeProcessing.has(userId);
    }

    public startProcessing(userId: string): void {
        this.activeProcessing.add(userId);
    }

    public endProcessing(userId: string): void {
        this.activeProcessing.delete(userId);
    }

    // Método adicional para obtener o crear un usuario (simulación de base de datos)
    public async getOrCreateUser(userId: string, userName?: string): Promise<UserState> {
        // Por ahora, simplemente devuelve el estado del usuario
        // En una implementación real, esto interactuaría con la base de datos
        return this.getOrCreateState(userId, undefined, userName);
    }

    public cleanup(maxAge: number = 15 * 60 * 1000): number {
        // Para LRUCache, implementar cleanup manual si es necesario
        const now = Date.now();
        let cleaned = 0;
        const usersToDelete: string[] = [];

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
                // Usar sistema de logging del bot para consistencia
                const { logInfo } = require('../../utils/logging');
                
                // Log explícito del state que se va a limpiar
                logInfo('STATE_CLEANED', 'Limpiando user state inactivo optimizado', {
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
                    logInfo('VOICE_FLAG_CLEANUP', 'Reset flag de voz en cleanup optimizado', {
                        userId,
                        reason: 'state_cleanup_memory_optimization',
                        previousVoiceState: true
                    });
                }
                
                if (state.lastTyping > 0) {
                    logInfo('TYPING_FLAG_CLEANUP', 'Reset flag de typing en cleanup optimizado', {
                        userId,
                        lastTyping: state.lastTyping,
                        reason: 'state_cleanup_memory_optimization',
                        previousTypingState: state.lastTyping
                    });
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

    public getStats(): { totalUsers: number; activeProcessing: number; cacheSize: number } {
        return {
            totalUsers: this.userStates.size,
            activeProcessing: this.activeProcessing.size,
            cacheSize: this.userStates.size
        };
    }
}