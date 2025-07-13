// src/utils/logging/index.ts

const IS_PRODUCTION = process.env.NODE_ENV === 'production' || !!process.env.K_SERVICE;
const DETAILED_LOGS = process.env.ENABLE_DETAILED_LOGS === 'true' || !IS_PRODUCTION;

type LogLevel = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

// 🔧 ETAPA 3: Sistema de tracing con requestId
const activeRequests = new Map<string, {
    requestId: string;
    userId: string;
    startTime: number;
    flowStage: string;
    toolCalls: Array<{ id: string; functionName: string; status: string }>;
    contextTokens: number;
    totalTokens: number;
}>();

// 🔧 ETAPA 3: Generar requestId único
function generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 🔧 ETAPA 3: Iniciar tracing de request
function startRequestTracing(userId: string): string {
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
function updateRequestStage(requestId: string, stage: string): void {
    const request = activeRequests.get(requestId);
    if (request) {
        request.flowStage = stage;
    }
}

// 🔧 ETAPA 3: Registrar tool call
function registerToolCall(requestId: string, toolCallId: string, functionName: string, status: string = 'pending'): void {
    const request = activeRequests.get(requestId);
    if (request) {
        request.toolCalls.push({ id: toolCallId, functionName, status });
    }
}

// 🔧 ETAPA 3: Actualizar status de tool call
function updateToolCallStatus(requestId: string, toolCallId: string, status: string): void {
    const request = activeRequests.get(requestId);
    if (request) {
        const toolCall = request.toolCalls.find(tc => tc.id === toolCallId);
        if (toolCall) {
            toolCall.status = status;
        }
    }
}

// 🔧 ETAPA 3: Finalizar tracing de request
function endRequestTracing(requestId: string): any {
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

// 🔧 NUEVO: Sistema dual de logging separado
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
            ...(details && Object.keys(details).length > 0 ? details : {}),
            environment: IS_PRODUCTION ? 'cloud-run' : 'local',
        }
    };

    // 🔧 NUEVO: Log simple para terminal (Tipo 1)
    const simpleLogEntry = formatSimpleConsoleLog(category, message, details, level);

    // 🔧 NUEVO: Sistema dual separado
    if (IS_PRODUCTION) {
        // Cloud Run: Solo logs estructurados
        console.log(JSON.stringify(detailedLogEntry));
    } else {
        // Desarrollo local: Terminal limpio + archivo detallado
        if (simpleLogEntry) {
            console.log(simpleLogEntry);
        }
        
        // Escribir log detallado al archivo usando el sistema existente
        if (DETAILED_LOGS) {
            // Importar dinámicamente para evitar dependencias circulares
            const { detailedLog } = require('../logger');
            detailedLog(level, category, message, details);
        }
    }
}

