// src/core/processors/OperationsWebhookProcessor.ts
import { BaseWebhookProcessor } from './base/BaseWebhookProcessor';
import { ProcessorConfig } from './base/IWebhookProcessor.interface';
import { RateLimiter } from '../utils/rate-limiter';
import { logInfo, logSuccess, logError, logWarning, logDebug } from '../../utils/logging';

export class OperationsWebhookProcessor extends BaseWebhookProcessor {
    
    canHandle(payload: any): boolean {
        const operationsChatId = process.env.OPERATIONS_CHAT_ID;
        
        // Método 1: Es del grupo específico de operaciones
        if (operationsChatId && this.isSpecificGroup(payload, operationsChatId)) {
            return true;
        }
        
        // Método 2: El bot fue mencionado en cualquier grupo
        if (this.isBotMentioned(payload)) {
            return true;
        }
        
        // Método 3: El bot fue citado en cualquier grupo
        return this.isBotQuoted(payload);
    }

    getProcessorName(): string {
        return 'OperationsWebhookProcessor';
    }

    getConfig(): ProcessorConfig {
        return {
            assistantId: process.env.OPERATIONS_ASSISTANT_ID || '',
            chatId: process.env.OPERATIONS_CHAT_ID,
            bufferSettings: {
                timeout: 1000,  // Más rápido que el main
                fastMode: true  // Modo optimizado
            },
            presenceSettings: {
                enabled: false,     // SIN typing indicators para optimizar
                showTyping: false,
                showRecording: false
            },
            timingSettings: {
                humanTiming: false,  // SIN timing humano para ser más directo
                responseDelay: 500   // Respuesta más rápida
            },
            logSettings: {
                compactMode: true,   // Logs más compactos
                debugLevel: 'minimal' // Solo logs esenciales
            }
        };
    }

    public async process(payload: unknown): Promise<void> {
        const body = payload as any;
        const { messages, presences, statuses, chats, contacts, groups, labels } = body;
        
        // Log compacto para operaciones
        logInfo('WEBHOOK_DEBUG', 'Procesando webhook [OPERATIONS]', {
            has_messages: !!body.messages,
            messages_count: body.messages?.length || 0,
            processor: 'operations'
        });
        
        // Filtro de salud simplificado
        if (body.health && !body.messages && !body.presences && !body.statuses && !body.chats) {
            logDebug('HEALTH_WEBHOOK_IGNORED', 'Webhook solo de salud ignorado [OPERATIONS]', {
                health_status: body.health?.status?.text || body.health_status
            }, 'operations-webhook-processor.ts');
            return;
        }
        
        // Log técnico compacto
        const type = messages?.length ? `msg:${messages.length}` : 
                    presences?.length ? `pres:${presences.length}` :
                    statuses?.length ? `stat:${statuses.length}` : 'other';
        logInfo('WEBHOOK_RECEIVED', `📥 ${type} [OPS]`, {
            data: type,
            processor: 'operations'
        }, 'operations-webhook-processor.ts');

        // OPERACIONES: NO procesar presence events para optimizar
        // Las operaciones no necesitan typing indicators

        // PRIORIDAD: Solo mensajes
        if (messages && Array.isArray(messages) && messages.length > 0) {
            for (const message of messages) {
                await this.handleOperationsMessage(message);
            }
            return;
        }

        // Otros webhooks con log minimal
        const hasValidWebhookData = 
            (statuses && Array.isArray(statuses)) ||
            (chats && Array.isArray(chats)) ||
            (contacts && Array.isArray(contacts)) ||
            (groups && Array.isArray(groups)) ||
            (labels && Array.isArray(labels));

        if (hasValidWebhookData) {
            const webhookType = statuses ? `stat:${statuses.length}` :
                               chats ? `chat:${chats.length}` :
                               contacts ? `cont:${contacts.length}` :
                               groups ? `grp:${groups.length}` :
                               labels ? `lbl:${labels.length}` :
                               'other';
            
            logInfo('WEBHOOK_OTHER', `📥 ${webhookType} [OPS]`, { 
                type: webhookType,
                processor: 'operations'
            }, 'operations-webhook-processor.ts');
            return;
        }

        // Webhook inválido con rate limiting
        this.handleInvalidWebhook(body);
    }

    private handleInvalidWebhook(body: any): void {
        if (RateLimiter.shouldLogInvalidWebhook()) {
            logWarning('WEBHOOK', 'Webhook inválido recibido [OPERATIONS]', { 
                processor: 'operations',
                note: 'Rate limited - solo se loggea una vez por minuto'
            }, 'operations-webhook-processor.ts');
        }
    }

