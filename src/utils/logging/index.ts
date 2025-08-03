// src/utils/logging/index.ts - Updated with Voice/Image optimizations

// Dashboard disabled - monitoring removed
// import { botDashboard } from '../monitoring/dashboard';
import fs from 'fs';
import path from 'path';

const IS_PRODUCTION = process.env.NODE_ENV === 'production' || !!process.env.K_SERVICE;
const DETAILED_LOGS = process.env.ENABLE_DETAILED_LOGS === 'true' || !IS_PRODUCTION;
const LOG_LEVEL = process.env.LOG_LEVEL || (IS_PRODUCTION ? 'info' : 'debug'); // debug, info, warn, error

// Configuración de archivos de log para desarrollo local
const LOG_DIR = 'logs';
const SESSION_TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const LOG_FILE = path.join(LOG_DIR, `bot-session-${SESSION_TIMESTAMP}.log`);
const MAX_SESSIONS = 5; // Máximo número de sesiones a mantener

// Función para limpiar sesiones antiguas
const cleanupOldSessions = (): void => {
    try {
        // Obtener todos los archivos de sesión
        const files = fs.readdirSync(LOG_DIR)
            .filter(file => file.startsWith('bot-session-') && file.endsWith('.log'))
            .map(file => ({
                name: file,
                path: path.join(LOG_DIR, file),
                stats: fs.statSync(path.join(LOG_DIR, file))
            }))
            .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime()); // Más recientes primero

        // Si hay más archivos que el máximo permitido, eliminar los más antiguos
        if (files.length >= MAX_SESSIONS) {
            const filesToDelete = files.slice(MAX_SESSIONS - 1); // Dejar espacio para la nueva sesión
            
            filesToDelete.forEach(file => {
                try {
                    fs.unlinkSync(file.path);
                    console.log(`🗑️ Sesión antigua eliminada: ${file.name}`);
                } catch (error) {
                    console.error(`Error eliminando ${file.name}:`, error);
                }
            });
        }
    } catch (error) {
        console.error('Error limpiando sesiones antiguas:', error);
    }
};

