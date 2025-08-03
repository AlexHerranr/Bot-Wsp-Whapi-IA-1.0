// --- Sistema Híbrido de Estados de Usuario ---
import { logDebug, logInfo, logWarning } from './logging/index';
import { isLikelyFinalMessage, getRecommendedTimeout } from './messageBuffering.js';

export interface UserState {
    userId: string;
    isTyping: boolean;
    lastTypingTimestamp: number;
    lastMessageTimestamp: number;
    messages: string[];
    chatId: string;
    userName: string;
    bufferTimeout?: NodeJS.Timeout;
    typingTimeout?: NodeJS.Timeout;
    // Métricas para análisis
    typingEventsCount: number;
    averageTypingDuration: number;
    // NUEVO: Campos para funcionalidades media
    lastInputVoice?: boolean;
    quotedMessagesCount?: number;
    // 🔧 NUEVO: Timestamp del último typing detectado
    lastTyping?: number;
    // 🔧 NUEVO: Estado de grabación actual para buffer inteligente
    isCurrentlyRecording?: boolean;
}

export class UserStateManager {
    private states = new Map<string, UserState>();
    
    // Configuración de timeouts
    private readonly TYPING_TIMEOUT = 3000;      // 3s sin typing = dejó de escribir
    private readonly TYPING_EXTENSION = 2000;    // Extender 2s más si está typing
    private readonly MIN_PROCESS_DELAY = 800;    // Mínimo 0.8s antes de procesar
    private readonly MAX_BUFFER_TIME = 10000;    // Máximo 10s de espera
    
    // Callbacks
    private onMessagesReady?: (userId: string, messages: string[], state: UserState) => void;
    
    constructor(onMessagesReady?: (userId: string, messages: string[], state: UserState) => void) {
        this.onMessagesReady = onMessagesReady;
    }
    
    // Obtener o crear estado de usuario
    getOrCreateState(userId: string, chatId?: string, userName?: string): UserState {
        if (!this.states.has(userId)) {
            this.states.set(userId, {
                userId,
                isTyping: false,
                lastTypingTimestamp: 0,
                lastMessageTimestamp: 0,
                messages: [],
                chatId: chatId || `${userId}@s.whatsapp.net`,
                userName: userName || 'Usuario',
                typingEventsCount: 0,
                averageTypingDuration: 0
            });
        }
        
        const state = this.states.get(userId)!;
        if (chatId) state.chatId = chatId;
        if (userName) state.userName = userName;
        
        return state;
    }
    
    // Manejar evento de typing/presence
    handleTypingEvent(userId: string, isTyping: boolean, timestamp?: number): void {
        const state = this.getOrCreateState(userId);
        const now = timestamp || Date.now();
        
        if (isTyping && !state.isTyping) {
            // Comenzó a escribir
            state.isTyping = true;
            state.lastTypingTimestamp = now;
            state.typingEventsCount++;
            
            logInfo('TYPING_START', `${state.userName} comenzó a escribir`, {
                userId,
                messagesInBuffer: state.messages.length
            });
            
            // Extender timeout si hay mensajes en buffer - DESACTIVADO
            // if (state.messages.length > 0 && state.bufferTimeout) {
            //     this.extendBufferTimeout(state);
            // }
            
        } else if (!isTyping && state.isTyping) {
            // Dejó de escribir
            const typingDuration = now - state.lastTypingTimestamp;
            state.isTyping = false;
            
            // Actualizar estadísticas
            state.averageTypingDuration = state.averageTypingDuration > 0
                ? (state.averageTypingDuration + typingDuration) / 2
                : typingDuration;
            
            logInfo('TYPING_STOP', `${state.userName} dejó de escribir`, {
                userId,
                duration: typingDuration,
                messagesInBuffer: state.messages.length
            });
            
            // Si hay mensajes, procesarlos pronto
            if (state.messages.length > 0) {
                this.scheduleProcessing(state, this.MIN_PROCESS_DELAY);
            }
        }
        
        // Resetear timeout de typing
        if (state.typingTimeout) {
            clearTimeout(state.typingTimeout);
        }
        
        if (isTyping) {
            // Auto-stop typing después del timeout
            state.typingTimeout = setTimeout(() => {
                this.handleTypingEvent(userId, false);
            }, this.TYPING_TIMEOUT);
        }
    }
    
    // Agregar mensaje al buffer
    addMessage(userId: string, message: string, chatId?: string, userName?: string): void {
        const state = this.getOrCreateState(userId, chatId, userName);
        const now = Date.now();
        
        // DESACTIVADO - buffer-manager.ts maneja todos los mensajes
        // state.messages.push(message);
        state.lastMessageTimestamp = now;
        
        logInfo('MESSAGE_STATE_ONLY', `Estado actualizado (mensaje manejado por buffer-manager.ts)`, {
            userId,
            userName: state.userName,
            isTyping: state.isTyping,
            messagePreview: message.substring(0, 30),
            reason: 'userstate_only_no_buffer'
        });
        
        // Cálculo de timeout DESACTIVADO - buffer-manager.ts maneja timeouts
        // const baseTimeout = getRecommendedTimeout(state.messages, message);
        // let finalTimeout = baseTimeout;
        
        // if (state.isTyping) {
        //     // Si está escribiendo, dar más tiempo
        //     finalTimeout = Math.max(baseTimeout, this.TYPING_EXTENSION);
        //     logDebug('TIMEOUT_EXTENDED', `Timeout extendido por typing`, {
        //         base: baseTimeout,
        //         extended: finalTimeout
        //     });
        // } else if (isLikelyFinalMessage(message)) {
        //     // Si parece mensaje final, procesar rápido
        //     finalTimeout = this.MIN_PROCESS_DELAY;
        //     logDebug('FINAL_MESSAGE', `Mensaje final detectado, procesamiento rápido`, {
        //         message,
        //         timeout: finalTimeout
        //     });
        // }
        
        logInfo('TIMEOUT_DELEGATED', 'Cálculo de timeout delegado a buffer-manager.ts', {
            userId,
            userName: state.userName,
            reason: 'timeout_calculation_disabled'
        });
        
        // Programar procesamiento - DESACTIVADO (manejado por buffer-manager.ts)
        // this.scheduleProcessing(state, finalTimeout);
        
        // Buffer timeout DESACTIVADO - manejado por buffer-manager.ts
        // Timeout de seguridad
        // if (!state.bufferTimeout) {
        //     state.bufferTimeout = setTimeout(() => {
        //         logWarning('MAX_TIMEOUT', `Timeout máximo alcanzado para ${state.userName}`);
        //         this.processMessages(userId);
        //     }, this.MAX_BUFFER_TIME);
        // }
    }
    
