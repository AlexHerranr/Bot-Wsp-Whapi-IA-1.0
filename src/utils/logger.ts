import fs from 'fs';
import path from 'path';

// --- Tipos ---
export type LogLevel = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'DEBUG';

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    category: string;
    source: string;
    message: string;
    details?: any;
}

// --- Configuración ---
const LOG_DIR = 'logs';
const BUFFER_FLUSH_INTERVAL = 100; // 100ms
const MAX_BUFFER_SIZE = 50; // Flush si hay 50+ entradas

// --- Estado Global ---
let logBuffer: string[] = [];
let flushTimer: NodeJS.Timeout | null = null;
let currentLogFile = '';

// --- Colores para consola ---
const colors = {
    INFO: '\x1b[36m',      // Cyan
    SUCCESS: '\x1b[32m',   // Green
    WARNING: '\x1b[33m',   // Yellow
    ERROR: '\x1b[31m',     // Red
    DEBUG: '\x1b[35m',     // Magenta
    RESET: '\x1b[0m',      // Reset
    BRIGHT: '\x1b[1m',     // Bright
    DIM: '\x1b[2m',        // Dim
    GREEN: '\x1b[32m',     // Green
    YELLOW: '\x1b[33m',    // Yellow
    BLUE: '\x1b[34m',      // Blue
    WHITE: '\x1b[37m',     // White
    RED: '\x1b[31m'        // Red
};

// --- Utilidades ---
const getISOTimestamp = (): string => {
    return new Date().toISOString();
};

const getDateString = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getLogFileName = (): string => {
    return path.join(LOG_DIR, `bot-${getDateString()}.log`);
};

const ensureLogDirectory = (): void => {
    if (!fs.existsSync(LOG_DIR)) {
        try {
            fs.mkdirSync(LOG_DIR, { recursive: true });
        } catch (error) {
            console.error(`Error creando directorio de logs: ${error}`);
        }
    }
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
        return `${colors.BRIGHT}${colors.GREEN}🚀 Bot TeAlquilamos iniciado y listo${colors.RESET}`;
    }
    
    if (category === 'THREADS_LOADED') {
        const totalThreads = details?.totalThreads || 0;
        if (totalThreads > 0) {
            return `${colors.WHITE}💾 ${totalThreads} conversación${totalThreads > 1 ? 'es' : ''} activa${totalThreads > 1 ? 's' : ''}${colors.RESET}`;
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
    
    // === ERRORES ===
    if (entry.level === 'ERROR') {
        return `${colors.RED}❌ Error: ${message}${colors.RESET}`;
    }
    
    if (entry.level === 'WARNING' && !message.includes('Webhook recibido sin mensajes')) {
        return `${colors.YELLOW}⚠️ ${message}${colors.RESET}`;
    }
    
    // === IGNORAR LOGS TÉCNICOS ===
    const ignoreCategories = [
        'WEBHOOK', 'NAME_EXTRACTION', 'USER_ID_EXTRACTION', 'WEBHOOK_USER',
        'MESSAGE_BUFFER', 'USER_DEBUG', 'THREAD_LOOKUP', 'THREAD_GET', 
        'THREAD_CHECK', 'OPENAI_REQUEST', 'MESSAGE_DETAIL', 'WEBHOOK_SKIP',
        'DEBUG_FILE', 'STARTUP', 'CONFIG', 'APP_INIT', 'OPENAI_INIT',
        'LOGGER_INIT', 'THREADS_INFO', 'THREADS_DETAIL', 'MESSAGE_PROCESS',
        'OPENAI_RESPONSE', 'CONVERSATION_FLOW', 'TIMER', 'BOT_MESSAGE_TRACKED',
        'BOT_MESSAGE_FILTERED', 'BOT_MESSAGE_CLEANUP', 'MANUAL_DETECTED',
        'MANUAL_BUFFER_CREATE', 'MANUAL_BUFFERING', 'MANUAL_PROCESSING',
        'MANUAL_SYNC_START', 'MANUAL_SYNC_SUCCESS', 'MANUAL_SYNC_ERROR',
        'MANUAL_NO_THREAD', 'WHATSAPP_SEND', 'AI_PROCESSING', 'WHATSAPP_OUT'
    ];
    
    if (ignoreCategories.includes(category) || entry.level === 'DEBUG') {
        return ''; // No mostrar en consola
    }
    
    // === NO MOSTRAR FALLBACK ===
    return ''; // Solo mostrar logs específicos
};

const formatConsoleEntry = (entry: LogEntry): string => {
    return formatSimpleConsoleEntry(entry);
};

const flushBuffer = (): void => {
    if (logBuffer.length === 0) return;
    
    ensureLogDirectory();
    
    const logFile = getLogFileName();
    const entries = [...logBuffer];
    logBuffer = [];
    
    // Escribir al archivo
    try {
        const content = entries.join('\n') + '\n';
        fs.appendFileSync(logFile, content, 'utf8');
    } catch (error) {
        console.error(`Error escribiendo logs: ${error}`);
    }
    
    // Limpiar timer
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }
};

const scheduleFlush = (): void => {
    if (flushTimer) return;
    
    flushTimer = setTimeout(() => {
        flushBuffer();
    }, BUFFER_FLUSH_INTERVAL);
};

const addToBuffer = (logEntry: string): void => {
    logBuffer.push(logEntry);
    
    // Flush inmediato si el buffer está lleno
    if (logBuffer.length >= MAX_BUFFER_SIZE) {
        flushBuffer();
    } else {
        scheduleFlush();
    }
};

// --- Función Principal ---
export const detailedLog = (
    level: LogLevel,
    category: string,
    message: string,
    details?: any
): void => {
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
    if (consoleOutput) { // Solo mostrar si no está vacío
        console.log(consoleOutput);
    }
    
    // Agregar al buffer para archivo (formato técnico completo)
    const fileEntry = formatLogEntry(entry);
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
    detailedLog('DEBUG', category, message, details);
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

// --- Limpieza al salir ---
const cleanup = (): void => {
    if (logBuffer.length > 0) {
        flushBuffer();
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
ensureLogDirectory();

// Log de inicio del sistema
console.log(`${colors.DIM}📁 Logs técnicos detallados en: ${process.cwd()}${path.sep}${getLogFileName()}${colors.RESET}`);
detailedLog('SUCCESS', 'LOGGER_INIT', 'Sistema de logging detallado inicializado', {
    logDir: LOG_DIR,
    bufferInterval: BUFFER_FLUSH_INTERVAL,
    maxBufferSize: MAX_BUFFER_SIZE,
    currentFile: getLogFileName()
}); 