// Inicializar archivo de log si estamos en desarrollo
let logFileInitialized = false;
const initializeLogFile = () => {
    if (!logFileInitialized && !IS_PRODUCTION) {
        try {
            if (!fs.existsSync(LOG_DIR)) {
                fs.mkdirSync(LOG_DIR, { recursive: true });
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
            fs.writeFileSync(LOG_FILE, sessionHeader);
            console.log(`📁 Logs de esta sesión: ${LOG_FILE}`);
            logFileInitialized = true;
        } catch (error) {
            console.error('Error inicializando archivo de log:', error.message);
        }
    }
};

// 🚀 NUEVO: Niveles de log extendidos
type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'FATAL' | 'ALERT';

// Mapeo de niveles para comparación
const LOG_LEVELS: Record<string, number> = {
    'debug': 0,
    'info': 1,
    'warn': 2,
    'error': 3
};

// Función para verificar si un nivel debe ser loggeado
function shouldLog(level: LogLevel): boolean {
    const currentLevel = LOG_LEVELS[LOG_LEVEL.toLowerCase()] || 1;
    const messageLevel = level === 'DEBUG' || level === 'TRACE' ? 0 :
                        level === 'INFO' || level === 'SUCCESS' ? 1 :
                        level === 'WARNING' ? 2 : 3;
    return messageLevel >= currentLevel;
}

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
    level: LogLevel = 'INFO',
    sourceFile?: string
) {
    // Check log level filtering first
    if (!shouldLog(level)) {
        return;
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
            ...(details && Object.keys(details).length > 0 ? details : {}),
            environment: IS_PRODUCTION ? 'cloud-run' : 'local',
        }
    };

    // 🔧 NUEVO: Log compacto para terminal (Tipo 1)
    const compactLogEntry = formatCompactLog(category, message, details, level, sourceFile);

    // 🔧 NUEVO: Sistema dual separado
    if (IS_PRODUCTION) {
        // Cloud Run: Solo logs estructurados
        console.log(JSON.stringify(detailedLogEntry));
        
        // Dashboard disabled - monitoring removed
        // if (compactLogEntry) {
        //     botDashboard.addLog(compactLogEntry);
        // }
    } else {
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
                fs.appendFileSync(LOG_FILE, compactLogForFile + '\n', 'utf8');
            } catch (error) {
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

// 🔧 NUEVO: Utilidades de formateo compacto
function truncateId(id: string, prefix: string = ''): string {
    if (!id) return 'unknown';
    const cleanId = id.toString();
    if (cleanId.length <= 8) return cleanId;
    return `${prefix}${cleanId.substring(0, 5)}...${cleanId.slice(-3)}`;
}

function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms/1000).toFixed(1)}s`;
}

function formatTokens(tokens: number): string {
    if (tokens < 1000) return `${tokens}t`;
    return `${(tokens/1000).toFixed(1)}kt`;
}

function formatCompactLog(category: string, message: string, details: any, level: LogLevel, sourceFile?: string): string {
    const now = new Date();
    const timestamp = now.toISOString(); // Mantener timestamp completo con milisegundos
    const levelIcon = { 'SUCCESS': '✓', 'ERROR': '✗', 'WARNING': '⚠', 'INFO': 'ℹ', 'DEBUG': '🔍' }[level] || 'ℹ';
    
    // Formatear archivo fuente si está disponible
    const fileInfo = sourceFile ? `[${sourceFile}]` : '';
    
    // Mapeo de categorías a prefijos cortos
    const categoryMap: Record<string, string> = {
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
            const preview = details?.body ? details.body.substring(0, 30) + (details.body.length > 30 ? '...' : '') : '';
            return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} ${userId} | ${details?.messageType || 'text'} | "${preview}"`;
            
        case 'BUFFER_TIMER_SET':
        case 'BUFFER_TIMER_CANCELLED':
        case 'BUFFER_TIMER_RESPECTED':
            const delay = details?.delay || details?.currentDelay || details?.newDelay;
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
                const msgDetails = messages.map((m: any) => 
                    `[${m.type === 'voice_transcription' ? 'Voice' : 'Text'}:${m.length}ch]`
                ).join(' + ');
                return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} ${userId} | ${msgCount} messages grouped | ${totalLength}ch total | ${msgDetails}`;
            } else {
                const preview2 = details?.combinedPreview ? details.combinedPreview.substring(0, 50) + '...' : '';
                return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} ${userId} | ${msgCount}msg | ${totalLength}ch | "${preview2}"`;
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
            
            // Si contiene error de audio o es muy corto, mostrar completo
            if (containsAudioError || contentLength < 200) {
                return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} ${userId} | ${threadId} | ${contentLength}ch | response: "${fullResponse}"${containsAudioError ? ' [AUDIO_ERROR_DETECTED]' : ''}`;
            } else {
                // Para respuestas largas, mostrar preview
                const preview = fullResponse.substring(0, 150) + '...';
                return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} ${userId} | ${threadId} | ${contentLength}ch | response: "${preview}"`;
            }
            
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
            let audioSizeTranscribed = details?.size ? ` | ${Math.round(details.size/1024)}KB` : '';
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
            const msgPreview = details?.preview ? details.preview.substring(0, 20) + '...' : '';
            return `[${timestamp}] [${level}] [${shortCategory}] ${userId} | ${processMsgCount}msg | "${msgPreview}"`;
            
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
            
        default:
            // Formato genérico compacto MANTENIENDO DATOS CRÍTICOS
            const genericDetails = [];
            if (userId) genericDetails.push(`u:${userId}`);
            if (threadId) genericDetails.push(threadId);
            if (duration) genericDetails.push(formatDuration(duration));
            if (tokens) genericDetails.push(formatTokens(tokens));
            if (responseLength) genericDetails.push(`${responseLength}ch`);
            
            // Manejar errores de forma especial - SIEMPRE mostrar detalles completos
            if (level === 'ERROR' || level === 'FATAL') {
                const errorDetails = [];
                if (details?.error) errorDetails.push(`error: ${details.error}`);
                if (details?.code) errorDetails.push(`code: ${details.code}`);
                if (details?.stack && LOG_LEVEL === 'debug') {
                    const stackLines = details.stack.split('\n').slice(0, 3).join(' | ');
                    errorDetails.push(`stack: ${stackLines}`);
                }
                const errorStr = errorDetails.length > 0 ? ` | ${errorDetails.join(' | ')}` : '';
                return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} ${message}${errorStr}`;
            }
            
            const detailsStr = genericDetails.length > 0 ? ` | ${genericDetails.join(' | ')}` : '';
            return `[${timestamp}] [${level}] [${shortCategory}]${fileInfo} ${message}${detailsStr}`;
    }
}

// 🔧 NUEVO: Función para formatear logs simples de terminal (DEPRECATED - usar formatCompactLog)
function formatSimpleConsoleLog(category: string, message: string, details: any, level: LogLevel): string {
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
        return `👤 ${userName}: ${preview} → ⏳ ${details?.timeoutMs ? details.timeoutMs/1000 : 8}s...`;
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
export const logInfo = (cat: string, msg: string, details?: Record<string, any>, sourceFile?: string) => {
    if (cat === 'MESSAGE_BUFFERED' && details?.bufferCount <= 1 && IS_PRODUCTION) return;  // Omitir si bufferCount <=1 en prod
    if (cat === 'BUFFER_TIMER_RESET' && IS_PRODUCTION) return;  // Omitir resets en prod
    enrichedLog(cat, msg, details, 'INFO', sourceFile);
};
export const logSuccess = (cat: string, msg: string, details?: Record<string, any>, sourceFile?: string) => enrichedLog(cat, msg, details, 'SUCCESS', sourceFile);
export const logWarning = (cat: string, msg: string, details?: Record<string, any>, sourceFile?: string) => enrichedLog(cat, msg, details, 'WARNING', sourceFile);
export const logError = (cat: string, msg: string, details?: Record<string, any>, sourceFile?: string) => enrichedLog(cat, msg, details, 'ERROR', sourceFile);
export const logDebug = (cat: string, msg: string, details?: Record<string, any>, sourceFile?: string) => {
    if (DETAILED_LOGS && !IS_PRODUCTION) {  // Solo en no-production o si detailed enabled
        enrichedLog(cat, `[DEBUG] ${msg}`, details, 'INFO', sourceFile);
    }
};

// Se mantienen las funciones específicas para facilitar la refactorización, pero ahora usan enrichedLog
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

// 🚀 NUEVO: Funciones de conveniencia para nuevos niveles
export const logTrace = (cat: string, msg: string, details?: Record<string, any>) => enrichedLog(cat, msg, details, 'TRACE');
export const logFatal = (cat: string, msg: string, details?: Record<string, any>) => enrichedLog(cat, msg, details, 'FATAL');
export const logAlert = (cat: string, msg: string, details?: Record<string, any>) => enrichedLog(cat, msg, details, 'ALERT');

// 🔧 ETAPA 3: Exportar funciones de tracing
export {
    startRequestTracing,
    updateRequestStage,
    registerToolCall,
    updateToolCallStatus,
    endRequestTracing,
    generateRequestId
}; 