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
    'MESSAGE_SENT': '9_complete',
    'HISTORY_INJECT': '6_ai_request',
    'LABELS_INJECT': '6_ai_request',
    'CONTEXT_INJECT': '6_ai_request',
    'LOOP_DETECTED': '0_unknown'
};

// Lleva la cuenta de la posición que ocupa cada log dentro de un mismo flujo (messageId)
const messageSequenceMap = new Map<string, number>();

// 🔧 ETAPA 10: Detección de loops mejorada
const loopDetectionMap = new Map<string, { count: number; firstSeen: number; lastSeen: number }>();

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

// 🔧 ETAPA 10: Detectar loops en respuestas de fallback
function detectLoopPattern(message: string, userId?: string): boolean {
    const loopPatterns = [
        'Las funciones se ejecutaron correctamente',
        'no pude generar una respuesta final',
        'Por favor intenta de nuevo',
        'hubo un problema procesando'
    ];
    
    const hasLoopPattern = loopPatterns.some(pattern => message.includes(pattern));
    
    if (hasLoopPattern && userId) {
        const now = Date.now();
        const userLoopData = loopDetectionMap.get(userId) || { count: 0, firstSeen: now, lastSeen: now };
        
        // Si es la primera vez o han pasado más de 5 minutos, resetear contador
        if (now - userLoopData.lastSeen > 5 * 60 * 1000) {
            userLoopData.count = 1;
            userLoopData.firstSeen = now;
        } else {
            userLoopData.count++;
        }
        
        userLoopData.lastSeen = now;
        loopDetectionMap.set(userId, userLoopData);
        
        // Alertar si hay más de 2 respuestas de fallback en 5 minutos
        if (userLoopData.count >= 3) {
            console.warn(`🚨 [LOOP_DETECTED] Usuario ${userId} ha recibido ${userLoopData.count} respuestas de fallback en ${Math.round((now - userLoopData.firstSeen) / 1000)}s`);
            return true;
        }
    }
    
    return false;
}

function enrichedLog(
    category: string, 
    message: string, 
    details: Record<string, any> = {}, 
    level: LogLevel = 'INFO'
) {
    // Omitir debug en prod para ciertas categorías
    if (IS_PRODUCTION && ['THREAD_DEBUG', 'BUFFER_TIMER_RESET'].includes(category)) {
        return;
    }
    
    // 🔧 ETAPA 10: Detección de loops mejorada
    const userId = details?.userId || details?.shortUserId;
    const isLoopDetected = detectLoopPattern(message, userId);
    
    if (isLoopDetected) {
        level = 'WARNING'; // Elevar nivel si se detecta loop
        details.loopDetected = true;
        details.loopPattern = 'fallback_response';
    }
    
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
export const logInfo = (cat: string, msg: string, details?: Record<string, any>) => {
    if (cat === 'MESSAGE_BUFFERED' && details?.bufferCount <= 1 && IS_PRODUCTION) return;  // Omitir si bufferCount <=1 en prod
    if (cat === 'BUFFER_TIMER_RESET' && IS_PRODUCTION) return;  // Omitir resets en prod
    enrichedLog(cat, msg, details, 'INFO');
};
export const logSuccess = (cat: string, msg: string, details?: Record<string, any>) => enrichedLog(cat, msg, details, 'SUCCESS');
export const logWarning = (cat: string, msg: string, details?: Record<string, any>) => enrichedLog(cat, msg, details, 'WARNING');
export const logError = (cat: string, msg: string, details?: Record<string, any>) => enrichedLog(cat, msg, details, 'ERROR');
export const logDebug = (cat: string, msg: string, details?: Record<string, any>) => {
    if (DETAILED_LOGS && !IS_PRODUCTION) {  // Solo en no-production o si detailed enabled
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