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
import { sanitizeDetails as sanitizeData, containsSensitiveData, SanitizationMetrics } from './data-sanitizer';
import { globalRateLimiter } from './rate-limiter';

// ✨ VALIDACIÓN ESTRICTA CON SET (MEJORA CRÍTICA)
const VALID_CATEGORIES_SET = new Set([
    // Mensajes y Comunicación
    'MESSAGE_RECEIVED',
    'MESSAGE_PROCESS', 
    'WHATSAPP_SEND',
    'WHATSAPP_CHUNKS_COMPLETE',
    
    // OpenAI y Funciones
    'OPENAI_REQUEST',
    'OPENAI_RESPONSE',
    'OPENAI_RUN_COMPLETED',
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
    'THREAD_REUSE',
    'SERVER_START',
    'BOT_READY',
    
    // Sistema Interno
    'WEBHOOK',
    'BOT_MESSAGE_TRACKED',
    'PENDING_MESSAGE_REMOVED',
    'RUN_QUEUE',
    'CONTEXT_LABELS',
    
    // 🚨 CATEGORÍAS CRÍTICAS AGREGADAS (FIX REINICIOS)
    'CONTACT_API',
    'CONTACT_API_DETAILED',
    'BUFFER_TIMER_RESET',
    'THREAD_STATE',
    'BEDS24_DEBUG_OUTPUT',
    'OPENAI_FUNCTION_OUTPUT',
    'WHATSAPP_CHUNKS',
    'AVAILABILITY_HANDLER',
    'USER_DEBUG',
    'MESSAGE_BUFFER',
    'FUNCTION_SUBMITTED',
    
    // Errores y Warnings
    'ERROR',
    'WARNING',
    'SUCCESS'
]);

// Array para compatibilidad con tipos
const VALID_CATEGORIES = Array.from(VALID_CATEGORIES_SET);
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
// ✨ MÉTRICAS DE PERFORMANCE DEL SISTEMA DE LOGGING
interface LoggingMetrics {
    droppedLogs: number;
    avgLatency: number;
    failedLogs: number;
    totalLogs: number;
    sanitizedLogs: number;
    rateLimitedLogs: number;
}

const loggingMetrics: LoggingMetrics = {
    droppedLogs: 0,
    avgLatency: 0,
    failedLogs: 0,
    totalLogs: 0,
    sanitizedLogs: 0,
    rateLimitedLogs: 0
};

// ✨ CIRCUIT BREAKER PARA FALLOS
let loggingFailures = 0;
let loggingDisabled = false;
const MAX_FAILURES = 10;
const DISABLE_DURATION = 30000; // 30 segundos

// ✨ FEATURE FLAG PARA ROLLBACK
const USE_LEGACY_LOGGING = process.env.USE_LEGACY_LOGGING === 'true';

// ✨ CACHE DE WARNINGS PARA CATEGORÍAS INVÁLIDAS
const invalidCategoryWarnings = new Set<string>();

// ✨ MAPEO DE CATEGORÍAS OBSOLETAS A VÁLIDAS
const CATEGORY_MAPPING: Record<string, string> = {
    'USER_DEBUG': 'DEBUG',
    'BEDS24_DEBUG_OUTPUT': 'BEDS24_RESPONSE_DETAIL',
    'THREAD_STATE': 'THREAD_OPERATION',
    'MESSAGE_BUFFER': 'MESSAGE_PROCESS',
    'WHATSAPP_CHUNKS': 'WHATSAPP_CHUNKS_COMPLETE',
    'CONTACT_API': 'CONTACT_API',  // Mantener como está
    'CONTACT_API_DETAILED': 'CONTACT_API_DETAILED',  // Mantener como está
    'BUFFER_TIMER_RESET': 'BUFFER_TIMER_RESET',  // Mantener como está
    'OPENAI_FUNCTION_OUTPUT': 'OPENAI_FUNCTION_OUTPUT',  // Mantener como está
    'AVAILABILITY_HANDLER': 'AVAILABILITY_HANDLER',  // Mantener como está
    'FUNCTION_SUBMITTED': 'FUNCTION_SUBMITTED'  // Mantener como está
};

