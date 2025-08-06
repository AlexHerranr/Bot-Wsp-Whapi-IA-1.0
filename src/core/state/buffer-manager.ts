// src/core/state/buffer-manager.ts - Versión con Extensión Dinámica Simplificada
import { MessageBuffer } from '../../shared/types';
import { IBufferManager } from '../../shared/interfaces';
import { BUFFER_DELAY_MS, MAX_BUFFER_MESSAGES } from '../utils/constants';
import { logInfo, logSuccess, logWarning } from '../../utils/logging';

export class BufferManager implements IBufferManager {
    private buffers: Map<string, MessageBuffer> = new Map();
    private activeRuns: Map<string, boolean> = new Map(); // Flag simple para evitar concurrent runs per user/thread

    constructor(
        private processCallback: (userId: string, combinedText: string, chatId: string, userName: string, imageMessage?: { type: 'image', imageUrl: string, caption: string }) => Promise<void>,
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

        if (buffer.messages.length >= MAX_BUFFER_MESSAGES) {
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
        
        // Marcar como voice si el mensaje contiene audio
        if (messageText.includes('(Nota de Voz Transcrita por Whisper)')) {
            buffer.isVoice = true;
        }
        
        // Analizar tipos de mensajes en el buffer
        const textCount = buffer.messages.filter(msg => !msg.includes('(Nota de Voz Transcrita por Whisper)')).length;
        const voiceCount = buffer.messages.filter(msg => msg.includes('(Nota de Voz Transcrita por Whisper)')).length;
        const currentCombined = this.smartCombineMessages(buffer.messages);
        const preview20Words = currentCombined.split(' ').slice(0, 20).join(' ') + (currentCombined.split(' ').length > 20 ? '...' : '');
        
        // Log técnico para adición de mensaje con estado actual del buffer
        logInfo('BUFFER_STATE_ADD', 'Mensaje agregado, estado actual buffer', {
            userId,
            userName: buffer.userName || 'Usuario',
            currentMsgs: buffer.messages.length,
            types: `Text:${textCount} Voz:${voiceCount}`,
            preview: preview20Words,
            totalLength: currentCombined.length,
            reason: 'new_message'
        });
        
        // Sistema unificado: siempre usar timer de 5s
        this.setOrExtendTimer(userId, 'message');
    }

    public addImageMessage(userId: string, imageMessage: { type: 'image', imageUrl: string, caption: string }, chatId: string, userName: string): void {
        let buffer = this.buffers.get(userId);
        if (!buffer) {
            buffer = { messages: [], chatId, userName, lastActivity: Date.now(), timer: null, pendingImage: null };
            this.buffers.set(userId, buffer);
            logInfo('BUFFER_CREATED', 'Buffer creado para imagen', { userId, userName, reason: 'image_message' });
        } else {
            if (userName && userName !== 'Usuario') buffer.userName = userName;
            if (chatId && !buffer.chatId) buffer.chatId = chatId;
        }

        // Agregar imagen al buffer (se procesará junto con el siguiente texto o inmediatamente)
        buffer.pendingImage = imageMessage;
        buffer.lastActivity = Date.now();
        
        // Si hay mensajes de texto esperando, procesar inmediatamente
        if (buffer.messages.length > 0) {
            this.processBuffer(userId);
        } else {
            // Si no hay texto, esperar un poco por si llega texto
            this.setOrExtendTimer(userId, 'image');
        }

        logInfo('BUFFER_IMAGE_ADDED', 'Imagen agregada al buffer', {
            userId,
            userName: buffer.userName || 'Usuario',
            hasCaption: !!imageMessage.caption,
            pendingMessages: buffer.messages.length
        });
    }

    public onTypingOrRecording(userId: string): void {
        let buffer = this.buffers.get(userId);
        if (!buffer) {
            // Solo crear buffer si no existe, pero NO establecer timer si está vacío
            buffer = { messages: [], chatId: '', userName: '', lastActivity: Date.now(), timer: null };
            this.buffers.set(userId, buffer);
            logInfo('BUFFER_CREATED', 'Buffer creado por actividad', { userId, reason: 'typing_or_recording' });
        }
        
        buffer.lastActivity = Date.now();
        
        // CRÍTICO: Solo establecer timer si hay contenido en el buffer
        // Esto evita el cleanup prematuro de buffers vacíos creados por presence
        if (buffer.messages.length > 0 || buffer.pendingImage) {
            // Sistema unificado: usar timer de 5s para extender mientras hay actividad
            this.setOrExtendTimer(userId, 'typing_recording');
        } else {
            logInfo('BUFFER_TIMER_SKIP', 'Timer no establecido - buffer sin contenido', { 
                userId,
                reason: 'empty_buffer_on_presence'
            });
        }
    }

    // Método unificado: "Last event wins" - cancela timer anterior y establece nuevo timer de 5s
    private setOrExtendTimer(userId: string, reason: string = 'message'): void {
        const buffer = this.buffers.get(userId);
        if (!buffer) return;

        const delay = BUFFER_DELAY_MS; // Siempre 5s unificado

        // Cancelar timer anterior si existe (last event wins)
        if (buffer.timer) {
            clearTimeout(buffer.timer);
            logInfo('BUFFER_TIMER_CANCEL', 'Timer anterior cancelado', {
                userId,
                userName: buffer.userName || 'Usuario',
                reason: 'new_event',
                previousDelay: delay
            });
        }

        // Crear nuevo timer de 5s
        buffer.timer = setTimeout(() => {
            this.processBuffer(userId);
        }, delay);

        buffer.lastActivity = Date.now();

        // Estado del buffer para visibilidad progresiva
        const textCount = buffer.messages.filter(msg => !msg.includes('(Nota de Voz Transcrita por Whisper)')).length;
        const voiceCount = buffer.messages.filter(msg => msg.includes('(Nota de Voz Transcrita por Whisper)')).length;
        
        logInfo('BUFFER_STATE_WAIT', 'Buffer esperando agrupación', {
            userId,
            userName: buffer.userName || 'Usuario',
            currentMsgs: buffer.messages.length,
            types: `Text:${textCount} Voz:${voiceCount}`,
            timeoutRemaining: `${delay/1000}s`,
            reason,
            delayMs: delay
        });
    }

    private async processBuffer(userId: string): Promise<void> {
        const buffer = this.buffers.get(userId);
        if (!buffer || (buffer.messages.length === 0 && !buffer.pendingImage)) {
            logInfo('BUFFER_EMPTY_SKIP', 'Buffer vacío, limpiando', {
                userId,
                userName: buffer?.userName || 'unknown',
                reason: 'no_messages_or_images'
            });
            this.clearBuffer(userId);
            return;
        }

        // Fast path para mensajes únicos sin typing/recording
        if (buffer.messages.length === 1 && !buffer.pendingImage && this.getUserState) {
            const userState = this.getUserState(userId);
            if (!userState?.isTyping && !userState?.isRecording) {
                logInfo('BUFFER_FAST_PATH', 'Processing single message immediately', { 
                    userId, 
                    message: buffer.messages[0].substring(0, 50) 
                });
                // Procede directamente al procesamiento
                this.activeRuns.set(userId, true);
                const messagesToProcess = [...buffer.messages];
                const { chatId, userName } = buffer;
                
                buffer.messages = [];
                if (buffer.timer) {
                    clearTimeout(buffer.timer);
                    buffer.timer = null;
                }
                
                const combinedText = this.smartCombineMessages(messagesToProcess).trim();
                
                try {
                    await this.processCallback(userId, combinedText, chatId, userName);
                } catch (error) {
                    logWarning('BUFFER_PROCESS_ERROR', 'Error procesando buffer', {
                        userId,
                        userName,
                        error: error instanceof Error ? error.message : String(error)
                    });
                } finally {
                    this.activeRuns.delete(userId);
                    this.clearBuffer(userId);
                }
                return;
            }
        }

        // Chequeo anti-concurrent: Si run activo, retrasar (en producción, poll OpenAI run status)
        if (this.activeRuns.get(userId)) {
            logWarning('BUFFER_DELAYED_ACTIVE_RUN', 'Retrasando por run activo', { userId });
            this.setOrExtendTimer(userId, 'activity'); // Re-extender
            return;
        }
        
        // Fast path para buffers de voice después de 3s sin actividad
        if (buffer.isVoice && (Date.now() - buffer.lastActivity > 3000)) {
            logInfo('BUFFER_VOICE_FAST_PATH', 'Procesando buffer de voz tras 3s de inactividad', {
                userId,
                userName: buffer.userName,
                messageCount: buffer.messages.length,
                timeSinceLastActivity: Date.now() - buffer.lastActivity,
                reason: 'voice_timeout_3s'
            });
            // Proceder directamente al procesamiento - saltear checks de actividad
        } else {
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
                    this.setOrExtendTimer(userId, 'activity'); // Re-extender mientras activo
                    return;
                }
            }
        }

