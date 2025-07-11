/**
 * ☁️ CLOUD LOGGER - Tipo 3: Logs Cloud Run
 * 
 * Logs estructurados para Google Cloud Run que van a Google Cloud Console.
 * Optimizados para ser procesados por el parser de logs.
 * 
 * ACTUALIZADO: Implementa sistema de normalización de categorías
 */

import { LogLevel, LogEntry } from './types';
import { shouldLog, applyContextualFilters, checkUserSpecificFilters, LogFilterMetrics } from './log-filters';
import { LogAggregator } from './log-aggregator';
import { sanitizeDetails as sanitizeData, containsSensitiveData, SanitizationMetrics } from './data-sanitizer';
import { globalRateLimiter } from './rate-limiter';
import { 
    normalizeCategory, 
    validateAndWarnCategory, 
    VALID_CATEGORIES_SET,
    getCategoryMappingStats 
} from './category-mapper';

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

// ✨ MÉTRICAS DE PERFORMANCE DEL SISTEMA DE LOGGING
interface LoggingMetrics {
    droppedLogs: number;
    avgLatency: number;
    failedLogs: number;
    totalLogs: number;
    sanitizedLogs: number;
    rateLimitedLogs: number;
    categoriesNormalized: number;
}

const loggingMetrics: LoggingMetrics = {
    droppedLogs: 0,
    avgLatency: 0,
    failedLogs: 0,
    totalLogs: 0,
    sanitizedLogs: 0,
    rateLimitedLogs: 0,
    categoriesNormalized: 0
};

// ✨ CIRCUIT BREAKER PARA FALLOS
let loggingFailures = 0;
let loggingDisabled = false;
const MAX_FAILURES = 10;
const DISABLE_DURATION = 30000; // 30 segundos

// ✨ FEATURE FLAG PARA ROLLBACK
const USE_LEGACY_LOGGING = process.env.USE_LEGACY_LOGGING === 'true';

