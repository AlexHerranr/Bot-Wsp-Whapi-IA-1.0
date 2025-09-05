"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappService = void 0;
const retry_utils_1 = require("../utils/retry-utils");
const identifiers_1 = require("../utils/identifiers");
const logging_1 = require("../../utils/logging");
class WhatsappService {
    constructor(openai, terminalLog, config, databaseService, mediaManager) {
        this.openai = openai;
        this.terminalLog = terminalLog;
        this.config = config;
        this.databaseService = databaseService;
        this.mediaManager = mediaManager;
    }
    async sendTypingIndicator(chatId) {
        try {
            await (0, retry_utils_1.fetchWithRetry)(`${this.config.secrets.WHAPI_API_URL}/presences/${chatId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.config.secrets.WHAPI_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ presence: "typing", delay: 0 })
            });
        }
        catch (error) {
            this.terminalLog.whapiError('sendTypingIndicator', error.message);
        }
    }
    async sendRecordingIndicator(chatId) {
        try {
            await (0, retry_utils_1.fetchWithRetry)(`${this.config.secrets.WHAPI_API_URL}/presences/${chatId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.config.secrets.WHAPI_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ presence: "recording", delay: 0 })
            });
        }
        catch (error) {
            this.terminalLog.whapiError('sendRecordingIndicator', error.message);
        }
    }
    async sendWhatsAppMessage(chatId, message, // Soporte para attachments
    userState, isQuoteOrPrice, // Lógica de validación que vendrá del plugin
    quotedMessageId, // ID del mensaje a citar/responder  
    duringRunMsgId // ID para citación auto durante run activo
    ) {
        // Parsear mensaje y attachment si es objeto
        let actualMessage;
        let attachment = null;
        if (typeof message === 'object' && message !== null) {
            actualMessage = message.message || '';
            attachment = message.attachment;
        }
        else {
            actualMessage = message || '';
        }
        // Si hay attachment normal, enviarlo primero
        if (attachment && attachment.type === 'pdf') {
            (0, logging_1.logInfo)('ATTACHMENT_DETECTED', 'Enviando attachment PDF', {
                chatId,
                attachmentType: attachment.type,
                fileName: attachment.fileName,
                hasMessage: !!actualMessage,
                hasBuffer: !!attachment.pdfBuffer,
                hasFilePath: !!attachment.filePath
            });
            // SOLUCIÓN RAILWAY: Priorizar buffer over filePath
            let documentResult;
            if (attachment.pdfBuffer) {
                // Usar buffer directo (Railway compatible)
                documentResult = await this.sendDocumentFromBuffer(chatId, attachment.pdfBuffer, attachment.fileName, quotedMessageId || duringRunMsgId);
            }
            else if (attachment.filePath) {
                // Fallback a archivo físico (local)
                documentResult = await this.sendDocument(chatId, attachment.filePath, attachment.fileName, quotedMessageId || duringRunMsgId);
            }
            else {
                (0, logging_1.logInfo)('ATTACHMENT_NO_SOURCE', 'Attachment PDF sin buffer ni filePath', {
                    chatId,
                    attachment
                });
                documentResult = { success: false };
            }
            if (!documentResult.success) {
                (0, logging_1.logInfo)('ATTACHMENT_SEND_ERROR', 'Error enviando attachment', {
                    chatId,
                    attachmentType: attachment.type,
                    fileName: attachment.fileName
                });
                return { success: false, sentAsVoice: false };
            }
            // Si solo hay attachment sin mensaje, retornar éxito
            if (!actualMessage || actualMessage.trim() === '') {
                (0, logging_1.logInfo)('ATTACHMENT_ONLY_SENT', 'Solo attachment enviado exitosamente', {
                    chatId,
                    attachmentType: attachment.type,
                    fileName: attachment.fileName,
                    messageId: documentResult.messageId
                });
                return {
                    success: true,
                    sentAsVoice: false,
                    messageIds: documentResult.messageId ? [documentResult.messageId] : []
                };
            }
            // Si hay mensaje adicional, enviarlo después del attachment
            // Resetear quotedMessageId para evitar doble citación
            quotedMessageId = undefined;
            duringRunMsgId = undefined;
        }
        if (!actualMessage || actualMessage.trim() === '') {
            this.terminalLog.error(`Intento de enviar mensaje vacío a ${chatId}`);
            return { success: false, sentAsVoice: false };
        }
        // CITACIÓN AUTO: Priorizar duringRunMsgId sobre quotedMessageId
        let finalQuotedId = quotedMessageId; // User-quote primero
        if (duringRunMsgId) { // Sobrescribe si duringRun
            finalQuotedId = duringRunMsgId;
            (0, logging_1.logInfo)('QUOTE_AUTO_PRIORITY', 'Usando citación auto during run', {
                chatId,
                finalQuotedId,
                originalQuotedId: quotedMessageId
            });
        }
        const shouldUseVoice = process.env.ENABLE_VOICE_RESPONSES === 'true' && userState.lastInputVoice && !isQuoteOrPrice;
        // DETECCIÓN DINÁMICA DE HUMAN TIMING
        const operationsChatId = process.env.OPERATIONS_CHAT_ID;
        const isOperations = (chatId === operationsChatId);
        const enableHumanTiming = !isOperations; // Solo para Main, no para Operations
        // TIMING HUMANO: Log inicio
        const messageText = typeof message === 'string' ? message : message.message || '';
        (0, logging_1.logInfo)('TIMING_HUMAN_START', 'Iniciando timing por chunks', {
            chatId,
            totalLength: messageText.length,
            willUseVoice: shouldUseVoice,
            isOperations,
            enableHumanTiming,
            estimatedChunks: messageText.includes('\n\n') ? 'paragraphs' : 'normal'
        });
        let result;
        if (shouldUseVoice) {
            try {
                const voiceResult = await this.sendVoiceMessage(chatId, actualMessage, finalQuotedId, enableHumanTiming);
                if (voiceResult.success) {
                    result = { success: true, sentAsVoice: true, messageIds: voiceResult.messageIds };
                }
                else {
                    result = { success: false, sentAsVoice: false };
                }
            }
            catch (error) {
                this.terminalLog.warning(`Fallo al enviar voz a ${(0, identifiers_1.getShortUserId)(chatId)}, no se envía texto para evitar duplicado.`);
                // NO hacer fallback automático - retornar fallo para que bot.ts maneje
                result = { success: false, sentAsVoice: false };
            }
        }
        else {
            // Si llega aquí, se envía como texto (no resetea flag de voz)
            const textResult = await this.sendTextMessage(chatId, actualMessage, isQuoteOrPrice, finalQuotedId, enableHumanTiming);
            result = { success: textResult.success, sentAsVoice: false, messageIds: textResult.messageIds };
        }
        // TIMING HUMANO: Log final con delay total estimado (sin duplicar cálculos)
        const estimatedChunks = Math.ceil(actualMessage.length / 50); // Estimación simple sin re-chunking
        const estimatedTotalDelay = Math.ceil(actualMessage.length / 8) * 1000; // Total estimado
        const cappedTotalDelay = Math.min(estimatedTotalDelay, estimatedChunks * 2000); // Con cap por chunk
        (0, logging_1.logInfo)('TIMING_HUMAN_END', 'Timing humano completado', {
            chatId,
            estimatedTotalDelay: cappedTotalDelay,
            estimatedChunks: estimatedChunks,
            messageLength: actualMessage.length,
            type: shouldUseVoice ? 'voice' : 'text',
            success: result.success
        });
        return result;
    }
    async sendVoiceMessage(chatId, message, quotedMessageId, enableHumanTiming = true) {
        // CRÍTICO: Dedup simétrico - verificar si ya se envió como texto
        if (this.mediaManager.isBotSentContent(chatId, message)) {
            (0, logging_1.logInfo)('DUPLICATE_PREVENTED', 'Voz skipped - ya enviado como texto', { chatId, messagePreview: message.substring(0, 100) });
            return { success: true, messageIds: [] }; // Skip pero success=true
        }
        const shortUserId = (0, identifiers_1.getShortUserId)(chatId);
        const startTimeTotal = Date.now();
        // 1) Dividir inteligentemente por párrafos y oraciones (para notas múltiples)
        const voiceChunks = this.splitMessageForVoice(message);
        let totalSizeKb = 0;
        const collectedIds = [];
        for (let i = 0; i < voiceChunks.length; i++) {
            // ✅ Sanitizar IDs internos antes del TTS
            const sanitizedChunk = voiceChunks[i]
                .replace(/\[(?:th_|run_|msg_|thread_|asst_)[^\]]+\]/g, '')
                .trim();
            const chunk = sanitizedChunk.slice(0, 8000); // límite seguro para TTS
            const startTime = Date.now();
            // PASO 1: Generar TTS primero para conocer duración real
            const ttsResponse = await this.openai.audio.speech.create({
                model: 'gpt-4o-mini-tts',
                voice: 'coral',
                input: chunk,
                response_format: 'opus', // ← Más liviano para WhatsApp
                speed: 1.0,
                instructions: "Habla normal y natural, como conversación en persona. Acento Cartagena Colombia neutro, nada exagerado. Incluye pausas naturales tipo 'em...', 'pues...', como hablan las personas reales. Nada expresivo."
                // BACKUP - Configuración anterior (revertir si hay problemas):
                // model: 'tts-1-hd',
                // response_format: 'mp3',
                // (sin instructions parameter)
            });
            const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());
            const base64Audio = audioBuffer.toString('base64');
            const audioDataUrl = `data:audio/opus;base64,${base64Audio}`;
            // PASO 2: TIMING HUMANO - Calcular duración real del audio generado
            const estimatedWords = chunk.length / 5; // ~5 chars por palabra promedio español
            const speechRateWordsPerSecond = 2.8; // ~168 WPM para voz coral natural
            const audioDurationMs = Math.round((estimatedWords / speechRateWordsPerSecond) * 1000);
            (0, logging_1.logInfo)('AUDIO_DURATION_CALCULATED', 'Duración de audio calculada', {
                chunkLength: chunk.length,
                estimatedWords: Math.round(estimatedWords),
                audioDurationMs,
                audioSizeBytes: audioBuffer.length
            });
            // PASO 3: TIMING HUMANO - Usar duración del audio como delay natural
            if (i === 0 || voiceChunks.length > 1) { // Presencia en primero y si >1 chunk (natural)
                // Enviar presencia "grabando..." por la duración del audio
                await this.sendRecordingIndicator(chatId);
                (0, logging_1.logInfo)('PRESENCE_CHUNK_VOICE', `🎙️ch${i + 1}/${voiceChunks.length}:${audioDurationMs}ms`, {
                    chatId,
                    chunkIndex: i + 1,
                    totalChunks: voiceChunks.length,
                    audioDurationMs,
                    chunkLength: chunk.length
                });
                // Delay = duración del audio (natural) o instantáneo para Operations
                const maxDelayMs = 8000; // Cap máximo 8s por seguridad  
                const naturalDelayMs = Math.min(audioDurationMs, maxDelayMs);
                const finalDelayMs = enableHumanTiming ? naturalDelayMs : 0;
                await Promise.race([
                    new Promise(resolve => setTimeout(resolve, finalDelayMs)),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Voice chunk delay timeout')), maxDelayMs + 1000))
                ]).catch(err => (0, logging_1.logInfo)('VOICE_CHUNK_TIMEOUT', 'Timeout en delay voz chunk, continuando', {
                    chunkIndex: i + 1,
                    audioDurationMs: finalDelayMs,
                    error: err.message
                }));
            }
            else {
                // Para chunks secundarios sin delay extra, solo presencia original
                await this.sendRecordingIndicator(chatId);
            }
            (0, logging_1.logInfo)('INDICATOR_SENT', 'Indicador de grabación enviado exitosamente', {
                userId: shortUserId,
                chatId,
                indicatorType: 'recording',
                part: i + 1,
                totalParts: voiceChunks.length
            }, 'whatsapp.service.ts');
            const payload = { to: chatId, media: audioDataUrl };
            if (i === 0 && quotedMessageId) {
                payload.quoted = quotedMessageId;
                (0, logging_1.logInfo)('PAYLOAD_QUOTED_VOICE', 'Payload con quoted agregado para voz', {
                    chatId,
                    quotedId: quotedMessageId,
                    part: i + 1
                });
            }
            const response = await (0, retry_utils_1.fetchWithRetry)(`${this.config.secrets.WHAPI_API_URL}/messages/voice`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.secrets.WHAPI_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errorText = await response.text();
                (0, logging_1.logInfo)('VOICE_SEND_ERROR', 'Error en respuesta de WHAPI para voz, pero mensaje podría haberse enviado', {
                    userId: shortUserId,
                    status: response.status,
                    statusText: response.statusText,
                    errorText: errorText.substring(0, 200),
                    chatId
                });
                if (response.status >= 500) {
                    throw new Error(`WHAPI critical error: ${response.status} ${response.statusText}`);
                }
            }
            else {
                // Intentar extraer ID(s) del mensaje
                try {
                    const data = await response.clone().json();
                    // Formatos comunes: { id }, { messages: [{ id }, ...] }
                    if (data) {
                        if (Array.isArray(data.messages)) {
                            for (const m of data.messages) {
                                if (m?.id)
                                    collectedIds.push(String(m.id));
                            }
                        }
                        else if (data.id) {
                            collectedIds.push(String(data.id));
                        }
                    }
                }
                catch {
                    // Ignorar si no es JSON
                }
            }
            const duration = Date.now() - startTime;
            totalSizeKb += Math.round(audioBuffer.length / 1024);
            // Log por cada nota
            (0, logging_1.logInfo)('VOICE_SENT_PART', 'Nota de voz enviada', {
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
        (0, logging_1.logInfo)('VOICE_SENT', 'Notas de voz enviadas exitosamente', {
            userId: shortUserId,
            chatId,
            totalDuration,
            totalAudioSizeKB: totalSizeKb,
            parts: voiceChunks.length,
            messageLength: message.length,
            success: true
        }, 'whatsapp.service.ts');
        // CRÍTICO: Marcar contenido como enviado para prevenir duplicados texto/voz
        this.mediaManager.addBotSentContent(chatId, message);
        // CRÍTICO: Marcar IDs de mensajes como enviados por el bot (para detectar quotes)
        collectedIds.forEach(id => {
            this.mediaManager.addBotSentMessage(id);
            (0, logging_1.logInfo)('BOT_MESSAGE_ID_STORED', 'ID de mensaje del bot guardado', {
                chatId,
                messageId: id,
                type: 'voice'
            });
        });
        // Log de confirmación de citación para voz
        if (quotedMessageId) {
            (0, logging_1.logInfo)('QUOTE_ATTEMPT_VOICE', 'Citación enviada en nota de voz', {
                chatId,
                quotedId: quotedMessageId,
                messagePreview: message.substring(0, 100),
                totalParts: voiceChunks.length
            });
        }
        return { success: true, messageIds: collectedIds };
    }
    async sendTextMessage(chatId, message, isQuoteOrPrice = false, quotedMessageId, enableHumanTiming = true) {
        // CRÍTICO: Verificar si ya se envió como voz para prevenir duplicados
        if (this.mediaManager.isBotSentContent(chatId, message)) {
            (0, logging_1.logInfo)('DUPLICATE_PREVENTED', 'Texto skipped - ya enviado como voz', {
                chatId, messagePreview: message.substring(0, 100)
            });
            return { success: true, messageIds: [] }; // Skip pero success=true
        }
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
            (0, logging_1.logInfo)('MESSAGE_CHUNKS', 'Mensaje dividido en chunks', {
                userId: (0, identifiers_1.getShortUserId)(chatId),
                chatId,
                totalChunks: chunks.length,
                totalLength: message.length,
                chunkLengths: chunks.map(chunk => chunk.length),
                isQuoteOrPrice,
                divisionReason: message.includes('\n\n') ? 'paragraphs' : 'bullet_lists'
            });
        }
        const collectedIds = [];
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            // Log detallado de cada chunk individual con preview de 20 palabras
            const chunk20Words = chunk.split(' ').slice(0, 20).join(' ') + (chunk.split(' ').length > 20 ? '...' : '');
            (0, logging_1.logInfo)('WHAPI_CHUNK_SEND', `Enviando chunk ${i + 1}/${chunks.length}`, {
                userId: chatId,
                chunkNumber: i + 1,
                totalChunks: chunks.length,
                chunkLength: chunk.length,
                preview: chunk20Words,
                isFirstChunk: i === 0,
                hasQuoted: i === 0 && !!quotedMessageId
            }, 'whatsapp.service.ts');
            // TIMING HUMANO: Calcular delay variable por chunk (o instantáneo para Operations)
            const delay = enableHumanTiming ? this.calculateHumanDelayForChunk(chunk.length, 'text') : 0;
            // Envía presencia inmediatamente antes del chunk
            await this.sendTypingIndicator(chatId);
            (0, logging_1.logInfo)('PRESENCE_CHUNK_TEXT', `✍️ch${i + 1}/${chunks.length}:${delay}ms`, {
                chatId,
                chunkIndex: i + 1,
                totalChunks: chunks.length,
                chunkLength: chunk.length,
                delay
            });
            // NUEVO: Delay humano variable por chunk con timeout defensivo
            await Promise.race([
                new Promise(resolve => setTimeout(resolve, delay)),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Chunk delay timeout')), 3000)) // Max 3s
            ]).catch(err => (0, logging_1.logInfo)('CHUNK_TIMEOUT', 'Timeout en delay chunk, continuando', {
                chunkIndex: i + 1,
                delay,
                error: err.message
            }));
            // COMENTADO: Delay fijo anterior
            // const humanDelay = this.calculateHumanTypingDelay(chunk.length);
            // await new Promise(resolve => setTimeout(resolve, humanDelay));
            const typingTime = 0; // Evitar doble espera: ya simulamos typing con presencia + delay
            // ✅ Sanitizar IDs internos antes de enviar
            const sanitizedChunk = chunk
                .replace(/\[(?:th_|run_|msg_|thread_|asst_)[^\]]+\]/g, '')
                .trim();
            // Construir el cuerpo del mensaje
            const messageBody = {
                to: chatId,
                body: sanitizedChunk,
                typing_time: typingTime
            };
            // Solo agregar quoted en el primer chunk si se proporciona
            if (i === 0 && quotedMessageId) {
                messageBody.quoted = quotedMessageId;
                (0, logging_1.logInfo)('PAYLOAD_QUOTED_TEXT', 'Payload con quoted agregado para texto', {
                    chatId,
                    quotedId: quotedMessageId,
                    chunkNumber: i + 1
                });
            }
            const attemptStart = Date.now();
            // Mantener typing vivo durante reintentos o latencias largas
            const keepTyping = setInterval(() => {
                this.sendTypingIndicator(chatId).catch(() => { });
            }, 15000);
            let response;
            try {
                response = await (0, retry_utils_1.fetchWithRetry)(`${this.config.secrets.WHAPI_API_URL}/messages/text`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.config.secrets.WHAPI_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(messageBody)
                });
                (0, logging_1.logInfo)('WHAPI_CHUNK_RESULT', 'Resultado envío chunk', {
                    userId: (0, identifiers_1.getShortUserId)(chatId),
                    chatId,
                    chunkNumber: i + 1,
                    totalChunks: chunks.length,
                    ms: Date.now() - attemptStart,
                    status: response.status
                });
            }
            finally {
                clearInterval(keepTyping);
            }
            // Intentar capturar ID del mensaje enviado por WHAPI
            try {
                const data = await response.clone().json();
                // DEBUG: Log completo de respuesta WHAPI para entender formato
                (0, logging_1.logInfo)('WHAPI_RESPONSE_DEBUG', 'Respuesta completa de WHAPI', {
                    chatId,
                    chunkIndex: i + 1,
                    responseKeys: data ? Object.keys(data) : [],
                    responseData: JSON.stringify(data).substring(0, 300),
                    hasId: !!data?.id,
                    hasMessages: !!data?.messages,
                    messagesLength: Array.isArray(data?.messages) ? data.messages.length : 0
                });
                if (data) {
                    if (Array.isArray(data.messages)) {
                        for (const m of data.messages) {
                            if (m?.id) {
                                collectedIds.push(String(m.id));
                                (0, logging_1.logInfo)('WHAPI_ID_EXTRACTED', 'ID extraído de messages array', {
                                    chatId,
                                    extractedId: m.id,
                                    chunkIndex: i + 1
                                });
                            }
                        }
                    }
                    else if (data.id) {
                        collectedIds.push(String(data.id));
                        (0, logging_1.logInfo)('WHAPI_ID_EXTRACTED', 'ID extraído directamente', {
                            chatId,
                            extractedId: data.id,
                            chunkIndex: i + 1
                        });
                    }
                    // Log final de IDs colectados
                    (0, logging_1.logInfo)('WHAPI_IDS_COLLECTED', 'IDs colectados para chunk', {
                        chatId,
                        chunkIndex: i + 1,
                        collectedCount: collectedIds.length,
                        ids: collectedIds
                    });
                }
            }
            catch (parseError) {
                (0, logging_1.logInfo)('WHAPI_JSON_PARSE_ERROR', 'Error parseando respuesta WHAPI', {
                    chatId,
                    chunkIndex: i + 1,
                    error: parseError instanceof Error ? parseError.message : String(parseError)
                });
            }
        }
        // CRÍTICO: Marcar contenido como enviado para prevenir duplicados
        this.mediaManager.addBotSentContent(chatId, message);
        // CRÍTICO: Marcar IDs de mensajes como enviados por el bot (para detectar quotes)
        collectedIds.forEach(id => {
            this.mediaManager.addBotSentMessage(id);
            (0, logging_1.logInfo)('BOT_MESSAGE_ID_STORED', 'ID de mensaje del bot guardado', {
                chatId,
                messageId: id,
                type: 'text'
            });
        });
        // Log de confirmación de citación para texto
        if (quotedMessageId) {
            (0, logging_1.logInfo)('QUOTE_ATTEMPT_TEXT', 'Citación enviada en mensaje de texto', {
                chatId,
                quotedId: quotedMessageId,
                messagePreview: message.substring(0, 100),
                totalChunks: chunks.length
            });
        }
        return { success: true, messageIds: collectedIds };
    }
    // División específica para voz: primero párrafos, luego frases por puntuación.
    splitMessageForVoice(message) {
        const paragraphs = message
            .split(/\n\n+/)
            .map(p => p.trim())
            .filter(p => p.length > 0);
        const chunks = [];
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
                }
                else {
                    current = candidate;
                }
            }
            if (current.trim())
                chunks.push(current.trim());
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
    splitMessageIntelligently(message) {
        let chunks = [];
        // Primero intentar dividir por doble salto de línea (párrafos)
        const paragraphs = message.split(/\n\n+/).map(chunk => chunk.trim()).filter(chunk => chunk.length > 0);
        // Si hay párrafos claramente separados, usarlos
        if (paragraphs.length > 1) {
            chunks = paragraphs;
        }
        else {
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
                }
                else {
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
    calculateHumanTypingDelay(textLength) {
        // Reducido drasticamente para evitar acumulación en múltiples chunks
        return textLength <= 160 ? 300 : 500;
    }
    /**
     * Calcula pausas adicionales simulando "tiempo de pensamiento"
     */
    calculateThinkingPauses(textLength) {
        // Pausas por puntuación y estructura
        const shortPause = 300; // Por comas, puntos
        const mediumPause = 700; // Por párrafos, ideas
        const longPause = 1200; // Por contenido complejo
        if (textLength < 50)
            return shortPause;
        if (textLength < 150)
            return mediumPause;
        return longPause;
    }
    async getChatInfo(chatId) {
        try {
            const response = await (0, retry_utils_1.fetchWithRetry)(`${this.config.secrets.WHAPI_API_URL}/chats/${encodeURIComponent(chatId)}`, {
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
            const chatInfo = await response.json();
            return {
                labels: chatInfo.labels || [] // Solo labels - names vienen del webhook
            };
        }
        catch (error) {
            console.warn(`⚠️ Error obteniendo chat info para ${chatId}:`, error);
            return null;
        }
    }
    async sendDocument(chatId, filePath, fileName, quotedMessageId) {
        try {
            const fs = await Promise.resolve().then(() => require('fs')).then(m => m.promises);
            // Leer archivo y convertir a base64
            const fileBuffer = await fs.readFile(filePath);
            const base64Data = fileBuffer.toString('base64');
            // Usar formato data URL estándar (igual que sendDocumentFromBuffer)
            const dataUrl = `data:application/pdf;base64,${base64Data}`;
            const payload = {
                to: chatId,
                media: dataUrl, // Data URL completo
                mime_type: 'application/pdf',
                filename: fileName || 'documento.pdf'
            };
            if (quotedMessageId) {
                payload.quoted = quotedMessageId;
            }
            const response = await (0, retry_utils_1.fetchWithRetry)(`${this.config.secrets.WHAPI_API_URL}/messages/document`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.secrets.WHAPI_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errorText = await response.text();
                (0, logging_1.logInfo)('DOCUMENT_SEND_ERROR', 'Error enviando documento', {
                    chatId,
                    status: response.status,
                    statusText: response.statusText,
                    errorText: errorText.substring(0, 200)
                });
                return { success: false };
            }
            // Extraer ID del mensaje
            let messageId;
            try {
                const data = await response.json();
                messageId = data.id || data.messages?.[0]?.id;
            }
            catch {
                // Ignorar si no es JSON
            }
            (0, logging_1.logInfo)('DOCUMENT_SENT', 'Documento enviado exitosamente', {
                chatId,
                fileName: payload.filename,
                fileSize: Math.round(fileBuffer.length / 1024) + 'KB',
                messageId
            });
            return { success: true, messageId };
        }
        catch (error) {
            (0, logging_1.logInfo)('DOCUMENT_SEND_ERROR', 'Error enviando documento', {
                chatId,
                error: error.message,
                filePath
            });
            return { success: false };
        }
    }
    /**
     * NUEVO: Envía documento PDF desde buffer in-memory (Railway compatible)
     */
    async sendDocumentFromBuffer(chatId, pdfBuffer, fileName, quotedMessageId) {
        try {
            // VALIDACIÓN: Buffer no vacío antes de conversión
            if (!pdfBuffer || pdfBuffer.length === 0) {
                throw new Error('PDF buffer vacío o nulo');
            }
            // IMPORTANTE: Asegurar que es un Buffer real de Node.js
            // Puppeteer puede retornar Uint8Array que necesita conversión
            const buffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
            // Convertir buffer directamente a base64 (sin FS)
            const base64Data = buffer.toString('base64');
            // Validación rápida del PDF (solo si hay problemas)
            if (process.env.DEBUG_PDF === 'true') {
                const pdfHeader = buffer.slice(0, 4).toString('ascii');
                const isPDF = pdfHeader === '%PDF';
                if (!isPDF) {
                    (0, logging_1.logError)('PDF_BUFFER_INVALID', 'Buffer no es un PDF válido', {
                        header: pdfHeader,
                        expectedHeader: '%PDF',
                        bufferLength: buffer.length
                    });
                }
            }
            // WHAPI: Usar formato data URL estándar
            // data:[<mediatype>][;base64],<data>
            const dataUrl = `data:application/pdf;base64,${base64Data}`;
            const payload = {
                to: chatId,
                media: dataUrl, // Data URL completo con prefijo
                mime_type: 'application/pdf',
                filename: fileName || 'confirmacion-reserva.pdf'
                // NO incluir no_encode cuando usamos data URL
                // no_cache se puede omitir
            };
            if (quotedMessageId) {
                payload.quoted = quotedMessageId;
            }
            const response = await (0, retry_utils_1.fetchWithRetry)(`${this.config.secrets.WHAPI_API_URL}/messages/document`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.secrets.WHAPI_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            const responseData = await response.json();
            const messageId = responseData?.message_id;
            (0, logging_1.logInfo)('DOCUMENT_BUFFER_SENT', 'Documento enviado desde buffer in-memory', {
                chatId,
                fileName: payload.filename,
                fileSize: Math.round(pdfBuffer.length / 1024) + 'KB',
                messageId,
                bufferLength: pdfBuffer.length
            });
            return { success: true, messageId };
        }
        catch (error) {
            (0, logging_1.logInfo)('DOCUMENT_BUFFER_ERROR', 'Error enviando documento desde buffer', {
                chatId,
                error: error.message,
                fileName,
                bufferLength: pdfBuffer?.length
            });
            return { success: false };
        }
    }
    /**
     * TIMING HUMANO: Calcula delay por chunk (1s cada 8 chars, cap 2000ms)
     */
    calculateHumanDelayForChunk(chunkLength, mode) {
        const delayPer8Chars = 1000; // 1s por 8 chars, como pediste
        let delay = Math.ceil(chunkLength / 8) * delayPer8Chars;
        const maxDelayPerChunk = 2000; // Cap 2s por chunk para evitar acumulaciones/cuelgues
        delay = Math.min(delay, maxDelayPerChunk);
        (0, logging_1.logInfo)('HUMAN_DELAY_CHUNK', `${mode}:${chunkLength}ch=${delay}ms`, {
            mode,
            chunkLength,
            delay
        });
        return delay;
    }
}
exports.WhatsappService = WhatsappService;
// Constante que moveremos a `constants.ts` más adelante
const MAX_MESSAGE_LENGTH = 4096;
