// src/core/utils/retry-utils.ts
import { IRetryOptions } from '../../shared/interfaces';
import { DEFAULT_RETRY_OPTIONS } from './constants';

export interface RetryOptions extends IRetryOptions {
    initialDelay: number; // Alias for baseDelay for backward compatibility
}

export const defaultRetryOptions: RetryOptions = {
    maxRetries: DEFAULT_RETRY_OPTIONS.maxRetries,
    baseDelay: DEFAULT_RETRY_OPTIONS.baseDelay,
    initialDelay: DEFAULT_RETRY_OPTIONS.baseDelay, // Backward compatibility
    maxDelay: DEFAULT_RETRY_OPTIONS.maxDelay,
    backoffFactor: DEFAULT_RETRY_OPTIONS.backoffFactor
};

/**
 * Utility function to convert delay to consistent format
 */
function getDelay(options: Partial<RetryOptions>): number {
    return options.baseDelay || options.initialDelay || DEFAULT_RETRY_OPTIONS.baseDelay;
}

// Error class to indicate that an operation should not be retried
export class NoRetryError extends Error {
    constructor(message: string, public originalError?: any) {
        super(message);
        this.name = 'NoRetryError';
    }
}

export async function withRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
): Promise<T> {
    const config = { ...defaultRetryOptions, ...options };
    let lastError: Error | undefined;
    let delay = getDelay(config);

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        try {
            const result = await operation();
            
            // Log de éxito en retries para monitoreo de race conditions
            if (attempt > 0) {
                console.info(`✅ Retry exitoso después de ${attempt} intentos`);
            }
            
            return result;
        } catch (error) {
            lastError = error as Error;
            
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

export function createRetryableFunction<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options?: Partial<RetryOptions>
): T {
    return (async (...args: Parameters<T>) => {
        return withRetry(() => fn(...args), options);
    }) as T;
}

// Función específica para fetch con reintentos
export async function fetchWithRetry(
    url: string,
    options?: RequestInit & { retryOptions?: Partial<RetryOptions> }
): Promise<Response> {
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
export async function openAIWithRetry<T>(
    operation: () => Promise<T>,
    options?: Partial<RetryOptions>
): Promise<T> {
    return withRetry(async () => {
        try {
            return await operation();
        } catch (error: any) {
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
export async function downloadWithRetry(
    url: string,
    timeoutMs: number = 30000,
    options?: Partial<RetryOptions>
): Promise<Response> {
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
        } finally {
            clearTimeout(timeoutId);
        }
    }, options);
}

// Función para operaciones con timeout genérico
export async function withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    timeoutMessage: string = 'Operation timed out'
): Promise<T> {
    return Promise.race([
        operation(),
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
        )
    ]);
}