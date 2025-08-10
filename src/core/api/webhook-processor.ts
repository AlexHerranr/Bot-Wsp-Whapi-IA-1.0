// src/core/api/webhook-processor.ts
import { BufferManager } from '../state/buffer-manager';
import { MediaManager } from '../state/media-manager';
import { UserManager } from '../state/user-state-manager';
import { MediaService } from '../services/media.service';
import { DatabaseService } from '../services/database.service';
import { DelayedActivityService } from '../services/delayed-activity.service';
import { OpenAIService } from '../services/openai.service';
import { TerminalLog } from '../utils/terminal-log';
import { RateLimiter } from '../utils/rate-limiter';
import { logInfo, logSuccess, logError, logWarning, logDebug } from '../../utils/logging';

export class WebhookProcessor {
    
    constructor(
        private bufferManager: BufferManager,
        private userManager: UserManager,
        private mediaManager: MediaManager,
        private mediaService: MediaService,
        private databaseService: DatabaseService,
        private delayedActivityService: DelayedActivityService,
        private openaiService: OpenAIService,
        private terminalLog: TerminalLog
    ) {}

    public async process(payload: unknown): Promise<void> {
        const body = payload as any;
        const { messages, presences, statuses, chats, contacts, groups, labels } = body;
        
        // LOG TEMPORAL: Ver TODOS los webhooks para debug
        logInfo('WEBHOOK_DEBUG', 'Procesando webhook', {
            event_type: body.event_type,
            channel_id: body.channel_id,
            has_messages: !!body.messages,
            messages_count: body.messages?.length || 0,
            has_presences: !!body.presences,
            presences_count: body.presences?.length || 0,
            has_statuses: !!body.statuses,
            has_health: !!body.health,
            body_keys: Object.keys(body || {}).slice(0, 15),
            // Muestra una muestra del primer mensaje si existe
            first_message_type: body.messages?.[0]?.type,
            first_message_from: body.messages?.[0]?.from,
            first_message_from_me: body.messages?.[0]?.from_me
        });
        
        // FILTRO MUY ESPECÍFICO: Solo ignorar webhooks de salud sin datos útiles
        if (body.health && !body.messages && !body.presences && !body.statuses && !body.chats) {
            logDebug('HEALTH_WEBHOOK_IGNORED', 'Webhook solo de salud ignorado', {
                health_status: body.health?.status?.text || body.health_status
            });
            return;
        }
        
        // Log técnico de sesión para todos los webhooks válidos (compacto)
        const type = messages?.length ? `msg:${messages.length}` : 
                    presences?.length ? `pres:${presences.length}` :
                    statuses?.length ? `stat:${statuses.length}` : 'other';
        logInfo('WEBHOOK_RECEIVED', `📥 ${type}`, {
            data: type
        });

        // 1. PRIORIDAD: Eventos de Presencia
        if (presences && Array.isArray(presences) && presences.length > 0) {
            this.handlePresenceEvents(presences);
            return;
        }

        // 2. PRIORIDAD: Mensajes
        if (messages && Array.isArray(messages) && messages.length > 0) {
            for (const message of messages) {
                await this.handleMessage(message);
            }
            return;
        }

        // 3. OTROS WEBHOOKS VÁLIDOS (como en el monolítico)
        const hasValidWebhookData = 
            (statuses && Array.isArray(statuses)) ||
            (chats && Array.isArray(chats)) ||
            (contacts && Array.isArray(contacts)) ||
            (groups && Array.isArray(groups)) ||
            (labels && Array.isArray(labels));

        if (hasValidWebhookData) {
            // Log conciso para todos los webhooks válidos (incluye status vacíos)
            const webhookType = statuses ? `stat:${statuses.length}` :
                               chats ? `chat:${chats.length}` :
                               contacts ? `cont:${contacts.length}` :
                               groups ? `grp:${groups.length}` :
                               labels ? `lbl:${labels.length}` :
                               'other';
            
            // Log siempre para mantener visibilidad pero de forma corta
            logInfo('WEBHOOK_OTHER', `📥 ${webhookType}`, { type: webhookType });
            return;
        }

        // 4. WEBHOOK INVÁLIDO - Rate Limited (como en el monolítico)
        this.handleInvalidWebhook(body);
    }

