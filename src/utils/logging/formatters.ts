/**
 * 🔧 FORMATTERS COMPARTIDOS - Sistema de Logging Unificado
 * 
 * Formatters compartidos para que File Logs y Cloud Logs tengan
 * el MISMO formato técnico JSON para análisis consistente.
 * 
 * OBJETIVO: File Logs = Cloud Logs (formato idéntico)
 */

import { LogEntry, LogLevel } from './types';

/**
 * 🏗️ FORMATEAR ENTRADA PARA ANÁLISIS TÉCNICO UNIFICADO
 * 
 * Convierte LogEntry en formato JSON estructurado IDÉNTICO
 * para File Logs y Cloud Logs.
 * 
 * USADO POR:
 * - file-logger.ts (archivos locales)
 * - cloud-logger.ts (Google Cloud Console)
 */
export function formatTechnicalLogEntry(entry: LogEntry): string {
    const { timestamp, level, category, message, details } = entry;
    
    // Extraer información contextual
    const userId = details?.userId || details?.shortUserId || 'system';
    const environment = entry.environment || (process.env.K_SERVICE ? 'production' : 'development');
    const deployment = process.env.K_REVISION || 'local';
    
    // Estructura UNIFICADA para análisis técnico
    const structuredEntry = {
        timestamp,
        severity: mapLevelToGoogleSeverity(level),
        message: `[${category}] ${message}`,
        
        // ✨ JSONPAYLOAD ESTRUCTURADO - Para análisis consistente
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
        
        // ✨ LABELS PARA FILTRADO AVANZADO
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
        
        // ✨ RESOURCE METADATA - Para Cloud Run
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
 */
function generateSessionId(): string {
    return `session-${Date.now()}`;
}

/**
 * 🖥️ FORMATEAR ENTRADA PARA CONSOLE (TERMINAL LIMPIO)
 * 
 * Convierte LogEntry en formato limpio con emojis
 * para experiencia de desarrollo óptima.
 * 
 * USADO POR:
 * - console-logger.ts (terminal de desarrollo)
 */
export function formatConsoleLogEntry(level: LogLevel, category: string, message: string, details?: any): string {
    const emoji = getEmojiForCategory(category, level);
    const cleanMessage = formatCleanMessage(message, details);
    
    return `${emoji} ${cleanMessage}`;
}

/**
 * 🎭 OBTENER EMOJI POR CATEGORÍA
 */
function getEmojiForCategory(category: string, level: LogLevel): string {
    // Emojis por nivel
    if (level === 'ERROR') return '❌';
    if (level === 'WARNING') return '⚠️';
    if (level === 'SUCCESS') return '✅';
    
    // Emojis por categoría
    if (category.startsWith('MESSAGE_')) return '👤';
    if (category.startsWith('WHATSAPP_')) return '🤖';
    if (category.startsWith('FUNCTION_')) return '⚙️';
    if (category.startsWith('BEDS24_')) return '🏨';
    if (category.startsWith('OPENAI_')) return '🧠';
    if (category.startsWith('THREAD_')) return '🧵';
    if (category === 'SERVER_START') return '🚀';
    if (category === 'BOT_READY') return '⚡';
    
    // Default
    return 'ℹ️';
}

/**
 * 🧹 FORMATEAR MENSAJE LIMPIO PARA CONSOLE
 */
function formatCleanMessage(message: string, details?: any): string {
    // Extraer información esencial sin JSON
    let cleanMessage = message;
    
    // Agregar contexto mínimo si es útil
    if (details?.userId) {
        const shortUserId = details.userId.toString().slice(-4);
        cleanMessage += ` (${shortUserId})`;
    }
    
    if (details?.duration) {
        cleanMessage += ` → ${details.duration}ms`;
    }
    
    return cleanMessage;
}

/**
 * 🎛️ VERIFICAR SI CATEGORÍA DEBE MOSTRARSE EN CONSOLE
 */
export function shouldShowInConsole(category: string): boolean {
    const CONSOLE_VISIBLE_CATEGORIES = [
        'MESSAGE_RECEIVED',    // 👤 Usuario
        'WHATSAPP_SEND',      // 🤖 Bot responde
        'FUNCTION_EXECUTING', // ⚙️ Ejecutando función
        'BEDS24_RESPONSE_DETAIL', // 🏨 Resultados Beds24
        'SERVER_START',       // 🚀 Servidor iniciado
        'BOT_READY',         // ⚡ Bot listo
        'ERROR'              // ❌ Errores
    ];
    
    return CONSOLE_VISIBLE_CATEGORIES.includes(category);
}

/**
 * 🤖 PARA IAs: FORMATTERS UNIFICADOS
 * 
 * - formatTechnicalLogEntry(): Formato JSON idéntico para File + Cloud
 * - formatConsoleLogEntry(): Formato limpio con emojis para Terminal
 * - shouldShowInConsole(): Filtro para mostrar solo logs relevantes
 * 
 * OBJETIVO: Separación clara entre experiencia de desarrollo y análisis técnico
 */ 