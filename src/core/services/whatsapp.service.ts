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
    ): Promise<{ success: boolean; sentAsVoice: boolean; messageIds?: string[] }> {
        if (!message || message.trim() === '') {
            this.terminalLog.error(`Intento de enviar mensaje vacío a ${chatId}`);
            return { success: false, sentAsVoice: false }; // No se envió nada
        }

        const shouldUseVoice = process.env.ENABLE_VOICE_RESPONSES === 'true' && userState.lastInputVoice && !isQuoteOrPrice;

        if (shouldUseVoice) {
            try {
                const voiceResult = await this.sendVoiceMessage(chatId, message, quotedMessageId);
                if (voiceResult.success) {
                    return { success: true, sentAsVoice: true, messageIds: voiceResult.messageIds };
                }
            } catch (error) {
                this.terminalLog.warning(`Fallo al enviar voz a ${getShortUserId(chatId)}, no se envía texto para evitar duplicado.`);
                // NO hacer fallback automático - retornar fallo para que bot.ts maneje
                return { success: false, sentAsVoice: false };
            }
        }

        // Si llega aquí, se envía como texto (no resetea flag de voz)
        const textResult = await this.sendTextMessage(chatId, message, isQuoteOrPrice, quotedMessageId);
        return { success: textResult.success, sentAsVoice: false, messageIds: textResult.messageIds };
    }

    private async sendVoiceMessage(chatId: string, message: string, quotedMessageId?: string): Promise<{ success: boolean; messageIds: string[] }> {
        const shortUserId = getShortUserId(chatId);
        const startTimeTotal = Date.now();

        // 1) Dividir inteligentemente por párrafos y oraciones (para notas múltiples)
        const voiceChunks = this.splitMessageForVoice(message);
        let totalSizeKb = 0;

        const collectedIds: string[] = [];
        for (let i = 0; i < voiceChunks.length; i++) {
            const chunk = voiceChunks[i].slice(0, 8000); // límite seguro para TTS

            // Presencia de grabando antes de cada nota
            await this.sendRecordingIndicator(chatId);
            logInfo('INDICATOR_SENT', 'Indicador de grabación enviado exitosamente', {
                userId: shortUserId,
                chatId,
                indicatorType: 'recording',
                part: i + 1,
                totalParts: voiceChunks.length
            });

            const startTime = Date.now();
            const ttsResponse = await this.openai.audio.speech.create({
                model: 'tts-1',
                voice: 'nova',
                input: chunk,
                response_format: 'mp3'
            });

            const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());
            const base64Audio = audioBuffer.toString('base64');
            const audioDataUrl = `data:audio/mp3;base64,${base64Audio}`;

            const payload: any = { to: chatId, media: audioDataUrl };
            if (i === 0 && quotedMessageId) {
                payload.quoted = quotedMessageId;
            }

            const response = await fetchWithRetry(`${this.config.secrets.WHAPI_API_URL}/messages/voice`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.secrets.WHAPI_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                logInfo('VOICE_SEND_ERROR', 'Error en respuesta de WHAPI para voz, pero mensaje podría haberse enviado', {
                    userId: shortUserId,
                    status: response.status,
                    statusText: response.statusText,
                    errorText: errorText.substring(0, 200),
                    chatId
                });
                if (response.status >= 500) {
                    throw new Error(`WHAPI critical error: ${response.status} ${response.statusText}`);
                }
            } else {
                // Intentar extraer ID(s) del mensaje
                try {
                    const data: any = await response.clone().json();
                    // Formatos comunes: { id }, { messages: [{ id }, ...] }
                    if (data) {
                        if (Array.isArray(data.messages)) {
                            for (const m of data.messages) {
                                if (m?.id) collectedIds.push(String(m.id));
                            }
                        } else if (data.id) {
                            collectedIds.push(String(data.id));
                        }
                    }
                } catch {
                    // Ignorar si no es JSON
                }
            }

            const duration = Date.now() - startTime;
            totalSizeKb += Math.round(audioBuffer.length / 1024);

            // Log por cada nota
            logInfo('VOICE_SENT_PART', 'Nota de voz enviada', {
                userId: shortUserId,
                chatId,
                part: i + 1,
                totalParts: voiceChunks.length,
                duration,
                audioSizeKB: Math.round(audioBuffer.length / 1024),
                chunkLength: chunk.length
            });

            // Pausa humana corta entre notas
            await new Promise(resolve => setTimeout(resolve, 800));
        }

        // Log final consolidado
        const totalDuration = Date.now() - startTimeTotal;
        const threadData = await this.databaseService.getThread(shortUserId);
        const contactName = threadData?.userName || shortUserId;
        this.terminalLog.voiceSent(contactName, totalDuration);
        logInfo('VOICE_SENT', 'Notas de voz enviadas exitosamente', {
            userId: shortUserId,
            chatId,
            totalDuration,
            totalAudioSizeKB: totalSizeKb,
            parts: voiceChunks.length,
            messageLength: message.length,
            success: true
        });

        return { success: true, messageIds: collectedIds };
    }

    private async sendTextMessage(chatId: string, message: string, isQuoteOrPrice: boolean = false, quotedMessageId?: string): Promise<{ success: boolean; messageIds: string[] }> {
        // Regla simple: si hay párrafos separados por doble salto de línea, SIEMPRE enviar por párrafos.
        // Si no hay párrafos y es cotización/precio/link, enviar en un solo bloque.
        // En otros casos, usar división inteligente existente.
        const paragraphsFirst = message
            .split(/\n\n+/)
            .map(chunk => chunk.trim())
            .filter(chunk => chunk.length > 0);

        const chunks = paragraphsFirst.length > 1
            ? paragraphsFirst
            : (isQuoteOrPrice ? [message] : this.splitMessageIntelligently(message));
        
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

        const collectedIds: string[] = [];
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
            
            // Mostrar indicador de escritura antes de cada chunk (incluido el primero)
            await this.sendTypingIndicator(chatId);
            logInfo('INDICATOR_SENT', 'Indicador de escritura enviado exitosamente', {
                userId: getShortUserId(chatId),
                chatId,
                indicatorType: 'typing',
                chunkNumber: i + 1,
                totalChunks: chunks.length
            });
            
            // Delay humano simple antes de enviar el chunk
            const humanDelay = this.calculateHumanTypingDelay(chunk.length);
            await new Promise(resolve => setTimeout(resolve, humanDelay));

            const typingTime = 0; // Evitar doble espera: ya simulamos typing con presencia + delay

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

            const response = await fetchWithRetry(`${this.config.secrets.WHAPI_API_URL}/messages/text`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.secrets.WHAPI_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(messageBody)
            });
            // Intentar capturar ID del mensaje enviado por WHAPI
            try {
                const data: any = await response.clone().json();
                if (data) {
                    if (Array.isArray(data.messages)) {
                        for (const m of data.messages) {
                            if (m?.id) collectedIds.push(String(m.id));
                        }
                    } else if (data.id) {
                        collectedIds.push(String(data.id));
                    }
                }
            } catch {
                // Ignorar si no hay JSON o formato distinto
            }
        }
        return { success: true, messageIds: collectedIds };
    }

    // División específica para voz: primero párrafos, luego frases por puntuación.
    private splitMessageForVoice(message: string): string[] {
        const paragraphs = message
            .split(/\n\n+/)
            .map(p => p.trim())
            .filter(p => p.length > 0);

        const chunks: string[] = [];
        const sources = paragraphs.length > 0 ? paragraphs : [message];

        for (const block of sources) {
            // Dividir por fin de oración sin perder signos
            const sentences = block.match(/[^.!?\n]+[.!?]?/g) || [block];
            let current = '';
            for (const s of sentences) {
                const candidate = (current + ' ' + s).trim();
                // Limitar cada nota a ~700 caracteres para notas concisas
                if (candidate.length > 700 && current) {
                    chunks.push(current.trim());
                    current = s.trim();
                } else {
                    current = candidate;
                }
            }
            if (current.trim()) chunks.push(current.trim());
        }

        // Evitar exceso de partes: máximo 7 notas por mensaje
        const MAX_PARTS = 7;
        if (chunks.length > MAX_PARTS) {
            // Consolidar últimas en una sola
            const head = chunks.slice(0, MAX_PARTS - 1);
            const tail = chunks.slice(MAX_PARTS - 1).join(' ');
            return [...head, tail];
        }
        return chunks.length > 0 ? chunks : [message];
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
        // Versión simple: 1s para textos cortos, 2s para textos largos
        return textLength <= 160 ? 1000 : 2000;
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