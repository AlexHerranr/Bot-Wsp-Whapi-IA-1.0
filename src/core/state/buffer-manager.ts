// src/core/state/buffer-manager.ts - Versión con Extensión Dinámica Simplificada
import { MessageBuffer } from '../../shared/types';
import { IBufferManager } from '../../shared/interfaces';
import { BUFFER_DELAY_MS, MAX_BUFFER_MESSAGES } from '../utils/constants';
import { logInfo, logSuccess, logWarning, logDebug } from '../../utils/logging';

// Log del valor real de BUFFER_DELAY_MS al iniciar
logInfo('BUFFER_CONFIG', 'Configuración de buffer timing', {
    BUFFER_DELAY_MS,
    MAX_BUFFER_MESSAGES,
    envValue: process.env.BUFFER_DELAY_MS || 'not_set',
    actualValue: BUFFER_DELAY_MS
}, 'buffer-manager.ts');

export class BufferManager implements IBufferManager {
    private buffers: Map<string, MessageBuffer> = new Map();
    private activeRuns: Map<string, boolean> = new Map(); // Flag simple para evitar concurrent runs per user/thread
    private activeRunTimestamps: Map<string, number> = new Map(); // Timestamps para timeout de seguridad

    constructor(
        private processCallback: (userId: string, combinedText: string, chatId: string, userName: string, imageMessage?: { type: 'image', imageUrl: string, caption: string }, duringRunMsgId?: string) => Promise<void>,
        private getUserState?: (userId: string) => { isTyping: boolean; isRecording: boolean; lastActivity?: number } | undefined
    ) {}

    public addMessage(userId: string, messageText: string, chatId: string, userName: string, quotedMessageId?: string, currentMessageId?: string): void {
        let buffer = this.buffers.get(userId);
        if (!buffer) {
            buffer = { messages: [], chatId, userName, lastActivity: Date.now(), timer: null } as any;
            this.buffers.set(userId, buffer);
            logInfo('BUFFER_CREATED', 'Buffer creado para mensaje', { userId, userName, reason: 'new_message' }, 'buffer-manager.ts');
        } else {
            if (userName && userName !== 'Usuario') buffer.userName = userName;
            if (chatId && !buffer.chatId) buffer.chatId = chatId;
            // SIMPLIFICADO: quotedMessageId eliminado - solo duringRunMsgId
        }

        if (buffer.messages.length >= MAX_BUFFER_MESSAGES) {
            logWarning('BUFFER_LIMIT_REACHED', 'Límite alcanzado, procesando inmediatamente', { userId, userName, messageCount: buffer.messages.length }, 'buffer-manager.ts');
            this.processBuffer(userId);
            return;
        }

        if (buffer.messages.length > 0 && buffer.messages[buffer.messages.length - 1] === messageText) {
            logInfo('BUFFER_DUPLICATE_SKIP', 'Mensaje duplicado omitido', { userId, userName, messageText: messageText.substring(0, 50) });
            return;
        }

        buffer.messages.push(messageText);
        buffer.lastActivity = Date.now();
        
        // CITACIÓN AUTO: Marcar mensaje para citación si hay run activo
        if (this.activeRuns.get(userId)) {
            buffer.duringRunMsgId = currentMessageId || 'auto-during-run'; // Usa ID del mensaje actual para citación durante run
            logInfo('CITACION_AUTO_MARK', 'Mensaje marcado para citación auto durante run', { 
                userId, 
                userName,
                duringRunMsgId: buffer.duringRunMsgId,
                messagePreview: messageText.substring(0, 80),
                hasRealId: !!currentMessageId,
                reason: 'active_run_detected'
            });
        }
        
        // Marcar como voice si el mensaje contiene audio
        if (messageText.includes('(Nota de Voz Transcrita por Whisper)')) {
            buffer.isVoice = true;
        }
        
        // Analizar tipos de mensajes en el buffer
        const textCount = buffer.messages.filter(msg => !msg.includes('(Nota de Voz Transcrita por Whisper)')).length;
        const voiceCount = buffer.messages.filter(msg => msg.includes('(Nota de Voz Transcrita por Whisper)')).length;
        const currentCombined = this.smartCombineMessages(buffer.messages);
        
        // ✅ Log específico del estado del buffer
        if (buffer.messages.length > 0) {
            logDebug('BUFFER_STATE', 'Estado actual del buffer al añadir mensaje', {
                userId,
                userName,
                messageCount: buffer.messages.length,
                combinedPreview: currentCombined.substring(0, 80),
                textCount,
                voiceCount,
                hasDuringRunFlag: !!buffer.duringRunMsgId
            });
        }
        const preview20Words = currentCombined.split(' ').slice(0, 20).join(' ') + (currentCombined.split(' ').length > 20 ? '...' : '');
        
        // Log técnico para adición de mensaje con estado actual del buffer
        logDebug('BUFFER_STATE_ADD', 'Mensaje agregado, estado actual buffer', {
            userId,
            userName: buffer.userName || 'Usuario',
            currentMsgs: buffer.messages.length,
            types: `Text:${textCount} Voz:${voiceCount}`,
            preview: preview20Words,
            totalLength: currentCombined.length,
            reason: 'new_message',
            messageOrder: buffer.messages.map((msg, idx) => `[${idx}]:${msg.substring(0, 30)}...`).slice(-3) // Últimos 3 mensajes para ver orden
        });
        
        // Log detallado para debug de orden de mensajes
        logDebug('MESSAGE_ORDER_TRACKING', 'Orden de mensajes en buffer', {
            userId,
            messageIndex: buffer.messages.length - 1,
            messagePreview: messageText.substring(0, 50),
            bufferSequence: buffer.messages.map((_, idx) => idx).join(','),
            timerActive: !!buffer.timer,
            timeInBuffer: buffer.timer ? 'waiting' : 'no_timer'
        });
        
        // Sistema unificado: siempre usar timer de 5s
        this.setOrExtendTimer(userId, 'message');
    }

