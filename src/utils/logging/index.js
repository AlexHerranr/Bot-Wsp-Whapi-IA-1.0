"use strict";
// src/utils/logging/index.ts - Updated with Voice/Image optimizations
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAlert = exports.logFatal = exports.logTrace = exports.logFallback = exports.logRateWarn = exports.logSysMetric = exports.logFuncPerf = exports.logThreadMetric = exports.logBufferMetric = exports.logCacheMetric = exports.logDbQuery = exports.logUsageStats = exports.logLatencyMetric = exports.logTokensMetric = exports.logOpenAIPrompt = exports.logBeds24Raw = exports.logFlowStageUpdate = exports.logAssistantNoResponse = exports.logToolOutputsSubmitted = exports.logRequestTracing = exports.logPerformanceMetrics = exports.logFallbackTriggered = exports.logBeds24Metrics = exports.logFunctionCallingMetrics = exports.logContextTokens = exports.logOpenAIUsage = exports.logOpenAILatency = exports.logOpenAITokens = exports.logBotReady = exports.logServerStart = exports.logThreadCleanup = exports.logThreadPersist = exports.logThreadCreated = exports.logBeds24Processing = exports.logBeds24ResponseDetail = exports.logBeds24ApiCall = exports.logBeds24Request = exports.logFunctionHandler = exports.logFunctionExecuting = exports.logFunctionCallingStart = exports.logOpenAIResponse = exports.logOpenAIRequest = exports.logWhatsAppChunksComplete = exports.logWhatsAppSend = exports.logMessageProcess = exports.logDebug = exports.logError = exports.logWarning = exports.logSuccess = exports.logInfo = void 0;
exports.startRequestTracing = startRequestTracing;
exports.updateRequestStage = updateRequestStage;
exports.registerToolCall = registerToolCall;
exports.updateToolCallStatus = updateToolCallStatus;
exports.endRequestTracing = endRequestTracing;
exports.generateRequestId = generateRequestId;
// Dashboard disabled - monitoring removed
// import { botDashboard } from '../monitoring/dashboard';
const fs_1 = require("fs");
const path_1 = require("path");
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || !!process.env.K_SERVICE;
const DETAILED_LOGS = process.env.ENABLE_DETAILED_LOGS === 'true' || !IS_PRODUCTION;
const LOG_LEVEL = process.env.LOG_LEVEL || (IS_PRODUCTION ? 'info' : 'debug'); // debug, info, warn, error
// Contador de líneas solo para Railway (producción)
let railwayLogCounter = 0;
let railwayLogBuffer = [];
// Configuración de verbosidad para Railway
const RAILWAY_COMPACT_MODE = process.env.RAILWAY_COMPACT_LOGS !== 'false'; // true por defecto
// Configuración de archivos de log para desarrollo local
const LOG_DIR = IS_PRODUCTION ? 'logs' : 'logs/Local';
const SESSION_TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const LOG_FILE = path_1.default.join(LOG_DIR, `bot-session-${SESSION_TIMESTAMP}.log`);
const MAX_SESSIONS = 5; // Máximo número de sesiones a mantener
// Función para escribir logs Railway a archivo cada 500 líneas
const writeRailwayLogChunk = () => {
    if (!IS_PRODUCTION || railwayLogBuffer.length === 0)
        return;
    try {
        // Crear directorio si no existe
        if (!fs_1.default.existsSync(LOG_DIR)) {
            fs_1.default.mkdirSync(LOG_DIR, { recursive: true });
        }
        const chunkNumber = Math.ceil(railwayLogCounter / 500);
        const railwayLogFile = path_1.default.join(LOG_DIR, `railway-logs-chunk-${chunkNumber}-${SESSION_TIMESTAMP}.log`);
        // Header del chunk
        const chunkHeader = `
=============================
📊 Railway Logs Chunk ${chunkNumber} - ${new Date().toLocaleString('es-CO')}
=============================
Líneas: ${(chunkNumber - 1) * 500 + 1} - ${railwayLogCounter}
Sesión: ${SESSION_TIMESTAMP}
PID: ${process.pid}
Environment: Railway Production
=============================

`;
        // Escribir chunk con header
        const chunkContent = chunkHeader + railwayLogBuffer.join('\n') + '\n';
        fs_1.default.writeFileSync(railwayLogFile, chunkContent);
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            severity: 'INFO',
            message: `[LOG_FILE_CREATED] Chunk ${chunkNumber} guardado: ${railwayLogFile}`,
            labels: {
                app: 'whatsapp-bot',
                category: 'LOG_FILE_CREATED',
                level: 'INFO',
                chunkNumber,
                fileName: railwayLogFile
            }
        }));
        // Limpiar buffer
        railwayLogBuffer = [];
    }
    catch (error) {
        console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            severity: 'ERROR',
            message: `[LOG_FILE_ERROR] Error escribiendo chunk Railway: ${error.message}`,
            labels: {
                app: 'whatsapp-bot',
                category: 'LOG_FILE_ERROR',
                level: 'ERROR'
            }
        }));
    }
};
// Función para limpiar sesiones antiguas
const cleanupOldSessions = () => {
    try {
        // Asegurar que el directorio existe
        if (!fs_1.default.existsSync(LOG_DIR)) {
            fs_1.default.mkdirSync(LOG_DIR, { recursive: true });
        }
        // Obtener todos los archivos de sesión
        const files = fs_1.default.readdirSync(LOG_DIR)
            .filter(file => file.startsWith('bot-session-') && file.endsWith('.log'))
            .map(file => ({
            name: file,
            path: path_1.default.join(LOG_DIR, file),
            stats: fs_1.default.statSync(path_1.default.join(LOG_DIR, file))
        }))
            .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime()); // Más recientes primero
        // Si hay más archivos que el máximo permitido, eliminar los más antiguos
        if (files.length >= MAX_SESSIONS) {
            const filesToDelete = files.slice(MAX_SESSIONS - 1); // Dejar espacio para la nueva sesión
            filesToDelete.forEach(file => {
                try {
                    fs_1.default.unlinkSync(file.path);
                    console.log(`🗑️ Sesión antigua eliminada: ${file.name}`);
                }
                catch (error) {
                    console.error(`Error eliminando ${file.name}:`, error);
                }
            });
        }
    }
    catch (error) {
        console.error('Error limpiando sesiones antiguas:', error);
    }
};
// Inicializar archivo de log si estamos en desarrollo
let logFileInitialized = false;
const initializeLogFile = () => {
    if (!logFileInitialized && !IS_PRODUCTION) {
        try {
            if (!fs_1.default.existsSync(LOG_DIR)) {
                fs_1.default.mkdirSync(LOG_DIR, { recursive: true });
            }
            // Limpiar sesiones antiguas antes de crear la nueva
            cleanupOldSessions();
            const sessionHeader = `
=============================
📋 Nueva Sesión de Bot - ${new Date().toLocaleString('es-CO')}
=============================
Sesión: ${SESSION_TIMESTAMP}
PID: ${process.pid}
Node Version: ${process.version}
Environment: Local Development
=============================

`;
            fs_1.default.writeFileSync(LOG_FILE, sessionHeader);
            console.log(`📁 Logs de esta sesión: ${LOG_FILE}`);
            logFileInitialized = true;
        }
        catch (error) {
            console.error('Error inicializando archivo de log:', error.message);
        }
    }
};
// Mapeo de niveles para comparación
const LOG_LEVELS = {
    'debug': 0,
    'info': 1,
    'warn': 2,
    'error': 3
};
// Función para verificar si un nivel debe ser loggeado
function shouldLog(level) {
    const currentLevel = LOG_LEVELS[LOG_LEVEL.toLowerCase()] || 1;
    const messageLevel = level === 'DEBUG' || level === 'TRACE' ? 0 :
        level === 'INFO' || level === 'SUCCESS' ? 1 :
            level === 'WARNING' ? 2 : 3;
    return messageLevel >= currentLevel;
}
// 🔧 ETAPA 3: Sistema de tracing con requestId
const activeRequests = new Map();
// 🔧 ETAPA 3: Generar requestId único
function generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
// 🔧 ETAPA 3: Iniciar tracing de request
function startRequestTracing(userId) {
    const requestId = generateRequestId();
    activeRequests.set(requestId, {
        requestId,
        userId,
        startTime: Date.now(),
        flowStage: 'init',
        toolCalls: [],
        contextTokens: 0,
        totalTokens: 0
    });
    return requestId;
}
// 🔧 ETAPA 3: Actualizar etapa del flujo
function updateRequestStage(requestId, stage) {
    const request = activeRequests.get(requestId);
    if (request) {
        request.flowStage = stage;
    }
}
// 🔧 ETAPA 3: Registrar tool call
function registerToolCall(requestId, toolCallId, functionName, status = 'pending') {
    const request = activeRequests.get(requestId);
    if (request) {
        request.toolCalls.push({ id: toolCallId, functionName, status });
    }
}
// 🔧 ETAPA 3: Actualizar status de tool call
function updateToolCallStatus(requestId, toolCallId, status) {
    const request = activeRequests.get(requestId);
    if (request) {
        const toolCall = request.toolCalls.find(tc => tc.id === toolCallId);
        if (toolCall) {
            toolCall.status = status;
        }
    }
}
// 🔧 ETAPA 3: Finalizar tracing de request
function endRequestTracing(requestId) {
    const request = activeRequests.get(requestId);
    if (request) {
        const duration = Date.now() - request.startTime;
        const summary = {
            requestId: request.requestId,
            userId: request.userId,
            duration,
            flowStage: request.flowStage,
            toolCallsCount: request.toolCalls.length,
            toolCalls: request.toolCalls,
            contextTokens: request.contextTokens,
            totalTokens: request.totalTokens,
            success: request.flowStage === 'completed'
        };
        activeRequests.delete(requestId);
        return summary;
    }
    return null;
}
// --- Mapeo de etapas del flujo y helpers añadidos ---
const STAGE_MAP = {
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
    'LOOP_DETECTED': '0_unknown',
    // 🔧 ETAPA 1: Nuevas categorías de métricas
    'OPENAI_TOKENS': '6_ai_request',
    'OPENAI_LATENCY': '6_ai_request',
    'OPENAI_USAGE': '6_ai_request',
    'CONTEXT_TOKENS': '6_ai_request',
    'FUNCTION_METRICS': '6_ai_request',
    'BEDS24_METRICS': '4_beds_request',
    'FALLBACK_TRIGGERED': '7_ai_response',
    'PERFORMANCE_METRICS': '9_complete',
    // 🔧 ETAPA 3: Nuevas categorías de tracing
    'REQUEST_TRACING': '0_tracing',
    'TOOL_OUTPUTS_SUBMITTED': '6_ai_request',
    'ASSISTANT_NO_RESPONSE': '7_ai_response',
    'FLOW_STAGE_UPDATE': '0_tracing'
};
// Lleva la cuenta de la posición que ocupa cada log dentro de un mismo flujo (messageId)
const messageSequenceMap = new Map();
// 🔧 NUEVO: Sistema para evitar logs repetidos
const repeatTracker = new Map();
// Cleanup old entries every 30 seconds
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of repeatTracker.entries()) {
        if (now - value.lastSeen > 30000) { // 30s cleanup
            repeatTracker.delete(key);
        }
    }
}, 30000);
// 🔧 ETAPA 10: Detección de loops mejorada
const loopDetectionMap = new Map();
function getFlowStage(category) {
    return STAGE_MAP[category.toUpperCase()] || '0_unknown';
}
function getSequenceNumber(category, messageId) {
    if (!messageId)
        return undefined;
    const key = String(messageId);
    const seq = (messageSequenceMap.get(key) || 0) + 1;
    messageSequenceMap.set(key, seq);
    return seq;
}
// 🔧 ETAPA 10: Detectar loops en respuestas de fallback
function detectLoopPattern(message, userId) {
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
        }
        else {
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
// 🔧 NUEVO: Sistema dual de logging separado
function enrichedLog(category, message, details = {}, level = 'INFO', sourceFile) {
    // Check log level filtering first
    if (!shouldLog(level)) {
        return;
    }
    // 🔧 NUEVO: Evitar logs repetidos o sin fundamento
    if (details?.isRepeated && !DETAILED_LOGS)
        return;
    // Skip if length is too short and not critical
    if (details?.length < 10 && !details?.critical && ['BUFFER_TIMER_CANCELLED', 'BUFFER_TIMER_SET'].includes(category)) {
        return;
    }
    // 🔧 NUEVO: Rate limiting para eventos repetitivos de buffer
    const now = Date.now();
    const bufferEvents = ['BUFFER_TIMER_CANCEL', 'BUFFER_TIMER_CANCELLED', 'BUFFER_STATE_WAIT', 'BUFFER_DELAYED_USER_ACTIVE'];
    if (bufferEvents.includes(category)) {
        const userId = details?.userId || 'unknown';
        const bufferKey = `${category}:${userId}`;
        const bufferExisting = repeatTracker.get(bufferKey);
        if (bufferExisting && now - bufferExisting.lastSeen < 5000) { // 5 seconds window
            bufferExisting.count++;
            bufferExisting.lastSeen = now;
            // Solo mostrar cada 5 repeticiones para eventos de buffer
            if (bufferExisting.count % 5 !== 0 && !DETAILED_LOGS) {
                return;
            }
        }
        else {
            repeatTracker.set(bufferKey, { count: 1, lastSeen: now });
        }
    }
    // Track repeated logs - special handling for webhooks and client messages
    const trackingKey = `${category}:${message.substring(0, 50)}`;
    const existing = repeatTracker.get(trackingKey);
    // Extended handling for cross-category messages (including AI responses)
    if (['MESSAGE_RECEIVED', 'BUFFER_GROUPED', 'OPENAI_RESPONSE', 'WHAPI_CHUNK_SEND', 'BUFFER_PREBUFFER'].includes(category)) {
        const msgBody = details?.body || details?.combinedPreview || details?.preview || details?.response || '';
        const hash = `${category}:${msgBody.slice(0, 50)}`;
        const crossExisting = repeatTracker.get(hash);
        if (crossExisting && now - crossExisting.lastSeen < 10000) { // 10s window for cross-category
            crossExisting.count++;
            crossExisting.lastSeen = now;
            if (crossExisting.count > 1) {
                const firstWord = msgBody.split(/\s+/)[0] || '';
                message = `Mensaje repetido: '${firstWord} .......' | count: x${crossExisting.count}`;
            }
        }
        else {
            repeatTracker.set(hash, { count: 1, lastSeen: now });
        }
    }
    // Special webhook repeat tracking with 2-second window
    if (category === 'WEBHOOK_RECEIVED' || category === 'WEBHOOK_OTHER') {
        const webhookKey = `${category}:${details?.data || details?.type || 'unknown'}`;
        const webhookExisting = repeatTracker.get(webhookKey);
        if (webhookExisting && now - webhookExisting.lastSeen < 2000) { // Within 2 seconds
            webhookExisting.count++;
            webhookExisting.lastSeen = now;
            if (webhookExisting.count > 2 && !DETAILED_LOGS) {
                // Log summary instead of individual webhook
                if (webhookExisting.count === 3) { // Only log once when threshold is reached
                    enrichedLog(category, `📥 ${details?.data || details?.type || 'unknown'}: repeated x${webhookExisting.count} | last:${webhookExisting.count}`, { suppressCount: webhookExisting.count, originalDetails: details }, level, sourceFile);
                }
                return; // Skip individual webhook log
            }
        }
        else {
            repeatTracker.set(webhookKey, { count: 1, lastSeen: now });
        }
    }
    else if (existing && now - existing.lastSeen < 5000) { // Within 5 seconds for non-webhooks
        existing.count++;
        existing.lastSeen = now;
        if (existing.count > 3 && !DETAILED_LOGS)
            return; // Skip after 3 repeats
    }
    else {
        repeatTracker.set(trackingKey, { count: 1, lastSeen: now });
    }
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
    // 🔧 NUEVO: Log detallado para archivo (Tipo 2)
    const detailedLogEntry = {
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
            // 🔧 NUEVO: Incluir detalles completos si DETAILED_LOGS está habilitado
            ...(DETAILED_LOGS && details && Object.keys(details).length > 0 ? details :
                details && Object.keys(details).length > 0 ?
                    Object.fromEntries(Object.entries(details).filter(([k, v]) => !['rawResponse', 'fullStack', 'completePayload'].includes(k))) : {}),
        }
    };
    // 🔧 NUEVO: Log compacto para terminal (Tipo 1)
    const compactLogEntry = formatCompactLog(category, message, details, level, sourceFile);
    // 🔧 NUEVO: Sistema dual separado
    if (IS_PRODUCTION) {
        // Cloud Run: Logs compactos o detallados según configuración
        if (RAILWAY_COMPACT_MODE) {
            const compactRailwayLog = formatCompactRailwayLog(category, message, details, level);
            console.log(compactRailwayLog);
            // Agregar al buffer para archivo
            railwayLogBuffer.push(compactRailwayLog);
        }
        else {
            // Modo detallado (JSON completo)
            console.log(JSON.stringify(detailedLogEntry));
            // Agregar al buffer para archivo
            const compactLogForRailway = formatCompactLog(category, message, details, level, sourceFile);
            railwayLogBuffer.push(compactLogForRailway);
        }
        // Incrementar contador y escribir archivo cada 500 líneas
        railwayLogCounter++;
        if (railwayLogCounter % 500 === 0) {
            // Milestone en console (usar formato compacto si está habilitado)
            if (RAILWAY_COMPACT_MODE) {
                const milestoneLog = formatCompactRailwayLog('LOG_MILESTONE', `Línea ${railwayLogCounter} de logs técnicos alcanzada`, { logCount: railwayLogCounter, milestone: 500, environment: 'railway' }, 'INFO');
                console.log(milestoneLog);
            }
            else {
                console.log(JSON.stringify({
                    timestamp: new Date().toISOString(),
                    severity: 'INFO',
                    message: `[LOG_MILESTONE] Línea ${railwayLogCounter} de logs técnicos alcanzada`,
                    labels: {
                        app: 'whatsapp-bot',
                        category: 'LOG_MILESTONE',
                        level: 'INFO',
                        milestone: railwayLogCounter
                    },
                    jsonPayload: {
                        category: 'LOG_MILESTONE',
                        level: 'INFO',
                        timestamp: new Date().toISOString(),
                        logCount: railwayLogCounter,
                        milestone: 500,
                        environment: 'railway'
                    }
                }));
            }
            // Escribir chunk a archivo
            writeRailwayLogChunk();
        }
        // Dashboard disabled - monitoring removed
        // if (compactLogEntry) {
        //     botDashboard.addLog(compactLogEntry);
        // }
    }
    else {
        // Desarrollo local: SOLO archivo detallado (terminal maneja terminalLog)
        // NO mostrar en console.log para evitar duplicación con terminalLog
        // Dashboard disabled - monitoring removed
        // if (compactLogEntry) {
        //     botDashboard.addLog(compactLogEntry);
        // }
        // Escribir log detallado al archivo SIEMPRE en desarrollo local
        if (!IS_PRODUCTION) {
            initializeLogFile(); // Asegurar que el archivo esté inicializado
            try {
                // Usar formato compacto para archivo también - SIEMPRE formatear compacto
                const compactLogForFile = formatCompactLog(category, message, details, level, sourceFile);
                fs_1.default.appendFileSync(LOG_FILE, compactLogForFile + '\n', 'utf8');
            }
            catch (error) {
                console.error('Error writing to log file:', error.message);
            }
        }
    }
    // Dashboard disabled - monitoring removed
    // try {
    //     if (details?.userName || details?.shortUserId) {
    //         const userName = details.userName || details.shortUserId;
    //         botDashboard.logActivity(userName, message, 
    //             level === 'ERROR' ? 'error' : 
    //             level === 'SUCCESS' ? 'completed' : 
    //             category === 'MESSAGE_RECEIVED' ? 'received' : 'processing'
    //         );
    //     }
    // } catch (error) {
    //     // Silenciar errores del dashboard para no afectar el logging principal
    //     console.error('Dashboard activity log error:', error.message);
    // }
}
// 🔧 MAPEO: Categorías a archivos fuente para debugging rápido
const CATEGORY_TO_SOURCE = {
    // Core Services
    'OPENAI_PROCESSING_START': 'openai',
    'OPENAI_RUN_COMPLETED': 'openai',
    'OPENAI_MESSAGE_SENT': 'openai',
    'OPENAI_RESPONSE_CONTENT': 'openai',
    'OPENAI_PROMPT': 'openai',
    'TOKENS_METRIC': 'openai',
    // Database
    'DB_QUERY': 'database',
    'DATABASE_CONNECTION': 'database',
    'THREAD_SAVED': 'database',
    'THREAD_REUSE': 'database',
    'THREAD_METRIC': 'database',
    'USER_ENRICHMENT': 'database',
    // Beds24 API
    'BEDS24_RAW': 'beds24',
    'BEDS24_REQUEST': 'beds24',
    'BEDS24_RESPONSE_DETAIL': 'beds24',
    'BEDS24_CLIENT': 'beds24',
    'HOTEL_AVAILABILITY': 'beds24',
    // Cache System
    'CACHE_HIT': 'cache',
    'CACHE_MISS': 'cache',
    'CACHE_METRIC': 'cache',
    // Buffer System
    'BUFFER_GROUPED': 'buffer',
    'BUFFER_STATE_ADD': 'buffer',
    'BUFFER_TIMER_CANCEL': 'buffer',
    'BUFFER_METRIC': 'buffer',
    // Function System
    'FUNCTION_CALLING_START': 'functions',
    'FUNCTION_COMPLETED': 'functions',
    'FUNC_PERF': 'functions',
    'CHECK_AVAILABILITY_ERROR': 'functions',
    // Webhook Processing
    'WEBHOOK_RECEIVED': 'webhook',
    'MESSAGE_RECEIVED': 'webhook',
    'MESSAGE_PROCESS': 'webhook',
    'MESSAGE_SENT': 'webhook',
    // System Metrics
    'SYS_METRIC': 'system',
    'USAGE_STATS': 'system',
    'RATE_WARN': 'system',
    'LATENCY_METRIC': 'system',
    // WhatsApp API
    'WHAPI_CHUNK_SEND': 'whapi',
    'INDICATOR_SENT': 'whapi',
    'TYPING_FLAG_RESET': 'whapi',
    // Error Handling
    'FALLBACK': 'error-handler',
    'HIGH_LATENCY': 'performance'
};
function getSourceFromCategory(category) {
    return CATEGORY_TO_SOURCE[category] || 'unknown';
}
// 🔧 NUEVO: Formato compacto para Railway (solo lo esencial)
function formatCompactRailwayLog(category, message, details, level) {
    if (!RAILWAY_COMPACT_MODE) {
        return JSON.stringify({
            timestamp: new Date().toISOString(),
            severity: level,
            message: `[${category}] ${message}`,
            labels: {
                app: 'whatsapp-bot',
                category,
                level,
                ...(details.userId && { user_id: String(details.userId) }),
            },
            jsonPayload: details
        });
    }
    // Formato ultra-compacto para Railway
    const timestamp = new Date().toISOString().slice(0, 19) + 'Z';
    const userId = details?.userId ? truncateId(details.userId) : null;
    const threadId = details?.threadId ? truncateId(details.threadId, 'th_') : null;
    const messageId = details?.messageId ? truncateId(details.messageId, 'msg_') : null;
    // 🔧 NUEVO: Agregar fuente del archivo para debugging rápido
    const source = getSourceFromCategory(category);
    const categoryWithSource = `${category}:${source}`;
    // Formateo específico por categoría (solo lo VITAL)
    switch (category) {
        case 'MESSAGE_RECEIVED':
            const msgType = details?.messageType || 'text';
            const preview = details?.body ? `"${details.body.substring(0, 20)}..."` :
                details?.transcription ? `🔊"${details.transcription.substring(0, 20)}..."` : '';
            return `${timestamp} [MSG_RX:${source}] ${userId}: ${msgType} ${preview}`;
        case 'AUDIO_TRANSCRIBED':
            const transcription = details?.transcription ? `"${details.transcription.substring(0, 30)}..."` : '';
            return `${timestamp} [AUDIO:${source}] ${userId}: ${transcription}`;
        case 'BUFFER_GROUPED':
            const msgCount = details?.messageCount || 1;
            const totalLen = details?.totalLength || 0;
            return `${timestamp} [BUFFER:${source}] ${userId}: ${msgCount}msg, ${totalLen}ch`;
        case 'OPENAI_PROCESSING_START':
            return `${timestamp} [AI_START:${source}] ${userId} | ${threadId}`;
        case 'OPENAI_RUN_COMPLETED':
            const aiDuration = details?.processingTime ? `${Math.round(details.processingTime / 1000)}s` : '';
            const tokens = details?.tokensUsed ? `${details.tokensUsed}t` : '';
            return `${timestamp} [AI_DONE:${source}] ${userId} | ${threadId} | ${aiDuration} | ${tokens}`;
        case 'MESSAGE_SENT':
            const respLen = details?.responseLength || 0;
            const procTime = details?.processingTime ? `${Math.round(details.processingTime / 1000)}s` : '';
            return `${timestamp} [SENT:${source}] ${userId} | ${respLen}ch | ${procTime}`;
        case 'WEBHOOK_RECEIVED':
            return `${timestamp} [WEBHOOK:${source}] ${details?.data || 'unknown'}`;
        case 'BEDS24_REQUEST':
            return `${timestamp} [BEDS24:${source}] API request`;
        case 'BEDS24_RESPONSE_DETAIL':
            const rooms = (details?.roomsCount ?? (details?.availableRooms?.length ?? 0)) || 0;
            return `${timestamp} [BEDS24:${source}] ${rooms} rooms found`;
        case 'MESSAGE_CHUNKS':
            const chunks = details?.totalChunks || 1;
            return `${timestamp} [CHUNKS:${source}] ${userId}: ${chunks} parts`;
        case 'FUNCTION_CALLING_START':
            const funcName = details?.functionName || 'unknown';
            return `${timestamp} [FUNC:${source}] ${funcName}()`;
        // 🔧 NUEVOS: Logs técnicos compactos específicos
        case 'BEDS24_RAW':
            const rawData = details?.rawResponse?.data || [];
            const roomsData = rawData.map((r) => {
                const offers = r.offers || [];
                const offer = offers[0] || {};
                return `${r.propertyId || r.roomId}:${offer.price || 0}:${offer.unitsAvailable || 0}`;
            }).join('|');
            const status = details?.status || 200;
            const beds24Duration = details?.duration || '0ms';
            const success = details?.success || false;
            const roomCount = rawData.length || 0;
            return `${timestamp} [BEDS24_RAW:${source}] ${userId}: success:${success} rooms:${roomCount} offers:${roomCount} data:[${roomsData}] status:${status} dur:${beds24Duration} err:${success ? 0 : 1}`;
        case 'OPENAI_PROMPT':
            const promptLen = details?.length || 0;
            const threadIdPrompt = details?.threadId ? truncateId(details.threadId, 'th_') : 'none';
            let content = details?.fullContent || details?.preview || '';
            // Extraer contexto clave y compactar
            const horaMatch = content.match(/Hora actual: [^\n]+/) || [''];
            const clienteMatch = content.match(/Cliente: [^\n]+/) || [''];
            const tagsMatch = content.match(/Tags: [^\n]+/) || [''];
            const msgMatch = content.match(/Mensaje del cliente:[\s\S]+$/) || [''];
            const compactContent = [
                clienteMatch[0].replace('Cliente: ', '').replace(/\s+/g, ''),
                tagsMatch[0].replace('Tags: ', '').replace(/\s+/g, ''),
                horaMatch[0].replace('Hora actual: ', '').substring(0, 16),
                msgMatch[0].replace('Mensaje del cliente:', '').trim().substring(0, 60)
            ].filter(Boolean).join('|').replace(/\n/g, ' ');
            return `${timestamp} [OPENAI_PROMPT:${source}] ${userId}: thread:${threadIdPrompt} len:${promptLen} content:"${compactContent}"`;
        case 'TOKENS_METRIC':
            const tokensIn = details?.tokensIn || details?.inputTokens || 0;
            const tokensOut = details?.tokensOut || details?.outputTokens || details?.tokensUsed || 0;
            const tokensTotal = details?.totalTokens || (tokensIn + tokensOut);
            const model = details?.model || 'unknown';
            const threadIdToken = details?.threadId ? truncateId(details.threadId, 'th_') : 'none';
            return `${timestamp} [TOKENS_METRIC:${source}] ${userId}: in:${tokensIn} out:${tokensOut} total:${tokensTotal} model:${model} thread:${threadIdToken}`;
        case 'LATENCY_METRIC':
            const openaiLat = details?.openaiLatency || details?.openaiTime || 0;
            const beds24Lat = details?.beds24Latency || details?.beds24Time || 0;
            const whapiLat = details?.whapiLatency || details?.whapiTime || 0;
            const dbLat = details?.dbLatency || details?.dbTime || 0;
            const totalLat = details?.totalLatency || (openaiLat + beds24Lat + whapiLat + dbLat);
            return `${timestamp} [LATENCY_METRIC:${source}] ${userId}: openai:${openaiLat}ms beds24:${beds24Lat}ms whapi:${whapiLat}ms db:${dbLat}ms total:${totalLat}ms`;
        case 'USAGE_STATS':
            const msgsPerHour = details?.messagesPerHour || 0;
            const chunksTotal = details?.totalChunks || 0;
            const avgLen = details?.averageLength || 0;
            const funcsCount = details?.functionsExecuted || 0;
            const errorsCount = details?.errors || 0;
            return `${timestamp} [USAGE_STATS:${source}] sys: msgs:${msgsPerHour}/hr chunks:${chunksTotal} avgLen:${avgLen}ch funcs:${funcsCount} errs:${errorsCount}`;
        case 'DB_QUERY':
            const queryType = details?.type || details?.operation || 'unknown';
            const queryTime = details?.time || details?.duration || 0;
            const queryResult = details?.result || details?.affected || 'unknown';
            const cacheUpdated = details?.cacheUpdated ? 'updated' : 'no_change';
            return `${timestamp} [DB_QUERY:${source}] ${userId}: type:${queryType} time:${queryTime}ms res:${queryResult} cache:${cacheUpdated}`;
        case 'CACHE_METRIC':
            const hitRate = details?.hitRate || details?.hits / (details?.hits + details?.misses) * 100 || 0;
            const missRate = 100 - hitRate;
            const cacheSize = details?.size || details?.sizeBytes || 0;
            const users = details?.users || details?.userCount || 0;
            const evictions = details?.evictions || details?.evicted || 0;
            return `${timestamp} [CACHE_METRIC:${source}] sys: hits:${Math.round(hitRate)}% misses:${Math.round(missRate)}% size:${Math.round(cacheSize / 1024 / 1024)}MB users:${users} evicts:${evictions}`;
        case 'BUFFER_METRIC':
            const activeBuffers = details?.active || details?.activeBuffers || 0;
            const mergedBuffers = details?.merged || details?.mergedMessages || 0;
            const abandonedBuffers = details?.abandoned || details?.abandonedBuffers || 0;
            const voiceMessages = details?.voice || details?.voiceCount || 0;
            const textMessages = details?.text || details?.textCount || 0;
            return `${timestamp} [BUFFER_METRIC:${source}] sys: active:${activeBuffers} merged:${mergedBuffers} abandoned:${abandonedBuffers} voice:${voiceMessages} text:${textMessages}`;
        case 'THREAD_METRIC':
            const threadIdMetric = details?.threadId ? truncateId(details.threadId, 'th_') : 'none';
            const msgCountThread = details?.messageCount || details?.messages || 0;
            const tokenCountThread = details?.tokenCount || details?.tokens || 0;
            const reused = details?.reused || details?.wasReused || false;
            const ageMinutes = details?.age || details?.ageMinutes || 0;
            return `${timestamp} [THREAD_METRIC:${source}] ${userId}: id:${threadIdMetric} msgs:${msgCountThread} tokens:${tokenCountThread} reused:${reused} age:${ageMinutes}m`;
        case 'FUNC_PERF':
            const funcNamePerf = details?.functionName || 'unknown';
            const funcDuration = details?.duration || details?.totalTime || 0;
            const apiTime = details?.apiTime || details?.externalTime || 0;
            const dbTime = details?.dbTime || details?.databaseTime || 0;
            const callsCount = details?.calls || details?.callsCount || 1;
            const funcErrors = details?.errors || details?.errorCount || 0;
            return `${timestamp} [FUNC_PERF:${source}] ${userId}: ${funcNamePerf}:${funcDuration}ms api:${apiTime}ms db:${dbTime}ms calls:${callsCount} errs:${funcErrors}`;
        case 'SYS_METRIC':
            const memUsed = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
            const memTotal = details?.memTotal || 512;
            const cpuUsage = details?.cpu || details?.cpuPercent || 0;
            const connections = details?.connections || details?.activeConnections || 0;
            const uptimeHours = Math.floor(process.uptime() / 3600);
            const uptimeMinutes = Math.floor((process.uptime() % 3600) / 60);
            const activeUsers = details?.activeUsers || details?.users || 0;
            return `${timestamp} [SYS_METRIC:${source}] sys: mem:${memUsed}/${memTotal}MB cpu:${cpuUsage}% conn:${connections} uptime:${uptimeHours}h${uptimeMinutes}m activeUsers:${activeUsers}`;
        case 'RATE_WARN':
            const openaiRate = details?.openaiRate || 0;
            const openaiLimit = details?.openaiLimit || 25;
            const whapiRate = details?.whapiRate || 0;
            const whapiLimit = details?.whapiLimit || 1000;
            const beds24Status = details?.beds24Status || 'ok';
            return `${timestamp} [RATE_WARN:${source}] sys: openai:${Math.round(openaiRate / openaiLimit * 100)}%(${openaiRate}/${openaiLimit}rpm) whapi:${Math.round(whapiRate / whapiLimit * 100)}%(${whapiRate}/${whapiLimit}rpm) beds24:${beds24Status}`;
        case 'FALLBACK':
            const fallbackReason = details?.reason || details?.trigger || 'unknown';
            const fallbackAction = details?.action || details?.recovery || 'unknown';
            const retryCount = details?.retry || details?.retries || 0;
            return `${timestamp} [FALLBACK:${source}] ${userId}: reason:${fallbackReason} action:${fallbackAction} retry:${retryCount}`;
        case 'CACHE_HIT':
        case 'CACHE_MISS':
            const cacheResult = category === 'CACHE_HIT' ? 'HIT' : 'MISS';
            return `${timestamp} [CACHE_${cacheResult}:${source}] ${userId}`;
        case 'THREAD_REUSE':
        case 'NEW_THREAD_CREATED':
            const action = category === 'THREAD_REUSE' ? 'REUSE' : 'NEW';
            return `${timestamp} [THR_${action}:${source}] ${threadId}`;
        case 'LOG_MILESTONE':
            const milestone = details?.logCount || railwayLogCounter;
            return `${timestamp} [MILESTONE:${source}] Line ${milestone} reached`;
        case 'ERROR':
            const errorMsg = details?.error ? details.error.substring(0, 50) + '...' : message;
            return `${timestamp} [ERROR:${source}] ${userId || 'system'}: ${errorMsg}`;
        default:
            // Formato genérico ultra-compacto
            const genericMsg = message.length > 40 ? message.substring(0, 40) + '...' : message;
            return `${timestamp} [${category.substring(0, 8)}:${source}] ${userId || 'sys'}: ${genericMsg}`;
    }
}
// 🔧 NUEVO: Utilidades de formateo compacto
function truncateId(id, prefix = '') {
    if (!id)
        return 'unknown';
    const cleanId = id.toString();
    if (cleanId.length <= 8)
        return cleanId;
    return `${prefix}${cleanId.substring(0, 5)}...${cleanId.slice(-3)}`;
}
function formatDuration(ms) {
    if (ms < 1000)
        return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}
