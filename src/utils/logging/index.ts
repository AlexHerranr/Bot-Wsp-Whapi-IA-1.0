// src/utils/logging/index.ts

const IS_PRODUCTION = process.env.NODE_ENV === 'production' || !!process.env.K_SERVICE;
const DETAILED_LOGS = process.env.ENABLE_DETAILED_LOGS === 'true' || !IS_PRODUCTION;

type LogLevel = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

// --- Mapeo de etapas del flujo y helpers añadidos ---
const STAGE_MAP: Record<string, string> = {
    'MESSAGE_RECEIVED': '1_receive',
    'MESSAGE_BUFFER': '2_buffer',
    'MESSAGE_PROCESS': '3_process',
    'BEDS24_REQUEST': '4_beds_request',
    'BEDS24_RESPONSE': '5_beds_response',
    'OPENAI_PAYLOAD': '6_ai_request',
    'OPENAI_RESPONSE': '7_ai_response',
    'WHATSAPP_SEND': '8_send',
    'MESSAGE_SENT': '9_complete'
};

// Lleva la cuenta de la posición que ocupa cada log dentro de un mismo flujo (messageId)
const messageSequenceMap = new Map<string, number>();

function getFlowStage(category: string): string {
    return STAGE_MAP[category.toUpperCase()] || '0_unknown';
}

function getSequenceNumber(category: string, messageId?: string): number | undefined {
    if (!messageId) return undefined;
    const key = String(messageId);
    const seq = (messageSequenceMap.get(key) || 0) + 1;
    messageSequenceMap.set(key, seq);
    return seq;
}

function enrichedLog(
    category: string, 
    message: string, 
    details: Record<string, any> = {}, 
    level: LogLevel = 'INFO'
) {
    const stage = getFlowStage(category);
    const sequence = getSequenceNumber(category, details?.messageId);

    const logEntry = {
        timestamp: new Date().toISOString(),
        severity: level,
        message: `[${category.toUpperCase()}] ${message}`,
        labels: {
            app: 'whatsapp-bot',
            category: category.toUpperCase(),
            level,
            flow_stage: stage,
            ...(details.messageId && { message_id: String(details.messageId) }),
            ...(details.userId && { user_id: String(details.userId) }),
        },
        jsonPayload: {
            category: category.toUpperCase(),
            level,
            timestamp: new Date().toISOString(),
            flow: {
                stage,
                sequence,
            },
            ...(details && Object.keys(details).length > 0 ? details : {}),
            environment: IS_PRODUCTION ? 'cloud-run' : 'local',
        }
    };
    
    const logMethod = {
        'ERROR': console.error,
        'WARNING': console.warn,
        'SUCCESS': console.log,
        'INFO': console.log
    }[level];

    if (IS_PRODUCTION) {
        logMethod(JSON.stringify(logEntry));
    } else {
        const emoji = { 'SUCCESS': '✅', 'ERROR': '❌', 'WARNING': '⚠️', 'INFO': 'ℹ️' }[level];
        console.log(`${emoji} [${category.toUpperCase()}] ${message}`);
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