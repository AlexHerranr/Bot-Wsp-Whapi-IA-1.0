/**
 * ☁️ CLOUD LOGGER - Tipo 3: Logs Cloud Run
 * 
 * Logs estructurados para Google Cloud Run que van a Google Cloud Console.
 * Optimizados para ser procesados por el parser de logs.
 * 
 * ACTUALIZADO: Implementa TODAS las categorías del README
 */

import { LogLevel, LogEntry } from './types';
import { shouldLog, applyContextualFilters, checkUserSpecificFilters, LogFilterMetrics } from './log-filters';
import { LogAggregator } from './log-aggregator';

// Mapeo de categorías válidas según README
const VALID_CATEGORIES = [
    // Mensajes y Comunicación
    'MESSAGE_RECEIVED',
    'MESSAGE_PROCESS', 
    'WHATSAPP_SEND',
    'WHATSAPP_CHUNKS_COMPLETE',
    
    // OpenAI y Funciones
    'OPENAI_REQUEST',
    'OPENAI_RESPONSE',
    'FUNCTION_CALLING_START',
    'FUNCTION_EXECUTING',
    'FUNCTION_HANDLER',
    
    // Integración Beds24
    'BEDS24_REQUEST',
    'BEDS24_API_CALL',
    'BEDS24_RESPONSE_DETAIL',
    'BEDS24_PROCESSING',
    
    // Sistema y Threads
    'THREAD_CREATED',
    'THREAD_PERSIST',
    'THREAD_CLEANUP',
    'SERVER_START',
    'BOT_READY',
    
    // Errores y Warnings
    'ERROR',
    'WARNING',
    'SUCCESS'
] as const;

type ValidCategory = typeof VALID_CATEGORIES[number];

// ✨ INSTANCIA GLOBAL DEL AGREGADOR
const logAggregator = new LogAggregator((logString: string) => {
    console.log(logString);
});

// Configurar limpieza al cerrar la aplicación
process.on('SIGINT', () => {
    logAggregator.forceFlush();
    process.exit(0);
});

process.on('SIGTERM', () => {
    logAggregator.forceFlush();
    process.exit(0);
});

/**
 * 🎯 FUNCIÓN PRINCIPAL CLOUD LOG - MEJORADA
 * 
 * Emite logs estructurados para Google Cloud Console con formato JSON optimizado.
 * Implementa TODAS las categorías especificadas en el README.
 */
export function cloudLog(level: LogLevel, category: string, message: string, details?: any): void {
    // Registrar métricas
    LogFilterMetrics.recordTotal();
    
    // Validar categoría
    if (!VALID_CATEGORIES.includes(category as ValidCategory)) {
        console.warn(`⚠️ Categoría de log no válida: ${category}. Usando 'OTHER'`);
        category = 'OTHER';
    }
    
    // Determinar entorno
    const environment = process.env.K_SERVICE ? 'production' : 'development';
    const userId = details?.userId || details?.shortUserId || 'system';
    
    // ✨ APLICAR FILTROS INTELIGENTES
    
    // 1. Filtro principal por nivel y categoría
    if (!shouldLog(level, category, environment)) {
        LogFilterMetrics.recordFiltered(category, 'level-filter');
        return;
    }
    
    // 2. Filtros contextuales
    if (!applyContextualFilters(level, category, details, environment)) {
        LogFilterMetrics.recordFiltered(category, 'contextual-filter');
        return;
    }
    
    // 3. Filtros específicos por usuario
    if (!checkUserSpecificFilters(userId, level, category)) {
        LogFilterMetrics.recordFiltered(category, 'user-filter');
        return;
    }
    
    // 4. Crear entrada estructurada
    const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        category,
        message,
        details: sanitizeDetails(details),
        environment
    };
    
    // 5. Decidir si usar agregación o emitir directamente
    const shouldAggregate = environment === 'production' && !isHighPriorityLog(level, category);
    
    if (shouldAggregate) {
        // Usar agregador para logs de baja prioridad en producción
        logAggregator.addLog(entry);
    } else {
        // Emitir directamente para logs importantes o en desarrollo
        const structuredLog = formatGoogleCloudLogEntry(entry);
        console.log(structuredLog);
    }
}

