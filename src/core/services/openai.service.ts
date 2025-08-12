// src/core/services/openai.service.ts
import OpenAI from 'openai';
import { IOpenAIService, IFunctionRegistry } from '../../shared/interfaces';
import { OpenAIRun, FunctionCall } from '../../shared/types';
import { openAIWithRetry, withTimeout } from '../utils/retry-utils';
import { TerminalLog } from '../utils/terminal-log';
import { CacheManager } from '../state/cache-manager';
import { logInfo, logSuccess, logError, logWarning, logDebug } from '../../utils/logging';
// 🔧 NUEVO: Importar logging compacto
import { logOpenAIPromptSent, logTokenUsage, logMessageFlowComplete } from '../../utils/logging/integrations';
import { DatabaseService } from './database.service';

export interface OpenAIServiceConfig {
    apiKey: string;
    assistantId: string;
    maxRunTime?: number;
    pollingInterval?: number;
    maxPollingAttempts?: number;
    enableThreadCache?: boolean;
}

export interface ProcessingResult {
    success: boolean;
    response?: string;
    error?: string;
    functionCalls?: FunctionCall[];
    processingTime: number;
    tokensUsed?: number;
    threadId?: string;
    runId?: string;
    threadTokenCount?: number;
}

export class OpenAIService implements IOpenAIService {
    private openai: OpenAI;
    private config: Required<OpenAIServiceConfig>;
    private log: TerminalLog;
    private cache?: CacheManager;
    private functionRegistry?: IFunctionRegistry;
    private whatsappService?: any; // Referencia opcional para mensajes interinos
    private currentChatId?: string; // Chat ID actual para mensajes interinos
    private databaseService?: DatabaseService; // Servicio de BD para resets de tokens
    private static activeOpenAICalls: number = 0; // Contador global de llamadas concurrentes
    private static readonly MAX_CONCURRENT_CALLS = 50; // Límite para 100 usuarios

    constructor(
        config: OpenAIServiceConfig,
        terminalLog: TerminalLog,
        cacheManager?: CacheManager,
        functionRegistry?: IFunctionRegistry,
        whatsappService?: any,
        databaseService?: DatabaseService
    ) {
        this.config = {
            apiKey: config.apiKey,
            assistantId: config.assistantId,
            maxRunTime: config.maxRunTime ?? 120000, // 2 minutes
            pollingInterval: config.pollingInterval ?? 1500, // 1.5 seconds (reducido de 2s)
            maxPollingAttempts: config.maxPollingAttempts ?? 40, // 40 intentos (reducido de 60)
            enableThreadCache: config.enableThreadCache ?? true
        };

        this.openai = new OpenAI({ apiKey: this.config.apiKey });
        this.log = terminalLog;
        this.cache = cacheManager;
        this.functionRegistry = functionRegistry;
        this.whatsappService = whatsappService;
        this.databaseService = databaseService;
    }


