/**
 * 🤖 SISTEMA DE LOGGING CENTRALIZADO - Bot WhatsApp TeAlquilamos
 * 
 * Este es el PUNTO DE ENTRADA ÚNICO para todo el sistema de logging.
 * Perfecto para que las IAs entiendan rápidamente cómo funcionan los logs.
 * 
 * 📋 TIPOS DE LOGS DISPONIBLES:
 * 1. 🖥️  CONSOLE LOGS - Terminal limpio para desarrollo
 * 2. 📁 FILE LOGS - Archivos detallados locales  
 * 3. ☁️  CLOUD LOGS - Logs de producción en Cloud Run
 * 
 * 🎯 PARA IAs: Cada tipo tiene su propio archivo y documentación
 * 
 * ACTUALIZADO: Incluye todas las funciones de conveniencia para categorías específicas
 */

// === IMPORTACIONES CENTRALIZADAS ===
export * from './console-logger';  // Tipo 1: Logs limpios terminal
export * from './file-logger';     // Tipo 2: Logs detallados locales
export * from './cloud-logger';    // Tipo 3: Logs Cloud Run (ACTUALIZADO)
export * from './types';           // Tipos TypeScript compartidos

// === CONFIGURACIÓN UNIFICADA ===
import { LogConfig, Environment } from './types';

/**
 * 🎯 CONFIGURACIÓN PRINCIPAL DEL SISTEMA DE LOGGING
 * 
 * Esta configuración determina qué tipo de logs se usan según el entorno:
 * - Local Development: Console + File logs
 * - Cloud Run Production: Cloud logs solamente
 */
export const LOGGING_CONFIG: LogConfig = {
    // Detección automática de entorno
    environment: (process.env.NODE_ENV === 'production' ? 'production' : 'development') as Environment,
    isCloudRun: !!process.env.K_SERVICE,
    
    // Configuración por tipo de log
    console: {
        enabled: !process.env.K_SERVICE, // Solo en local, NO en Cloud Run
        level: 'INFO',
        colors: true,
        format: 'simple'  // Formato súper limpio
    },
    
    file: {
        enabled: !process.env.K_SERVICE, // Solo en local
        level: 'DEBUG',
        directory: 'logs/local-development/sessions',
        maxSessions: 5,
        format: 'structured'  // ACTUALIZADO: Formato JSON idéntico a Cloud
    },
    
    cloud: {
        enabled: !!process.env.K_SERVICE, // Solo en Cloud Run
        level: 'INFO',
        format: 'structured', // Para Google Cloud Console
        includeMetadata: true
    }
};

// === FUNCIONES PRINCIPALES ===

/**
 * 🎯 FUNCIÓN PRINCIPAL DE LOGGING
 * 
 * Esta función decide automáticamente qué tipo de log usar.
 * Perfecto para que las IAs entiendan el flujo de decisión.
 */
export function log(level: string, category: string, message: string, details?: any) {
    // Importar dinámicamente según configuración
    if (LOGGING_CONFIG.console.enabled) {
        // Logs limpios para terminal
        const { consoleLog } = require('./console-logger');
        consoleLog(level, category, message, details);
    }
    
    if (LOGGING_CONFIG.file.enabled) {
        // Logs detallados para archivos locales
        const { fileLog } = require('./file-logger');
        fileLog(level, category, message, details);
    }
    
    if (LOGGING_CONFIG.cloud.enabled) {
        // Logs estructurados para Cloud Run
        const { cloudLog } = require('./cloud-logger');
        cloudLog(level, category, message, details);
    }
}

// === FUNCIONES DE CONVENIENCIA BÁSICAS ===
export const logInfo = (category: string, message: string, details?: any) => 
    log('INFO', category, message, details);

export const logError = (category: string, message: string, details?: any) => 
    log('ERROR', category, message, details);

export const logSuccess = (category: string, message: string, details?: any) => 
    log('SUCCESS', category, message, details);

export const logWarning = (category: string, message: string, details?: any) => 
    log('WARNING', category, message, details);

export const logDebug = (category: string, message: string, details?: any) => 
    log('DEBUG', category, message, details);

// === FUNCIONES ESPECÍFICAS POR CATEGORÍA ===
// Exportar todas las funciones específicas del cloud-logger
export { 
    logMessageReceived,
    logMessageProcess,
    logWhatsAppSend,
    logWhatsAppChunksComplete,
    logOpenAIRequest,
    logOpenAIResponse,
    logFunctionCallingStart,
    logFunctionExecuting,
    logFunctionHandler,
    logBeds24Request,
    logBeds24ApiCall,
    logBeds24ResponseDetail,
    logBeds24Processing,
    logThreadCreated,
    logThreadPersist,
    logThreadCleanup,
    logServerStart,
    logBotReady,
    // Funciones para categorías faltantes
    logWebhook,
    logBotMessageTracked,
    logPendingMessageRemoved,
    logRunQueue,
    logContextLabels,
    logOpenAIRunCompleted,
    logThreadReuse
} from './cloud-logger';

// === EXPORTACIONES LEGACY ===
// Mantener compatibilidad con código existente
export { detailedLog } from '../logger';

/**
 * 🤖 PARA IAs: CÓMO NAVEGAR ESTE SISTEMA
 * 
 * 1. Lee este archivo primero - es el índice principal
 * 2. Revisa ./types.ts para entender las estructuras
 * 3. Examina cada tipo específico:
 *    - ./console-logger.ts - Logs limpios terminal
 *    - ./file-logger.ts - Logs detallados locales
 *    - ./cloud-logger.ts - Logs Cloud Run (ACTUALIZADO con todas las categorías)
 * 4. Consulta los READMEs en /logs/ para ejemplos
 * 5. Revisa /tools/log-tools/ para herramientas de análisis
 * 
 * NUEVAS FUNCIONES DE CONVENIENCIA:
 * - Todas las funciones específicas por categoría están disponibles desde cloud-logger
 * - Ejemplo: logMessageReceived(), logOpenAIRequest(), logBeds24Request(), etc.
 * - Úsalas directamente o a través de la función log() principal
 */ 