// src/core/services/media.service.ts
import { promises as fs } from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { TerminalLog } from '../utils/terminal-log';
import { downloadWithRetry, openAIWithRetry, fetchWithRetry, NoRetryError } from '../utils/retry-utils';
import { IMediaService } from '../../shared/interfaces';
import { MediaProcessingResult, MediaType, WHAPIMessage } from '../../shared/types';

export interface MediaServiceConfig {
    openaiApiKey: string;
    whapiApiUrl?: string;
    whapiToken?: string;
    maxFileSize?: number;
    supportedImageTypes?: string[];
    supportedAudioTypes?: string[];
    tempDir?: string;
}

export class MediaService implements IMediaService {
    private config: Required<MediaServiceConfig>;
    private openai: OpenAI;

    constructor(
        private terminalLog: TerminalLog,
        config: MediaServiceConfig
    ) {
        this.config = {
            openaiApiKey: config.openaiApiKey,
            whapiApiUrl: config.whapiApiUrl ?? '',
            whapiToken: config.whapiToken ?? '',
            maxFileSize: config.maxFileSize ?? 25 * 1024 * 1024, // 25MB
            supportedImageTypes: config.supportedImageTypes ?? ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
            supportedAudioTypes: config.supportedAudioTypes ?? ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg'],
            tempDir: config.tempDir ?? './temp'
        };
        
        this.openai = new OpenAI({
            apiKey: this.config.openaiApiKey
        });
    }

    async transcribeAudio(audioUrl: string, userId: string): Promise<MediaProcessingResult> {
        const startTime = Date.now();
        
        try {
            const shortUserId = userId.split('@')[0];
            this.terminalLog.processingVoice(shortUserId);
            
            return await this.legacyTranscribeAudio(audioUrl, userId);
        } catch (error) {
            const duration = Date.now() - startTime;
            const shortUserId = userId.split('@')[0];
            this.terminalLog.voiceError(shortUserId, error instanceof Error ? error.message : 'Unknown error');
            
            return {
                success: false,
                type: 'audio' as MediaType,
                error: error instanceof Error ? error.message : 'Unknown transcription error',
                metadata: {
                    processingTime: duration,
                    attemptedUrl: audioUrl
                }
            };
        }
    }
    
    public async legacyTranscribeAudio(
        audioUrl: string | undefined,
        userId: string,
        userName?: string,
        messageId?: string
    ): Promise<MediaProcessingResult> {
        const startTime = Date.now();
        try {
            let finalAudioUrl = audioUrl;

            if (!finalAudioUrl && messageId) {
                finalAudioUrl = await this.fetchMediaUrl(messageId, 'audio');
            }

            if (!finalAudioUrl) {
                throw new Error('No se pudo obtener la URL del audio');
            }

            // Download with retry and validation
            const audioResponse = await downloadWithRetry(finalAudioUrl, 30000, {
                maxRetries: 3
            });
            
            // Validate response
            const contentType = audioResponse.headers.get('content-type') || '';
            const contentLength = parseInt(audioResponse.headers.get('content-length') || '0');
            
            if (contentLength > this.config.maxFileSize) {
                throw new NoRetryError(`Audio file too large: ${contentLength} bytes`);
            }
            
            const audioBuffer = await audioResponse.arrayBuffer();

            const tempDir = path.join(process.cwd(), this.config.tempDir);
            await fs.mkdir(tempDir, { recursive: true });
            const tempAudioPath = path.join(tempDir, `audio_${Date.now()}.ogg`);
            await fs.writeFile(tempAudioPath, Buffer.from(audioBuffer));

            try {
                const { createReadStream } = await import('fs');
                const audioStream = createReadStream(tempAudioPath);

                // Use openAIWithRetry for the transcription
                const transcription = await openAIWithRetry(
                    () => this.openai.audio.transcriptions.create({
                        file: audioStream as any,
                        model: 'whisper-1',
                        language: 'es'
                    }),
                    {
                        maxRetries: 3,
                        baseDelay: 1000,
                        maxDelay: 8000
                    }
                );

                const duration = Date.now() - startTime;
                const text = transcription.text || 'No se pudo transcribir el audio';
                
                // 📤 NUEVO: Log completo de transcripción de audio
                const compactTranscription = text
                    .replace(/\n/g, '\\n')
                    .replace(/\t/g, '\\t')
                    .replace(/\s+/g, ' ')
                    .trim();
                
                const shortUserId = userId.split('@')[0];
                this.terminalLog.info(`[AUDIO_TRANSCRIPTION_FULL] Transcripción completa: ${compactTranscription} | Usuario: ${shortUserId} | Duración: ${duration}ms | Tamaño: ${audioBuffer.byteLength} bytes`);
                
                return {
                    success: true,
                    type: 'audio' as MediaType,
                    result: text,
                    metadata: {
                        duration: null,
                        language: 'es',
                        processingTime: duration,
                        fileSize: audioBuffer.byteLength
                    }
                };
            } finally {
                await fs.unlink(tempAudioPath).catch(() => {});
            }

        } catch (error: any) {
            const duration = Date.now() - startTime;
            this.terminalLog.voiceError(userName || userId, error.message);
            
            return {
                success: false,
                type: 'audio' as MediaType,
                error: error.message,
                metadata: {
                    processingTime: duration,
                    attemptedUrl: audioUrl
                }
            };
        }
    }

