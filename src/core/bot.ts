// src/core/bot.ts
import 'reflect-metadata';
import express from 'express';
import http from 'http';
import OpenAI from 'openai';
import { injectable, container } from 'tsyringe';

// Importar todos nuestros módulos y servicios
import { BufferManager } from './state/buffer-manager';
import { UserManager } from './state/user-state-manager';
import { MediaManager } from './state/media-manager';
import { ClientDataCache } from './state/client-data-cache';
import { MediaService } from './services/media.service';
import { WhatsappService } from './services/whatsapp.service';
import { DatabaseService } from './services/database.service';
import { DelayedActivityService } from './services/delayed-activity.service';
import { FunctionRegistryService } from './services/function-registry.service';
import { OpenAIService } from './services/openai.service';
import { ThreadPersistenceService } from './services/thread-persistence.service';
import { WebhookProcessor } from './api/webhook-processor';
import { TerminalLog } from './utils/terminal-log';
// import { HotelPlugin } from '../plugins/hotel/hotel.plugin'; // Moved to main.ts
import { IFunctionRegistry } from '../shared/interfaces';
import { crmRoutes } from './routes/crm.routes';
import { logBotReady, logServerStart, logInfo, logSuccess, logError, logWarning } from '../utils/logging';
import { HotelValidation } from '../plugins/hotel/logic/validation';

// Simulación de la configuración
interface AppConfig {
    port: number;
    host: string;
    secrets: {
        OPENAI_API_KEY: string;
        WHAPI_API_URL: string;
        WHAPI_TOKEN: string;
    }
}

@injectable()
export class CoreBot {
    private app: express.Application;
    private server: http.Server;
    private config: AppConfig;
    private openai: OpenAI;

    // Módulos
    private terminalLog: TerminalLog;
    private userManager: UserManager;
    private mediaManager: MediaManager;
    private bufferManager: BufferManager;
    private clientDataCache: ClientDataCache;
    private databaseService: DatabaseService;
    private delayedActivityService: DelayedActivityService;
    private mediaService: MediaService;
    private whatsappService: WhatsappService;
    private openaiService: OpenAIService;
    private threadPersistence: ThreadPersistenceService;
    private webhookProcessor: WebhookProcessor;
    // private hotelPlugin: HotelPlugin; // Moved to main.ts
    private functionRegistry: IFunctionRegistry;
    private cleanupIntervals: NodeJS.Timeout[] = [];
    private lastError: Record<string, { time: number }> = {};
    private hotelValidation: HotelValidation;

    constructor(
        config: AppConfig,
        functionRegistry?: IFunctionRegistry
    ) {
        this.config = config;
        this.app = express();
        this.server = http.createServer(this.app);

        this.openai = new OpenAI({ apiKey: this.config.secrets.OPENAI_API_KEY });

        // Inicializar todos los módulos
        this.terminalLog = new TerminalLog({ 
            addLog: (log: string) => console.log(log) 
        }, { 
            port: config.port, 
            host: config.host,
            showFunctionLogs: true 
        });
        this.userManager = new UserManager();
        this.mediaManager = new MediaManager();
        this.clientDataCache = new ClientDataCache();
        this.databaseService = new DatabaseService();
        this.delayedActivityService = new DelayedActivityService(this.databaseService);

        // Inyectar cache en database service para actualizaciones BD->Cache
        this.databaseService.setClientCache(this.clientDataCache);

        this.mediaService = new MediaService(this.terminalLog, {
            openaiApiKey: this.config.secrets.OPENAI_API_KEY,
            whapiApiUrl: this.config.secrets.WHAPI_API_URL,
            whapiToken: this.config.secrets.WHAPI_TOKEN
        });
        this.whatsappService = new WhatsappService(this.openai, this.terminalLog, this.config, this.databaseService);
        
        // Function registry passed from main.ts (with plugins already registered)
        this.functionRegistry = functionRegistry || container.resolve(FunctionRegistryService);

        // Initialize OpenAI Service with function registry
        this.openaiService = new OpenAIService({
            apiKey: this.config.secrets.OPENAI_API_KEY,
            assistantId: process.env.ASSISTANT_ID || process.env.OPENAI_ASSISTANT_ID || 'asst_default'
        }, this.terminalLog, undefined, this.functionRegistry);

        // Initialize Thread Persistence Service
        this.threadPersistence = new ThreadPersistenceService(this.databaseService);

        this.bufferManager = new BufferManager(
            this.processBufferCallback.bind(this),
            (userId: string) => this.userManager.getState(userId)
        );
        this.webhookProcessor = new WebhookProcessor(this.bufferManager, this.userManager, this.mediaManager, this.mediaService, this.databaseService, this.delayedActivityService, this.openaiService, this.terminalLog);
        this.hotelValidation = new HotelValidation();

        this.setupMiddleware();
        this.setupRoutes();
    }

