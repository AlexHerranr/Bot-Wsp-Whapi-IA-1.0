/**
 * 🤖 TIPOS TYPESCRIPT - Sistema de Logging
 * 
 * Definiciones claras para que las IAs entiendan las estructuras de datos
 */

// === TIPOS BÁSICOS ===
export type LogLevel = 'DEBUG' | 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
export type LogFormat = 'simple' | 'detailed' | 'structured';
export type Environment = 'development' | 'production' | 'test';

// === CONFIGURACIÓN DE CADA TIPO DE LOG ===

/**
 * 🖥️ CONFIGURACIÓN CONSOLE LOGS (Tipo 1)
 * Para logs limpios en terminal durante desarrollo
 */
export interface ConsoleLogConfig {
    enabled: boolean;
    level: LogLevel;
    colors: boolean;
    format: 'simple';  // Solo formato simple para terminal
}

/**
 * 📁 CONFIGURACIÓN FILE LOGS (Tipo 2) 
 * Para logs detallados en archivos locales
 */
export interface FileLogConfig {
    enabled: boolean;
    level: LogLevel;
    directory: string;
    maxSessions: number;
    format: 'detailed' | 'structured';  // ACTUALIZADO: Soporta formato JSON idéntico a Cloud
}

/**
 * ☁️ CONFIGURACIÓN CLOUD LOGS (Tipo 3)
 * Para logs estructurados en Google Cloud Run
 */
export interface CloudLogConfig {
    enabled: boolean;
    level: LogLevel;
    format: 'structured';  // Para Google Cloud Console
    includeMetadata: boolean;
}

// === CONFIGURACIÓN PRINCIPAL ===

/**
 * 🎯 CONFIGURACIÓN COMPLETA DEL SISTEMA
 * Une todos los tipos de logging en una sola estructura
 */
export interface LogConfig {
    environment: Environment;
    isCloudRun: boolean;
    console: ConsoleLogConfig;
    file: FileLogConfig;
    cloud: CloudLogConfig;
}

// === ESTRUCTURA DE ENTRADA DE LOG ===

/**
 * 📝 ENTRADA DE LOG INDIVIDUAL
 * Estructura estándar para cualquier log del sistema
 */
export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    category: string;
    message: string;
    details?: any;
    source?: string;
    sessionId?: string;
    userId?: string;
    environment?: Environment;
}

// === METADATOS ADICIONALES ===

/**
 * 🏷️ METADATOS DE SESIÓN
 * Información adicional para tracking de sesiones
 */
export interface SessionMetadata {
    sessionId: string;
    startTime: string;
    endTime?: string;
    userId?: string;
    totalLogs: number;
    errorCount: number;
    warningCount: number;
}

/**
 * 📊 ESTADÍSTICAS DE LOGGING
 * Para análisis y monitoreo del sistema
 */
export interface LoggingStats {
    totalLogs: number;
    logsByLevel: Record<LogLevel, number>;
    logsByCategory: Record<string, number>;
    sessionsActive: number;
    lastActivity: string;
}

// === TIPOS PARA HERRAMIENTAS ===

/**
 * 🔧 CONFIGURACIÓN DEL PARSER DE CLOUD RUN
 * Para las herramientas de análisis de logs
 */
export interface CloudParserConfig {
    maxSessions: number;
    outputDirectory: string;
    filterHttpMetadata: boolean;
    includeAdvancedMetrics: boolean;
    sessionTimeoutMinutes: number;
}

/**
 * 🤖 PARA IAs: GUÍA DE TIPOS
 * 
 * - LogEntry: Estructura básica de cualquier log
 * - LogConfig: Configuración completa del sistema  
 * - SessionMetadata: Información de sesiones de usuario
 * - LoggingStats: Estadísticas para monitoreo
 * - CloudParserConfig: Configuración de herramientas
 */ 