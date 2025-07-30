// Constantes de configuración para Tiempos de Espera y Límites
export const CHAT_INFO_CACHE_TTL = 5 * 60 * 1000; // 5 minutos
export const CONTEXT_CACHE_TTL = 60 * 60 * 1000; // 1 hora
export const BUFFER_WINDOW_MS = 5000; // 5 segundos
export const VOICE_BUFFER_MS = 8000; // 8 segundos
export const TYPING_EXTENDED_MS = 10000; // 10 segundos
export const MAX_MESSAGE_LENGTH = 5000;
export const SHOW_FUNCTION_LOGS = process.env.TERMINAL_LOGS_FUNCTIONS !== 'false';