/**
 * 🧹 SANITIZAR DETALLES SENSIBLES
 * 
 * Limpia información sensible de los detalles antes de enviar a logs.
 */
function sanitizeDetails(details: any): any {
    if (!details) return {};
    
    const sanitized = { ...details };
    
    // Remover o truncar campos sensibles
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'auth'];
    sensitiveFields.forEach(field => {
        if (sanitized[field]) {
            sanitized[field] = '[REDACTED]';
        }
    });
    
    // Truncar mensajes muy largos
    if (sanitized.body && typeof sanitized.body === 'string' && sanitized.body.length > 500) {
        sanitized.body = sanitized.body.substring(0, 500) + '... [TRUNCATED]';
    }
    
    // Asegurar que userId esté presente si es posible
    if (sanitized.userJid && !sanitized.userId) {
        sanitized.userId = sanitized.userJid.split('@')[0];
    }
    
    return sanitized;
}

/**
 * 🏗️ FORMATEAR ENTRADA PARA GOOGLE CLOUD LOGGING - OPTIMIZADO
 * 
 * Convierte LogEntry en formato JSON estructurado optimizado para Google Cloud.
 * MEJORAS: Labels mejorados, jsonPayload estructurado, resource metadata completo.
 */
function formatGoogleCloudLogEntry(entry: LogEntry): string {
    const { timestamp, level, category, message, details } = entry;
    
    // Extraer información contextual
    const userId = details?.userId || details?.shortUserId || 'system';
    const environment = entry.environment || (process.env.K_SERVICE ? 'production' : 'development');
    const deployment = process.env.K_REVISION || 'local';
    
    // Estructura OPTIMIZADA para Google Cloud Logging
    const structuredEntry = {
        timestamp,
        severity: mapLevelToGoogleSeverity(level),
        message: `[${category}] ${message}`,
        
        // ✨ JSONPAYLOAD MEJORADO - Información estructurada para análisis
        jsonPayload: {
            // Información básica
            category,
            level,
            userId,
            environment,
            deployment,
            
            // Información contextual
            sessionId: details?.sessionId || generateSessionId(),
            source: details?.source || 'app-unified',
            
            // Métricas de rendimiento si están disponibles
            ...(details?.duration && { duration: details.duration }),
            ...(details?.responseTime && { responseTime: details.responseTime }),
            
            // Información específica por categoría
            ...(category.startsWith('MESSAGE_') && {
                messageInfo: {
                    messageType: details?.messageType || details?.type,
                    messageLength: details?.messageLength || details?.body?.length,
                    chatId: details?.chatId,
                    chunks: details?.chunks || 1
                }
            }),
            
            ...(category.startsWith('OPENAI_') && {
                openaiInfo: {
                    threadId: details?.threadId,
                    runId: details?.runId,
                    state: details?.state,
                    functionName: details?.functionName
                }
            }),
            
            ...(category.startsWith('BEDS24_') && {
                beds24Info: {
                    requestType: details?.requestType,
                    startDate: details?.startDate,
                    endDate: details?.endDate,
                    propertyId: details?.propertyId,
                    endpoint: details?.endpoint,
                    method: details?.method
                }
            }),
            
            ...(category.startsWith('THREAD_') && {
                threadInfo: {
                    threadId: details?.threadId,
                    operation: details?.operation,
                    userName: details?.userName
                }
            }),
            
            // Detalles completos (sanitizados)
            details: details || {}
        },
        
        // ✨ LABELS MEJORADOS - Para filtrado avanzado en Cloud Console
        labels: {
            // Labels básicos
            'app': 'whatsapp-bot',
            'category': category,
            'level': level,
            'environment': environment,
            'deployment': deployment,
            
            // Labels contextuales
            'userId': userId,
            'component': getCategoryComponent(category),
            
            // Labels específicos por categoría
            ...(category.startsWith('MESSAGE_') && { 'messageFlow': 'true' }),
            ...(category.startsWith('OPENAI_') && { 'aiProcessing': 'true' }),
            ...(category.startsWith('BEDS24_') && { 'beds24Integration': 'true' }),
            ...(category.startsWith('THREAD_') && { 'threadManagement': 'true' }),
            ...(category.startsWith('WHATSAPP_') && { 'whatsappAPI': 'true' }),
            ...(category.startsWith('FUNCTION_') && { 'functionCalling': 'true' }),
            
            // Labels de error si aplica
            ...(level === 'ERROR' && { 'hasError': 'true' }),
            ...(details?.error && { 'errorType': getErrorType(details.error) })
        },
        
        // ✨ RESOURCE METADATA COMPLETO - Para Cloud Run
        resource: {
            type: 'cloud_run_revision',
            labels: {
                'service_name': process.env.K_SERVICE || 'bot-wsp-whapi-ia',
                'revision_name': deployment,
                'location': process.env.GOOGLE_CLOUD_REGION || process.env.GCLOUD_REGION || 'us-central1',
                'configuration_name': process.env.K_CONFIGURATION || 'bot-wsp-whapi-ia',
                'project_id': process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'unknown'
            }
        },
        
        // ✨ METADATOS ADICIONALES - Para análisis avanzado
        sourceLocation: details?.sourceLocation && {
            file: details.sourceLocation.file,
            line: details.sourceLocation.line,
            function: details.sourceLocation.function
        },
        
        // Información de request HTTP si está disponible
        httpRequest: details?.httpRequest && {
            requestMethod: details.httpRequest.method,
            requestUrl: details.httpRequest.url,
            status: details.httpRequest.status,
            userAgent: details.httpRequest.userAgent
        }
    };
    
    // Limpiar campos undefined/null para reducir tamaño
    return JSON.stringify(structuredEntry, (key, value) => {
        return value === undefined || value === null ? undefined : value;
    });
}

