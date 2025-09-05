"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseWebhookProcessor = void 0;
class BaseWebhookProcessor {
    constructor(bufferManager, userManager, mediaManager, mediaService, databaseService, delayedActivityService, openaiService, terminalLog, clientCache) {
        this.bufferManager = bufferManager;
        this.userManager = userManager;
        this.mediaManager = mediaManager;
        this.mediaService = mediaService;
        this.databaseService = databaseService;
        this.delayedActivityService = delayedActivityService;
        this.openaiService = openaiService;
        this.terminalLog = terminalLog;
        this.clientCache = clientCache;
    }
    /**
     * Método helper para validar que el payload es un grupo específico
     */
    isSpecificGroup(payload, targetChatId) {
        if (!payload || !targetChatId)
            return false;
        const { messages } = payload;
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return false;
        }
        // Verificar si algún mensaje viene del grupo específico
        return messages.some(message => {
            const chatId = message.chat_id || message.from;
            return chatId === targetChatId;
        });
    }
    /**
     * Método helper para extraer información básica del webhook
     */
    extractWebhookInfo(payload) {
        return {
            hasMessages: !!(payload.messages && Array.isArray(payload.messages)),
            hasPresences: !!(payload.presences && Array.isArray(payload.presences)),
            messageCount: payload.messages?.length || 0,
            presenceCount: payload.presences?.length || 0,
            firstMessageType: payload.messages?.[0]?.type,
            firstMessageChatId: payload.messages?.[0]?.chat_id || payload.messages?.[0]?.from
        };
    }
}
exports.BaseWebhookProcessor = BaseWebhookProcessor;
