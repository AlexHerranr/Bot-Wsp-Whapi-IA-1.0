// src/core/state/media-manager.ts
import { LRUCache } from 'lru-cache';

export class MediaManager {
    // Cache para imágenes pendientes con un TTL corto (ej. 10 minutos)
    private pendingImages: LRUCache<string, string[]>;

    // Cache para mensajes enviados por el bot
    private botSentMessages: LRUCache<string, Set<string>>;

    constructor(
        maxItems: number = 500,
        imageTTL: number = 10 * 60 * 1000, // 10 minutos
        messageTTL: number = 60 * 60 * 1000 // 1 hora
    ) {
        this.pendingImages = new LRUCache({
            max: maxItems,
            ttl: imageTTL,
        });

        this.botSentMessages = new LRUCache({
            max: maxItems,
            ttl: messageTTL,
        });
    }

    // Métodos para imágenes pendientes
    public addPendingImage(userId: string, imageUrl: string): void {
        const images = this.pendingImages.get(userId) || [];
        images.push(imageUrl);
        this.pendingImages.set(userId, images);
    }

    public getPendingImages(userId: string): string[] {
        return this.pendingImages.get(userId) || [];
    }

    public clearPendingImages(userId: string): void {
        this.pendingImages.delete(userId);
    }

    // Métodos para mensajes enviados por el bot
    public markMessageAsSent(userId: string, messageId: string): void {
        const messages = this.botSentMessages.get(userId) || new Set<string>();
        messages.add(messageId);
        this.botSentMessages.set(userId, messages);
    }

    public isMessageFromBot(userId: string, messageId: string): boolean {
        const messages = this.botSentMessages.get(userId);
        return messages ? messages.has(messageId) : false;
    }

    // Método adicional para verificar si un mensaje fue enviado por el bot (sin userId)
    public isBotSentMessage(messageId: string): boolean {
        // Buscar en todos los usuarios para ver si el mensaje fue enviado por el bot
        for (const [userId, messages] of this.botSentMessages.entries()) {
            if (messages.has(messageId)) {
                return true;
            }
        }
        return false;
    }

    // Método para agregar mensaje enviado por el bot (sin userId)
    public addBotSentMessage(messageId: string): void {
        // Usar un userId especial para mensajes globales del bot
        const globalBotUserId = '__bot_global__';
        this.markMessageAsSent(globalBotUserId, messageId);
    }

    public clearBotMessages(userId: string): void {
        this.botSentMessages.delete(userId);
    }

    // Métodos de utilidad
    public getStats(): { pendingImages: number; botMessages: number } {
        return {
            pendingImages: this.pendingImages.size,
            botMessages: this.botSentMessages.size,
        };
    }

    public cleanup(): void {
        // LRUCache maneja la limpieza automáticamente basándose en TTL
        // Este método está aquí por si necesitamos forzar una limpieza manual
        this.pendingImages.clear();
        this.botSentMessages.clear();
    }
}