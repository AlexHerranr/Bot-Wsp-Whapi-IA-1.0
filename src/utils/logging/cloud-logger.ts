/**
 * ☁️ CLOUD LOGGER - Tipo 3: Logs Cloud Run
 * 
 * Logs estructurados para Google Cloud Run que van a Google Cloud Console.
 * Optimizados para ser procesados por el parser de logs.
 */

import { LogLevel, LogEntry } from './types';

/**
 * 🎯 FUNCIÓN PRINCIPAL CLOUD LOG
 * 
 * Emite logs estructurados para Google Cloud Console.
 * Estos logs son procesados posteriormente por el parser en /tools/log-tools/
 */
export function cloudLog(level: LogLevel, category: string, message: string, details?: any): void {
    // Crear entrada estructurada
    const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        category,
        message,
        details,
        environment: 'production'
    };
    
    // Emitir a stdout para Google Cloud Logging
    const structuredLog = formatStructuredLogEntry(entry);
    console.log(structuredLog);
}

/**
 * 🏗️ FORMATEAR ENTRADA ESTRUCTURADA
 * 
 * Convierte LogEntry en formato JSON estructurado para Google Cloud.
 * Este formato es procesado por el parser para generar logs legibles.
 */
function formatStructuredLogEntry(entry: LogEntry): string {
    const { timestamp, level, category, message, details } = entry;
    
    // Estructura base para Google Cloud Logging
    const structuredEntry = {
        timestamp,
        severity: mapLevelToSeverity(level),
        category,
        message,
        ...(details && { details }),
        // Metadatos adicionales para Cloud Run
        labels: {
            component: 'whatsapp-bot',
            environment: 'production',
            logType: 'application'
        }
    };
    
    return JSON.stringify(structuredEntry);
}

/**
 * 🎚️ MAPEAR NIVEL A SEVERIDAD DE GOOGLE CLOUD
 */
function mapLevelToSeverity(level: LogLevel): string {
    const mapping: Record<LogLevel, string> = {
        'DEBUG': 'DEBUG',
        'INFO': 'INFO',
        'SUCCESS': 'INFO',
        'WARNING': 'WARNING',
        'ERROR': 'ERROR'
    };
    
    return mapping[level] || 'INFO';
}

/**
 * 🤖 PARA IAs: ESTE LOGGER
 * 
 * - Emite logs estructurados JSON a Google Cloud Console
 * - Los logs son procesados por /tools/log-tools/cloud-parser/
 * - Formato optimizado para análisis automático
 * - Incluye metadatos para filtrado y búsqueda
 * - Se convierte en logs legibles mediante el parser
 */ 