// Constantes de configuración para Tiempos de Espera y Límites
export const CHAT_INFO_CACHE_TTL = 5 * 60 * 1000; // 5 minutos
export const CONTEXT_CACHE_TTL = 60 * 60 * 1000; // 1 hora
export const PRECOMPUTED_CACHE_TTL = 1 * 60 * 1000; // 1 minuto

// Buffer timing constants (from Etapa 1 corrections)
export const BUFFER_WINDOW_MS = 5000; // 5 segundos para mensajes
export const VOICE_BUFFER_MS = 8000; // 8 segundos para voice
export const TYPING_EXTENDED_MS = 10000; // 10 segundos para typing/recording

// Message processing limits
export const MAX_MESSAGE_LENGTH = 5000;
export const MAX_BUFFER_MESSAGES = 50;
export const MAX_CONTEXT_MESSAGES = 20;

// Retry configuration constants
export const DEFAULT_RETRY_OPTIONS = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2
};

// OpenAI configuration
export const OPENAI_MAX_POLLING_TIME = 60000; // 1 minuto
export const OPENAI_POLLING_INTERVAL = 2000; // 2 segundos
export const OPENAI_TIMEOUT = parseInt(process.env.OPENAI_TIMEOUT || '45000', 10);

// Media processing
export const MEDIA_DOWNLOAD_TIMEOUT = 30000; // 30 segundos
export const TEMP_FILE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutos

// Logging and debugging
export const SHOW_FUNCTION_LOGS = process.env.TERMINAL_LOGS_FUNCTIONS !== 'false';
export const TYPING_LOG_RATE_LIMIT = 5000; // 5 segundos rate limit

// Cache and cleanup
export const DEFAULT_CACHE_SIZE = 1000;
export const CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutos
export const USER_STATE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 horas