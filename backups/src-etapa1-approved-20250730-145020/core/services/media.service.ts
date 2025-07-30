// src/core/services/media.service.ts
import { promises as fs } from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { TerminalLog } from '../utils/terminal-log';
import { fetchWithRetry } from '../utils/retry-utils';
import type { WHAPIMessage } from '../../shared/types';
// Asumiremos que la configuración se inyectará más adelante. Por ahora, la simulamos.
interface AppConfig {
    secrets: {
        WHAPI_API_URL: string;
        WHAPI_TOKEN: string;
    }
}

export class MediaService {
    constructor(
        private openai: OpenAI,
        private terminalLog: TerminalLog,
        private config: AppConfig // Se inyectará con DI más adelante
    ) {}

    public async transcribeAudio(
        audioUrl: string | undefined,
        userId: string,
        userName?: string,
        messageId?: string
    ): Promise<string> {
        try {
            let finalAudioUrl = audioUrl;

            if (!finalAudioUrl && messageId) {
                finalAudioUrl = await this.fetchMediaUrl(messageId, 'audio');
            }

            if (!finalAudioUrl) {
                throw new Error('No se pudo obtener la URL del audio');
            }

            // CRÍTICO: Usamos fetchWithRetry para robustez
            const audioResponse = await fetchWithRetry(finalAudioUrl);
            const audioBuffer = await audioResponse.arrayBuffer();

            const tempDir = path.join(process.cwd(), 'tmp');
            await fs.mkdir(tempDir, { recursive: true });
            const tempAudioPath = path.join(tempDir, `audio_${Date.now()}.ogg`);
            await fs.writeFile(tempAudioPath, Buffer.from(audioBuffer));

            try {
                const { createReadStream } = await import('fs');
                const audioStream = createReadStream(tempAudioPath);

                const transcription = await this.openai.audio.transcriptions.create({
                    file: audioStream as any,
                    model: 'whisper-1',
                    language: 'es'
                });

                return transcription.text || 'No se pudo transcribir el audio';
            } finally {
                await fs.unlink(tempAudioPath).catch(() => {});
            }

        } catch (error: any) {
            this.terminalLog.voiceError(userName || userId, error.message);
            throw error; // Relanzamos el error para que el llamador lo maneje
        }
    }

    public async analyzeImage(
        imageUrl: string | undefined,
        userId: string,
        userName?: string,
        messageId?: string
    ): Promise<string> {
        try {
            let finalImageUrl = imageUrl;

            if (!finalImageUrl && messageId) {
                finalImageUrl = await this.fetchMediaUrl(messageId, 'image');
            }

            if (!finalImageUrl || !finalImageUrl.startsWith('http')) {
                throw new Error('URL de imagen inválida o no disponible');
            }

            const visionResponse = await this.openai.chat.completions.create({
                model: process.env.IMAGE_ANALYSIS_MODEL || 'gpt-4o-mini',
                messages: [{
                    role: 'user',
                    content: [
                        { 
                            type: 'text', 
                            text: 'Analiza esta imagen en el contexto de un hotel. Describe brevemente qué ves, enfocándote en: habitaciones, instalaciones, documentos, o cualquier elemento relevante para consultas hoteleras. Máximo 100 palabras.' 
                        },
                        { 
                            type: 'image_url', 
                            image_url: { 
                                url: finalImageUrl,
                                detail: 'low'
                            } 
                        }
                    ]
                }],
                max_tokens: 150,
                temperature: 0.3
            });

            return visionResponse.choices[0].message.content || 'Imagen recibida';

        } catch (error: any) {
            this.terminalLog.imageError(userName || userId, error.message);
            throw error;
        }
    }

    private async fetchMediaUrl(messageId: string, mediaType: 'audio' | 'image'): Promise<string | undefined> {
        const url = `${this.config.secrets.WHAPI_API_URL}/messages/${messageId}`;
        const options = {
            headers: { 'Authorization': `Bearer ${this.config.secrets.WHAPI_TOKEN}` }
        };

        // CRÍTICO: Usamos fetchWithRetry para obtener la URL del medio
        const response = await fetchWithRetry(url, options);
        const data = await response.json() as WHAPIMessage;

        if (mediaType === 'audio') {
            return data.audio?.link || data.voice?.link || data.ptt?.link;
        }
        if (mediaType === 'image') {
            return data.image?.link;
        }
        return undefined;
    }
}