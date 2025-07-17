// 🚀 NUEVO: Niveles de log extendidos
export type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'FATAL' | 'ALERT';

interface CategoryConfig {
    [category: string]: boolean | undefined;
}

// Centralised logging configuration
export const LogConfig = {
    // Global log level (default INFO)
    level: (process.env.LOG_LEVEL || 'INFO') as LogLevel,

    // Extra verbose flag (useful for local debugging)
    enableDetailedLogs: process.env.ENABLE_DETAILED_LOGS === 'true',

    // Per-category overrides. `false` fuerza a silenciar, `true` fuerza a mostrar.
    categories: {
        USER_ID_EXTRACTION: false,
        BOT_MESSAGE_FILTERED: false,
        WEBHOOK_STATUS: false,
        RUN_QUEUE: false,
        CONTEXT_LABELS_EMPTY: false,

        // Estos se activan solo si el nivel global es DEBUG
        THREAD_LOOKUP: process.env.LOG_LEVEL === 'DEBUG',
        OPENAI_REQUEST: process.env.LOG_LEVEL === 'DEBUG'
    } as CategoryConfig
};

/**
 * Determines if a message belonging to `category` should be logged at `level`.
 * Returns true when:
 *   1. The message level is >= global level, AND
 *   2. The category is not explicitly disabled.
 */
export const shouldLog = (category: string, level: LogLevel = 'INFO'): boolean => {
    const levels: LogLevel[] = ['TRACE', 'DEBUG', 'INFO', 'SUCCESS', 'WARNING', 'ERROR', 'FATAL', 'ALERT'];
    const currentLevelIdx = levels.indexOf(LogConfig.level);
    const messageLevelIdx = levels.indexOf(level);

    // Skip if message below global level
    if (messageLevelIdx < currentLevelIdx) return false;

    // Honour category explicit flag
    const catSetting = LogConfig.categories[category];
    if (catSetting === false) return false; // forced off
    if (catSetting === true) return true;   // forced on

    // Default: allowed
    return true;
}; 