        this.activeRuns.set(userId, true); // Marcar como activo

        const messagesToProcess = [...buffer.messages];
        const { chatId, userName } = buffer;
        const pendingImage = buffer.pendingImage;
        
        buffer.messages = [];
        buffer.pendingImage = null;
        buffer.isVoice = false; // Reset voice flag
        if (buffer.timer) {
            clearTimeout(buffer.timer);
            buffer.timer = null;
        }

        const combinedText = this.smartCombineMessages(messagesToProcess).trim();

        logSuccess('BUFFER_GROUPED', 'Procesando idea completa agrupada', {
            userId,
            userName,
            messageCount: messagesToProcess.length,
            hasImage: !!pendingImage,
            totalLength: combinedText.length,
            messages: messagesToProcess.map((msg, idx) => ({
                index: idx + 1,
                content: msg.substring(0, 100),
                length: msg.length,
                type: msg.includes('(Nota de Voz Transcrita por Whisper)') ? 'voice_transcription' : 'text'
            })),
            combinedPreview: combinedText.substring(0, 200)
        });

        try {
            await this.processCallback(userId, combinedText || '📷 Imagen recibida', chatId, userName, pendingImage || undefined);
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
        
        // Para typing/recording, usar onTypingOrRecording que ahora maneja buffers vacíos correctamente
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
                    delay: BUFFER_DELAY_MS
                });
                // Voice siempre debe establecer timer para esperar transcripción
                this.setOrExtendTimer(userId, type);
            } else {
                // Para otros tipos, solo establecer timer si hay contenido
                if (buffer.messages.length > 0 || buffer.pendingImage) {
                    this.setOrExtendTimer(userId, type);
                } else {
                    logInfo('BUFFER_TIMER_SKIP', 'Timer no establecido en setIntelligentTimer', { 
                        userId,
                        triggerType,
                        reason: 'empty_buffer'
                    });
                }
            }
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