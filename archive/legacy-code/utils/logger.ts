import fs from 'fs';
import path from 'path';
import { LogConfig, shouldLog } from './log-config';

// --- Tipos ---
export type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'FATAL' | 'ALERT';

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    category: string;
    source: string;
    message: string;
    details?: any;
}

// --- Detectar entorno ---
const isCloudRun = !!process.env.K_SERVICE || process.env.NODE_ENV === 'production';

// --- Función para obtener timestamp en zona horaria de Colombia ---
const getColombiaNowTimestamp = (): string => {
    const now = new Date();
    // Ajustar a zona horaria de Colombia (UTC-5)
    const colombiaTime = new Date(now.getTime() - (5 * 60 * 60 * 1000));
    return colombiaTime.toISOString().replace(/[:.]/g, '-').slice(0, 19);
};

// --- Configuración de Sesión ---
const SESSION_TIMESTAMP = getColombiaNowTimestamp();
const SESSION_ID = `session-${SESSION_TIMESTAMP}`;
const LOG_DIR = 'logs';
const LOG_FILE = path.join(LOG_DIR, `bot-session-${SESSION_TIMESTAMP}.log`);
const MAX_SESSIONS = 5; // Máximo número de sesiones a mantener

// --- Configuración de Buffer por Entorno ---
const BUFFER_FLUSH_INTERVAL = 100; // 100ms solo para local
const MAX_BUFFER_SIZE_LOCAL = 50; // 50 entradas para local (tiempo real)
const MAX_BUFFER_SIZE_RAILWAY = 400; // 400 entradas para Railway (eficiente)

// --- Estado Global ---
let logBuffer: string[] = [];
let flushTimer: NodeJS.Timeout | null = null;
let sessionInitialized = false;

// --- Colores para consola ---
const colors = {
    TRACE: '\x1b[90m',     // Gris claro
    INFO: '\x1b[36m',      // Cyan
    SUCCESS: '\x1b[32m',   // Green
    WARNING: '\x1b[33m',   // Yellow
    ERROR: '\x1b[31m',     // Red
    DEBUG: '\x1b[35m',     // Magenta
    FATAL: '\x1b[41m', // Rojo con fondo
    ALERT: '\x1b[33m',// Amarillo intenso
    RESET: '\x1b[0m',      // Reset
    BRIGHT: '\x1b[1m',     // Bright
    DIM: '\x1b[2m',        // Dim
    GREEN: '\x1b[32m',     // Green
    YELLOW: '\x1b[33m',    // Yellow
    BLUE: '\x1b[34m',      // Blue
    CYAN: '\x1b[36m',      // Cyan
    WHITE: '\x1b[37m',     // White
    RED: '\x1b[31m'        // Red
};

