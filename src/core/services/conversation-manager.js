"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationManager = void 0;
const logging_1 = require("../../utils/logging");
class ConversationManager {
    constructor(databaseService) {
        this.databaseService = databaseService;
        this.conversations = new Map();
        this.messageHistory = new Map();
        this.MAX_MESSAGES_IN_MEMORY = 20;
        // No limits - let OpenAI handle context window automatically
        this.LOG_LONG_CONVERSATION_THRESHOLD = 100; // Solo para logging
        // Cargar conversaciones activas de la BD si está disponible
        this.loadActiveConversations();
    }
    async loadActiveConversations() {
        if (!this.databaseService)
            return;
        try {
            // Cargar conversaciones activas de las últimas 24 horas
            const recentConversations = await this.databaseService.getRecentConversations(24);
            for (const conv of recentConversations) {
                const state = {
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
            (0, logging_1.logInfo)('CONVERSATIONS_LOADED', 'Conversaciones activas cargadas', {
                count: this.conversations.size
            });
        }
        catch (error) {
            // No es crítico si falla la carga inicial
            (0, logging_1.logWarning)('CONVERSATIONS_LOAD_ERROR', 'No se pudieron cargar conversaciones previas (no crítico)', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            // El servicio puede continuar funcionando sin conversaciones previas
        }
    }
    getConversationKey(userId, chatId) {
        return `${userId}:${chatId}`;
    }
    async getOrCreateConversation(userId, chatId) {
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
                (0, logging_1.logInfo)('CONVERSATION_CREATED', 'Nueva conversación creada', {
                    userId,
                    chatId
                });
            }
            this.conversations.set(key, conversation);
        }
        return conversation;
    }
    async updateConversation(userId, chatId, responseId, tokensUsed) {
        const key = this.getConversationKey(userId, chatId);
        const conversation = await this.getOrCreateConversation(userId, chatId);
        conversation.lastResponseId = responseId;
        conversation.messageCount += 1;
        conversation.tokenCount += tokensUsed;
        conversation.lastActivity = new Date();
        // Log de métricas para monitoreo
        const estimatedCost = (conversation.tokenCount / 1000) * 0.0015; // Ajustar según modelo
        (0, logging_1.logInfo)('CONVERSATION_METRICS', 'Métricas de conversación actualizadas', {
            userId,
            messageCount: conversation.messageCount,
            totalTokens: conversation.tokenCount,
            estimatedCost: `$${estimatedCost.toFixed(4)}`,
            avgTokensPerMessage: Math.round(conversation.tokenCount / conversation.messageCount)
        });
        // Verificar si necesita optimización
        if (conversation.messageCount > 50) {
            (0, logging_1.logWarning)('LONG_CONVERSATION_DETECTED', 'Conversación larga detectada', {
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
            (0, logging_1.logInfo)('CONVERSATION_MILESTONE', 'Hito de conversación alcanzado', {
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
    async addMessage(userId, chatId, role, content, responseId) {
        const key = this.getConversationKey(userId, chatId);
        if (!this.messageHistory.has(key)) {
            this.messageHistory.set(key, []);
        }
        const messages = this.messageHistory.get(key);
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
    getRecentMessages(userId, chatId, limit = 10) {
        const key = this.getConversationKey(userId, chatId);
        const messages = this.messageHistory.get(key) || [];
        return messages.slice(-limit);
    }
    async resetConversation(userId, chatId) {
        const key = this.getConversationKey(userId, chatId);
        // Limpiar memoria
        this.conversations.delete(key);
        this.messageHistory.delete(key);
        // Resetear en BD
        if (this.databaseService) {
            await this.databaseService.resetConversation(userId, chatId);
        }
        (0, logging_1.logInfo)('CONVERSATION_RESET', 'Conversación reseteada', {
            userId,
            chatId
        });
    }
    async getConversationContext(userId, chatId) {
        const conversation = await this.getOrCreateConversation(userId, chatId);
        const messages = this.getRecentMessages(userId, chatId);
        // Limpiar IDs viejos con formato thread_ que no son válidos para Responses API
        let cleanPreviousResponseId = conversation.lastResponseId;
        if (cleanPreviousResponseId && cleanPreviousResponseId.startsWith('thread_')) {
            (0, logging_1.logWarning)('LEGACY_THREAD_ID', 'Ignorando ID de thread legacy', {
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
    async cleanupInactiveConversations(hoursInactive = 24) {
        const cutoffTime = new Date(Date.now() - hoursInactive * 60 * 60 * 1000);
        const keysToDelete = [];
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
            (0, logging_1.logInfo)('CONVERSATIONS_CLEANUP', 'Conversaciones inactivas limpiadas', {
                count: keysToDelete.length,
                hoursInactive
            });
        }
    }
}
exports.ConversationManager = ConversationManager;
