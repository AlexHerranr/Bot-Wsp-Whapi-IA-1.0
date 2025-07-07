import fetch from 'node-fetch';
import { enhancedLog } from '../core/index.js';

// Configuración de Whapi
const WHAPI_API_URL = process.env.WHAPI_API_URL || 'https://gate.whapi.cloud';
const WHAPI_TOKEN = process.env.WHAPI_TOKEN || '';

// Interfaz para mensajes de Whapi
interface WhapiMessage {
    id: string;
    from_me: boolean;
    type: string;
    chat_id: string;
    timestamp: number;
    text?: {
        body: string;
    };
    from?: string;
    from_name?: string;
    to?: string;
    to_name?: string;
}


// Interfaz para respuesta de API
interface WhapiApiResponse {
    messages?: WhapiMessage[];
    total?: number;
    [key: string]: any;
}

interface ConversationHistory {
    userId: string;
    messages: WhapiMessage[];
    lastMessage: number;
    totalMessages: number;
}

// Clase para manejar historial de conversaciones
export class ConversationHistoryManager {
    private cache = new Map<string, ConversationHistory>();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos

    // Obtener las últimas conversaciones de un usuario específico
    async getConversationHistory(userId: string, limit: number = 50): Promise<WhapiMessage[]> {
        try {
            enhancedLog('info', 'CONVERSATION_HISTORY', 
                `Obteniendo historial de conversación para ${userId} (límite: ${limit})`);

            const endpoint = `${WHAPI_API_URL}/messages?token=${WHAPI_TOKEN}&chat_id=${userId}@s.whatsapp.net&limit=${limit}`;
            
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json() as WhapiApiResponse;
            
            if (data && data.messages && Array.isArray(data.messages)) {
                enhancedLog('success', 'CONVERSATION_HISTORY', 
                    `Obtenidas ${data.messages.length} mensajes del historial para ${userId}`);
                
                // Guardar en cache
                this.cache.set(userId, {
                    userId,
                    messages: data.messages,
                    lastMessage: Date.now(),
                    totalMessages: data.messages.length
                });

                return data.messages;
            } else {
                enhancedLog('warning', 'CONVERSATION_HISTORY', 
                    `No se encontraron mensajes en el historial para ${userId}`);
                return [];
            }

        } catch (error) {
            enhancedLog('error', 'CONVERSATION_HISTORY', 
                `Error obteniendo historial para ${userId}: ${error.message}`);
            return [];
        }
    }

