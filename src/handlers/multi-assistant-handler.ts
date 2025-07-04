import { OpenAI } from 'openai';
import { enhancedLog } from '../utils/core/index.js';

interface AssistantConfig {
    id: string;
    name: string;
    role: 'classifier' | 'specialist' | 'formatter';
    specialization?: string;
}

interface AssistantChainResult {
    content: string;
    metadata: {
        assistantUsed: string;
        processingTime: number;
        tokenUsage?: number;
        classification?: string;
    };
}

export class MultiAssistantHandler {
    private openai: OpenAI;
    private assistants: Map<string, AssistantConfig> = new Map();
    private userThreads: Map<string, Map<string, string>> = new Map(); // userId -> assistantId -> threadId

    constructor(apiKey: string) {
        this.openai = new OpenAI({ apiKey });
        this.initializeAssistants();
    }

    private initializeAssistants() {
        // 🔍 Assistant Clasificador - Analiza y enruta
        this.assistants.set('classifier', {
            id: process.env.ASSISTANT_CLASSIFIER_ID || '',
            name: 'Classifier',
            role: 'classifier'
        });

        // 💰 Assistant Especialista en Precios
        this.assistants.set('pricing', {
            id: process.env.ASSISTANT_PRICING_ID || '',
            name: 'Pricing Specialist',
            role: 'specialist',
            specialization: 'pricing'
        });

        // 📅 Assistant Especialista en Disponibilidad
        this.assistants.set('availability', {
            id: process.env.ASSISTANT_AVAILABILITY_ID || '',
            name: 'Availability Specialist',
            role: 'specialist',
            specialization: 'availability'
        });

        // 🤖 Assistant General (tu actual)
        this.assistants.set('general', {
            id: process.env.ASSISTANT_ID || '',
            name: 'General Assistant',
            role: 'specialist',
            specialization: 'general'
        });

        // ✨ Assistant Formateador - Humaniza respuestas
        this.assistants.set('formatter', {
            id: process.env.ASSISTANT_FORMATTER_ID || '',
            name: 'Response Formatter',
            role: 'formatter'
        });
    }

    /**
     * Procesa un mensaje a través de la cadena de asistentes
     */
    async processMessageChain(userId: string, message: string): Promise<AssistantChainResult> {
        const startTime = Date.now();
        
        try {
            // 🔍 PASO 1: Clasificación y enrutamiento
            const classification = await this.classifyMessage(userId, message);
            
            enhancedLog('info', 'MULTI_ASSISTANT', `Mensaje clasificado como: ${classification.category}`, 
                { userId, category: classification.category }, userId);

            // 📊 PASO 2: Procesamiento especializado
            const specialistResult = await this.processWithSpecialist(
                userId, 
                message, 
                classification.category,
                classification.extractedData
            );

            // ✨ PASO 3: Formateo final (opcional)
            const formattedResult = await this.formatResponse(
                userId,
                specialistResult.content,
                classification.category
            );

            const processingTime = Date.now() - startTime;

            return {
                content: formattedResult.content,
                metadata: {
                    assistantUsed: `${classification.category} -> formatter`,
                    processingTime,
                    classification: classification.category,
                    tokenUsage: specialistResult.metadata.tokenUsage + formattedResult.metadata.tokenUsage
                }
            };

        } catch (error) {
            enhancedLog('error', 'MULTI_ASSISTANT_ERROR', 'Error en cadena de asistentes', { error: error.message }, userId);
            
            // Fallback al assistant general
            return await this.processWithSingleAssistant(userId, message, 'general');
        }
    }

    /**
     * Clasifica el mensaje y extrae datos estructurados
     */
    private async classifyMessage(userId: string, message: string): Promise<{
        category: string;
        confidence: number;
        extractedData: any;
    }> {
        const threadId = await this.getOrCreateThread(userId, 'classifier');
        
        const classificationPrompt = `
        Analiza este mensaje de un cliente de hotel y clasifícalo:
        
        MENSAJE: "${message}"
        
        Responde SOLO con este JSON:
        {
            "category": "pricing|availability|support|booking|general",
            "confidence": 0.8,
            "extractedData": {
                "dates": ["YYYY-MM-DD", "YYYY-MM-DD"],
                "guests": 2,
                "apartmentCode": "1722A",
                "intent": "descripción_breve"
            }
        }
        `;

        await this.openai.beta.threads.messages.create(threadId, {
            role: 'user',
            content: classificationPrompt
        });

        const run = await this.openai.beta.threads.runs.create(threadId, {
            assistant_id: this.assistants.get('classifier')!.id
        });

        const result = await this.waitForCompletion(threadId, run.id);
        
        try {
            return JSON.parse(result);
        } catch {
            // Fallback si el JSON es inválido
            return {
                category: 'general',
                confidence: 0.5,
                extractedData: {}
            };
        }
    }

