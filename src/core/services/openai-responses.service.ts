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
import { MediaService } from './media.service';


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
    responseId?: string; // ID de la respuesta
    conversationId?: string; // ID de la conversación (si usa Conversations API)
    tokenCount?: number;
}

export class OpenAIResponsesService implements IOpenAIService {
    private responseService: ResponseService;
    private conversationManager: ConversationManager;
    private promptVariablesService: PromptVariablesService;
    private mediaService?: MediaService;
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
        userManager?: any,
        mediaService?: MediaService
    ) {
        this.config = config;
        this.log = terminalLog;
        this.cache = cacheManager;
        this.functionRegistry = functionRegistry;
        this.whatsappService = whatsappService;
        this.databaseService = databaseService;
        this.userManager = userManager;
        this.mediaService = mediaService;
        
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
        if (process.env.OPENAI_PROMPT_ID && process.env.USE_PROMPT_ID !== 'false') {
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
        return `Eres un asistente virtual para TeAlquilamos, una empresa de alquiler de apartamentos turísticos en Colombia.

INFORMACIÓN DE LA EMPRESA:
- Apartamentos disponibles: 201, 202, 203, 204
- Precio base por noche: $150.000 COP
- Cargo adicional por persona extra: $70.000 COP
- Capacidad estándar: 4 personas por apartamento

TU FUNCIÓN:
- Ayudar con consultas sobre disponibilidad
- Proporcionar información de precios
- Asistir en el proceso de reserva
- Responder preguntas generales sobre los apartamentos

INSTRUCCIONES:
1. Responde siempre en español de manera amigable y profesional
2. Cuando no tengas información específica, usa las funciones disponibles
3. Confirma siempre los datos importantes (fechas, número de personas, etc.)
4. Si el cliente pide disponibilidad, primero pregunta las fechas exactas y número de personas
5. Menciona los cargos adicionales cuando sean relevantes

Tienes acceso a funciones para consultar disponibilidad, crear reservas y obtener información actualizada.`;
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
            // Obtener contexto de conversación
            const context = await this.conversationManager.getConversationContext(userId, chatId);
            
            // Obtener información del usuario desde el cache o base de datos
            let userLabels: string[] = [];
            try {
                const cache = this.databaseService?.getClientCache();
                const cachedData = cache?.get(userId);
                if (cachedData?.labels) {
                    userLabels = Array.isArray(cachedData.labels) ? cachedData.labels : [];
                } else {
                    // Fallback: obtener de la BD
                    const thread = await this.databaseService?.getThread(userId);
                    userLabels = thread?.labels || [];
                }
            } catch (error) {
                logWarning('GET_USER_LABELS_ERROR', 'Error obteniendo etiquetas del usuario', { userId });
                userLabels = [];
            }
            
            // Extraer las 3 variables del prompt
            let promptVariables: Record<string, string> | undefined;
            if (this.usePromptId) {
                promptVariables = await this.promptVariablesService.extractVariables(
                    userId,
                    chatId,
                    message,
                    {
                        userName,
                        labels: userLabels,
                        ...context.metadata
                    }
                );
                logInfo('PROMPT_VARIABLES', 'Variables para el prompt', {
                    count: Object.keys(promptVariables).length,
                    variables: promptVariables
                });
            }
            
            // Siempre usar Conversations API (hardcoded)
            let conversationId = context.conversationId;
            if (!conversationId) {
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
            
            // Usar mensaje original cuando tenemos variables (el contexto va en las variables)
            const enrichedMessage = message;
            
            // Guardar mensaje del usuario
            await this.conversationManager.addMessage(userId, chatId, 'user', enrichedMessage);
            
            // Obtener funciones disponibles (solo si están habilitadas)
            const functions = this.shouldIncludeFunctions() ? this.getFunctionsForRequest() : [];
            
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
                enrichedMessage, // Usar mensaje enriquecido
                conversationContext,
                functions,
                imageMessage // Pasar imagen directamente a GPT-5
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
                responseId: result.responseId,
                conversationId: conversationId,
                tokenCount: (await this.conversationManager.getOrCreateConversation(userId, chatId)).tokenCount
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
    
    private shouldIncludeFunctions(): boolean {
        // Por defecto NO incluir functions a menos que:
        // 1. Esté explícitamente habilitado en el env
        // 2. O el mensaje contenga palabras clave que sugieran necesidad de functions
        
        const enableFunctions = process.env.ENABLE_OPENAI_FUNCTIONS === 'true';
        
        // Por ahora, solo enviar si está explícitamente habilitado
        return enableFunctions;
    }
    
    private getFunctionsForRequest(): any[] {
        if (!this.functionRegistry) return [];
        
        const functions = this.functionRegistry.getAllFunctions();
        
        // Convertir al formato correcto de tools para Responses API
        return functions.map(fn => ({
            type: "function",
            function: {
                name: fn.name,
                description: fn.description,
                parameters: fn.parameters
            }
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
    
    // Métodos eliminados - usar ConversationManager en su lugar
    // - getThreadMessages() -> conversationManager.getMessageHistory()
    // - createThread() -> conversationManager.getOrCreateConversation()  
    // - deleteThread() -> conversationManager.resetConversation()
    
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