    private handleInvalidWebhook(body: any): void {
        if (RateLimiter.shouldLogInvalidWebhook()) {
            // Extraer solo información relevante para debug
            const debugInfo = this.extractWebhookDebugInfo(body);
            
            logWarning('WEBHOOK', 'Webhook inválido recibido', { 
                ...debugInfo,
                note: 'Rate limited - solo se loggea una vez por minuto'
            });
        }
    }

    private extractWebhookDebugInfo(body: any): Record<string, any> {
        if (!body || typeof body !== 'object') {
            return { error: 'payload_empty_or_invalid' };
        }

        const debugInfo: Record<string, any> = {};
        
        // Información de salud del webhook
        if (body.health) {
            debugInfo.health_status = body.health.status?.text || body.health.status?.code || 'unknown';
            debugInfo.health_uptime = body.health.uptime;
            debugInfo.health_version = body.health.version;
        }
        
        // Información de eventos
        if (body.event) {
            debugInfo.event_type = body.event.type;
            debugInfo.event_name = body.event.event;
        }
        
        // Canal o identificadores
        if (body.channel_id) {
            debugInfo.channel_id = body.channel_id;
        }
        
        if (body.instance_id) {
            debugInfo.instance_id = body.instance_id;
        }
        
        // Errores específicos
        if (body.error) {
            debugInfo.error_message = typeof body.error === 'string' ? body.error : JSON.stringify(body.error);
        }
        
        // Si no hay información específica, mostrar las keys principales
        if (Object.keys(debugInfo).length === 0) {
            debugInfo.body_keys = Object.keys(body).slice(0, 5);
            debugInfo.body_sample = JSON.stringify(body).substring(0, 200) + '...';
        }
        
        return debugInfo;
    }

    private handlePresenceEvents(presences: any[]): void {
        presences.forEach(presence => {
            const userId = presence.contact_id;
            const status = presence.status.toLowerCase();
            const userState = this.userManager.getOrCreateState(userId);

            if (status === 'typing' || status === 'recording') {
                // CRÍTICO: Actualizar estado completo (isTyping/isRecording + timestamp)
                const now = Date.now();
                this.userManager.updateState(userId, { 
                    isTyping: status === 'typing',
                    isRecording: status === 'recording',
                    lastTyping: now,
                    lastActivity: now
                });
                
                // Log técnico específico para buffer
                logInfo('BUFFER_EVENT', 'Evento de presencia detectado', {
                    userId,
                    userName: userState.userName || 'Usuario',
                    status,
                    reason: 'extend_timer'
                });
                
                // SIEMPRE procesar el timer (crítico para buffering)
                this.bufferManager.setIntelligentTimer(userId, status as 'typing' | 'recording');
                
                // Rate limiting SOLO para logs visuales (no afecta el procesamiento)
                if (RateLimiter.shouldLogTyping(userId)) {
                    if (status === 'typing') {
                        this.terminalLog.typing(userState.userName || 'Usuario');
                    } else if (status === 'recording') {
                        this.terminalLog.recording(userState.userName || 'Usuario');
                    }
                }
            } else {
                // Usuario ya no está escribiendo/grabando (available, offline, etc.)
                const wasActive = userState.isTyping || userState.isRecording;
                if (wasActive) {
                    const now = Date.now();
                    this.userManager.updateState(userId, { 
                        isTyping: false,
                        isRecording: false,
                        lastActivity: now
                    });
                    
                    logInfo('PRESENCE_EVENT', `Usuario dejó de ${userState.isTyping ? 'escribir' : 'grabar'}`, {
                        userId,
                        status,
                        userName: userState.userName || 'Usuario',
                        wasTyping: userState.isTyping,
                        wasRecording: userState.isRecording
                    });
                    
                    // Si hay mensajes en buffer y el usuario estaba grabando, dar tiempo extra
                    // por si va a continuar grabando más audios
                    const buffer = this.bufferManager.getBuffer(userId);
                    if (buffer && buffer.messages.length > 0 && userState.isRecording) {
                        logInfo('BUFFER_GRACE_PERIOD', 'Extendiendo buffer por fin de grabación', {
                            userId,
                            userName: userState.userName || 'Usuario',
                            messageCount: buffer.messages.length,
                            reason: 'recording_ended_with_messages'
                        });
                        // Extender timer para dar oportunidad de continuar
                        this.bufferManager.setIntelligentTimer(userId, 'voice');
                    }
                }
            }
        });
    }

