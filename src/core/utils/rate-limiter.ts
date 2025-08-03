// src/core/utils/rate-limiter.ts
// Manejo de rate limiting para webhooks y logs (según plan de migración)

// Rate limiting global para webhooks spam (migrado del monolítico)
const webhookCounts = new Map<string, { lastLog: number; count: number }>();

// Rate limiting para logs de typing: solo cada 5s (migrado del monolítico)  
const typingLogTimestamps = new Map<string, number>();

export class RateLimiter {
    /**
     * Verifica si un webhook inválido debe ser loggeado
     * Solo permite 1 log por minuto para evitar spam
     */
    static shouldLogInvalidWebhook(): boolean {
        const webhookKey = 'invalid_webhook';
        const now = Date.now();
        
        if (!webhookCounts.has(webhookKey) || (now - webhookCounts.get(webhookKey)!.lastLog) > 60000) {
            webhookCounts.set(webhookKey, { 
                lastLog: now, 
                count: (webhookCounts.get(webhookKey)?.count || 0) + 1 
            });
            return true;
        }
        
        return false;
    }

    /**
     * Verifica si un log de typing debe ser mostrado
     * Solo permite 1 log cada 5 segundos por usuario
     */
    static shouldLogTyping(userId: string): boolean {
        const now = Date.now();
        const lastLog = typingLogTimestamps.get(userId) || 0;
        
        if (now - lastLog > 5000) {
            typingLogTimestamps.set(userId, now);
            return true;
        }
        
        return false;
    }

    /**
     * Limpieza periódica de mapas para evitar memory leaks
     * Debe ejecutarse cada hora como mantenimiento
     */
    static cleanup(): void {
        const now = Date.now();
        const maxAge = 60 * 60 * 1000; // 1 hora

        // Limpiar webhook counts
        for (const [key, data] of webhookCounts.entries()) {
            if (now - data.lastLog > maxAge) {
                webhookCounts.delete(key);
            }
        }

        // Limpiar typing timestamps
        for (const [userId, timestamp] of typingLogTimestamps.entries()) {
            if (now - timestamp > maxAge) {
                typingLogTimestamps.delete(userId);
            }
        }
    }

    /**
     * Obtener estadísticas de rate limiting
     */
    static getStats(): { webhookCounts: number, typingTimestamps: number } {
        return {
            webhookCounts: webhookCounts.size,
            typingTimestamps: typingLogTimestamps.size
        };
    }
}