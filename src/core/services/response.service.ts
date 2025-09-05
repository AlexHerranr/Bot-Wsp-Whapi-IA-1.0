// src/core/services/response.service.ts
import OpenAI from 'openai';
import { logInfo, logError, logWarning, logDebug } from '../../utils/logging';
import { FunctionCall } from '../../shared/types';
import { IFunctionRegistry } from '../../shared/interfaces';

export interface ResponseServiceConfig {
    apiKey: string;
    model?: string;
    maxOutputTokens?: number;
    temperature?: number;
}

export interface ConversationContext {
    userId: string;
    previousResponseId?: string; // Para encadenar respuestas
    messageHistory?: Array<{
        role: 'user' | 'assistant';
        content: string;
        timestamp: number;
    }>;
    metadata?: Record<string, any>;
    promptVariables?: Record<string, string>;
}

export interface ResponseResult {
    success: boolean;
    responseId: string;
    content?: string;
    functionCalls?: FunctionCall[];
    error?: string;
    usage?: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
    };
    processingTime: number;
    outputItems?: any[]; // Items de output completos para mantener contexto
}

export class ResponseService {
    private openai: OpenAI;
    private config: Required<ResponseServiceConfig>;
    private functionRegistry?: IFunctionRegistry;
    
    constructor(
        config: ResponseServiceConfig,
        functionRegistry?: IFunctionRegistry
    ) {
        this.config = {
            apiKey: config.apiKey,
            model: config.model || 'gpt-5',
            maxOutputTokens: config.maxOutputTokens || 4096,
            temperature: config.temperature || 0.7
        };
        
        this.openai = new OpenAI({ apiKey: this.config.apiKey });
        this.functionRegistry = functionRegistry;
    }
    