// --- Mapeo de emojis por categoría ---
const categoryEmojis: Record<string, string> = {
    // MENSAJES
    'MESSAGE_RECEIVED': '💬⬅️',
    'MESSAGE_SENT': '💬➡️',
    'MESSAGE_PROCESSING': '⚙️',
    
    // APIs Y SERVICIOS EXTERNOS
    'OPENAI': '🤖',
    'OPENAI_REQUEST': '🤖',
    'OPENAI_RESPONSE': '🤖',
    'OPENAI_RUN_COMPLETED': '🤖',
    'BEDS24': '🏠',
    'BEDS24_REQUEST': '🏠',
    'BEDS24_API_CALL': '🏠',
    'BEDS24_RESPONSE_DETAIL': '🏠',
    'BEDS24_RESPONSE_SUMMARY': '🏠',
    'WHAPI': '💬',
    'WHATSAPP_IN': '💬',
    'WHATSAPP_OUT': '💬',
    'WHATSAPP_SEND': '💬',
    'AUTH_SERVICE': '🔑',
    'HTTP_REQUEST': '🌐',
    
    // SISTEMA INTERNO
    'LOCK_SYSTEM': '🔒',
    'THREAD_CREATED': '🔀',
    'THREAD_PERSIST': '🔀',
    'THREAD_CLEANUP': '🔀',
    'THREAD_REUSE': '🔀',
    'THREAD_CREATE': '🔀',
    'WEBHOOK': '🔔',
    'RATE_LIMIT': '⏳',
    'PERSISTENCE': '💾',
    'BUFFER': '🔄',
    'MESSAGE_BUFFER': '🔄',
    'METRICS': '📊',
    'BOT_STARTED': '🚀',
    'SERVER_START': '🚀',
    'BOT_STOPPED': '⛔',
    'DEBUG': '🐞',
    'PERFORMANCE': '⚡',
    'MEMORY': '📦',
    'CONNECTION': '🔗',
    'LOG': '📜',
    
    // ERRORES Y ALERTAS
    'FATAL_ERROR': '☠️',
    'ALERT': '🚨',
    'WARNING': '⚠️',
    'RECOVERY': '🔧',
    
    // FUNCIONES
    'FUNCTION_CALLING_START': '⚙️',
    'FUNCTION_EXECUTING': '⚙️',
    'FUNCTION_HANDLER': '⚙️',
    'FUNCTION_EXECUTED': '⚙️',
    
    // PROCESAMIENTO
    'AI_PROCESSING': '🤖',
    'MESSAGE_PROCESS': '⚙️',
    'WHATSAPP_CHUNKS_COMPLETE': '💬',
    
    // INICIALIZACIÓN
    'THREADS_LOADED': '💾',
    'STARTUP': '🚀',
    'CONFIG': '⚙️',
    'APP_INIT': '🚀',
    'OPENAI_INIT': '🤖',
    'LOGGER_INIT': '📜'
};

// --- Función para obtener emoji de categoría ---
const getCategoryEmoji = (category: string): string => {
    return categoryEmojis[category] || '';
};

// --- Funciones de Sesión ---
const ensureLogDirectory = (): void => {
    // Crear directorio de logs en TODOS los entornos
    
    if (!fs.existsSync(LOG_DIR)) {
        try {
            fs.mkdirSync(LOG_DIR, { recursive: true });
        } catch (error) {
            console.error(`Error creando directorio de logs: ${error}`);
        }
    }
};