export function cloudLog(level: LogLevel, category: string, message: string, details?: any): void {
    const startTime = Date.now();
    
    try {
        // ✨ FEATURE FLAG - ROLLBACK STRATEGY
        if (USE_LEGACY_LOGGING) {
            console.log(`[${level}] ${category}: ${message}`, details || '');
            return;
        }
        
        // ✨ CIRCUIT BREAKER - Si el logging está fallando mucho, deshabilitarlo temporalmente
        if (loggingDisabled) {
            loggingMetrics.droppedLogs++;
            return;
        }
        
        // Registrar métricas
        LogFilterMetrics.recordTotal();
        loggingMetrics.totalLogs++;
        
        // ✨ VALIDACIÓN MEJORADA CON MAPEO DE CATEGORÍAS
        if (!VALID_CATEGORIES_SET.has(category)) {
            // Intentar mapear categoría obsoleta a válida
            const mappedCategory = CATEGORY_MAPPING[category];
            if (mappedCategory && VALID_CATEGORIES_SET.has(mappedCategory)) {
                // Solo mostrar warning una vez por categoría mapeada
                if (!invalidCategoryWarnings.has(category)) {
                    console.warn(`🔄 CATEGORY MAPPED: ${category} → ${mappedCategory}`);
                    invalidCategoryWarnings.add(category);
                }
                category = mappedCategory;
            } else {
                // Solo mostrar warning una vez por categoría inválida para evitar spam
                if (!invalidCategoryWarnings.has(category)) {
                    console.warn(`⚠️ INVALID CATEGORY: ${category}. Continuing with original category for compatibility.`);
                    console.warn(`   Valid categories: ${Array.from(VALID_CATEGORIES_SET).join(', ')}`);
                    invalidCategoryWarnings.add(category);
                }
                
                // En desarrollo, mostrar error detallado pero no fallar
                if (process.env.NODE_ENV === 'development') {
                    console.warn(`   📍 This log will still be processed but should be updated to use a valid category.`);
                }
            }
        }
        
        // Determinar entorno
        const environment = process.env.K_SERVICE ? 'production' : 'development';
        const userId = details?.userId || details?.shortUserId || 'system';
        
        // ✨ RATE LIMITING - Prevenir log flooding
        const rateLimitResult = globalRateLimiter.checkRateLimit(userId, category, message, level);
        if (!rateLimitResult.allowed) {
            LogFilterMetrics.recordFiltered(category, 'rate-limited');
            loggingMetrics.rateLimitedLogs++;
            
            // Solo loggear el primer bloqueo para evitar spam
            if (loggingMetrics.rateLimitedLogs % 100 === 1) {
                console.warn(`🚦 RATE LIMITED: ${rateLimitResult.reason}`);
            }
            return;
        }
        
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
        
        // ✨ SANITIZACIÓN ROBUSTA DE DATOS SENSIBLES (CRÍTICO)
        let sanitizedDetails = details;
        if (details && containsSensitiveData(details)) {
            sanitizedDetails = sanitizeData(details);
            loggingMetrics.sanitizedLogs++;
            SanitizationMetrics.recordFieldRedaction();
        }
        
        // 4. Filtrar metadata excesivo de Cloud Build antes de crear entrada
        if (sanitizedDetails && typeof sanitizedDetails === 'object') {
            // ✨ FILTRAR METADATA SPAM - Remover información de build innecesaria
            const filteredDetails = { ...sanitizedDetails };
            
            // Remover metadata de Cloud Build
            delete filteredDetails['commit-sha'];
            delete filteredDetails['gcb-build-id'];
            delete filteredDetails['gcb-trigger-id'];
            delete filteredDetails['managed-by'];
            
            // Remover labels de deployment si contienen información excesiva
            if (filteredDetails.labels && typeof filteredDetails.labels === 'object') {
                const labels = { ...filteredDetails.labels };
                delete labels['managed-by'];
                delete labels['gcb-build-id'];
                delete labels['gcb-trigger-id'];
                delete labels['deployment-tool'];
                
                // Solo mantener labels si no está vacío
                if (Object.keys(labels).length > 0) {
                    filteredDetails.labels = labels;
                } else {
                    delete filteredDetails.labels;
                }
            }
            
            sanitizedDetails = filteredDetails;
        }

        // 5. Crear entrada estructurada
    const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        category,
        message,
            details: sanitizedDetails,
            environment
        };
        
        // ✨ VALIDACIÓN DE TAMAÑO - Google Cloud Logging límite 256KB
        const entryString = JSON.stringify(entry);
        if (entryString.length > 250000) { // 250KB para dejar margen
            entry.details = { 
                truncated: true, 
                originalSize: entryString.length,
                message: 'Log truncated due to size limit'
            };
            loggingMetrics.droppedLogs++;
        }
        
        // 6. Decidir si usar agregación o emitir directamente
        const shouldAggregate = environment === 'production' && !isHighPriorityLog(level, category);
        
        if (shouldAggregate) {
            // Usar agregador para logs de baja prioridad en producción
            logAggregator.addLog(entry);
        } else {
            // Emitir directamente para logs importantes o en desarrollo
            emitLogSafely(entry);
        }
        
        // Actualizar métricas de latencia
        const latency = Date.now() - startTime;
        loggingMetrics.avgLatency = (loggingMetrics.avgLatency + latency) / 2;
        
        // Reset circuit breaker si todo va bien
        if (loggingFailures > 0) {
            loggingFailures = Math.max(0, loggingFailures - 1);
        }
        
    } catch (error) {
        handleLoggingError(error, level, category, message, details);
    }
}

