// src/core/services/openai-responses.service.ts
import { IOpenAIService, IFunctionRegistry } from '../../shared/interfaces';
import { FunctionCall } from '../../shared/types';
import { TerminalLog } from '../utils/terminal-log';
import { CacheManager } from '../state/cache-manager';
import { logInfo, logSuccess, logError, logWarning } from '../../utils/logging';
import { logOpenAIPromptSent, logTokenUsage, logMessageFlowComplete } from '../../utils/logging/integrations';
import { DatabaseService } from './database.service';
import { ResponseService, ConversationContext } from './response.service';
import { ConversationManager } from './conversation-manager';
import { PromptVariablesService } from './prompt-variables.service';

export interface OpenAIResponsesServiceConfig {
    apiKey: string;
    assistantId: string; // Mantenido por compatibilidad
    model?: string;
    maxOutputTokens?: number;
    temperature?: number;
}

export interface ProcessingResult {
    success: boolean;
    response?: string;
    error?: string;
    functionCalls?: FunctionCall[];
    processingTime: number;
    tokensUsed?: number;
    threadId?: string; // Ahora será el response_id
    runId?: string; // Ya no se usa con Responses API
    threadTokenCount?: number;
}

export class OpenAIResponsesService implements IOpenAIService {
    private responseService: ResponseService;
    private conversationManager: ConversationManager;
    private promptVariablesService: PromptVariablesService;
    private config: OpenAIResponsesServiceConfig;
    private log: TerminalLog;
    private cache?: CacheManager;
    private functionRegistry?: IFunctionRegistry;
    private whatsappService?: any;
    private databaseService?: DatabaseService;
    private userManager?: any;
    private static activeOpenAICalls: number = 0;
    private static readonly MAX_CONCURRENT_CALLS = 75;
    
    // Instrucciones del sistema o prompt ID
    private systemInstructions: string | { id: string; version?: string } = '';
    private usePromptId: boolean = false;

    constructor(
        config: OpenAIResponsesServiceConfig,
        terminalLog: TerminalLog,
        cacheManager?: CacheManager,
        functionRegistry?: IFunctionRegistry,
        whatsappService?: any,
        databaseService?: DatabaseService,
        userManager?: any
    ) {
        this.config = config;
        this.log = terminalLog;
        this.cache = cacheManager;
        this.functionRegistry = functionRegistry;
        this.whatsappService = whatsappService;
        this.databaseService = databaseService;
        this.userManager = userManager;
        
        // Inicializar servicios
        this.responseService = new ResponseService(
            {
                apiKey: config.apiKey,
                model: config.model || 'gpt-5',
                maxOutputTokens: config.maxOutputTokens || 4096,
                temperature: config.temperature || 0.7
            },
            functionRegistry
        );
        
        this.conversationManager = new ConversationManager(databaseService);
        this.promptVariablesService = new PromptVariablesService(databaseService);
        
        // Configurar prompt ID o instrucciones
        if (process.env.OPENAI_PROMPT_ID) {
            // Usar prompt ID del dashboard
            this.systemInstructions = {
                id: process.env.OPENAI_PROMPT_ID,
                version: process.env.OPENAI_PROMPT_VERSION || '1'
            };
            this.usePromptId = true;
            logInfo('PROMPT_CONFIG', 'Usando prompt ID del dashboard', {
                promptId: process.env.OPENAI_PROMPT_ID,
                version: process.env.OPENAI_PROMPT_VERSION || '1'
            });
        } else {
            // Usar instrucciones del sistema inline
            this.systemInstructions = process.env.SYSTEM_INSTRUCTIONS || this.getDefaultInstructions();
            this.usePromptId = false;
            logInfo('PROMPT_CONFIG', 'Usando instrucciones inline');
        }
    }
    
    private getDefaultInstructions(): string {
        return `Eres un asistente de reservas hoteleras para TeAlquilamos. 
Tu objetivo es ayudar a los clientes con sus reservas, consultas y solicitudes.
Sé amable, profesional y eficiente. Responde en español a menos que el cliente escriba en otro idioma.
Cuando uses funciones, asegúrate de proporcionar respuestas claras basadas en los resultados.`;
    }

