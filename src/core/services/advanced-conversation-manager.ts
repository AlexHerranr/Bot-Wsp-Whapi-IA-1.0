import { logInfo, logWarning, logError } from '../utils/logging';
import { DatabaseService } from './database.service';

interface MessageWindow {
    messages: any[];
    totalTokens: number;
    oldestMessageTime: Date;
    newestMessageTime: Date;
}

export class AdvancedConversationManager {
    // Configuración para conversaciones largas
    private readonly SLIDING_WINDOW_SIZE = parseInt(process.env.CONTEXT_WINDOW_SIZE || '50');
    private readonly ALWAYS_KEEP_LAST = parseInt(process.env.ALWAYS_KEEP_LAST_MESSAGES || '20');
    private readonly MAX_CONTEXT_TOKENS = parseInt(process.env.MAX_CONTEXT_TOKENS || '10000');
    private readonly SUMMARY_TRIGGER_MESSAGES = parseInt(process.env.SUMMARY_TRIGGER_MESSAGES || '100');
    
    constructor(
        private databaseService: DatabaseService
    ) {}

    /**
     * Estrategia para manejar 200+ mensajes de contexto
     */
    async prepareContextForLongConversation(
        userId: string,
        chatId: string,
        allMessages: any[]
    ): Promise<{
        contextMessages: any[];
        summary?: string;
        totalTokens: number;
        strategy: string;
    }> {
        const messageCount = allMessages.length;
        
        // Estrategia 1: Conversación corta (<50 mensajes) - Enviar todo
        if (messageCount <= this.SLIDING_WINDOW_SIZE) {
            return {
                contextMessages: allMessages,
                totalTokens: this.estimateTokens(allMessages),
                strategy: 'FULL_CONTEXT'
            };
        }

        // Estrategia 2: Conversación media (50-100) - Ventana deslizante
        if (messageCount <= this.SUMMARY_TRIGGER_MESSAGES) {
            return this.applySlidingWindow(allMessages);
        }

        // Estrategia 3: Conversación larga (100-200+) - Resumen + Ventana
        return this.applySummaryPlusWindow(allMessages, userId);
    }

    /**
     * Ventana deslizante: Mantiene los N mensajes más relevantes
     */
    private applySlidingWindow(messages: any[]): any {
        // Siempre mantener los primeros mensajes (contexto inicial)
        const initialContext = messages.slice(0, 5);
        
        // Siempre mantener los últimos X mensajes
        const recentMessages = messages.slice(-this.ALWAYS_KEEP_LAST);
        
        // Mensajes del medio: seleccionar los más relevantes
        const middleSection = messages.slice(5, -this.ALWAYS_KEEP_LAST);
        const relevantMiddle = this.selectRelevantMessages(middleSection);
        
        const contextMessages = [
            ...initialContext,
            ...relevantMiddle,
            ...recentMessages
        ];

        logInfo('SLIDING_WINDOW', 'Ventana deslizante aplicada', {
            original: messages.length,
            kept: contextMessages.length,
            strategy: 'initial+relevant+recent'
        });

        return {
            contextMessages,
            totalTokens: this.estimateTokens(contextMessages),
            strategy: 'SLIDING_WINDOW'
        };
    }

    /**
     * Resumen + Ventana: Para conversaciones muy largas
     */
    private async applySummaryPlusWindow(
        messages: any[], 
        userId: string
    ): Promise<any> {
        // Dividir mensajes en chunks para resumir
        const chunksToSummarize = messages.slice(0, -this.SLIDING_WINDOW_SIZE);
        const recentMessages = messages.slice(-this.SLIDING_WINDOW_SIZE);
        
        // Generar resumen de la conversación anterior
        const summary = await this.generateSmartSummary(chunksToSummarize, userId);
        
        // Crear mensaje de sistema con el resumen
        const summaryMessage = {
            role: 'system',
            content: summary,
            metadata: { type: 'conversation_summary' }
        };

        const contextMessages = [
            summaryMessage,
            ...recentMessages
        ];

        logInfo('SUMMARY_PLUS_WINDOW', 'Resumen + ventana aplicado', {
            summarized: chunksToSummarize.length,
            recent: recentMessages.length,
            summaryLength: summary.length
        });

        return {
            contextMessages,
            summary,
            totalTokens: this.estimateTokens(contextMessages),
            strategy: 'SUMMARY_PLUS_WINDOW'
        };
    }

    /**
     * Selecciona mensajes relevantes del medio de la conversación
     */
    private selectRelevantMessages(messages: any[], maxMessages: number = 20): any[] {
        if (messages.length <= maxMessages) {
            return messages;
        }

        // Criterios de relevancia:
        const scored = messages.map(msg => ({
            message: msg,
            score: this.calculateRelevanceScore(msg, messages)
        }));

        // Ordenar por relevancia y tomar los top N
        scored.sort((a, b) => b.score - a.score);
        
        return scored
            .slice(0, maxMessages)
            .map(s => s.message)
            .sort((a, b) => a.timestamp - b.timestamp); // Mantener orden cronológico
    }