function formatTokens(tokens) {
    if (tokens < 1000)
        return `${tokens}t`;
    return `${(tokens / 1000).toFixed(1)}kt`;
}
function formatCompactLog(category, message, details, level, sourceFile) {
    const now = new Date();
    // Formato corto: 03-08 20:13:00.695 (ahorra ~6 chars por log, quita T)
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
    const timestamp = `${day}-${month} ${hours}:${minutes}:${seconds}.${milliseconds}`;
    const levelIcon = { 'SUCCESS': '✓', 'ERROR': '✗', 'WARNING': '⚠', 'INFO': 'ℹ', 'DEBUG': '🔍' }[level] || 'ℹ';
    // Formatear archivo fuente si está disponible
    const fileInfo = sourceFile ? `[${sourceFile}]` : '';
    // Mapeo de categorías a prefijos cortos
    const categoryMap = {
        'WEBHOOK_RECEIVED': 'WH',
        'PRESENCE_EVENT': 'PRES',
        'MESSAGE_RECEIVED': 'MSG',
        'BUFFER_TIMER_SET': 'BUF',
        'BUFFER_TIMER_CANCELLED': 'BUF',
        'BUFFER_TIMER_RESPECTED': 'BUF',
        'BUFFER_GROUPED': 'BUF',
        'OPENAI_PROCESSING_START': 'AI',
        'OPENAI_RUN_COMPLETED': 'AI',
        'OPENAI_RESPONSE_CONTENT': 'AI',
        'OPENAI_POLLING': 'AI',
        'MESSAGE_SENT': 'SENT',
        'MESSAGE_CHUNKS': 'CHUNKS',
        'AUDIO_TRANSCRIBED': 'AUDIO',
        'VOICE_RESPONSE_MODE': 'VOICE',
        'VOICE_SENT': 'VOICE',
        'VOICE_FLAG_RESET': 'VOICE',
        'CACHE_HIT': 'CACHE',
        'CACHE_MISS': 'CACHE',
        'THREAD_TOKEN_COUNT': 'THR',
        'THREAD_REUSE': 'THR',
        'NEW_THREAD_CREATED': 'THR',
        'TOKEN_USAGE': 'TOKEN',
        'HIGH_LATENCY': 'PERF',
        'WEBHOOK_OTHER': 'WH',
        'APP_START': 'APP',
        'CONFIG_LOADED': 'CFG',
        'PLUGIN_REGISTERED': 'PLUGIN',
        'PLUGIN_REGISTRATION': 'PLUGIN',
        'FUNCTION_REGISTERED': 'FUNC',
        'DI_COMPLETED': 'DI',
        'DI_SETUP': 'DI',
        'JOBS_STARTED': 'JOBS',
        'JOB_STARTED': 'JOB',
        'DATABASE_CONNECTED': 'DB',
        'SERVER_START': 'SRV',
        'BOT_READY': 'BOT',
        'INDICATOR_SENT': 'IND',
        'INDICATOR_FAILED': 'IND',
        'MESSAGE_PROCESS': 'PROC',
        'THREAD_VALIDATION': 'THR',
        'CACHE_HIT_DETAIL': 'CACHE',
        'THREAD_CREATION_DETAIL': 'THR'
    };
    const shortCategory = categoryMap[category] || category.substring(0, 4).toUpperCase();
    // Extraer datos comunes
    const userId = details?.userId ? truncateId(details.userId) : null;
    const threadId = details?.threadId ? truncateId(details.threadId, 'thr_') : null;
    const runId = details?.runId ? truncateId(details.runId, 'run_') : null;
    const duration = details?.processingTime || details?.duration;
    const tokens = details?.tokensUsed || details?.tokens;
    const messageCount = details?.messageCount;
    const responseLength = details?.responseLength;
    // Formateo específico por categoría con formato compacto MANTENIENDO DATOS CRÍTICOS
    switch (category) {
        case 'WEBHOOK_RECEIVED':
            return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} 📥 ${details?.data || 'unknown'}`;
        case 'PRESENCE_EVENT':
            return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} ${userId} ${details?.status || 'unknown'}`;
        case 'MESSAGE_RECEIVED':
            const msgBody = details?.body || '';
            const msgHash = `MSG:${userId}:${msgBody.split(/\s+/).slice(0, 3).join(' ')}`;
            const isRepeat = repeatTracker.has(msgHash);
            const msgPreview = isRepeat ?
                msgBody.split(/\s+/).slice(0, 3).join(' ') + (msgBody.split(/\s+/).length > 3 ? ' ......' : '') :
                msgBody.split(/\s+/).slice(0, 10).join(' ') + (msgBody.split(/\s+/).length > 10 ? '...' : '');
            return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} ${userId} | ${details?.messageType || 'text'} | "${msgPreview}"`;
        case 'BUFFER_TIMER_SET':
        case 'BUFFER_TIMER_CANCELLED':
        case 'BUFFER_TIMER_RESPECTED':
            const delay = details?.delay || details?.newDelay;
            const reason = details?.reason || 'unknown';
            const count = messageCount ? ` | msgs:${messageCount}` : '';
            const action = category === 'BUFFER_TIMER_SET' ? 'Starting buffer' :
                category === 'BUFFER_TIMER_CANCELLED' ? 'Buffer cancelled' : 'Buffer completed';
            return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} ${action} for ${userId} | timeout:${delay ? formatDuration(delay) : 'unknown'} | reason:${reason}${count}`;
        case 'BUFFER_GROUPED':
            let totalLength = details?.totalLength || 0;
            const messages = details?.messages || [];
            const msgCount = messages.length || messageCount || 1;
            // Si hay múltiples mensajes, mostrar detalles
            if (messages.length > 1) {
                const msgDetails = messages.map((m) => `[${m.type === 'voice_transcription' ? 'Voice' : 'Text'}:${m.length}ch]`).join(' + ');
                return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} ${userId} | ${msgCount} messages grouped | ${totalLength}ch total | ${msgDetails}`;
            }
            else {
                const combinedText = details?.combinedPreview || '';
                const textHash = `${userId}:${combinedText.substring(0, 30)}`;
                const isRepeatCombined = repeatTracker.has(textHash);
                const previewCombined = isRepeatCombined ?
                    combinedText.split(/\s+/).slice(0, 3).join(' ') + (combinedText.split(/\s+/).length > 3 ? ' ......' : '') :
                    combinedText.split(/\s+/).slice(0, 10).join(' ') + (combinedText.split(/\s+/).length > 10 ? '...' : '');
                return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} ${userId} | ${msgCount}msg | ${totalLength}ch | "${previewCombined}"`;
            }
        case 'OPENAI_PROCESSING_START':
            return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} ${userId} | ${threadId} | ${details?.messageLength || 0}ch`;
        case 'OPENAI_RUN_COMPLETED':
            const durationStr = duration ? formatDuration(duration) : 'unknown';
            const tokensStr = tokens ? formatTokens(tokens) : 'unknown';
            const lengthStr = responseLength ? `${responseLength}ch` : 'unknown';
            const functionsStr = details?.hasFunctionCalls ? 'funcs:1' : 'funcs:0';
            return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} ${userId} | ${threadId} | ${runId} | ${durationStr} | ${tokensStr} | ${lengthStr} | ${functionsStr}`;
        case 'OPENAI_RESPONSE_CONTENT':
            const contentLength = details?.responseLength || 0;
            const fullResponse = details?.response || details?.responsePreview || '';
            const containsAudioError = details?.containsAudioError;
            // Escape newlines for single-line logging
            const escapedResponse = fullResponse.replace(/\n/g, '\\n');
            const response20Words = escapedResponse.split(' ').slice(0, 20).join(' ') + (escapedResponse.split(' ').length > 20 ? '...' : '');
            return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} ${userId} | ${threadId} | ${contentLength}ch | response: "${response20Words}"${containsAudioError ? ' [AUDIO_ERROR_DETECTED]' : ''}`;
        case 'OPENAI_POLLING':
            const status = details?.status || 'unknown';
            const attempts = details?.attempts || 0;
            return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} ${threadId} | ${runId} | ${status} | attempts:${attempts}`;
        case 'MESSAGE_SENT':
            const procTime = duration ? formatDuration(duration) : 'unknown';
            const respLen = responseLength ? `${responseLength}ch` : 'unknown';
            const hasErrors = details?.hadValidationErrors ? '⚠' : '✓';
            const sentContent = details?.contentPreview ? ` | content: "${details.contentPreview}"` : '';
            return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} ${hasErrors} ${userId} | ${threadId} | ${procTime} | ${respLen}${sentContent}`;
        case 'MESSAGE_CHUNKS':
            const totalChunks = details?.totalChunks || 1;
            const chunksLength = details?.totalLength || 0;
            const divisionReason = details?.divisionReason || 'unknown';
            const chunkSizes = details?.chunkLengths ? details.chunkLengths.join(',') : '';
            return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} Message divided into ${totalChunks} chunks for ${userId} | total:${chunksLength}ch | reason:${divisionReason} | sizes:[${chunkSizes}]`;
        case 'AUDIO_TRANSCRIBED':
            const transcription = details?.transcription ? details.transcription.substring(0, 40) + '...' : '';
            const audioDuration = details?.duration ? ` | ${formatDuration(details.duration)} audio` : '';
            let audioSizeTranscribed = details?.size ? ` | ${Math.round(details.size / 1024)}KB` : '';
            return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} ${userId}${audioDuration}${audioSizeTranscribed} | "${transcription}"`;
        case 'CACHE_HIT':
        case 'CACHE_MISS':
            const cachedName = details?.cachedName || details?.name || 'unknown';
            const cacheAge = details?.cacheAge ? formatDuration(details.cacheAge) : '';
            const cacheType = category === 'CACHE_HIT' ? 'hit' : 'miss';
            const ageText = cacheAge ? ` | age:${cacheAge}` : '';
            return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} User ${userId} (${cachedName}) ${cacheType}${ageText}`;
        case 'APP_START':
            const version = details?.version || 'unknown';
            const env = details?.environment || 'unknown';
            const pid = details?.pid || 'unknown';
            return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} TeAlquilamos Bot v${version} | PID:${pid} | ${env}`;
        case 'CONFIG_LOADED':
            const port = details?.port || 'unknown';
            const hasOpenAI = details?.hasOpenAI ? '✓' : '✗';
            const hasWhapi = details?.hasWhapi ? '✓' : '✗';
            return `[${timestamp}] [${level}] [${shortCategory}] port:${port} | OpenAI:${hasOpenAI} | Whapi:${hasWhapi}`;
        case 'PLUGIN_REGISTERED':
            const plugin = details?.plugin || 'unknown';
            const functions = details?.functions || [];
            const functionNames = functions.length > 0 ? functions.join(', ') : 'none';
            return `[${timestamp}] [${level}] [${shortCategory}] ${plugin} registered | Functions: ${functionNames}`;
        case 'DI_COMPLETED':
            const services = details?.services || [];
            const funcs = details?.functions || [];
            const funcNames = funcs.length > 0 ? ` (${funcs.join(', ')})` : '';
            // En modo DEBUG, mostrar más detalles
            if (LOG_LEVEL === 'debug' && services.length > 0) {
                const serviceList = services.slice(0, 3).join(', ') + (services.length > 3 ? '...' : '');
                return `[${timestamp}] [${level}] [${shortCategory}] ${services.length} services registered (${serviceList}) | ${funcs.length} function${funcNames}`;
            }
            return `[${timestamp}] [${level}] [${shortCategory}] ${services.length} services registered | ${funcs.length} function${funcNames}`;
        case 'JOBS_STARTED':
            const daily = details?.daily || 'unknown';
            const crm = details?.crm || 'unknown';
            return `[${timestamp}] [${level}] [${shortCategory}] daily:${daily} | crm:${crm}`;
        case 'DATABASE_CONNECTED':
            const host = details?.host || 'unknown';
            const database = details?.database || 'unknown';
            const environment = details?.environment || 'unknown';
            const connectionTime = details?.connectionTime ? ` in ${formatDuration(details.connectionTime)}` : '';
            return `[${timestamp}] [${level}] [${shortCategory}] Connected to ${host}/${database}${connectionTime}`;
        case 'SERVER_START':
            const serverHost = details?.host || 'unknown';
            const serverPort = details?.port || 'unknown';
            const serverEnv = details?.environment || 'unknown';
            return `[${timestamp}] [${level}] [${shortCategory}] Listening on ${serverHost}:${serverPort}`;
        case 'BOT_READY':
            const functionsCount = details?.functionsCount || 0;
            const botFunctions = details?.functions || [];
            const funcList = botFunctions.length > 0 ? `[${botFunctions.join(', ')}]` : '[none]';
            return `[${timestamp}] [${level}] [${shortCategory}] Ready with functions: ${funcList}`;
        case 'WEBHOOK_OTHER':
            const type = details?.type || 'unknown';
            return `[${timestamp}] [${level}] [${shortCategory}] 📥 ${type}`;
        case 'THREAD_TOKEN_COUNT':
            const totalChars = details?.totalCharacters || 0;
            const estimatedTokens = details?.estimatedTokens || 0;
            const contextMsgCount = details?.messageCount || 0;
            const source2 = details?.source || 'unknown';
            return `[${timestamp}] [${level}] [${shortCategory}] ${threadId} | ${totalChars}ch | ${formatTokens(estimatedTokens)} | ${contextMsgCount}msg | ${source2}`;
        case 'THREAD_REUSE':
            const tokenCount = details?.tokenCount || 0;
            const threadSource = details?.source || 'unknown';
            const sourceText = threadSource === 'database' ? 'loaded from DB' : threadSource === 'cache' ? 'from cache' : threadSource;
            return `[${timestamp}] [${level}] [${shortCategory}] Reusing thread ${threadId} | ${formatTokens(tokenCount)} | ${sourceText}`;
        case 'NEW_THREAD_CREATED':
            const newThreadSource = details?.enableCache ? 'with cache' : 'no cache';
            return `[${timestamp}] [${level}] [${shortCategory}] Created new thread ${threadId} | ${newThreadSource}`;
        case 'OPENAI_SEND':
            const msgLength = details?.length || 0;
            const openaiMsgPreview = details?.preview || 'no preview';
            const contextSrc = details?.contextSource || 'unknown';
            return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} Mensaje aplanado a OpenAI | [U:${userId}] | ${threadId} | ${msgLength}ch | preview: "${openaiMsgPreview}" | contextSource: '${contextSrc}'`;
        case 'OPENAI_FUNC_CALL':
            const funcName = details?.functionName || 'unknown';
            const funcArgs = details?.argsPreview || details?.args?.substring(0, 100) + '...' || 'no args';
            return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} Llamando función | u:${userId} | ${threadId} | functionName: ${funcName} | args: ${funcArgs}`;
        case 'OPENAI_FUNC_RESULT':
            const resultFuncName = details?.functionName || 'unknown';
            const resultPreview = details?.preview || 'no preview';
            const resultLen = details?.resultLength || 0;
            return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} Resultado de función formateado para OpenAI | u:${userId} | ${threadId} | functionName: ${resultFuncName} | ${resultLen}ch | preview: "${resultPreview}"`;
        case 'WHAPI_CHUNK_SEND':
            const chunkNum = details?.chunkNumber || 1;
            const totalChunksSend = details?.totalChunks || 1;
            const chunkLength = details?.chunkLength || 0;
            const chunkPreview = details?.preview || 'no preview';
            const escapedPreview = chunkPreview.replace(/\n/g, '\\n').replace(/\r/g, '').trim();
            const isFirst = details?.isFirstChunk ? 'first' : 'follow';
            return `[${timestamp}] [${level}] [${shortCategory}] Chunk ${chunkNum}/${totalChunksSend} | [U:${userId}] | ${chunkLength}ch | ${isFirst} | preview: "${escapedPreview.substring(0, 100) + (escapedPreview.length > 100 ? '...' : '')}"`;
        case 'BUFFER_STATE_ADD':
            const currentMsgs = details?.currentMsgs || 0;
            const msgTypes = details?.types || 'unknown';
            const bufferPreview = details?.preview || 'no preview';
            const totalLen = details?.totalLength || 0;
            return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} Buffer: ${currentMsgs} msgs (${msgTypes}) | [U:${userId}] | ${totalLen}ch | preview: "${bufferPreview}"`;
        case 'BUFFER_STATE_WAIT':
            const waitMsgs = details?.currentMsgs || 0;
            const waitTypes = details?.types || 'unknown';
            const timeoutRemaining = details?.timeoutRemaining || '5s';
            const waitReason = details?.reason || 'unknown';
            return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} Esperando: ${waitMsgs} msgs (${waitTypes}) | [U:${userId}] | timeout:${timeoutRemaining} | reason:${waitReason}`;
        case 'TOKEN_USAGE':
            const procTime2 = duration ? formatDuration(duration) : 'unknown';
            return `[${timestamp}] [${level}] [${shortCategory}] ${userId} | ${threadId} | ${runId} | ${formatTokens(tokens || 0)} | ${procTime2}`;
        case 'HIGH_LATENCY':
            const latency = details?.latencyMs ? formatDuration(details.latencyMs) : 'unknown';
            const tokensUsed = details?.tokensUsed ? formatTokens(details.tokensUsed) : 'unknown';
            return `[${timestamp}] [${level}] [${shortCategory}] ⚠ ${userId} | ${threadId} | ${runId} | ${latency} | ${tokensUsed}`;
        case 'VOICE_RESPONSE_MODE':
        case 'VOICE_FLAG_RESET':
            const voiceLength = details?.responseLength || 0;
            const voiceReason = details?.reason || 'unknown';
            return `[${timestamp}] [${level}] [${shortCategory}] ${userId} | ${voiceLength}ch | ${voiceReason}`;
        case 'VOICE_SENT':
            const voiceDuration = details?.duration ? formatDuration(details.duration) : 'unknown';
            const audioSize = details?.audioSizeKB ? `${details.audioSizeKB}KB` : 'unknown';
            const textLength = details?.messageLength || 0;
            const voiceSuccess = details?.success ? 'success' : 'failed';
            return `[${timestamp}] [${level}] [${shortCategory}] Voice message sent to ${userId} | ${voiceDuration} | ${audioSize} audio | ${textLength}ch text | ${voiceSuccess}`;
        case 'INDICATOR_SENT':
            const indicatorType = details?.indicatorType || 'recording';
            const success = details?.success ? 'success' : 'unknown';
            return `[${timestamp}] [${level}] [${shortCategory}] Sending ${indicatorType} presence to ${userId} | ${success}`;
        case 'INDICATOR_FAILED':
            const failedType = details?.indicatorType || 'unknown';
            const errorMsg = details?.error || 'unknown error';
            return `[${timestamp}] [${level}] [${shortCategory}] Failed to send ${failedType} presence to ${userId} | error: ${errorMsg}`;
        case 'MESSAGE_PROCESS':
            const processMsgCount = details?.messageCount || 1;
            const previewText = details?.preview || '';
            const previewHash = `${userId}:${previewText.substring(0, 30)}`;
            const isRepeatPreview = repeatTracker.has(previewHash);
            const processPreview = previewText ?
                (isRepeatPreview ?
                    previewText.split(/\s+/).slice(0, 3).join(' ') + (previewText.split(/\s+/).length > 3 ? ' ......' : '') :
                    previewText.split(/\s+/).slice(0, 10).join(' ') + (previewText.split(/\s+/).length > 10 ? '...' : '')) : '';
            return `[${timestamp}] [${level}] [${shortCategory}] ${userId} | ${processMsgCount}msg | "${processPreview}"`;
        case 'FUNCTION_REGISTERED':
            const functionName = details?.functionName || 'unknown';
            const totalFunctions = details?.totalFunctions || 0;
            return `[${timestamp}] [${level}] [${shortCategory}] ${functionName} | total:${totalFunctions}`;
        case 'PLUGIN_REGISTRATION':
            const pluginName = details?.pluginName || details?.source || 'unknown';
            return `[${timestamp}] [${level}] [${shortCategory}] ${pluginName}`;
        case 'DI_SETUP':
            const servicesSetup = details?.services || [];
            return `[${timestamp}] [${level}] [${shortCategory}] ${servicesSetup.length} services`;
        case 'JOB_STARTED':
            const jobName = details?.jobName || 'unknown';
            const schedule = details?.schedule || 'unknown';
            const timezone = details?.timezone ? ` (${details.timezone})` : '';
            return `[${timestamp}] [${level}] [${shortCategory}] ${jobName}: ${schedule}${timezone}`;
        case 'MESSAGE_PROCESS_ERROR':
            const errorType = details?.errorType || 'UnknownError';
            const processErrorMsg = details?.error || 'Unknown error';
            const textLen = details?.combinedTextLength || 0;
            const threadInfo = details?.threadId ? ` | thread:${details.threadId}` : ' | thread:none';
            const stackPreview = details?.stack ? ` | stack:${details.stack.split('\n')[0]}` : '';
            return `[${timestamp}] [${level}] [${shortCategory}] ${errorType}: ${processErrorMsg} | ${userId} | ${textLen}ch${threadInfo}${stackPreview}`;
        case 'BUFFER_PREBUFFER':
            const prebufferType = details?.triggerType || 'unknown';
            const prebufferReason = details?.reason || 'unknown';
            return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} Pre-buffer created for ${userId} | trigger:${prebufferType} | reason:${prebufferReason}`;
        case 'BUFFER_PREBUFFER_EXTENDED':
            const extTime = details?.extensionTime ? formatDuration(details.extensionTime) : 'unknown';
            const sinceCreation = details?.timeSinceCreation ? formatDuration(details.timeSinceCreation) : 'unknown';
            return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} Pre-buffer extended +${extTime} for ${userId} | age:${sinceCreation}`;
        case 'BUFFER_PREBUFFER_EXPIRED':
            const expiredAge = details?.timeSinceCreation ? formatDuration(details.timeSinceCreation) : 'unknown';
            return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} Pre-buffer expired for ${userId} | age:${expiredAge} | no messages received`;
        case 'BUFFER_CREATED':
            const creationTrigger = details?.triggerType || 'unknown';
            const creationReason = details?.reason || 'unknown';
            return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} Buffer created for ${userId} | trigger:${creationTrigger} | reason:${creationReason}`;
        case 'BUFFER_EMPTY_SKIP':
            const skipReason = details?.reason || 'unknown';
            const skipUserName = details?.userName || 'unknown';
            return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} Empty buffer skipped for ${userId} (${skipUserName}) | reason:${skipReason}`;
        case 'BUFFER_DELAYED_RECENT_TYPING':
            const delayedTime = details?.remainingTime || 'unknown';
            const typingSince = details?.timeSinceTyping ? formatDuration(details.timeSinceTyping) : 'unknown';
            return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} Buffer delayed for ${userId} | typing since:${typingSince} | remaining:${delayedTime}`;
        case 'BEDS24_REQUEST':
            const endpointUrl = details?.url || 'unknown endpoint';
            let baseEndpoint = 'unknown endpoint';
            let keyParams = '';
            try {
                if (endpointUrl !== 'unknown endpoint') {
                    const parsedUrl = new URL(endpointUrl);
                    const pathname = parsedUrl.pathname;
                    const params = parsedUrl.searchParams;
                    // Solo los primeros 3 parámetros más importantes
                    const paramEntries = Array.from(params.entries()).slice(0, 3);
                    const paramString = paramEntries.length > 0 ?
                        '?' + paramEntries.map(([k, v]) => `${k}=${v}`).join('&') + '...' : '';
                    baseEndpoint = pathname + paramString;
                }
            }
            catch (e) {
                baseEndpoint = endpointUrl.replace(/^https?:\/\/[^\/]+/, '').split('&').slice(0, 3).join('&') + '...';
            }
            return `[${timestamp}] [${level}] [${shortCategory}] GET ${baseEndpoint}`;
        case 'BEDS24_RESPONSE_DETAIL':
            const rawResponse = JSON.stringify(details?.rawResponse || {}, null, 0).replace(/[\n\r]/g, '\\n').replace(/\s+/g, ' ').substring(0, 500) + '...';
            return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} Response: ${details?.status || 200} | Avail: ${details?.availableRooms?.length || 0} rooms | Prices: ${details?.pricesSummary || 'N/A'} | NumAvail: ${details?.numAvailSummary || 'N/A'} | Raw: ${rawResponse}`;
        case 'OPENAI_SEND':
        case 'OPENAI_PAYLOAD':
            const payloadLength = details?.length || 0;
            const fullMessage = details?.fullMessage || details?.message || '';
            // Check for repeated messages first
            const openaiHash = `OPENAI:${fullMessage.slice(0, 50)}`;
            const openaiExisting = repeatTracker.get(openaiHash);
            const now = Date.now();
            if (openaiExisting && now - openaiExisting.lastSeen < 10000) {
                openaiExisting.count++;
                openaiExisting.lastSeen = now;
                if (openaiExisting.count > 1) {
                    const tempContext = fullMessage.match(/Hora actual: [^\n]+/)?.[0] || '';
                    return `[${timestamp}] [${level}] [${shortCategory}] Mensaje repetido OpenAI: '${tempContext} .......' | count: x${openaiExisting.count}`;
                }
            }
            else {
                repeatTracker.set(openaiHash, { count: 1, lastSeen: now });
            }
            // Priorizar contexto temporal y escape single-line
            const tempContext = fullMessage.match(/Hora actual: [^\n]+/)?.[0] || '';
            const rest = fullMessage.replace(tempContext, '').trim().split(/\s+/).slice(0, 20 - tempContext.split(/\s+/).length).join(' ');
            const openaiPreview = (tempContext + ' ' + rest + '...').replace(/\n/g, '\\n').substring(0, 200);
            return `[${timestamp}] [${level}] [${shortCategory}] Payload to OpenAI: ${openaiPreview} | Len: ${payloadLength}ch | User: ${userId} | Thread: ${threadId}`;
        default:
            // Formato genérico compacto MANTENIENDO DATOS CRÍTICOS
            const genericDetails = [];
            if (userId)
                genericDetails.push(`u:${userId}`);
            if (threadId)
                genericDetails.push(threadId);
            if (duration)
                genericDetails.push(formatDuration(duration));
            if (tokens)
                genericDetails.push(formatTokens(tokens));
            if (responseLength)
                genericDetails.push(`${responseLength}ch`);
            // 🔧 NUEVO: Truncar mensaje si es muy largo
            const truncatedMessage = message.length > 100 ? message.substring(0, 100) + '...' : message;
            // Manejar errores de forma especial - SIEMPRE mostrar detalles completos
            if (level === 'ERROR' || level === 'FATAL') {
                const errorDetails = [];
                if (details?.error) {
                    const errorMsg = details.error.length > 100 ? details.error.substring(0, 100) + '...' : details.error;
                    errorDetails.push(`error: ${errorMsg}`);
                }
                if (details?.code)
                    errorDetails.push(`code: ${details.code}`);
                if (details?.stack && (LOG_LEVEL === 'debug' || DETAILED_LOGS)) {
                    const stackLines = details.stack.split('\n').slice(0, 3).join(' | ');
                    errorDetails.push(`stack: ${stackLines}`);
                }
                const errorStr = errorDetails.length > 0 ? ` | ${errorDetails.join(' | ')}` : '';
                return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} ${truncatedMessage}${errorStr}`;
            }
            const detailsStr = genericDetails.length > 0 ? ` | ${genericDetails.join(' | ')}` : '';
            return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} ${truncatedMessage}${detailsStr}`;
    }
}
// 🔧 NUEVO: Función para formatear logs simples de terminal (DEPRECATED - usar formatCompactLog)
function formatSimpleConsoleLog(category, message, details, level) {
    // 🔧 HABILITADO: Mostrar todos los logs importantes en tiempo real
    // Forzar mostrar logs en desarrollo local para debug
    if (false && process.env.LOG_TO_CONSOLE !== 'true' && !IS_PRODUCTION) {
        // Expandir categorías para mostrar flujo completo del bot
        const allowedCategories = [
            'MESSAGE_RECEIVED', 'MESSAGE_PROCESS', 'MESSAGE_BUFFER', 'BUFFER_GROUPED',
            'OPENAI_REQUEST', 'OPENAI_RESPONSE', 'OPENAI_ERROR',
            'FUNCTION_CALLING_START', 'FUNCTION_HANDLER', 'FUNCTION_EXECUTING',
            'BEDS24_REQUEST', 'BEDS24_RESPONSE_DETAIL', 'BEDS24_PROCESSING',
            'WHATSAPP_SEND', 'THREAD_CREATED', 'THREAD_REUSE',
            'SERVER_START', 'BOT_READY', 'ERROR', 'FATAL', 'ALERT', 'WARNING'
        ];
        if (!allowedCategories.includes(category)) {
            return null;
        }
    }
    const emoji = { 'SUCCESS': '✅', 'ERROR': '❌', 'WARNING': '⚠️', 'INFO': 'ℹ️' }[level];
    // Extraer información útil de los detalles
    const userName = details?.userName || details?.cleanName || details?.shortUserId || 'Usuario';
    const messagePreview = details?.preview || details?.messagePreview || '';
    const duration = details?.duration || (message.includes('en ') ? message.match(/en (\d+)ms/)?.[1] : null);
    // === INICIO DEL BOT ===
    if (category === 'SERVER_START') {
        return `🚀 Servidor HTTP iniciado en ${details?.host || 'localhost'}:${details?.port || '3008'}`;
    }
    if (category === 'BOT_READY') {
        return `✅ Bot completamente inicializado`;
    }
    // === JOBS ===
    if (category === 'JOBS_STARTED') {
        const daily = details?.daily || 'unknown';
        const crm = details?.crm || 'unknown';
        return `📅 2 jobs scheduled: ${daily}, ${crm}`;
    }
    // === MENSAJES DE USUARIO ===
    if (category === 'MESSAGE_RECEIVED') {
        const preview = details?.body ? `"${details.body.substring(0, 50)}${details.body.length > 50 ? '...' : ''}"` : '';
        return `👤 ${userName}: ${preview} → ⏳ ${details?.timeoutMs ? details.timeoutMs / 1000 : 8}s...`;
    }
    if (category === 'MESSAGE_PROCESS') {
        const count = details?.messageCount || 1;
        return `🤖 ${count} msgs → OpenAI`;
    }
    // === PROCESAMIENTO IA === (habilitado para logs tiempo real)
    if (category === 'OPENAI_REQUEST') {
        return `🤖 OpenAI ← ${userName} → processing...`;
    }
    if (category === 'OPENAI_RESPONSE') {
        const durationStr = duration ? ` (${duration}ms)` : '';
        return `🤖 OpenAI → ${userName}${durationStr}`;
    }
    if (category === 'OPENAI_ERROR') {
        return `❌ OpenAI Error → ${userName}: ${message}`;
    }
    // === FUNCIONES === (habilitado para logs tiempo real)
    if (category === 'FUNCTION_CALLING_START') {
        const functionName = details?.functionName || 'unknown';
        return `⚙️ Function → ${functionName}()`;
    }
    if (category === 'FUNCTION_HANDLER') {
        const functionName = details?.functionName || 'unknown';
        const durationStr = duration ? ` (${duration}ms)` : '';
        return `✅ Function → ${functionName}() completed${durationStr}`;
    }
    if (category === 'FUNCTION_EXECUTING') {
        const functionName = details?.functionName || 'unknown';
        return `⚙️ Executing → ${functionName}()`;
    }
    // === BEDS24 === (habilitado para logs tiempo real)
    if (category === 'BEDS24_REQUEST') {
        const apiType = details?.apiType || 'availability';
        return `🏠 Beds24 → ${apiType} request`;
    }
    if (category === 'BEDS24_RESPONSE_DETAIL') {
        const roomsFound = details?.roomsFound || 0;
        const durationStr = duration ? ` (${duration}ms)` : '';
        return `🏠 Beds24 → ${roomsFound} rooms found${durationStr}`;
    }
    if (category === 'BEDS24_PROCESSING') {
        return `🏠 Beds24 → processing response`;
    }
    // === WHATSAPP === (habilitado para logs tiempo real)
    if (category === 'WHATSAPP_SEND') {
        const messageType = details?.messageType || 'text';
        const durationStr = duration ? ` (${duration}ms)` : '';
        return `📱 Whapi → ${userName} [${messageType}]${durationStr}`;
    }
    // === THREADS === (habilitado para logs tiempo real)
    if (category === 'THREAD_CREATED') {
        const threadId = details?.threadId || 'unknown';
        return `🧵 Thread created → ${threadId.substring(0, 8)}...`;
    }
    if (category === 'THREAD_REUSE') {
        const threadId = details?.threadId || 'unknown';
        return `🧵 Thread reused → ${threadId.substring(0, 8)}...`;
    }
    // === BUFFER ===
    if (category === 'BUFFER_GROUPED') {
        const count = details?.messageCount || 1;
        return `📦 Buffer → ${count} messages grouped`;
    }
    if (category === 'MESSAGE_BUFFER') {
        const bufferCount = details?.bufferCount || 1;
        return `📦 Buffer → message ${bufferCount} queued`;
    }
    // === ETIQUETAS === (eliminado para reducir spam)
    if (category === 'WHAPI_LABELS') {
        return null; // No mostrar en terminal - genera spam
    }
    // === ERRORES ===
    if (category === 'ERROR') {
        return `❌ Error: ${message}`;
    }
    // === WARNINGS ===
    if (category === 'WARNING') {
        return `⚠️ ${message}`;
    }
    // === WEBHOOKS === (no mostrar en terminal, solo en logs técnicos)
    if (category === 'WEBHOOK' && level === 'WARNING') {
        return ''; // No mostrar nada en terminal
    }
    // 🔧 ETAPA 1: Nuevas categorías de métricas (solo en archivo, no en terminal)
    if (category === 'OPENAI_TOKENS' ||
        category === 'OPENAI_LATENCY' ||
        category === 'OPENAI_USAGE' ||
        category === 'CONTEXT_TOKENS' ||
        category === 'FUNCTION_METRICS' ||
        category === 'BEDS24_METRICS' ||
        category === 'PERFORMANCE_METRICS') {
        return ''; // Solo en archivo detallado
    }
    // === FALLBACKS === (solo críticos en terminal)
    if (category === 'FALLBACK_TRIGGERED') {
        return `⚠️ Fallback activado: ${details?.reason || 'sin razón especificada'}`;
    }
    // === CATEGORÍAS DE TEST === (para testing)
    if (category.includes('TEST')) {
        const levelEmoji = { 'SUCCESS': '✅', 'ERROR': '❌', 'WARNING': '⚠️', 'INFO': '💬', 'DEBUG': '🔍' }[level] || '💬';
        const timestamp = new Date().toISOString();
        return `${timestamp} ${levelEmoji} ${level} [${category}] ${message}`;
    }
    // === Por defecto: no mostrar en terminal (solo en archivo) ===
    return '';
}
// Exportar funciones de logging específicas y genéricas
const logInfo = (cat, msg, details, sourceFile) => {
    // IMPORTANTE: No omitir logs críticos en Railway - se necesitan para monitoreo
    // Solo omitir logs muy verbosos específicos
    if (cat === 'BUFFER_TIMER_EXTEND' && IS_PRODUCTION)
        return; // Solo omitir extensiones de timer
    enrichedLog(cat, msg, details, 'INFO', sourceFile);
};
exports.logInfo = logInfo;
const logSuccess = (cat, msg, details, sourceFile) => enrichedLog(cat, msg, details, 'SUCCESS', sourceFile);
exports.logSuccess = logSuccess;
const logWarning = (cat, msg, details, sourceFile) => enrichedLog(cat, msg, details, 'WARNING', sourceFile);
exports.logWarning = logWarning;
const logError = (cat, msg, details, sourceFile) => enrichedLog(cat, msg, details, 'ERROR', sourceFile);
exports.logError = logError;
const logDebug = (cat, msg, details, sourceFile) => {
    if (DETAILED_LOGS && !IS_PRODUCTION) { // Solo en no-production o si detailed enabled
        enrichedLog(cat, `[DEBUG] ${msg}`, details, 'INFO', sourceFile);
    }
};
exports.logDebug = logDebug;
// Se mantienen las funciones específicas para facilitar la refactorización, pero ahora usan enrichedLog
const logMessageProcess = (msg, details) => enrichedLog('MESSAGE_PROCESS', msg, details);
exports.logMessageProcess = logMessageProcess;
const logWhatsAppSend = (msg, details) => enrichedLog('WHATSAPP_SEND', msg, details);
exports.logWhatsAppSend = logWhatsAppSend;
const logWhatsAppChunksComplete = (msg, details) => enrichedLog('WHATSAPP_CHUNKS_COMPLETE', msg, details);
exports.logWhatsAppChunksComplete = logWhatsAppChunksComplete;
const logOpenAIRequest = (msg, details) => enrichedLog('OPENAI_REQUEST', msg, details);
exports.logOpenAIRequest = logOpenAIRequest;
const logOpenAIResponse = (msg, details) => enrichedLog('OPENAI_RESPONSE', msg, details);
exports.logOpenAIResponse = logOpenAIResponse;
const logFunctionCallingStart = (msg, details) => enrichedLog('FUNCTION_CALLING_START', msg, details);
exports.logFunctionCallingStart = logFunctionCallingStart;
const logFunctionExecuting = (msg, details) => enrichedLog('FUNCTION_EXECUTING', msg, details);
exports.logFunctionExecuting = logFunctionExecuting;
const logFunctionHandler = (msg, details) => enrichedLog('FUNCTION_HANDLER', msg, details);
exports.logFunctionHandler = logFunctionHandler;
const logBeds24Request = (msg, details) => enrichedLog('BEDS24_REQUEST', msg, details);
exports.logBeds24Request = logBeds24Request;
const logBeds24ApiCall = (msg, details) => enrichedLog('BEDS24_API_CALL', msg, details);
exports.logBeds24ApiCall = logBeds24ApiCall;
const logBeds24ResponseDetail = (msg, details) => enrichedLog('BEDS24_RESPONSE_DETAIL', msg, details);
exports.logBeds24ResponseDetail = logBeds24ResponseDetail;
const logBeds24Processing = (msg, details) => enrichedLog('BEDS24_PROCESSING', msg, details);
exports.logBeds24Processing = logBeds24Processing;
const logThreadCreated = (msg, details) => enrichedLog('THREAD_CREATED', msg, details);
exports.logThreadCreated = logThreadCreated;
const logThreadPersist = (msg, details) => enrichedLog('THREAD_PERSIST', msg, details);
exports.logThreadPersist = logThreadPersist;
const logThreadCleanup = (msg, details) => enrichedLog('THREAD_CLEANUP', msg, details);
exports.logThreadCleanup = logThreadCleanup;
const logServerStart = (msg, details) => enrichedLog('SERVER_START', msg, details);
exports.logServerStart = logServerStart;
const logBotReady = (msg, details) => enrichedLog('BOT_READY', msg, details);
exports.logBotReady = logBotReady;
// 🔧 ETAPA 1: Nuevas funciones de logging para métricas avanzadas
const logOpenAITokens = (msg, details) => enrichedLog('OPENAI_TOKENS', msg, details);
exports.logOpenAITokens = logOpenAITokens;
const logOpenAILatency = (msg, details) => enrichedLog('OPENAI_LATENCY', msg, details);
exports.logOpenAILatency = logOpenAILatency;
const logOpenAIUsage = (msg, details) => enrichedLog('OPENAI_USAGE', msg, details);
exports.logOpenAIUsage = logOpenAIUsage;
const logContextTokens = (msg, details) => enrichedLog('CONTEXT_TOKENS', msg, details);
exports.logContextTokens = logContextTokens;
const logFunctionCallingMetrics = (msg, details) => enrichedLog('FUNCTION_METRICS', msg, details);
exports.logFunctionCallingMetrics = logFunctionCallingMetrics;
const logBeds24Metrics = (msg, details) => enrichedLog('BEDS24_METRICS', msg, details);
exports.logBeds24Metrics = logBeds24Metrics;
const logFallbackTriggered = (msg, details) => enrichedLog('FALLBACK_TRIGGERED', msg, details);
exports.logFallbackTriggered = logFallbackTriggered;
const logPerformanceMetrics = (msg, details) => enrichedLog('PERFORMANCE_METRICS', msg, details);
exports.logPerformanceMetrics = logPerformanceMetrics;
// 🔧 ETAPA 3: Nuevas funciones de tracing avanzado
const logRequestTracing = (msg, details) => enrichedLog('REQUEST_TRACING', msg, details);
exports.logRequestTracing = logRequestTracing;
const logToolOutputsSubmitted = (msg, details) => enrichedLog('TOOL_OUTPUTS_SUBMITTED', msg, details);
exports.logToolOutputsSubmitted = logToolOutputsSubmitted;
const logAssistantNoResponse = (msg, details) => enrichedLog('ASSISTANT_NO_RESPONSE', msg, details);
exports.logAssistantNoResponse = logAssistantNoResponse;
const logFlowStageUpdate = (msg, details) => enrichedLog('FLOW_STAGE_UPDATE', msg, details);
exports.logFlowStageUpdate = logFlowStageUpdate;
// 🚀 NUEVAS: Funciones de logging técnico compacto específicas
const logBeds24Raw = (msg, details) => enrichedLog('BEDS24_RAW', msg, details);
exports.logBeds24Raw = logBeds24Raw;
const logOpenAIPrompt = (msg, details) => enrichedLog('OPENAI_PROMPT', msg, details);
exports.logOpenAIPrompt = logOpenAIPrompt;
const logTokensMetric = (msg, details) => enrichedLog('TOKENS_METRIC', msg, details);
exports.logTokensMetric = logTokensMetric;
const logLatencyMetric = (msg, details) => enrichedLog('LATENCY_METRIC', msg, details);
exports.logLatencyMetric = logLatencyMetric;
const logUsageStats = (msg, details) => enrichedLog('USAGE_STATS', msg, details);
exports.logUsageStats = logUsageStats;
const logDbQuery = (msg, details) => enrichedLog('DB_QUERY', msg, details);
exports.logDbQuery = logDbQuery;
const logCacheMetric = (msg, details) => enrichedLog('CACHE_METRIC', msg, details);
exports.logCacheMetric = logCacheMetric;
const logBufferMetric = (msg, details) => enrichedLog('BUFFER_METRIC', msg, details);
exports.logBufferMetric = logBufferMetric;
const logThreadMetric = (msg, details) => enrichedLog('THREAD_METRIC', msg, details);
exports.logThreadMetric = logThreadMetric;
const logFuncPerf = (msg, details) => enrichedLog('FUNC_PERF', msg, details);
exports.logFuncPerf = logFuncPerf;
const logSysMetric = (msg, details) => enrichedLog('SYS_METRIC', msg, details);
exports.logSysMetric = logSysMetric;
const logRateWarn = (msg, details) => enrichedLog('RATE_WARN', msg, details);
exports.logRateWarn = logRateWarn;
const logFallback = (msg, details) => enrichedLog('FALLBACK', msg, details);
exports.logFallback = logFallback;
// 🚀 NUEVO: Funciones de conveniencia para nuevos niveles
const logTrace = (cat, msg, details) => enrichedLog(cat, msg, details, 'TRACE');
exports.logTrace = logTrace;
const logFatal = (cat, msg, details) => enrichedLog(cat, msg, details, 'FATAL');
exports.logFatal = logFatal;
const logAlert = (cat, msg, details) => enrichedLog(cat, msg, details, 'ALERT');
exports.logAlert = logAlert;