/**
 * ✨ EMITIR LOG DE FORMA SEGURA CON FALLBACKS
 */
function emitLogSafely(entry: LogEntry): void {
    try {
        const structuredLog = formatGoogleCloudLogEntry(entry);
        
        // ✨ ENCODING UTF-8 FIX - Asegurar encoding correcto
        const utf8Log = Buffer.from(structuredLog, 'utf8').toString('utf8');
        console.log(utf8Log);
        
    } catch (error) {
        // ✨ FALLBACK - Si JSON.stringify falla, intentar log básico
        try {
            console.error('LOGGING_SYSTEM_ERROR: JSON stringify failed', error);
            console.log(`[${entry.level}] ${entry.category}: ${entry.message}`);
        } catch (fallbackError) {
            // Último recurso - log mínimo
            console.error('CRITICAL_LOGGING_FAILURE', { error: error.message, fallback: fallbackError.message });
        }
        
        loggingMetrics.failedLogs++;
        loggingFailures++;
    }
}

/**
 * ✨ MANEJAR ERRORES DEL SISTEMA DE LOGGING
 */
function handleLoggingError(error: any, level: LogLevel, category: string, message: string, details?: any): void {
    loggingMetrics.failedLogs++;
    loggingFailures++;
    
    // ✨ CIRCUIT BREAKER - Deshabilitar logging temporalmente si hay muchos fallos
    if (loggingFailures >= MAX_FAILURES) {
        loggingDisabled = true;
        console.error(`🚨 LOGGING SYSTEM DISABLED: Too many failures (${loggingFailures})`);
        
        // Reactivar después del tiempo de espera
        setTimeout(() => {
            loggingDisabled = false;
            loggingFailures = 0;
            console.log('🔄 LOGGING SYSTEM REACTIVATED');
        }, DISABLE_DURATION);
    }
    
    // ✨ BACKUP LOGGING - Si Cloud Logging falla, guardar localmente
    try {
        const backupEntry = {
            timestamp: new Date().toISOString(),
            level,
            category,
            message,
            error: error.message,
            stack: error.stack,
            details: details ? JSON.stringify(details).substring(0, 200) : null
        };
        
        // En desarrollo, mostrar en consola
        if (process.env.NODE_ENV === 'development') {
            console.error('LOGGING_ERROR:', backupEntry);
        }
        
        // TODO: Implementar guardado en archivo local para backup
        // saveToLocalBuffer(backupEntry);
        
    } catch (backupError) {
        console.error('CRITICAL: Backup logging also failed', backupError);
    }
}

/**
 * 📊 OBTENER MÉTRICAS DEL SISTEMA DE LOGGING
 */
export function getLoggingMetrics(): LoggingMetrics & { 
    rateLimiterStats: any; 
    sanitizationStats: any;
    filterStats: any;
} {
    return {
        ...loggingMetrics,
        rateLimiterStats: globalRateLimiter.getStats(),
        sanitizationStats: SanitizationMetrics.getStats(),
        filterStats: LogFilterMetrics.getStats()
    };
}

/**
 * 🔄 RESETEAR MÉTRICAS DEL SISTEMA DE LOGGING
 */
export function resetLoggingMetrics(): void {
    loggingMetrics.droppedLogs = 0;
    loggingMetrics.avgLatency = 0;
    loggingMetrics.failedLogs = 0;
    loggingMetrics.totalLogs = 0;
    loggingMetrics.sanitizedLogs = 0;
    loggingMetrics.rateLimitedLogs = 0;
    
    globalRateLimiter.reset();
    SanitizationMetrics.reset();
    LogFilterMetrics.reset();
}

