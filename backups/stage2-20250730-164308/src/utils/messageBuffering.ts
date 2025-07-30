// --- Sistema Inteligente de Buffering de Mensajes ---

interface MessageEndingPatterns {
    questions: string[];
    statements: string[];
    informal: string[];
    emojis: string[];
}

// Patrones que indican que un mensaje probablemente es final
const MESSAGE_ENDINGS: MessageEndingPatterns = {
    questions: ['?', '¿'],
    statements: ['.', '!', '!!', '...'],
    informal: ['ok', 'gracias', 'bye', 'chao', 'vale', 'listo', 'perfecto'],
    emojis: ['👍', '😊', '🙏', '✅', '👌', '💯', '🤝', '😄', '😁']
};

// Calcular timeout dinámico basado en la longitud del mensaje
export const calculateDynamicTimeout = (messageLength: number, hasTypingSupport: boolean = false): number => {
    // 🔧 PAUSAR BUFFERING INTELIGENTE: Si está desactivado, retornar 0
    if (process.env.DISABLE_MESSAGE_BUFFER === 'true') {
        return 0; // Sin timeout - procesamiento inmediato
    }
    
    // Si tiene soporte de typing, usar timeouts más agresivos
    if (hasTypingSupport) {
        if (messageLength <= 5) return 1000;   // 1 segundo
        if (messageLength <= 20) return 1500;  // 1.5 segundos
        if (messageLength <= 50) return 2000;  // 2 segundos
        return 3000; // 3 segundos máximo
    }
    
    // Sin typing support, usar timeouts más conservadores
    // Mensajes muy cortos (1-5 chars) probablemente vienen en grupo
    if (messageLength <= 5) return 3000;   // 3 segundos
    
    // Mensajes cortos (6-20 chars)
    if (messageLength <= 20) return 4000;  // 4 segundos
    
    // Mensajes medianos (21-50 chars)  
    if (messageLength <= 50) return 5000;  // 5 segundos
    
    // Mensajes largos (50+ chars) suelen ser finales
    return 6000; // 6 segundos máximo
};

// Detectar si un mensaje parece ser el final de una secuencia
export const isLikelyFinalMessage = (text: string): boolean => {
    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();
    
    // Mensajes muy cortos (<3 chars) raramente son finales
    if (trimmed.length < 3) return false;
    
    // Mensajes muy largos (>100 chars) suelen ser finales
    if (trimmed.length > 100) return true;
    
    // Verificar si termina con signos de puntuación definitivos
    for (const endings of Object.values(MESSAGE_ENDINGS)) {
        if (endings.some(end => {
            if (end.length === 1) {
                // Para caracteres únicos, verificar que sea el último
                return trimmed.endsWith(end);
            } else {
                // Para palabras/emojis, puede estar al final o ser el mensaje completo
                return lower === end || lower.endsWith(` ${end}`) || trimmed.endsWith(end);
            }
        })) {
            return true;
        }
    }
    
    // Mensajes que parecen comandos o respuestas cortas completas
    const commonCompletePhrases = [
        'si', 'no', 'bueno', 'dale', 'ya', 'ah ok', 'entiendo',
        'de acuerdo', 'esta bien', 'claro', 'por supuesto'
    ];
    
    if (commonCompletePhrases.includes(lower)) {
        return true;
    }
    
    return false;
};

// Analizar si deberíamos esperar más mensajes
export const shouldWaitForMore = (
    messages: string[], 
    lastMessageTime: number, 
    currentTime: number
): boolean => {
    // Si no hay mensajes, no esperar
    if (messages.length === 0) return false;
    
    const lastMessage = messages[messages.length - 1];
    const timeSinceLastMessage = currentTime - lastMessageTime;
    
    // Si ya pasó mucho tiempo (>5s), no esperar más
    if (timeSinceLastMessage > 5000) return false;
    
    // Si el último mensaje parece final, no esperar
    if (isLikelyFinalMessage(lastMessage)) return false;
    
    // Si es un mensaje muy corto y reciente, probablemente esperar
    if (lastMessage.length < 5 && timeSinceLastMessage < 1000) return true;
    
    // Si hay un patrón de mensajes cortos consecutivos, esperar
    if (messages.length >= 2) {
        const recentMessages = messages.slice(-3); // Últimos 3 mensajes
        const allShort = recentMessages.every(msg => msg.length < 20);
        if (allShort && timeSinceLastMessage < 2000) return true;
    }
    
    return false;
};

// Obtener timeout recomendado para el próximo mensaje
export const getRecommendedTimeout = (
    messages: string[],
    lastMessage: string,
    hasTypingSupport: boolean = false
): number => {
    // 🔧 PAUSAR BUFFERING INTELIGENTE: Si está desactivado, retornar 0
    if (process.env.DISABLE_MESSAGE_BUFFER === 'true') {
        return 0; // Sin timeout - procesamiento inmediato
    }
    
    // Si el mensaje parece final, timeout corto pero no demasiado
    if (isLikelyFinalMessage(lastMessage)) {
        return hasTypingSupport ? 800 : 2000; // Con typing: 0.8s, sin typing: 2s
    }
    
    // Si hay múltiples mensajes cortos, anticipar más
    if (messages.length >= 2 && messages.every(m => m.length < 20)) {
        return hasTypingSupport ? 1500 : 3000; // Con typing: 1.5s, sin typing: 3s
    }
    
    // Usar timeout dinámico basado en longitud
    return calculateDynamicTimeout(lastMessage.length, hasTypingSupport);
};

// Estadísticas para debugging
export const getBufferStats = (messages: string[]): object => {
    const totalLength = messages.reduce((sum, msg) => sum + msg.length, 0);
    const avgLength = messages.length > 0 ? totalLength / messages.length : 0;
    
    return {
        messageCount: messages.length,
        totalLength,
        averageLength: Math.round(avgLength),
        hasLikelyFinal: messages.some(isLikelyFinalMessage),
        recommendedAction: messages.length > 0 && isLikelyFinalMessage(messages[messages.length - 1]) 
            ? 'process_now' 
            : 'wait'
    };
}; 