    private async handleMessage(message: any): Promise<void> {
        // Primero verificar si es un mensaje del bot (por ID)
        if (message && message.id && this.mediaManager.isBotSentMessage(message.id)) {
            logDebug('BOT_ECHO_IGNORED', 'Eco del bot ignorado por ID', {
                messageId: message.id
            });
            return;
        }

        // Para mensajes normales, userId es el remitente; para from_me usaremos chat_id
        let userId = message.from || message.contact_id || message.author || message.sender || '';
        const chatId = message.chat_id || message.from; // Fallback si no hay chat_id
        
        // Extraer número de teléfono para buscar en BD
        let phoneNumber = userId;
        if (phoneNumber && phoneNumber.includes('@')) {
            phoneNumber = phoneNumber.split('@')[0];
        }
        
        // Obtener nombre real del contacto desde la base de datos
        let userName = 'Usuario'; // Fallback por defecto
        let shouldEnrichAsync = false;
        
        try {
            const clientData = await this.databaseService.findUserByPhoneNumber(phoneNumber);
            if (clientData && clientData.name) {
                userName = clientData.name;
                
                // Verificar si necesita enriquecimiento async (datos incompletos)
                const nameEqualsPhone = clientData.name === phoneNumber;
                const hasNoLabels = !(clientData as any).labels;
                shouldEnrichAsync = nameEqualsPhone || hasNoLabels;
            } else {
                // Usuario nuevo o sin datos → programar enriquecimiento
                shouldEnrichAsync = true;
            }
        } catch (error) {
            console.warn(`⚠️ Error obteniendo nombre del contacto ${phoneNumber}:`, error);
            shouldEnrichAsync = true; // Por seguridad, intentar enriquecer
        }

        // Normalizar datos para BD: chatId con formato 
        let normalizedChatId = chatId;
        
        // chatId: formato completo (573246703524@s.whatsapp.net)
        if (normalizedChatId && !normalizedChatId.includes('@')) {
            normalizedChatId = normalizedChatId + '@s.whatsapp.net';
        }

        // Si es un mensaje manual (from_me=true) del agente: enviar directo a OpenAI
        const fromMe = message.from_me === true || message.fromMe === true;
        if (fromMe && message.type === 'text' && message.text?.body) {
            // Verificar si los mensajes manuales están habilitados
            const manualAgentEnabled = process.env.ENABLE_MANUAL_AGENT_MESSAGES === 'true';
            if (!manualAgentEnabled) {
                logDebug('FROM_ME_DISABLED', 'Mensajes from_me deshabilitados por configuración', {
                    messageId: message.id || 'sin_id'
                });
                return;
            }
            
            // FILTRO 1: Verificar si el mensaje fue enviado por el bot (por ID)
            if (message.id && this.mediaManager.isBotSentMessage(message.id)) {
                logDebug('BOT_MESSAGE_FILTERED_ID', 'Mensaje del bot filtrado por ID', {
                    messageId: message.id
                });
                return;
            }
            
            // FILTRO 2: Verificar por contenido (fallback cuando no hay ID confiable)
            if (this.mediaManager.isBotSentContent(normalizedChatId, message.text.body)) {
                logDebug('BOT_MESSAGE_FILTERED_CONTENT', 'Mensaje del bot filtrado por contenido', {
                    messageId: message.id || 'sin_id',
                    preview: message.text.body.substring(0, 50)
                });
                return;
            }

            // Si llegamos aquí, es un mensaje manual del agente real
            let clientUserId = message.chat_id || message.from;
            if (clientUserId && typeof clientUserId === 'string' && clientUserId.includes('@')) {
                clientUserId = clientUserId.split('@')[0];
            }

            const agentName = message.from_name || 'Agente';
            
            logInfo('MANUAL_DETECTED', 'Mensaje manual del agente detectado', {
                userId: clientUserId,
                agentName,
                chatId: normalizedChatId,
                preview: message.text.body.substring(0, 100)
            });

            this.terminalLog.manualMessage(agentName, userName, message.text.body);
            
            // SOLUCIÓN SIMPLE: Enviar directo a OpenAI con UNA SOLA llamada
            await this.syncManualMessageToOpenAI(clientUserId, normalizedChatId, agentName, message.text.body);
            return;
        }

        // Actualizar estado del usuario y resetear typing/recording (ya envió el mensaje)
        this.userManager.updateState(userId, { 
            userName, 
            chatId: normalizedChatId,
            isTyping: false,
            isRecording: false,
            lastActivity: Date.now()
        });
        
        // Programar actualización delayed de BD (10 minutos después)
        this.delayedActivityService.scheduleUpdate(phoneNumber);
        
        // Mantener upsert inmediato solo para datos críticos (phoneNumber, chatId, userName)
        // pero SIN actualizar lastActivity (se hará con delay)
        if (this.databaseService) {
            // Solo crear/actualizar registro básico sin lastActivity
            const existing = await this.databaseService.findUserByPhoneNumber(phoneNumber);
            if (!existing) {
                // Usuario nuevo - crear registro básico
                await this.databaseService.getOrCreateUser(phoneNumber, userName);
            }
        }

        try {

            switch (message.type) {
                case 'text':
                    if (message.text && message.text.body) {
                        let messageContent = message.text.body;
                        
                        // Marcar que el último input NO fue voz (como en el monolítico)
                        this.userManager.updateState(userId, { lastInputVoice: false });
                        
                        // Detectar si es una respuesta/quote y formatear para OpenAI
                        if (message.context && message.context.quoted_id) {
                            const quotedContent = message.context.quoted_content?.body || '[mensaje citado]';
                            messageContent = `Cliente responde a este mensaje: ${quotedContent}\n\nMensaje del cliente: ${message.text.body}`;
                        }
                        
                        // Log técnico de sesión
                        logInfo('MESSAGE_RECEIVED', 'Mensaje de texto recibido', {
                            userId,
                            userName,
                            chatId,
                            messageType: 'text',
                            messageId: message.id,
                            body: message.text.body.substring(0, 100)
                        });
                        
                        this.terminalLog.message(userName, message.text.body);
                        // Propagar quotedId al buffer si existe
                        const quotedId = message.context?.quoted_id;
                        this.bufferManager.addMessage(userId, messageContent, chatId, userName, quotedId);
                    }
                    break;

                case 'voice':
                case 'audio':
                case 'ptt':
                    this.terminalLog.voice(userName);
                    
                    // Marcar que el último input fue voz (como en el monolítico)
                    this.userManager.updateState(userId, { lastInputVoice: true });
                    
                    // Log técnico de sesión
                    logInfo('MESSAGE_RECEIVED', 'Mensaje de voz recibido', {
                        userId,
                        userName,
                        chatId,
                        messageType: 'voice',
                        messageId: message.id,
                        hasQuoted: !!(message.context && message.context.quoted_id)
                    });
                    
                    // Configurar timer de 8s para voice
                    this.bufferManager.setIntelligentTimer(userId, 'voice');
                    const audioLink = message.voice?.link || message.audio?.link;
                    if (audioLink) {
                        const result = await this.mediaService.legacyTranscribeAudio(audioLink, userId, userName, message.id);
                        if (result.success && result.result) {
                            let finalMessage = result.result;
                            
                            // CRÍTICO: Detectar si es una respuesta/quote y formatear para OpenAI (igual que con texto)
                            if (message.context && message.context.quoted_id) {
                                const quotedContent = message.context.quoted_content?.body || '[mensaje citado]';
                                finalMessage = `Cliente responde con nota de voz a este mensaje: ${quotedContent}\n\nTranscripción de la nota de voz: ${result.result}`;
                                
                                logInfo('VOICE_QUOTED_CONTEXT', 'Nota de voz con contexto quoted', {
                                    userId,
                                    userName,
                                    quotedId: message.context.quoted_id,
                                    quotedPreview: quotedContent.substring(0, 50)
                                });
                            }
                            
                            this.terminalLog.message(userName, `(Nota de Voz Transcrita por Whisper)\n🎤 ${result.result}`);
                            
                            // Log técnico de sesión - transcripción exitosa
                            logSuccess('AUDIO_TRANSCRIBED', 'Audio transcrito exitosamente', {
                                userId,
                                userName,
                                messageId: message.id,
                                transcription: result.result.substring(0, 100),
                                hasQuoted: !!(message.context && message.context.quoted_id)
                            });
                            
                            const quotedId = message.context?.quoted_id;
                            this.bufferManager.addMessage(userId, finalMessage, chatId, userName, quotedId);
                        } else {
                            this.terminalLog.voiceError(userName, result.error || 'Transcription failed');
                            
                            // Log técnico de sesión - error de transcripción
                            logError('TRANSCRIPTION_ERROR', 'Error en transcripción de audio', {
                                userId,
                                userName,
                                messageId: message.id,
                                error: result.error
                            });
                        }
                    }
                    break;

                case 'image':
                    this.terminalLog.image(userName);
                    
                    // Log técnico de sesión
                    logInfo('MESSAGE_RECEIVED', 'Imagen recibida', {
                        userId,
                        userName,
                        chatId,
                        messageType: 'image',
                        messageId: message.id
                    });
                    
                    if (message.image && message.image.link) {
                        // Agregar imagen al buffer para procesamiento directo con assistant
                        const imageMessage = {
                            type: 'image' as const,
                            imageUrl: message.image.link,
                            caption: message.image.caption || ''
                        };
                        this.bufferManager.addImageMessage(userId, imageMessage, chatId, userName);
                    }
                    break;
            }
        } catch (error: any) {
            this.terminalLog.error(`Error procesando mensaje de ${userName}: ${error.message}`);
        }

        // Enriquecimiento async si es necesario (no bloquea respuesta)
        if (shouldEnrichAsync) {
            this.queueAsyncEnrichment(phoneNumber, userName);
        }

        // CRM Analysis: Se ejecuta via Daily Actions Job, no en cada webhook
        // El análisis CRM se ejecuta diariamente a las 9:00 AM para todos los clientes
    }