    /**
     * Calcula qué tan relevante es un mensaje
     */
    private calculateRelevanceScore(message: any, allMessages: any[]): number {
        let score = 0;

        // 1. Mensajes con preguntas son más relevantes
        if (message.content.includes('?')) score += 3;

        // 2. Mensajes largos suelen tener más contexto
        if (message.content.length > 100) score += 2;

        // 3. Mensajes que mencionan fechas/números
        if (/\d{2,}/.test(message.content)) score += 2;

        // 4. Mensajes del usuario son prioritarios
        if (message.role === 'user') score += 1;

        // 5. Mensajes con keywords importantes (personalizar según tu dominio)
        const importantKeywords = ['reserva', 'booking', 'precio', 'fecha', 'confirmar'];
        const hasKeyword = importantKeywords.some(kw => 
            message.content.toLowerCase().includes(kw)
        );
        if (hasKeyword) score += 3;

        return score;
    }

    /**
     * Genera un resumen inteligente de los mensajes
     */
    private async generateSmartSummary(messages: any[], userId: string): Promise<string> {
        // Extraer información clave
        const userInfo = await this.databaseService.getThread(userId);
        const topics = this.extractTopics(messages);
        const keyDecisions = this.extractKeyDecisions(messages);
        const pendingQuestions = this.extractPendingQuestions(messages);

        const summary = `RESUMEN DE CONVERSACIÓN ANTERIOR (${messages.length} mensajes):

Usuario: ${userInfo?.userName || userId}
Etiquetas: ${userInfo?.labels?.join(', ') || 'Sin etiquetas'}

TEMAS PRINCIPALES DISCUTIDOS:
${topics.map(t => `- ${t}`).join('\n')}

DECISIONES/ACUERDOS IMPORTANTES:
${keyDecisions.map(d => `- ${d}`).join('\n')}

PREGUNTAS PENDIENTES:
${pendingQuestions.map(q => `- ${q}`).join('\n')}

CONTEXTO RELEVANTE:
- Primera interacción: ${messages[0]?.content.substring(0, 50)}...
- Última interacción significativa: ${this.findLastSignificantInteraction(messages)}
`;

        return summary;
    }

    /**
     * Métodos auxiliares para extracción de información
     */
    private extractTopics(messages: any[]): string[] {
        // Implementar lógica de extracción de temas
        // Aquí podrías usar NLP o patrones
        return ['Consulta principal sobre el servicio'];
    }

    private extractKeyDecisions(messages: any[]): string[] {
        // Buscar patrones de decisiones/confirmaciones
        const decisions: string[] = [];
        
        messages.forEach(msg => {
            if (msg.content.match(/confirmo|acepto|de acuerdo|perfecto|listo/i)) {
                decisions.push(msg.content.substring(0, 100));
            }
        });

        return decisions.slice(-5); // Últimas 5 decisiones
    }

    private extractPendingQuestions(messages: any[]): string[] {
        // Buscar preguntas sin respuesta
        const questions: string[] = [];
        
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].content.includes('?') && messages[i].role === 'user') {
                // Verificar si la siguiente respuesta del assistant responde la pregunta
                const nextAssistant = messages.slice(i + 1).find(m => m.role === 'assistant');
                if (!nextAssistant || !this.answersQuestion(messages[i].content, nextAssistant.content)) {
                    questions.push(messages[i].content);
                }
            }
        }

        return questions.slice(0, 3); // Máximo 3 preguntas pendientes
    }

    private findLastSignificantInteraction(messages: any[]): string {
        // Buscar la última interacción relevante
        for (let i = messages.length - 1; i >= 0; i--) {
            if (this.calculateRelevanceScore(messages[i], messages) > 5) {
                return messages[i].content.substring(0, 100) + '...';
            }
        }
        return 'No encontrada';
    }

    private answersQuestion(question: string, answer: string): boolean {
        // Lógica simple para determinar si una respuesta contesta la pregunta
        // En producción, usar NLP más sofisticado
        return answer.length > 50;
    }

    private estimateTokens(messages: any[]): number {
        // Estimación simple: ~4 caracteres por token
        const totalChars = messages.reduce((sum, msg) => 
            sum + (msg.content?.length || 0), 0
        );
        return Math.ceil(totalChars / 4);
    }

    /**
     * Guarda el estado de optimización en la BD
     */
    async saveOptimizationState(
        userId: string, 
        strategy: string, 
        summary?: string
    ): Promise<void> {
        // Aquí guardarías el resumen y estrategia usada
        // para referencia futura
        logInfo('OPTIMIZATION_SAVED', 'Estado de optimización guardado', {
            userId,
            strategy,
            hasSummary: !!summary
        });
    }
}