    async createResponse(
        instructions: string | { id: string; version?: string },
        userMessage: string,
        context: ConversationContext,
        functions?: any[],
        imageMessage?: { type: 'image', imageUrl: string, caption: string },
        functionOutputs?: Array<{call_id: string, output: any}>,
        previousOutputItems?: any[]
    ): Promise<ResponseResult> {
        const startTime = Date.now();
        
        try {
            logInfo('RESPONSE_API_START', 'Iniciando llamada a Responses API', {
                userId: context.userId,
                hasPreviousResponse: !!context.previousResponseId,
                functionsCount: functions?.length || 0,
                hasFunctionOutputs: !!functionOutputs?.length
            });
            
            // Construir el input
            let input: any[] = [];
            
            // Si hay function outputs, incluir items anteriores y outputs
            if (functionOutputs && functionOutputs.length > 0) {
                // Primero incluir todos los items anteriores (reasoning, function calls, etc)
                if (previousOutputItems && previousOutputItems.length > 0) {
                    input = [...previousOutputItems];
                }
                
                // Luego agregar los function outputs
                const outputs = functionOutputs.map(fo => ({
                    type: "function_call_output",
                    call_id: fo.call_id,
                    output: typeof fo.output === 'string' ? fo.output : JSON.stringify(fo.output)
                }));
                
                input.push(...outputs);
                
                // Deduplicar input para evitar error "Duplicate item found with id"
                input = this.deduplicateInput(input);
                
                // Filtrar items según tipo de modelo para evitar truncamiento
                input = this.filterItemsForModel(input, this.config.model);
                
                logDebug('FUNCTION_OUTPUTS_INPUT', 'Input con function outputs construido', {
                    previousItemsCount: previousOutputItems?.length || 0,
                    outputsCount: functionOutputs.length,
                    totalItems: input.length,
                    callIds: functionOutputs.map(fo => fo.call_id),
                    deduplicated: true
                });
            }
            // Si no hay function outputs, construir input normal
            else {
                // Agregar historial si existe
                if (context.messageHistory && context.messageHistory.length > 0) {
                    context.messageHistory.forEach(msg => {
                        input.push({
                            type: 'message',
                            role: msg.role,
                            content: [{
                                type: msg.role === 'user' ? 'input_text' : 'output_text',
                                text: msg.content
                            }]
                        });
                    });
                }
            
            // Construir contenido del mensaje actual
            const messageContent: any[] = [];
            
            // Agregar texto si existe
            if (userMessage && userMessage.trim()) {
                messageContent.push({
                    type: 'input_text',
                    text: userMessage
                });
            }
            
            // Agregar imagen si existe
            if (imageMessage) {
                logInfo('IMAGE_PROCESSING', 'Agregando imagen a la solicitud', {
                    userId: context.userId,
                    imageUrl: imageMessage.imageUrl.substring(0, 50) + '...',
                    hasCaption: !!imageMessage.caption,
                    caption: imageMessage.caption?.substring(0, 50) || 'sin caption'
                });
                
                messageContent.push({
                    type: 'input_image',
                    image: imageMessage.imageUrl
                } as any);
                
                // Si hay caption, agregarlo como texto adicional
                if (imageMessage.caption && imageMessage.caption.trim()) {
                    messageContent.push({
                        type: 'input_text',
                        text: `[Caption de la imagen]: ${imageMessage.caption}`
                    });
                }
            }
            
                // Agregar mensaje actual con contenido mixto solo si no estamos enviando function outputs
                input.push({
                    type: 'message',
                    role: 'user',
                    content: messageContent
                });
            }
            
            // Preparar parámetros de la llamada
            // Preparar parámetros base
            const requestParams: any = {
                input: input,
                max_output_tokens: this.config.maxOutputTokens,
                store: true, // Almacenar para poder referenciar después
                truncation: 'auto' // Truncar automáticamente cuando se acerque al límite
            };
            
            // Solo agregar model si no usamos prompt ID
            if (typeof instructions === 'string') {
                requestParams.model = this.config.model;
                // Temperature se configurará en adjustParametersForModel
            }
            // Si usamos prompt ID, el modelo viene del prompt
            
            // Configurar instrucciones o prompt
            if (typeof instructions === 'string') {
                requestParams.instructions = instructions;
            } else {
                // Usar prompt ID del dashboard
                requestParams.prompt = {
                    id: instructions.id
                };
                // Si hay version especificada, usarla
                if (instructions.version) {
                    requestParams.prompt.version = instructions.version;
                }
                
                // NO ENVIAR VARIABLES - El prompt no las necesita
                // Comentado temporalmente hasta que se actualice el prompt
                /*
                if (context.promptVariables && Object.keys(context.promptVariables).length > 0) {
                    requestParams.prompt.variables = context.promptVariables;
                }
                */
            }
            
            // Usar previous_response_id para mantener contexto
            if (context.previousResponseId) {
                requestParams.previous_response_id = context.previousResponseId;
                logInfo('STATE_CHAINING', 'Encadenando respuesta previa', {
                    previousId: context.previousResponseId
                });
            }
            
            // IMPORTANTE: Solo incluir tools si hay funciones disponibles
            // NO enviar array vacío - la API espera que si tools existe, tenga elementos válidos
            if (functions && functions.length > 0) {
                // Formatear las funciones al formato correcto de la API
                requestParams.tools = functions.map(fn => ({
                    type: "function",
                    function: {
                        name: fn.name,
                        description: fn.description || '',
                        parameters: fn.parameters || {}
                    }
                }));
                requestParams.tool_choice = 'auto';
                
                logDebug('TOOLS_PARAM', 'Enviando tools', { 
                    count: functions.length,
                    tools: requestParams.tools.map(t => t.function.name)
                });
            }
            // Si no hay functions, NO incluir el parámetro tools en absoluto
            
            // Ajustar parámetros según tipo de modelo (razonador vs estándar)
            const modelToUse = typeof instructions === 'string' ? this.config.model : 'prompt-based';
            if (typeof instructions === 'string') {
                this.adjustParametersForModel(requestParams, modelToUse);
            }
            
            // Log completo del request antes de enviar
            logDebug('FULL_REQUEST', 'Request completo a OpenAI', {
                hasTools: !!requestParams.tools,
                toolsCount: requestParams.tools?.length || 0,
                requestKeys: Object.keys(requestParams),
                promptId: typeof instructions === 'object' ? instructions.id : 'string-prompt'
            });
            
            
            // Llamar a la API
            const response = await this.openai.responses.create(requestParams);
            
            // Procesar la respuesta
            const result = this.processResponse(response, startTime);
            
            logInfo('RESPONSE_API_SUCCESS', 'Respuesta recibida exitosamente', {
                userId: context.userId,
                responseId: result.responseId,
                hasContent: !!result.content,
                hasFunctionCalls: !!result.functionCalls?.length,
                processingTime: result.processingTime
            });
            
            return result;
            
        } catch (error) {
            const processingTime = Date.now() - startTime;
            
            // Log más detallado del error
            console.error('RESPONSE_API_ERROR DETALLE:', error);
            
            logError('RESPONSE_API_ERROR', 'Error al llamar Responses API', {
                userId: context.userId,
                error: error instanceof Error ? error.message : 'Unknown error',
                errorName: error instanceof Error ? error.name : 'Unknown',
                errorStack: error instanceof Error ? error.stack?.split('\n')[0] : 'No stack',
                processingTime
            });
            
            return {
                success: false,
                responseId: '',
                error: error instanceof Error ? error.message : 'Unknown error',
                processingTime
            };
        }
    }
    
