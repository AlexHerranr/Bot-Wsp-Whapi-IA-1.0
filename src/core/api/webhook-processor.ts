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
import { ClientDataCache } from '../state/client-data-cache';

export class WebhookProcessor {
    
    constructor(
        private bufferManager: BufferManager,
        private userManager: UserManager,
        private mediaManager: MediaManager,
        private mediaService: MediaService,
        private databaseService: DatabaseService,
        private delayedActivityService: DelayedActivityService,
        private openaiService: OpenAIService,
        private terminalLog: TerminalLog,
        private clientCache: ClientDataCache
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
            }, 'webhook-processor.ts');
            return;
        }
        
        // Log técnico de sesión para todos los webhooks válidos (compacto)
        const type = messages?.length ? `msg:${messages.length}` : 
                    presences?.length ? `pres:${presences.length}` :
                    statuses?.length ? `stat:${statuses.length}` : 'other';
        logInfo('WEBHOOK_RECEIVED', `📥 ${type}`, {
            data: type
        }, 'webhook-processor.ts');

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
            logInfo('WEBHOOK_OTHER', `📥 ${webhookType}`, { type: webhookType }, 'webhook-processor.ts');
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
            }, 'webhook-processor.ts');
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
                }, 'webhook-processor.ts');
                
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
                const wasTyping = userState.isTyping;
                const wasRecording = userState.isRecording;
                const wasActive = wasTyping || wasRecording;
                if (wasActive) {
                    const now = Date.now();
                    this.userManager.updateState(userId, { 
                        isTyping: false,
                        isRecording: false,
                        lastActivity: now
                    });
                    
                    logInfo('PRESENCE_EVENT', `Usuario dejó de ${wasTyping ? 'escribir' : 'grabar'}`, {
                        userId,
                        status,
                        userName: userState.userName || 'Usuario',
                        wasTyping,
                        wasRecording
                    }, 'webhook-processor.ts');
                    
                    // Si hay mensajes en buffer y el usuario estaba grabando, dar tiempo extra
                    // por si va a continuar grabando más audios
                    const buffer = this.bufferManager.getBuffer(userId);
                    if (buffer && buffer.messages.length > 0 && wasRecording) {
                        logInfo('BUFFER_GRACE_PERIOD', 'Extendiendo buffer por fin de grabación', {
                            userId,
                            userName: userState.userName || 'Usuario',
                            messageCount: buffer.messages.length,
                            reason: 'recording_ended_with_messages'
                        }, 'webhook-processor.ts');
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
            }, 'webhook-processor.ts');
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
        // Mejora: usar siempre el phoneNumber como userId canónico
        userId = phoneNumber || userId;
        
        // Extraer nombres del webhook (fuente principal - event-driven)
        const webhookChatName = (message as any).chat_name; // Nombre guardado del chat
        const webhookFromName = (message as any).from_name; // Display name del perfil
        
        // Obtener datos del cliente desde cache/BD
        let userName = 'Usuario'; // Fallback por defecto
        let shouldEnrichAsync = false;
        let clientNeedsUpdate = false;
        
        try {
            const clientData = await this.databaseService.findUserByPhoneNumber(phoneNumber);
            if (clientData) {
                // Priorizar name, luego userName, fallback a 'Usuario'
                userName = clientData.name || clientData.userName || 'Usuario';
                
                // Verificar si webhook tiene datos más actualizados
                clientNeedsUpdate = this.clientCache.needsUpdate(
                    phoneNumber, 
                    webhookChatName, 
                    webhookFromName,
                    undefined // labels - no vienen en webhook
                );
                
                // Solo enriquecer si necesita labels (names ya vienen del webhook)
                const hasNoLabels = !(clientData as any).labels;
                shouldEnrichAsync = hasNoLabels;
            } else {
                // Usuario nuevo → siempre necesita update y enriquecimiento
                clientNeedsUpdate = true;
                shouldEnrichAsync = true;
            }
        } catch (error) {
            console.warn(`⚠️ Error obteniendo nombre del contacto ${phoneNumber}:`, error);
            shouldEnrichAsync = true; // Por seguridad, intentar enriquecer
            clientNeedsUpdate = true; // Forzar actualización por el error
        }

        // Actualizar BD si el webhook tiene datos más nuevos (y no son solo phoneNumber)
        const hasValidChatName = webhookChatName && webhookChatName !== phoneNumber;
        const hasValidFromName = webhookFromName && webhookFromName !== phoneNumber;
        
        if (clientNeedsUpdate && (hasValidChatName || hasValidFromName)) {
            try {
                await this.databaseService.upsertClient({
                    phoneNumber,
                    userName: userName || 'Usuario', // Fallback limpio
                    chatId: chatId || `${phoneNumber}@s.whatsapp.net`,
                    lastActivity: new Date(),
                    chat_name: hasValidChatName ? webhookChatName : null,
                    from_name: hasValidFromName ? webhookFromName : null
                });
                
                // Usar el nombre más actualizado para el procesamiento
                if (hasValidChatName) {
                    userName = webhookChatName;
                }
                
                logInfo('CLIENT_UPDATED', 'Cliente actualizado desde webhook', {
                    phoneNumber,
                    chat_name: webhookChatName,
                    from_name: webhookFromName,
                    source: 'webhook_event'
                }, 'webhook-processor.ts');
                
                // Log debug para trazabilidad de nombres filtrados
                if (webhookChatName && !hasValidChatName) {
                    logDebug('NAME_SKIPPED', 'chat_name inválido (phoneNumber), seteado null', { 
                        phoneNumber, 
                        skipped_name: webhookChatName 
                    });
                }
                if (webhookFromName && !hasValidFromName) {
                    logDebug('NAME_SKIPPED', 'from_name inválido (phoneNumber), seteado null', { 
                        phoneNumber, 
                        skipped_name: webhookFromName 
                    });
                }
            } catch (error) {
                console.warn(`⚠️ Error actualizando cliente ${phoneNumber}:`, error);
            }
        }

        // Normalizar datos para BD: chatId con formato 
        let normalizedChatId = chatId;
        
        // chatId: formato completo (573246703524@s.whatsapp.net)
        if (normalizedChatId && !normalizedChatId.includes('@')) {
            normalizedChatId = normalizedChatId + '@s.whatsapp.net';
        }

        // Si es un mensaje manual (from_me=true) del agente: enviar directo a OpenAI
        const fromMe = message.from_me === true || message.fromMe === true;

        // Nueva regla: Manejo de from_me no-text
        if (fromMe && message.type !== 'text') {
            // Si es un mensaje del bot (ID conocido), ignorar para evitar loops
            if (message.id && this.mediaManager.isBotSentMessage(message.id)) {
                logDebug('FROM_ME_NON_TEXT_BOT_IGNORED', 'Mensaje from_me no-text del bot ignorado por ID', {
                    messageId: message.id,
                    type: message.type
                }, 'webhook-processor.ts');
                return;
            }

            // Si es del agente humano y es voz/audio, sincronizar como contexto sin respuesta
            const manualAgentEnabled = process.env.ENABLE_MANUAL_AGENT_MESSAGES === 'true';
            if (manualAgentEnabled && (message.type === 'voice' || message.type === 'audio' || message.type === 'ptt')) {
                const audioLink = message.voice?.link || message.audio?.link;
                if (!audioLink) {
                    logDebug('FROM_ME_VOICE_NO_LINK', 'from_me voz sin link, ignorado', {
                        messageId: message.id || 'sin_id'
                    }, 'webhook-processor.ts');
                    return;
                }
                try {
                    const transcription = await this.mediaService.legacyTranscribeAudio(audioLink, userId, userName, message.id);
                    if (transcription.success && transcription.result) {
                        // Anti-eco para voz manual basada en contenido (normalizado por MediaManager)
                        if (this.mediaManager.isBotSentContent(normalizedChatId, transcription.result)) {
                            logDebug('MANUAL_VOICE_ECHO_IGNORED', 'Transcripción manual coincide con contenido del bot (eco)', {
                                userId,
                                chatId: normalizedChatId,
                                preview: transcription.result.substring(0, 80)
                            });
                            return;
                        }

                        // Cap de longitud para contexto manual
                        let content = transcription.result;
                        const MAX_LEN = 4000;
                        if (content.length > MAX_LEN) {
                            content = content.substring(0, MAX_LEN) + '... [transcripción truncada para contexto]';
                        }
                        // Cliente objetivo para el contexto manual: usar chat_id o from
                        let clientUserId = message.chat_id || message.from;
                        if (clientUserId && typeof clientUserId === 'string' && clientUserId.includes('@')) {
                            clientUserId = clientUserId.split('@')[0];
                        }
                        const agentName = (message as any).chat_name || 'Agente';
                        await this.syncManualMessageToOpenAI(clientUserId, normalizedChatId, agentName, content);
                        logSuccess('MANUAL_VOICE_SYNC', 'Nota de voz manual sincronizada sin respuesta', {
                            userId: clientUserId,
                            agentName,
                            preview: content.substring(0, 100)
                        });
                    } else {
                        logWarning('MANUAL_VOICE_TRANSCRIPTION_FAILED', 'Fallo transcripción voz manual from_me', {
                            userId,
                            error: transcription.error
                        }, 'webhook-processor.ts');
                    }
                } catch (e: any) {
                    logWarning('MANUAL_VOICE_SYNC_ERROR', 'Error sincronizando voz manual', {
                        userId,
                        error: e?.message || String(e)
                    });
                }
                return; // No procesar más este mensaje
            }

            // Cualquier otro from_me no-text se ignora
            logDebug('FROM_ME_NON_TEXT_IGNORED', 'Mensaje from_me no-text ignorado', {
                messageId: message.id || 'sin_id',
                type: message.type
            }, 'webhook-processor.ts');
            return;
        }

        if (fromMe && message.type === 'text' && message.text?.body) {
            // Verificar si los mensajes manuales están habilitados
            const manualAgentEnabled = process.env.ENABLE_MANUAL_AGENT_MESSAGES === 'true';
            if (!manualAgentEnabled) {
                logDebug('FROM_ME_DISABLED', 'Mensajes from_me deshabilitados por configuración', {
                    messageId: message.id || 'sin_id'
                }, 'webhook-processor.ts');
                return;
            }
            
            // Ignorar mensajes interinos conocidos enviados por el bot durante function calling
            const interimPhrases = [
                'Permíteme y consulto en nuestro sistema',
                'Buscando habitaciones disponibles',
                'Calculando precios y ofertas',
                'Procesando tu reserva',
                'Un momento por favor'
            ];
            const textBodyLower = (message.text.body || '').toLowerCase();
            if (interimPhrases.some(p => textBodyLower.startsWith(p.toLowerCase()))) {
                logDebug('INTERIM_FROM_ME_IGNORED', 'Mensaje interino del bot filtrado por contenido', {
                    preview: message.text.body.substring(0, 80)
                });
                return;
            }

            // FILTRO 1: Verificar si el mensaje fue enviado por el bot (por ID)
            if (message.id && this.mediaManager.isBotSentMessage(message.id)) {
                logDebug('BOT_MESSAGE_FILTERED_ID', 'Mensaje del bot filtrado por ID', {
                    messageId: message.id
                }, 'webhook-processor.ts');
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
            // Cap de longitud para contexto manual
            let manualContent = message.text.body;
            const MAX_LEN = 4000;
            if (manualContent.length > MAX_LEN) {
                manualContent = manualContent.substring(0, MAX_LEN) + '... [texto truncado para contexto]';
            }
            let clientUserId = message.chat_id || message.from;
            if (clientUserId && typeof clientUserId === 'string' && clientUserId.includes('@')) {
                clientUserId = clientUserId.split('@')[0];
            }

            const agentName = (message as any).chat_name || 'Agente';
            
            logInfo('MANUAL_DETECTED', 'Mensaje manual del agente detectado', {
                userId: clientUserId,
                agentName,
                chatId: normalizedChatId,
                preview: message.text.body.substring(0, 100)
            });

            this.terminalLog.manualMessage(agentName, userName, message.text.body);
            
            // SOLUCIÓN SIMPLE: Enviar directo a OpenAI con UNA SOLA llamada
            await this.syncManualMessageToOpenAI(clientUserId, normalizedChatId, agentName, manualContent);
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
                            
                            // ✅ Log específico de mensaje citado detectado
                            logInfo('QUOTED_DETECTED', 'Mensaje citado detectado desde webhook', {
                                userId,
                                quotedId: message.context.quoted_id,
                                quotedPreview: quotedContent.substring(0, 80),
                                originalMessage: message.text.body.substring(0, 80)
                            });
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
                        this.bufferManager.addMessage(userId, messageContent, normalizedChatId, userName, quotedId);
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
                                
                                // ✅ Log específico de nota de voz citada detectada
                                logInfo('QUOTED_DETECTED', 'Nota de voz citada detectada desde webhook', {
                                    userId,
                                    quotedId: message.context.quoted_id,
                                    quotedPreview: quotedContent.substring(0, 80),
                                    transcription: result.result.substring(0, 80),
                                    messageType: 'voice'
                                });
                            }

                            // Filtro anti-eco: si la transcripción coincide con contenido que el bot envió recientemente, ignorar
                            if (this.mediaManager.isBotSentContent(normalizedChatId, result.result)) {
                                logDebug('BOT_VOICE_ECHO_IGNORED', 'Transcripción coincide con contenido enviado por el bot (eco)', {
                                    userId,
                                    chatId: normalizedChatId,
                                    preview: result.result.substring(0, 80)
                                });
                                return; // No agregar al buffer ni actualizar estado
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
                            this.bufferManager.addMessage(userId, finalMessage, normalizedChatId, userName, quotedId);
                        } else {
                            this.terminalLog.voiceError(userName, result.error || 'Transcription failed');
                            
                            // Log técnico de sesión - error de transcripción
                            logError('TRANSCRIPTION_ERROR', 'Error en transcripción de audio', {
                                userId,
                                userName,
                                messageId: message.id,
                                error: result.error
                            }, 'webhook-processor.ts');
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
                    }, 'webhook-processor.ts');
                    
                    if (message.image && message.image.link) {
                        // Agregar imagen al buffer para procesamiento directo con assistant
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
            this.terminalLog.error(`Error procesando mensaje de ${userName}: ${error.message}`);
        }

        // Enriquecimiento async si es necesario (no bloquea respuesta)
        if (shouldEnrichAsync) {
            this.queueAsyncEnrichment(phoneNumber, userName);
        }

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
                }, 'webhook-processor.ts');

                // Enriquecer desde Whapi
                await this.databaseService.enrichUserFromWhapi(phoneNumber);
                
                // Invalidar cache para forzar refresh en próximo mensaje
                // (Asumo que tienes acceso al cache desde bot, sino inyectar dependency)
                logSuccess('ASYNC_ENRICHMENT_COMPLETE', 'Enriquecimiento async completado', {
                    phoneNumber,
                    previousUserName: currentUserName
                }, 'webhook-processor.ts');

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

            // Nota previa para no responder automáticamente
            await this.openaiService.addSimpleMessage(threadId, 'user', `[Mensaje manual escrito por agente ${agentName} - NO RESPONDER]`);
            // Mensaje del agente como assistant, solo contexto
            await this.openaiService.addSimpleMessage(threadId, 'assistant', `[Agente ${agentName}]: ${message}`);
            
            logSuccess('MANUAL_SYNC_SIMPLE', 'Mensaje manual sincronizado con OpenAI', {
                userId,
                agentName,
                threadId,
                messageLength: message.length
            }, 'webhook-processor.ts');
            
        } catch (error) {
            logError('MANUAL_SYNC_ERROR', 'Error sincronizando mensaje manual', {
                userId,
                agentName,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
}