    private async handleOperationsMessage(message: any): Promise<void> {
        // Filtro anti-eco básico por ID
        if (message && message.id && this.mediaManager.isBotSentMessage(message.id)) {
            logDebug('BOT_ECHO_IGNORED', 'Eco del bot ignorado por ID [OPS]', {
                messageId: message.id
            }, 'operations-webhook-processor.ts');
            return;
        }

        // SIMPLIFICADO: Usar chat_id como ID único para todo (grupos y chats individuales)
        const chatId = message.chat_id || message.from;  // ID único del chat/conversación
        let userId = chatId; // Usar mismo ID para identificar conversación
        
        // Extraer número de teléfono para buscar en BD (solo para compatibilidad)
        let phoneNumber = userId;
        if (phoneNumber && phoneNumber.includes('@')) {
            phoneNumber = phoneNumber.split('@')[0];
        }
        // Para operaciones, mantener userId como chatId (no cambiar a phoneNumber)
        // userId = phoneNumber || userId; // ← REMOVIDO: No cambiar userId
        
        // Para operaciones: SOLO usar nombre del grupo, ignorar contactos individuales
        let userName = 'Operaciones';
        const webhookChatName = (message as any).chat_name;
        
        // SOLO usar chat_name del grupo, NUNCA from_name de contactos individuales
        if (webhookChatName && chatId.includes('@g.us')) {
            userName = webhookChatName; // Ejemplo: "Operaciones"
        }
        // Para grupos: ignorar completamente from_name y from

        // Timestamp básico
        const webhookTimestamp = message.timestamp ? new Date(message.timestamp * 1000) : new Date();
        
        // Normalizar chatId
        let normalizedChatId = chatId;
        if (normalizedChatId && !normalizedChatId.includes('@')) {
            normalizedChatId = normalizedChatId + '@s.whatsapp.net';
        }

        // Manejo de from_me con filtros anti-eco integrados (igual que MainWebhookProcessor)
        const fromMe = message.from_me === true || message.fromMe === true;
        if (fromMe) {
            const manualAgentEnabled = process.env.ENABLE_MANUAL_AGENT_MESSAGES === 'true';
            if (!manualAgentEnabled) {
                logDebug('FROM_ME_DISABLED_OPS', 'Mensajes from_me deshabilitados por configuración [OPS]', {
                    messageId: message.id || 'sin_id'
                }, 'operations-webhook-processor.ts');
                return;
            }
            
            // Filtros anti-eco DENTRO del bloque from_me (como MainWebhookProcessor)
            if (message.id && this.mediaManager.isBotSentMessage(message.id)) {
                logDebug('BOT_MESSAGE_FILTERED_ID_OPS', 'Mensaje del bot filtrado por ID [OPS]', {
                    messageId: message.id
                }, 'operations-webhook-processor.ts');
                return;
            }
            
            if (message.type === 'text' && message.text?.body) {
                if (this.mediaManager.isBotSentContent(normalizedChatId, message.text.body)) {
                    logDebug('BOT_MESSAGE_FILTERED_CONTENT_OPS', 'Mensaje del bot filtrado por contenido [OPS]', {
                        messageId: message.id || 'sin_id',
                        preview: message.text.body.substring(0, 50)
                    }, 'operations-webhook-processor.ts');
                    return;
                }
            }
            
            // Si está habilitado y pasó todos los filtros, continúa procesando
            logDebug('FROM_ME_ENABLED_OPS', 'Procesando mensaje from_me habilitado [OPS]', {
                messageId: message.id || 'sin_id',
                type: message.type
            }, 'operations-webhook-processor.ts');
        }

        // Actualizar estado del usuario de forma simplificada
        // IMPORTANTE: Para grupos, NO actualizar userName para evitar sobrescribir nombre del grupo
        const updateData: any = {
            chatId: normalizedChatId,
            isTyping: false,    // Siempre false para operaciones
            isRecording: false, // Siempre false para operaciones
            lastActivity: webhookTimestamp.getTime()
        };
        
        // Solo actualizar userName en el primer registro, luego mantener nombre del grupo
        const existingState = this.userManager.getState(userId);
        if (!existingState) {
            updateData.userName = userName; // Solo la primera vez
        }
        
        this.userManager.updateState(userId, updateData);

        try {
            switch (message.type) {
                case 'text':
                    if (message.text && message.text.body) {
                        let messageContent = message.text.body;
                        
                        // Marcar que el último input NO fue voz
                        this.userManager.updateState(userId, { lastInputVoice: false });
                        
                        // Para operaciones: manejo simplificado de quotes (opcional)
                        if (message.context && message.context.quoted_id) {
                            const quotedContent = message.context.quoted_content?.body || 
                                                 '[mensaje citado]'; // Simplificado
                            
                            messageContent = `Responde a: ${quotedContent}\n\nMensaje: ${message.text.body}`;
                        }
                        
                        // Log compacto para operaciones
                        logInfo('MESSAGE_RECEIVED', 'Texto [OPS]', {
                            userId,
                            userName,
                            messageType: 'text',
                            messageId: message.id,
                            body: message.text.body.substring(0, 50) // Preview más corto
                        });
                        
                        this.terminalLog.message(`${userName} [OPS]`, message.text.body);
                        
                        // Buffer con timeout optimizado para operaciones
                        this.bufferManager.addMessage(userId, messageContent, normalizedChatId, userName, undefined, message.id);
                    }
                    break;

                case 'voice':
                case 'audio':
                case 'ptt':
                    this.terminalLog.voice(`${userName} [OPS]`);
                    
                    // Marcar que el último input fue voz
                    this.userManager.updateState(userId, { lastInputVoice: true });
                    
                    logInfo('MESSAGE_RECEIVED', 'Voz [OPS]', {
                        userId,
                        userName,
                        messageType: 'voice',
                        messageId: message.id
                    });
                    
                    // Timer más corto para operaciones (más eficiente)
                    this.bufferManager.setIntelligentTimer(userId, 'voice');
                    const audioLink = message.voice?.link || message.audio?.link;
                    
                    if (audioLink) {
                        const result = await this.mediaService.legacyTranscribeAudio(audioLink, userId, userName, message.id);
                        if (result.success && result.result) {
                            let finalMessage = result.result;
                            
                            // Manejo simplificado de quotes para voz
                            if (message.context && message.context.quoted_id) {
                                const quotedContent = message.context.quoted_content?.body || '[mensaje citado]';
                                finalMessage = `Responde con voz a: ${quotedContent}\n\nTranscripción: ${result.result}`;
                            }

                            // Filtro anti-eco básico
                            if (this.mediaManager.isBotSentContent(normalizedChatId, result.result)) {
                                logDebug('BOT_VOICE_ECHO_IGNORED', 'Eco de voz ignorado [OPS]', {
                                    userId,
                                    preview: result.result.substring(0, 50)
                                });
                                return;
                            }
                            
                            this.terminalLog.message(`${userName} [OPS]`, `🎤 ${result.result}`);
                            
                            logSuccess('AUDIO_TRANSCRIBED', 'Audio transcrito [OPS]', {
                                userId,
                                userName,
                                messageId: message.id,
                                transcription: result.result.substring(0, 50) // Preview más corto
                            });
                            
                            this.bufferManager.addMessage(userId, finalMessage, normalizedChatId, userName, undefined, message.id);
                        } else {
                            this.terminalLog.voiceError(`${userName} [OPS]`, result.error || 'Transcription failed');
                            
                            logError('TRANSCRIPTION_ERROR', 'Error transcripción [OPS]', {
                                userId,
                                userName,
                                messageId: message.id,
                                error: result.error
                            }, 'operations-webhook-processor.ts');
                        }
                    }
                    break;

                case 'image':
                    // Para operaciones: log simplificado de imágenes
                    this.terminalLog.image(`${userName} [OPS]`);
                    
                    logInfo('MESSAGE_RECEIVED', 'Imagen [OPS]', {
                        userId,
                        userName,
                        messageType: 'image',
                        messageId: message.id
                    }, 'operations-webhook-processor.ts');
                    
                    if (message.image && message.image.link) {
                        const imageMessage = {
                            type: 'image' as const,
                            imageUrl: message.image.link,
                            caption: message.image.caption || ''
                        };
                        this.bufferManager.addImageMessage(userId, imageMessage, normalizedChatId, userName);
                    }
                    break;
            }
        } catch (error: any) {
            this.terminalLog.error(`Error procesando mensaje [OPS] de ${userName}: ${error.message}`);
        }

        // OPERACIONES: NO hacer enriquecimiento async para máxima eficiencia
        // Las operaciones no requieren datos enriquecidos complejos
    }

    /**
     * Verifica si el bot fue mencionado en cualquier mensaje del payload
     * Busca el número del bot en message.context.mentions[]
     */
    private isBotMentioned(payload: any): boolean {
        const botNumber = process.env.OPERATIONS_BOT_PHONE_NUMBER; // ej: "573235906292"
        
        if (!botNumber || !payload.messages) {
            return false;
        }
        
        // Buscar mentions en todos los mensajes del payload
        return payload.messages.some((message: any) => {
            if (!message.context?.mentions || !Array.isArray(message.context.mentions)) {
                return false;
            }
            
            // Verificar si el número del bot está en las mentions
            return message.context.mentions.includes(botNumber);
        });
    }

    /**
     * Verifica si el bot fue citado en cualquier mensaje del payload
     * Busca el número del bot en message.context.quoted_author
     */
    private isBotQuoted(payload: any): boolean {
        const botNumber = process.env.OPERATIONS_BOT_PHONE_NUMBER; // ej: "573235906292"
        
        if (!botNumber || !payload.messages) {
            return false;
        }
        
        // Buscar quotes en todos los mensajes del payload
        return payload.messages.some((message: any) => {
            // Verificar si el quoted_author es el número del bot
            return message.context?.quoted_author === botNumber;
        });
    }
}