    private processResponse(response: any, startTime: number): ResponseResult {
        const processingTime = Date.now() - startTime;
        
        // Log para debug
        logDebug('RESPONSE_STRUCTURE', 'Estructura de respuesta recibida', {
            hasOutput: !!response.output,
            outputLength: response.output?.length || 0,
            firstOutput: response.output?.[0] ? {
                type: response.output[0].type,
                hasContent: !!response.output[0].content,
                contentLength: response.output[0].content?.length || 0
            } : null
        });
        
        // Extraer contenido de texto
        let content = '';
        const functionCalls: FunctionCall[] = [];
        
        if (response.output && Array.isArray(response.output)) {
            for (const output of response.output) {
                if (output.type === 'message' && output.content) {
                    for (const contentItem of output.content) {
                        if (contentItem.type === 'text' || contentItem.type === 'output_text') {
                            content += contentItem.text + '\n';
                        }
                    }
                } else if (output.type === 'function_call') {
                    // Procesar llamadas a funciones
                    functionCalls.push({
                        id: output.call_id,
                        function: {
                            name: output.name,
                            arguments: output.arguments
                        }
                    });
                }
            }
        }
        
        // Calcular uso de tokens
        const usage = response.usage ? {
            inputTokens: response.usage.input_tokens || response.usage.prompt_tokens || 0,
            outputTokens: response.usage.output_tokens || response.usage.completion_tokens || 0,
            totalTokens: response.usage.total_tokens || 0,
            cachedTokens: response.usage.input_tokens_details?.cached_tokens || 0,
            reasoningTokens: response.usage.output_tokens_details?.reasoning_tokens || 0
        } : undefined;
        
        // Log del contenido extraído
        logDebug('EXTRACTED_CONTENT', 'Contenido extraído de la respuesta', {
            contentLength: content.length,
            trimmedLength: content.trim().length,
            first100: content.substring(0, 100),
            functionCallsCount: functionCalls.length
        });
        
        return {
            success: true,
            responseId: response.id,
            content: content.trim(),
            functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
            usage,
            processingTime,
            outputItems: response.output // Guardar todos los items para mantener contexto
        };
    }
    
