/**
 * 🖥️ CONSOLE LOGGER - Tipo 1: Logs Limpios Terminal
 * 
 * Logs súper limpios para desarrollo local, solo lo esencial.
 * Formato optimizado para legibilidad humana en terminal.
 */

import { LogLevel, LogEntry } from './types';

// === COLORES PARA TERMINAL ===
const colors = {
    INFO: '\x1b[36m',      // Cyan
    SUCCESS: '\x1b[32m',   // Green  
    WARNING: '\x1b[33m',   // Yellow
    ERROR: '\x1b[31m',     // Red
    DEBUG: '\x1b[35m',     // Magenta
    RESET: '\x1b[0m',      // Reset
    BRIGHT: '\x1b[1m',     // Bright
    DIM: '\x1b[2m',        // Dim
};

/**
 * 🎯 FUNCIÓN PRINCIPAL CONSOLE LOG
 * 
 * Muestra logs súper limpios en terminal, solo información esencial.
 * Perfecto para desarrollo donde necesitas ver el flujo sin ruido.
 */
export function consoleLog(level: LogLevel, category: string, message: string, details?: any): void {
    // Formatear según el tipo de log
    const output = formatSimpleConsoleEntry({ level, category, message, details });
    
    if (output) {
        console.log(output);
    }
}

/**
 * 🎨 FORMATEADOR SIMPLE PARA TERMINAL
 * 
 * Convierte logs técnicos en formato súper legible para humanos.
 * Ejemplo: "✅ Usuario 573003913251: 'Consulta disponibilidad' → 10s..."
 */
function formatSimpleConsoleEntry(entry: Partial<LogEntry>): string {
    const { level, category, message, details } = entry;
    
    // === MENSAJES DE USUARIO ===
    if (category === 'MESSAGE_RECEIVED') {
        const userId = extractUserId(message);
        const userMessage = extractUserMessage(message);
        return `${colors.INFO}👤 Usuario ${userId}:${colors.RESET} "${userMessage}" → ⏱️ 10s...`;
    }
    
    // === RESPUESTAS DEL BOT ===
    if (category === 'WHATSAPP_CHUNKS_COMPLETE' || category === 'OPENAI_RESPONSE') {
        const duration = extractDuration(details);
        const preview = extractResponsePreview(message);
        return `${colors.SUCCESS}🤖 Bot → Completado (${duration}s) →${colors.RESET} "${preview}"`;
    }
    
    // === PROCESAMIENTO OPENAI ===
    if (category === 'OPENAI_REQUEST' && message.includes('creating_run')) {
        const userId = extractUserId(details?.shortUserId || 'unknown');
        return `${colors.INFO}🤖 Bot → Procesando mensajes → OpenAI${colors.RESET}`;
    }
    
    // === FUNCIONES EJECUTÁNDOSE ===
    if (category === 'FUNCTION_CALLING_START') {
        const functionName = extractFunctionName(message);
        return `${colors.INFO}⚙️ Ejecutando función: ${functionName}${colors.RESET}`;
    }
    
    // === CONSULTAS BEDS24 ===
    if (category === 'BEDS24_REQUEST') {
        return `${colors.INFO}🏨 Consultando disponibilidad Beds24...${colors.RESET}`;
    }
    
    if (category === 'BEDS24_RESPONSE_DETAIL') {
        const options = extractAvailabilityOptions(details);
        return `${colors.SUCCESS}✅ Beds24 → ${options} opciones encontradas${colors.RESET}`;
    }
    
    // === ERRORES ===
    if (level === 'ERROR') {
        return `${colors.ERROR}❌ Error: ${message}${colors.RESET}`;
    }
    
    // === WARNINGS IMPORTANTES ===
    if (level === 'WARNING' && !message.includes('Webhook recibido sin mensajes')) {
        return `${colors.WARNING}⚠️ ${message}${colors.RESET}`;
    }
    
    // === ÉXITOS IMPORTANTES ===
    if (level === 'SUCCESS' && (
        category.includes('SERVER_START') || 
        category.includes('BOT_READY') ||
        category.includes('THREAD_PERSIST')
    )) {
        return `${colors.SUCCESS}✅ ${message}${colors.RESET}`;
    }
    
    // === IGNORAR LOGS TÉCNICOS ===
    const ignoreCategories = [
        'WEBHOOK', 'NAME_EXTRACTION', 'USER_ID_EXTRACTION', 'WEBHOOK_USER',
        'MESSAGE_BUFFER', 'USER_DEBUG', 'THREAD_LOOKUP', 'THREAD_GET', 
        'THREAD_CHECK', 'MESSAGE_DETAIL', 'WEBHOOK_SKIP', 'DEBUG_FILE',
        'STARTUP', 'CONFIG', 'APP_INIT', 'OPENAI_INIT', 'LOGGER_INIT',
        'THREADS_INFO', 'THREADS_DETAIL', 'MESSAGE_PROCESS', 'CONVERSATION_FLOW',
        'TIMER', 'BOT_MESSAGE_TRACKED', 'BOT_MESSAGE_FILTERED', 'BOT_MESSAGE_CLEANUP',
        'MANUAL_DETECTED', 'MANUAL_BUFFER_CREATE', 'MANUAL_BUFFERING',
        'MANUAL_PROCESSING', 'MANUAL_SYNC_START', 'MANUAL_SYNC_SUCCESS',
        'MANUAL_SYNC_ERROR', 'MANUAL_NO_THREAD', 'AI_PROCESSING', 'WHATSAPP_OUT',
        'BEDS24_DEBUG_OUTPUT', 'RESPONSE_SANITIZED', 'MESSAGE_SANITIZED',
        'CONTACT_API', 'CONTACT_API_DETAILED', 'CONTEXT_LABELS',
        'NEW_THREAD_LABELS', 'LABELS_24H', 'WEBHOOK_STATUS', 'THREAD_DETAILS',
        'OPENAI_INTERNAL', 'RUN_QUEUE', 'BUFFER_TIMER_RESET'
    ];
    
    if (ignoreCategories.includes(category) || level === 'DEBUG') {
        return ''; // No mostrar en consola
    }
    
    // === FALLBACK - NO MOSTRAR ===
    return '';
}

// === FUNCIONES AUXILIARES ===

function extractUserId(text: string): string {
    const match = text.match(/573\d{9}/);
    return match ? match[0] : 'unknown';
}

function extractUserMessage(text: string): string {
    const match = text.match(/"body":"([^"]+)"/);
    return match ? match[1].substring(0, 50) + '...' : 'mensaje';
}

function extractDuration(details: any): string {
    if (details?.duration) {
        return Math.round(details.duration / 1000).toString();
    }
    return '?';
}

function extractResponsePreview(message: string): string {
    return message.substring(0, 50) + '...';
}

function extractFunctionName(message: string): string {
    const match = message.match(/función: (\w+)/);
    return match ? match[1] : 'unknown';
}

function extractAvailabilityOptions(details: any): string {
    if (details?.completeOptions) {
        return details.completeOptions.toString();
    }
    return '?';
}

/**
 * 🤖 PARA IAs: ESTE LOGGER
 * 
 * - Muestra SOLO información esencial en terminal
 * - Ignora logs técnicos para evitar ruido  
 * - Usa colores para mejor legibilidad
 * - Formato optimizado para humanos
 * - Se complementa con file-logger.ts para detalles técnicos
 */ 