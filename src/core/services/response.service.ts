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
}

export class ResponseService {
    private openai: OpenAI;
    private config: Required<ResponseServiceConfig>;
    private functionRegistry?: IFunctionRegistry;
    private conversationsCache: Map<string, string> = new Map(); // userId:chatId -> conversationId
    
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
        imageMessage?: { type: 'image', imageUrl: string, caption: string }
    ): Promise<ResponseResult> {
        const startTime = Date.now();
        
        try {
            logInfo('RESPONSE_API_START', 'Iniciando llamada a Responses API', {
                userId: context.userId,
                hasPreviousResponse: !!context.previousResponseId,
                functionsCount: functions?.length || 0
            });
            
            // Construir el input
            const input: any[] = [];
            
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
            
            // Agregar mensaje actual con contenido mixto
            input.push({
                type: 'message',
                role: 'user',
                content: messageContent
            });
            
            // Preparar parámetros de la llamada
            // Preparar parámetros base
            const requestParams: any = {
                input: input,
                max_output_tokens: this.config.maxOutputTokens,
                store: true, // Almacenar para poder referenciar después
            };
            
            // Solo agregar model si no usamos prompt ID
            if (typeof instructions === 'string') {
                requestParams.model = this.config.model;
                // Temperature solo para modelos que la soportan
                const noTempModels = ['o1', 'o3', 'gpt-5'];
                const isNoTempModel = noTempModels.some(m => 
                    this.config.model.toLowerCase().includes(m)
                );
                
                if (!isNoTempModel) {
                    requestParams.temperature = this.config.temperature;
                }
            }
            // Si usamos prompt ID, el modelo viene del prompt
            
            // Configurar instrucciones o prompt
            if (typeof instructions === 'string') {
                requestParams.instructions = instructions;
            } else {
                // Usar prompt ID del dashboard
                requestParams.prompt = {
                    id: instructions.id,
                    version: instructions.version || '1'
                };
                
                // Agregar variables si existen
                if (context.promptVariables && Object.keys(context.promptVariables).length > 0) {
                    requestParams.prompt.variables = context.promptVariables;
                }
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
                // Mapear al formato correcto de la API
                requestParams.tools = functions.map(fn => ({
                    name: fn.name || fn.function?.name,
                    description: fn.description || fn.function?.description || '',
                    parameters: fn.parameters || fn.function?.parameters || {}
                }));
                requestParams.tool_choice = 'auto';
                
                logDebug('TOOLS_PARAM', 'Enviando tools', { 
                    count: functions.length,
                    tools: requestParams.tools.map(t => t.name)
                });
            }
            // Si no hay functions, NO incluir el parámetro tools en absoluto
            
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
            logError('RESPONSE_API_ERROR', 'Error al llamar Responses API', {
                userId: context.userId,
                error: error instanceof Error ? error.message : 'Unknown error',
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
        
        // Extraer contenido de texto
        let content = '';
        const functionCalls: FunctionCall[] = [];
        
        if (response.output && Array.isArray(response.output)) {
            for (const output of response.output) {
                if (output.type === 'message' && output.content) {
                    for (const contentItem of output.content) {
                        if (contentItem.type === 'output_text') {
                            content += contentItem.text + '\n';
                        }
                    }
                } else if (output.type === 'tool_call') {
                    // Procesar llamadas a funciones
                    functionCalls.push({
                        id: output.id,
                        function: {
                            name: output.function.name,
                            arguments: output.function.arguments
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
        
        return {
            success: true,
            responseId: response.id,
            content: content.trim(),
            functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
            usage,
            processingTime
        };
    }
    
    async executeFunctionCalls(
        functionCalls: FunctionCall[],
        context: ConversationContext
    ): Promise<Record<string, any>> {
        const results: Record<string, any> = {};
        
        if (!this.functionRegistry) {
            logWarning('FUNCTION_REGISTRY_MISSING', 'No hay registro de funciones disponible');
            return results;
        }
        
        for (const call of functionCalls) {
            try {
                logInfo('FUNCTION_EXECUTION_START', 'Ejecutando función', {
                    functionName: call.function.name,
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
                    
                    results[call.id || call.function.name] = result;
                    
                    logInfo('FUNCTION_EXECUTION_SUCCESS', 'Función ejecutada exitosamente', {
                        functionName: call.function.name,
                        userId: context.userId
                    });
                } else {
                    logWarning('FUNCTION_NOT_FOUND', 'Función no encontrada', {
                        functionName: call.function.name,
                        userId: context.userId
                    });
                }
            } catch (error) {
                logError('FUNCTION_EXECUTION_ERROR', 'Error ejecutando función', {
                    functionName: call.function.name,
                    userId: context.userId,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                
                results[call.id || call.function.name] = {
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        }
        
        return results;
    }
    
    // Métodos de conversación eliminados - la API no tiene conversations.create()
    // El estado se mantiene con store: true y previous_response_id
}