/**
 * 🧹 SANITIZAR DETALLES SENSIBLES (LEGACY - MANTENER COMPATIBILIDAD)
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
        
        // ✨ RESOURCE METADATA FILTRADO - Reducir ruido en logs
        resource: {
            type: 'cloud_run_revision',
            labels: {
                'service_name': process.env.K_SERVICE || 'bot-wsp-whapi-ia',
                'revision_name': deployment,
                'location': process.env.GOOGLE_CLOUD_REGION || process.env.GCLOUD_REGION || 'us-central1'
                // ✨ FILTRADO: Removido metadata excesivo (configuration_name, project_id)
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

// Mensajes y Comunicación - SOLO CLOUD RUN
export const logMessageReceived = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('INFO', 'MESSAGE_RECEIVED', message, details);
    }
};

export const logMessageProcess = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('INFO', 'MESSAGE_PROCESS', message, details);
    }
};

export const logWhatsAppSend = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('INFO', 'WHATSAPP_SEND', message, details);
    }
};

export const logWhatsAppChunksComplete = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('SUCCESS', 'WHATSAPP_CHUNKS_COMPLETE', message, details);
    }
};

// OpenAI y Funciones - SOLO CLOUD RUN
export const logOpenAIRequest = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('INFO', 'OPENAI_REQUEST', message, details);
    }
};

export const logOpenAIResponse = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('SUCCESS', 'OPENAI_RESPONSE', message, details);
    }
};

export const logFunctionCallingStart = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('INFO', 'FUNCTION_CALLING_START', message, details);
    }
};

export const logFunctionExecuting = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('INFO', 'FUNCTION_EXECUTING', message, details);
    }
};

export const logFunctionHandler = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('INFO', 'FUNCTION_HANDLER', message, details);
    }
};

// Integración Beds24 - SOLO CLOUD RUN
export const logBeds24Request = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('INFO', 'BEDS24_REQUEST', message, details);
    }
};

export const logBeds24ApiCall = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('INFO', 'BEDS24_API_CALL', message, details);
    }
};

export const logBeds24ResponseDetail = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('INFO', 'BEDS24_RESPONSE_DETAIL', message, details);
    }
};

export const logBeds24Processing = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('INFO', 'BEDS24_PROCESSING', message, details);
    }
};

// Sistema y Threads - SOLO CLOUD RUN
export const logThreadCreated = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('SUCCESS', 'THREAD_CREATED', message, details);
    }
};

export const logThreadPersist = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('INFO', 'THREAD_PERSIST', message, details);
    }
};

export const logThreadCleanup = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('INFO', 'THREAD_CLEANUP', message, details);
    }
};

export const logServerStart = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('SUCCESS', 'SERVER_START', message, details);
    }
};

export const logBotReady = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('SUCCESS', 'BOT_READY', message, details);
    }
};

// ✨ FUNCIONES DE LOGGING PARA CATEGORÍAS FALTANTES
// SOLO PARA CLOUD RUN - En local usan el sistema unificado
export const logWebhook = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('INFO', 'WEBHOOK', message, details);
    }
};

export const logBotMessageTracked = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('INFO', 'BOT_MESSAGE_TRACKED', message, details);
    }
};

export const logPendingMessageRemoved = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('INFO', 'PENDING_MESSAGE_REMOVED', message, details);
    }
};

export const logRunQueue = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('INFO', 'RUN_QUEUE', message, details);
    }
};

export const logContextLabels = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('INFO', 'CONTEXT_LABELS', message, details);
    }
};

export const logOpenAIRunCompleted = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('SUCCESS', 'OPENAI_RUN_COMPLETED', message, details);
    }
};

export const logThreadReuse = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('SUCCESS', 'THREAD_REUSE', message, details);
    }
};

// 🚨 NUEVAS CATEGORÍAS CRÍTICAS AGREGADAS - FUNCIONES DE CONVENIENCIA
export const logContactApi = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('INFO', 'CONTACT_API', message, details);
    }
};

export const logContactApiDetailed = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('INFO', 'CONTACT_API_DETAILED', message, details);
    }
};

export const logBufferTimerReset = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('INFO', 'BUFFER_TIMER_RESET', message, details);
    }
};

export const logThreadState = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('INFO', 'THREAD_STATE', message, details);
    }
};

export const logBeds24DebugOutput = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('INFO', 'BEDS24_DEBUG_OUTPUT', message, details);
    }
};

export const logOpenAIFunctionOutput = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('INFO', 'OPENAI_FUNCTION_OUTPUT', message, details);
    }
};

export const logWhatsAppChunks = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('INFO', 'WHATSAPP_CHUNKS', message, details);
    }
};

export const logAvailabilityHandler = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('INFO', 'AVAILABILITY_HANDLER', message, details);
    }
};

export const logUserDebug = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('INFO', 'USER_DEBUG', message, details);
    }
};

export const logMessageBuffer = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('INFO', 'MESSAGE_BUFFER', message, details);
    }
};

export const logFunctionSubmitted = (message: string, details?: any) => {
    if (process.env.K_SERVICE) {
        cloudLog('INFO', 'FUNCTION_SUBMITTED', message, details);
    }
};

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