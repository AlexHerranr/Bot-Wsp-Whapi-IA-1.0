"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaManager = void 0;
// src/core/state/media-manager.ts
const lru_cache_1 = require("lru-cache");
class MediaManager {
    constructor(maxItems = 500, imageTTL = 10 * 60 * 1000, // 10 minutos
    messageTTL = 60 * 60 * 1000 // 1 hora
    ) {
        this.pendingImages = new lru_cache_1.LRUCache({
            max: maxItems,
            ttl: imageTTL,
        });
        this.botSentMessages = new lru_cache_1.LRUCache({
            max: maxItems,
            ttl: messageTTL,
        });
        this.botSentContent = new lru_cache_1.LRUCache({
            max: maxItems,
            ttl: 5 * 60 * 1000, // 5 minutos para contenido
        });
    }
    // Métodos para imágenes pendientes
    addPendingImage(userId, imageUrl) {
        const images = this.pendingImages.get(userId) || [];
        images.push(imageUrl);
        this.pendingImages.set(userId, images);
    }
    getPendingImages(userId) {
        return this.pendingImages.get(userId) || [];
    }
    clearPendingImages(userId) {
        this.pendingImages.delete(userId);
    }
    // Métodos para mensajes enviados por el bot
    markMessageAsSent(userId, messageId) {
        const messages = this.botSentMessages.get(userId) || new Set();
        messages.add(messageId);
        this.botSentMessages.set(userId, messages);
    }
    isMessageFromBot(userId, messageId) {
        const messages = this.botSentMessages.get(userId);
        return messages ? messages.has(messageId) : false;
    }
    // Método adicional para verificar si un mensaje fue enviado por el bot (sin userId)
    isBotSentMessage(messageId) {
        // Buscar en todos los usuarios para ver si el mensaje fue enviado por el bot
        for (const [userId, messages] of this.botSentMessages.entries()) {
            if (messages.has(messageId)) {
                return true;
            }
        }
        return false;
    }
    // Método para agregar mensaje enviado por el bot (sin userId)
    addBotSentMessage(messageId) {
        // Usar un userId especial para mensajes globales del bot
        const globalBotUserId = '__bot_global__';
        this.markMessageAsSent(globalBotUserId, messageId);
        // Auto-cleanup after 10 minutes to prevent accumulation in long sessions
        setTimeout(() => {
            const messages = this.botSentMessages.get(globalBotUserId);
            if (messages) {
                messages.delete(messageId);
                if (messages.size === 0) {
                    this.botSentMessages.delete(globalBotUserId);
                }
            }
        }, 10 * 60 * 1000);
    }
    clearBotMessages(userId) {
        this.botSentMessages.delete(userId);
    }
    // Métodos para contenido de mensajes enviados (fallback cuando no hay ID)
    addBotSentContent(chatId, content) {
        if (!chatId || !content)
            return;
        // Normalizar el contenido (quitar IDs internos, colapsar espacios, a minúsculas)
        const normalizedContent = content
            .replace(/\[(?:th_|run_|msg_|thread_|asst_)[^\]]+\]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase()
            .substring(0, 200);
        const normalizedChatId = chatId.toLowerCase();
        const contents = this.botSentContent.get(normalizedChatId) || new Set();
        contents.add(normalizedContent);
        this.botSentContent.set(normalizedChatId, contents);
    }
    isBotSentContent(chatId, content) {
        if (!chatId || !content)
            return false;
        const normalizedContent = content
            .replace(/\[(?:th_|run_|msg_|thread_|asst_)[^\]]+\]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase()
            .substring(0, 200);
        const normalizedChatId = chatId.toLowerCase();
        const contents = this.botSentContent.get(normalizedChatId);
        return contents ? contents.has(normalizedContent) : false;
    }
    // Métodos de utilidad
    getStats() {
        return {
            pendingImages: this.pendingImages.size,
            botMessages: this.botSentMessages.size,
            botContent: this.botSentContent.size,
        };
    }
    cleanup() {
        // LRUCache maneja la limpieza automáticamente basándose en TTL
        // Este método está aquí por si necesitamos forzar una limpieza manual
        this.pendingImages.clear();
        this.botSentMessages.clear();
        this.botSentContent.clear();
    }
}
exports.MediaManager = MediaManager;
