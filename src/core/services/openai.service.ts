// src/core/services/openai.service.ts
import OpenAI from 'openai';
import { IOpenAIService, IFunctionRegistry } from '../../shared/interfaces';
import { OpenAIRun, FunctionCall } from '../../shared/types';
import { openAIWithRetry, withTimeout } from '../utils/retry-utils';
import { TerminalLog } from '../utils/terminal-log';
import { CacheManager } from '../state/cache-manager';
import { logInfo, logSuccess, logError, logWarning, logDebug } from '../../utils/logging';

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

    constructor(
        config: OpenAIServiceConfig,
        terminalLog: TerminalLog,
        cacheManager?: CacheManager,
        functionRegistry?: IFunctionRegistry
    ) {
        this.config = {
            apiKey: config.apiKey,
            assistantId: config.assistantId,
            maxRunTime: config.maxRunTime ?? 120000, // 2 minutes
            pollingInterval: config.pollingInterval ?? 1000, // 1 second
            maxPollingAttempts: config.maxPollingAttempts ?? 120, // 2 minutes max
            enableThreadCache: config.enableThreadCache ?? true
        };

        this.openai = new OpenAI({ apiKey: this.config.apiKey });
        this.log = terminalLog;
        this.cache = cacheManager;
        this.functionRegistry = functionRegistry;
    }


    async processMessage(userId: string, message: string, chatId: string, userName: string, existingThreadId?: string, imageMessage?: { type: 'image', imageUrl: string, caption: string }): Promise<ProcessingResult> {
        const startTime = Date.now();

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
                timestamp: new Date().toISOString()
            });

            // Step 1: Get or create thread (validate existing thread first)
            let threadId: string;
            let threadTokenCount: number | undefined;
            
            if (existingThreadId) {
                // Validar que el thread existe y obtener token count
                const validation = await this.validateThread(existingThreadId);
                if (validation.isValid) {
                    threadId = existingThreadId;
                    threadTokenCount = validation.tokenCount;
                    
                    // Log crítico: Thread reutilizado desde base de datos
                    logInfo('THREAD_REUSE', 'Thread reutilizado desde base de datos', {
                        userId,
                        userName, 
                        chatId,
                        threadId: existingThreadId,
                        tokenCount: threadTokenCount,
                        source: 'database'
                    });
                    
                    // DEBUG: Detailed thread validation info
                    logDebug('THREAD_VALIDATION', 'Thread validation details', {
                        userId,
                        threadId: existingThreadId,
                        tokenCount: threadTokenCount,
                        validationPassed: true,
                        source: 'database'
                    });
                } else {
                    // Thread inválido, crear uno nuevo
                    logWarning('THREAD_INVALID', 'Thread existente inválido, creando nuevo', {
                        userId,
                        userName,
                        oldThreadId: existingThreadId,
                        reason: 'thread_validation_failed'
                    });
                    threadId = await this.getOrCreateThread(userId, chatId);
                }
            } else {
                threadId = await this.getOrCreateThread(userId, chatId);
            }

            // Step 2: Add message to thread (with optional image)
            await this.addMessageToThread(threadId, message, imageMessage);
            
            // Log exacto del mensaje aplanado enviado a OpenAI (incluyendo contexto temporal BD)
            const flattenedMessage = message.replace(/\n/g, 'n/n/').replace(/\t/g, 't/t/');
            const preview20Words = flattenedMessage.split(' ').slice(0, 20).join(' ') + '...';
            logInfo('OPENAI_SEND', 'Mensaje exacto enviado a OpenAI', {
                userId,
                userName,
                threadId,
                fullContent: message, // Mensaje completo original
                flattenedContent: flattenedMessage, // Mensaje aplanado con refs
                preview: preview20Words, // Solo 20 palabras
                length: message.length,
                contextSource: 'BD temporal inject' // Indica que incluye contexto de BD
            });
            
            // Mantener el log anterior para compatibilidad  
            logInfo('OPENAI_MESSAGE_SENT', 'Mensaje enviado al thread de OpenAI', {
                userId,
                userName,
                threadId,
                messagePreview: message.substring(0, 500),
                messageLength: message.length,
                messageType: message.includes('Audio)') ? 'transcription' : 'text',
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
                const containsAudioError = response.includes('transcripción') || 
                                         response.includes('nota de voz') || 
                                         response.includes('audio') ||
                                         response.includes('repetirlo') ||
                                         response.includes('escribirlo');
                
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
                
                // Advertencia específica si OpenAI dice que no puede procesar audio
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
        }
    }

    private async getOrCreateThread(userId: string, chatId: string): Promise<string> {
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

    private async validateThread(threadId: string): Promise<{ isValid: boolean; tokenCount?: number }> {
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
            
            return { isValid: true, tokenCount };
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            // Errores que indican thread inválido
            if (errorMessage.includes('No thread found') || 
                errorMessage.includes('Thread not found') ||
                errorMessage.includes('Invalid thread') ||
                error.status === 404) {
                
                logWarning('THREAD_NOT_FOUND', 'Thread no encontrado en OpenAI', {
                    threadId,
                    error: errorMessage
                });
                
                return { isValid: false };
            }
            
            // Otros errores (rate limit, conexión, etc.) - asumir que el thread es válido
            logWarning('THREAD_VALIDATION_ERROR', 'Error validando thread, asumiendo válido', {
                threadId,
                error: errorMessage
            });
            
            return { isValid: true }; // Benefit of the doubt
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
    }> {
        try {
            // Create run with model override for images
            const runParams: any = {
                assistant_id: this.config.assistantId
            };
            
            if (hasImage) {
                // Override to gpt-4o for images or threads with image history
                runParams.model = 'gpt-4o';
                runParams.reasoning_effort = null; // Explicitly disable reasoning_effort for gpt-4o
                logInfo('MODEL_OVERRIDE', 'Usando gpt-4o para thread con contenido visual', {
                    threadId,
                    assistantId: this.config.assistantId,
                    overrideModel: 'gpt-4o',
                    reasoningEffort: 'null (disabled)',
                    hasCurrentImage,
                    hasImageHistory
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
                tokensUsed: result.tokensUsed
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
    }> {
        let attempts = 0;
        let backoffDelay = this.config.pollingInterval;

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

                // Log crítico: Polling de run
                if (attempts % 5 === 0 || run.status !== 'in_progress') { // Log cada 5 intentos o cuando cambia estado
                    logInfo('OPENAI_POLLING', `Esperando respuesta - status: ${run.status}`, {
                        threadId,
                        runId,
                        status: run.status,
                        attempts: attempts + 1,
                        maxAttempts: this.config.maxPollingAttempts,
                        backoffDelay
                    });
                }

                switch (run.status) {
                    case 'completed':
                        return {
                            success: true,
                            tokensUsed: run.usage?.total_tokens
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
                            const functionCalls = run.required_action.submit_tool_outputs.tool_calls.map(tc => ({
                                id: tc.id,
                                function: {
                                    name: tc.function.name,
                                    arguments: tc.function.arguments
                                }
                            }));

                            return {
                                success: true,
                                functionCalls
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
                    
                    // Log crítico: Resultado de función formateado para OpenAI
                    logInfo('OPENAI_FUNC_RESULT', `Resultado de función formateado para OpenAI`, {
                        threadId,
                        runId,
                        functionName: functionCall.function.name,
                        functionId: functionCall.id,
                        apiResult: JSON.stringify(result), // Resultado exacto de la API/función
                        formattedForOpenAI: formattedForOpenAI, // Cómo se envía de vuelta a OpenAI
                        preview: formattedForOpenAI.substring(0, 100) + '...',
                        resultLength: formattedForOpenAI.length
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

    getConfig(): Required<OpenAIServiceConfig> {
        return { ...this.config };
    }
}