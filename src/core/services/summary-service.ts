import { OpenAI } from 'openai';
import { logInfo, logError } from '../utils/logging';
import { DatabaseService } from './database.service';
import { ConversationManager } from './conversation-manager';

export interface ConversationSummary {
    userId: string;
    summary: string;
    messageCountSummarized: number;
    keyPoints: string[];
    pendingTopics: string[];
    createdAt: Date;
}

export class SummaryService {
    private openai: OpenAI;
    
    constructor(
        private databaseService: DatabaseService,
        private conversationManager: ConversationManager
    ) {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }

    /**
     * Decide si necesita generar un resumen
     */
    async shouldGenerateSummary(userId: string, messageCount: number): Promise<boolean> {
        // Generar resumen cada 50 mensajes
        const SUMMARY_INTERVAL = parseInt(process.env.SUMMARY_INTERVAL || '50');
        
        if (messageCount % SUMMARY_INTERVAL !== 0) {
            return false;
        }

        // Verificar último resumen
        const lastSummary = await this.databaseService.getLastSummary(userId);
        if (lastSummary) {
            const hoursSinceLastSummary = (Date.now() - lastSummary.createdAt.getTime()) / (1000 * 60 * 60);
            // No generar si hay un resumen de hace menos de 2 horas
            if (hoursSinceLastSummary < 2) {
                return false;
            }
        }

        return true;
    }

    /**
     * Genera un resumen inteligente de la conversación
     */
    async generateConversationSummary(
        userId: string, 
        messages: any[],
        currentQuery?: string
    ): Promise<ConversationSummary> {
        try {
            logInfo('SUMMARY_GENERATION', 'Generando resumen de conversación', {
                userId,
                messageCount: messages.length
            });

            // Preparar el prompt para el resumen
            const summaryPrompt = this.buildSummaryPrompt(messages, currentQuery);

            // Llamar a OpenAI para generar el resumen
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini', // Modelo barato para resúmenes
                messages: [
                    {
                        role: 'system',
                        content: `Eres un asistente especializado en crear resúmenes concisos y útiles de conversaciones.
                        Debes extraer:
                        1. Información clave del usuario y sus necesidades
                        2. Decisiones tomadas o acuerdos
                        3. Temas pendientes o preguntas sin responder
                        4. Contexto relevante para futuras interacciones
                        
                        El resumen debe ser conciso (máximo 500 palabras) pero completo.`
                    },
                    {
                        role: 'user',
                        content: summaryPrompt
                    }
                ],
                max_tokens: 1000,
                temperature: 0.3 // Baja temperatura para resúmenes consistentes
            });

            const summaryText = response.choices[0].message.content || '';
            
            // Extraer puntos clave del resumen
            const keyPoints = this.extractKeyPoints(summaryText);
            const pendingTopics = this.extractPendingTopics(messages);

            const summary: ConversationSummary = {
                userId,
                summary: summaryText,
                messageCountSummarized: messages.length,
                keyPoints,
                pendingTopics,
                createdAt: new Date()
            };

            // Guardar en BD
            await this.databaseService.saveSummary(summary);

            logInfo('SUMMARY_COMPLETE', 'Resumen generado exitosamente', {
                userId,
                summaryLength: summaryText.length,
                keyPointsCount: keyPoints.length
            });