const cleanupOldSessions = (): void => {
    // Limpiar archivos antiguos en TODOS los entornos
    
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

const initializeSession = (): void => {
    if (sessionInitialized) return;
    
    // Crear archivos de log en TODOS los entornos
    ensureLogDirectory();
    cleanupOldSessions();
    
    // Escribir header de sesión
    const sessionHeader = `
=== NUEVA SESIÓN DEL BOT ===
Timestamp: ${getColombiaNowTimestamp().replace(/-/g, ':').replace('T', ' ')} (Colombia UTC-5)
Session ID: ${SESSION_ID}
PID: ${process.pid}
Node Version: ${process.version}
Environment: ${isCloudRun ? 'Production (Railway/Cloud)' : 'Local Development'}
=============================

`;
    
    try {
        fs.writeFileSync(LOG_FILE, sessionHeader);
        
        // Mostrar información de sesión
        console.log(`📁 Logs de esta sesión: ${LOG_FILE}`);
        console.log(`🔄 Manteniendo máximo ${MAX_SESSIONS} sesiones`);
        
    } catch (error) {
        console.error('Error inicializando sesión:', error);
        // En Railway, continuar sin archivos si hay error de permisos
    }
    
    sessionInitialized = true;
};

// --- Utilidades ---
const getISOTimestamp = (): string => {
    const now = new Date();
    // Ajustar a zona horaria de Colombia (UTC-5)
    const colombiaTime = new Date(now.getTime() - (5 * 60 * 60 * 1000));
    return colombiaTime.toISOString();
};

const getCallerInfo = (): string => {
    const stack = new Error().stack;
    if (!stack) return 'unknown.ts';
    
    const lines = stack.split('\n');
    // Buscar la línea que no sea esta función ni la función detailedLog
    for (let i = 3; i < lines.length; i++) {
        const line = lines[i];
        if (line && line.includes('.ts:') && !line.includes('logger.ts')) {
            const match = line.match(/([^/\\]+\.ts):/);
            if (match) {
                return match[1];
            }
        }
    }
    return 'unknown.ts';
};

const formatLogEntry = (entry: LogEntry): string => {
    const detailsStr = entry.details ? ` | ${JSON.stringify(entry.details)}` : '';
    return `[${entry.timestamp}] [${entry.level}] ${entry.category} [${entry.source}]: ${entry.message}${detailsStr}`;
};

// --- NUEVA FUNCIÓN: Logs súper simples para consola ---
const formatSimpleConsoleEntry = (entry: LogEntry): string => {
    const { category, message, details } = entry;
    
    // Extraer información útil de los detalles
    const userName = details?.userName || details?.cleanName || 'Usuario';
    const messagePreview = details?.preview || details?.messagePreview || '';
    const duration = details?.duration || (message.includes('en ') ? message.match(/en (\d+)ms/)?.[1] : null);
    const responseLength = details?.responseLength;
    const messageLength = details?.messageLength;
    
    // === INICIO DEL BOT === (Sin prefijos)
    if (category === 'SERVER_START') {
        return `${colors.BRIGHT}${colors.GREEN}${getCategoryEmoji(category)} Bot TeAlquilamos iniciado y listo${colors.RESET}`;
    }
    
    if (category === 'THREADS_LOADED') {
        const totalThreads = details?.totalThreads || 0;
        if (totalThreads > 0) {
            return `${colors.WHITE}${getCategoryEmoji(category)} ${totalThreads} conversación${totalThreads > 1 ? 'es' : ''} activa${totalThreads > 1 ? 's' : ''}${colors.RESET}`;
        }
        return '';
    }
    
    // === MENSAJES DE WHATSAPP === (No mostrar, se maneja directo en app.ts)
    if (category === 'WHATSAPP_IN') {
        return ''; // No mostrar en consola
    }
    
    if (category === 'WHATSAPP_OUT') {
        return ''; // No mostrar en consola, ya se muestra en processUserMessage
    }
    
    // === PROCESAMIENTO IA, ENTREGA, BUFFER === (No mostrar, se maneja en app.ts)
    if (category === 'AI_PROCESSING' || 
        (category === 'WHATSAPP_SEND' && entry.level === 'SUCCESS') ||
        category === 'TIMER' ||
        category === 'MESSAGE_BUFFER') {
        return ''; // No mostrar en consola
    }
    
    // === THREAD PERSISTENCE === (Solo técnico, no en consola)
    if (category === 'THREAD_REUSE' || category === 'THREAD_CREATE') {
        return ''; // No mostrar en consola
    }
    
    // === OPENAI Y FUNCIONES === 
    if (category === 'OPENAI_REQUEST') {
        const action = details?.action || message;
        return `${colors.BLUE}${getCategoryEmoji(category)} OpenAI → ${action}${colors.RESET}`;
    }
    
    if (category === 'OPENAI_RESPONSE' || category === 'OPENAI_RUN_COMPLETED') {
        const duration = details?.duration;
        if (duration) {
            return `${colors.GREEN}${getCategoryEmoji(category)} OpenAI → Respuesta completa (${duration}ms)${colors.RESET}`;
        }
        return `${colors.GREEN}${getCategoryEmoji(category)} OpenAI → ${message}${colors.RESET}`;
    }
    
    if (category === 'FUNCTION_CALLING_START') {
        // Eliminado - redundante
        return '';
    }
    
    if (category === 'FUNCTION_EXECUTING') {
        // Eliminado - redundante
        return '';
    }
    
    if (category === 'FUNCTION_HANDLER' || category === 'FUNCTION_EXECUTED') {
        // Eliminado - se maneja en resultado específico
        return '';
    }
    
    // === BEDS24 ===
    if (category === 'BEDS24_REQUEST') {
        // Eliminado - redundante
        return '';
    }
    
    if (category === 'BEDS24_API_CALL') {
        // Eliminado - redundante
        return '';
    }
    
    if (category === 'BEDS24_RESPONSE_DETAIL') {
        // Eliminado - redundante
        return '';
    }
    
    if (category === 'BEDS24_RESPONSE_SUMMARY') {
        // Extraer números de opciones desde el mensaje
        const completasMatch = message.match(/(\d+) opciones completas/);
        const splitsMatch = message.match(/(\d+) opciones con traslado/);
        
        const completas = completasMatch ? parseInt(completasMatch[1]) : 0;
        const splits = splitsMatch ? parseInt(splitsMatch[1]) : 0;
        
        return `${colors.GREEN}🏠 ${completas} completa${completas !== 1 ? 's' : ''} + ${splits} alternativa${splits !== 1 ? 's' : ''}${colors.RESET}`;
    }
    
    // === MENSAJES Y PROCESAMIENTO ===
    if (category === 'MESSAGE_RECEIVED') {
        const fullMessage = details?.messageText || details?.preview || details?.messagePreview || message;
        const user = details?.userName || details?.userId || 'Usuario';
        
        // Si el mensaje es muy largo, truncar inteligentemente
        const displayMessage = fullMessage.length > 100 
            ? fullMessage.substring(0, 97) + '...' 
            : fullMessage;
        
        return `${colors.CYAN}${getCategoryEmoji(category)} ${user}: "${displayMessage}"${colors.RESET}`;
    }
    
    if (category === 'MESSAGE_PROCESS') {
        const count = details?.messageCount || '?';
        return `${colors.YELLOW}${getCategoryEmoji(category)} Procesando ${count} mensajes agrupados...${colors.RESET}`;
    }
    
    if (category === 'WHATSAPP_SEND' && entry.level === 'SUCCESS') {
        const fullMessage = details?.messageText || details?.preview || message;
        
        // Si el mensaje es muy largo, truncar inteligentemente
        const displayMessage = fullMessage.length > 80 
            ? fullMessage.substring(0, 77) + '...' 
            : fullMessage;
        
        return `${colors.GREEN}${getCategoryEmoji(category)} WhatsApp → "${displayMessage}"${colors.RESET}`;
    }
    
    if (category === 'WHATSAPP_CHUNKS_COMPLETE') {
        const chunks = details?.totalChunks || message.match(/\d+/)?.[0] || '?';
        return `${colors.GREEN}${getCategoryEmoji(category)} WhatsApp → ${chunks} párrafos enviados${colors.RESET}`;
    }
    
    // === THREAD MANAGEMENT ===
    if (category === 'THREAD_CREATED') {
        const threadId = details?.threadId || message.match(/thread_\w+/)?.[0] || '';
        return `${colors.BLUE}${getCategoryEmoji(category)} Thread creado: ${threadId}${colors.RESET}`;
    }
    
    // THREAD_PERSIST y THREAD_CLEANUP - Solo técnico, no en terminal
    if (category === 'THREAD_PERSIST' || category === 'THREAD_CLEANUP') {
        return ''; // No mostrar en consola
    }
    
    // === ERRORES ===
    if (entry.level === 'ERROR') {
        return `${colors.RED}${getCategoryEmoji(category)} Error: ${message}${colors.RESET}`;
    }
    
    if (entry.level === 'WARNING' && !message.includes('Webhook recibido sin mensajes')) {
        return `${colors.YELLOW}${getCategoryEmoji(category)} ${message}${colors.RESET}`;
    }
    
    // === IGNORAR LOGS TÉCNICOS ===
    const ignoreCategories = [
        // Webhooks y status repetitivos
        'WEBHOOK', 'WEBHOOK_SKIP', 'WEBHOOK_STATUS',
        
        // Health checks y metadata
        'HEALTH_CHECK', 'HTTP_REQUEST', 'CLOUD_RUN_METADATA', 'TRACE_SPANS', 'BUILD_INFO',
        
        // Extracción de información básica
        'USER_ID_EXTRACTION', 'NAME_EXTRACTION', 'USER_DEBUG',
        
        // Threads internos (mantener solo los críticos)
        'THREAD_LOOKUP', 'THREAD_GET', 'THREAD_CHECK', 'THREAD_DETAILS',
        
        // Inicialización y configuración
        'DEBUG_FILE', 'STARTUP', 'CONFIG', 'APP_INIT', 'OPENAI_INIT', 'LOGGER_INIT',
        
        // Buffers y timers internos
        'MESSAGE_BUFFER', 'TIMER', 'BUFFER_TIMER_RESET',
        
        // Mensajes del bot
        'BOT_MESSAGE_TRACKED', 'BOT_MESSAGE_FILTERED', 'BOT_MESSAGE_CLEANUP',
        
        // Procesamiento manual interno
        'MANUAL_DETECTED', 'MANUAL_BUFFER_CREATE', 'MANUAL_BUFFERING', 
        'MANUAL_PROCESSING', 'MANUAL_SYNC_START', 'MANUAL_SYNC_SUCCESS', 
        'MANUAL_SYNC_ERROR', 'MANUAL_NO_THREAD',
        
        // Sanitización y limpieza
        'RESPONSE_SANITIZED', 'MESSAGE_SANITIZED',
        
        // Detalles internos
        'MESSAGE_DETAIL', 'THREADS_INFO', 'THREADS_DETAIL', 'CONVERSATION_FLOW',
        'OPENAI_INTERNAL', 'RUN_QUEUE',
        
        // APIs de contacto detalladas
        'CONTACT_API_DETAILED',
        
        // Etiquetas vacías
        'CONTEXT_LABELS_EMPTY', 'NEW_THREAD_LABELS', 'LABELS_24H'
        
        // NOTA: Las siguientes categorías CRÍTICAS ya NO están siendo ignoradas:
        // - FUNCTION_CALLING_START, FUNCTION_EXECUTING, FUNCTION_HANDLER
        // - BEDS24_REQUEST, BEDS24_API_CALL, BEDS24_RESPONSE_DETAIL, BEDS24_RESPONSE_SUMMARY
        // - OPENAI_REQUEST, OPENAI_RESPONSE, OPENAI_RUN_COMPLETED
        // - MESSAGE_RECEIVED, MESSAGE_PROCESS, WHATSAPP_SEND, WHATSAPP_CHUNKS_COMPLETE
        // - THREAD_CREATED, THREAD_REUSE, THREAD_CLEANUP, THREAD_PERSIST
        // - ERROR, WARNING, SUCCESS
    ];
    
    if (ignoreCategories.includes(category) || entry.level === 'DEBUG') {
        return ''; // No mostrar en consola, solo guardar en logs
    }
    
    // === NO MOSTRAR FALLBACK ===
    return ''; // Solo mostrar logs específicos
};

const formatConsoleEntry = (entry: LogEntry): string => {
    return formatSimpleConsoleEntry(entry);
};

const flushBuffer = (): void => {
    if (logBuffer.length === 0) return;
    
    // Asegurar que la sesión esté inicializada
    if (!sessionInitialized) {
        initializeSession();
    }
    
    const entries = [...logBuffer];
    logBuffer = [];
    
    // Escribir al archivo de sesión en TODOS los entornos
    try {
        const content = entries.join('\n') + '\n';
        fs.appendFileSync(LOG_FILE, content, 'utf8');
    } catch (error) {
        console.error(`Error escribiendo logs: ${error}`);
        // En Railway, continuar sin archivos si hay error de permisos
    }
    
    // En Cloud Run, también emitir logs detallados a consola si está habilitado
    if (isCloudRun && LogConfig.enableDetailedLogs) {
        entries.forEach(line => console.log(line));
    }
    
    // Limpiar timer (solo local)
    if (!isCloudRun && flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }
};

const scheduleFlush = (): void => {
    // Solo programar timer en LOCAL (no en Railway)
    if (isCloudRun) return;
    
    if (flushTimer) return;
    
    flushTimer = setTimeout(() => {
        flushBuffer();
    }, BUFFER_FLUSH_INTERVAL);
};

const addToBuffer = (logEntry: string): void => {
    logBuffer.push(logEntry);
    
    // Buffer diferente según entorno
    const maxSize = isCloudRun ? MAX_BUFFER_SIZE_RAILWAY : MAX_BUFFER_SIZE_LOCAL;
    
    if (logBuffer.length >= maxSize) {
        flushBuffer(); // Flush inmediato cuando se llena
    } else if (!isCloudRun) {
        scheduleFlush(); // Solo programar timer en LOCAL
    }
};

// --- Función Principal ---
export const detailedLog = (
    level: LogLevel,
    category: string,
    message: string,
    details?: any
): void => {
    const levelForFilter = (level === 'SUCCESS' ? 'INFO' : level) as 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
    // Skip completely if configuration indicates so
    if (!shouldLog(category, levelForFilter)) {
        return;
    }
    const timestamp = getISOTimestamp();
    const source = getCallerInfo();
    
    const entry: LogEntry = {
        timestamp,
        level,
        category,
        source,
        message,
        details
    };
    
    // Mostrar en consola (súper simple)
    const consoleOutput = formatConsoleEntry(entry);
    if (consoleOutput) {
        console.log(consoleOutput);
    }

    // Crear línea completa para archivo/logs
    const fileEntry = formatLogEntry(entry);

    // En Cloud Run, si se requieren logs detallados, imprimir inmediatamente la línea completa
    if (isCloudRun && LogConfig.enableDetailedLogs) {
        console.log(fileEntry);
    }

    // Agregar al buffer para archivo (solo sentido en local)
    addToBuffer(fileEntry);
};

// --- Funciones de Conveniencia ---
export const logInfo = (category: string, message: string, details?: any): void => {
    detailedLog('INFO', category, message, details);
};

export const logSuccess = (category: string, message: string, details?: any): void => {
    detailedLog('SUCCESS', category, message, details);
};

export const logWarning = (category: string, message: string, details?: any): void => {
    detailedLog('WARNING', category, message, details);
};

export const logError = (category: string, message: string, details?: any): void => {
    detailedLog('ERROR', category, message, details);
};

export const logDebug = (category: string, message: string, details?: any): void => {
    if (!isCloudRun && LogConfig.enableDetailedLogs) {
        detailedLog('DEBUG', category, message, details);
    }
};

// 🚀 NUEVO: Funciones de conveniencia para nuevos niveles
export const logTrace = (category: string, message: string, details?: any): void => {
    if (!isCloudRun && LogConfig.enableDetailedLogs) {
        detailedLog('TRACE', category, message, details);
    }
};

export const logFatal = (category: string, message: string, details?: any): void => {
    detailedLog('FATAL', category, message, details);
};

export const logAlert = (category: string, message: string, details?: any): void => {
    detailedLog('ALERT', category, message, details);
};

// --- Funciones Especializadas ---
export const logThreadPersist = (userId: string, threadId: string, action: string = 'updated'): void => {
    detailedLog('INFO', 'THREAD_PERSIST', `Thread ${action} para ${userId}: ${threadId}`);
};

export const logOpenAIRequest = (userId: string, action: string, threadId?: string): void => {
    const details = threadId ? { threadId } : undefined;
    detailedLog('INFO', 'OPENAI_REQUEST', `${action} para ${userId}`, details);
};

export const logOpenAIResponse = (userId: string, duration: number, success: boolean, userName?: string): void => {
    const level = success ? 'SUCCESS' : 'ERROR';
    const status = success ? 'obtenida' : 'falló';
    detailedLog(level, 'AI_PROCESSING', `Respuesta ${status} para ${userId} en ${duration}ms`, { duration, userName });
};

export const logWhatsAppMessage = (userId: string, direction: 'IN' | 'OUT', preview: string, userName?: string): void => {
    detailedLog('INFO', `WHATSAPP_${direction}`, `${userId}: "${preview}"`, { userName, preview });
};

export const logBufferActivity = (userId: string, action: string, count?: number): void => {
    const message = count !== undefined 
        ? `${action} para ${userId} (total: ${count})`
        : `${action} para ${userId}`;
    detailedLog('INFO', 'MESSAGE_BUFFER', message, { total: count });
};

// --- Funciones especiales para logs simples ---
export const logSimpleMessage = (userName: string, direction: 'IN' | 'OUT', messageText: string): void => {
    if (direction === 'IN') {
        detailedLog('INFO', 'WHATSAPP_IN', `mensaje entrante`, { userName, messageText });
    } else {
        detailedLog('INFO', 'WHATSAPP_OUT', `mensaje saliente`, { userName, messageText, preview: messageText });
    }
};

export const logSimpleProcessing = (userName: string, duration: number): void => {
    detailedLog('SUCCESS', 'AI_PROCESSING', `Respuesta obtenida para ${userName} en ${duration}ms`, { userName, duration });
};

// --- Funciones de Sesión ---
export const getSessionInfo = () => {
    return {
        sessionId: SESSION_ID,
        logFile: LOG_FILE,
        timestamp: SESSION_TIMESTAMP,
        pid: process.pid
    };
};

export const listAvailableSessions = () => {
    try {
        const files = fs.readdirSync(LOG_DIR)
            .filter(file => file.startsWith('bot-session-') && file.endsWith('.log'))
            .map(file => ({
                name: file,
                path: path.join(LOG_DIR, file),
                stats: fs.statSync(path.join(LOG_DIR, file)),
                size: fs.statSync(path.join(LOG_DIR, file)).size
            }))
            .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());

        return files;
    } catch (error) {
        console.error('Error listando sesiones:', error);
        return [];
    }
};

