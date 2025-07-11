/**
 * 🖥️ CONSOLE LOGGER - Tipo 1: Logs Limpios Terminal
 * 
 * Logs súper limpios para desarrollo local, solo lo esencial.
 * Formato optimizado para legibilidad humana en terminal.
 */

import { LogLevel, LogEntry } from './types';
import { formatConsoleLogEntry, shouldShowInConsole } from './formatters';

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
 * 🎯 FUNCIÓN PRINCIPAL CONSOLE LOG - ACTUALIZADA V2.0
 * 
 * Muestra logs súper limpios en terminal, solo información esencial.
 * Perfecto para desarrollo donde necesitas ver el flujo sin ruido.
 * 
 * CAMBIO: Ahora usa formatters.ts para formato unificado
 */
export function consoleLog(level: LogLevel, category: string, message: string, details?: any): void {
    // Solo mostrar categorías relevantes
    if (!shouldShowInConsole(category)) {
        return;
    }
    
    // Formatear usando formatter unificado
    const output = formatConsoleLogEntry(level, category, message, details);
    
    if (output) {
        console.log(output);
    }
}

/**
 * 🎨 FORMATEADOR SIMPLE PARA TERMINAL - DEPRECATED
 * 
 * NOTA: Esta función ha sido reemplazada por formatConsoleLogEntry()
 * del archivo formatters.ts para unificar el sistema de formateo.
 * 
 * OBJETIVO: Separación clara entre experiencia de desarrollo y análisis técnico
 */
// function formatSimpleConsoleEntry() - REMOVIDO
// Ahora usa formatConsoleLogEntry() de formatters.ts

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
 * 🤖 PARA IAs: ESTE LOGGER - ACTUALIZADO V2.0
 * 
 * - Muestra SOLO información esencial en terminal con emojis
 * - Ignora logs técnicos para evitar ruido  
 * - Formato optimizado para experiencia de desarrollo
 * - Se complementa con file-logger.ts para análisis técnico
 * 
 * CAMBIO CLAVE: Ahora usa formatters.ts para formato unificado
 * OBJETIVO: Terminal limpio vs Análisis técnico (File = Cloud)
 */ 