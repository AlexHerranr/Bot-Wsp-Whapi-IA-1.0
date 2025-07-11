/**
 * 📁 FILE LOGGER - Tipo 2: Logs Detallados Locales
 * 
 * Logs técnicos completos guardados en archivos para desarrollo local.
 * Incluye toda la información técnica necesaria para debugging.
 */

import fs from 'fs';
import path from 'path';
import { LogLevel, LogEntry, SessionMetadata } from './types';
import { formatTechnicalLogEntry } from './formatters';

// === CONFIGURACIÓN ===
const LOG_DIR = 'logs/local-development/sessions';
const MAX_SESSIONS = 5;
const BUFFER_FLUSH_INTERVAL = 100; // ms
const MAX_BUFFER_SIZE = 50;

// === ESTADO GLOBAL ===
let logBuffer: string[] = [];
let flushTimer: NodeJS.Timeout | null = null;
let sessionInitialized = false;
let currentSessionId: string;
let currentLogFile: string;

/**
 * 🎯 FUNCIÓN PRINCIPAL FILE LOG
 * 
 * Guarda logs técnicos completos en archivos locales.
 * Incluye TODA la información para debugging detallado.
 */
export function fileLog(level: LogLevel, category: string, message: string, details?: any): void {
    // Asegurar que la sesión esté inicializada
    if (!sessionInitialized) {
        initializeSession();
    }
    
    // Crear entrada de log completa
    const entry: LogEntry = {
        timestamp: getISOTimestamp(),
        level,
        category,
        message,
        details,
        source: getCallerInfo(),
        sessionId: currentSessionId,
        environment: 'development'
    };
    
    // Formatear usando formato técnico unificado (igual que Cloud)
    const formattedEntry = formatTechnicalLogEntry(entry);
    
    // Agregar al buffer
    addToBuffer(formattedEntry);
}

/**
 * 🏗️ INICIALIZAR SESIÓN DE LOGGING
 * 
 * Crea nueva sesión con archivo único y limpia sesiones antiguas.
 */
function initializeSession(): void {
    if (sessionInitialized) return;
    
    // Generar ID de sesión único
    currentSessionId = `session-${getTimestamp()}`;
    currentLogFile = path.join(LOG_DIR, `bot-${currentSessionId}.log`);
    
    // Asegurar que existe el directorio
    ensureLogDirectory();
    
    // Limpiar sesiones antiguas
    cleanupOldSessions();
    
    // Escribir header de sesión
    const sessionHeader = createSessionHeader();
    
    try {
        fs.writeFileSync(currentLogFile, sessionHeader);
        console.log(`📁 Logs detallados: ${currentLogFile}`);
        console.log(`🔄 Manteniendo máximo ${MAX_SESSIONS} sesiones`);
    } catch (error) {
        console.error('Error inicializando sesión de logs:', error);
    }
    
    sessionInitialized = true;
}

/**
 * 📝 FORMATEAR ENTRADA DE LOG DETALLADA - DEPRECATED
 * 
 * NOTA: Esta función ha sido reemplazada por formatTechnicalLogEntry()
 * del archivo formatters.ts para unificar el formato entre File y Cloud logs.
 * 
 * OBJETIVO: File Logs = Cloud Logs (formato técnico idéntico)
 */
// function formatDetailedLogEntry() - REMOVIDO
// Ahora usa formatTechnicalLogEntry() de formatters.ts

/**
 * 📋 CREAR HEADER DE SESIÓN
 * 
 * Información inicial de la sesión para contexto.
 */
function createSessionHeader(): string {
    const timestamp = getTimestamp().replace(/-/g, ':').replace('T', ' ');
    
    return `
=== NUEVA SESIÓN DEL BOT ===
Timestamp: ${timestamp} (Colombia UTC-5)
Session ID: ${currentSessionId}
PID: ${process.pid}
Node Version: ${process.version}
Log Type: Desarrollo Local Detallado
=============================

`;
}

/**
 * 📂 ASEGURAR DIRECTORIO DE LOGS
 */
function ensureLogDirectory(): void {
    if (!fs.existsSync(LOG_DIR)) {
        try {
            fs.mkdirSync(LOG_DIR, { recursive: true });
        } catch (error) {
            console.error(`Error creando directorio de logs: ${error}`);
        }
    }
}

/**
 * 🧹 LIMPIAR SESIONES ANTIGUAS
 * 
 * Mantiene solo las últimas MAX_SESSIONS sesiones.
 */
