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
    previousResponseId?: string;
    messageHistory?: Array<{
        role: 'user' | 'assistant';
        content: string;
        timestamp: number;
    }>;
    metadata?: Record<string, any>;
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
    
    constructor(
        config: ResponseServiceConfig,
        functionRegistry?: IFunctionRegistry
    ) {
        this.config = {
            apiKey: config.apiKey,
            model: config.model || 'gpt-4o',
            maxOutputTokens: config.maxOutputTokens || 4096,
            temperature: config.temperature || 0.7
        };
        
        this.openai = new OpenAI({ apiKey: this.config.apiKey });
        this.functionRegistry = functionRegistry;
    }
    
    async createResponse(
        instructions: string,
        userMessage: string,
        context: ConversationContext,
        functions?: any[]
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
            
            // Agregar mensaje actual
            input.push({
                type: 'message',
                role: 'user',
                content: [{
                    type: 'input_text',
                    text: userMessage
                }]
            });
            
            // Preparar parámetros de la llamada
            const requestParams: any = {
                model: this.config.model,
                instructions: instructions,
                input: input,
                max_output_tokens: this.config.maxOutputTokens,
                temperature: this.config.temperature,
                store: true, // Almacenar para poder referenciar después
            };
            
            // Agregar previous_response_id si existe
            if (context.previousResponseId) {
                requestParams.previous_response_id = context.previousResponseId;
            }
            
            // Agregar funciones si existen
            if (functions && functions.length > 0) {
                requestParams.tools = functions.map(fn => ({
                    type: 'function',
                    function: fn
                }));
                requestParams.tool_choice = 'auto';
            }
            
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
                        name: output.function.name,
                        arguments: output.function.arguments,
                        id: output.id
                    });
                }
            }
        }
        
        // Calcular uso de tokens
        const usage = response.usage ? {
            inputTokens: response.usage.input_tokens || 0,
            outputTokens: response.usage.output_tokens || 0,
            totalTokens: response.usage.total_tokens || 0
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
                    functionName: call.name,
                    userId: context.userId
                });
                
                const fn = this.functionRegistry.getFunction(call.name);
                if (fn) {
                    const args = typeof call.arguments === 'string' 
                        ? JSON.parse(call.arguments) 
                        : call.arguments;
                        
                    const result = await fn.handler(args, {
                        userId: context.userId,
                        chatId: context.metadata?.chatId || '',
                        userName: context.metadata?.userName || ''
                    });
                    
                    results[call.id || call.name] = result;
                    
                    logInfo('FUNCTION_EXECUTION_SUCCESS', 'Función ejecutada exitosamente', {
                        functionName: call.name,
                        userId: context.userId
                    });
                } else {
                    logWarning('FUNCTION_NOT_FOUND', 'Función no encontrada', {
                        functionName: call.name,
                        userId: context.userId
                    });
                }
            } catch (error) {
                logError('FUNCTION_EXECUTION_ERROR', 'Error ejecutando función', {
                    functionName: call.name,
                    userId: context.userId,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                
                results[call.id || call.name] = {
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        }
        
        return results;
    }
}