    /**
     * Cola simple para enriquecimiento async (no bloquea mensaje)
     */
    private queueAsyncEnrichment(phoneNumber: string, currentUserName: string): void {
        // Delay corto para permitir que el mensaje se procese primero
        setTimeout(async () => {
            try {
                logInfo('ASYNC_ENRICHMENT_START', 'Iniciando enriquecimiento async', {
                    phoneNumber,
                    currentUserName,
                    reason: 'incomplete_data'
                });

                // Enriquecer desde Whapi
                await this.databaseService.enrichUserFromWhapi(phoneNumber);
                
                // Invalidar cache para forzar refresh en próximo mensaje
                // (Asumo que tienes acceso al cache desde bot, sino inyectar dependency)
                logSuccess('ASYNC_ENRICHMENT_COMPLETE', 'Enriquecimiento async completado', {
                    phoneNumber,
                    previousUserName: currentUserName
                });

            } catch (error) {
                logWarning('ASYNC_ENRICHMENT_ERROR', 'Error en enriquecimiento async, continuando', {
                    phoneNumber,
                    currentUserName,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }, 2000); // 2 segundos - no bloquea respuesta inmediata
    }

    /**
     * Método simple para sincronizar mensaje manual directo a OpenAI
     */
    private async syncManualMessageToOpenAI(userId: string, chatId: string, agentName: string, message: string): Promise<void> {
        try {
            // Obtener o crear thread para este usuario
            const threadId = await this.openaiService.getOrCreateThread(userId, chatId);
            
            // UNA SOLA llamada a OpenAI - mensaje del agente como assistant
            await this.openaiService.addSimpleMessage(threadId, 'assistant', `[Agente ${agentName}]: ${message}`);
            
            logSuccess('MANUAL_SYNC_SIMPLE', 'Mensaje manual sincronizado con OpenAI', {
                userId,
                agentName,
                threadId,
                messageLength: message.length
            });
            
        } catch (error) {
            logError('MANUAL_SYNC_ERROR', 'Error sincronizando mensaje manual', {
                userId,
                agentName,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
}