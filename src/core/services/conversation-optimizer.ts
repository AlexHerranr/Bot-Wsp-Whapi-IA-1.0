import { logInfo, logWarning } from '../utils/logging';

export interface ConversationStats {
    messageCount: number;
    totalTokens: number;
    estimatedCost: number;
}

export class ConversationOptimizer {
    // Límites configurables
    private readonly MAX_TOKENS_BEFORE_SUMMARY = parseInt(process.env.MAX_TOKENS_BEFORE_SUMMARY || '8000');
    private readonly MAX_MESSAGES_BEFORE_CLEANUP = parseInt(process.env.MAX_MESSAGES_BEFORE_CLEANUP || '20');
    private readonly TOKEN_COST_PER_1K = 0.0015; // Ajustar según el modelo

    constructor() {}

    /**
     * Evalúa si una conversación necesita optimización
     */
    shouldOptimizeConversation(stats: ConversationStats): {
        needsOptimization: boolean;
        reason?: string;
        strategy?: 'summarize' | 'cleanup' | 'reset';
    } {
        // Estrategia 1: Si supera tokens, resumir
        if (stats.totalTokens > this.MAX_TOKENS_BEFORE_SUMMARY) {
            return {
                needsOptimization: true,
                reason: `Tokens excedidos: ${stats.totalTokens} > ${this.MAX_TOKENS_BEFORE_SUMMARY}`,
                strategy: 'summarize'
            };
        }

        // Estrategia 2: Si hay muchos mensajes, limpiar antiguos
        if (stats.messageCount > this.MAX_MESSAGES_BEFORE_CLEANUP) {
            return {
                needsOptimization: true,
                reason: `Demasiados mensajes: ${stats.messageCount} > ${this.MAX_MESSAGES_BEFORE_CLEANUP}`,
                strategy: 'cleanup'
            };
        }

        // Estrategia 3: Si el costo estimado es muy alto
        const estimatedCost = (stats.totalTokens / 1000) * this.TOKEN_COST_PER_1K;
        if (estimatedCost > 1.0) { // Más de $1 por conversación
            return {
                needsOptimization: true,
                reason: `Costo alto: $${estimatedCost.toFixed(2)}`,
                strategy: 'reset'
            };
        }

        return { needsOptimization: false };
    }

    /**
     * Genera un resumen de la conversación para reducir tokens
     */
    async generateConversationSummary(messages: any[]): Promise<string> {
        // Tomar los primeros N mensajes y crear un resumen
        const firstMessages = messages.slice(0, 10);
        
        const summary = `Resumen de conversación anterior:
- Usuario: ${firstMessages[0]?.userName || 'Usuario'}
- Tema principal: ${this.extractMainTopic(firstMessages)}
- Puntos clave discutidos: ${this.extractKeyPoints(firstMessages)}
- Última interacción relevante: ${this.getLastRelevantInteraction(firstMessages)}`;

        logInfo('CONVERSATION_SUMMARY', 'Resumen generado', {
            originalMessages: messages.length,
            summaryLength: summary.length
        });

        return summary;
    }

    /**
     * Estrategia de limpieza: mantener solo mensajes recientes
     */
    cleanupOldMessages(messages: any[], keepLast: number = 10): any[] {
        if (messages.length <= keepLast) {
            return messages;
        }

        const cleaned = messages.slice(-keepLast);
        
        logInfo('MESSAGES_CLEANUP', 'Mensajes antiguos eliminados', {
            original: messages.length,
            kept: cleaned.length,
            removed: messages.length - cleaned.length
        });

        return cleaned;
    }

    /**
     * Decide si usar previous_response_id o empezar nueva cadena
     */
    shouldBreakChain(stats: ConversationStats): boolean {
        const optimization = this.shouldOptimizeConversation(stats);
        
        if (optimization.needsOptimization && optimization.strategy === 'reset') {
            logWarning('CHAIN_BREAK', 'Rompiendo cadena de response_id', {
                reason: optimization.reason
            });
            return true;
        }

        return false;
    }

    // Métodos auxiliares privados
    private extractMainTopic(messages: any[]): string {
        // Lógica simple: buscar palabras clave comunes
        // En producción, podrías usar NLP o el propio modelo
        return "Consulta general";
    }

    private extractKeyPoints(messages: any[]): string {
        // Extraer puntos clave de la conversación
        return "Varios temas discutidos";
    }

    private getLastRelevantInteraction(messages: any[]): string {
        // Obtener la última interacción importante
        const lastUserMessage = messages.filter(m => m.role === 'user').pop();
        return lastUserMessage?.content?.substring(0, 50) || "Sin interacciones previas";
    }
}