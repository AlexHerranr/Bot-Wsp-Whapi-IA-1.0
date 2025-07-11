// src/utils/logging/index.ts

import { config } from '../../config/environment.js';
import { VALID_CATEGORIES, ValidCategory, normalizeCategory } from './category-mapper.js';

const IS_PRODUCTION = config.environment === 'cloud-run';
const DETAILED_LOGS = config.enableDetailedLogs;

// Rate limiting por categoría (logs por minuto)
const RATE_LIMITS: { [key in ValidCategory]?: number } = {
    'HEALTH_CHECK': 10,
    'MESSAGE_BUFFER': 50,
    'USER_DEBUG': 50,
    'THREAD_STATE': 20,
};

const rateLimitCounters = new Map<string, number>();
setInterval(() => rateLimitCounters.clear(), 60000); // Limpiar cada minuto

function checkRateLimit(category: ValidCategory): boolean {
    const limit = RATE_LIMITS[category];
    if (!limit) return true;

    const count = rateLimitCounters.get(category) || 0;
    if (count >= limit) {
        if (count === limit) { // Loguear solo la primera vez que se excede
             console.warn(`🚦 RATE LIMITED: Categoría '${category}' excedió límite de ${limit} logs/min.`);
             rateLimitCounters.set(category, count + 1);
        }
        return false;
    }
    rateLimitCounters.set(category, count + 1);
    return true;
}

function enrichedLog(
    category: string, 
    message: string, 
    details: Record<string, any> = {}, 
    levelOverride?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
) {
    const normalizedCategory = normalizeCategory(category);
    
    if (!checkRateLimit(normalizedCategory)) {
        return;
    }

    const categoryConfig = VALID_CATEGORIES[normalizedCategory];
    const level = levelOverride || categoryConfig.level;
    const component = categoryConfig.component;

    const logEntry = {
        timestamp: new Date().toISOString(),
        message: `[${normalizedCategory}] ${message}`,
        labels: {
            app: 'whatsapp-bot',
            category: normalizedCategory,
            component,
            level,
            ...(details.userId && { userId: String(details.userId) }),
        },
        jsonPayload: {
            category: normalizedCategory,
            level,
            ...(details.userId && { userId: String(details.userId) }),
            details: Object.keys(details).length > 0 ? details : undefined,
            environment: config.environment,
            ...(category.toUpperCase() !== normalizedCategory && { originalCategory: category.toUpperCase() })
        }
    };
    
    const logMethod = {
        'ERROR': console.error,
        'WARNING': console.warn,
        'SUCCESS': console.log,
        'INFO': console.log
    }[level] || console.log;

    if (IS_PRODUCTION) {
        logMethod(JSON.stringify(logEntry));
    } else {
        const emoji = { 'SUCCESS': '✅', 'ERROR': '❌', 'WARNING': '⚠️', 'INFO': 'ℹ️' }[level] || '📝';
        console.log(`${emoji} [${normalizedCategory}] ${message}`);
        if (DETAILED_LOGS && Object.keys(details).length > 0) {
            console.log(`   📊 Detalles:`, JSON.stringify(details, null, 2));
        }
    }
}

// Exportar funciones de logging específicas y genéricas
export const logInfo = (cat: string, msg: string, details?: Record<string, any>) => enrichedLog(cat, msg, details, 'INFO');
export const logSuccess = (cat: string, msg: string, details?: Record<string, any>) => enrichedLog(cat, msg, details, 'SUCCESS');
export const logWarning = (cat: string, msg: string, details?: Record<string, any>) => enrichedLog(cat, msg, details, 'WARNING');
export const logError = (cat: string, msg: string, details?: Record<string, any>) => enrichedLog(cat, msg, details, 'ERROR');
export const logDebug = (cat: string, msg: string, details?: Record<string, any>) => {
    if (DETAILED_LOGS) {
        enrichedLog(cat, `[DEBUG] ${msg}`, details, 'INFO');
    }
};

// Se mantienen las funciones específicas para facilitar la refactorización, pero ahora usan enrichedLog
export const logMessageReceived = (msg: string, details?: Record<string, any>) => enrichedLog('MESSAGE_RECEIVED', msg, details);
export const logMessageProcess = (msg: string, details?: Record<string, any>) => enrichedLog('MESSAGE_PROCESS', msg, details);
export const logWhatsAppSend = (msg: string, details?: Record<string, any>) => enrichedLog('WHATSAPP_SEND', msg, details);
export const logWhatsAppChunksComplete = (msg: string, details?: Record<string, any>) => enrichedLog('WHATSAPP_CHUNKS_COMPLETE', msg, details);
export const logOpenAIRequest = (msg: string, details?: Record<string, any>) => enrichedLog('OPENAI_REQUEST', msg, details);
export const logOpenAIResponse = (msg: string, details?: Record<string, any>) => enrichedLog('OPENAI_RESPONSE', msg, details);
export const logFunctionCallingStart = (msg: string, details?: Record<string, any>) => enrichedLog('FUNCTION_CALLING_START', msg, details);
export const logFunctionExecuting = (msg: string, details?: Record<string, any>) => enrichedLog('FUNCTION_EXECUTING', msg, details);
export const logFunctionHandler = (msg: string, details?: Record<string, any>) => enrichedLog('FUNCTION_HANDLER', msg, details);
export const logBeds24Request = (msg: string, details?: Record<string, any>) => enrichedLog('BEDS24_REQUEST', msg, details);
export const logBeds24ApiCall = (msg: string, details?: Record<string, any>) => enrichedLog('BEDS24_API_CALL', msg, details);
export const logBeds24ResponseDetail = (msg: string, details?: Record<string, any>) => enrichedLog('BEDS24_RESPONSE_DETAIL', msg, details);
export const logBeds24Processing = (msg: string, details?: Record<string, any>) => enrichedLog('BEDS24_PROCESSING', msg, details);
export const logThreadCreated = (msg: string, details?: Record<string, any>) => enrichedLog('THREAD_CREATED', msg, details);
export const logThreadPersist = (msg: string, details?: Record<string, any>) => enrichedLog('THREAD_PERSIST', msg, details);
export const logThreadCleanup = (msg: string, details?: Record<string, any>) => enrichedLog('THREAD_CLEANUP', msg, details);
export const logServerStart = (msg: string, details?: Record<string, any>) => enrichedLog('SERVER_START', msg, details);
export const logBotReady = (msg: string, details?: Record<string, any>) => enrichedLog('BOT_READY', msg, details); 