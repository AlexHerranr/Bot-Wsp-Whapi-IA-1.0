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
}