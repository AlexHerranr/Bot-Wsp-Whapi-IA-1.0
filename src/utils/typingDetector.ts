// --- Sistema de Detección Automática de Typing ---

interface UserTypingCapability {
    userId: string;
    hasTypingSupport: boolean;
    lastTypingEvent: number;
    confidenceScore: number; // 0-100, qué tan seguros estamos
    messagesWithoutTyping: number;
    typingEventsReceived: number;
}

class TypingDetector {
    private userCapabilities = new Map<string, UserTypingCapability>();
    private readonly CONFIDENCE_THRESHOLD = 70; // % de confianza para considerar que SÍ tiene typing
    private readonly MAX_MESSAGES_WITHOUT_TYPING = 5; // Después de 5 mensajes sin typing, asumir que no tiene
    
    // Registrar evento de typing recibido
    recordTypingEvent(userId: string): void {
        const capability = this.getOrCreateCapability(userId);
        
        capability.hasTypingSupport = true;
        capability.lastTypingEvent = Date.now();
        capability.typingEventsReceived++;
        capability.confidenceScore = Math.min(100, capability.confidenceScore + 20);
        
        this.userCapabilities.set(userId, capability);
    }
    
    // Registrar mensaje recibido (para detectar ausencia de typing)
    recordMessage(userId: string): void {
        const capability = this.getOrCreateCapability(userId);
        
        // Si no hemos recibido typing en mucho tiempo, reducir confianza
        const timeSinceLastTyping = Date.now() - capability.lastTypingEvent;
        if (timeSinceLastTyping > 60000) { // 1 minuto
            capability.messagesWithoutTyping++;
            capability.confidenceScore = Math.max(0, capability.confidenceScore - 10);
        }
        
        // Si muchos mensajes sin typing, marcar como no compatible
        if (capability.messagesWithoutTyping >= this.MAX_MESSAGES_WITHOUT_TYPING) {
            capability.hasTypingSupport = false;
            capability.confidenceScore = 0;
        }
        
        this.userCapabilities.set(userId, capability);
    }
    
    // Verificar si usuario tiene soporte de typing
    hasTypingSupport(userId: string): boolean {
        const capability = this.userCapabilities.get(userId);
        
        if (!capability) {
            // Usuario nuevo - asumimos que NO tiene typing hasta probar lo contrario
            return false;
        }
        
        // Retornar basado en confianza
        return capability.hasTypingSupport && capability.confidenceScore >= this.CONFIDENCE_THRESHOLD;
    }
    
    // Obtener o crear capacidad de usuario
    private getOrCreateCapability(userId: string): UserTypingCapability {
        if (!this.userCapabilities.has(userId)) {
            this.userCapabilities.set(userId, {
                userId,
                hasTypingSupport: false,
                lastTypingEvent: 0,
                confidenceScore: 0,
                messagesWithoutTyping: 0,
                typingEventsReceived: 0
            });
        }
        
        return this.userCapabilities.get(userId)!;
    }
    
    // Obtener estadísticas del sistema
    getStats(): object {
        const stats = {
            totalUsers: this.userCapabilities.size,
            usersWithTyping: 0,
            usersWithoutTyping: 0,
            averageConfidence: 0
        };
        
        let totalConfidence = 0;
        
        for (const capability of this.userCapabilities.values()) {
            if (this.hasTypingSupport(capability.userId)) {
                stats.usersWithTyping++;
            } else {
                stats.usersWithoutTyping++;
            }
            totalConfidence += capability.confidenceScore;
        }
        
        stats.averageConfidence = stats.totalUsers > 0 
            ? Math.round(totalConfidence / stats.totalUsers) 
            : 0;
        
        return stats;
    }
    
    // Obtener info detallada de usuario
    getUserInfo(userId: string): UserTypingCapability | null {
        return this.userCapabilities.get(userId) || null;
    }
    
    // Limpiar usuarios inactivos
    cleanup(maxInactivityMs: number = 86400000): number { // 24 horas por defecto
        const now = Date.now();
        let cleaned = 0;
        
        for (const [userId, capability] of this.userCapabilities.entries()) {
            const lastActivity = Math.max(capability.lastTypingEvent, now - (capability.messagesWithoutTyping * 60000));
            
            if (now - lastActivity > maxInactivityMs) {
                this.userCapabilities.delete(userId);
                cleaned++;
            }
        }
        
        return cleaned;
    }
}

// Instancia global del detector
export const typingDetector = new TypingDetector();

// Funciones de utilidad
export const recordTypingEvent = (userId: string) => typingDetector.recordTypingEvent(userId);
export const recordMessage = (userId: string) => typingDetector.recordMessage(userId);
export const hasTypingSupport = (userId: string) => typingDetector.hasTypingSupport(userId);
export const getTypingStats = () => typingDetector.getStats();
export const getUserTypingInfo = (userId: string) => typingDetector.getUserInfo(userId); 