// --- Limpieza al salir ---
const cleanup = (): void => {
    if (logBuffer.length > 0) {
        flushBuffer();
    }
    
    // Escribir footer de sesión en TODOS los entornos
    try {
        const sessionFooter = `
=============================
=== FIN DE SESIÓN DEL BOT ===
Timestamp: ${getColombiaNowTimestamp().replace(/-/g, ':').replace('T', ' ')} (Colombia UTC-5)
Session ID: ${SESSION_ID}
Duración: ${Math.round((Date.now() - new Date(SESSION_TIMESTAMP.replace(/-/g, ':')).getTime()) / 1000)}s
=============================
`;
        
        fs.appendFileSync(LOG_FILE, sessionFooter);
        console.log(`✅ Logs guardados en: ${LOG_FILE}`);
        
        // Mostrar resumen de sesiones disponibles
            const sessions = listAvailableSessions();
            if (sessions.length > 0) {
                console.log(`\n📁 Sesiones disponibles (${sessions.length}/${MAX_SESSIONS}):`);
                sessions.forEach((session, index) => {
                    const sizeKB = (session.size / 1024).toFixed(1);
                    const date = session.stats.mtime.toLocaleString('es-CO');
                    console.log(`   ${index + 1}. ${session.name} (${sizeKB}KB - ${date})`);
                });
            }
    } catch (error) {
        console.error('Error guardando logs de sesión:', error);
        // En Railway, continuar sin logs de archivo si hay error de permisos
    }
};

process.on('exit', cleanup);
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('uncaughtException', (error) => {
    logError('SYSTEM', 'Uncaught Exception', { error: error.message, stack: error.stack });
    cleanup();
    process.exit(1);
});

// --- Inicialización ---
initializeSession();

// Log de inicio del sistema
detailedLog('SUCCESS', 'LOGGER_INIT', 'Sistema de logging por sesión inicializado', {
    sessionId: SESSION_ID,
    logFile: LOG_FILE,
    maxSessions: MAX_SESSIONS,
    maxBufferSizeLocal: MAX_BUFFER_SIZE_LOCAL,
    maxBufferSizeRailway: MAX_BUFFER_SIZE_RAILWAY,
    bufferInterval: BUFFER_FLUSH_INTERVAL
}); 