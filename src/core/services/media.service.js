"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaService = void 0;
// src/core/services/media.service.ts
const fs_1 = require("fs");
const path_1 = require("path");
const openai_1 = require("openai");
const retry_utils_1 = require("../utils/retry-utils");
class MediaService {
    constructor(terminalLog, config) {
        this.terminalLog = terminalLog;
        this.config = {
            openaiApiKey: config.openaiApiKey,
            whapiApiUrl: config.whapiApiUrl ?? '',
            whapiToken: config.whapiToken ?? '',
            maxFileSize: config.maxFileSize ?? 25 * 1024 * 1024, // 25MB
            supportedImageTypes: config.supportedImageTypes ?? ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
            supportedAudioTypes: config.supportedAudioTypes ?? ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg'],
            tempDir: config.tempDir ?? './temp'
        };
        this.openai = new openai_1.default({
            apiKey: this.config.openaiApiKey
        });
    }
    async transcribeAudio(audioUrl, userId) {
        const startTime = Date.now();
        try {
            const shortUserId = userId.split('@')[0];
            this.terminalLog.processingVoice(shortUserId);
            return await this.legacyTranscribeAudio(audioUrl, userId);
        }
        catch (error) {
            const duration = Date.now() - startTime;
            const shortUserId = userId.split('@')[0];
            this.terminalLog.voiceError(shortUserId, error instanceof Error ? error.message : 'Unknown error');
            return {
                success: false,
                type: 'audio',
                error: error instanceof Error ? error.message : 'Unknown transcription error',
                metadata: {
                    processingTime: duration,
                    attemptedUrl: audioUrl
                }
            };
        }
    }
    async legacyTranscribeAudio(audioUrl, userId, userName, messageId) {
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
            const audioResponse = await (0, retry_utils_1.downloadWithRetry)(finalAudioUrl, 30000, {
                maxRetries: 3
            });
            // Validate response
            const contentType = audioResponse.headers.get('content-type') || '';
            const contentLength = parseInt(audioResponse.headers.get('content-length') || '0');
            if (contentLength > this.config.maxFileSize) {
                throw new retry_utils_1.NoRetryError(`Audio file too large: ${contentLength} bytes`);
            }
            const audioBuffer = await audioResponse.arrayBuffer();
            const tempDir = path_1.default.join(process.cwd(), this.config.tempDir);
            await fs_1.promises.mkdir(tempDir, { recursive: true });
            const tempAudioPath = path_1.default.join(tempDir, `audio_${Date.now()}.ogg`);
            await fs_1.promises.writeFile(tempAudioPath, Buffer.from(audioBuffer));
            try {
                const { createReadStream } = await Promise.resolve().then(() => require('fs'));
                const audioStream = createReadStream(tempAudioPath);
                // Use openAIWithRetry for the transcription
                const transcription = await (0, retry_utils_1.openAIWithRetry)(() => this.openai.audio.transcriptions.create({
                    file: audioStream,
                    model: 'whisper-1',
                    language: 'es'
                }), {
                    maxRetries: 3,
                    baseDelay: 1000,
                    maxDelay: 8000
                });
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
                    type: 'audio',
                    result: text,
                    metadata: {
                        duration: null,
                        language: 'es',
                        processingTime: duration,
                        fileSize: audioBuffer.byteLength
                    }
                };
            }
            finally {
                await fs_1.promises.unlink(tempAudioPath).catch(() => { });
            }
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.terminalLog.voiceError(userName || userId, error.message);
            return {
                success: false,
                type: 'audio',
                error: error.message,
                metadata: {
                    processingTime: duration,
                    attemptedUrl: audioUrl
                }
            };
        }
    }
    async analyzeImage(imageUrl, userId, prompt) {
        const startTime = Date.now();
        try {
            this.terminalLog.info(`Starting image analysis for ${userId}`);
            return await this.legacyAnalyzeImage(imageUrl, userId, undefined, undefined);
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.terminalLog.imageError(userId, error instanceof Error ? error.message : 'Unknown error');
            return {
                success: false,
                type: 'image',
                error: error instanceof Error ? error.message : 'Unknown image analysis error',
                metadata: {
                    processingTime: duration,
                    attemptedUrl: imageUrl
                }
            };
        }
    }
    async legacyAnalyzeImage(imageUrl, userId, userName, messageId) {
        const startTime = Date.now();
        try {
            let finalImageUrl = imageUrl;
            if (!finalImageUrl && messageId) {
                finalImageUrl = await this.fetchMediaUrl(messageId, 'image');
            }
            if (!finalImageUrl || !finalImageUrl.startsWith('http')) {
                throw new Error('URL de imagen inválida o no disponible');
            }
            this.terminalLog.info(`[IMAGE_ANALYSIS_START] Iniciando análisis de imagen | Usuario: ${userName || userId} | URL: ${finalImageUrl.substring(0, 50)}...`);
            // Use openAIWithRetry for vision API con Responses API
            const visionResponse = await (0, retry_utils_1.openAIWithRetry)(() => this.openai.responses.create({
                model: process.env.OPENAI_MODEL || 'gpt-5', // ACTUALIZADO: Usar modelo principal en lugar de 4o-mini
                input: [{
                        type: 'message',
                        role: 'user',
                        content: [
                            {
                                type: 'input_text',
                                text: 'Analiza esta imagen en el contexto de un hotel. Describe brevemente qué ves, enfocándote en: habitaciones, instalaciones, documentos, o cualquier elemento relevante para consultas hoteleras. Máximo 100 palabras.'
                            },
                            {
                                type: 'input_image',
                                image: finalImageUrl
                            }
                        ]
                    }],
                max_output_tokens: 150,
                temperature: 0.3
            }), {
                maxRetries: 3,
                baseDelay: 1000,
                maxDelay: 10000
            });
            // Acceder al contenido usando la nueva estructura de Responses API
            const outputMessage = visionResponse.output?.[0];
            let analysis = 'Imagen recibida';
            if (outputMessage?.type === 'message' && outputMessage.content?.[0]?.type === 'output_text') {
                analysis = outputMessage.content[0].text || 'Imagen recibida';
            }
            const duration = Date.now() - startTime;
            this.terminalLog.info(`[IMAGE_ANALYSIS_SUCCESS] Análisis completado | Usuario: ${userName || userId} | Duración: ${duration}ms | Tokens: ${visionResponse.usage?.total_tokens || 0} | Resultado: ${analysis.substring(0, 100)}...`);
            return {
                success: true,
                type: 'image',
                result: analysis,
                metadata: {
                    processingTime: duration,
                    tokensUsed: visionResponse.usage?.total_tokens || null,
                    model: process.env.OPENAI_MODEL || 'gpt-5'
                }
            };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.terminalLog.imageError(userName || userId, error.message);
            return {
                success: false,
                type: 'image',
                error: error.message,
                metadata: {
                    processingTime: duration,
                    attemptedUrl: imageUrl
                }
            };
        }
    }
    async processMedia(mediaUrl, mediaType, userId, additionalPrompt) {
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
    async fetchMediaUrl(messageId, mediaType) {
        const url = `${this.config.whapiApiUrl}/messages/${messageId}`;
        const options = {
            headers: { 'Authorization': `Bearer ${this.config.whapiToken}` }
        };
        // Use fetchWithRetry for fetching media URL  
        const response = await (0, retry_utils_1.fetchWithRetry)(url, options);
        const data = await response.json();
        if (mediaType === 'audio') {
            return data.audio?.link || data.voice?.link || data.ptt?.link;
        }
        if (mediaType === 'image') {
            return data.image?.link;
        }
        return undefined;
    }
    // Utility methods
    isAudioSupported(mimeType) {
        return this.config.supportedAudioTypes.includes(mimeType);
    }
    isImageSupported(mimeType) {
        return this.config.supportedImageTypes.includes(mimeType);
    }
    getMaxFileSize() {
        return this.config.maxFileSize;
    }
    async healthCheck() {
        try {
            const testResponse = await (0, retry_utils_1.openAIWithRetry)(() => fetch('https://api.openai.com/v1/models', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.config.openaiApiKey}`,
                }
            }), { maxRetries: 1, baseDelay: 1000 });
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
            }
            else {
                throw new Error(`API returned status ${testResponse.status}`);
            }
        }
        catch (error) {
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
exports.MediaService = MediaService;