    async analyzeImage(imageUrl: string, userId: string, prompt?: string): Promise<MediaProcessingResult> {
        const startTime = Date.now();
        
        try {
            this.terminalLog.info(`Starting image analysis for ${userId}`);
            
            return await this.legacyAnalyzeImage(imageUrl, userId, undefined, undefined);
        } catch (error) {
            const duration = Date.now() - startTime;
            this.terminalLog.imageError(userId, error instanceof Error ? error.message : 'Unknown error');
            
            return {
                success: false,
                type: 'image' as MediaType,
                error: error instanceof Error ? error.message : 'Unknown image analysis error',
                metadata: {
                    processingTime: duration,
                    attemptedUrl: imageUrl
                }
            };
        }
    }
    
    public async legacyAnalyzeImage(
        imageUrl: string | undefined,
        userId: string,
        userName?: string,
        messageId?: string
    ): Promise<MediaProcessingResult> {
        const startTime = Date.now();
        try {
            let finalImageUrl = imageUrl;

            if (!finalImageUrl && messageId) {
                finalImageUrl = await this.fetchMediaUrl(messageId, 'image');
            }

            if (!finalImageUrl || !finalImageUrl.startsWith('http')) {
                throw new Error('URL de imagen inválida o no disponible');
            }

            // Use openAIWithRetry for vision API con Responses API
            const visionResponse = await openAIWithRetry(
                () => this.openai.responses.create({
                    model: process.env.IMAGE_ANALYSIS_MODEL || 'gpt-4o-mini',
                    input: [{
                        type: 'message',
                        role: 'user',
                        content: [
                            { 
                                type: 'input_text', 
                                text: 'Analiza esta imagen en el contexto de un hotel. Describe brevemente qué ves, enfocándote en: habitaciones, instalaciones, documentos, o cualquier elemento relevante para consultas hoteleras. Máximo 100 palabras.' 
                            },
                            { 
                                type: 'input_image' as const, 
                                image: finalImageUrl
                            } as any
                        ]
                    }],
                    max_output_tokens: 150,
                    temperature: 0.3
                }),
                {
                    maxRetries: 3,
                    baseDelay: 1000,
                    maxDelay: 10000
                }
            );

            // Acceder al contenido usando la nueva estructura de Responses API
            const outputMessage = visionResponse.output?.[0];
            let analysis = 'Imagen recibida';
            
            if (outputMessage?.type === 'message' && outputMessage.content?.[0]?.type === 'output_text') {
                analysis = outputMessage.content[0].text || 'Imagen recibida';
            }
            const duration = Date.now() - startTime;
            
            return {
                success: true,
                type: 'image' as MediaType,
                result: analysis,
                metadata: {
                    processingTime: duration,
                    tokensUsed: visionResponse.usage?.total_tokens || null,
                    model: process.env.IMAGE_ANALYSIS_MODEL || 'gpt-4o-mini'
                }
            };

        } catch (error: any) {
            const duration = Date.now() - startTime;
            this.terminalLog.imageError(userName || userId, error.message);
            
            return {
                success: false,
                type: 'image' as MediaType,
                error: error.message,
                metadata: {
                    processingTime: duration,
                    attemptedUrl: imageUrl
                }
            };
        }
    }

    async processMedia(mediaUrl: string, mediaType: MediaType, userId: string, additionalPrompt?: string): Promise<MediaProcessingResult> {
        switch (mediaType) {
            case 'audio':
                return this.transcribeAudio(mediaUrl, userId);
            case 'image':
                return this.analyzeImage(mediaUrl, userId, additionalPrompt);
            default:
                return {
                    success: false,
                    type: mediaType,
                    error: `Unsupported media type: ${mediaType}`,
                    metadata: {
                        attemptedUrl: mediaUrl
                    }
                };
        }
    }
    
    private async fetchMediaUrl(messageId: string, mediaType: 'audio' | 'image'): Promise<string | undefined> {
        const url = `${this.config.whapiApiUrl}/messages/${messageId}`;
        const options = {
            headers: { 'Authorization': `Bearer ${this.config.whapiToken}` }
        };

        // Use fetchWithRetry for fetching media URL  
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
    
    // Utility methods
    isAudioSupported(mimeType: string): boolean {
        return this.config.supportedAudioTypes.includes(mimeType);
    }

    isImageSupported(mimeType: string): boolean {
        return this.config.supportedImageTypes.includes(mimeType);
    }

    getMaxFileSize(): number {
        return this.config.maxFileSize;
    }
    
    async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
        try {
            const testResponse = await openAIWithRetry(
                () => fetch('https://api.openai.com/v1/models', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.config.openaiApiKey}`,
                    }
                }),
                { maxRetries: 1, baseDelay: 1000 }
            );

            if (testResponse.ok) {
                return {
                    status: 'healthy',
                    details: {
                        openaiConnectivity: 'ok',
                        maxFileSize: this.config.maxFileSize,
                        supportedAudioTypes: this.config.supportedAudioTypes.length,
                        supportedImageTypes: this.config.supportedImageTypes.length
                    }
                };
            } else {
                throw new Error(`API returned status ${testResponse.status}`);
            }
        } catch (error) {
            return {
                status: 'unhealthy',
                details: {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    openaiConnectivity: 'failed'
                }
            };
        }
    }
}