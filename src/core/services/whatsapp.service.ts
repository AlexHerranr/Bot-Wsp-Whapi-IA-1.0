// src/core/services/whatsapp.service.ts
import OpenAI from 'openai';
import { TerminalLog } from '../utils/terminal-log';
import { fetchWithRetry } from '../utils/retry-utils';
import { getShortUserId } from '../utils/identifiers';

// Simulación de la configuración que será inyectada
interface AppConfig {
    secrets: {
        WHAPI_API_URL: string;
        WHAPI_TOKEN: string;
    }
}

// Simulación de una parte del UserManager para saber si el último input fue de voz
interface UserState {
    lastInputVoice: boolean;
}

export class WhatsappService {
    constructor(
        private openai: OpenAI,
        private terminalLog: TerminalLog,
        private config: AppConfig
    ) {}

    public async sendTypingIndicator(chatId: string): Promise<void> {
        try {
            await fetchWithRetry(`${this.config.secrets.WHAPI_API_URL}/presences/${chatId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.config.secrets.WHAPI_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ presence: "typing", delay: 0 })
            });
        } catch (error: any) {
            this.terminalLog.whapiError('sendTypingIndicator', error.message);
        }
    }

    public async sendRecordingIndicator(chatId: string): Promise<void> {
        try {
            await fetchWithRetry(`${this.config.secrets.WHAPI_API_URL}/presences/${chatId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.config.secrets.WHAPI_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ presence: "recording", delay: 0 })
            });
        } catch (error: any) {
            this.terminalLog.whapiError('sendRecordingIndicator', error.message);
        }
    }

    public async sendWhatsAppMessage(
        chatId: string, 
        message: string, 
        userState: UserState,
        isQuoteOrPrice: boolean // Lógica de validación que vendrá del plugin
    ): Promise<boolean> {
        if (!message || message.trim() === '') {
            this.terminalLog.error(`Intento de enviar mensaje vacío a ${chatId}`);
            return true; // Evita fallos, pero no envía nada
        }

        const shouldUseVoice = process.env.ENABLE_VOICE_RESPONSES === 'true' && userState.lastInputVoice && !isQuoteOrPrice;

        if (shouldUseVoice) {
            try {
                return await this.sendVoiceMessage(chatId, message);
            } catch (error) {
                this.terminalLog.warning(`Fallo al enviar voz a ${getShortUserId(chatId)}, fallback a texto.`);
                // Continúa para enviar como texto si falla el audio
            }
        }

        return await this.sendTextMessage(chatId, message);
    }

    private async sendVoiceMessage(chatId: string, message: string): Promise<boolean> {
        const shortUserId = getShortUserId(chatId);
        this.terminalLog.voice(shortUserId);

        const ttsResponse = await this.openai.audio.speech.create({
            model: 'tts-1',
            voice: 'nova',
            input: message.substring(0, 4000), // Límite de TTS
            response_format: 'mp3'
        });

        const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());
        const base64Audio = audioBuffer.toString('base64');
        const audioDataUrl = `data:audio/mp3;base64,${base64Audio}`;

        await fetchWithRetry(`${this.config.secrets.WHAPI_API_URL}/messages/voice`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.secrets.WHAPI_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ to: chatId, media: audioDataUrl })
        });

        return true;
    }

    private async sendTextMessage(chatId: string, message: string): Promise<boolean> {
        const chunks = this.splitMessageIntelligently(message);

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const typingTime = i === 0 ? 3 : 2; // 3s para el primer mensaje, 2s para los siguientes

            await fetchWithRetry(`${this.config.secrets.WHAPI_API_URL}/messages/text`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.secrets.WHAPI_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ to: chatId, body: chunk, typing_time: typingTime })
            });

            if (i < chunks.length - 1) {
                const delay = Math.min(1000, chunk.length * 2);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        return true;
    }

    private splitMessageIntelligently(message: string): string[] {
        if (message.length <= MAX_MESSAGE_LENGTH) {
            const paragraphs = message.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
            if (paragraphs.length > 1) return paragraphs;
        }
        // Si no hay párrafos claros o el mensaje es muy largo, se usa una división más simple
        // (Esta lógica puede mejorarse, pero es un buen punto de partida)
        return [message];
    }
}

// Constante que moveremos a `constants.ts` más adelante
const MAX_MESSAGE_LENGTH = 4096;