/**
 * 🎯 FUNCIÓN PRINCIPAL CLOUD LOG - MEJORADA CON NORMALIZACIÓN
 * 
 * Emite logs estructurados para Google Cloud Console con formato JSON optimizado.
 * Implementa normalización automática de categorías.
 */
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
        
        // ✨ NORMALIZACIÓN DE CATEGORÍAS - NUEVA FUNCIONALIDAD
        const originalCategory = category;
        const normalizedCategory = normalizeCategory(category);
        
        // Validar y mostrar warning si es necesario (solo una vez por categoría)
        validateAndWarnCategory(originalCategory, normalizedCategory);
        
        // Actualizar métricas si se normalizó
        if (originalCategory !== normalizedCategory) {
            loggingMetrics.categoriesNormalized++;
        }
        
        // Usar categoría normalizada
        category = normalizedCategory;
        
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
            environment,
            // Agregar información de normalización si aplica
            ...(originalCategory !== category && { originalCategory })
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
    categoryMappingStats: any;
} {
    return {
        ...loggingMetrics,
        rateLimiterStats: globalRateLimiter.getStats(),
        sanitizationStats: SanitizationMetrics.getStats(),
        filterStats: LogFilterMetrics.getStats(),
        categoryMappingStats: getCategoryMappingStats()
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
    loggingMetrics.categoriesNormalized = 0;
    
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
 * 🏗️ FORMATEAR ENTRADA PARA GOOGLE CLOUD LOGGING - VERSIÓN MEJORADA
 * 
 * Convierte LogEntry en formato JSON estructurado y limpio para Google Cloud.
 * MEJORAS: Menos verboso, más estructurado, información útil concentrada.
 */
function formatGoogleCloudLogEntry(entry: LogEntry): string {
    const { timestamp, level, category, message, details, originalCategory } = entry;
    
    // Extraer información contextual básica
    const userId = details?.userId || details?.shortUserId || 'system';
    const environment = entry.environment || (process.env.K_SERVICE ? 'production' : 'development');
    const deployment = process.env.K_REVISION || 'local';
    
    // Estructura OPTIMIZADA y LIMPIA para Google Cloud Logging
    const structuredEntry = {
        timestamp,
        severity: mapLevelToGoogleSeverity(level),
        message: `[${category}] ${message}`,
        
        // ✨ JSONPAYLOAD SIMPLIFICADO - Solo información esencial
        jsonPayload: {
        category,
            level,
            userId,
            environment,
            
            // Información de normalización si aplica
            ...(originalCategory && { originalCategory }),
            
            // Información contextual específica por tipo de log
            ...(extractContextualInfo(category, details)),
            
            // Detalles limpiados (sin metadata spam)
            ...(details && { details: cleanDetailsForLogging(details) })
        },
        
        // ✨ LABELS ESENCIALES - Solo para filtrado
        labels: {
            app: 'whatsapp-bot',
            category,
            level,
            userId,
            component: getCategoryComponent(category),
            
            // Labels específicos solo si son útiles
            ...(level === 'ERROR' && { hasError: 'true' }),
            ...(category.startsWith('FUNCTION_') && { functionCalling: 'true' }),
            ...(category.startsWith('BEDS24_') && { beds24Integration: 'true' }),
            ...(category.startsWith('OPENAI_') && { aiProcessing: 'true' })
        }
    };
    
    // Limpiar campos vacíos para reducir tamaño
    return JSON.stringify(structuredEntry, (key, value) => {
        if (value === undefined || value === null || value === '') return undefined;
        if (typeof value === 'object' && Object.keys(value).length === 0) return undefined;
        return value;
    });
}

/**
 * 🔍 EXTRAER INFORMACIÓN CONTEXTUAL ESPECÍFICA
 * 
 * Extrae solo la información más relevante según el tipo de log.
 */
function extractContextualInfo(category: string, details: any): any {
    if (!details) return {};
    
    const contextInfo: any = {};
    
    // Información específica por categoría
    switch (true) {
        case category.startsWith('MESSAGE_'):
            if (details.messageLength) contextInfo.messageLength = details.messageLength;
            if (details.messageCount) contextInfo.messageCount = details.messageCount;
            if (details.chunks) contextInfo.chunks = details.chunks;
            break;
            
        case category.startsWith('OPENAI_'):
            if (details.threadId) contextInfo.threadId = details.threadId;
            if (details.runId) contextInfo.runId = details.runId;
            if (details.state) contextInfo.state = details.state;
            if (details.duration) contextInfo.duration = details.duration;
            break;
            
        case category.startsWith('FUNCTION_'):
            if (details.functionName) contextInfo.functionName = details.functionName;
            if (details.duration) contextInfo.duration = details.duration;
            if (details.args && typeof details.args === 'object') {
                // Solo argumentos esenciales, no todo el objeto
                contextInfo.argsCount = Object.keys(details.args).length;
            }
            break;
            
        case category.startsWith('BEDS24_'):
            if (details.startDate) contextInfo.startDate = details.startDate;
            if (details.endDate) contextInfo.endDate = details.endDate;
            if (details.propertyId) contextInfo.propertyId = details.propertyId;
            if (details.method) contextInfo.method = details.method;
            if (details.status) contextInfo.status = details.status;
            break;
            
        case category.startsWith('THREAD_'):
            if (details.threadId) contextInfo.threadId = details.threadId;
            if (details.operation) contextInfo.operation = details.operation;
            if (details.threadsCount) contextInfo.threadsCount = details.threadsCount;
            break;
    }
    
    // Información de rendimiento universal
    if (details.duration && !contextInfo.duration) {
        contextInfo.duration = details.duration;
    }
    
    if (details.responseTime) {
        contextInfo.responseTime = details.responseTime;
    }
    
    return contextInfo;
}

/**
 * 🧹 LIMPIAR DETALLES PARA LOGGING
 * 
 * Remueve información innecesaria y spam de metadata.
 */
function cleanDetailsForLogging(details: any): any {
    if (!details || typeof details !== 'object') return details;
    
    const cleaned = { ...details };
    
    // Remover metadata de Cloud Build y deployment
    const metadataSpam = [
        'commit-sha', 'gcb-build-id', 'gcb-trigger-id', 'gcb-trigger-region',
        'managed-by', 'instanceId', 'configuration_name', 'project_id',
        'revision_name', 'service_name', 'location'
    ];
    
    metadataSpam.forEach(field => {
        delete cleaned[field];
    });
    
    // Limpiar labels si contienen spam
    if (cleaned.labels && typeof cleaned.labels === 'object') {
        const cleanedLabels = { ...cleaned.labels };
        metadataSpam.forEach(field => {
            delete cleanedLabels[field];
        });
        
        // Solo mantener si hay labels útiles
        if (Object.keys(cleanedLabels).length > 0) {
            cleaned.labels = cleanedLabels;
        } else {
            delete cleaned.labels;
        }
    }
    
    // Truncar campos muy largos
    Object.keys(cleaned).forEach(key => {
        if (typeof cleaned[key] === 'string' && cleaned[key].length > 1000) {
            cleaned[key] = cleaned[key].substring(0, 1000) + '... [TRUNCATED]';
        }
    });
    
    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
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