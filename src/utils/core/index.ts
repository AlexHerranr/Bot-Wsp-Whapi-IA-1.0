// Re-exportar utilidades core

// Importar las funciones del logger
import { 
    logInfo as originalLogInfo, 
    logError as originalLogError, 
    logWarning as originalLogWarning, 
    logSuccess as originalLogSuccess, 
    logDebug as originalLogDebug,
    detailedLog,
    getSessionInfo,
    listAvailableSessions
} from '../logger.js';

// Crear wrapper para enhancedLog que acepta minúsculas
export const enhancedLog = (
    level: 'info' | 'success' | 'warning' | 'error' | 'debug',
    category: string,
    message: string,
    details?: any
): void => {
    // Convertir a mayúsculas para detailedLog
    const upperLevel = level.toUpperCase() as 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'DEBUG';
    detailedLog(upperLevel, category, message, details);
};

// Re-exportar las funciones de conveniencia
export const logInfo = originalLogInfo;
export const logError = originalLogError;
export const logWarning = originalLogWarning;
export const logSuccess = originalLogSuccess;
export const logDebug = originalLogDebug;

// Re-exportar funciones de sesión
export { getSessionInfo, listAvailableSessions }; 