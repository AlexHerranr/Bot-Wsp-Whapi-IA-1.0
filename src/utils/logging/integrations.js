"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logBeds24Response = logBeds24Response;
exports.logOpenAIPromptSent = logOpenAIPromptSent;
exports.logTokenUsage = logTokenUsage;
exports.logDatabaseOperation = logDatabaseOperation;
exports.logFunctionPerformance = logFunctionPerformance;
exports.logThreadUsage = logThreadUsage;
exports.logMessageFlowComplete = logMessageFlowComplete;
exports.sanitizeData = sanitizeData;
exports.extractKeyFromPrompt = extractKeyFromPrompt;
exports.compactArray = compactArray;
exports.logCriticalError = logCriticalError;
// src/utils/logging/integrations.ts - Integraciones para capturar datos específicos en puntos clave
const index_1 = require("./index");
const collectors_1 = require("./collectors");
// 🏨 Integración para Beds24 - Capturar respuesta completa
function logBeds24Response(userId, rawResponse, duration, success) {
    const details = {
        userId,
        rawResponse,
        duration,
        success,
        status: success ? 200 : 500
    };
    (0, index_1.logBeds24Raw)('Beds24 API response captured', details);
    (0, collectors_1.trackApiCall)('beds24');
}
// 🤖 Integración para OpenAI - Capturar prompt completo enviado
function logOpenAIPromptSent(userId, threadId, fullContent, length) {
    const details = {
        userId,
        threadId,
        fullContent,
        length,
        preview: fullContent.substring(0, 200) + '...'
    };
    (0, index_1.logOpenAIPrompt)('OpenAI prompt sent', details);
    (0, collectors_1.trackApiCall)('openai');
    (0, collectors_1.trackUser)(userId);
}
// 🔢 Integración para tokens - Capturar uso detallado
function logTokenUsage(userId, threadId, tokensIn, tokensOut, model = 'unknown') {
    const details = {
        userId,
        threadId,
        tokensIn,
        tokensOut,
        totalTokens: tokensIn + tokensOut,
        model
    };
    (0, index_1.logTokensMetric)('Token usage tracked', details);
}
// 💾 Integración para DB - Capturar operaciones
function logDatabaseOperation(userId, operation, duration, result, cacheUpdated = false) {
    const details = {
        userId,
        type: operation,
        time: duration,
        result: typeof result === 'object' ? JSON.stringify(result).substring(0, 100) : String(result),
        cacheUpdated
    };
    (0, index_1.logDbQuery)('Database operation tracked', details);
}
// ⚙️ Integración para funciones - Capturar performance detallada
function logFunctionPerformance(userId, functionName, totalDuration, apiTime = 0, dbTime = 0, calls = 1, errors = 0) {
    const details = {
        userId,
        functionName,
        duration: totalDuration,
        apiTime,
        dbTime,
        calls,
        errors
    };
    (0, index_1.logFuncPerf)('Function performance tracked', details);
    (0, collectors_1.trackFunction)();
    // Track latencies for system metrics
    (0, collectors_1.trackLatencies)({
        openaiLatency: 0, // Functions don't directly call OpenAI
        beds24Latency: apiTime,
        whapiLatency: 0,
        dbLatency: dbTime,
        totalLatency: totalDuration
    });
}
// 🧵 Integración para threads - Capturar métricas de thread
function logThreadUsage(userId, threadId, messageCount, tokenCount, reused, ageMinutes) {
    const details = {
        userId,
        threadId,
        messageCount,
        tokenCount,
        reused,
        ageMinutes
    };
    (0, index_1.logThreadMetric)('Thread usage tracked', details);
}
// 📊 Integración completa para flujo de mensaje - Capturar latencias end-to-end
function logMessageFlowComplete(userId, messageLength, openaiLatency, beds24Latency = 0, whapiLatency = 0, dbLatency = 0) {
    const totalLatency = openaiLatency + beds24Latency + whapiLatency + dbLatency;
    (0, collectors_1.trackMessage)(messageLength);
    (0, collectors_1.trackUser)(userId);
    (0, collectors_1.trackLatencies)({
        openaiLatency,
        beds24Latency,
        whapiLatency,
        dbLatency,
        totalLatency
    });
}
// 🔧 Helpers para formatear datos complejos
function sanitizeData(data, maxLength = 200) {
    if (typeof data === 'string') {
        return data.length > maxLength ? data.substring(0, maxLength) + '...' : data;
    }
    if (typeof data === 'object' && data !== null) {
        const json = JSON.stringify(data);
        return json.length > maxLength ? json.substring(0, maxLength) + '...' : json;
    }
    return String(data);
}
function extractKeyFromPrompt(prompt, key) {
    const regex = new RegExp(`${key}:\\s*([^\\n]+)`, 'i');
    const match = prompt.match(regex);
    return match ? match[1].trim() : '';
}
function compactArray(arr, maxItems = 5) {
    if (!Array.isArray(arr))
        return '[]';
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
function logCriticalError(userId, error, context = {}) {
    const details = {
        userId,
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3).join(' | '),
        context: sanitizeData(context, 100),
        timestamp: new Date().toISOString()
    };
    // Use existing error logging system
    Promise.resolve().then(() => require('./index')).then(({ logError }) => {
        logError('CRITICAL_ERROR', `Critical error occurred: ${error.message}`, details);
    });
}
