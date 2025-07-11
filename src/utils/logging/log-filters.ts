/**
 * 🎛️ SISTEMA DE FILTROS INTELIGENTES PARA LOGGING
 * 
 * Configuración de niveles mínimos por categoría y filtros para reducir ruido
 * optimizado para Google Cloud Run y análisis automático.
 */

import { LogLevel } from './types';

// ✨ CONFIGURACIÓN DE NIVELES MÍNIMOS POR CATEGORÍA
export const CATEGORY_LEVELS: Record<string, LogLevel> = {
    // === MENSAJES Y COMUNICACIÓN ===
    'MESSAGE_RECEIVED': 'INFO',      // Todos los mensajes importantes
    'MESSAGE_PROCESS': 'INFO',       // Procesamiento crítico
    'WHATSAPP_SEND': 'INFO',         // Envíos importantes
    'WHATSAPP_CHUNKS_COMPLETE': 'SUCCESS', // Solo completados exitosos
    
    // === OPENAI Y FUNCIONES ===
    'OPENAI_REQUEST': 'INFO',        // Requests importantes
    'OPENAI_RESPONSE': 'SUCCESS',    // Solo respuestas exitosas
    'FUNCTION_CALLING_START': 'INFO', // Inicio de funciones
    'FUNCTION_EXECUTING': 'DEBUG',   // Detalles de ejecución (menos crítico)
    'FUNCTION_HANDLER': 'INFO',      // Manejo general
    
    // === INTEGRACIÓN BEDS24 ===
    'BEDS24_REQUEST': 'INFO',        // Requests importantes
    'BEDS24_API_CALL': 'DEBUG',      // Llamadas detalladas (menos crítico)
    'BEDS24_RESPONSE_DETAIL': 'DEBUG', // Respuestas detalladas (menos crítico)
    'BEDS24_PROCESSING': 'INFO',     // Procesamiento importante
    
    // === SISTEMA Y THREADS ===
    'THREAD_CREATED': 'SUCCESS',     // Creación exitosa
    'THREAD_PERSIST': 'DEBUG',       // Persistencia (menos crítico)
    'THREAD_CLEANUP': 'INFO',        // Limpieza importante
    'SERVER_START': 'SUCCESS',       // Inicio del servidor
    'BOT_READY': 'SUCCESS',          // Bot listo
    
    // === ERRORES Y WARNINGS ===
    'ERROR': 'ERROR',                // Todos los errores
    'WARNING': 'WARNING',            // Todos los warnings
    'SUCCESS': 'SUCCESS'             // Todos los éxitos
};

// ✨ CONFIGURACIÓN DE ENTORNO
export const ENVIRONMENT_CONFIG = {
    production: {
        globalMinLevel: 'INFO' as LogLevel,
        enableDebugLogs: false,
        enableVerboseLogs: false,
        maxLogsPerMinute: 1000,
        enableLogAggregation: true
    },
    development: {
        globalMinLevel: 'DEBUG' as LogLevel,
        enableDebugLogs: true,
        enableVerboseLogs: true,
        maxLogsPerMinute: 5000,
        enableLogAggregation: false
    }
};

// ✨ JERARQUÍA DE NIVELES
const LEVEL_HIERARCHY: Record<LogLevel, number> = {
    'DEBUG': 0,
    'INFO': 1,
    'SUCCESS': 2,
    'WARNING': 3,
    'ERROR': 4
};

/**
 * 🎯 FUNCIÓN PRINCIPAL DE FILTRADO
 * 
 * Determina si un log debe ser emitido según configuración de filtros.
 */
export function shouldLog(level: LogLevel, category: string, environment: string = 'development'): boolean {
    // 1. Verificar configuración de entorno
    const envConfig = ENVIRONMENT_CONFIG[environment as keyof typeof ENVIRONMENT_CONFIG] || ENVIRONMENT_CONFIG.development;
    
    // 2. Verificar nivel global mínimo
    if (LEVEL_HIERARCHY[level] < LEVEL_HIERARCHY[envConfig.globalMinLevel]) {
        return false;
    }
    
    // 3. Verificar nivel específico por categoría
    const categoryMinLevel = CATEGORY_LEVELS[category];
    if (categoryMinLevel && LEVEL_HIERARCHY[level] < LEVEL_HIERARCHY[categoryMinLevel]) {
        return false;
    }
    
    // 4. Filtros especiales por entorno
    if (environment === 'production') {
        // En producción, filtrar logs muy frecuentes
        if (isHighFrequencyCategory(category) && level === 'DEBUG') {
            return false;
        }
        
        // En producción, siempre permitir errores y warnings
        if (level === 'ERROR' || level === 'WARNING') {
            return true;
        }
    }
    
    // 5. Filtros por contenido (anti-spam)
    if (isSpamCategory(category)) {
        return shouldLogSpamCategory(level, category);
    }
    
    return true;
}

/**
 * 🚫 CATEGORÍAS DE ALTA FRECUENCIA
 * 
 * Categorías que pueden generar mucho ruido en logs.
 */
