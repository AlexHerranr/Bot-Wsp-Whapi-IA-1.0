// src/core/services/whatsapp.service.ts
import OpenAI from 'openai';
import { TerminalLog } from '../utils/terminal-log';
import { fetchWithRetry } from '../utils/retry-utils';
import { getShortUserId } from '../utils/identifiers';
import { logInfo } from '../../utils/logging';
import { DatabaseService } from './database.service';

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
        private config: AppConfig,
        private databaseService: DatabaseService
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
        isQuoteOrPrice: boolean, // Lógica de validación que vendrá del plugin
        quotedMessageId?: string // ID del mensaje a citar/responder
    ): Promise<{ success: boolean; sentAsVoice: boolean }> {
        if (!message || message.trim() === '') {
            this.terminalLog.error(`Intento de enviar mensaje vacío a ${chatId}`);
            return { success: false, sentAsVoice: false }; // No se envió nada
        }

        const shouldUseVoice = process.env.ENABLE_VOICE_RESPONSES === 'true' && userState.lastInputVoice && !isQuoteOrPrice;

        if (shouldUseVoice) {
            try {
                const voiceSuccess = await this.sendVoiceMessage(chatId, message);
                if (voiceSuccess) {
                    return { success: true, sentAsVoice: true }; // Indica que se envió exitosamente en voz
                }
            } catch (error) {
                this.terminalLog.warning(`Fallo al enviar voz a ${getShortUserId(chatId)}, no se envía texto para evitar duplicado.`);
                // NO hacer fallback automático - retornar fallo para que bot.ts maneje
                return { success: false, sentAsVoice: false }; // Indica que falló el envío de voz
            }
        }

        // Si llega aquí, se envía como texto (no resetea flag de voz)
        const textSuccess = await this.sendTextMessage(chatId, message, isQuoteOrPrice, quotedMessageId);
        return { success: textSuccess, sentAsVoice: false }; // false indica que NO se envió como voz
    }

    private async sendVoiceMessage(chatId: string, message: string): Promise<boolean> {
        const shortUserId = getShortUserId(chatId);
        const messageLength = message.length;
        const startTime = Date.now();

        
        const ttsResponse = await this.openai.audio.speech.create({
            model: 'tts-1',
            voice: 'nova',
            input: message.substring(0, 4000), // Límite de TTS
            response_format: 'mp3'
        });
        const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());
        const base64Audio = audioBuffer.toString('base64');
        const audioDataUrl = `data:audio/mp3;base64,${base64Audio}`;
        const response = await fetchWithRetry(`${this.config.secrets.WHAPI_API_URL}/messages/voice`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.secrets.WHAPI_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ to: chatId, media: audioDataUrl })
        });

        // Verificar si la respuesta es exitosa
        if (!response.ok) {
            const errorText = await response.text();
            logInfo('VOICE_SEND_ERROR', 'Error en respuesta de WHAPI para voz, pero mensaje podría haberse enviado', {
                userId: shortUserId,
                status: response.status,
                statusText: response.statusText,
                errorText: errorText.substring(0, 200),
                chatId
            });
            
            // WHAPI a veces devuelve errores pero el mensaje se envía exitosamente
            // Solo fallar en errores críticos (5xx o timeouts)
            if (response.status >= 500) {
                throw new Error(`WHAPI critical error: ${response.status} ${response.statusText}`);
            } else {
                // Para errores 4xx, asumir que el mensaje se envió (common WHAPI behavior)
                logInfo('VOICE_IGNORE_ERROR', 'Ignorando error WHAPI 4xx, asumiendo envío exitoso', {
                    userId: shortUserId,
                    status: response.status,
                    chatId
                });
            }
        }

        const duration = Date.now() - startTime;
        
        // Obtener nombre del contacto de la base de datos
        const threadData = await this.databaseService.getThread(shortUserId);
        const contactName = threadData?.userName || shortUserId;
        
        // Log: Voz enviada exitosamente
        this.terminalLog.voiceSent(contactName, duration);
        
        // Log estructurado para voz enviada
        logInfo('VOICE_SENT', 'Nota de voz enviada exitosamente', {
            userId: shortUserId,
            chatId,
            duration,
            audioSizeKB: Math.round(audioBuffer.length / 1024),
            messageLength: message.length,
            success: true
        });

        return true;
    }

    private async sendTextMessage(chatId: string, message: string, isQuoteOrPrice: boolean = false, quotedMessageId?: string): Promise<boolean> {
        // Don't chunk quotes/prices, but allow chunking by paragraphs regardless of length
        const chunks = isQuoteOrPrice ? [message] : this.splitMessageIntelligently(message);
        
        // Log división en chunks
        if (chunks.length > 1) {
            logInfo('MESSAGE_CHUNKS', 'Mensaje dividido en chunks', {
                userId: getShortUserId(chatId),
                chatId,
                totalChunks: chunks.length,
                totalLength: message.length,
                chunkLengths: chunks.map(chunk => chunk.length),
                isQuoteOrPrice,
                divisionReason: message.includes('\n\n') ? 'paragraphs' : 'bullet_lists'
            });
        }

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            
            // Log detallado de cada chunk individual con preview de 20 palabras
            const chunk20Words = chunk.split(' ').slice(0, 20).join(' ') + (chunk.split(' ').length > 20 ? '...' : '');
            logInfo('WHAPI_CHUNK_SEND', `Enviando chunk ${i+1}/${chunks.length}`, {
                userId: chatId,
                chunkNumber: i + 1,
                totalChunks: chunks.length,
                chunkLength: chunk.length,
                preview: chunk20Words,
                isFirstChunk: i === 0,
                hasQuoted: i === 0 && !!quotedMessageId
            });
            
            // Si no es el primer chunk, mostrar indicador de escritura
            if (i > 0) {
                await this.sendTypingIndicator(chatId);
                
                // Calcular delay humano basado en velocidad de escritura real
                const humanDelay = this.calculateHumanTypingDelay(chunk.length);
                await new Promise(resolve => setTimeout(resolve, humanDelay));
            }

            const typingTime = i === 0 ? 3 : 2; // 3s para el primer mensaje, 2s para los siguientes

            // Construir el cuerpo del mensaje
            const messageBody: any = { 
                to: chatId, 
                body: chunk, 
                typing_time: typingTime 
            };

            // Solo agregar quoted en el primer chunk si se proporciona
            if (i === 0 && quotedMessageId) {
                messageBody.quoted = quotedMessageId;
            }

            await fetchWithRetry(`${this.config.secrets.WHAPI_API_URL}/messages/text`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.secrets.WHAPI_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(messageBody)
            });
        }
        return true;
    }

    private splitMessageIntelligently(message: string): string[] {
        let chunks: string[] = [];
        
        // Primero intentar dividir por doble salto de línea (párrafos)
        const paragraphs = message.split(/\n\n+/).map(chunk => chunk.trim()).filter(chunk => chunk.length > 0);
        
        // Si hay párrafos claramente separados, usarlos
        if (paragraphs.length > 1) {
            chunks = paragraphs;
        } else {
            // Si no hay párrafos, buscar listas con bullets
            const lines = message.split('\n');
            let currentChunk = '';
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const nextLine = lines[i + 1];
                
                // Si la línea actual termina con ":" y la siguiente empieza con bullet
                if (line.endsWith(':') && nextLine && nextLine.trim().match(/^[•\-\*]/)) {
                    // Agregar la línea de título al chunk actual
                    if (currentChunk) {
                        chunks.push(currentChunk.trim());
                        currentChunk = '';
                    }
                    currentChunk += line + '\n';
                    
                    // Recopilar todas las líneas de bullet siguientes
                    let j = i + 1;
                    while (j < lines.length && lines[j].trim().match(/^[•\-\*]/)) {
                        currentChunk += lines[j] + '\n';
                        j++;
                    }
                    i = j - 1; // Ajustar el índice
                } else {
                    currentChunk += line + '\n';
                }
            }
            
            if (currentChunk.trim()) {
                chunks.push(currentChunk.trim());
            }
            
            // Si no se encontraron patrones especiales, usar mensaje completo
            if (chunks.length === 0) {
                chunks = [message];
            }
        }
        
        // Filtrar chunks vacíos y muy pequeños
        chunks = chunks.filter(chunk => chunk.trim().length > 0);
        
        // Si solo hay un chunk, no dividir
        if (chunks.length <= 1) {
            return [message];
        }
        
        return chunks;
    }

    /**
     * Calcula un delay humano realista basado en velocidad de escritura
     * Velocidades promedio:
     * - Escritura rápida: 40-50 WPM (palabras por minuto) = ~200-250 chars/min
     * - Escritura promedio: 25-35 WPM = ~125-175 chars/min  
     * - Escritura lenta/pensando: 15-25 WPM = ~75-125 chars/min
     */
    private calculateHumanTypingDelay(textLength: number): number {
        // Configuración de velocidades (caracteres por segundo)
        const TYPING_SPEEDS = {
            FAST: 4.2,      // ~250 chars/min
            NORMAL: 2.9,    // ~175 chars/min  
            SLOW: 2.1       // ~125 chars/min
        };

        // Usar velocidad normal como base
        const baseTypingTime = (textLength / TYPING_SPEEDS.NORMAL) * 1000;
        
        // Agregar variabilidad humana (+/- 20%)
        const variability = 0.2;
        const randomFactor = 1 + (Math.random() - 0.5) * variability;
        
        // Agregar pausas por complejidad del texto
        const pauseTime = this.calculateThinkingPauses(textLength);
        
        const totalDelay = (baseTypingTime * randomFactor) + pauseTime;
        
        // Límites razonables: mínimo 1s, máximo 8s
        return Math.max(1000, Math.min(8000, Math.round(totalDelay)));
    }

    /**
     * Calcula pausas adicionales simulando "tiempo de pensamiento"
     */
    private calculateThinkingPauses(textLength: number): number {
        // Pausas por puntuación y estructura
        const shortPause = 300;   // Por comas, puntos
        const mediumPause = 700;  // Por párrafos, ideas
        const longPause = 1200;   // Por contenido complejo
        
        if (textLength < 50) return shortPause;
        if (textLength < 150) return mediumPause;
        return longPause;
    }

    public async getChatInfo(chatId: string): Promise<{ name?: string; labels?: Array<{ id?: string; name: string; color?: string }> } | null> {
        try {
            const response = await fetchWithRetry(`${this.config.secrets.WHAPI_API_URL}/chats/${encodeURIComponent(chatId)}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.config.secrets.WHAPI_TOKEN}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                console.warn(`⚠️ Error ${response.status} obteniendo chat info para ${chatId}`);
                return null;
            }

            const chatInfo = await response.json() as any;
            return {
                name: chatInfo.name || chatInfo.last_message?.from_name || null,
                labels: chatInfo.labels || []
            };
        } catch (error) {
            console.warn(`⚠️ Error obteniendo chat info para ${chatId}:`, error);
            return null;
        }
    }
}

// Constante que moveremos a `constants.ts` más adelante
const MAX_MESSAGE_LENGTH = 4096;