    async executeFunctionCalls(
        functionCalls: FunctionCall[],
        context: ConversationContext
    ): Promise<Array<{call_id: string, output: any}>> {
        const results: Array<{call_id: string, output: any}> = [];
        
        if (!this.functionRegistry) {
            logWarning('FUNCTION_REGISTRY_MISSING', 'No hay registro de funciones disponible');
            return results;
        }
        
        for (const call of functionCalls) {
            try {
                logInfo('FUNCTION_EXECUTION_START', 'Ejecutando función', {
                    functionName: call.function.name,
                    callId: call.id,
                    userId: context.userId
                });
                
                const fn = this.functionRegistry.getFunction(call.function.name);
                if (fn) {
                    const args = typeof call.function.arguments === 'string' 
                        ? JSON.parse(call.function.arguments) 
                        : call.function.arguments;
                        
                    const result = await fn.handler(args, {
                        userId: context.userId,
                        chatId: context.metadata?.chatId || '',
                        userName: context.metadata?.userName || ''
                    });
                    
                    results.push({
                        call_id: call.id,
                        output: result
                    });
                    
                    logInfo('FUNCTION_EXECUTION_SUCCESS', 'Función ejecutada exitosamente', {
                        functionName: call.function.name,
                        callId: call.id,
                        userId: context.userId
                    });
                } else {
                    logWarning('FUNCTION_NOT_FOUND', 'Función no encontrada', {
                        functionName: call.function.name,
                        userId: context.userId
                    });
                    
                    results.push({
                        call_id: call.id,
                        output: { error: `Function ${call.function.name} not found` }
                    });
                }
            } catch (error) {
                logError('FUNCTION_EXECUTION_ERROR', 'Error ejecutando función', {
                    functionName: call.function.name,
                    callId: call.id,
                    userId: context.userId,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                
                results.push({
                    call_id: call.id,
                    output: { error: error instanceof Error ? error.message : 'Unknown error' }
                });
            }
        }
        
        return results;
    }
    
    /**
     * Detecta si el modelo es de tipo razonador (o1, o3, gpt-5, etc.)
     */
    private isReasoningModel(model: string): boolean {
        const reasoningModels = ['o1', 'o1-mini', 'o1-preview', 'o3', 'o3-mini', 'gpt-5'];
        return reasoningModels.some(m => model.toLowerCase().includes(m.toLowerCase()));
    }
    
    /**
     * Deduplica items en el input basándose en id o call_id
     * para evitar el error "Duplicate item found with id"
     * Maneja function calls, messages, reasoning items y otros tipos
     * CLAVE: Cuando hay function_call_output, NO incluir el function_call original
     */
    private deduplicateInput(input: any[]): any[] {
        const seenIds = new Set<string>();
        const uniqueItems: any[] = [];
        const duplicatesFound: string[] = [];
        const functionOutputCallIds = new Set<string>();
        
        // Primero, identificar todos los call_ids que tienen outputs
        for (const item of input) {
            if (item.type === 'function_call_output' && item.call_id) {
                functionOutputCallIds.add(item.call_id);
            }
        }
        
        for (const item of input) {
            let itemKey: string | null = null;
            
            // Si es un function_call y ya tiene output, NO incluirlo (esto previene duplicados)
            if (item.type === 'function_call' && item.call_id && functionOutputCallIds.has(item.call_id)) {
                logWarning('FUNCTION_CALL_REMOVED', 'Function call removido porque ya tiene output', {
                    id: item.id || item.call_id,
                    call_id: item.call_id,
                    name: item.name
                });
                continue;
            }
            
            // Para reasoning items, usar tanto id como hash del contenido
            if (item.type === 'reasoning') {
                const contentHash = JSON.stringify(item.content || item.summary || '');
                itemKey = item.id ? `${item.id}_${contentHash}` : contentHash;
            }
            // Para function calls y otros items con ID
            else if (item.id || item.call_id) {
                itemKey = item.id || item.call_id;
            }
            // Para messages, usar role + content hash si no tienen ID
            else if (item.type === 'message' && !item.id) {
                const contentStr = JSON.stringify(item.content || '');
                itemKey = `msg_${item.role}_${contentStr}`;
            }
            
            if (itemKey) {
                if (seenIds.has(itemKey)) {
                    duplicatesFound.push(itemKey);
                    logWarning('DUPLICATE_ITEM_REMOVED', 'Item duplicado encontrado y removido', {
                        id: itemKey,
                        type: item.type,
                        role: item.role
                    });
                    continue; // Skip duplicate
                }
                seenIds.add(itemKey);
            }
            
            // Incluir items únicos o sin ID
            uniqueItems.push(item);
        }
        
        // Log resumen si se removieron duplicados o function calls con outputs
        if (duplicatesFound.length > 0 || functionOutputCallIds.size > 0) {
            logInfo('INPUT_DEDUPLICATED', 'Input deduplicado exitosamente', {
                originalCount: input.length,
                uniqueCount: uniqueItems.length,
                duplicatesRemoved: duplicatesFound.length,
                functionCallsWithOutputsRemoved: functionOutputCallIds.size,
                duplicateIds: duplicatesFound
            });
        }
        
        return uniqueItems;
    }
    
    /**
     * Ajusta parámetros según el tipo de modelo para evitar truncamiento
     */
    private adjustParametersForModel(params: any, model: string): any {
        const isReasoning = this.isReasoningModel(model);
        
        // Para modelos razonadores
        if (isReasoning) {
            // NO enviar temperature a modelos razonadores
            delete params.temperature;
            
            // Aumentar límites para modelos razonadores
            params.max_output_tokens = Math.max(params.max_output_tokens || 4096, 8192);
            
            // Configurar truncation para contextos más largos
            params.truncation = {
                type: 'auto',
                max_tokens: 120000 // Contexto más amplio para reasoning
            };
            
            logDebug('REASONING_MODEL_CONFIG', 'Configuración para modelo razonador', {
                model,
                maxOutputTokens: params.max_output_tokens,
                truncationMaxTokens: params.truncation.max_tokens
            });
        }
        // Para modelos no razonadores
        else {
            // Mantener temperature si está configurada
            if (this.config.temperature !== undefined) {
                params.temperature = this.config.temperature;
            }
            
            // Límites estándar
            params.max_output_tokens = params.max_output_tokens || this.config.maxOutputTokens;
            
            // Configurar truncation para contextos estándar
            params.truncation = {
                type: 'auto',
                max_tokens: 32000 // Contexto estándar
            };
            
            logDebug('STANDARD_MODEL_CONFIG', 'Configuración para modelo estándar', {
                model,
                temperature: params.temperature,
                maxOutputTokens: params.max_output_tokens,
                truncationMaxTokens: params.truncation.max_tokens
            });
        }
        
        return params;
    }
    
    /**
     * Filtra items según el tipo de modelo para evitar truncamiento
     */
    private filterItemsForModel(items: any[], model: string): any[] {
        const isReasoning = this.isReasoningModel(model);
        
        if (isReasoning) {
            // Para modelos razonadores: MANTENER todos los items, especialmente reasoning
            logDebug('REASONING_MODEL_FILTER', 'Manteniendo todos los items para modelo razonador', {
                model,
                totalItems: items.length,
                reasoningItems: items.filter(i => i.type === 'reasoning').length
            });
            return items;
        } else {
            // Para modelos no razonadores: filtrar reasoning items si existen
            const filteredItems = items.filter(item => item.type !== 'reasoning');
            
            if (filteredItems.length < items.length) {
                logDebug('STANDARD_MODEL_FILTER', 'Filtrando reasoning items para modelo estándar', {
                    model,
                    originalItems: items.length,
                    filteredItems: filteredItems.length,
                    reasoningItemsRemoved: items.length - filteredItems.length
                });
            }
            
            return filteredItems;
        }
    }
    
    // Métodos de conversación eliminados - la API no tiene conversations.create()
    // El estado se mantiene con store: true y previous_response_id
}