            return summary;

        } catch (error) {
            logError('SUMMARY_ERROR', 'Error generando resumen', { userId, error });
            throw error;
        }
    }

    /**
     * Resetea la conversación manteniendo el contexto del resumen
     */
    async resetWithSummary(userId: string, chatId: string): Promise<string> {
        // Obtener el último resumen
        const lastSummary = await this.databaseService.getLastSummary(userId);
        
        if (!lastSummary) {
            logInfo('NO_SUMMARY_AVAILABLE', 'No hay resumen disponible para reset', { userId });
            return '';
        }

        // Resetear la conversación
        await this.conversationManager.resetConversation(userId, chatId);

        // Crear mensaje de sistema con el resumen
        const summarySystemMessage = `Contexto de conversación anterior:
${lastSummary.summary}

Puntos clave:
${lastSummary.keyPoints.map(p => `- ${p}`).join('\n')}

Temas pendientes:
${lastSummary.pendingTopics.map(t => `- ${t}`).join('\n')}`;

        // Guardar el resumen como primer mensaje del nuevo contexto
        await this.conversationManager.addMessage(
            userId,
            chatId,
            'system',
            summarySystemMessage,
            undefined,
            { type: 'conversation_summary' }
        );

        logInfo('RESET_WITH_SUMMARY', 'Conversación reseteada con resumen', {
            userId,
            summaryLength: summarySystemMessage.length
        });

        return summarySystemMessage;
    }

    /**
     * Construye el prompt para generar el resumen
     */
    private buildSummaryPrompt(messages: any[], currentQuery?: string): string {
        // Tomar los últimos N mensajes para el resumen
        const messagesToSummarize = messages.slice(-100); // Últimos 100 mensajes
        
        let prompt = 'Resume la siguiente conversación de WhatsApp:\n\n';
        
        messagesToSummarize.forEach(msg => {
            const role = msg.role === 'user' ? 'Usuario' : 'Asistente';
            const timestamp = msg.timestamp ? new Date(msg.timestamp).toLocaleString() : '';
            prompt += `[${timestamp}] ${role}: ${msg.content}\n`;
        });

        if (currentQuery) {
            prompt += `\n\nConsulta actual del usuario: "${currentQuery}"`;
            prompt += '\n\nAsegúrate de que el resumen incluya contexto relevante para responder esta consulta.';
        }

        return prompt;
    }

    /**
     * Extrae puntos clave del resumen
     */
    private extractKeyPoints(summary: string): string[] {
        // Buscar bullets o puntos numerados
        const points: string[] = [];
        const lines = summary.split('\n');
        
        lines.forEach(line => {
            if (line.match(/^[-•*]\s+/) || line.match(/^\d+\.\s+/)) {
                points.push(line.replace(/^[-•*\d.]\s+/, '').trim());
            }
        });

        return points.slice(0, 5); // Máximo 5 puntos clave
    }

    /**
     * Extrae temas pendientes de la conversación
     */
    private extractPendingTopics(messages: any[]): string[] {
        const pendingTopics: string[] = [];
        
        // Buscar preguntas sin respuesta en los últimos mensajes
        for (let i = messages.length - 1; i >= Math.max(0, messages.length - 20); i--) {
            const msg = messages[i];
            if (msg.role === 'user' && msg.content.includes('?')) {
                // Verificar si hay respuesta después
                const hasResponse = messages.slice(i + 1).some(m => 
                    m.role === 'assistant' && m.content.length > 20
                );
                
                if (!hasResponse) {
                    pendingTopics.push(msg.content.substring(0, 100));
                }
            }
        }

        return pendingTopics;
    }

    /**
     * Obtiene un resumen contextual basado en la consulta actual
     */
    async getContextualSummary(
        userId: string,
        currentQuery: string
    ): Promise<string | null> {
        const lastSummary = await this.databaseService.getLastSummary(userId);
        
        if (!lastSummary) {
            return null;
        }

        // Si el resumen es muy viejo, no usarlo
        const daysSinceLastSummary = (Date.now() - lastSummary.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceLastSummary > 7) {
            return null;
        }

        // Determinar si el resumen es relevante para la consulta actual
        const isRelevant = this.isSummaryRelevantToQuery(lastSummary, currentQuery);
        
        if (!isRelevant) {
            logInfo('SUMMARY_NOT_RELEVANT', 'Resumen no relevante para consulta actual', {
                userId,
                currentQuery
            });
            return null;
        }

        return lastSummary.summary;
    }

    /**
     * Determina si un resumen es relevante para una consulta
     */
    private isSummaryRelevantToQuery(summary: ConversationSummary, query: string): boolean {
        // Lógica simple: buscar palabras clave comunes
        const queryWords = query.toLowerCase().split(/\s+/);
        const summaryText = (summary.summary + summary.keyPoints.join(' ')).toLowerCase();
        
        const relevantWords = queryWords.filter(word => 
            word.length > 3 && summaryText.includes(word)
        );

        return relevantWords.length > 0;
    }
}