    async processMessage(userId: string, message: string, chatId: string, userName: string, existingThreadId?: string, existingTokenCount?: number, imageMessage?: { type: 'image', imageUrl: string, caption: string }): Promise<ProcessingResult> {
        const startTime = Date.now();
        
        // Guardar chatId para posibles mensajes interinos
        this.currentChatId = chatId;

        // Control de concurrencia para escalabilidad
        while (OpenAIService.activeOpenAICalls >= OpenAIService.MAX_CONCURRENT_CALLS) {
            logWarning('CONCURRENCY_LIMIT', 'Límite de concurrencia OpenAI alcanzado', {
                userId,
                userName,
                activeCalls: OpenAIService.activeOpenAICalls,
                maxCalls: OpenAIService.MAX_CONCURRENT_CALLS,
                waitingUsers: OpenAIService.activeOpenAICalls - OpenAIService.MAX_CONCURRENT_CALLS + 1
            });
            
            logWarning('OPENAI_CONCURRENCY_WAIT', 'Esperando por límite de concurrencia OpenAI', {
                userId,
                userName,
                activeCalls: OpenAIService.activeOpenAICalls,
                maxCalls: OpenAIService.MAX_CONCURRENT_CALLS
            });
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        OpenAIService.activeOpenAICalls++;

        // Log de debugging para monitorear concurrencia
        logInfo('OPENAI_CONCURRENCY_STATUS', 'Estado de concurrencia OpenAI', {
            userId,
            userName,
            activeCalls: OpenAIService.activeOpenAICalls,
            maxCalls: OpenAIService.MAX_CONCURRENT_CALLS,
            utilizationPercent: Math.round((OpenAIService.activeOpenAICalls / OpenAIService.MAX_CONCURRENT_CALLS) * 100),
            queuePosition: OpenAIService.activeOpenAICalls <= OpenAIService.MAX_CONCURRENT_CALLS ? 'processing' : 'queued'
        });

        try {
            // Log crítico: Inicio de procesamiento OpenAI
            logInfo('OPENAI_PROCESSING_START', 'Iniciando procesamiento con OpenAI', {
                userId,
                userName,
                chatId,
                messageLength: message.length,
                hasImage: !!imageMessage,
                imageCaption: imageMessage?.caption || '',
                assistantId: this.config.assistantId,
                existingThreadId: existingThreadId || 'none',
                timestamp: new Date().toISOString(),
                concurrencyUtilization: Math.round((OpenAIService.activeOpenAICalls / OpenAIService.MAX_CONCURRENT_CALLS) * 100)
            });

            // Step 1: Get or create thread (validate existing thread first)
            let threadId: string;
            let threadTokenCount: number | undefined;
            let isNewThread = false;
            
            if (existingThreadId) {
                // Validar que el thread existe en OpenAI (lógica simplificada)
                const validation = await this.validateThread(existingThreadId, userId);
                if (validation.isValid) {
                    threadId = existingThreadId;
                    threadTokenCount = validation.tokenCount;
                    
                    // Verificar si thread está vacío (sin mensajes reales)
                    const hasRealMessages = await this.checkThreadHasMessages(threadId, userId);
                    
                    // checkThreadHasMessages ya maneja el reset interno, solo actualizar variable local
                    if (!hasRealMessages) {
                        threadTokenCount = 0; // Sincronizar con BD
                    }
                    
                    // Log crítico: Thread reutilizado (simplificado)
                    logInfo('THREAD_REUSE_SIMPLE', 'Thread reutilizado - lógica simplificada', {
                        userId,
                        userName, 
                        chatId,
                        threadId: existingThreadId,
                        tokenCount: threadTokenCount,
                        previousTokens: threadTokenCount || 0,
                        hasMessages: hasRealMessages
                    });
                } else {
                    // Thread inválido, crear uno nuevo (validateThread ya resetea tokens)
                    logWarning('THREAD_INVALID', 'Thread existente inválido, creando nuevo', {
                        userId,
                        userName,
                        oldThreadId: existingThreadId,
                        reason: 'thread_validation_failed'
                    });
                    threadId = await this.getOrCreateThread(userId, chatId);
                    threadTokenCount = 0; // Thread nuevo empieza en 0
                    isNewThread = true;
                }
            } else {
                threadId = await this.getOrCreateThread(userId, chatId);
                threadTokenCount = 0; // Thread nuevo empieza en 0
                isNewThread = true;
            }
            
            // CRÍTICO: Si el threadId cambió respecto al existingThreadId, resetear tokens
            if (existingThreadId && threadId !== existingThreadId) {
                logWarning('THREAD_CHANGED', 'ThreadId cambió - reseteando tokens acumulados', {
                    userId,
                    userName,
                    oldThreadId: existingThreadId,
                    newThreadId: threadId,
                    oldTokenCount: existingTokenCount || 0,
                    resetToZero: true
                });
                threadTokenCount = 0; // Reset completo
                isNewThread = true;
            }

            // Step 2: Add message to thread (with optional image)
            await this.addMessageToThread(threadId, message, imageMessage);
            
            // 📤 NUEVO: Log completo del prompt enviado a OpenAI (compactado en una línea)
            const flattenedMessage = message
                .replace(/\n/g, '\\n')  // Compacta saltos de línea como \n
                .replace(/\t/g, '\\t')  // Compacta tabs
                .replace(/\s+/g, ' ')   // Compacta múltiples espacios a uno solo
                .trim();  // Elimina espacios extras
            
            logInfo('OPENAI_PROMPT_FULL', 'Prompt completo compactado enviado a OpenAI', {
                userId,
                userName,
                threadId,
                fullCompactContent: flattenedMessage,  // Completo, sin truncar
                originalLength: message.length,
                compactLength: flattenedMessage.length,
                hasTranscription: message.includes('(Nota de Voz Transcrita por Whisper)'),  // Flag transcripción
                hasBeds24Data: message.includes('Datos de Beds24:') || message.includes('Disponibilidad:'),  // Flag Beds24
                hasImage: !!imageMessage,
                timestamp: new Date().toISOString()
            });
            
            // Log visible en Railway con primeras 15 palabras del contenido exacto
            const first15Words = flattenedMessage.split(' ').slice(0, 15).join(' ');
            console.info(`[OPENAI_RAW_CONTENT] ${userId}: "${first15Words}..." (${flattenedMessage.length}ch total)`);
            
            // Mantener el log anterior para compatibilidad  
            logInfo('OPENAI_MESSAGE_SENT', 'Mensaje enviado al thread de OpenAI', {
                userId,
                userName,
                threadId,
                messagePreview: message.substring(0, 500),
                messageLength: message.length,
                messageType: message.includes('(Nota de Voz Transcrita por Whisper)') ? 'transcription' : 'text',
                hasQuotedContent: message.includes('Cliente responde a este mensaje:')
            });

            // Step 3: Check if thread has image history and create run
            const hasImageHistory = await this.checkThreadForImages(threadId);
            const needsImageModel = !!imageMessage || hasImageHistory;
            const runResult = await this.createAndMonitorRun(threadId, userName, needsImageModel, !!imageMessage, hasImageHistory);

            if (!runResult.success) {
                return {
                    success: false,
                    error: runResult.error,
                    processingTime: Date.now() - startTime,
                    threadId
                };
            }

            // Step 4: Handle function calls if present
            if (runResult.functionCalls && runResult.functionCalls.length > 0) {
                const functionResult = await this.handleFunctionCalls(
                    threadId, 
                    runResult.runId!, 
                    runResult.functionCalls,
                    userName
                );

                if (!functionResult.success) {
                    return {
                        success: false,
                        error: functionResult.error,
                        processingTime: Date.now() - startTime,
                        threadId,
                        runId: runResult.runId
                    };
                }
            }

            // Step 5: Get final response
            const response = await this.getThreadResponse(threadId);
            
            const processingTime = Date.now() - startTime;

            // Log crítico: Procesamiento completado exitosamente
            logSuccess('OPENAI_RUN_COMPLETED', 'Run completado exitosamente', {
                userId,
                userName,
                threadId,
                runId: runResult.runId,
                processingTime,
                tokensUsed: runResult.tokensUsed,
                responseLength: response?.length || 0,
                hasFunctionCalls: !!(runResult.functionCalls && runResult.functionCalls.length > 0)
            });

            // Log del contenido completo de respuesta de OpenAI para debugging
            if (response && response.length > 0) {
                // Detección más específica de errores reales de audio
                // Solo detectar cuando OpenAI específicamente dice que no puede procesar
                const lowerResponse = response.toLowerCase();
                const containsAudioError = (
                    (lowerResponse.includes('no puedo procesar') && (lowerResponse.includes('audio') || lowerResponse.includes('nota de voz'))) ||
                    (lowerResponse.includes('no puedo escuchar') && lowerResponse.includes('audio')) ||
                    (lowerResponse.includes('no tengo la capacidad') && lowerResponse.includes('audio')) ||
                    (lowerResponse.includes('soy un asistente de texto') && lowerResponse.includes('audio')) ||
                    (lowerResponse.includes('por favor envía') && lowerResponse.includes('transcripción'))
                );
                
                logInfo('OPENAI_RESPONSE_CONTENT', 'Respuesta completa de OpenAI', {
                    userId,
                    userName,
                    threadId,
                    runId: runResult.runId,
                    responseLength: response.length,
                    response: response.trim(),  // Mostrar respuesta completa
                    containsAudioError,
                    timestamp: new Date().toISOString()
                });
                
                // Advertencia específica solo si realmente es un error de procesamiento de audio
                if (containsAudioError) {
                    logWarning('OPENAI_AUDIO_PROCESSING_ERROR', 'OpenAI respondió que no puede procesar audio/transcripción', {
                        userId,
                        userName,
                        threadId,
                        runId: runResult.runId,
                        response: response.trim(),
                        assistantId: this.config.assistantId,
                        recommendation: 'Revisar instrucciones del asistente en OpenAI Dashboard'
                    });
                }
            }

            // 🔧 NUEVO: Log compacto de tokens y flow completo
            if (runResult.tokensUsed) {
                // CRÍTICO: Si es thread nuevo o cambió threadId, usar 0 como base, sino usar threadTokenCount de BD
                const baseTokenCount = isNewThread ? 0 : (threadTokenCount || 0);
                logTokenUsage(userId, threadId, baseTokenCount, runResult.tokensUsed, runResult.modelUsed || 'unknown');
                
                // TOKEN SUMMARY LOG - Información completa de fuentes
                const finalTokenCount = baseTokenCount + runResult.tokensUsed;
                const source = existingThreadId ? (existingThreadId === threadId ? 'cache_hit' : 'thread_changed') : 'new_thread';
                console.info(`[TOKEN_SUMMARY:openai] ${userId}: bd:${existingTokenCount || 0} cache:${threadTokenCount || 0} run:+${runResult.tokensUsed} total:${finalTokenCount} src:${source}`);
            }
            
            logMessageFlowComplete(
                userId,
                message.length,
                processingTime,
                0, // beds24Latency - no aplica aquí
                0, // whapiLatency - no aplica aquí
                0  // dbLatency - no aplica aquí
            );

            // Log crítico: Token usage si disponible
            if (runResult.tokensUsed) {
                logInfo('TOKEN_USAGE', 'Tokens utilizados en procesamiento', {
                    userId,
                    userName,
                    threadId,
                    runId: runResult.runId,
                    tokens: runResult.tokensUsed,
                    processingTime
                });
            }

            // Log crítico: High latency si es alto
            if (processingTime > 10000) { // Más de 10 segundos
                logWarning('HIGH_LATENCY', 'Latencia alta detectada en procesamiento', {
                    userId,
                    userName,
                    threadId,
                    runId: runResult.runId,
                    latencyMs: processingTime,
                    tokensUsed: runResult.tokensUsed
                });
            }

            return {
                success: true,
                response,
                processingTime,
                tokensUsed: runResult.tokensUsed,
                threadId,
                runId: runResult.runId,
                threadTokenCount: threadTokenCount // Incluir el token count del thread
            };

        } catch (error) {
            const processingTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            this.log.openaiError(userName, errorMessage);
            
            // Log crítico: Error en procesamiento OpenAI
            logError('OPENAI_PROCESS_ERROR', 'Error en procesamiento con OpenAI', {
                userId,
                userName,
                chatId,
                error: errorMessage,
                stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
                processingTime,
                assistantId: this.config.assistantId
            });
            
            return {
                success: false,
                error: errorMessage,
                processingTime
            };
        } finally {
            // Decrementar contador de concurrencia siempre
            OpenAIService.activeOpenAICalls--;
        }
    }


    // Método simple para agregar un mensaje directo al thread
    public async addSimpleMessage(threadId: string, role: 'user' | 'assistant', content: string): Promise<boolean> {
        try {
            await openAIWithRetry(
                () => this.openai.beta.threads.messages.create(threadId, {
                    role,
                    content
                }),
                { maxRetries: 2, baseDelay: 500 }
            );
            return true;
        } catch (error) {
            logError('SIMPLE_MESSAGE_ERROR', 'Error agregando mensaje simple', {
                threadId,
                role,
                error: error instanceof Error ? error.message : String(error)
            });
            return false;
        }
    }

    public async getOrCreateThread(userId: string, chatId: string): Promise<string> {
        const cacheKey = `thread:${userId}:${chatId}`;
        
        // Try to get cached thread
        if (this.config.enableThreadCache && this.cache) {
            const cachedThreadId = this.cache.get<string>(cacheKey);
            if (cachedThreadId) {
                this.log.debug(`Using cached thread ${cachedThreadId} for ${userId}`);
                
                // Log crítico: Thread reutilizado
                logInfo('THREAD_REUSE', 'Thread reutilizado para usuario', {
                    userId,
                    chatId,
                    threadId: cachedThreadId,
                    source: 'cache'
                });
                
                // DEBUG: Cache hit details
                logDebug('CACHE_HIT_DETAIL', 'Thread cache hit details', {
                    userId,
                    chatId,
                    threadId: cachedThreadId,
                    cacheKey,
                    cacheEnabled: this.config.enableThreadCache
                });
                
                return cachedThreadId;
            }
        }

        // Create new thread
        const thread = await openAIWithRetry(
            () => this.openai.beta.threads.create(),
            {
                maxRetries: 3,
                baseDelay: 1000,
                maxDelay: 5000
            }
        );

        this.log.debug(`Created new thread ${thread.id} for ${userId}`);

        // Log crítico: Nuevo thread creado
        logSuccess('NEW_THREAD_CREATED', 'Nuevo thread creado para usuario', {
            userId,
            chatId,
            threadId: thread.id,
            enableCache: this.config.enableThreadCache
        });
        
        // DEBUG: Thread creation details
        logDebug('THREAD_CREATION_DETAIL', 'New thread creation details', {
            userId,
            chatId,
            threadId: thread.id,
            cacheKey,
            cacheEnabled: this.config.enableThreadCache,
            createdAt: new Date().toISOString()
        });

        // Cache thread if enabled
        if (this.config.enableThreadCache && this.cache) {
            this.cache.set(cacheKey, thread.id, 3600000); // 1 hour cache
        }

        return thread.id;
    }

    private async getThreadTokenCount(threadId: string): Promise<number> {
        try {
            // Obtener los mensajes del thread para calcular tokens aproximados
            const messages = await openAIWithRetry(
                () => this.openai.beta.threads.messages.list(threadId, { limit: 100 }),
                {
                    maxRetries: 2,
                    baseDelay: 1000,
                    maxDelay: 3000
                }
            );

            // Aproximación de tokens: ~4 caracteres = 1 token
            let totalCharacters = 0;
            
            for (const message of messages.data) {
                if (Array.isArray(message.content)) {
                    for (const content of message.content) {
                        if (content.type === 'text') {
                            totalCharacters += content.text.value.length;
                        }
                    }
                }
            }

            // Estimación conservadora: 3 caracteres = 1 token
            const estimatedTokens = Math.ceil(totalCharacters / 3);
            
            logInfo('THREAD_TOKEN_COUNT', 'Token count estimado para thread', {
                threadId,
                totalCharacters,
                estimatedTokens,
                messageCount: messages.data.length
            });

            return estimatedTokens;
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logWarning('THREAD_TOKEN_COUNT_ERROR', 'Error obteniendo token count', {
                threadId,
                error: errorMessage
            });
            
            // Si no podemos obtener el count, asumir que está bien
            return 0;
        }
    }

    private async checkThreadForImages(threadId: string): Promise<boolean> {
        try {
            // Get recent messages to check for image content
            const messages = await openAIWithRetry(
                () => this.openai.beta.threads.messages.list(threadId, { limit: 20 }),
                {
                    maxRetries: 2,
                    baseDelay: 1000,
                    maxDelay: 3000
                }
            );

            // Check if any message contains image content
            for (const message of messages.data) {
                if (Array.isArray(message.content)) {
                    for (const content of message.content) {
                        if (content.type === 'image_url' || content.type === 'image_file') {
                            logInfo('THREAD_HAS_IMAGE_HISTORY', 'Thread contiene historial de imágenes', {
                                threadId,
                                messageId: message.id,
                                imageType: content.type
                            });
                            return true;
                        }
                    }
                }
            }

            return false;
        } catch (error) {
            logWarning('CHECK_THREAD_IMAGES_ERROR', 'Error verificando imágenes en thread', {
                threadId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            // Si hay error, asumir que NO hay imágenes para evitar forzar gpt-4o innecesariamente
            return false;
        }
    }

    private async checkThreadHasMessages(threadId: string, userId: string): Promise<boolean> {
        // Cache para reducir calls a OpenAI en reuso frecuente (5min TTL)
        const cacheKey = `thread_has_messages:${threadId}`;
        
        if (this.cache) {
            const cachedResult = this.cache.get<boolean>(cacheKey);
            if (cachedResult !== undefined) {
                logDebug('THREAD_MESSAGES_CACHE_HIT', 'Resultado desde cache', {
                    threadId,
                    userId,
                    hasMessages: cachedResult,
                    source: 'cache'
                });
                
                // Si está cacheado como vacío, aún verificar tokens huérfanos en BD
                if (!cachedResult && this.databaseService) {
                    const currentThread = await this.databaseService.getThread(userId);
                    if (currentThread?.tokenCount && currentThread.tokenCount > 0) {
                        try {
                            await this.databaseService.updateThreadTokenCount(userId, 0);
                            logWarning('THREAD_TOKENS_RESET_ORPHAN_CACHED', 'Reset tokens huérfanos (resultado cacheado)', { 
                                userId, 
                                threadId,
                                orphanTokens: currentThread.tokenCount
                            });
                        } catch (resetError) {
                            logError('TOKEN_RESET_ORPHAN_ERROR', 'Error reseteando tokens huérfanos (cached)', {
                                userId,
                                threadId,
                                resetError: resetError instanceof Error ? resetError.message : String(resetError)
                            });
                        }
                    }
                }
                
                return cachedResult;
            }
        }
        
        try {
            // Get messages from thread to check if it has real content (optimizado: limit=1)
            const messages = await openAIWithRetry(
                () => this.openai.beta.threads.messages.list(threadId, { limit: 1 }),
                {
                    maxRetries: 2,
                    baseDelay: 500,
                    maxDelay: 2000
                }
            );

            const hasMessages = messages.data.length > 0;
            
            // Si thread está vacío pero tiene tokens en BD, resetear tokens huérfanos
            if (!hasMessages && this.databaseService) {
                const currentThread = await this.databaseService.getThread(userId);
                if (currentThread?.tokenCount && currentThread.tokenCount > 0) {
                    try {
                        await this.databaseService.updateThreadTokenCount(userId, 0);
                        logWarning('THREAD_TOKENS_RESET_ORPHAN', 'Thread vacío detectado - reseteando tokens huérfanos en BD', { 
                            userId, 
                            threadId,
                            orphanTokens: currentThread.tokenCount
                        });
                    } catch (resetError) {
                        logError('TOKEN_RESET_ORPHAN_ERROR', 'Error reseteando tokens huérfanos', {
                            userId,
                            threadId,
                            resetError: resetError instanceof Error ? resetError.message : String(resetError)
                        });
                    }
                }
            }
            
            // Cachear resultado por 5 minutos para reducir calls a OpenAI
            if (this.cache) {
                this.cache.set(cacheKey, hasMessages, 300000); // 5 min TTL
            }
            
            logDebug('THREAD_MESSAGES_CHECK', 'Verificando si thread tiene mensajes reales', {
                threadId,
                userId,
                messageCount: messages.data.length,
                hasMessages,
                cached: !!this.cache
            });

            return hasMessages;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            // Métricas mejoradas para monitorear errores frecuentes
            logWarning('CHECK_THREAD_MESSAGES_ERROR', 'Error verificando mensajes en thread - asumiendo hasMessages=true', {
                threadId,
                userId,
                error: errorMessage,
                assumedResult: true,
                conservativeApproach: 'avoid_false_resets',
                cacheAvailable: !!this.cache
            });
            
            // Cachear como true por 1 minuto (TTL menor) para evitar calls repetidos fallidos
            if (this.cache) {
                this.cache.set(cacheKey, true, 60000); // 1 min TTL para errores
                logDebug('ERROR_CACHED_CONSERVATIVE', 'Error cacheado conservadoramente', {
                    threadId,
                    userId,
                    ttl: '1min',
                    assumedHasMessages: true
                });
            }
            
            // Si hay error, asumir que SÍ tiene mensajes para ser conservadores
            return true;
        }
    }

    private async validateThread(threadId: string, userId: string): Promise<{ isValid: boolean; tokenCount?: number }> {
        // Cache de validación para reducir llamadas a OpenAI
        const validationCacheKey = `thread_valid:${threadId}`;
        
        if (this.cache) {
            const cachedValidation = this.cache.get<{ isValid: boolean; tokenCount?: number }>(validationCacheKey);
            if (cachedValidation) {
                logDebug('THREAD_VALIDATION_CACHE_HIT', 'Validación de thread desde cache', {
                    threadId,
                    isValid: cachedValidation.isValid,
                    tokenCount: cachedValidation.tokenCount
                });
                return cachedValidation;
            }
        }
        
        try {
            // Intentar obtener información del thread desde OpenAI
            await openAIWithRetry(
                () => this.openai.beta.threads.retrieve(threadId),
                {
                    maxRetries: 2,
                    baseDelay: 1000,
                    maxDelay: 3000
                }
            );
            
            // Si llegamos aquí, el thread existe - obtener token count
            const tokenCount = await this.getThreadTokenCount(threadId);
            
            const result = { isValid: true, tokenCount };
            
            // Cachear resultado válido por 30 minutos
            if (this.cache) {
                this.cache.set(validationCacheKey, result, 1800000); // 30 min
                logDebug('THREAD_VALIDATION_CACHED', 'Validación de thread cacheada', {
                    threadId,
                    isValid: true,
                    tokenCount,
                    ttl: '30min'
                });
            }
            
            return result;
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            // Errores que indican thread inválido
            if (errorMessage.includes('No thread found') || 
                errorMessage.includes('Thread not found') ||
                errorMessage.includes('Invalid thread') ||
                error.status === 404) {
                
                // Resetear tokens para thread inválido
                try {
                    if (this.databaseService) {
                        await this.databaseService.updateThreadTokenCount(userId, 0);
                        logWarning('TOKEN_RESET_INVALID', 'Reset tokens a 0: Thread no encontrado en OpenAI', { 
                            userId, 
                            threadId, 
                            error: errorMessage 
                        });
                    } else {
                        logWarning('TOKEN_RESET_SKIPPED', 'DatabaseService no disponible - skip reset', { userId, threadId });
                    }
                } catch (resetError) {
                    logError('TOKEN_RESET_ERROR', 'Error reseteando tokens para thread inválido', {
                        userId,
                        threadId,
                        resetError: resetError instanceof Error ? resetError.message : String(resetError)
                    });
                }
                
                logWarning('THREAD_NOT_FOUND', 'Thread no encontrado en OpenAI', {
                    threadId,
                    userId,
                    error: errorMessage
                });
                
                const result = { isValid: false };
                
                // Cachear resultado inválido por 5 minutos
                if (this.cache) {
                    this.cache.set(validationCacheKey, result, 300000); // 5 min
                }
                
                return result;
            }
            
            // Otros errores (rate limit, conexión, etc.) - asumir que el thread es válido
            logWarning('THREAD_VALIDATION_ERROR', 'Error validando thread, asumiendo válido', {
                threadId,
                error: errorMessage
            });
            
            return { isValid: true }; // Benefit of the doubt - no cachear errores temporales
        }
    }

    async checkActiveRun(threadId: string): Promise<{ isActive: boolean }> {
        try {
            const runs = await this.openai.beta.threads.runs.list(threadId, { limit: 1 });
            const latestRun = runs.data[0];
            return { 
                isActive: latestRun?.status === 'in_progress' || latestRun?.status === 'queued' 
            };
        } catch (error) {
            logWarning('CHECK_ACTIVE_RUN_ERROR', 'Error verificando run activo', {
                threadId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return { isActive: false }; // Asumir no activo en caso de error
        }
    }

    private async addMessageToThread(threadId: string, message: string, imageMessage?: { type: 'image', imageUrl: string, caption: string }): Promise<void> {
        // Crear contenido multimodal si hay imagen
        let content: any;
        
        if (imageMessage) {
            // Formato multimodal para assistant
            content = [
                {
                    type: 'text',
                    text: imageMessage.caption || message || 'Analiza esta imagen en el contexto de nuestros servicios hoteleros'
                },
                {
                    type: 'image_url',
                    image_url: {
                        url: imageMessage.imageUrl,
                        detail: 'high'
                    }
                }
            ];
        } else {
            // Solo texto como antes
            content = message;
        }

        await openAIWithRetry(
            () => this.openai.beta.threads.messages.create(threadId, {
                role: 'user',
                content: content
            }),
            {
                maxRetries: 30, // Aumentado de 3 a 30 para race conditions
                baseDelay: 1000, // Aumentado de 500 a 1000ms
                maxDelay: 10000, // Aumentado de 3000 a 10000ms (10s)
                backoffFactor: 1.5 // Backoff más suave para threads ocupados
            }
        );
    }


    private async createAndMonitorRun(threadId: string, userName: string, hasImage: boolean = false, hasCurrentImage: boolean = false, hasImageHistory: boolean = false): Promise<{
        success: boolean;
        error?: string;
        runId?: string;
        functionCalls?: FunctionCall[];
        tokensUsed?: number;
        modelUsed?: string;
    }> {
        try {
            // Create run with model override for images
            const runParams: any = {
                assistant_id: this.config.assistantId
            };
            
            if (hasImage) {
                // Override to o4-mini for images or threads with image history (más barato)
                runParams.model = 'o4-mini';
                // Quitar reasoning_effort explícito para evitar invalid_request_error
                logInfo('MODEL_OVERRIDE', 'Usando o4-mini para thread con contenido visual', {
                    threadId,
                    assistantId: this.config.assistantId,
                    overrideModel: 'o4-mini',
                    reasoningEffort: 'not_set',
                    hasCurrentImage,
                    hasImageHistory
                });
            } else {
                // Usar modelo por defecto del Assistant (configurado en OpenAI Dashboard)
                logInfo('MODEL_DEFAULT', 'Usando modelo por defecto del Assistant', {
                    threadId,
                    assistantId: this.config.assistantId,
                    hasCurrentImage: hasCurrentImage,
                    hasImageHistory: hasImageHistory
                });
            }
            
            const run = await openAIWithRetry(
                () => this.openai.beta.threads.runs.create(threadId, runParams),
                {
                    maxRetries: 3,
                    baseDelay: 1000,
                    maxDelay: 5000
                }
            );

            this.log.debug(`Created run ${run.id} for thread ${threadId}`);

            // Monitor run with polling and exponential backoff
            const result = await this.pollRunStatus(threadId, run.id, userName);
            
            return {
                success: result.success,
                error: result.error,
                runId: run.id,
                functionCalls: result.functionCalls,
                tokensUsed: result.tokensUsed,
                modelUsed: result.modelUsed || 'unknown'
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create run'
            };
        }
    }

    private async pollRunStatus(threadId: string, runId: string, userName: string): Promise<{
        success: boolean;
        error?: string;
        functionCalls?: FunctionCall[];
        tokensUsed?: number;
        modelUsed?: string;
    }> {
        let attempts = 0;
        // Polling dinámico: más rápido para estados iniciales (queued), más lento para procesamiento
        let backoffDelay = 500; // Empezar con 500ms para respuestas rápidas
        const pollingStartTime = Date.now();

        while (attempts < this.config.maxPollingAttempts) {
            try {
                const run = await openAIWithRetry(
                    () => this.openai.beta.threads.runs.retrieve(threadId, runId),
                    {
                        maxRetries: 2,
                        baseDelay: 500,
                        maxDelay: 2000
                    }
                );

                this.log.debug(`Run ${runId} status: ${run.status} (attempt ${attempts + 1})`);

                // Límite especial para runs largos sin function calling
                if (attempts > 30 && run.status !== 'requires_action') {
                    logInfo('OPENAI_POLLING_TIMEOUT', 'Cortando polling por límite de 30 intentos', {
                        threadId,
                        runId,
                        status: run.status,
                        attempts: attempts + 1,
                        reason: 'max_attempts_reached'
                    });
                    break;
                }

                // Ajustar delay dinámicamente basado en el estado y tiempo transcurrido
                if (run.status === 'queued') {
                    // Para estado queued, usar polling más agresivo los primeros 5 segundos
                    backoffDelay = (Date.now() - pollingStartTime < 5000) ? 500 : 1000;
                } else if (run.status === 'in_progress') {
                    // Para in_progress, aumentar gradualmente el delay
                    backoffDelay = Math.min(2000, 1000 + (attempts * 100)); // Max 2s
                } else {
                    // Para otros estados, usar delay normal
                    backoffDelay = this.config.pollingInterval;
                }

                // Log crítico: Polling de run con delay dinámico
                if (attempts % 5 === 0 || run.status !== 'in_progress') { // Log cada 5 intentos o cuando cambia estado
                    logInfo('OPENAI_POLLING', `Esperando respuesta - status: ${run.status}`, {
                        threadId,
                        runId,
                        status: run.status,
                        attempts: attempts + 1,
                        maxAttempts: this.config.maxPollingAttempts,
                        backoffDelay,
                        elapsedTime: Date.now() - pollingStartTime
                    });
                }

                switch (run.status) {
                    case 'completed':
                        return {
                            success: true,
                            tokensUsed: run.usage?.total_tokens,
                            modelUsed: run.model || 'unknown'
                        };

                    case 'requires_action':
                        // Log crítico: Run requiere action (function calling)
                        logInfo('RUN_REQUIRES_ACTION', 'Run requiere action para function calling', {
                            threadId,
                            runId,
                            actionType: run.required_action?.type,
                            toolCallsCount: run.required_action?.submit_tool_outputs?.tool_calls?.length || 0,
                            attempts: attempts + 1
                        });
                        
                        if (run.required_action?.type === 'submit_tool_outputs') {
                            const toolCalls = run.required_action.submit_tool_outputs.tool_calls;
                            
                            // Lista de funciones que requieren mensajes interinos
                            const slowFunctions = ['check_availability', 'search_rooms', 'calculate_pricing', 'process_booking'];
                            const functionInterimMessages = {
                                'check_availability': "Permíteme y consulto en nuestro sistema...",
                                'search_rooms': "Buscando habitaciones disponibles...",
                                'calculate_pricing': "Calculando precios y ofertas...",
                                'process_booking': "Procesando tu reserva..."
                            };
                            
                            // Enviar mensaje interino para funciones lentas
                            const slowFunction = toolCalls.find(tc => slowFunctions.includes(tc.function.name));
                            if (slowFunction && this.currentChatId) {
                                try {
                                    // Solo enviar si hay un WhatsappService disponible
                                    if (this.whatsappService) {
                                        const interimMessage = functionInterimMessages[slowFunction.function.name] || "Un momento por favor...";
                                        await this.whatsappService.sendWhatsAppMessage(
                                            this.currentChatId, 
                                            interimMessage, 
                                            { lastInputVoice: false }, 
                                            false
                                        );
                                        
                                        logInfo('INTERIM_MESSAGE_SENT', 'Mensaje interino enviado automáticamente', {
                                            threadId,
                                            runId,
                                            functionName: slowFunction.function.name,
                                            message: interimMessage
                                        });
                                    }
                                } catch (error) {
                                    // No bloquear por error en mensaje interino
                                    logWarning('INTERIM_MESSAGE_ERROR', 'Error enviando mensaje interino', {
                                        threadId,
                                        runId,
                                        functionName: slowFunction?.function.name,
                                        error: error instanceof Error ? error.message : String(error)
                                    });
                                }
                            }
                            
                            const functionCalls = toolCalls.map(tc => ({
                                id: tc.id,
                                function: {
                                    name: tc.function.name,
                                    arguments: tc.function.arguments
                                }
                            }));

                            return {
                                success: true,
                                functionCalls,
                                modelUsed: run.model || 'unknown'
                            };
                        }
                        break;

                    case 'failed':
                    case 'cancelled':
                    case 'expired':
                        return {
                            success: false,
                            error: `Run ${run.status}: ${run.last_error?.message || 'No additional details'}`
                        };

                    case 'queued':
                    case 'in_progress':
                        // Continue polling
                        break;

                    default:
                        this.log.warning(`Unknown run status: ${run.status}`);
                        continue;
                }

                // Exponential backoff with jitter
                await this.sleep(backoffDelay + Math.random() * 1000);
                backoffDelay = Math.min(backoffDelay * 1.5, 5000); // Max 5 seconds
                attempts++;

            } catch (error) {
                this.log.error(`Error polling run status: ${error instanceof Error ? error.message : 'Unknown'}`);
                attempts++;
                
                if (attempts >= this.config.maxPollingAttempts) {
                    return {
                        success: false,
                        error: `Polling failed after ${attempts} attempts`
                    };
                }

                // Wait before retry
                await this.sleep(backoffDelay);
                backoffDelay = Math.min(backoffDelay * 2, 10000);
            }
        }

        return {
            success: false,
            error: `Run timed out after ${this.config.maxPollingAttempts} attempts`
        };
    }

    private async handleFunctionCalls(
        threadId: string, 
        runId: string, 
        functionCalls: FunctionCall[],
        userName: string
    ): Promise<{
        success: boolean;
        error?: string;
    }> {
        try {
            this.log.info(`Processing ${functionCalls.length} function calls for ${userName}`);

            // Log crítico: Inicio de function calling
            logInfo('FUNCTION_CALLING_START', `Procesando ${functionCalls.length} function calls`, {
                threadId,
                runId,
                userName,
                functionCount: functionCalls.length,
                functionNames: functionCalls.map(fc => fc.function.name)
            });

            const toolOutputs = [];

            for (const functionCall of functionCalls) {
                this.log.functionStart(functionCall.function.name, 
                    JSON.parse(functionCall.function.arguments)
                );

                // Log crítico: Llamada a función con argumentos exactos  
                logInfo('OPENAI_FUNC_CALL', `Llamando función desde OpenAI`, {
                    threadId,
                    runId,
                    functionName: functionCall.function.name,
                    functionId: functionCall.id,
                    args: functionCall.function.arguments, // Argumentos exactos enviados por OpenAI
                    argsPreview: functionCall.function.arguments.substring(0, 100) + '...'
                });
                
                // Log crítico: Ejecutando función específica
                logInfo('FUNCTION_EXECUTING', `Ejecutando función ${functionCall.function.name}`, {
                    threadId,
                    runId,
                    functionName: functionCall.function.name,
                    functionId: functionCall.id,
                    arguments: functionCall.function.arguments
                });

                try {
                    // Execute function using the real registry
                    const result = await this.executeFunctionCall(functionCall);
                    
                    // Formatear respuesta para envío a OpenAI
                    const formattedForOpenAI = JSON.stringify(result);
                    
                    // 📤 NUEVO: Respuesta completa compactada de función enviada a OpenAI
                    const compactFunctionResult = formattedForOpenAI
                        .replace(/\n/g, '\\n')
                        .replace(/\t/g, '\\t')
                        .replace(/\s+/g, ' ')
                        .trim();
                    
                    logInfo('PLUGIN_RESPONSE_FULL', 'Respuesta completa de función enviada a OpenAI', {
                        threadId,
                        runId,
                        functionName: functionCall.function.name,
                        functionId: functionCall.id,
                        fullCompactOutput: compactFunctionResult,  // Completo compactado
                        originalLength: formattedForOpenAI.length,
                        compactLength: compactFunctionResult.length,
                        isBeds24: functionCall.function.name === 'check_availability',
                        sentToOpenAI: true
                    });
                    
                    // Log crítico: Función ejecutada exitosamente
                    logSuccess('FUNCTION_COMPLETED', `Función ${functionCall.function.name} completada exitosamente`, {
                        threadId,
                        runId,
                        functionName: functionCall.function.name,
                        functionId: functionCall.id,
                        resultLength: JSON.stringify(result).length
                    });
                    
                    toolOutputs.push({
                        tool_call_id: functionCall.id,
                        output: formattedForOpenAI
                    });

                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    
                    this.log.functionError(functionCall.function.name, errorMessage);

                    // Log crítico: Error ejecutando función
                    logError('FUNCTION_ERROR', `Error ejecutando función ${functionCall.function.name}`, {
                        threadId,
                        runId,
                        functionName: functionCall.function.name,
                        functionId: functionCall.id,
                        error: errorMessage,
                        stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined
                    });

                    toolOutputs.push({
                        tool_call_id: functionCall.id,
                        output: JSON.stringify({
                            error: errorMessage
                        })
                    });
                }
            }

            // Log crítico: Datos exactos enviados de vuelta a OpenAI
            logInfo('OPENAI_TOOL_OUTPUTS_SENDING', 'Enviando tool outputs exactos a OpenAI', {
                threadId,
                runId,
                toolOutputsCount: toolOutputs.length,
                toolOutputsData: toolOutputs.map(output => ({
                    tool_call_id: output.tool_call_id,
                    output: output.output,
                    outputPreview: output.output.substring(0, 200) + '...',
                    outputLength: output.output.length
                })),
                fullPayload: JSON.stringify(toolOutputs, null, 2) // Payload completo formateado
            });

            // Submit tool outputs
            await openAIWithRetry(
                () => this.openai.beta.threads.runs.submitToolOutputs(threadId, runId, {
                    tool_outputs: toolOutputs
                }),
                {
                    maxRetries: 3,
                    baseDelay: 1000,
                    maxDelay: 5000
                }
            );

            // Log crítico: Tool outputs enviados
            logSuccess('TOOL_OUTPUTS_SUBMITTED', 'Tool outputs enviados a OpenAI', {
                threadId,
                runId,
                toolOutputsCount: toolOutputs.length,
                functionNames: functionCalls.map(fc => fc.function.name)
            });

            // Continue monitoring the run
            const result = await this.pollRunStatus(threadId, runId, userName);
            
            // Log crítico: Respuesta después de function calling
            if (result.success) {
                logSuccess('FUNCTION_CALLING_RESPONSE', 'Respuesta recibida después de function calling', {
                    threadId,
                    runId,
                    userName,
                    functionCount: functionCalls.length,
                    tokensUsed: result.tokensUsed
                });
            }
            
            return {
                success: result.success,
                error: result.error
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Function handling failed'
            };
        }
    }

    private async executeFunctionCall(functionCall: FunctionCall): Promise<any> {
        if (!this.functionRegistry) {
            throw new Error('Function registry not configured');
        }

        const functionName = functionCall.function.name;
        
        this.log.debug(`Executing function: ${functionName}`);
        
        try {
            // Parse arguments
            const args = JSON.parse(functionCall.function.arguments);
            
            // Execute function using the real registry
            const result = await this.functionRegistry.execute(functionName, args);
            
            // Return the result directly for OpenAI to see the actual data
            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.log.error(`Function ${functionName} failed: ${errorMessage}`);
            
            return {
                success: false,
                error: errorMessage,
                timestamp: new Date().toISOString()
            };
        }
    }

    private async getThreadResponse(threadId: string): Promise<string> {
        const messages = await openAIWithRetry(
            () => this.openai.beta.threads.messages.list(threadId, {
                order: 'desc',
                limit: 1
            }),
            {
                maxRetries: 3,
                baseDelay: 500,
                maxDelay: 2000
            }
        );

        const lastMessage = messages.data[0];
        
        if (!lastMessage || lastMessage.role !== 'assistant') {
            logInfo('NO_ASSISTANT_MESSAGE', 'No assistant message found, returning empty silently');
            return ''; // Retorna vacío como en el antiguo, para no enviar respuesta automática
        }

        // Extract text content from the message
        const textContent = lastMessage.content.find(content => content.type === 'text');
        
        if (!textContent) {
            logInfo('NO_TEXT_CONTENT', 'No text content in assistant response, returning empty silently');
            return ''; // Retorna vacío en lugar de lanzar error
        }

        const responseText = (textContent as any).text.value;
        
        // Si la respuesta está vacía, retornar vacío silenciosamente (como en el monolítico)
        if (!responseText || !responseText.trim()) {
            logInfo('EMPTY_RESPONSE_TEXT', 'Empty assistant response text, returning empty silently');
            return '';
        }

        return responseText;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Utility methods

    async getThreadMessages(threadId: string, limit: number = 10): Promise<any[]> {
        const messages = await openAIWithRetry(
            () => this.openai.beta.threads.messages.list(threadId, {
                order: 'desc',
                limit
            }),
            {
                maxRetries: 2,
                baseDelay: 500
            }
        );

        return messages.data;
    }

    async deleteThread(threadId: string): Promise<boolean> {
        try {
            await openAIWithRetry(
                () => this.openai.beta.threads.del(threadId),
                {
                    maxRetries: 2,
                    baseDelay: 500
                }
            );

            // Remove from cache if enabled
            if (this.config.enableThreadCache && this.cache) {
                // We would need userId and chatId to construct the cache key
                // For now, we'll skip cache cleanup
                this.log.debug(`Thread ${threadId} deleted`);
            }

            return true;
        } catch (error) {
            this.log.error(`Failed to delete thread ${threadId}: ${error instanceof Error ? error.message : 'Unknown'}`);
            return false;
        }
    }

    async cancelRun(threadId: string, runId: string): Promise<boolean> {
        try {
            await openAIWithRetry(
                () => this.openai.beta.threads.runs.cancel(threadId, runId),
                {
                    maxRetries: 2,
                    baseDelay: 500
                }
            );

            this.log.info(`Run ${runId} cancelled for thread ${threadId}`);
            return true;
        } catch (error) {
            this.log.error(`Failed to cancel run ${runId}: ${error instanceof Error ? error.message : 'Unknown'}`);
            return false;
        }
    }

    async cleanupOldRuns(threadId: string, userId: string): Promise<number> {
        try {
            const runs = await openAIWithRetry(
                () => this.openai.beta.threads.runs.list(threadId, { limit: 10 }),
                { maxRetries: 2, baseDelay: 500 }
            );
            
            let cancelledCount = 0;
            
            for (const run of runs.data) {
                // Cancel runs that have been active for more than 10 minutes
                if (['queued', 'in_progress', 'requires_action'].includes(run.status)) {
                    // OpenAI uses Unix timestamp in seconds
                    const runCreatedAt = typeof run.created_at === 'number' 
                        ? run.created_at * 1000  // Convert to milliseconds
                        : new Date(run.created_at).getTime();
                    
                    const runAge = Date.now() - runCreatedAt;
                    const ageMinutes = Math.floor(runAge / 60000);
                    
                    // Only cancel if really old (more than 10 minutes)
                    if (ageMinutes > 10) {
                        try {
                            await openAIWithRetry(
                                () => this.openai.beta.threads.runs.cancel(threadId, run.id),
                                { maxRetries: 2, baseDelay: 500 }
                            );
                            cancelledCount++;
                            
                            this.log.warning(`Old run cancelled automatically - Run: ${run.id}, Age: ${ageMinutes}min, User: ${userId}`);
                        } catch (cancelError) {
                            this.log.error(`Failed to cancel old run ${run.id}: ${cancelError instanceof Error ? cancelError.message : 'Unknown'}`);
                        }
                    }
                }
            }
            
            if (cancelledCount > 0) {
                this.log.info(`Cleaned up ${cancelledCount} old runs for thread ${threadId}`);
            }
            
            return cancelledCount;
        } catch (error) {
            this.log.error(`Error cleaning up old runs: ${error instanceof Error ? error.message : 'Unknown'}`);
            return 0;
        }
    }

    async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
        try {
            // Test OpenAI API connectivity
            const models = await openAIWithRetry(
                () => this.openai.models.list(),
                { maxRetries: 1, baseDelay: 1000 }
            );

            // Test assistant availability
            const assistant = await openAIWithRetry(
                () => this.openai.beta.assistants.retrieve(this.config.assistantId),
                { maxRetries: 1, baseDelay: 1000 }
            );

            return {
                status: 'healthy',
                details: {
                    apiConnectivity: 'ok',
                    assistantId: this.config.assistantId,
                    assistantName: assistant.name,
                    modelsAvailable: models.data.length,
                    threadCacheEnabled: this.config.enableThreadCache,
                    maxRunTime: this.config.maxRunTime,
                    pollingInterval: this.config.pollingInterval
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                details: {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    assistantId: this.config.assistantId,
                    apiConnectivity: 'failed'
                }
            };
        }
    }

    async processWithOpenAI(userId: string, combinedText: string, chatId: string, userName: string): Promise<void> {
        // Delegate to the main processMessage method
        const result = await this.processMessage(userId, combinedText, chatId, userName);
        
        if (!result.success) {
            throw new Error(result.error || 'OpenAI processing failed');
        }
        
        // This method doesn't return the response directly - the calling code should handle responses
        // This maintains compatibility with the interface while using the full functionality
    }

    getConfig(): Required<OpenAIServiceConfig> {
        return { ...this.config };
    }
}