/**
 * 🏷️ OBTENER COMPONENTE POR CATEGORÍA
 */
function getCategoryComponent(category: string): string {
    if (category.startsWith('MESSAGE_')) return 'messaging';
    if (category.startsWith('OPENAI_')) return 'ai-processing';
    if (category.startsWith('BEDS24_')) return 'beds24-integration';
    if (category.startsWith('THREAD_')) return 'thread-management';
    if (category.startsWith('WHATSAPP_')) return 'whatsapp-api';
    if (category.startsWith('FUNCTION_')) return 'function-calling';
    if (category.startsWith('SERVER_') || category.startsWith('BOT_')) return 'system';
    return 'other';
}

/**
 * 🚨 OBTENER TIPO DE ERROR
 */
function getErrorType(error: any): string {
    if (typeof error === 'string') {
        if (error.includes('timeout')) return 'timeout';
        if (error.includes('rate limit')) return 'rate-limit';
        if (error.includes('network')) return 'network';
        if (error.includes('auth')) return 'authentication';
        return 'application';
    }
    if (error?.code) return error.code;
    if (error?.type) return error.type;
    return 'unknown';
}

/**
 * ⚡ VERIFICAR SI ES LOG DE ALTA PRIORIDAD
 * 
 * Logs que siempre deben emitirse directamente sin agregación.
 */
function isHighPriorityLog(level: LogLevel, category: string): boolean {
    // Siempre emitir errores y warnings directamente
    if (level === 'ERROR' || level === 'WARNING') {
        return true;
    }
    
    // Categorías críticas que no deben agregarse
    const criticalCategories = [
        'SERVER_START',
        'BOT_READY',
        'THREAD_CREATED',
        'THREAD_CLEANUP',
        'FUNCTION_CALLING_START'
    ];
    
    return criticalCategories.includes(category);
}

/**
 * 🎚️ MAPEAR NIVEL A SEVERIDAD DE GOOGLE CLOUD
 */