    // Obtener todas las conversaciones recientes (últimas 50)
    async getAllRecentConversations(limit: number = 50): Promise<WhapiMessage[]> {
        try {
            enhancedLog('info', 'CONVERSATION_HISTORY', 
                `Obteniendo todas las conversaciones recientes (límite: ${limit})`);

            const endpoint = `${WHAPI_API_URL}/messages?token=${WHAPI_TOKEN}&limit=${limit}`;
            
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data && data.messages && Array.isArray(data.messages)) {
                enhancedLog('success', 'CONVERSATION_HISTORY', 
                    `Obtenidas ${data.messages.length} conversaciones recientes`);
                return data.messages;
            } else {
                enhancedLog('warning', 'CONVERSATION_HISTORY', 
                    `No se encontraron conversaciones recientes`);
                return [];
            }

        } catch (error) {
            enhancedLog('error', 'CONVERSATION_HISTORY', 
                `Error obteniendo conversaciones recientes: ${error.message}`);
            return [];
        }
    }

    // Obtener mensajes desde una fecha específica
    async getMessagesSince(userId: string, sinceTimestamp: number): Promise<WhapiMessage[]> {
        try {
            enhancedLog('info', 'CONVERSATION_HISTORY', 
                `Obteniendo mensajes desde ${new Date(sinceTimestamp).toISOString()} para ${userId}`);

            const endpoint = `${WHAPI_API_URL}/messages?token=${WHAPI_TOKEN}&chat_id=${userId}@s.whatsapp.net&since=${sinceTimestamp}`;
            
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data && data.messages && Array.isArray(data.messages)) {
                enhancedLog('success', 'CONVERSATION_HISTORY', 
                    `Obtenidos ${data.messages.length} mensajes desde ${sinceTimestamp} para ${userId}`);
                return data.messages;
            } else {
                enhancedLog('warning', 'CONVERSATION_HISTORY', 
                    `No se encontraron mensajes desde ${sinceTimestamp} para ${userId}`);
                return [];
            }

        } catch (error) {
            enhancedLog('error', 'CONVERSATION_HISTORY', 
                `Error obteniendo mensajes desde ${sinceTimestamp} para ${userId}: ${error.message}`);
            return [];
        }
    }

    // Obtener estadísticas de conversación
    async getConversationStats(userId: string): Promise<{
        totalMessages: number;
        lastMessage: number;
        messageTypes: Record<string, number>;
        averageResponseTime?: number;
    }> {
        try {
            const messages = await this.getConversationHistory(userId, 100);
            
            if (messages.length === 0) {
                return {
                    totalMessages: 0,
                    lastMessage: 0,
                    messageTypes: {}
                };
            }

            // Contar tipos de mensajes
            const messageTypes: Record<string, number> = {};
            messages.forEach(msg => {
                const type = msg.type || 'unknown';
                messageTypes[type] = (messageTypes[type] || 0) + 1;
            });

            // Calcular tiempo de respuesta promedio (si hay suficientes mensajes)
            let averageResponseTime: number | undefined;
            if (messages.length >= 2) {
                const responseTimes: number[] = [];
                for (let i = 1; i < messages.length; i++) {
                    const currentMsg = messages[i];
                    const previousMsg = messages[i - 1];
                    
                    if (currentMsg.from_me !== previousMsg.from_me) {
                        const responseTime = currentMsg.timestamp - previousMsg.timestamp;
                        if (responseTime > 0 && responseTime < 300000) { // Menos de 5 minutos
                            responseTimes.push(responseTime);
                        }
                    }
                }
                
                if (responseTimes.length > 0) {
                    averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
                }
            }

            const stats = {
                totalMessages: messages.length,
                lastMessage: Math.max(...messages.map(m => m.timestamp)),
                messageTypes,
                averageResponseTime
            };

            enhancedLog('info', 'CONVERSATION_STATS', 
                `Estadísticas para ${userId}: ${stats.totalMessages} mensajes, ${Object.keys(stats.messageTypes).length} tipos`);

            return stats;

        } catch (error) {
            enhancedLog('error', 'CONVERSATION_STATS', 
                `Error obteniendo estadísticas para ${userId}: ${error.message}`);
            return {
                totalMessages: 0,
                lastMessage: 0,
                messageTypes: {}
            };
        }
    }

    // Obtener conversaciones desde cache si están disponibles
    getFromCache(userId: string): ConversationHistory | null {
        const cached = this.cache.get(userId);
        if (cached && (Date.now() - cached.lastMessage) < this.CACHE_TTL) {
            enhancedLog('info', 'CONVERSATION_CACHE', 
                `Usando conversación en cache para ${userId} (${cached.totalMessages} mensajes)`);
            return cached;
        }
        return null;
    }

    // Limpiar cache
    clearCache(userId?: string) {
        if (userId) {
            this.cache.delete(userId);
            enhancedLog('info', 'CONVERSATION_CACHE', `Cache limpiado para ${userId}`);
        } else {
            this.cache.clear();
            enhancedLog('info', 'CONVERSATION_CACHE', 'Cache completamente limpiado');
        }
    }

    // Obtener resumen de conversación para contexto de IA
    async getConversationSummary(userId: string, maxMessages: number = 10): Promise<string> {
        try {
            const messages = await this.getConversationHistory(userId, maxMessages);
            
            if (messages.length === 0) {
                return `No hay historial de conversación para este usuario.`;
            }

            const summary = messages
                .filter(msg => msg.text?.body) // Solo mensajes de texto
                .map(msg => {
                    const sender = msg.from_me ? 'Bot' : 'Cliente';
                    const timestamp = new Date(msg.timestamp * 1000).toLocaleString('es-CO');
                    return `[${timestamp}] ${sender}: ${msg.text?.body}`;
                })
                .join('\n');

            enhancedLog('info', 'CONVERSATION_SUMMARY', 
                `Resumen generado para ${userId} (${messages.length} mensajes)`);

            return `HISTORIAL DE CONVERSACIÓN:\n${summary}`;

        } catch (error) {
            enhancedLog('error', 'CONVERSATION_SUMMARY', 
                `Error generando resumen para ${userId}: ${error.message}`);
            return `Error obteniendo historial de conversación.`;
        }
    }
}

// Instancia global
export const conversationHistory = new ConversationHistoryManager(); 