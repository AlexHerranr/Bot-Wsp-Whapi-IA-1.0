// src/core/state/buffer-manager.ts - Versión con Extensión Dinámica Simplificada
import { MessageBuffer } from '../../shared/types';
import { IBufferManager } from '../../shared/interfaces';
import { BUFFER_WINDOW_MS, TYPING_ACTIVITY_MS } from '../utils/constants';
import { logInfo, logSuccess, logWarning } from '../../utils/logging';

export class BufferManager implements IBufferManager {
    private buffers: Map<string, MessageBuffer> = new Map();
    private activeRuns: Map<string, boolean> = new Map(); // Flag simple para evitar concurrent runs per user/thread

    constructor(
        private processCallback: (userId: string, combinedText: string, chatId: string, userName: string) => Promise<void>,
        private getUserState?: (userId: string) => { isTyping: boolean; isRecording: boolean; lastActivity?: number } | undefined
    ) {}

    public addMessage(userId: string, messageText: string, chatId: string, userName: string): void {
        let buffer = this.buffers.get(userId);
        if (!buffer) {
            buffer = { messages: [], chatId, userName, lastActivity: Date.now(), timer: null };
            this.buffers.set(userId, buffer);
            logInfo('BUFFER_CREATED', 'Buffer creado para mensaje', { userId, userName, reason: 'new_message' });
        } else {
            if (userName && userName !== 'Usuario') buffer.userName = userName;
            if (chatId && !buffer.chatId) buffer.chatId = chatId;
        }

        if (buffer.messages.length >= 50) {
            logWarning('BUFFER_LIMIT_REACHED', 'Límite alcanzado, procesando inmediatamente', { userId, userName, messageCount: buffer.messages.length });
            this.processBuffer(userId);
            return;
        }

        if (buffer.messages.length > 0 && buffer.messages[buffer.messages.length - 1] === messageText) {
            logInfo('BUFFER_DUPLICATE_SKIP', 'Mensaje duplicado omitido', { userId, userName, messageText: messageText.substring(0, 50) });
            return;
        }

        buffer.messages.push(messageText);
        buffer.lastActivity = Date.now();
        
        // Si el buffer tenía un delay largo (esperando transcripción), mantenerlo
        const hadLongDelay = buffer.currentDelay && buffer.currentDelay >= TYPING_ACTIVITY_MS;
        
        if (hadLongDelay) {
            // Mantener el delay largo para no interrumpir la espera de transcripción
            logInfo('BUFFER_KEEP_LONG_DELAY', 'Manteniendo delay largo tras agregar mensaje', {
                userId,
                userName,
                currentDelay: buffer.currentDelay,
                messagePreview: messageText.substring(0, 50)
            });
            this.setTimer(userId, 'activity'); // Usar 'activity' para mantener 5s
        } else {
            // Comportamiento normal para mensajes regulares
            this.setTimer(userId, 'message');
        }
    }

    public onTypingOrRecording(userId: string): void {
        let buffer = this.buffers.get(userId);
        if (!buffer) {
            buffer = { messages: [], chatId: '', userName: '', lastActivity: Date.now(), timer: null };
            this.buffers.set(userId, buffer);
            logInfo('BUFFER_CREATED', 'Buffer creado por actividad', { userId, reason: 'typing_or_recording' });
        }
        
        buffer.lastActivity = Date.now();
        
        // Mata timer anterior y crea nuevo para actividad
        this.setTimer(userId, 'activity');
    }

    private setTimer(userId: string, triggerType: 'message' | 'activity'): void {
        const buffer = this.buffers.get(userId);
        if (!buffer) return;

        // Determinar delay base por tipo
        let delay = (triggerType === 'message') ? BUFFER_WINDOW_MS : TYPING_ACTIVITY_MS;  // 2s o 5s

        // Si usuario está activo, SIEMPRE usar delay largo (full desde ahora)
        if (this.getUserState) {
            const userState = this.getUserState(userId);
            if (userState?.isTyping || userState?.isRecording) {
                delay = TYPING_ACTIVITY_MS;  // 5s desde ahora
                buffer.lastActivity = Date.now();  // Actualizar timestamp
                logInfo('BUFFER_ACTIVITY_EXTENSION', 'Extendiendo full por actividad', { 
                    userId, 
                    userName: buffer.userName, 
                    delay, 
                    triggerType,
                    reason: 'user_active' 
                });
            }
        }

        // MATA el timer anterior si existe
        if (buffer.timer) {
            clearTimeout(buffer.timer);
            logInfo('BUFFER_TIMER_KILLED', 'Timer anterior eliminado para extender', {
                userId,
                userName: buffer.userName,
                previousDelay: buffer.currentDelay,
                newDelay: delay,
                reason: `new_${triggerType}`
            });
        }

        // Crear NUEVO timer (mata anterior, full delay desde ahora)
        buffer.timer = setTimeout(() => {
            this.processBuffer(userId);
        }, delay);

        buffer.currentDelay = delay;

        logInfo('BUFFER_TIMER_SET', 'Nuevo timer full', {
            userId,
            userName: buffer.userName,
            delay,
            messageCount: buffer.messages.length,
            triggerType
        });
    }