function cleanupOldSessions(): void {
    try {
        if (!fs.existsSync(LOG_DIR)) return;
        
        const files = fs.readdirSync(LOG_DIR)
            .filter(file => file.startsWith('bot-session-') && file.endsWith('.log'))
            .map(file => ({
                name: file,
                path: path.join(LOG_DIR, file),
                time: fs.statSync(path.join(LOG_DIR, file)).mtime
            }))
            .sort((a, b) => b.time.getTime() - a.time.getTime());
        
        // Eliminar archivos antiguos
        if (files.length >= MAX_SESSIONS) {
            const filesToDelete = files.slice(MAX_SESSIONS - 1);
            filesToDelete.forEach(file => {
                try {
                    fs.unlinkSync(file.path);
                } catch (error) {
                    console.error(`Error eliminando archivo de log: ${error}`);
                }
            });
        }
    } catch (error) {
        console.error('Error limpiando sesiones antiguas:', error);
    }
}

/**
 * 📝 AGREGAR AL BUFFER
 */
function addToBuffer(entry: string): void {
    logBuffer.push(entry);
    
    // Flush si el buffer está lleno
    if (logBuffer.length >= MAX_BUFFER_SIZE) {
        flushBuffer();
        return;
    }
    
    // Programar flush si no hay timer activo
    if (!flushTimer) {
        flushTimer = setTimeout(flushBuffer, BUFFER_FLUSH_INTERVAL);
    }
}

/**
 * 💾 FLUSH BUFFER A ARCHIVO
 */
function flushBuffer(): void {
    if (logBuffer.length === 0) return;
    
    const entries = [...logBuffer];
    logBuffer = [];
    
    try {
        const content = entries.join('\n') + '\n';
        fs.appendFileSync(currentLogFile, content, 'utf8');
    } catch (error) {
        console.error(`Error escribiendo logs: ${error}`);
    }
    
    // Limpiar timer
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }
}

/**
 * ⏰ OBTENER TIMESTAMP ISO
 */
function getISOTimestamp(): string {
    return new Date().toISOString();
}

/**
 * ⏰ OBTENER TIMESTAMP PARA ARCHIVOS
 */
function getTimestamp(): string {
    const now = new Date();
    const offset = -5 * 60; // Colombia UTC-5
    const colombiaTime = new Date(now.getTime() + offset * 60 * 1000);
    return colombiaTime.toISOString().slice(0, 19).replace(':', '-').replace(':', '-');
}

/**
 * 📍 OBTENER INFORMACIÓN DEL CALLER
 */
function getCallerInfo(): string {
    try {
        const stack = new Error().stack;
        if (!stack) return 'unknown.ts';
        
        const lines = stack.split('\n');
        for (let i = 3; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('.ts:') || line.includes('.js:')) {
                const match = line.match(/([^\/\\]+\.(ts|js)):/);
                return match ? match[1] : 'unknown.ts';
            }
        }
        return 'unknown.ts';
    } catch {
        return 'unknown.ts';
    }
}

/**
 * 📊 OBTENER METADATOS DE SESIÓN
 */
export function getSessionMetadata(): SessionMetadata {
    return {
        sessionId: currentSessionId,
        startTime: getISOTimestamp(),
        totalLogs: logBuffer.length,
        errorCount: 0, // TODO: implementar contador
        warningCount: 0 // TODO: implementar contador
    };
}

/**
 * 🔚 FINALIZAR SESIÓN
 */
export function finalizeSession(): void {
    if (logBuffer.length > 0) {
        flushBuffer();
    }
    
    // Escribir footer de sesión
    const footer = `\n=== FIN DE SESIÓN ===\nTimestamp: ${getISOTimestamp()}\n`;
    
    try {
        fs.appendFileSync(currentLogFile, footer, 'utf8');
    } catch (error) {
        console.error('Error finalizando sesión:', error);
    }
}

/**
 * 🤖 PARA IAs: ESTE LOGGER - ACTUALIZADO V2.0
 * 
 * - Guarda TODOS los logs técnicos en archivos locales
 * - Formato JSON estructurado: IDÉNTICO a Cloud Logs para análisis consistente
 * - Sesiones individuales con limpieza automática
 * - Buffer optimizado para rendimiento
 * - Información completa para debugging
 * - Se complementa con console-logger.ts para terminal limpio
 * 
 * CAMBIO CLAVE: Ahora usa formatTechnicalLogEntry() de formatters.ts
 * OBJETIVO: File Logs = Cloud Logs (formato técnico idéntico)
 * FORMATO: JSON idéntico a Cloud para análisis consistente
 */ 