function isHighFrequencyCategory(category: string): boolean {
    const highFrequencyCategories = [
        'BEDS24_API_CALL',
        'BEDS24_RESPONSE_DETAIL',
        'FUNCTION_EXECUTING',
        'THREAD_PERSIST',
        'MESSAGE_BUFFER'
    ];
    
    return highFrequencyCategories.includes(category);
}

/**
 * 🔇 CATEGORÍAS CONSIDERADAS SPAM
 * 
 * Categorías que pueden ser muy repetitivas.
 */
function isSpamCategory(category: string): boolean {
    const spamCategories = [
        'BUFFER_TIMER_RESET',
        'TYPING_DETECTED',
        'HEALTH_CHECK',
        'MEMORY_CLEANUP'
    ];
    
    return spamCategories.includes(category);
}

/**
 * 🎛️ FILTRO ESPECÍFICO PARA CATEGORÍAS SPAM
 * 
 * Lógica especial para categorías que pueden ser spam.
 */
function shouldLogSpamCategory(level: LogLevel, category: string): boolean {
    // Solo permitir SUCCESS y ERROR para categorías spam
    return level === 'SUCCESS' || level === 'ERROR';
}

/**
 * 📊 FILTROS INTELIGENTES POR CONTEXTO
 * 
 * Filtros adicionales basados en contexto específico.
 */
export function applyContextualFilters(level: LogLevel, category: string, details: any, environment: string): boolean {
    // 1. Filtrar logs de usuarios específicos en desarrollo
    if (environment === 'development' && details?.userId === 'test') {
        return false;
    }
    
    // 2. Filtrar logs muy largos en producción
    if (environment === 'production' && details?.body && details.body.length > 1000) {
        return level !== 'DEBUG'; // Solo permitir logs importantes
    }
    
    // 3. Filtrar logs de funciones exitosas repetitivas
    if (category === 'FUNCTION_EXECUTING' && details?.functionName === 'check_availability' && level === 'DEBUG') {
        return false; // Muy frecuente, solo errores
    }
    
    // 4. Filtrar logs de Beds24 exitosos en producción
    if (environment === 'production' && category.startsWith('BEDS24_') && level === 'DEBUG') {
        return false; // Solo INFO y superiores en producción
    }
    
    // 5. Siempre permitir logs con errores
    if (details?.error || level === 'ERROR') {
        return true;
    }
    
    return true;
}

/**
 * 🎯 CONFIGURACIÓN DINÁMICA POR USUARIO
 * 
 * Permite ajustar filtros específicos por usuario para debugging.
 */
export const USER_SPECIFIC_FILTERS: Record<string, {
    enableDebug: boolean;
    categories: string[];
    minLevel: LogLevel;
}> = {
    // Ejemplo: Usuario específico para debugging
    'debug_user': {
        enableDebug: true,
        categories: ['*'], // Todas las categorías
        minLevel: 'DEBUG'
    }
};

/**
 * 🔍 VERIFICAR FILTROS ESPECÍFICOS DE USUARIO
 */
export function checkUserSpecificFilters(userId: string, level: LogLevel, category: string): boolean {
    const userFilter = USER_SPECIFIC_FILTERS[userId];
    if (!userFilter) return true; // No hay filtros específicos
    
    // Verificar nivel mínimo del usuario
    if (LEVEL_HIERARCHY[level] < LEVEL_HIERARCHY[userFilter.minLevel]) {
        return false;
    }
    
    // Verificar categorías permitidas
    if (!userFilter.categories.includes('*') && !userFilter.categories.includes(category)) {
        return false;
    }
    
    return true;
}

/**
 * 📈 MÉTRICAS DE FILTRADO
 * 
 * Contador de logs filtrados para análisis.
 */
export class LogFilterMetrics {
    private static filteredCounts: Record<string, number> = {};
    private static totalLogs = 0;
    private static filteredLogs = 0;
    
    static recordFiltered(category: string, reason: string) {
        const key = `${category}:${reason}`;
        this.filteredCounts[key] = (this.filteredCounts[key] || 0) + 1;
        this.filteredLogs++;
    }
    
    static recordTotal() {
        this.totalLogs++;
    }
    
    static getStats() {
        return {
            totalLogs: this.totalLogs,
            filteredLogs: this.filteredLogs,
            filteredPercentage: this.totalLogs > 0 ? (this.filteredLogs / this.totalLogs * 100).toFixed(2) : '0',
            filteredByCategory: this.filteredCounts
        };
    }
    
    static reset() {
        this.filteredCounts = {};
        this.totalLogs = 0;
        this.filteredLogs = 0;
    }
}

/**
 * 🤖 PARA IAs: SISTEMA DE FILTROS INTELIGENTES
 * 
 * Este sistema permite:
 * - Configurar niveles mínimos por categoría
 * - Filtrar logs según entorno (production/development)
 * - Aplicar filtros contextuales inteligentes
 * - Configurar filtros específicos por usuario
 * - Medir métricas de filtrado para optimización
 * - Reducir ruido sin perder información crítica
 */ 