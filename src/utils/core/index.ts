// Re-exportar utilidades core

// Importar las funciones del logger NUEVO
import { 
    logInfo as originalLogInfo, 
    logError as originalLogError, 
    logWarning as originalLogWarning, 
    logSuccess as originalLogSuccess, 
    logDebug as originalLogDebug,
    detailedLog
} from '../logging/index.js';

// Crear wrapper para enhancedLog que acepta minúsculas
export const enhancedLog = (
    level: 'info' | 'success' | 'warning' | 'error' | 'debug',
    category: string,
    message: string,
    details?: any
): void => {
    // Usar directamente las funciones del sistema nuevo
    switch (level) {
        case 'info':
            originalLogInfo(category, message, details);
            break;
        case 'success':
            originalLogSuccess(category, message, details);
            break;
        case 'warning':
            originalLogWarning(category, message, details);
            break;
        case 'error':
            originalLogError(category, message, details);
            break;
        case 'debug':
            originalLogDebug(category, message, details);
            break;
    }
};

// Re-exportar las funciones de conveniencia
export const logInfo = originalLogInfo;
export const logError = originalLogError;
export const logWarning = originalLogWarning;
export const logSuccess = originalLogSuccess;
export const logDebug = originalLogDebug; 