    async processMessage(
        userId: string, 
        message: string, 
        chatId: string, 
        userName: string, 
        existingThreadId?: string, 
        existingTokenCount?: number, 
        imageMessage?: { type: 'image', imageUrl: string, caption: string }, 
        duringRunMsgId?: string, 
        assistantId?: string
    ): Promise<ProcessingResult> {
        const startTime = Date.now();
        
        // Control de concurrencia
        if (OpenAIResponsesService.activeOpenAICalls >= OpenAIResponsesService.MAX_CONCURRENT_CALLS) {
            logWarning('OPENAI_RATE_LIMIT', 'Límite de llamadas concurrentes alcanzado', {
                userId,
                activeCalls: OpenAIResponsesService.activeOpenAICalls,
                maxCalls: OpenAIResponsesService.MAX_CONCURRENT_CALLS
            });
            
            return {
                success: false,
                error: 'Sistema temporalmente ocupado. Por favor intenta de nuevo en unos segundos.',
                processingTime: Date.now() - startTime
            };
        }
        
        OpenAIResponsesService.activeOpenAICalls++;
        
        try {
            // Ya no necesitamos procesar la imagen por separado
            // GPT-5 puede manejar imágenes directamente
            
            // Obtener contexto de conversación
            const context = await this.conversationManager.getConversationContext(userId, chatId);
            
            // Extraer variables para el prompt si estamos usando prompt ID
            let promptVariables: Record<string, string> | undefined;
            if (this.usePromptId) {
                promptVariables = await this.promptVariablesService.extractVariables(
                    userId,
                    chatId,
                    message,
                    {
                        userName,
                        ...context.metadata
                    }
                );
            }
            
            // Obtener o crear conversación con Conversations API
            let conversationId = context.conversationId;
            if (!conversationId && process.env.USE_CONVERSATIONS_API === 'true') {
                conversationId = await this.responseService.getOrCreateConversation(userId, chatId);
            }
            
            // Construir contexto completo
            const conversationContext: ConversationContext = {
                userId,
                conversationId, // Preferir Conversations API
                previousResponseId: context.previousResponseId, // Fallback
                messageHistory: context.messageHistory,
                metadata: {
                    chatId,
                    userName,
                    ...context.metadata
                },
                promptVariables
            };
            
            // Guardar mensaje del usuario
            await this.conversationManager.addMessage(userId, chatId, 'user', message);
            
            // Obtener funciones disponibles
            const functions = this.getFunctionsForRequest();
            
            // Log del prompt enviado
            logOpenAIPromptSent(
                userId,
                conversationId || context.previousResponseId || 'new',
                message,
                message.length
            );
            
            // Llamar a Responses API
            const result = await this.responseService.createResponse(
                this.systemInstructions,
                message,
                conversationContext,
                functions,
                imageMessage // Pasar la imagen si existe
            );
            
            if (!result.success) {
                throw new Error(result.error || 'Error desconocido en Responses API');
            }
            
            // Procesar function calls si existen
            let finalResponse = result.content || '';
            if (result.functionCalls && result.functionCalls.length > 0) {
                const functionResults = await this.responseService.executeFunctionCalls(
                    result.functionCalls,
                    conversationContext
                );
                
                // Crear mensaje con resultados de funciones
                const functionResultsMessage = this.formatFunctionResults(functionResults);
                
                // Hacer una segunda llamada con los resultados
                const followUpResult = await this.responseService.createResponse(
                    this.systemInstructions,
                    functionResultsMessage,
                    {
                        ...conversationContext,
                        previousResponseId: result.responseId
                    },
                    [] // No enviar funciones en el follow-up
                );
                
                if (followUpResult.success && followUpResult.content) {
                    finalResponse = followUpResult.content;
                }
            }
            
            // Actualizar conversación
            await this.conversationManager.updateConversation(
                userId,
                chatId,
                result.responseId,
                result.usage?.totalTokens || 0
            );
            
            // Guardar respuesta del asistente
            await this.conversationManager.addMessage(
                userId,
                chatId,
                'assistant',
                finalResponse,
                result.responseId
            );
            
            // Log de uso de tokens
            if (result.usage) {
                logTokenUsage(
                    userId,
                    conversationId || 'no-conversation',
                    result.usage.inputTokens,
                    result.usage.outputTokens,
                    'gpt-5'
                );
            }
            
            // Log de flujo completo
            logMessageFlowComplete(
                userId,
                message.length,
                finalResponse.length,
                Date.now() - startTime,
                result.usage?.totalTokens || 0,
                result.functionCalls?.length || 0
            );
            
            return {
                success: true,
                response: finalResponse,
                functionCalls: result.functionCalls,
                processingTime: Date.now() - startTime,
                tokensUsed: result.usage?.totalTokens,
                threadId: result.responseId, // Para compatibilidad
                threadTokenCount: (await this.conversationManager.getOrCreateConversation(userId, chatId)).tokenCount
            };
            
        } catch (error) {
            logError('PROCESS_MESSAGE_ERROR', 'Error procesando mensaje', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
                processingTime: Date.now() - startTime
            });
            
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Error procesando mensaje',
                processingTime: Date.now() - startTime
            };
        } finally {
            OpenAIResponsesService.activeOpenAICalls = Math.max(0, OpenAIResponsesService.activeOpenAICalls - 1);
        }
    }
    
    private getFunctionsForRequest(): any[] {
        if (!this.functionRegistry) return [];
        
        const functions = this.functionRegistry.getAllFunctions();
        
        // Convertir al formato de Responses API
        return functions.map(fn => ({
            name: fn.name,
            description: fn.description,
            parameters: fn.parameters
        }));
    }
    
    private formatFunctionResults(results: Record<string, any>): string {
        const lines = ['Resultados de las funciones ejecutadas:'];
        
        for (const [functionId, result] of Object.entries(results)) {
            if (result.error) {
                lines.push(`- ${functionId}: Error - ${result.error}`);
            } else {
                lines.push(`- ${functionId}: ${JSON.stringify(result)}`);
            }
        }
        
        return lines.join('\n');
    }
    
    // Métodos de compatibilidad para mantener la interfaz existente
    
    async getThreadMessages(threadId: string): Promise<any[]> {
        // En Responses API no hay threads persistentes
        // Este método podría devolver el historial desde ConversationManager
        logWarning('DEPRECATED_METHOD', 'getThreadMessages no es compatible con Responses API');
        return [];
    }
    
    async createThread(): Promise<string> {
        // En Responses API no se crean threads explícitamente
        // Devolvemos un ID único para compatibilidad
        const fakeThreadId = `resp_thread_${Date.now()}`;
        logWarning('DEPRECATED_METHOD', 'createThread no es necesario con Responses API');
        return fakeThreadId;
    }
    
    async deleteThread(threadId: string): Promise<void> {
        // En Responses API, esto sería resetear la conversación
        logWarning('DEPRECATED_METHOD', 'deleteThread reemplazado por reset de conversación');
        // No hacemos nada por ahora
    }
    
    // Método para limpiar conversaciones inactivas (ejecutar periódicamente)
    async cleanupInactiveConversations(): Promise<void> {
        await this.conversationManager.cleanupInactiveConversations(24); // 24 horas
    }
    
    // Método para actualizar las instrucciones del sistema
    updateSystemInstructions(instructions: string | { id: string; version?: string }): void {
        this.systemInstructions = instructions;
        this.usePromptId = typeof instructions === 'object';
        logInfo('SYSTEM_INSTRUCTIONS_UPDATED', 'Instrucciones del sistema actualizadas', {
            usePromptId: this.usePromptId
        });
    }
    
    // Método para resetear una conversación específica
    async resetConversation(userId: string, chatId: string): Promise<void> {
        await this.conversationManager.resetConversation(userId, chatId);
    }
    
    // Implementar método requerido por la interfaz
    async processWithOpenAI(userId: string, combinedText: string, chatId: string, userName: string): Promise<void> {
        await this.processMessage(userId, combinedText, chatId, userName);
    }
}