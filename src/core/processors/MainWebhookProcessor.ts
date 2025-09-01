// src/core/processors/MainWebhookProcessor.ts
import { BaseWebhookProcessor } from './base/BaseWebhookProcessor';
import { ProcessorConfig } from './base/IWebhookProcessor.interface';
import { RateLimiter } from '../utils/rate-limiter';
import { logInfo, logSuccess, logError, logWarning, logDebug } from '../../utils/logging';

export class MainWebhookProcessor extends BaseWebhookProcessor {
    
    canHandle(payload: any): boolean {
        // El MainProcessor maneja TODOS los webhooks EXCEPTO los del grupo de operaciones
        const operationsChatId = process.env.OPERATIONS_CHAT_ID;
        
        if (!operationsChatId) {
            // Si no hay chat de operaciones configurado, manejar todo
            return true;
        }

        // Verificar si es del grupo de operaciones
        const isOperationsGroup = this.isSpecificGroup(payload, operationsChatId);
        
        // MainProcessor maneja todo EXCEPTO operaciones
        return !isOperationsGroup;
    }

    getProcessorName(): string {
        return 'MainWebhookProcessor';
    }

    getConfig(): ProcessorConfig {
        return {
            assistantId: process.env.OPENAI_ASSISTANT_ID || '',
            bufferSettings: {
                timeout: 3000,
                fastMode: false
            },
            presenceSettings: {
                enabled: true,
                showTyping: true,
                showRecording: true
            },
            timingSettings: {
                humanTiming: true,
                responseDelay: 1000
            },
            logSettings: {
                compactMode: false,
                debugLevel: 'normal'
            }
        };
    }

    public async process(payload: unknown): Promise<void> {
        const body = payload as any;
        const { messages, presences, statuses, chats, contacts, groups, labels } = body;
        
        // LOG TEMPORAL: Ver TODOS los webhooks para debug
        logInfo('WEBHOOK_DEBUG', 'Procesando webhook [MAIN]', {
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
            first_message_from_me: body.messages?.[0]?.from_me,
            processor: 'main'
        });
        
        // FILTRO MUY ESPECÍFICO: Solo ignorar webhooks de salud sin datos útiles
        if (body.health && !body.messages && !body.presences && !body.statuses && !body.chats) {
            logDebug('HEALTH_WEBHOOK_IGNORED', 'Webhook solo de salud ignorado [MAIN]', {
                health_status: body.health?.status?.text || body.health_status
            }, 'main-webhook-processor.ts');
            return;
        }
        
        // Log técnico de sesión para todos los webhooks válidos (compacto)
        const type = messages?.length ? `msg:${messages.length}` : 
                    presences?.length ? `pres:${presences.length}` :
                    statuses?.length ? `stat:${statuses.length}` : 'other';
        logInfo('WEBHOOK_RECEIVED', `📥 ${type} [MAIN]`, {
            data: type,
            processor: 'main'
        }, 'main-webhook-processor.ts');

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
            logInfo('WEBHOOK_OTHER', `📥 ${webhookType} [MAIN]`, { 
                type: webhookType,
                processor: 'main'
            }, 'main-webhook-processor.ts');
            return;
        }