    private setupMiddleware() {
        this.app.use(express.json({ limit: '50mb' }));
    }

    private setupRoutes() {
        // Health check endpoint with detailed status
        this.app.get('/health', (req, res) => {
            const stats = this.getStats();
            res.status(200).json({
                status: 'healthy',
                timestamp: new Date(),
                version: process.env.npm_package_version || '1.0.0',
                uptime: process.uptime(),
                ...stats
            });
        });

        // Main webhook endpoint
        this.app.post('/hook', async (req, res) => {
            try {
                // Respond immediately to acknowledge receipt
                res.status(200).json({ 
                    received: true, 
                    timestamp: new Date().toISOString(),
                    requestId: req.headers['x-request-id'] || 'unknown'
                });
                
                // Process webhook asynchronously
                await this.webhookProcessor.process(req.body);
            } catch (error: any) {
                console.error('Webhook processing error:', error.message);
                // Don't fail the response since we already acknowledged
            }
        });

        // Status endpoint for monitoring
        this.app.get('/status', (req, res) => {
            res.status(200).json(this.getStats());
        });

        // Functions registry endpoint
        this.app.get('/functions', (req, res) => {
            res.status(200).json({
                functions: this.functionRegistry.list(),
                stats: this.functionRegistry.getStats(),
                history: this.functionRegistry.getRegistrationHistory()
            });
        });

        // Simple ping endpoint for load balancers
        this.app.get('/ping', (req, res) => {
            res.status(200).send('pong');
        });

        // Hook endpoint para actualizaciones externas de usuarios
        this.app.post('/update-user', async (req: any, res: any) => {
            try {
                const { userId, changes } = req.body;
                
                if (!userId) {
                    return res.status(400).json({ error: 'userId is required' });
                }

                logInfo('HOOK_UPDATE', `Recibido hook de actualización para usuario: ${userId}`, { 
                    userId, 
                    changes: changes || ['all'],
                    source: 'external_hook'
                });

                // Invalidar cache para forzar refresh en próximo acceso
                try {
                    this.clientDataCache.invalidate(userId);
                } catch (error) {
                    logWarning('CACHE_INVALIDATE_ERROR', 'Error invalidando cache, continuando', {
                        userId,
                        error: error instanceof Error ? error.message : String(error),
                        operation: 'cache_invalidate'
                    });
                }

                // Si necesitas actualizar datos específicos, puedes hacerlo aquí
                if (changes && changes.includes('enrichment')) {
                    // Forzar enriquecimiento manual
                    await this.databaseService.enrichUserFromWhapi(userId);
                }

                res.json({ 
                    success: true, 
                    message: `Cache invalidated for user ${userId}`,
                    changes: changes || ['cache_invalidated']
                });

            } catch (error) {
                logError('HOOK_ERROR', `Error procesando hook de actualización`, { 
                    error: error instanceof Error ? error.message : error,
                    body: req.body
                });
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        // CRM API routes
        this.app.use('/api/crm', crmRoutes as any);
    }

    private async processBufferCallback(userId: string, combinedText: string, chatId: string, userName: string, imageMessage?: { type: 'image', imageUrl: string, caption: string }): Promise<void> {
        // Check for recent errors to prevent secondary buffer processing during error recovery
        if (this.lastError[userId] && Date.now() - this.lastError[userId].time < 5000) {
            logWarning('BUFFER_SKIP_RECENT_ERROR', 'Saltando procesamiento de buffer secundario por error reciente', {
                userId,
                userName,
                chatId,
                timeSinceError: Date.now() - this.lastError[userId].time,
                reason: 'recent_error_recovery'
            });
            return;
        }

        // NOTA: NO verificar si el buffer está vacío aquí - BufferManager ya lo maneja
        // El buffer ya fue procesado y vaciado en BufferManager antes de llamar este callback
        // Los mensajes ya vienen en combinedText
        
        // Si no hay contenido para procesar, salir temprano
        if (!combinedText && !imageMessage) {
            logInfo('BUFFER_NO_CONTENT', 'No hay contenido para procesar', {
                userId,
                userName,
                chatId,
                reason: 'empty_callback'
            });
            return;
        }

        // NOTA: Los mensajes manuales ahora se manejan directamente en WebhookProcessor

        // NOTA: Verificación de typing removida - el BufferManager ya maneja los delays correctamente
        // No necesitamos delays adicionales aquí ya que el buffer espera el tiempo apropiado
        const userState = this.userManager.getState(userId);

        // Log técnico de sesión - inicio de procesamiento
        logInfo('MESSAGE_PROCESS', 'Iniciando procesamiento de buffer', {
            userId,
            userName,
            chatId,
            messageCount: combinedText.split('\n').length,
            hasImage: !!imageMessage,
            imageCaption: imageMessage?.caption || '',
            preview: combinedText.substring(0, 100)
        }, 'bot.ts');

        try {
            // 1. Intentar obtener datos del cliente desde caché con manejo de errores
            let clientData: any = null;
            let needsDatabaseQuery = false;
            
            try {
                clientData = this.clientDataCache.get(userId);
            } catch (error) {
                logWarning('CACHE_ACCESS_ERROR', 'Error accediendo al cache, consultando BD directamente', {
                    userId,
                    userName,
                    error: error instanceof Error ? error.message : String(error),
                    operation: 'cache_get',
                    fallback: 'database_query'
                });
                clientData = null; // Forzar consulta BD
            }

            // 2. Verificar si necesitamos consultar la BD (caché vacío o datos desactualizados)
            let needsUpdate = false;
            try {
                needsUpdate = clientData ? this.clientDataCache.needsUpdate(userId, userName) : false;
            } catch (error) {
                logWarning('CACHE_NEEDS_UPDATE_ERROR', 'Error verificando si cache necesita actualización, asumiendo que sí', {
                    userId,
                    userName,
                    error: error instanceof Error ? error.message : String(error),
                    operation: 'cache_needsUpdate',
                    fallback: 'assume_needs_update'
                });
                needsUpdate = true; // Forzar actualización por seguridad
            }
            
            if (!clientData || needsUpdate) {
                needsDatabaseQuery = true;
                
                logInfo('CACHE_MISS', 'Consultando BD por caché vacío o datos desactualizados', {
                    userId,
                    userName,
                    hadCache: !!clientData,
                    reason: !clientData ? 'no_cache' : 'data_mismatch'
                });

                // Consultar BD solo cuando sea necesario - con manejo de errores
                let user = null;
                let dbClientData = null;
                
                try {
                    const existingUser = await this.databaseService.findUserByPhoneNumber(userId);
                    user = existingUser;
                    if (!existingUser) {
                        user = await this.databaseService.getOrCreateUser(userId, userName);
                    }
                    await this.userManager.getOrCreateUser(userId, userName);
                } catch (error) {
                    logWarning('BD_USER_ERROR', 'Error consultando/creando usuario en BD, continuando sin datos BD', {
                        userId,
                        userName,
                        error: error instanceof Error ? error.message : String(error),
                        operation: 'findUserByPhoneNumber_or_getOrCreateUser'
                    });
                    // Continuar sin datos de usuario BD
                }
                
                try {
                    // Obtener datos completos del cliente desde BD
                    dbClientData = await this.databaseService.getThread(userId);
                } catch (error) {
                    logWarning('BD_THREAD_ERROR', 'Error consultando thread en BD, continuando sin datos BD', {
                        userId,
                        userName,
                        error: error instanceof Error ? error.message : String(error),
                        operation: 'getThread'
                    });
                    // Continuar sin datos de thread BD
                }
                
                if (dbClientData) {
                    try {
                        // Actualizar caché con datos frescos de BD
                        this.clientDataCache.updateFromDatabase(userId, {
                            name: user?.name || null,
                            userName: user?.userName || userName || null,
                            labels: dbClientData.labels || [],
                            chatId: dbClientData.chatId,
                            lastActivity: dbClientData.lastActivity,
                            threadTokenCount: dbClientData.threadTokenCount || 0
                        });
                        
                        clientData = this.clientDataCache.get(userId);
                    } catch (error) {
                        logWarning('CACHE_UPDATE_ERROR', 'Error actualizando cache desde BD, continuando con datos mínimos', {
                            userId,
                            userName,
                            error: error instanceof Error ? error.message : String(error),
                            operation: 'updateFromDatabase'
                        });
                        // Continuar sin actualizar cache
                    }
                } else {
                    // Si no hay datos de BD, crear datos mínimos para continuar
                    logInfo('BD_NO_DATA', 'Sin datos en BD, creando datos mínimos para continuar', {
                        userId,
                        userName,
                        reason: 'no_db_data_found'
                    });
                }
            } else {
                logInfo('CACHE_HIT', 'Usando datos del cliente desde caché', {
                    userId,
                    userName,
                    cachedName: clientData.name,
                    cachedLabels: clientData.labels,
                    cacheAge: Date.now() - clientData.cachedAt.getTime()
                });
            }

            const labels = clientData?.labels || [];
            
            // Log para bursts procesados (mejor trazabilidad de agrupación)
            const messageCount = combinedText.split('\n').length;
            if (messageCount > 1) {
                logInfo('BURST_PROCESSED', 'Procesando burst de mensajes agrupados', {
                    userId,
                    userName,
                    messageCount,
                    combinedLength: combinedText.length,
                    reason: 'multi_message_burst'
                });
            }
            
            // 3. Construir mensaje contextual con formato temporal
            const contextualMessage = this.buildContextualMessage(
                userName,
                clientData?.name || null,
                labels,
                combinedText
            );
            
            // Log detallado del mensaje que se enviará a OpenAI
            logInfo('OPENAI_MESSAGE_PREPARED', 'Mensaje preparado para OpenAI', {
                userId,
                userName,
                combinedTextPreview: combinedText.substring(0, 200),
                combinedTextLength: combinedText.length,
                contextualMessagePreview: contextualMessage.substring(0, 300),
                contextualMessageLength: contextualMessage.length,
                hasLabels: labels.length > 0,
                labels: labels,
                displayName: clientData?.name || null
            });

            // 4. Obtener thread existente y verificar si necesita renovación
            const existingThread = await this.threadPersistence.getThread(userId);
            let existingThreadId = existingThread?.threadId;

            // Verificación removida - OpenAIService.processMessage ya valida el thread
            // con cache, evitando llamadas duplicadas a OpenAI
            // La validación se hace dentro de OpenAIService.validateThread() con cache de 30min

            // Verificar si el thread necesita renovación por edad (después de validación)
            if (existingThreadId) {
                const renewalCheck = await this.threadPersistence.shouldRenewThread(userId);
                if (renewalCheck.shouldRenew) {
                    logWarning('THREAD_RENEWAL', `Thread renovado por: ${renewalCheck.reason}`, {
                        userId,
                        userName,
                        oldThreadId: existingThreadId,
                        reason: renewalCheck.reason
                    });
                    existingThreadId = undefined; // Forzar creación de thread nuevo
                }
            }

            // Verificar longitud máxima antes de enviar a OpenAI
            const MAX_LENGTH = 4000; // Límite conservador para evitar overflow de tokens
            let processedMessage = contextualMessage;
            if (contextualMessage.length > MAX_LENGTH) {
                processedMessage = contextualMessage.substring(0, MAX_LENGTH) + '... [mensaje truncado]';
                logWarning('MESSAGE_TRUNCATED', 'Mensaje truncado por longitud excesiva', {
                    userId,
                    userName,
                    originalLength: contextualMessage.length,
                    truncatedLength: processedMessage.length,
                    limit: MAX_LENGTH
                });
            }

            // ❌ ELIMINADO: No inyectar IDs internos en el prompt
            // El contexto quoted ya viene formateado desde webhook-processor

            // 5. Verificar si hay un run activo antes de procesar
            if (existingThreadId) {
                const maxWaitAttempts = 5;
                let waitAttempts = 0;
                
                while (waitAttempts < maxWaitAttempts) {
                    const runStatus = await this.openaiService.checkActiveRun(existingThreadId);
                    if (runStatus.isActive) {
                        logWarning('RUN_ACTIVE_WAITING', 'Esperando que termine run activo', { 
                            userId, 
                            threadId: existingThreadId,
                            attempt: waitAttempts + 1,
                            maxAttempts: maxWaitAttempts
                        });
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        waitAttempts++;
                    } else {
                        break;
                    }
                }
                
                if (waitAttempts >= maxWaitAttempts) {
                    logWarning('RUN_WAIT_TIMEOUT', 'Timeout esperando run activo; reencolando mensaje para no perderlo', { 
                        userId,
                        threadId: existingThreadId,
                        combinedLength: processedMessage.length
                    });
                    // Reencolar el mensaje para procesarlo después y no perderlo
                    try {
                        this.bufferManager.addMessage(userId, combinedText, chatId, userName);
                        this.bufferManager.setIntelligentTimer(userId, 'message');
                        logInfo('BUFFER_REQUEUED', 'Mensaje reencolado por run activo', {
                            userId,
                            userName,
                            length: combinedText.length
                        });
                    } catch (requeueError) {
                        logWarning('BUFFER_REQUEUE_FAILED', 'Fallo reencolando mensaje tras timeout de run', {
                            userId,
                            error: requeueError instanceof Error ? requeueError.message : String(requeueError)
                        });
                    }
                    return;
                }
            }

            // Enviar indicador de estado apropiado antes de procesar
            let userState = this.userManager.getOrCreateState(userId);
            try {
                if (userState.lastInputVoice) {
                    // Si el último input fue voz, mostrar "grabando"
                    await this.whatsappService.sendRecordingIndicator(chatId);
                    logInfo('INDICATOR_SENT', 'Indicador de grabación enviado exitosamente', { 
                        userId, 
                        userName, 
                        chatId,
                        indicatorType: 'recording',
                        success: true
                    });
                } else {
                    // Evitar indicador de escritura largo antes del run de OpenAI para no simular escritura durante toda la latencia
                    // El indicador se envía justo antes de cada chunk en WhatsappService
                }
            } catch (indicatorError) {
                // No bloquear el procesamiento si falla el indicador
                logWarning('INDICATOR_FAILED', 'Error enviando indicador de presencia', {
                    userId,
                    userName,
                    chatId,
                    indicatorType: userState.lastInputVoice ? 'recording' : 'typing',
                    error: indicatorError instanceof Error ? indicatorError.message : String(indicatorError),
                    success: false
                });
            }

            // Log técnico: inicio de run OpenAI
            logInfo('OPENAI_RUN_START', 'Iniciando run de OpenAI', {
                userId,
                userName,
                threadId: existingThreadId || 'new',
                inputPreview: processedMessage.substring(0, 50)
            });

            // Procesar con OpenAI Service usando thread existente si está disponible
            const processingResult = await this.openaiService.processMessage(
                userId, 
                processedMessage, 
                chatId, 
                userName,
                existingThreadId,
                imageMessage
            );

            // Log técnico: fin de run OpenAI
            logSuccess('OPENAI_RUN_END', 'Run de OpenAI completado', {
                userId,
                userName,
                status: processingResult.success ? 'completed' : 'failed',
                threadId: processingResult.threadId || 'unknown'
            });

            if (!processingResult.success) {
                throw new Error(processingResult.error || 'OpenAI processing failed');
            }

            // Delay extra para agrupar voces consecutivas (como en monolítico)
            if (processingResult.success && userState.lastInputVoice) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // 1s para esperar más voces (optimizado)
                logInfo('VOICE_CONSECUTIVE_DELAY', 'Delay aplicado para agrupar voces consecutivas', {
                    userId,
                    userName,
                    chatId,
                    delayMs: 1000,
                    reason: 'voice_grouping_optimized'
                });
            }

            let response = processingResult.response || '';
            
            // Verificar si la respuesta es vacía - retornar vacío para evitar fallback automático
            if (!response || response.trim() === '') {
                response = ''; // Cadena vacía para evitar respuesta automática innecesaria
                logWarning('FALLBACK_RESPONSE', 'Respuesta vacía de OpenAI, retornando vacío', { 
                    userId, 
                    userName,
                    chatId,
                    threadId: processingResult.threadId,
                    reason: 'empty_response'
                });
            }

            // 6. Guardar/actualizar thread en la base de datos
            if (processingResult.threadId) {
                if (!existingThreadId || existingThreadId !== processingResult.threadId) {
                    // Thread nuevo - crear registro completo
                    await this.threadPersistence.setThread(userId, processingResult.threadId, chatId, userName);
                    // También programar tokens para thread nuevo (empezará desde 0)
                    this.delayedActivityService.updateTokenCount(userId, processingResult.tokensUsed || 0, processingResult.threadId);
                } else {
                    // Thread existente - programar actualización delayed con tokens (sumará con BD)
                    this.delayedActivityService.updateTokenCount(userId, processingResult.tokensUsed || 0, processingResult.threadId);
                }
            }

            // 7. Guardar mensaje del usuario y respuesta en la base de datos
            if (processingResult.threadId) {
                await this.databaseService.saveMessage(processingResult.threadId, 'user', contextualMessage);
                await this.databaseService.saveMessage(processingResult.threadId, 'assistant', response);
            }

            // 8. Clear pending images after successful processing to prevent accumulation
            const pendingImages = this.mediaManager.getPendingImages(userId);
            if (pendingImages.length > 0) {
                this.mediaManager.clearPendingImages(userId);
                logInfo('IMAGES_CLEARED', 'Imágenes pendientes limpiadas post-procesamiento', {
                    userId,
                    userName,
                    imageCount: pendingImages.length,
                    reason: 'successful_processing'
                });
            }

            // 9. Generate hotel-specific context if needed
            const profile = { name: userName };
            const chatInfo = { name: userName, labels: labels.map(label => ({ name: label })) };
            // Hotel context moved to plugin - handled by OpenAI functions
            const hotelContext = null;
            
            // Validation moved to plugin - OpenAI handles it via functions
            const finalResponse = response;
            
            // 11. Enviar respuesta por WhatsApp solo si hay contenido
            if (finalResponse && finalResponse.trim() !== '') {
                userState = this.userManager.getOrCreateState(userId);
                // Quote detection moved to plugin
                const isQuote = false;

                // Mantener modo voz si el último input fue voz, salvo que el contenido sea cotización/precios/links.
                const isQuoteOrPrice = this.hotelValidation.isQuoteOrPriceMessage(finalResponse);
                if (userState.lastInputVoice && !isQuote && !isQuoteOrPrice) {
                    logInfo('VOICE_RESPONSE_MODE', 'Enviando respuesta en voz por input de audio', {
                        userId,
                        userName,
                        chatId,
                        responseLength: finalResponse.length
                    }, 'bot.ts');
                }

                // ✅ Decidir si citar usando heurística
                const currentBuffer = this.bufferManager.getBuffer(userId);
                const quotedFromUser = currentBuffer?.quotedMessageId;
                const shouldQuote = this.shouldQuoteResponse(combinedText, pendingImages.length > 0);
                
                // Detectar si la IA hace referencia a "este/esa" (refuerzo adicional)
                const aiRefersToIt = /\b(este|esta|ese|esa|eso|aquel)\b/i.test(finalResponse);
                const quotedToSend = (shouldQuote || aiRefersToIt) ? quotedFromUser : undefined;
                
                // ✅ Log específico de decisión de citado
                logInfo('QUOTE_DECISION', 'Decisión de citado calculada', {
                    userId,
                    userName,
                    willQuote: !!quotedToSend,
                    quotedId: quotedToSend || null,
                    shouldQuote,
                    aiRefersToIt,
                    hasImage: pendingImages.length > 0,
                    userTextLength: combinedText.length,
                    aiResponsePreview: finalResponse.substring(0, 80)
                });
                
                const messageResult = await this.whatsappService.sendWhatsAppMessage(
                    chatId,
                    finalResponse,
                    userState,
                    isQuoteOrPrice,
                    quotedToSend
                );
                
                if (messageResult.success) {
                    // Registrar IDs reales devueltos por WHAPI para evitar eco/loops
                    if (messageResult.messageIds && messageResult.messageIds.length > 0) {
                        for (const id of messageResult.messageIds) {
                            this.mediaManager.addBotSentMessage(id);
                        }
                    } else {
                        // Fallback: marcar un id temporal (menos fiable)
                        this.mediaManager.addBotSentMessage(`msg_${Date.now()}`);
                    }
                    
                    // NUEVO: También registrar el contenido como fallback
                    this.mediaManager.addBotSentContent(chatId, finalResponse);
                    
                    // Reset voice flag ONLY if message was actually sent as voice
                    if (messageResult.sentAsVoice) {
                        userState.lastInputVoice = false;
                        this.userManager.updateState(userId, { lastInputVoice: false });
                        logInfo('VOICE_FLAG_RESET', 'Flag de voz reseteado después de envío exitoso en voz', {
                            userId,
                            userName,
                            reason: 'voice_sent_successfully'
                        }, 'bot.ts');
                        
                        // If sent as voice successfully, skip text chunks processing
                        // No llamar terminalLog.response() aquí - ya se loggea en voiceSent()
                        return;
                    }
                    
                    // Si el mensaje se envió exitosamente pero no como voz (texto normal)
                    this.terminalLog.response(userName, finalResponse, processingResult.processingTime);
                } else if (userState.lastInputVoice) {
                    // Si falló el envío de voz (messageResult.success = false), no enviar nada
                    logWarning('VOICE_SEND_FAILED', 'Envío de voz falló, no se envía texto para evitar duplicado', {
                        userId,
                        userName,
                        reason: 'voice_send_failed_no_fallback'
                    }, 'bot.ts');
                    // Reset voice flag after failed attempt
                    userState.lastInputVoice = false;
                    this.userManager.updateState(userId, { lastInputVoice: false });
                    this.terminalLog.response(userName, finalResponse, processingResult.processingTime);
                    return;  // No enviar nada cuando falla voz, evita duplicados
                }
            } else {
                // No enviar respuesta vacía, solo loggear
                logInfo('EMPTY_RESPONSE_SKIP', 'Saltando envío de respuesta vacía', {
                    userId,
                    userName,
                    chatId,
                    processingTime: processingResult.processingTime
                });
            }
            
            // Limpiar marker de error después de procesamiento exitoso (como en el monolítico)
            delete this.lastError[userId];
            
            // Reset typing flag after successful processing to avoid false delays
            userState = this.userManager.getState(userId);
            if (userState && userState.lastTyping > 0) {
                userState.lastTyping = 0;
                this.userManager.updateState(userId, { lastTyping: 0 });
                logInfo('TYPING_FLAG_RESET', 'Flag de typing reseteado post-procesamiento exitoso', {
                    userId,
                    userName,
                    reason: 'successful_processing_complete'
                });
            }
            
            // Log técnico de sesión - procesamiento exitoso (solo si hay respuesta)
            if (finalResponse && finalResponse.trim() !== '') {
                // Preparar preview del contenido enviado (truncado)
                const contentPreview = finalResponse.length > 100 ? 
                    finalResponse.substring(0, 100).replace(/\n/g, ' ').trim() + '...' : 
                    finalResponse.replace(/\n/g, ' ').trim();
                
                logSuccess('MESSAGE_SENT', 'Mensaje procesado y enviado exitosamente', {
                    userId,
                    userName,
                    chatId,
                    threadId: processingResult.threadId,
                    processingTime: processingResult.processingTime,
                    responseLength: finalResponse.length,
                    hadValidationErrors: false,
                    contentPreview: contentPreview
                }, 'bot.ts');
            }
            
            // Validation moved to plugin
            if (false) {
                this.terminalLog.warning(`Validation moved to plugin`);
            }

        } catch (error: any) {
            // Mark recent error to prevent secondary buffer processing
            this.lastError[userId] = { time: Date.now() };
            
            // Also mark error in buffer manager for timer extension
            this.bufferManager.markRecentError(userId);
            
            // Verificar orphan processing states después de error
            if (this.userManager.getStats().activeProcessing > this.userManager.getStats().totalUsers) {
                logWarning('ORPHAN_PROCESSING_DETECTED', 'Estados de procesamiento huérfanos detectados post-error', {
                    activeProcessing: this.userManager.getStats().activeProcessing,
                    totalUsers: this.userManager.getStats().totalUsers,
                    orphans: this.userManager.getStats().activeProcessing - this.userManager.getStats().totalUsers,
                    userId,
                    reason: 'error_cleanup_check'
                });
            }
            
            this.terminalLog.error(`Error en el callback del buffer para ${userName}: ${error.message}`);
            
            // Limpiar buffer si es error de 'Run Active' para evitar acumulación
            if (error.message && error.message.includes('while a run is active')) {
                const buffer = this.bufferManager.getBuffer(userId);
                if (buffer) {
                    buffer.messages = []; // Limpiar buffer para reintentar limpio después
                    logInfo('BUFFER_CLEARED', 'Buffer limpiado por error de run activo', {
                        userId,
                        userName,
                        reason: 'run_active_error'
                    });
                }
            }
            
            // Log técnico de sesión - error en procesamiento
            logError('MESSAGE_PROCESS_ERROR', 'Error procesando buffer de mensajes', {
                userId,
                userName,
                chatId,
                error: error.message,
                errorType: error.name || 'UnknownError',
                stack: error.stack?.substring(0, 500),
                combinedTextLength: combinedText?.length || 0
            }, 'bot.ts');
            
            // Fallback silencioso - no enviar mensaje para evitar respuestas automáticas
            // const fallbackResponse = ''; // Comentado para evitar envío innecesario
            // const userState = this.userManager.getOrCreateState(userId);
            // await this.whatsappService.sendWhatsAppMessage(chatId, fallbackResponse, userState, false);
        }
    }

    /**
     * ✅ Heurística para decidir cuándo citar al responder
     */
    private shouldQuoteResponse(userText: string, hasMedia: boolean): boolean {
        if (!userText) return false;
        
        const trimmed = userText.trim();
        const isShort = trimmed.length < 60;
        const hasDeictics = /\b(este|esta|ese|esa|eso|aquel)\b/i.test(trimmed);
        
        return hasMedia || isShort || hasDeictics;
    }

    private buildContextualMessage(
        userName: string, 
        displayName: string | null, 
        labels: string[], 
        message: string
    ): string {
        // Formato de fecha colombiana simplificado
        const now = new Date();
        const colombianTime = new Intl.DateTimeFormat('es-CO', {
            timeZone: 'America/Bogota',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }).format(now);

        // Detectar si no hay registro en BD
        const hasDBRecord = displayName && displayName !== userName && displayName !== 'Usuario';
        const hasLabels = labels.length > 0;
        
        // Si no hay datos de BD, usar formato especial
        if (!hasDBRecord && !hasLabels) {
            const contextualMessage = `Cliente: NOHAYREGISTRO
Tags: NOHAYREGISTRO
Hora actual: ${colombianTime}

${/cliente responde a este mensaje/i.test(message) ? message : `Mensaje del cliente:
${message}`}`;
            return contextualMessage;
        }

        // Construir nombre del cliente (formato compacto)
        const clientName = hasDBRecord 
            ? `${displayName} / ${userName}`  // Tiene nombre real guardado
            : userName;                       // Solo username

        // Construir etiquetas (formato compacto)
        const tagsText = labels.length > 0 
            ? labels.join(', ') 
            : 'Sin tags';

        // Formatear el mensaje contextual (formato compacto)
        const alreadyQuoted = /cliente responde a este mensaje/i.test(message);
        const contextualMessage = `Cliente: ${clientName}
Tags: ${tagsText}
Hora actual: ${colombianTime}

${alreadyQuoted ? message : `Mensaje del cliente:
${message}`}`;

        return contextualMessage;
    }

    public async start() {
        try {
            await this.databaseService.connect();
            this.setupCleanupTasks();
            
            this.server.listen(this.config.port, this.config.host, () => {
                // Inicializar logs técnicos de sesión
                logServerStart('Servidor HTTP iniciado', {
                    host: this.config.host,
                    port: this.config.port,
                    environment: process.env.NODE_ENV || 'development'
                });
                
                this.terminalLog.startup();
                console.log(`🚀 CoreBot started successfully on ${this.config.host}:${this.config.port}`);
                console.log(`📊 Functions registered: ${this.functionRegistry.list().length}`);
                
                // Log de bot completamente listo
                logBotReady('Bot completamente inicializado', {
                    functionsCount: this.functionRegistry.list().length,
                    functions: this.functionRegistry.list()
                });
            });
        } catch (error: any) {
            console.error('❌ Failed to start CoreBot:', error.message);
            throw error;
        }
    }

    public async stop() {
        console.log('🛑 Stopping CoreBot...');
        
        // Log del inicio del proceso de parada
        logInfo('BOT_STOPPING', 'Iniciando proceso de parada del bot', {
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage()
        });
        
        // Clear cleanup intervals
        this.cleanupIntervals.forEach(interval => clearInterval(interval));
        this.cleanupIntervals = [];
        
        // Flush delayed updates before shutdown
        try {
            await this.delayedActivityService.flushAllUpdates();
            this.delayedActivityService.shutdown();
        } catch (error) {
            console.warn('Warning: DelayedActivityService shutdown failed:', error);
        }
        
        // Close server
        if (this.server) {
            await new Promise<void>((resolve) => {
                this.server.close(() => resolve());
            });
        }
        
        // Disconnect database
        try {
            await this.databaseService.disconnect();
        } catch (error) {
            console.warn('Warning: Database disconnect failed:', error);
        }
        
        // Log del final de la sesión
        logInfo('SESSION_END', 'Sesión de bot finalizada', {
            timestamp: new Date().toISOString(),
            sessionDuration: Math.round(process.uptime()),
            finalMemory: process.memoryUsage(),
            gracefulShutdown: true
        });
        
        console.log('✅ CoreBot stopped successfully');
    }

    private setupCleanupTasks() {
        // Buffer cleanup every 5 minutes
        const bufferCleanup = setInterval(() => {
            const cleaned = this.bufferManager.cleanup();
            if (cleaned > 0) {
                console.log(`🧹 Cleaned up ${cleaned} old buffers`);
            }
        }, 5 * 60 * 1000);
        
        // User state cleanup every 10 minutes (más frecuente para 100+ usuarios)
        const userCleanup = setInterval(() => {
            const cleaned = this.userManager.cleanup(10 * 60 * 1000); // 10 minutos para 100+ usuarios
            if (cleaned > 0) {
                console.log(`🧹 Cleaned up ${cleaned} old user states (optimized for 100+ users)`);
                // Reset flags de voz persistentes en estados limpiados
                logInfo('MEMORY_OPTIMIZATION', 'Estados de usuario limpiados para optimizar memoria', {
                    cleanedStates: cleaned,
                    cleanupInterval: '10min',
                    reason: 'memory_optimization_100plus_users',
                    totalActiveUsers: this.userManager.getStats().totalUsers
                });
                
                // Integrar con métricas de performance
                const { performanceMonitor } = require('../utils/performance-metrics');
                performanceMonitor.recordCleanup(cleaned, 'users');
            }
        }, 10 * 60 * 1000);

        // Client data cache cleanup every 15 minutes
        const cacheCleanup = setInterval(() => {
            try {
                const cleanedCache = this.clientDataCache.cleanup();
                if (cleanedCache > 0) {
                    console.log(`🧹 Cleaned up ${cleanedCache} stale client cache entries`);
                }
            } catch (error) {
                console.warn(`⚠️ Error in cache cleanup: ${error instanceof Error ? error.message : error}`);
            }
        }, 15 * 60 * 1000);
        
        this.cleanupIntervals.push(bufferCleanup, userCleanup, cacheCleanup);
        console.log('🔧 Cleanup tasks configured');
    }

    public getStats() {
        return {
            server: {
                host: this.config.host,
                port: this.config.port,
                running: !!this.server?.listening
            },
            functions: this.functionRegistry.getStats(),
            buffers: this.bufferManager.getStats?.() || { active: 0 },
            users: this.userManager.getStats?.() || { active: 0 },
            clientCache: (() => {
                try {
                    return this.clientDataCache.getStats();
                } catch (error) {
                    return { error: 'Failed to get cache stats', active: 0 };
                }
            })(),
            delayedUpdates: this.delayedActivityService.getStats()
        };
    }
}