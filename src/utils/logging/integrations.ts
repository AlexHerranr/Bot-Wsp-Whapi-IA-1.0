// src/utils/logging/integrations.ts - Integraciones para capturar datos específicos en puntos clave
import { 
    logBeds24Raw, 
    logOpenAIPrompt, 
    logTokensMetric, 
    logDbQuery, 
    logFuncPerf, 
    logThreadMetric 
} from './index';
import { trackMessage, trackFunction, trackLatencies, trackUser, trackApiCall } from './collectors';

// 🏨 Integración para Beds24 - Capturar respuesta completa
export function logBeds24Response(userId: string, rawResponse: any, duration: string, success: boolean) {
    const details = {
        userId,
        rawResponse,
        duration,
        success,
        status: success ? 200 : 500
    };
    
    logBeds24Raw('Beds24 API response captured', details);
    trackApiCall('beds24');
}

// 🤖 Integración para OpenAI - Capturar prompt completo enviado
export function logOpenAIPromptSent(userId: string, threadId: string, fullContent: string, length: number) {
    const details = {
        userId,
        threadId,
        fullContent,
        length,
        preview: fullContent.substring(0, 200) + '...'
    };
    
    logOpenAIPrompt('OpenAI prompt sent', details);
    trackApiCall('openai');
    trackUser(userId);
}

// 🔢 Integración para tokens - Capturar uso detallado
export function logTokenUsage(userId: string, threadId: string, tokensIn: number, tokensOut: number, model: string = 'gpt-4') {
    const details = {
        userId,
        threadId,
        tokensIn,
        tokensOut,
        totalTokens: tokensIn + tokensOut,
        model
    };
    
    logTokensMetric('Token usage tracked', details);
}

// 💾 Integración para DB - Capturar operaciones
export function logDatabaseOperation(userId: string, operation: string, duration: number, result: any, cacheUpdated: boolean = false) {
    const details = {
        userId,
        type: operation,
        time: duration,
        result: typeof result === 'object' ? JSON.stringify(result).substring(0, 100) : String(result),
        cacheUpdated
    };
    
    logDbQuery('Database operation tracked', details);
}

// ⚙️ Integración para funciones - Capturar performance detallada
export function logFunctionPerformance(
    userId: string, 
    functionName: string, 
    totalDuration: number, 
    apiTime: number = 0, 
    dbTime: number = 0,
    calls: number = 1,
    errors: number = 0
) {
    const details = {
        userId,
        functionName,
        duration: totalDuration,
        apiTime,
        dbTime,
        calls,
        errors
    };
    
    logFuncPerf('Function performance tracked', details);
    trackFunction();
    
    // Track latencies for system metrics
    trackLatencies({
        openaiLatency: 0, // Functions don't directly call OpenAI
        beds24Latency: apiTime,
        whapiLatency: 0,
        dbLatency: dbTime,
        totalLatency: totalDuration
    });
}

// 🧵 Integración para threads - Capturar métricas de thread
export function logThreadUsage(userId: string, threadId: string, messageCount: number, tokenCount: number, reused: boolean, ageMinutes: number) {
    const details = {
        userId,
        threadId,
        messageCount,
        tokenCount,
        reused,
        ageMinutes
    };
    
    logThreadMetric('Thread usage tracked', details);
}

// 📊 Integración completa para flujo de mensaje - Capturar latencias end-to-end
export function logMessageFlowComplete(
    userId: string, 
    messageLength: number,
    openaiLatency: number,
    beds24Latency: number = 0,
    whapiLatency: number = 0,
    dbLatency: number = 0
) {
    const totalLatency = openaiLatency + beds24Latency + whapiLatency + dbLatency;
    
    trackMessage(messageLength);
    trackUser(userId);
    trackLatencies({
        openaiLatency,
        beds24Latency,
        whapiLatency,
        dbLatency,
        totalLatency
    });
}

// 🔧 Helpers para formatear datos complejos
export function sanitizeData(data: any, maxLength: number = 200): string {
    if (typeof data === 'string') {
        return data.length > maxLength ? data.substring(0, maxLength) + '...' : data;
    }
    
    if (typeof data === 'object' && data !== null) {
        const json = JSON.stringify(data);
        return json.length > maxLength ? json.substring(0, maxLength) + '...' : json;
    }
    
    return String(data);
}

export function extractKeyFromPrompt(prompt: string, key: string): string {
    const regex = new RegExp(`${key}:\\s*([^\\n]+)`, 'i');
    const match = prompt.match(regex);
    return match ? match[1].trim() : '';
}

export function compactArray(arr: any[], maxItems: number = 5): string {
    if (!Array.isArray(arr)) return '[]';
    
    const items = arr.slice(0, maxItems).map(item => {
        if (typeof item === 'object' && item !== null) {
            // For Beds24 rooms/offers, extract key info
            if (item.propertyId && item.offers) {
                const offer = item.offers[0] || {};
                return `${item.propertyId}:${offer.price || 0}:${offer.unitsAvailable || 0}`;
            }
            return JSON.stringify(item);
        }
        return String(item);
    }).join('|');
    
    const suffix = arr.length > maxItems ? `|...(+${arr.length - maxItems})` : '';
    return items + suffix;
}

// 🚨 Integración para errores críticos con contexto
export function logCriticalError(userId: string | null, error: Error, context: Record<string, any> = {}) {
    const details = {
        userId,
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3).join(' | '),
        context: sanitizeData(context, 100),
        timestamp: new Date().toISOString()
    };
    
    // Use existing error logging system
    import('./index').then(({ logError }) => {
        logError('CRITICAL_ERROR', `Critical error occurred: ${error.message}`, details);
    });
}