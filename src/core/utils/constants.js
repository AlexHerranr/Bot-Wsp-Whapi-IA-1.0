"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USER_STATE_MAX_AGE = exports.CLEANUP_INTERVAL = exports.DEFAULT_CACHE_SIZE = exports.TYPING_LOG_RATE_LIMIT = exports.SHOW_FUNCTION_LOGS = exports.TEMP_FILE_CLEANUP_INTERVAL = exports.MEDIA_DOWNLOAD_TIMEOUT = exports.OPENAI_TIMEOUT = exports.OPENAI_POLLING_INTERVAL = exports.OPENAI_MAX_POLLING_TIME = exports.DEFAULT_RETRY_OPTIONS = exports.MAX_CONTEXT_MESSAGES = exports.MAX_BUFFER_MESSAGES = exports.MAX_MESSAGE_LENGTH = exports.BUFFER_DELAY_MS = exports.PRECOMPUTED_CACHE_TTL = exports.CHAT_INFO_CACHE_TTL = void 0;
// Constantes de configuración para Tiempos de Espera y Límites
exports.CHAT_INFO_CACHE_TTL = 5 * 60 * 1000; // 5 minutos
// ELIMINADO: CONTEXT_CACHE_TTL - context injection moved to external N8N flows
exports.PRECOMPUTED_CACHE_TTL = 1 * 60 * 1000; // 1 minuto
// Buffer timing constants - Sistema unificado de 5s (configurable vía env)
exports.BUFFER_DELAY_MS = parseInt(process.env.BUFFER_DELAY_MS || '5000', 10); // 5s unificado para todos los eventos
// Message processing limits
exports.MAX_MESSAGE_LENGTH = 5000;
exports.MAX_BUFFER_MESSAGES = 50;
exports.MAX_CONTEXT_MESSAGES = 20;
// Retry configuration constants
exports.DEFAULT_RETRY_OPTIONS = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2
};
// OpenAI configuration
exports.OPENAI_MAX_POLLING_TIME = 60000; // 1 minuto
exports.OPENAI_POLLING_INTERVAL = 2000; // 2 segundos
exports.OPENAI_TIMEOUT = parseInt(process.env.OPENAI_TIMEOUT || '45000', 10);
// Media processing
exports.MEDIA_DOWNLOAD_TIMEOUT = 30000; // 30 segundos
exports.TEMP_FILE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutos
// Logging and debugging
exports.SHOW_FUNCTION_LOGS = process.env.TERMINAL_LOGS_FUNCTIONS !== 'false';
exports.TYPING_LOG_RATE_LIMIT = 5000; // 5 segundos rate limit
// Cache and cleanup
exports.DEFAULT_CACHE_SIZE = 1000;
exports.CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutos
exports.USER_STATE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 horas