        // 4. WEBHOOK INVÁLIDO - Rate Limited (como en el monolítico)
        this.handleInvalidWebhook(body);
    }

    private handleInvalidWebhook(body: any): void {
        if (RateLimiter.shouldLogInvalidWebhook()) {
            // Extraer solo información relevante para debug
            const debugInfo = this.extractWebhookDebugInfo(body);
            
            logWarning('WEBHOOK', 'Webhook inválido recibido [MAIN]', { 
                ...debugInfo,
                note: 'Rate limited - solo se loggea una vez por minuto',
                processor: 'main'
            }, 'main-webhook-processor.ts');
        }
    }

    // Resto de métodos idénticos al webhook-processor original...
    // [Se incluye todo el código del webhook-processor.ts original aquí]
    
    // Para brevedad, copio los métodos esenciales:
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
                logInfo('BUFFER_EVENT', 'Evento de presencia detectado [MAIN]', {
                    userId,
                    userName: userState.userName || 'Usuario',
                    status,
                    reason: 'extend_timer',
                    processor: 'main'
                }, 'main-webhook-processor.ts');
                
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
                    
                    logInfo('PRESENCE_EVENT', `Usuario dejó de ${wasTyping ? 'escribir' : 'grabar'} [MAIN]`, {
                        userId,
                        status,
                        userName: userState.userName || 'Usuario',
                        wasTyping,
                        wasRecording,
                        processor: 'main'
                    }, 'main-webhook-processor.ts');
                    
                    // Si hay mensajes en buffer y el usuario estaba grabando, dar tiempo extra
                    // por si va a continuar grabando más audios
                    const buffer = this.bufferManager.getBuffer(userId);
                    if (buffer && buffer.messages.length > 0 && wasRecording) {
                        logInfo('BUFFER_GRACE_PERIOD', 'Extendiendo buffer por fin de grabación [MAIN]', {
                            userId,
                            userName: userState.userName || 'Usuario',
                            messageCount: buffer.messages.length,
                            reason: 'recording_ended_with_messages',
                            processor: 'main'
                        }, 'main-webhook-processor.ts');
                        // Extender timer para dar oportunidad de continuar
                        this.bufferManager.setIntelligentTimer(userId, 'voice');
                    }
                }
            }
        });
    }

    private async handleMessage(message: any): Promise<void> {
        // Implementación IDÉNTICA al webhook-processor original pero con logs [MAIN]
        
        // Primero verificar si es un mensaje del bot (por ID)
        if (message && message.id && this.mediaManager.isBotSentMessage(message.id)) {
            logDebug('BOT_ECHO_IGNORED', 'Eco del bot ignorado por ID [MAIN]', {
                messageId: message.id
            }, 'main-webhook-processor.ts');
            return;
        }

        // SIMPLIFICADO: Usar chat_id como ID único para todo (grupos y chats individuales)
        const chatId = message.chat_id || message.from;  // ID único del chat/conversación  
        let userId = chatId; // Usar mismo ID para identificar conversación
        
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
        
        // Extraer datos adicionales del webhook
        const webhookTimestamp = message.timestamp ? new Date(message.timestamp * 1000) : new Date(); // Unix timestamp a Date
        const webhookSource = message.source || 'unknown'; // Origen del mensaje
        
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
                // Usuario nuevo → siempre necesita update y enriquecimiento SÍNCRONO
                clientNeedsUpdate = true;
                shouldEnrichAsync = false; // CAMBIO: Para nuevos usuarios, enriquecer síncronamente
                
                logInfo('NEW_USER_SYNC_ENRICHMENT', 'Usuario nuevo detectado - enriquecimiento síncrono [MAIN]', {
                    phoneNumber,
                    reason: 'avoid_NOHAYREGISTRO_in_first_message'
                });
            }
        } catch (error) {
            console.warn(`⚠️ Error obteniendo nombre del contacto ${phoneNumber}:`, error);
            shouldEnrichAsync = true; // Por seguridad, intentar enriquecer
            clientNeedsUpdate = true; // Forzar actualización por el error
        }

        // Actualizar BD si el webhook tiene datos más nuevos (y no son solo phoneNumber)
        const hasValidChatName = webhookChatName && webhookChatName !== phoneNumber;
        
        // ULTRA PERMISIVO: from_name se guarda tal como viene, solo rechazar si es exactamente igual al phoneNumber
        const hasValidFromName = webhookFromName && 
                                webhookFromName.trim() !== '' &&
                                webhookFromName !== phoneNumber;
        
        if (clientNeedsUpdate && (hasValidChatName || hasValidFromName)) {
            try {
                await this.databaseService.upsertClient({
                    phoneNumber,
                    userName: userName || phoneNumber, // Usar userName actual o phoneNumber como fallback
                    chatId: chatId || `${phoneNumber}@s.whatsapp.net`,
                    lastActivity: webhookTimestamp, // ✅ MEJORADO: Usar timestamp real del mensaje
                    chat_name: hasValidChatName ? webhookChatName : null,
                    from_name: hasValidFromName ? webhookFromName : null
                });
                
                // Usar el nombre más actualizado para el procesamiento
                if (hasValidChatName) {
                    userName = webhookChatName;
                }
                
                logInfo('CLIENT_UPDATED', 'Cliente actualizado desde webhook [MAIN]', {
                    phoneNumber,
                    chat_name: webhookChatName,
                    from_name: webhookFromName,
                    source: 'webhook_event'
                }, 'main-webhook-processor.ts');
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

        // Manejo de from_me (mensajes manuales del agente)
        if (fromMe) {
            const manualAgentEnabled = process.env.ENABLE_MANUAL_AGENT_MESSAGES === 'true';
            if (!manualAgentEnabled) {
                logDebug('FROM_ME_DISABLED', 'Mensajes from_me deshabilitados por configuración [MAIN]', {
                    messageId: message.id || 'sin_id'
                }, 'main-webhook-processor.ts');
                return;
            }
            
            // Filtros de bot y manejo manual simplificado
            if (message.id && this.mediaManager.isBotSentMessage(message.id)) {
                logDebug('BOT_MESSAGE_FILTERED_ID', 'Mensaje del bot filtrado por ID [MAIN]', {
                    messageId: message.id
                }, 'main-webhook-processor.ts');
                return;
            }
            
            if (message.type === 'text' && message.text?.body) {
                if (this.mediaManager.isBotSentContent(normalizedChatId, message.text.body)) {
                    logDebug('BOT_MESSAGE_FILTERED_CONTENT', 'Mensaje del bot filtrado por contenido [MAIN]', {
                        messageId: message.id || 'sin_id',
                        preview: message.text.body.substring(0, 50)
                    });
                    return;
                }

                // Es un mensaje manual del agente real
                let clientUserId = message.chat_id || message.from;
                if (clientUserId && typeof clientUserId === 'string' && clientUserId.includes('@')) {
                    clientUserId = clientUserId.split('@')[0];
                }

                const agentName = (message as any).chat_name || 'Agente';
                
                logInfo('MANUAL_DETECTED', 'Mensaje manual del agente detectado [MAIN]', {
                    userId: clientUserId,
                    agentName,
                    chatId: normalizedChatId,
                    preview: message.text.body.substring(0, 100)
                });

                this.terminalLog.manualMessage(agentName, userName, message.text.body);
                
                await this.syncManualMessageToOpenAI(clientUserId, normalizedChatId, agentName, message.text.body);
                return;
            }
            
            // Cualquier otro from_me se ignora
            logDebug('FROM_ME_IGNORED', 'Mensaje from_me ignorado [MAIN]', {
                messageId: message.id || 'sin_id',
                type: message.type
            }, 'main-webhook-processor.ts');
            return;
        }

        // Actualizar estado del usuario y resetear typing/recording (ya envió el mensaje)
        this.userManager.updateState(userId, { 
            userName, 
            chatId: normalizedChatId,
            isTyping: false,
            isRecording: false,
            lastActivity: webhookTimestamp.getTime() // ✅ MEJORADO: Usar timestamp real del mensaje
        });
        
        // Programar actualización delayed de BD (10 minutos después)
        this.delayedActivityService.scheduleUpdate(phoneNumber);
        
        // ENRIQUECIMIENTO SÍNCRONO para usuarios nuevos (evita NOHAYREGISTRO en primer mensaje)
        if (!shouldEnrichAsync && clientNeedsUpdate) {
            try {
                logInfo('SYNC_ENRICHMENT_START', 'Enriquecimiento síncrono para usuario nuevo [MAIN]', {
                    phoneNumber,
                    reason: 'first_message_context_complete'
                });
                
                await this.databaseService.enrichUserFromWhapi(phoneNumber);
                
                // Actualizar userName con datos enriquecidos para este procesamiento
                const enrichedData = await this.databaseService.findUserByPhoneNumber(phoneNumber);
                if (enrichedData) {
                    userName = enrichedData.name || enrichedData.userName || userName;
                    logInfo('SYNC_ENRICHMENT_COMPLETE', 'Usuario enriquecido síncronamente [MAIN]', {
                        phoneNumber,
                        enrichedName: enrichedData.name,
                        enrichedUserName: enrichedData.userName,
                        finalUserName: userName,
                        labelsCount: (enrichedData as any).labels ? (enrichedData as any).labels.split('/').length : 0
                    });
                }
            } catch (error) {
                logWarning('SYNC_ENRICHMENT_ERROR', 'Error en enriquecimiento síncrono, continuando [MAIN]', {
                    phoneNumber,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        try {
            switch (message.type) {
                case 'text':
                    if (message.text && message.text.body) {
                        let messageContent = message.text.body;
                        
                        // Marcar que el último input NO fue voz
                        this.userManager.updateState(userId, { lastInputVoice: false });
                        
                        // Detectar si es una respuesta/quote y formatear para OpenAI
                        if (message.context && message.context.quoted_id) {
                            let quotedContent = message.context.quoted_content?.body || 
                                               message.context.quoted_content?.text ||
                                               message.context.quoted_text ||
                                               '[mensaje citado - contenido no disponible]';
                            
                            if (quotedContent === '[mensaje citado - contenido no disponible]' && 
                                this.mediaManager.isBotSentMessage(message.context.quoted_id)) {
                                quotedContent = '[mensaje del asistente citado]';
                            }
                            
                            messageContent = `Cliente responde a este mensaje: ${quotedContent}\n\nMensaje del cliente: ${message.text.body}`;
                        }
                        
                        // Log técnico de sesión
                        logInfo('MESSAGE_RECEIVED', 'Mensaje de texto recibido [MAIN]', {
                            userId,
                            userName,
                            chatId,
                            messageType: 'text',
                            messageId: message.id,
                            source: webhookSource,
                            timestamp: webhookTimestamp.toISOString(),
                            body: message.text.body.substring(0, 100)
                        });
                        
                        this.terminalLog.message(userName, message.text.body);
                        
                        this.bufferManager.addMessage(userId, messageContent, normalizedChatId, userName, undefined, message.id);
                    }
                    break;

                case 'voice':
                case 'audio':
                case 'ptt':
                    this.terminalLog.voice(userName);
                    
                    // Marcar que el último input fue voz
                    this.userManager.updateState(userId, { lastInputVoice: true });
                    
                    // Log técnico de sesión
                    logInfo('MESSAGE_RECEIVED', 'Mensaje de voz recibido [MAIN]', {
                        userId,
                        userName,
                        chatId,
                        messageType: 'voice',
                        messageId: message.id,
                        source: webhookSource,
                        timestamp: webhookTimestamp.toISOString(),
                        hasQuoted: !!(message.context && message.context.quoted_id)
                    });
                    
                    // Configurar timer de 8s para voice
                    this.bufferManager.setIntelligentTimer(userId, 'voice');
                    const audioLink = message.voice?.link || message.audio?.link;
                    if (audioLink) {
                        const result = await this.mediaService.legacyTranscribeAudio(audioLink, userId, userName, message.id);
                        if (result.success && result.result) {
                            let finalMessage = result.result;
                            
                            // Detectar si es una respuesta/quote y formatear para OpenAI
                            if (message.context && message.context.quoted_id) {
                                let quotedContent = message.context.quoted_content?.body || 
                                                   message.context.quoted_content?.text ||
                                                   message.context.quoted_text ||
                                                   '[mensaje citado - contenido no disponible]';
                                
                                if (quotedContent === '[mensaje citado - contenido no disponible]' && 
                                    this.mediaManager.isBotSentMessage(message.context.quoted_id)) {
                                    quotedContent = '[mensaje del asistente citado]';
                                }
                                
                                finalMessage = `Cliente responde con nota de voz a este mensaje: ${quotedContent}\n\nTranscripción de la nota de voz: ${result.result}`;
                            }

                            // Filtro anti-eco: si la transcripción coincide con contenido que el bot envió recientemente, ignorar
                            if (this.mediaManager.isBotSentContent(normalizedChatId, result.result)) {
                                logDebug('BOT_VOICE_ECHO_IGNORED', 'Transcripción coincide con contenido enviado por el bot (eco) [MAIN]', {
                                    userId,
                                    chatId: normalizedChatId,
                                    preview: result.result.substring(0, 80)
                                });
                                return; // No agregar al buffer ni actualizar estado
                            }
                            
                            this.terminalLog.message(userName, `(Nota de Voz Transcrita por Whisper)\n🎤 ${result.result}`);
                            
                            logSuccess('AUDIO_TRANSCRIBED', 'Audio transcrito exitosamente [MAIN]', {
                                userId,
                                userName,
                                messageId: message.id,
                                transcription: result.result.substring(0, 100),
                                hasQuoted: !!(message.context && message.context.quoted_id)
                            });
                            
                            this.bufferManager.addMessage(userId, finalMessage, normalizedChatId, userName, undefined, message.id);
                        } else {
                            this.terminalLog.voiceError(userName, result.error || 'Transcription failed');
                            
                            logError('TRANSCRIPTION_ERROR', 'Error en transcripción de audio [MAIN]', {
                                userId,
                                userName,
                                messageId: message.id,
                                error: result.error
                            }, 'main-webhook-processor.ts');
                        }
                    }
                    break;

                case 'image':
                    this.terminalLog.image(userName);
                    
                    logInfo('MESSAGE_RECEIVED', 'Imagen recibida [MAIN]', {
                        userId,
                        userName,
                        chatId,
                        messageType: 'image',
                        messageId: message.id,
                        source: webhookSource,
                        timestamp: webhookTimestamp.toISOString()
                    }, 'main-webhook-processor.ts');
                    
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
            this.terminalLog.error(`Error procesando mensaje de ${userName}: ${error.message}`);
        }

        // Enriquecimiento async si es necesario (no bloquea respuesta)
        if (shouldEnrichAsync) {
            this.queueAsyncEnrichment(phoneNumber, userName);
        }
    }

    private queueAsyncEnrichment(phoneNumber: string, currentUserName: string): void {
        // Delay corto para permitir que el mensaje se procese primero
        setTimeout(async () => {
            try {
                logInfo('ASYNC_ENRICHMENT_START', 'Iniciando enriquecimiento async [MAIN]', {
                    phoneNumber,
                    currentUserName,
                    reason: 'incomplete_data'
                }, 'main-webhook-processor.ts');

                // Enriquecer desde Whapi
                await this.databaseService.enrichUserFromWhapi(phoneNumber);
                
                logSuccess('ASYNC_ENRICHMENT_COMPLETE', 'Enriquecimiento async completado [MAIN]', {
                    phoneNumber,
                    previousUserName: currentUserName
                }, 'main-webhook-processor.ts');

            } catch (error) {
                logWarning('ASYNC_ENRICHMENT_ERROR', 'Error en enriquecimiento async, continuando [MAIN]', {
                    phoneNumber,
                    currentUserName,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }, 2000); // 2 segundos - no bloquea respuesta inmediata
    }

    private async syncManualMessageToOpenAI(userId: string, chatId: string, agentName: string, message: string): Promise<void> {
        try {
            // Obtener o crear thread para este usuario
            const threadId = await this.openaiService.getOrCreateThread(userId, chatId);

            // Nota previa para no responder automáticamente
            await this.openaiService.addSimpleMessage(threadId, 'user', `[Mensaje manual escrito por agente ${agentName} - NO RESPONDER]`);
            // Mensaje del agente como assistant, solo contexto
            await this.openaiService.addSimpleMessage(threadId, 'assistant', `[Agente ${agentName}]: ${message}`);
            
            logSuccess('MANUAL_SYNC_SIMPLE', 'Mensaje manual sincronizado con OpenAI [MAIN]', {
                userId,
                agentName,
                threadId,
                messageLength: message.length
            }, 'main-webhook-processor.ts');
            
        } catch (error) {
            logError('MANUAL_SYNC_ERROR', 'Error sincronizando mensaje manual [MAIN]', {
                userId,
                agentName,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
}