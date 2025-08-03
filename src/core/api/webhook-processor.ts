// src/core/api/webhook-processor.ts
import { BufferManager } from '../state/buffer-manager';
import { MediaManager } from '../state/media-manager';
import { UserManager } from '../state/user-state-manager';
import { MediaService } from '../services/media.service';
import { DatabaseService } from '../services/database.service';
import { TerminalLog } from '../utils/terminal-log';
import { WebhookPayloadSchema } from '../../shared/validation';
import { container } from 'tsyringe';
import { SimpleCRMService } from '../services/simple-crm.service';
import { RateLimiter } from '../utils/rate-limiter';
import { logInfo, logSuccess, logError, logWarning } from '../../utils/logging';

export class WebhookProcessor {
    
    constructor(
        private bufferManager: BufferManager,
        private userManager: UserManager,
        private mediaManager: MediaManager,
        private mediaService: MediaService,
        private databaseService: DatabaseService,
        private terminalLog: TerminalLog
    ) {}

    public async process(payload: unknown): Promise<void> {
        const body = payload as any;
        const { messages, presences, statuses, chats, contacts, groups, labels } = body;
        
        // Log técnico de sesión para todos los webhooks (compacto)
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
                
                // Log técnico de sesión para eventos de presencia (SIN rate limiting)
                logInfo('PRESENCE_EVENT', `Usuario ${status}`, {
                    userId,
                    status,
                    userName: userState.userName || 'Usuario',
                    timestamp: new Date().toISOString(),
                    timeSinceLastTyping: userState.lastTyping ? now - userState.lastTyping : 'never'
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
        // Ignorar mensajes enviados por el bot para evitar loops
        if (message.from_me || this.mediaManager.isBotSentMessage(message.id)) {
            return;
        }

        const userId = message.from;
        const chatId = message.chat_id || message.from; // Fallback si no hay chat_id
        
        // Extraer número de teléfono para buscar en BD
        let phoneNumber = userId;
        if (phoneNumber && phoneNumber.includes('@')) {
            phoneNumber = phoneNumber.split('@')[0];
        }
        
        // Obtener nombre real del contacto desde la base de datos
        let userName = 'Usuario'; // Fallback por defecto
        try {
            const clientData = await this.databaseService.findUserByPhoneNumber(phoneNumber);
            if (clientData && clientData.name) {
                userName = clientData.name;
            }
        } catch (error) {
            console.warn(`⚠️ Error obteniendo nombre del contacto ${phoneNumber}:`, error);
        }

        // Normalizar datos para BD: chatId con formato 
        let normalizedChatId = chatId;
        
        // chatId: formato completo (573246703524@s.whatsapp.net)
        if (normalizedChatId && !normalizedChatId.includes('@')) {
            normalizedChatId = normalizedChatId + '@s.whatsapp.net';
        }

        // Actualizar estado del usuario y resetear typing/recording (ya envió el mensaje)
        this.userManager.updateState(userId, { 
            userName, 
            chatId: normalizedChatId,
            isTyping: false,
            isRecording: false,
            lastActivity: Date.now()
        });
        
        // Guardar en BD con formato correcto
        if (this.databaseService) {
            await this.databaseService.upsertClient({
                phoneNumber,
                userName,
                chatId: normalizedChatId,
                lastActivity: new Date()
            });
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
                        this.bufferManager.addMessage(userId, messageContent, chatId, userName);
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
                        messageId: message.id
                    });
                    
                    // Configurar timer de 8s para voice
                    this.bufferManager.setIntelligentTimer(userId, 'voice');
                    const audioLink = message.voice?.link || message.audio?.link;
                    if (audioLink) {
                        const result = await this.mediaService.legacyTranscribeAudio(audioLink, userId, userName, message.id);
                        if (result.success && result.result) {
                            this.terminalLog.message(userName, `(Audio): ${result.result}`);
                            
                            // Log técnico de sesión - transcripción exitosa
                            logSuccess('AUDIO_TRANSCRIBED', 'Audio transcrito exitosamente', {
                                userId,
                                userName,
                                messageId: message.id,
                                transcription: result.result.substring(0, 100)
                            });
                            
                            this.bufferManager.addMessage(userId, result.result, chatId, userName);
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
                        this.mediaManager.addPendingImage(userId, message.image.link);
                        // Añadimos un placeholder al buffer para que se procese
                        this.bufferManager.addMessage(userId, '📷 Imagen recibida', chatId, userName);
                    }
                    break;
            }
        } catch (error: any) {
            this.terminalLog.error(`Error procesando mensaje de ${userName}: ${error.message}`);
        }

        // CRM Analysis: Se ejecuta via Daily Actions Job, no en cada webhook
        // El análisis CRM se ejecuta diariamente a las 9:00 AM para todos los clientes
    }
}