function mapLevelToGoogleSeverity(level: LogLevel): string {
    const mapping: Record<LogLevel, string> = {
        'DEBUG': 'DEBUG',
        'INFO': 'INFO', 
        'SUCCESS': 'INFO',  // SUCCESS se mapea a INFO con categoría específica
        'WARNING': 'WARNING',
        'ERROR': 'ERROR'
    };
    
    return mapping[level] || 'INFO';
}

/**
 * 🆔 GENERAR SESSION ID SIMPLE
 * 
 * Genera un ID de sesión simple para tracking.
 */
function generateSessionId(): string {
    return `session-${Date.now()}`;
}

/**
 * 🚀 FUNCIONES DE CONVENIENCIA PARA CATEGORÍAS ESPECÍFICAS
 * 
 * Funciones helper para las categorías más comunes del README.
 */

// Mensajes y Comunicación
export const logMessageReceived = (message: string, details?: any) => 
    cloudLog('INFO', 'MESSAGE_RECEIVED', message, details);

export const logMessageProcess = (message: string, details?: any) => 
    cloudLog('INFO', 'MESSAGE_PROCESS', message, details);

export const logWhatsAppSend = (message: string, details?: any) => 
    cloudLog('INFO', 'WHATSAPP_SEND', message, details);

export const logWhatsAppChunksComplete = (message: string, details?: any) => 
    cloudLog('SUCCESS', 'WHATSAPP_CHUNKS_COMPLETE', message, details);

// OpenAI y Funciones  
export const logOpenAIRequest = (message: string, details?: any) => 
    cloudLog('INFO', 'OPENAI_REQUEST', message, details);

export const logOpenAIResponse = (message: string, details?: any) => 
    cloudLog('SUCCESS', 'OPENAI_RESPONSE', message, details);

export const logFunctionCallingStart = (message: string, details?: any) => 
    cloudLog('INFO', 'FUNCTION_CALLING_START', message, details);

export const logFunctionExecuting = (message: string, details?: any) => 
    cloudLog('INFO', 'FUNCTION_EXECUTING', message, details);

export const logFunctionHandler = (message: string, details?: any) => 
    cloudLog('INFO', 'FUNCTION_HANDLER', message, details);

// Integración Beds24
export const logBeds24Request = (message: string, details?: any) => 
    cloudLog('INFO', 'BEDS24_REQUEST', message, details);

export const logBeds24ApiCall = (message: string, details?: any) => 
    cloudLog('INFO', 'BEDS24_API_CALL', message, details);

export const logBeds24ResponseDetail = (message: string, details?: any) => 
    cloudLog('INFO', 'BEDS24_RESPONSE_DETAIL', message, details);

export const logBeds24Processing = (message: string, details?: any) => 
    cloudLog('INFO', 'BEDS24_PROCESSING', message, details);

// Sistema y Threads
export const logThreadCreated = (message: string, details?: any) => 
    cloudLog('SUCCESS', 'THREAD_CREATED', message, details);

export const logThreadPersist = (message: string, details?: any) => 
    cloudLog('INFO', 'THREAD_PERSIST', message, details);

export const logThreadCleanup = (message: string, details?: any) => 
    cloudLog('INFO', 'THREAD_CLEANUP', message, details);

export const logServerStart = (message: string, details?: any) => 
    cloudLog('SUCCESS', 'SERVER_START', message, details);

export const logBotReady = (message: string, details?: any) => 
    cloudLog('SUCCESS', 'BOT_READY', message, details);

/**
 * 🤖 PARA IAs: ESTE LOGGER MEJORADO
 * 
 * - Implementa TODAS las categorías del README
 * - Formato JSON estructurado para Google Cloud Logging
 * - Sanitización automática de datos sensibles
 * - Funciones de conveniencia para cada categoría
 * - Labels y metadatos para filtrado avanzado
 * - Compatible con el parser de logs existente
 * - Optimizado para análisis automático
 */ 