    private async processBuffer(userId: string): Promise<void> {
        const buffer = this.buffers.get(userId);
        if (!buffer || buffer.messages.length === 0) {
            logInfo('BUFFER_EMPTY_SKIP', 'Buffer vacío, limpiando', {
                userId,
                userName: buffer?.userName || 'unknown',
                reason: 'no_messages'
            });
            this.clearBuffer(userId);
            return;
        }

        // Chequeo anti-concurrent: Si run activo, retrasar (en producción, poll OpenAI run status)
        if (this.activeRuns.get(userId)) {
            logWarning('BUFFER_DELAYED_ACTIVE_RUN', 'Retrasando por run activo', { userId });
            this.setTimer(userId, 'activity'); // Re-extender
            return;
        }
        
        // Chequeo de actividad: Si usuario está activamente escribiendo/grabando, esperar
        if (this.getUserState) {
            const userState = this.getUserState(userId);
            if (userState?.isTyping || userState?.isRecording) {
                logInfo('BUFFER_DELAYED_USER_ACTIVE', 'Usuario activo, extendiendo buffer', {
                    userId,
                    userName: buffer.userName,
                    isTyping: userState.isTyping,
                    isRecording: userState.isRecording,
                    messageCount: buffer.messages.length
                });
                this.setTimer(userId, 'activity'); // Re-extender mientras activo
                return;
            }
        }

        this.activeRuns.set(userId, true); // Marcar como activo

        const messagesToProcess = [...buffer.messages];
        const { chatId, userName } = buffer;
        
        buffer.messages = [];
        if (buffer.timer) {
            clearTimeout(buffer.timer);
            buffer.timer = null;
        }

        const combinedText = this.smartCombineMessages(messagesToProcess).trim();

        logSuccess('BUFFER_GROUPED', 'Procesando idea completa agrupada', {
            userId,
            userName,
            messageCount: messagesToProcess.length,
            totalLength: combinedText.length,
            messages: messagesToProcess.map((msg, idx) => ({
                index: idx + 1,
                content: msg.substring(0, 100),
                length: msg.length,
                type: msg.includes('(Audio)') ? 'voice_transcription' : 'text'
            })),
            combinedPreview: combinedText.substring(0, 200)
        });

        try {
            await this.processCallback(userId, combinedText, chatId, userName);
        } catch (error) {
            logWarning('BUFFER_PROCESS_ERROR', 'Error procesando buffer', {
                userId,
                userName,
                error: error instanceof Error ? error.message : String(error)
            });
        } finally {
            this.activeRuns.delete(userId); // Liberar
            this.clearBuffer(userId);
        }
    }

    private smartCombineMessages(messages: string[]): string {
        if (messages.length <= 1) return messages[0] || '';
        return messages.map(msg => msg.trim()).filter(msg => msg).join(' ');
    }

    public clearBuffer(userId: string): void {
        const buffer = this.buffers.get(userId);
        if (buffer?.timer) {
            clearTimeout(buffer.timer);
        }
        this.buffers.delete(userId);
    }

    public getBuffer(userId: string): MessageBuffer | undefined {
        return this.buffers.get(userId);
    }

    public cleanup(maxAge: number = 15 * 60 * 1000): number {
        const now = Date.now();
        let cleaned = 0;
        for (const [userId, buffer] of this.buffers.entries()) {
            if (now - buffer.lastActivity > maxAge) {
                logInfo('BUFFER_CLEANUP_OLD', 'Limpiando buffer inactivo', {
                    userId,
                    userName: buffer.userName,
                    age: now - buffer.lastActivity
                });
                this.clearBuffer(userId);
                cleaned++;
            }
        }
        if (cleaned > 0) logInfo('BUFFER_CLEANUP_COMPLETE', 'Limpieza completada', { cleaned, remaining: this.buffers.size });
        return cleaned;
    }

    // Métodos legacy para compatibilidad
    public setIntelligentTimer(userId: string, triggerType: 'message' | 'voice' | 'typing' | 'recording'): void {
        // Mapeo inteligente: 
        // - typing/recording = activity (5s)
        // - voice = activity (5s para esperar transcripción)
        // - message = message (2s)
        const type = (triggerType === 'typing' || triggerType === 'recording' || triggerType === 'voice') ? 'activity' : 'message';
        
        // Para typing/recording, usar onTypingOrRecording que actualiza lastActivity
        if (triggerType === 'typing' || triggerType === 'recording') {
            this.onTypingOrRecording(userId);
        } else {
            // Para message/voice, crear buffer si no existe pero no agregar mensaje
            let buffer = this.buffers.get(userId);
            if (!buffer) {
                buffer = { messages: [], chatId: '', userName: '', lastActivity: Date.now(), timer: null };
                this.buffers.set(userId, buffer);
                logInfo('BUFFER_CREATED', 'Buffer creado por timer inteligente', { userId, triggerType });
            }
            
            // Para voice, log especial indicando espera de transcripción
            if (triggerType === 'voice') {
                logInfo('BUFFER_VOICE_WAIT', 'Esperando transcripción de voz', { 
                    userId, 
                    userName: buffer.userName,
                    delay: TYPING_ACTIVITY_MS
                });
            }
            
            this.setTimer(userId, type);
        }
    }

    public markRecentError(userId: string): void {
        const buffer = this.buffers.get(userId);
        if (buffer) {
            logInfo('BUFFER_ERROR_CLEANUP', 'Limpiando buffer por error', {
                userId,
                userName: buffer.userName,
                messageCount: buffer.messages.length
            });
            this.clearBuffer(userId);
        }
    }

    public getStats(): { active: number; total: number } {
        return {
            active: this.buffers.size,
            total: this.buffers.size
        };
    }
}