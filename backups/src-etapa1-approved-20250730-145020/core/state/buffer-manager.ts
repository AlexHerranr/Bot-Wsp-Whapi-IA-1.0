// src/core/state/buffer-manager.ts
import { MessageBuffer } from '../../shared/types';
import { BUFFER_WINDOW_MS, VOICE_BUFFER_MS, TYPING_EXTENDED_MS } from '../utils/constants';

export class BufferManager {
    private buffers: Map<string, MessageBuffer> = new Map();

    // La clase recibe una función callback para procesar el buffer cuando el timer expira.
    constructor(
        private processCallback: (userId: string, combinedText: string, chatId: string, userName: string) => Promise<void>
    ) {}

    public addMessage(
        userId: string, 
        messageText: string, 
        chatId: string, 
        userName: string
    ): void {
        let buffer = this.buffers.get(userId);

        if (!buffer) {
            buffer = {
                messages: [],
                chatId,
                userName,
                lastActivity: Date.now(),
                timer: null
            };
            this.buffers.set(userId, buffer);
        } else {
            if (userName && userName !== 'Usuario') {
                buffer.userName = userName;
            }
        }

        if (buffer.messages.length >= 50) {
            console.warn(`Buffer limit reached for user ${userId}. Processing immediately.`);
            this.processBuffer(userId);
            return;
        }

        buffer.messages.push(messageText);
        buffer.lastActivity = Date.now();

        this.setIntelligentTimer(userId, 'message');
    }

    public setIntelligentTimer(
        userId: string, 
        triggerType: 'message' | 'voice' | 'typing' | 'recording'
    ): void {
        const buffer = this.buffers.get(userId);
        if (!buffer) return;

        let bufferDelay = BUFFER_WINDOW_MS; // 5000ms para mensajes
        if (triggerType === 'voice') {
            bufferDelay = VOICE_BUFFER_MS; // 8000ms para voice
        } else if (triggerType === 'typing' || triggerType === 'recording') {
            bufferDelay = TYPING_EXTENDED_MS; // 10000ms para typing/recording
        }

        // Lógica de timer: reconfigurar solo si el nuevo delay es mayor al actual
        const shouldSetNewTimer = !buffer.timer || (buffer.currentDelay && bufferDelay > buffer.currentDelay);

        if (shouldSetNewTimer) {
            if (buffer.timer) {
                clearTimeout(buffer.timer);
                console.log(`Timer reconfigured for user ${userId}: ${bufferDelay}ms (was ${buffer.currentDelay || 'none'})`);
            }

            // Crear nuevo timer con el delay completo
            buffer.timer = setTimeout(() => {
                this.processBuffer(userId);
            }, bufferDelay);

            buffer.currentDelay = bufferDelay;
        } else {
            console.log(`Timer respected for user ${userId}: current ${buffer.currentDelay}ms >= requested ${bufferDelay}ms`);
        }
    }

    private async processBuffer(userId: string): Promise<void> {
        const buffer = this.buffers.get(userId);
        if (!buffer || buffer.messages.length === 0) {
            this.buffers.delete(userId);
            return;
        }

        // Hacemos una copia y limpiamos el buffer original ANTES de procesar
        const messagesToProcess = [...buffer.messages];
        const { chatId, userName } = buffer;
        buffer.messages = []; 

        if (buffer.timer) {
            clearTimeout(buffer.timer);
            buffer.timer = null;
        }

        const combinedText = messagesToProcess.join('\n').trim();

        try {
            await this.processCallback(userId, combinedText, chatId, userName);
        } catch (error) {
            console.error(`Error processing buffer for user ${userId}:`, error);
            // Opcional: Devolver mensajes al buffer si el procesamiento falla
            // buffer.messages = messagesToProcess; 
        } finally {
            // Si después de procesar no hay mensajes nuevos, eliminamos el buffer
            if (this.buffers.get(userId)?.messages.length === 0) {
                this.buffers.delete(userId);
            }
        }
    }

    public getBuffer(userId: string): MessageBuffer | undefined {
        return this.buffers.get(userId);
    }

    public cleanup(maxAge: number = 15 * 60 * 1000): number {
        const now = Date.now();
        let cleanedCount = 0;
        for (const [userId, buffer] of this.buffers.entries()) {
            if (now - buffer.lastActivity > maxAge) {
                if (buffer.timer) clearTimeout(buffer.timer);
                this.buffers.delete(userId);
                cleanedCount++;
            }
        }
        return cleanedCount;
    }
}