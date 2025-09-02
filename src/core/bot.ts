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
import { WebhookRouter } from './processors/WebhookRouter';
import { TerminalLog } from './utils/terminal-log';
// import { HotelPlugin } from '../plugins/hotel/hotel.plugin'; // Moved to main.ts
import { IFunctionRegistry } from '../shared/interfaces';
import { logBotReady, logServerStart, logInfo, logSuccess, logError, logWarning } from '../utils/logging';
import { trackCache, setCacheSize } from '../utils/logging/collectors';
import { HotelValidation } from '../plugins/hotel/logic/validation';
import { ResponseValidator } from './validators/response-validator';

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
    private webhookRouter: WebhookRouter;
    // private hotelPlugin: HotelPlugin; // Moved to main.ts
    private functionRegistry: IFunctionRegistry;
    private cleanupIntervals: NodeJS.Timeout[] = [];
    private lastError: Record<string, { time: number; error?: string }> = {};
    private hotelValidation: HotelValidation;
    private responseValidator: ResponseValidator;

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
        console.info('Cache unificado inyectado en DB service - MemoryStore eliminado');

        this.mediaService = new MediaService(this.terminalLog, {
            openaiApiKey: this.config.secrets.OPENAI_API_KEY,
            whapiApiUrl: this.config.secrets.WHAPI_API_URL,
            whapiToken: this.config.secrets.WHAPI_TOKEN
        });
        this.whatsappService = new WhatsappService(this.openai, this.terminalLog, this.config, this.databaseService, this.mediaManager);
        
        // Function registry passed from main.ts (with plugins already registered)
        this.functionRegistry = functionRegistry || container.resolve(FunctionRegistryService);

        // Initialize OpenAI Service with function registry and databaseService
        this.openaiService = new OpenAIService({
            apiKey: this.config.secrets.OPENAI_API_KEY,
            assistantId: process.env.ASSISTANT_ID || process.env.OPENAI_ASSISTANT_ID || 'asst_default'
        }, this.terminalLog, undefined, this.functionRegistry, this.whatsappService, this.databaseService, this.userManager);

        // Initialize Thread Persistence Service
        this.threadPersistence = new ThreadPersistenceService(this.databaseService);

        this.bufferManager = new BufferManager(
            this.processBufferCallback.bind(this),
            (userId: string) => this.userManager.getState(userId)
        );
        this.webhookRouter = new WebhookRouter(this.bufferManager, this.userManager, this.mediaManager, this.mediaService, this.databaseService, this.delayedActivityService, this.openaiService, this.terminalLog, this.clientDataCache);
        this.hotelValidation = new HotelValidation();
        
        // Inicializar response validator
        this.responseValidator = container.resolve(ResponseValidator);

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
                
                // Process webhook asynchronously through router
                await this.webhookRouter.route(req.body);
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
                }, 'bot.ts');

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
                }, 'bot.ts');
                res.status(500).json({ error: 'Internal server error' });
            }
        });

    }

    private async processBufferCallback(userId: string, combinedText: string, chatId: string, userName: string, imageMessage?: { type: 'image', imageUrl: string, caption: string }, duringRunMsgId?: string): Promise<void> {
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
            }, 'bot.ts');
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
                
                trackCache(false); // Miss
                logInfo('CACHE_MISS', 'Consultando BD por caché vacío o datos desactualizados', {
                    userId,
                    userName,
                    hadCache: !!clientData,
                    reason: !clientData ? 'no_cache' : 'data_mismatch'
                }, 'bot.ts');

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
                            userName: user?.userName || null, // Mantener BD limpia en cache
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
                    }, 'bot.ts');
                }
            } else {
                trackCache(true); // Hit
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
                }, 'bot.ts');
            }
            
            // 3. CONTEXTUALIZACIÓN INTELIGENTE: Decidir si incluir contexto del cliente
            const needsClientContext = this.clientDataCache.needsContextUpdate(
                userId, 
                clientData?.name || null,      // chat_name (nombre del contacto)
                clientData?.userName || null,  // from_name (nombre del perfil)  
                labels
            );
            
            // Detectar si es chat de operaciones para contexto simplificado
            const opsChatId = process.env.OPERATIONS_CHAT_ID;
            const isOpsChat = chatId === opsChatId;
            
            const contextualMessage = isOpsChat 
                ? this.buildOperationsContextualMessage(combinedText)
                : this.buildContextualMessage(
                    userName,
                    clientData?.name || null,
                    labels,
                    combinedText,
                    needsClientContext  // Solo incluir cliente+tags si es necesario
                );

            // Marcar contexto como enviado si se incluyó
            if (needsClientContext) {
                this.clientDataCache.markContextSent(
                    userId, 
                    clientData?.name || null,      // chat_name (nombre del contacto)
                    clientData?.userName || null,  // from_name (nombre del perfil)
                    labels
                );
                logInfo('CONTEXT_SENT', 'Contexto completo enviado a OpenAI', {
                    userId,
                    userName,
                    contactName: clientData?.name || null,     // chat_name (contacto guardado)
                    profileName: clientData?.userName || null, // from_name (perfil WhatsApp)
                    labelsCount: labels.length,
                    labels: labels.slice(0, 3), // Primeros 3 labels para debug
                    reason: !this.clientDataCache.has(userId) ? 'new_user' : 
                            !this.clientDataCache.get(userId)?.contextSent ? 'first_message_post_restart' : 
                            'context_changed'
                });
            } else {
                logInfo('CONTEXT_SIMPLIFIED', 'Contexto simplificado enviado a OpenAI', {
                    userId,
                    userName,
                    reason: 'context_already_sent'
                });
            }
            
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

            // 4. Obtener thread existente (lógica simplificada)
            const existingThread = await this.threadPersistence.getThread(userId);
            let existingThreadId = existingThread?.threadId;
            
            if (existingThreadId) {
                logInfo('THR_EXISTING', `Thread existente encontrado: ${existingThreadId} para ${userId}`, {
                    userId,
                    userName,
                    threadId: existingThreadId,
                    tokenCount: existingThread.tokenCount || 0
                }, 'bot.ts');
            } else {
                logInfo('THR_NONE', `No se encontró thread existente para ${userId}`, {
                    userId,
                    userName
                }, 'bot.ts');
            }

            // Lógica simplificada: Solo verificar existencia en BD
            // La validación con OpenAI se hace en OpenAIService.processMessage

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
                }, 'bot.ts');
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
                        }, 'bot.ts');
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
                    }, 'bot.ts');
                    // Reencolar el mensaje para procesarlo después y no perderlo
                    try {
                        this.bufferManager.addMessage(userId, combinedText, chatId, userName, undefined, undefined);
                        this.bufferManager.setIntelligentTimer(userId, 'message');
                        logInfo('BUFFER_REQUEUED', 'Mensaje reencolado por run activo', {
                            userId,
                            userName,
                            length: combinedText.length
                        }, 'bot.ts');
                    } catch (requeueError) {
                        logWarning('BUFFER_REQUEUE_FAILED', 'Fallo reencolando mensaje tras timeout de run', {
                            userId,
                            error: requeueError instanceof Error ? requeueError.message : String(requeueError)
                        });
                    }
                    return;
                }
            }

            // REMOVIDO: No enviar presencia antes del procesamiento
            // La presencia se enviará justo antes de enviar el mensaje real
            let userState = this.userManager.getOrCreateState(userId);
            logInfo('PRESENCE_DELAYED', 'Presencia diferida hasta tener respuesta lista', {
                userId,
                userName,
                chatId,
                inputType: userState.lastInputVoice ? 'voice' : 'text',
                reason: 'avoid_stuck_presence'
            }, 'bot.ts');

            // Log técnico: inicio de run OpenAI
            logInfo('OPENAI_RUN_START', 'Iniciando run de OpenAI', {
                userId,
                userName,
                threadId: existingThreadId || 'new',
                inputPreview: processedMessage.substring(0, 50)
            });

            // 🎯 DETECTAR QUÉ ASSISTANT USAR SEGÚN EL CHAT
            const operationsChatId = process.env.OPERATIONS_CHAT_ID || '120363419376827694@g.us';
            const isOperationsChat = chatId === operationsChatId;
            const targetAssistantId = isOperationsChat ? 
                (process.env.OPERATIONS_ASSISTANT_ID || 'asst_5ojkMp15tPorXMaT4qnHiELG') : 
                (process.env.OPENAI_ASSISTANT_ID || process.env.ASSISTANT_ID || 'asst_SRqZsLGTOwLCXxOADo7beQuM');

            logInfo('ASSISTANT_SELECTION', 'Assistant seleccionado para procesamiento', {
                userId,
                chatId,
                isOperationsChat,
                selectedAssistant: isOperationsChat ? 'OPERATIONS' : 'MAIN',
                assistantId: targetAssistantId
            }, 'bot.ts');

            // Procesar con OpenAI Service usando thread existente si está disponible
            const processingResult = await this.openaiService.processMessage(
                userId, 
                processedMessage, 
                chatId, 
                userName,
                existingThreadId,
                existingThread?.tokenCount, // Pasar tokens acumulados de BD/cache
                imageMessage,
                undefined, // duringRunMsgId
                targetAssistantId // 🎯 PASAR EL ASSISTANT ID ESPECÍFICO
            );

            // Log técnico: fin de run OpenAI
            logSuccess('OPENAI_RUN_END', 'Run de OpenAI completado', {
                userId,
                userName,
                status: processingResult.success ? 'completed' : 'failed',
                threadId: processingResult.threadId || 'unknown'
            }, 'bot.ts');

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
                }, 'bot.ts');
            }

            let response = processingResult.response || '';
            let attachment = null;
            
            // DEBUG: Log para verificar structure de processingResult
            logInfo('DEBUG_FUNCTION_CALLS', `FunctionCalls: ${!!processingResult.functionCalls}`, {
                userId,
                hasFunctionCalls: !!processingResult.functionCalls,
                functionCallsLength: processingResult.functionCalls?.length || 0
            }, 'bot.ts');
            
            if (processingResult.functionCalls && processingResult.functionCalls.length > 0) {
                logInfo('DEBUG_FUNCTION_DETAILS', 'Detalles de functionCalls', {
                    userId,
                    functionCall0: {
                        hasFunction: !!processingResult.functionCalls[0].function,
                        functionName: processingResult.functionCalls[0].function?.name || 'NO_NAME',
                        hasResult: !!processingResult.functionCalls[0].result,
                        resultType: typeof processingResult.functionCalls[0].result,
                        resultKeys: processingResult.functionCalls[0].result ? Object.keys(processingResult.functionCalls[0].result) : []
                    }
                }, 'bot.ts');
            }
            
            // NUEVO: Verificar si hay attachment info en processingResult
            if (processingResult.functionCalls) {
                logInfo('ATTACHMENT_SEARCH_START', 'Buscando attachments en functionCalls', {
                    userId,
                    userName,
                    functionCallsLength: processingResult.functionCalls.length,
                    firstFunctionName: processingResult.functionCalls[0]?.function?.name || 'NO_FUNCTION'
                }, 'bot.ts');
                
                for (const funcCall of processingResult.functionCalls) {
                    logInfo('ATTACHMENT_FUNCALL_DEBUG', 'Analizando funcCall individual', {
                        userId,
                        userName,
                        functionName: funcCall.function?.name || 'NO_NAME',
                        hasResult: !!(funcCall as any).result,
                        resultType: typeof (funcCall as any).result,
                        resultKeys: (funcCall as any).result ? Object.keys((funcCall as any).result) : []
                    }, 'bot.ts');
                    
                    // LOG DETALLADO PARA DEBUG DE ESTRUCTURA
                    if ((funcCall as any).result) {
                        logInfo('FUNCTION_RESULT_STRUCTURE_DETAILED', 'Estructura completa del resultado', {
                            userId,
                            functionName: funcCall.function?.name || 'NO_NAME',
                            resultType: typeof (funcCall as any).result,
                            isObject: typeof (funcCall as any).result === 'object',
                            resultKeys: (funcCall as any).result && typeof (funcCall as any).result === 'object' ? Object.keys((funcCall as any).result) : [],
                            hasAttachmentKey: !!((funcCall as any).result?.attachment),
                            resultJson: typeof (funcCall as any).result === 'string' ? (funcCall as any).result.substring(0, 500) : JSON.stringify((funcCall as any).result).substring(0, 500)
                        }, 'bot.ts');
                    }
                    
                    // MEJORADO: Manejar tanto objetos como strings JSON
                    let parsedResult = (funcCall as any).result;
                    if (typeof parsedResult === 'string') {
                        try {
                            parsedResult = JSON.parse(parsedResult);
                        } catch (parseError) {
                            logInfo('RESULT_PARSE_ERROR', 'No se pudo parsear resultado como JSON', {
                                userId,
                                functionName: funcCall.function?.name || 'NO_NAME',
                                resultLength: parsedResult.length,
                                resultPreview: parsedResult.substring(0, 100)
                            }, 'bot.ts');
                            parsedResult = (funcCall as any).result; // Mantener original
                        }
                    }
                    
                    if (parsedResult && typeof parsedResult === 'object' && parsedResult.attachment) {
                        attachment = parsedResult.attachment;
                        logInfo('ATTACHMENT_DETECTED_IN_FUNCTION', 'Attachment detectado desde función', {
                            userId,
                            userName,
                            chatId,
                            attachmentType: attachment.type,
                            fileName: attachment.fileName,
                            functionName: funcCall.function?.name || 'unknown'
                        }, 'bot.ts');
                        
                        // VALIDACIÓN ESPECÍFICA PARA PDFs
                        if (attachment?.type === 'pdf') {
                            logInfo('PDF_ATTACHMENT_DETECTED_IN_BOT', 'PDF attachment detectado para envío', {
                                userId,
                                userName,
                                filePath: attachment.filePath,
                                fileName: attachment.fileName,
                                functionName: funcCall.function?.name || 'unknown'
                            }, 'bot.ts');
                        }
                        
                        break; // Solo tomar el primer attachment
                    }
                }
            }
            
            // Verificar si la respuesta es vacía - retornar vacío para evitar fallback automático
            if (!response || response.trim() === '') {
                response = ''; // Cadena vacía para evitar respuesta automática innecesaria
                logWarning('FALLBACK_RESPONSE', 'Respuesta vacía de OpenAI, retornando vacío', { 
                    userId, 
                    userName,
                    chatId,
                    threadId: processingResult.threadId,
                    reason: 'empty_response'
                }, 'bot.ts');
            }

            // 6. Guardar/actualizar thread en la base de datos
            if (processingResult.threadId) {
                const tokensUsed = processingResult.tokensUsed || 0;
                const immediateThreshold = parseInt(process.env.TOKEN_IMMEDIATE_THRESHOLD || '1000', 10);
                
                if (!existingThreadId || existingThreadId !== processingResult.threadId) {
                    // Thread nuevo - crear registro completo
                    logInfo('THR_NEW', `Creando nuevo thread ${processingResult.threadId} para ${userId}`, {
                        userId,
                        userName,
                        oldThreadId: existingThreadId || 'none',
                        newThreadId: processingResult.threadId,
                        reason: !existingThreadId ? 'no_existing_thread' : 'thread_id_changed'
                    }, 'bot.ts');
                    await this.threadPersistence.setThread(userId, processingResult.threadId, chatId, userName);
                    
                    // Reset tokens a 0 para thread nuevo (evitar herencia de tokens no relacionados)
                    try {
                        await this.databaseService.updateThreadTokenCount(userId, 0);
                        logInfo('TOKEN_RESET_NEW_THREAD', 'Reset tokens a 0: Nuevo thread sin relación previa', { 
                            userId, 
                            userName,
                            newThreadId: processingResult.threadId 
                        }, 'bot.ts');
                    } catch (resetError) {
                        logError('TOKEN_RESET_NEW_ERROR', 'Error reseteando tokens para thread nuevo', {
                            userId,
                            userName,
                            newThreadId: processingResult.threadId,
                            resetError: resetError instanceof Error ? resetError.message : String(resetError)
                        });
                    }
                    
                    // Actualización inmediata para runs grandes en threads nuevos
                    if (tokensUsed > immediateThreshold) {
                        try {
                            // CRÍTICO: Thread nuevo siempre empieza en 0, no usar existingThread (es del thread anterior)
                            const totalTokens = tokensUsed; // Thread nuevo: 0 + tokensUsed
                            await this.databaseService.updateThreadTokenCount(userId, totalTokens);
                            logInfo('TOKEN_IMMEDIATE_UPDATE', 'Tokens actualizados inmediatamente por run grande en thread nuevo', {
                                userId,
                                userName,
                                tokensUsed,
                                existingTokens: 0, // Thread nuevo siempre 0
                                totalTokens,
                                threshold: immediateThreshold,
                                threadId: processingResult.threadId,
                                reason: 'large_run_new_thread'
                            }, 'bot.ts');
                        } catch (error) {
                            logError('TOKEN_IMMEDIATE_ERROR', 'Error en actualización inmediata, fallback a delayed', { 
                                userId, 
                                userName,
                                tokensUsed, 
                                threshold: immediateThreshold,
                                error: error instanceof Error ? error.message : String(error),
                                fallback: 'delayed_update'
                            });
                            // Fallback a delayed
                            this.delayedActivityService.updateTokenCount(userId, tokensUsed, processingResult.threadId);
                        }
                    } else {
                        // Programar tokens para thread nuevo (sumará al reset de 0)
                        this.delayedActivityService.updateTokenCount(userId, tokensUsed, processingResult.threadId);
                    }
                } else {
                    // Thread existente - verificar si necesita actualización inmediata
                    if (tokensUsed > immediateThreshold) {
                        try {
                            // Intentar obtener tokens del cache primero, luego BD
                            const cachedData = this.clientDataCache.get(userId);
                            let existingTokens = cachedData?.threadTokenCount || 0;
                            
                            // Si no hay en cache, consultar BD
                            if (!cachedData || cachedData.threadTokenCount === undefined) {
                                const existing = await this.databaseService.getThread(userId);
                                existingTokens = existing?.tokenCount || 0;
                            }
                            
                            const accumulatedTokens = existingTokens + tokensUsed;
                            
                            await this.databaseService.updateThreadTokenCount(userId, accumulatedTokens);
                            
                            // Actualizar cache con nuevo conteo
                            if (cachedData) {
                                this.clientDataCache.updateThreadTokenCount(userId, accumulatedTokens);
                            }
                            
                            logInfo('TOKEN_IMMEDIATE_UPDATE', 'Tokens actualizados inmediatamente por run grande', {
                                userId,
                                userName,
                                tokensUsed,
                                existingTokens,
                                accumulatedTokens,
                                threshold: immediateThreshold,
                                threadId: processingResult.threadId,
                                usedCache: !!cachedData,
                                reason: 'large_run_existing_thread'
                            }, 'bot.ts');
                        } catch (error) {
                            logError('TOKEN_IMMEDIATE_ERROR', 'Error en actualización inmediata, fallback a delayed', { 
                                userId, 
                                userName,
                                tokensUsed, 
                                threshold: immediateThreshold,
                                error: error instanceof Error ? error.message : String(error),
                                fallback: 'delayed_update'
                            });
                            // Fallback a delayed
                            this.delayedActivityService.updateTokenCount(userId, tokensUsed, processingResult.threadId);
                        }
                    } else {
                        // Thread existente - programar actualización delayed con tokens (sumará con BD)
                        this.delayedActivityService.updateTokenCount(userId, tokensUsed, processingResult.threadId);
                    }
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
                    reason: 'successful_processing',
                    processingTimeMs: processingResult.processingTime
                }, 'bot.ts');
            }

            // 9. Generate hotel-specific context if needed
            const profile = { name: userName };
            const chatInfo = { name: userName, labels: labels.map(label => ({ name: label })) };
            // Hotel context moved to plugin - handled by OpenAI functions
            const hotelContext = null;
            
            // Validation moved to plugin - OpenAI handles it via functions
            let finalResponse = response;
            
            // 10. VALIDACIÓN DE RESPUESTA: Detectar posibles alucinaciones
            if (finalResponse && finalResponse.trim() !== '') {
                const validationResult = await this.responseValidator.validateResponse(finalResponse, {
                    userId,
                    userName,
                    chatId,
                    threadId: processingResult.threadId
                });
                
                if (!validationResult.isValid && validationResult.suggestedAction === 'retry') {
                    // Intentar corregir la respuesta con una observación interna
                    logWarning('RESPONSE_VALIDATION_FAILED', 'Respuesta inválida detectada, reintentando', {
                        userId,
                        userName,
                        reason: validationResult.reason,
                        originalResponsePreview: finalResponse.substring(0, 100)
                    }, 'bot.ts');
                    
                    // Crear mensaje de observación interna
                    const internalObservation = validationResult.internalObservation || 
                        'Por favor revisa tu respuesta anterior y corrige cualquier información incorrecta.';
                    
                    // Reintentar con observación interna
                    const retryResult = await this.openaiService.processMessage(
                        userId,
                        internalObservation,
                        chatId,
                        userName,
                        processingResult.threadId,
                        processingResult.finalTokenCount,
                        undefined,
                        undefined,
                        targetAssistantId
                    );
                    
                    if (retryResult.success && retryResult.response) {
                        // Validar la nueva respuesta
                        const retryValidation = await this.responseValidator.validateResponse(retryResult.response);
                        
                        if (retryValidation.isValid) {
                            finalResponse = retryResult.response;
                            logSuccess('RESPONSE_CORRECTED', 'Respuesta corregida exitosamente', {
                                userId,
                                userName,
                                newResponsePreview: finalResponse.substring(0, 100)
                            }, 'bot.ts');
                        } else {
                            // Si aún falla, usar respuesta genérica segura
                            finalResponse = 'Estoy procesando tu solicitud. Por favor dame un momento para verificar la información correcta.';
                            logError('RESPONSE_RETRY_FAILED', 'Reintento de corrección falló', {
                                userId,
                                userName,
                                fallbackUsed: true
                            }, 'bot.ts');
                        }
                    }
                }
            }
            
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

                // CITACIÓN SIMPLIFICADA: Solo durante run activo
                const quotedToSend = undefined; // NUNCA citar por lógica heurística
                
                // ✅ Log específico de decisión de citado
                logInfo('QUOTE_DECISION', 'Decisión de citado calculada', {
                    userId,
                    userName,
                    willQuote: !!quotedToSend,
                    quotedId: quotedToSend || null,
                    hasImage: pendingImages.length > 0,
                    userTextLength: combinedText.length,
                    aiResponsePreview: finalResponse.substring(0, 80),
                    citationMode: 'only_during_run'
                });

                // Liberar el gate de 'run activo' antes de enviar chunks de WhatsApp
                this.bufferManager.releaseRun(userId);
                
                // NUEVO: Preparar mensaje con attachment si existe
                const messageToSend = attachment ? {
                    message: finalResponse,
                    attachment: attachment
                } : finalResponse;
                
                // LOG FINAL: Confirmar que attachment se pasa al servicio de WhatsApp
                if (attachment) {
                    logInfo('ATTACHMENT_FINAL_SEND', 'Enviando mensaje con attachment a WhatsApp', {
                        userId,
                        userName,
                        chatId,
                        hasAttachment: !!attachment,
                        attachmentType: attachment?.type,
                        filePath: attachment?.filePath,
                        fileName: attachment?.fileName,
                        messageType: typeof messageToSend
                    }, 'bot.ts');
                }
                
                const messageResult = await this.whatsappService.sendWhatsAppMessage(
                    chatId,
                    messageToSend,
                    userState,
                    isQuoteOrPrice,
                    quotedToSend,
                    duringRunMsgId  // CITACIÓN AUTO: Pasar ID para citación durante run
                );
                
                if (messageResult.success) {
                    // Log de éxito del envío (para debugging)
                    if (attachment && attachment.type === 'pdf') {
                        logInfo('PDF_SENT_SUCCESS', 'PDF enviado exitosamente por WhatsApp', {
                            userId,
                            userName,
                            chatId,
                            fileName: attachment.fileName,
                            bookingId: attachment.description || 'unknown'
                        }, 'bot.ts');
                    }
                    
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
                } else {
                    // NUEVO: Manejar fallo en envío de mensaje/attachment
                    if (attachment && attachment.type === 'pdf') {
                        // PDF falló al enviarse
                        const errorMessage = `❌ Hubo un problema técnico generando el PDF de confirmación. Por favor consulte con su superior para resolver este inconveniente.`;
                        
                        logError('PDF_SEND_FAILED', 'Fallo enviando PDF al cliente', {
                            userId,
                            userName,
                            chatId,
                            fileName: attachment.fileName,
                            bookingId: attachment.description || 'unknown',
                            reason: 'whatsapp_send_failed'
                        }, 'bot.ts');
                        
                        // Enviar mensaje de error como texto simple sin attachment
                        const errorResult = await this.whatsappService.sendWhatsAppMessage(
                            chatId,
                            errorMessage,
                            userState,
                            false, // no es quote/price
                            undefined, // sin quoted
                            undefined  // sin duringRun
                        );
                        
                        if (errorResult.success) {
                            this.terminalLog.response(userName, errorMessage, processingResult.processingTime);
                        }
                        return;
                    }
                } 
                
                if (!messageResult.success && userState.lastInputVoice) {
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
                }, 'bot.ts');
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
                }, 'bot.ts');
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
            // CRÍTICO: Liberar el gate de run activo para prevenir loops infinitos
            this.bufferManager.releaseRun(userId);
            
            // Mark recent error to prevent secondary buffer processing
            this.lastError[userId] = { time: Date.now(), error: error.message };
            
            // Also mark error in buffer manager for timer extension
            this.bufferManager.markRecentError(userId);
            
            // Log error pattern for monitoring
            const errorPattern = error.message?.includes('run is active') ? 'RUN_ACTIVE' : 
                               error.message?.includes('rate_limit') ? 'RATE_LIMIT' :
                               error.message?.includes('timeout') ? 'TIMEOUT' : 'OTHER';
            logWarning('ERROR_PATTERN', `Error pattern detected: ${errorPattern}`, {
                userId,
                userName,
                pattern: errorPattern,
                errorMessage: error.message?.substring(0, 100)
            }, 'bot.ts');
            
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
                    }, 'bot.ts');
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
     * ❌ DESHABILITADO: Heurística de citación removida - solo durante run activo
     */
    // private shouldQuoteResponse(userText: string, hasMedia: boolean): boolean {
    //     // Función removida - solo citación durante run activo
    //     return false;
    // }

    private buildContextualMessage(
        userName: string, 
        displayName: string | null, 
        labels: string[], 
        message: string,
        includeClientContext: boolean = true // NUEVO: Flag para incluir contexto del cliente
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

        // CONTEXTUALIZACIÓN INTELIGENTE: Solo incluir datos del cliente cuando sea necesario
        const alreadyQuoted = /cliente responde a este mensaje/i.test(message);
        
        if (!includeClientContext) {
            // FORMATO SIMPLIFICADO: Solo hora actual + mensaje
            const contextualMessage = `Hora actual: ${colombianTime}

${alreadyQuoted ? message : `Mensaje del cliente:
${message}`}`;
            return contextualMessage;
        }

        // FORMATO COMPLETO: Incluir contexto del cliente (primer mensaje o cambios)
        const hasDBRecord = displayName && displayName !== userName && displayName !== 'Usuario';
        const hasLabels = labels.length > 0;
        
        // Si no hay datos de BD, usar formato especial
        if (!hasDBRecord && !hasLabels) {
            const contextualMessage = `Cliente: NOHAYREGISTRO
Tags: NOHAYREGISTRO
Hora actual: ${colombianTime}

${alreadyQuoted ? message : `Mensaje del cliente:
${message}`}`;
            return contextualMessage;
        }

        // Construir nombre del cliente (formato compacto)
        const safeUserName = userName || 'Usuario'; // Fallback para userName null
        const clientName = hasDBRecord 
            ? `${displayName} / ${safeUserName}`  // Tiene nombre real guardado
            : safeUserName;                       // Solo username con fallback

        // Construir etiquetas (formato compacto)
        const tagsText = labels.length > 0 
            ? labels.join(', ') 
            : 'Sin tags';

        // Formatear el mensaje contextual (formato compacto)
        const contextualMessage = `Cliente: ${clientName}
Tags: ${tagsText}
Hora actual: ${colombianTime}

${alreadyQuoted ? message : `Mensaje del cliente:
${message}`}`;

        return contextualMessage;
    }

    /**
     * Construye un mensaje contextual simplificado para operaciones (solo fecha y hora)
     */
    private buildOperationsContextualMessage(
        message: string, 
        alreadyQuoted: boolean = false
    ): string {
        // Hora colombiana actual
        const now = new Date();
        const colombianTime = now.toLocaleString('es-CO', {
            timeZone: 'America/Bogota',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        // Formato simplificado solo con fecha/hora
        const contextualMessage = `Hora actual: ${colombianTime}

${alreadyQuoted ? message : `Mensaje:
${message}`}`;
        
        return contextualMessage;
    }

    public async start() {
        try {
            await this.databaseService.connect();
            
            // CONTEXTUALIZACIÓN INTELIGENTE: Reset flags post-reinicio
            this.clientDataCache.clear(); // Limpiar cache para forzar contexto completo
            logInfo('CONTEXT_CACHE_RESET', 'Cache limpiado post-reinicio para contextualización fresca', {
                reason: 'bot_restart_context_reset'
            });
            
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

        // Métricas reales de buffer (ligeras) cada 60s
        const bufferMetricInterval = setInterval(() => {
            try {
                const stats = this.bufferManager.getStats();
                logInfo('BUFFER_METRIC', 'buffer metrics', { active: stats.active }, 'bot.ts');
            } catch {}
        }, 60 * 1000);
        
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