    // Programar procesamiento de mensajes - DESACTIVADO
    private scheduleProcessing(state: UserState, delay: number): void {
        // DESACTIVADO - el buffer-manager.ts maneja todo el procesamiento
        // Cancelar procesamiento anterior si existe
        // if (state.bufferTimeout) {
        //     clearTimeout(state.bufferTimeout);
        // }
        
        // state.bufferTimeout = setTimeout(() => {
        //     if (!state.isTyping || Date.now() - state.lastTypingTimestamp > this.TYPING_TIMEOUT) {
        //         this.processMessages(state.userId);
        //     } else {
        //         // Si sigue escribiendo, esperar un poco más
        //         this.scheduleProcessing(state, this.TYPING_EXTENSION);
        //     }
        // }, delay);
        
        logInfo('BUFFER_DISABLED', 'Procesamiento delegado a buffer-manager.ts', {
            userId: state.userId,
            userName: state.userName,
            requestedDelay: delay,
            reason: 'legacy_system_disabled'
        });
    }
    
    // Extender timeout del buffer - DESACTIVADO
    private extendBufferTimeout(state: UserState): void {
        // DESACTIVADO - el buffer-manager.ts maneja toda la extensión
        // if (state.bufferTimeout) {
        //     clearTimeout(state.bufferTimeout);
        //     this.scheduleProcessing(state, this.TYPING_EXTENSION);
        //     
        //     logDebug('BUFFER_EXTENDED', `Buffer extendido por typing`, {
        //         userId: state.userId,
        //         extension: this.TYPING_EXTENSION
        //     });
        // }
        logInfo('BUFFER_EXTEND_DISABLED', 'Extensión de buffer delegada a buffer-manager.ts', {
            userId: state.userId,
            userName: state.userName,
            reason: 'legacy_extension_disabled'
        });
    }
    
    // Procesar mensajes acumulados - DESACTIVADO
    processMessages(userId: string): void {
        // DESACTIVADO - buffer-manager.ts maneja todo el procesamiento de mensajes
        logInfo('PROCESS_MESSAGES_DISABLED', 'Procesamiento de mensajes delegado a buffer-manager.ts', {
            userId,
            reason: 'legacy_processing_disabled'
        });
        return; // Salir temprano - no procesar nada
        
        const state = this.states.get(userId);
        if (!state || state.messages.length === 0) return;
        
        // Limpiar timeouts
        if (state.bufferTimeout) {
            clearTimeout(state.bufferTimeout);
            state.bufferTimeout = undefined;
        }
        
        if (state.typingTimeout) {
            clearTimeout(state.typingTimeout);
            state.typingTimeout = undefined;
        }
        
        // Copiar mensajes y limpiar buffer
        const messages = [...state.messages];
        state.messages = [];
        state.isTyping = false;
        
        logInfo('MESSAGES_READY', `Procesando ${messages.length} mensajes de ${state.userName}`, {
            userId,
            totalLength: messages.join(' ').length,
            hadTypingEvents: state.typingEventsCount > 0,
            averageTypingDuration: Math.round(state.averageTypingDuration)
        });
        
        // Callback para procesar mensajes
        if (this.onMessagesReady) {
            this.onMessagesReady(userId, messages, state);
        }
        
        // Reset estadísticas
        state.typingEventsCount = 0;
        state.averageTypingDuration = 0;
    }
    
    // Obtener estadísticas del sistema
    getStats(): object {
        const stats = {
            totalUsers: this.states.size,
            activeUsers: 0,
            typingUsers: 0,
            usersWithMessages: 0,
            totalMessagesBuffered: 0
        };
        
        for (const state of this.states.values()) {
            if (state.isTyping) stats.typingUsers++;
            if (state.messages.length > 0) {
                stats.usersWithMessages++;
                stats.totalMessagesBuffered += state.messages.length;
            }
            if (state.isTyping || state.messages.length > 0) {
                stats.activeUsers++;
            }
        }
        
        return stats;
    }
    
    // Limpiar estados inactivos (llamar periódicamente)
    cleanupInactiveStates(maxInactivityMs: number = 3600000): number {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [userId, state] of this.states.entries()) {
            const lastActivity = Math.max(state.lastMessageTimestamp, state.lastTypingTimestamp);
            if (now - lastActivity > maxInactivityMs && state.messages.length === 0) {
                this.states.delete(userId);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            logInfo('CLEANUP', `Estados inactivos limpiados: ${cleaned}`);
        }
        
        return cleaned;
    }
} 