import fs from 'fs';
import path from 'path';
import { LogConfig, shouldLog } from './log-config';

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

// --- Configuración de Buffer ---
const BUFFER_FLUSH_INTERVAL = 100; // 100ms
const MAX_BUFFER_SIZE = 50; // Flush si hay 50+ entradas

// --- Estado Global ---
let logBuffer: string[] = [];
let flushTimer: NodeJS.Timeout | null = null;
let sessionInitialized = false;

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

// --- Funciones de Sesión ---
const ensureLogDirectory = (): void => {
    if (isCloudRun) return; // No crear archivos en Cloud Run
    
    if (!fs.existsSync(LOG_DIR)) {
        try {
            fs.mkdirSync(LOG_DIR, { recursive: true });
        } catch (error) {
            console.error(`Error creando directorio de logs: ${error}`);
        }
    }
};

const cleanupOldSessions = (): void => {
    if (isCloudRun) return; // No limpiar archivos en Cloud Run
    
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
    
    if (!isCloudRun) {
        // Solo en local: crear archivos de log
        ensureLogDirectory();
        cleanupOldSessions();
        
        // Escribir header de sesión
        const sessionHeader = `
=== NUEVA SESIÓN DEL BOT ===
Timestamp: ${getColombiaNowTimestamp().replace(/-/g, ':').replace('T', ' ')} (Colombia UTC-5)
Session ID: ${SESSION_ID}
PID: ${process.pid}
Node Version: ${process.version}
=============================

`;
        
        try {
            fs.writeFileSync(LOG_FILE, sessionHeader);
            
            // Mostrar información de sesión
            console.log(`📁 Logs de esta sesión: ${LOG_FILE}`);
            console.log(`🔄 Manteniendo máximo ${MAX_SESSIONS} sesiones`);
            
        } catch (error) {
            console.error('Error inicializando sesión:', error);
        }
    }
    // En Cloud Run: solo marcar como inicializado (sin mensaje innecesario)
    
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
        'MANUAL_NO_THREAD', 'WHATSAPP_SEND', 'AI_PROCESSING', 'WHATSAPP_OUT',
        'BEDS24_DEBUG_OUTPUT', 'RESPONSE_SANITIZED', 'MESSAGE_SANITIZED', 
        'BEDS24_RESPONSE_DETAIL', 'CONTACT_API', 'CONTACT_API_DETAILED',
        'CONTEXT_LABELS', 'NEW_THREAD_LABELS', 'LABELS_24H',
        'WEBHOOK_STATUS', 'THREAD_DETAILS', 'OPENAI_INTERNAL', 'RUN_QUEUE', 'BUFFER_TIMER_RESET'
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
    
    // Escribir al archivo de sesión (solo en local)
    if (!isCloudRun) {
        try {
            const content = entries.join('\n') + '\n';
            fs.appendFileSync(LOG_FILE, content, 'utf8');
        } catch (error) {
            console.error(`Error escribiendo logs: ${error}`);
        }
    } else if (LogConfig.enableDetailedLogs) {
        // En Cloud Run, emitir cada línea detallada a stdout para Cloud Logging
        entries.forEach(line => console.log(line));
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
    
    // Escribir footer de sesión (solo en local)
    if (!isCloudRun) {
        const sessionFooter = `
=============================
=== FIN DE SESIÓN DEL BOT ===
Timestamp: ${getColombiaNowTimestamp().replace(/-/g, ':').replace('T', ' ')} (Colombia UTC-5)
Session ID: ${SESSION_ID}
Duración: ${Math.round((Date.now() - new Date(SESSION_TIMESTAMP.replace(/-/g, ':')).getTime()) / 1000)}s
=============================
`;
        
        try {
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
            console.error('Error guardando logs:', error);
        }
    }
    // En Cloud Run: logs se envían automáticamente (sin mensaje innecesario)
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
    bufferInterval: BUFFER_FLUSH_INTERVAL,
    maxBufferSize: MAX_BUFFER_SIZE
}); 