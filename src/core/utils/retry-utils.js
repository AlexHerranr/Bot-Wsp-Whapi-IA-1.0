"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoRetryError = exports.defaultRetryOptions = void 0;
exports.withRetry = withRetry;
exports.createRetryableFunction = createRetryableFunction;
exports.fetchWithRetry = fetchWithRetry;
exports.openAIWithRetry = openAIWithRetry;
exports.downloadWithRetry = downloadWithRetry;
exports.withTimeout = withTimeout;
const constants_1 = require("./constants");
exports.defaultRetryOptions = {
    maxRetries: constants_1.DEFAULT_RETRY_OPTIONS.maxRetries,
    baseDelay: constants_1.DEFAULT_RETRY_OPTIONS.baseDelay,
    initialDelay: constants_1.DEFAULT_RETRY_OPTIONS.baseDelay, // Backward compatibility
    maxDelay: constants_1.DEFAULT_RETRY_OPTIONS.maxDelay,
    backoffFactor: constants_1.DEFAULT_RETRY_OPTIONS.backoffFactor
};
/**
 * Utility function to convert delay to consistent format
 */
function getDelay(options) {
    return options.baseDelay || options.initialDelay || constants_1.DEFAULT_RETRY_OPTIONS.baseDelay;
}
// Error class to indicate that an operation should not be retried
class NoRetryError extends Error {
    constructor(message, originalError) {
        super(message);
        this.originalError = originalError;
        this.name = 'NoRetryError';
    }
}
exports.NoRetryError = NoRetryError;
async function withRetry(operation, options = {}) {
    const config = { ...exports.defaultRetryOptions, ...options };
    let lastError;
    let delay = getDelay(config);
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        try {
            const result = await operation();
            // Log de éxito en retries para monitoreo de race conditions
            if (attempt > 0) {
                console.info(`✅ Retry exitoso después de ${attempt} intentos`);
            }
            return result;
        }
        catch (error) {
            lastError = error;
            // Don't retry if it's a NoRetryError
            if (error instanceof NoRetryError) {
                throw error.originalError || error;
            }
            if (attempt === config.maxRetries) {
                throw lastError;
            }
            // Calcular el próximo delay con backoff exponencial
            delay = Math.min(delay * config.backoffFactor, config.maxDelay);
            // Esperar antes del próximo intento
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError || new Error('Retry failed');
}
function createRetryableFunction(fn, options) {
    return (async (...args) => {
        return withRetry(() => fn(...args), options);
    });
}
// Función específica para fetch con reintentos
async function fetchWithRetry(url, options) {
    const { retryOptions, ...fetchOptions } = options || {};
    return withRetry(async () => {
        const response = await fetch(url, fetchOptions);
        // Solo reintentar en errores de red o 5xx
        if (!response.ok && response.status >= 500) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response;
    }, retryOptions);
}
// Función específica para OpenAI con manejo de rate limits
async function openAIWithRetry(operation, options) {
    return withRetry(async () => {
        try {
            return await operation();
        }
        catch (error) {
            // Log del error real para debugging
            console.error('OPENAI_ERROR_DETAIL:', {
                status: error.status,
                code: error.code,
                message: error.message,
                type: error.type,
                param: error.param
            });
            // Rate limit específico de OpenAI
            if (error.status === 429 || error.code === 'rate_limit_exceeded') {
                throw new Error(`OpenAI rate limit: ${error.message}`);
            }
            // Errores temporales de OpenAI
            if (error.status >= 500 || error.code === 'api_error') {
                throw new Error(`OpenAI API error: ${error.message}`);
            }
            // Race condition específico: thread ocupado - RETRYABLE con delay inicial
            if (error.status === 400 && error.message &&
                error.message.includes("Can't add messages to thread") &&
                error.message.includes("while a run is active")) {
                // Delay inicial de 2s para dar tiempo natural al run anterior
                await new Promise(resolve => setTimeout(resolve, 2000));
                throw new Error(`Thread busy - will retry after initial delay: ${error.message}`);
            }
            // No reintentar otros errores (400s, etc.)
            throw new NoRetryError(`Non-retryable OpenAI error: ${error.message}`, error);
        }
    }, {
        maxRetries: 5, // Más reintentos para OpenAI
        baseDelay: 2000, // Delay inicial más alto
        maxDelay: 30000,
        backoffFactor: 2,
        ...options
    });
}
// Función para descargas de media con timeout
async function downloadWithRetry(url, timeoutMs = 30000, options) {
    return withRetry(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'WhatsApp-Bot/1.0'
                }
            });
            if (!response.ok) {
                throw new Error(`Download failed: ${response.status} ${response.statusText}`);
            }
            return response;
        }
        finally {
            clearTimeout(timeoutId);
        }
    }, options);
}
// Función para operaciones con timeout genérico
async function withTimeout(operation, timeoutMs, timeoutMessage = 'Operation timed out') {
    return Promise.race([
        operation(),
        new Promise((_, reject) => setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs))
    ]);
}