    /**
     * Procesa con el especialista correspondiente
     */
    private async processWithSpecialist(
        userId: string, 
        message: string, 
        category: string,
        extractedData: any
    ): Promise<AssistantChainResult> {
        const assistantKey = category === 'pricing' ? 'pricing' : 
                           category === 'availability' ? 'availability' : 'general';
        
        const assistant = this.assistants.get(assistantKey);
        if (!assistant) {
            throw new Error(`Assistant no encontrado: ${assistantKey}`);
        }

        const threadId = await this.getOrCreateThread(userId, assistantKey);
        
        // Enriquecer mensaje con datos extraídos
        const enrichedMessage = this.enrichMessageWithData(message, extractedData);
        
        await this.openai.beta.threads.messages.create(threadId, {
            role: 'user',
            content: enrichedMessage
        });

        const run = await this.openai.beta.threads.runs.create(threadId, {
            assistant_id: assistant.id
        });

        const response = await this.waitForCompletion(threadId, run.id);

        return {
            content: response,
            metadata: {
                assistantUsed: assistantKey,
                processingTime: 0, // Se calcula en el nivel superior
                tokenUsage: 0 // TODO: Implementar conteo real
            }
        };
    }

    /**
     * Formatea la respuesta final para humanizarla
     */
    private async formatResponse(
        userId: string,
        content: string,
        category: string
    ): Promise<AssistantChainResult> {
        const formatter = this.assistants.get('formatter');
        if (!formatter?.id) {
            // Si no hay formatter, devolver contenido sin formatear
            return {
                content,
                metadata: {
                    assistantUsed: 'none',
                    processingTime: 0,
                    tokenUsage: 0
                }
            };
        }

        const threadId = await this.getOrCreateThread(userId, 'formatter');
        
        const formatPrompt = `
        Humaniza esta respuesta técnica manteniendo toda la información:
        
        CATEGORÍA: ${category}
        RESPUESTA: ${content}
        
        Aplica el tono de marca TeAlquilamos: amable, profesional, entusiasta.
        Usa emojis apropiados. Mantén estructura clara.
        `;

        await this.openai.beta.threads.messages.create(threadId, {
            role: 'user',
            content: formatPrompt
        });

        const run = await this.openai.beta.threads.runs.create(threadId, {
            assistant_id: formatter.id
        });

        const formattedContent = await this.waitForCompletion(threadId, run.id);

        return {
            content: formattedContent,
            metadata: {
                assistantUsed: 'formatter',
                processingTime: 0,
                tokenUsage: 0
            }
        };
    }

    /**
     * Fallback: procesar con un solo assistant
     */
    private async processWithSingleAssistant(
        userId: string, 
        message: string, 
        assistantKey: string
    ): Promise<AssistantChainResult> {
        const assistant = this.assistants.get(assistantKey);
        if (!assistant) {
            throw new Error(`Assistant no encontrado: ${assistantKey}`);
        }

        const threadId = await this.getOrCreateThread(userId, assistantKey);
        
        await this.openai.beta.threads.messages.create(threadId, {
            role: 'user',
            content: message
        });

        const run = await this.openai.beta.threads.runs.create(threadId, {
            assistant_id: assistant.id
        });

        const response = await this.waitForCompletion(threadId, run.id);

        return {
            content: response,
            metadata: {
                assistantUsed: assistantKey,
                processingTime: Date.now(),
                tokenUsage: 0
            }
        };
    }

    /**
     * Obtiene o crea un thread específico para un usuario y assistant
     */
    private async getOrCreateThread(userId: string, assistantKey: string): Promise<string> {
        if (!this.userThreads.has(userId)) {
            this.userThreads.set(userId, new Map());
        }

        const userAssistantThreads = this.userThreads.get(userId)!;
        let threadId = userAssistantThreads.get(assistantKey);

        if (!threadId) {
            const thread = await this.openai.beta.threads.create();
            threadId = thread.id;
            userAssistantThreads.set(assistantKey, threadId);
            
            enhancedLog('info', 'THREAD_CREATED', `Nuevo thread creado para ${assistantKey}`, 
                { userId, assistantKey, threadId }, userId);
        }

        return threadId;
    }

    /**
     * Espera a que un run se complete y devuelve la respuesta
     */
    private async waitForCompletion(threadId: string, runId: string): Promise<string> {
        let run = await this.openai.beta.threads.runs.retrieve(threadId, runId);
        
        while (['queued', 'in_progress'].includes(run.status)) {
            await new Promise(resolve => setTimeout(resolve, 500));
            run = await this.openai.beta.threads.runs.retrieve(threadId, runId);
        }

        if (run.status !== 'completed') {
            throw new Error(`Run failed with status: ${run.status}`);
        }

        const messages = await this.openai.beta.threads.messages.list(threadId);
        const assistantMessage = messages.data.find(m => m.role === 'assistant');
        
        if (!assistantMessage?.content[0]) {
            throw new Error('No response from assistant');
        }

        const responseContent = assistantMessage.content[0];
        if ('text' in responseContent) {
            return responseContent.text.value;
        } else {
            throw new Error('Received non-text response from assistant');
        }
    }

    /**
     * Enriquece el mensaje con datos extraídos
     */
    private enrichMessageWithData(message: string, extractedData: any): string {
        if (!extractedData || Object.keys(extractedData).length === 0) {
            return message;
        }

        return `
MENSAJE ORIGINAL: ${message}

DATOS EXTRAÍDOS:
${JSON.stringify(extractedData, null, 2)}

Procesa considerando estos datos estructurados.
        `.trim();
    }
} 