    public addImageMessage(userId: string, imageMessage: { type: 'image', imageUrl: string, caption: string }, chatId: string, userName: string): void {
        let buffer = this.buffers.get(userId);
        if (!buffer) {
            buffer = { messages: [], chatId, userName, lastActivity: Date.now(), timer: null, pendingImage: null };
            this.buffers.set(userId, buffer);
            logInfo('BUFFER_CREATED', 'Buffer creado para imagen', { userId, userName, reason: 'image_message' }, 'buffer-manager.ts');
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
        }, 'buffer-manager.ts');
    }

    public onTypingOrRecording(userId: string): void {
        let buffer = this.buffers.get(userId);
        
        // Optimización para escalabilidad: NO crear buffers vacíos por typing/recording
        // Solo procesar si ya existe un buffer con contenido previo
        if (!buffer) {
            // Skip silencioso - no crear buffer vacío innecesariamente
            // Con 100+ usuarios, esto reduce significativamente el overhead de memoria
            return;
        }
        
        buffer.lastActivity = Date.now();
        
        // Solo establecer/extender timer si hay contenido real en el buffer
        if (buffer.messages.length > 0 || buffer.pendingImage) {
            // Sistema unificado: usar timer de 5s para extender mientras hay actividad
            this.setOrExtendTimer(userId, 'typing_recording');
            logDebug('BUFFER_EXTEND_ACTIVITY', 'Timer extendido por actividad', {
                userId,
                userName: buffer.userName || 'Usuario',
                messageCount: buffer.messages.length,
                reason: 'typing_or_recording'
            }, 'buffer-manager.ts');
        }
        // Si buffer existe pero está vacío, no hacer nada (no logs para reducir ruido)
    }

    // Método unificado: "Last event wins" - cancela timer anterior y establece nuevo timer
    private setOrExtendTimer(userId: string, reason: string = 'message'): void {
        const buffer = this.buffers.get(userId);
        if (!buffer) return;

        // TIMEOUTS DINÁMICOS POR PROCESSOR
        const operationsChatId = process.env.OPERATIONS_CHAT_ID;
        const isOperations = (userId === operationsChatId);
        
        // Detectar tipo de actividad y aplicar timeout específico
        const isVoiceContext = buffer.isVoice || reason === 'voice' || reason === 'activity';
        let delay: number;
        
        if (isVoiceContext) {
            delay = isOperations ? 1000 : 3000;  // Operations: 1s, Main: 3s para voz
        } else {
            delay = isOperations ? 1000 : BUFFER_DELAY_MS;  // Operations: 1s, Main: 5s para texto
        }

        // Cancelar timer anterior si existe (last event wins)
        if (buffer.timer) {
            clearTimeout(buffer.timer);
            logInfo('BUFFER_TIMER_CANCEL', 'Timer anterior cancelado', {
                userId,
                userName: buffer.userName || 'Usuario',
                reason: 'new_event',
                previousDelay: delay
            }, 'buffer-manager.ts');
        }

        // Crear nuevo timer con delay dinámico
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
        }, 'buffer-manager.ts');
    }

    private async processBuffer(userId: string): Promise<void> {
        const buffer = this.buffers.get(userId);
        if (!buffer || (buffer.messages.length === 0 && !buffer.pendingImage)) {
            logInfo('BUFFER_EMPTY_SKIP', 'Buffer vacío, limpiando', {
                userId,
                userName: buffer?.userName || 'unknown',
                reason: 'no_messages_or_images'
            }, 'buffer-manager.ts');
            this.clearBuffer(userId);
            return;
        }


        // Fast path deshabilitado temporalmente para mantener orden de mensajes
        // Con múltiples usuarios enviando mensajes rápidamente, el fast path puede
        // causar que mensajes se procesen fuera de orden. Mejor esperar siempre el buffer.
        /*
        if (buffer.messages.length === 1 && !buffer.pendingImage && this.getUserState) {
            const userState = this.getUserState(userId);
            if (!userState?.isTyping && !userState?.isRecording) {
                // Este fast path puede causar problemas de orden con mensajes rápidos
                // Deshabilitado para mantener consistencia
            }
        }
        */
        
        // Siempre respetar el timer del buffer para mantener orden correcto
        // Esto asegura que mensajes que llegan rápidamente se agrupen apropiadamente
        logDebug('BUFFER_RESPECTING_TIMER', 'Respetando timer de buffer para mantener orden', {
            userId,
            messageCount: buffer.messages.length,
            hasImage: !!buffer.pendingImage,
            reason: 'order_preservation'
        }, 'buffer-manager.ts');

        // Chequeo anti-concurrent: Si run activo, retrasar (en producción, poll OpenAI run status)
        if (this.activeRuns.get(userId)) {
            const runStartTime = this.activeRunTimestamps.get(userId) || 0;
            const runDuration = Date.now() - runStartTime;
            
            // TIMEOUT DE SEGURIDAD: Si run lleva >60s activo, forzar liberación para evitar locks infinitos
            if (runDuration > 60000) { // 60 segundos
                logWarning('BUFFER_FORCE_RELEASE_TIMEOUT', 'Liberando run atascado por timeout de seguridad', {
                    userId,
                    userName: buffer.userName,
                    runDuration,
                    reason: 'safety_timeout_60s'
                }, 'buffer-manager.ts');
                this.releaseRun(userId);
                // Continúa procesando después del force release
            } else {
                logWarning('BUFFER_DELAYED_ACTIVE_RUN', 'Retrasando por run activo', { 
                    userId,
                    userName: buffer.userName,
                    pendingMessages: buffer.messages.length,
                    runDuration
                }, 'buffer-manager.ts');
                // Usar timer más corto (1.5s) cuando hay run activo para verificar más frecuentemente
                if (buffer.timer) {
                    clearTimeout(buffer.timer);
                }
                buffer.timer = setTimeout(() => {
                    this.processBuffer(userId);
                }, 1500); // Solo 1.5s cuando esperando que termine un run
                return;
            }
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
                    }, 'buffer-manager.ts');
                    this.setOrExtendTimer(userId, 'activity'); // Re-extender mientras activo
                    return;
                }
            }
        }

        this.activeRuns.set(userId, true); // Marcar como activo
        this.activeRunTimestamps.set(userId, Date.now()); // Timestamp para timeout de seguridad

        const messagesToProcess = [...buffer.messages];
        const { chatId, userName } = buffer;

        // CITACIÓN AUTO: Detectar si hay mensaje marcado para citación durante run
        const isDuringRunPending = !!buffer.duringRunMsgId;
        if (isDuringRunPending) {
            logInfo('BUFFER_PENDING_DURING_RUN', 'Procesando con citación auto', { 
                userId, 
                userName,
                duringRunMsgId: buffer.duringRunMsgId,
                messageCount: buffer.messages.length
            });
        }
        const pendingImage = buffer.pendingImage;
        const duringRunMsgId = buffer.duringRunMsgId;
        
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
            await this.processCallback(userId, combinedText || '📷 Imagen recibida', chatId, userName, pendingImage || undefined, duringRunMsgId);
        } catch (error) {
            logWarning('BUFFER_PROCESS_ERROR', 'Error procesando buffer', {
                userId,
                userName,
                error: error instanceof Error ? error.message : String(error)
            });
        } finally {
            this.activeRuns.delete(userId); // Liberar
            this.activeRunTimestamps.delete(userId); // Limpiar timestamp
            
            // LIMPIEZA: Reset flag duringRunMsgId para evitar carry-over
            const currentBuffer = this.buffers.get(userId);
            if (currentBuffer) {
                currentBuffer.duringRunMsgId = undefined;
                logInfo('FLAG_RESET', 'duringRunMsgId reseteado post-procesamiento', { userId });
            }
            
            // CRÍTICO: Verificar si llegaron mensajes nuevos mientras procesábamos
            if (currentBuffer && currentBuffer.messages.length > 0) {
                // Hay mensajes pendientes que llegaron durante el procesamiento
                logInfo('BUFFER_PENDING_AFTER_RUN', 'Mensajes pendientes detectados después del run', {
                    userId,
                    userName: currentBuffer.userName || 'Usuario',
                    pendingCount: currentBuffer.messages.length,
                    preview: currentBuffer.messages[0]?.substring(0, 50)
                });
                
                // Re-establecer timer para procesar los mensajes pendientes
                // Usar un delay pequeño para evitar procesar inmediatamente
                setTimeout(() => {
                    this.setOrExtendTimer(userId, 'pending_after_run');
                }, 1000);
            } else {
                // No hay mensajes pendientes, limpiar buffer normalmente
                this.clearBuffer(userId);
            }
        }
    }

    private smartCombineMessages(messages: string[]): string {
        // ✅ Buffer solo concatena mensajes - SIMPLIFICADO
        // duringRunMsgId se maneja por separado para citación automática
        if (messages.length <= 1) {
            return messages[0] || '';
        }
        return messages
            .map(msg => msg.trim())
            .filter(Boolean)
            .join(' ');
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

    public releaseRun(userId: string): void {
        this.activeRuns.delete(userId);
        this.activeRunTimestamps.delete(userId); // También limpiar timestamp
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
                }, 'buffer-manager.ts');
                this.clearBuffer(userId);
                cleaned++;
            }
        }
        if (cleaned > 0) logInfo('BUFFER_CLEANUP_COMPLETE', 'Limpieza completada', { cleaned, remaining: this.buffers.size }, 'buffer-manager.ts');
        return cleaned;
    }

    // Métodos legacy para compatibilidad
    public setIntelligentTimer(userId: string, triggerType: 'message' | 'voice' | 'typing' | 'recording'): void {
        // SELECCIÓN DINÁMICA DE TIMEOUTS POR PROCESSOR
        const operationsChatId = process.env.OPERATIONS_CHAT_ID;
        const isOperations = (userId === operationsChatId);
        
        // Timeouts optimizados por processor - CONSISTENTE con setOrExtendTimer
        let timeoutMs: number;
        if (triggerType === 'voice') {
            timeoutMs = isOperations ? 1000 : 3000;  // Operations: 1s, Main: 3s (consistente con setOrExtendTimer)
        } else if (triggerType === 'typing' || triggerType === 'recording') {
            timeoutMs = isOperations ? 1000 : 5000;  // Operations: 1s, Main: 5s  
        } else { // message
            timeoutMs = isOperations ? 1000 : 5000;  // Operations: 1s, Main: 5s (usar BUFFER_DELAY_MS)
        }
        
        logDebug('BUFFER_TIMEOUT_DYNAMIC', 'Timeout configurado por processor', {
            userId,
            triggerType,
            isOperations,
            timeoutMs,
            processorType: isOperations ? 'OPERATIONS' : 'MAIN'
        }, 'buffer-manager.ts');
        
        // Mapeo para compatibilidad con setOrExtendTimer
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
                logInfo('BUFFER_CREATED', 'Buffer creado por timer inteligente', { userId, triggerType }, 'buffer-manager.ts');
            }
            
            // Para voice, log especial indicando espera de transcripción
            if (triggerType === 'voice') {
                logInfo('BUFFER_VOICE_WAIT', 'Esperando transcripción de voz', { 
                    userId, 
                    userName: buffer.userName,
                    delay: BUFFER_DELAY_MS
                }, 'buffer-manager.ts');
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
                    }, 'buffer-manager.ts');
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
            }, 'buffer-manager.ts');
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