// 🔧 NUEVO: Función para formatear logs simples de terminal
function formatSimpleConsoleLog(category: string, message: string, details: any, level: LogLevel): string {
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
    
    // === MENSAJES DE USUARIO ===
    if (category === 'MESSAGE_RECEIVED') {
        const preview = details?.body ? `"${details.body.substring(0, 50)}${details.body.length > 50 ? '...' : ''}"` : '';
        return `👤 ${userName}: ${preview} → ⏳ ${details?.timeoutMs ? details.timeoutMs/1000 : 8}s...`;
    }
    
    if (category === 'MESSAGE_PROCESS') {
        const count = details?.messageCount || 1;
        return `🤖 [BOT] ${count} msgs → OpenAI`;
    }
    
    // === PROCESAMIENTO IA ===
    if (category === 'OPENAI_REQUEST') {
        return `🤖 [BOT] Procesando con IA...`;
    }
    
    if (category === 'OPENAI_RESPONSE') {
        const duration = details?.duration ? `${(details.duration/1000).toFixed(1)}s` : '';
        return `✅ [BOT] Completado (${duration}) → 💬 "${messagePreview.substring(0, 50)}${messagePreview.length > 50 ? '...' : ''}"`;
    }
    
    if (category === 'OPENAI_ERROR') {
        return `❌ [BOT] Error en procesamiento OpenAI para ${userName}`;
    }
    
    // === FUNCIONES ===
    if (category === 'FUNCTION_CALLING_START') {
        const functionName = details?.functionName || 'función';
        return `⚙️ Ejecutando función: ${functionName}`;
    }
    
    if (category === 'FUNCTION_HANDLER') {
        const functionName = details?.functionName || 'función';
        return `✅ ${functionName} → ${details?.result || 'completado'}`;
    }
    
    // === BEDS24 ===
    if (category === 'BEDS24_REQUEST') {
        return `🏨 Beds24 → Consultando disponibilidad...`;
    }
    
    if (category === 'BEDS24_RESPONSE_DETAIL') {
        const options = details?.options || details?.availabilityCount || 0;
        return `✅ Beds24 → ${options} opciones encontradas`;
    }
    
    // === WHATSAPP ===
    if (category === 'WHATSAPP_SEND') {
        return `📤 Enviando respuesta a ${userName}...`;
    }
    
    if (category === 'WHATSAPP_SEND' && level === 'SUCCESS') {
        return `✅ Mensaje enviado exitosamente`;
    }
    
    // === THREADS ===
    if (category === 'THREAD_CREATED') {
        return `🧵 Nuevo thread creado`;
    }
    
    if (category === 'THREAD_REUSE') {
        return `🧵 Thread existente reutilizado`;
    }
    
    // === BUFFER ===
    if (category === 'BUFFER_GROUPED') {
        const count = details?.messageCount || 1;
        return `📦 Agrupados ${count} msgs`;
    }
    
    // === ETIQUETAS ===
    if (category === 'WHAPI_LABELS') {
        const count = details?.labelsCount || 0;
        return `🏷️ ${count} etiquetas sincronizadas`;
    }
    
    // === ERRORES ===
    if (category === 'ERROR') {
        return `❌ Error: ${message}`;
    }
    
    // === WARNINGS ===
    if (category === 'WARNING') {
        return `⚠️ ${message}`;
    }
    
    // === WEBHOOKS === (solo críticos)
    if (category === 'WEBHOOK' && level === 'WARNING') {
        return `⚠️ Webhook recibido sin mensajes válidos`;
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
    
    // === Por defecto: no mostrar en terminal (solo en archivo) ===
    return '';
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

// 🔧 ETAPA 1: Nuevas funciones de logging para métricas avanzadas
export const logOpenAITokens = (msg: string, details?: Record<string, any>) => enrichedLog('OPENAI_TOKENS', msg, details);
export const logOpenAILatency = (msg: string, details?: Record<string, any>) => enrichedLog('OPENAI_LATENCY', msg, details);
export const logOpenAIUsage = (msg: string, details?: Record<string, any>) => enrichedLog('OPENAI_USAGE', msg, details);
export const logContextTokens = (msg: string, details?: Record<string, any>) => enrichedLog('CONTEXT_TOKENS', msg, details);
export const logFunctionCallingMetrics = (msg: string, details?: Record<string, any>) => enrichedLog('FUNCTION_METRICS', msg, details);
export const logBeds24Metrics = (msg: string, details?: Record<string, any>) => enrichedLog('BEDS24_METRICS', msg, details);
export const logFallbackTriggered = (msg: string, details?: Record<string, any>) => enrichedLog('FALLBACK_TRIGGERED', msg, details);
export const logPerformanceMetrics = (msg: string, details?: Record<string, any>) => enrichedLog('PERFORMANCE_METRICS', msg, details);

// 🔧 ETAPA 3: Nuevas funciones de tracing avanzado
export const logRequestTracing = (msg: string, details?: Record<string, any>) => enrichedLog('REQUEST_TRACING', msg, details);
export const logToolOutputsSubmitted = (msg: string, details?: Record<string, any>) => enrichedLog('TOOL_OUTPUTS_SUBMITTED', msg, details);
export const logAssistantNoResponse = (msg: string, details?: Record<string, any>) => enrichedLog('ASSISTANT_NO_RESPONSE', msg, details);
export const logFlowStageUpdate = (msg: string, details?: Record<string, any>) => enrichedLog('FLOW_STAGE_UPDATE', msg, details);

// 🔧 ETAPA 3: Exportar funciones de tracing
export {
    startRequestTracing,
    updateRequestStage,
    registerToolCall,
    updateToolCallStatus,
    endRequestTracing,
    generateRequestId
}; 