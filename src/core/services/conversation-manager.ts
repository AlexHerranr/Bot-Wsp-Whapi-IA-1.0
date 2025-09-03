// src/core/services/conversation-manager.ts
import { DatabaseService } from './database.service';
import { logInfo, logError, logWarning } from '../../utils/logging';

export interface ConversationState {
    userId: string;
    chatId: string;
    conversationId?: string; // ID de la conversación en OpenAI
    lastResponseId?: string;
    messageCount: number;
    tokenCount: number;
    lastActivity: Date;
    metadata?: Record<string, any>;
}

export interface MessageEntry {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    responseId?: string;
}

export class ConversationManager {
    private conversations: Map<string, ConversationState> = new Map();
    private messageHistory: Map<string, MessageEntry[]> = new Map();
    private readonly MAX_MESSAGES_IN_MEMORY = 20;
    // No limits - let OpenAI handle context window automatically
    private readonly LOG_LONG_CONVERSATION_THRESHOLD = 100; // Solo para logging
    
    constructor(private databaseService?: DatabaseService) {
        // Cargar conversaciones activas de la BD si está disponible
        this.loadActiveConversations();
    }
    
    private async loadActiveConversations() {
        if (!this.databaseService) return;
        
        try {
            // Cargar conversaciones activas de las últimas 24 horas
            const recentConversations = await this.databaseService.getRecentConversations(24);
            
            for (const conv of recentConversations) {
                const state: ConversationState = {
                    userId: conv.user_id,
                    chatId: conv.chat_id,
                    conversationId: conv.conversation_id,
                    lastResponseId: conv.last_response_id,
                    messageCount: conv.message_count || 0,
                    tokenCount: conv.token_count || 0,
                    lastActivity: new Date(conv.last_activity),
                    metadata: conv.metadata
                };
                
                this.conversations.set(this.getConversationKey(conv.user_id, conv.chat_id), state);
            }
            
            logInfo('CONVERSATIONS_LOADED', 'Conversaciones activas cargadas', {
                count: this.conversations.size
            });
        } catch (error) {
            // No es crítico si falla la carga inicial
            logWarning('CONVERSATIONS_LOAD_ERROR', 'No se pudieron cargar conversaciones previas (no crítico)', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            // El servicio puede continuar funcionando sin conversaciones previas
        }
    }
    
    private getConversationKey(userId: string, chatId: string): string {
        return `${userId}:${chatId}`;
    }
    
    async getOrCreateConversation(userId: string, chatId: string): Promise<ConversationState> {
        const key = this.getConversationKey(userId, chatId);
        
        let conversation = this.conversations.get(key);
        if (!conversation) {
            // Intentar cargar de la BD
            if (this.databaseService) {
                const dbConv = await this.databaseService.getConversation(userId, chatId);
                if (dbConv) {
                    conversation = {
                        userId: dbConv.user_id,
                        chatId: dbConv.chat_id,
                        lastResponseId: dbConv.last_response_id,
                        messageCount: dbConv.message_count || 0,
                        tokenCount: dbConv.token_count || 0,
                        lastActivity: new Date(dbConv.last_activity),
                        metadata: dbConv.metadata
                    };
                }
            }
            
            // Si no existe, crear nueva
            if (!conversation) {
                conversation = {
                    userId,
                    chatId,
                    messageCount: 0,
                    tokenCount: 0,
                    lastActivity: new Date()
                };
                
                logInfo('CONVERSATION_CREATED', 'Nueva conversación creada', {
                    userId,
                    chatId
                });
            }
            
            this.conversations.set(key, conversation);
        }
        
        return conversation;
    }
    
    async updateConversation(
        userId: string, 
        chatId: string, 
        responseId: string,
        tokensUsed: number
    ): Promise<void> {
        const key = this.getConversationKey(userId, chatId);
        const conversation = await this.getOrCreateConversation(userId, chatId);
        
        conversation.lastResponseId = responseId;
        conversation.messageCount += 1;
        conversation.tokenCount += tokensUsed;
        conversation.lastActivity = new Date();
        
        // Log de métricas para monitoreo
        const estimatedCost = (conversation.tokenCount / 1000) * 0.0015; // Ajustar según modelo
        logInfo('CONVERSATION_METRICS', 'Métricas de conversación actualizadas', {
            userId,
            messageCount: conversation.messageCount,
            totalTokens: conversation.tokenCount,
            estimatedCost: `$${estimatedCost.toFixed(4)}`,
            avgTokensPerMessage: Math.round(conversation.tokenCount / conversation.messageCount)
        });
        
        // Verificar si necesita optimización
        if (conversation.messageCount > 50) {
            logWarning('LONG_CONVERSATION_DETECTED', 'Conversación larga detectada', {
                userId,
                chatId,
                messageCount: conversation.messageCount,
                tokenCount: conversation.tokenCount,
                estimatedCost: `$${estimatedCost.toFixed(4)}`,
                recommendation: 'Considerar implementar ventana deslizante'
            });
        }
        
        // Solo logging informativo para conversaciones largas
        if (conversation.messageCount === 50 || 
            conversation.messageCount === 100 || 
            conversation.messageCount === 200) {
            logInfo('CONVERSATION_MILESTONE', 'Hito de conversación alcanzado', {
                userId,
                chatId,
                messageCount: conversation.messageCount,
                tokenCount: conversation.tokenCount,
                estimatedCost: `$${estimatedCost.toFixed(4)}`
            });
        }
        
        // Persistir en BD
        if (this.databaseService) {
            await this.databaseService.updateConversation({
                user_id: userId,
                chat_id: chatId,
                last_response_id: responseId,
                message_count: conversation.messageCount,
                token_count: conversation.tokenCount,
                last_activity: conversation.lastActivity,
                metadata: conversation.metadata
            });
        }
        
        this.conversations.set(key, conversation);
    }
    
    async addMessage(
        userId: string,
        chatId: string,
        role: 'user' | 'assistant',
        content: string,
        responseId?: string
    ): Promise<void> {
        const key = this.getConversationKey(userId, chatId);
        
        if (!this.messageHistory.has(key)) {
            this.messageHistory.set(key, []);
        }
        
        const messages = this.messageHistory.get(key)!;
        
        messages.push({
            role,
            content,
            timestamp: Date.now(),
            responseId
        });
        
        // Mantener solo los últimos N mensajes en memoria
        if (messages.length > this.MAX_MESSAGES_IN_MEMORY) {
            messages.shift();
        }
        
        // Persistir mensaje importante en BD
        if (this.databaseService && responseId) {
            await this.databaseService.saveMessage({
                user_id: userId,
                chat_id: chatId,
                role,
                content,
                response_id: responseId,
                timestamp: new Date()
            });
        }
    }
    
    getRecentMessages(
        userId: string,
        chatId: string,
        limit: number = 10
    ): MessageEntry[] {
        const key = this.getConversationKey(userId, chatId);
        const messages = this.messageHistory.get(key) || [];
        
        return messages.slice(-limit);
    }
    
    async resetConversation(userId: string, chatId: string): Promise<void> {
        const key = this.getConversationKey(userId, chatId);
        
        // Limpiar memoria
        this.conversations.delete(key);
        this.messageHistory.delete(key);
        
        // Resetear en BD
        if (this.databaseService) {
            await this.databaseService.resetConversation(userId, chatId);
        }
        
        logInfo('CONVERSATION_RESET', 'Conversación reseteada', {
            userId,
            chatId
        });
    }
    
    async getConversationContext(userId: string, chatId: string): Promise<{
        conversationId?: string;
        previousResponseId?: string;
        messageHistory: MessageEntry[];
        metadata?: Record<string, any>;
    }> {
        const conversation = await this.getOrCreateConversation(userId, chatId);
        const messages = this.getRecentMessages(userId, chatId);
        
        // Limpiar IDs viejos con formato thread_ que no son válidos para Responses API
        let cleanPreviousResponseId = conversation.lastResponseId;
        if (cleanPreviousResponseId && cleanPreviousResponseId.startsWith('thread_')) {
            logWarning('LEGACY_THREAD_ID', 'Ignorando ID de thread legacy', { 
                userId,
                oldId: cleanPreviousResponseId 
            });
            cleanPreviousResponseId = null;
        }
        
        return {
            conversationId: conversation.conversationId,
            previousResponseId: cleanPreviousResponseId,
            messageHistory: messages,
            metadata: conversation.metadata
        };
    }
    
    // Limpiar conversaciones inactivas (para ejecutar periódicamente)
    async cleanupInactiveConversations(hoursInactive: number = 24): Promise<void> {
        const cutoffTime = new Date(Date.now() - hoursInactive * 60 * 60 * 1000);
        const keysToDelete: string[] = [];
        
        for (const [key, conversation] of this.conversations) {
            if (conversation.lastActivity < cutoffTime) {
                keysToDelete.push(key);
            }
        }
        
        for (const key of keysToDelete) {
            this.conversations.delete(key);
            this.messageHistory.delete(key);
        }
        
        if (keysToDelete.length > 0) {
            logInfo('CONVERSATIONS_CLEANUP', 'Conversaciones inactivas limpiadas', {
                count: keysToDelete.length,
                hoursInactive
            });
        }
    }
}