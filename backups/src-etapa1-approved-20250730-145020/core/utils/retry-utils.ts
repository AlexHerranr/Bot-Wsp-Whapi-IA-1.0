// src/core/utils/retry-utils.ts

export interface RetryOptions {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
    backoffFactor: number;
}

export const defaultRetryOptions: RetryOptions = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2
};

export async function withRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
): Promise<T> {
    const config = { ...defaultRetryOptions, ...options };
    let lastError: Error | undefined;
    let delay = config.initialDelay;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error as Error;
            
            if (attempt === config.maxRetries) {
                throw lastError;
            }

            // Calcular el pr�ximo delay con backoff exponencial
            delay = Math.min(delay * config.backoffFactor, config.maxDelay);
            
            // Esperar antes del pr�ximo intento
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