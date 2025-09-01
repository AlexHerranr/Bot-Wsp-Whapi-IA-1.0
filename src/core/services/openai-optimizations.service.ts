// src/core/services/openai-optimizations.service.ts
import { LRUCache } from 'lru-cache';
import { createHash } from 'crypto';
import { logInfo, logWarning, logError, logSuccess } from '../../utils/logging';

/**
 * Circuit Breaker Pattern para manejar fallos de OpenAI
 */
export class CircuitBreaker {
    private failureCount: number = 0;
    private lastFailureTime: number = 0;
    private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
    
    constructor(
        private readonly threshold: number = 5,
        private readonly timeout: number = 60000, // 1 minuto
        private readonly resetTimeout: number = 30000 // 30 segundos para half-open
    ) {}

    async execute<T>(operation: () => Promise<T>): Promise<T> {
        if (this.state === 'OPEN') {
            const now = Date.now();
            if (now - this.lastFailureTime > this.timeout) {
                this.state = 'HALF_OPEN';
                logInfo('CIRCUIT_BREAKER', 'Circuit breaker en estado HALF_OPEN', {
                    failureCount: this.failureCount,
                    timeSinceLastFailure: now - this.lastFailureTime
                });
            } else {
                throw new Error('Circuit breaker is OPEN - service temporarily unavailable');
            }
        }

        try {
            const result = await operation();
            
            if (this.state === 'HALF_OPEN') {
                this.state = 'CLOSED';
                this.failureCount = 0;
                logSuccess('CIRCUIT_BREAKER', 'Circuit breaker restaurado a CLOSED', {});
            }
            
            return result;
        } catch (error) {
            this.failureCount++;
            this.lastFailureTime = Date.now();
            
            if (this.failureCount >= this.threshold) {
                this.state = 'OPEN';
                logError('CIRCUIT_BREAKER', 'Circuit breaker abierto por exceso de fallos', {
                    failureCount: this.failureCount,
                    threshold: this.threshold,
                    error: error instanceof Error ? error.message : 'Unknown'
                });
            }
            
            throw error;
        }
    }

    getState(): { state: string; failureCount: number; lastFailureTime: number } {
        return {
            state: this.state,
            failureCount: this.failureCount,
            lastFailureTime: this.lastFailureTime
        };
    }

    reset(): void {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.lastFailureTime = 0;
    }
}

/**
 * Response Cache optimizado para OpenAI
 */
export class ResponseCache {
    private cache: LRUCache<string, any>;
    private hitCount: number = 0;
    private missCount: number = 0;

    constructor(
        maxSize: number = 1000,
        ttl: number = 600000 // 10 minutos por defecto
    ) {
        this.cache = new LRUCache({
            max: maxSize,
            ttl: ttl,
            updateAgeOnGet: true,
            allowStale: false
        });
    }

    /**
     * Genera una clave única para el cache basada en el contenido
     */
    private generateKey(userId: string, message: string, assistantId: string): string {
        const hash = createHash('sha256');
        hash.update(`${userId}:${assistantId}:${message}`);
        return hash.digest('hex');
    }

    /**
     * Verifica si una respuesta está en cache
     */
    get(userId: string, message: string, assistantId: string): any | null {
        const key = this.generateKey(userId, message, assistantId);
        const cached = this.cache.get(key);
        
        if (cached) {
            this.hitCount++;
            logInfo('CACHE_HIT', 'Respuesta encontrada en cache', {
                userId,
                key: key.substring(0, 8),
                hitRate: this.getHitRate()
            });
            return cached;
        }
        
        this.missCount++;
        return null;
    }

    /**
     * Guarda una respuesta en cache
     */
    set(userId: string, message: string, assistantId: string, response: any): void {
        const key = this.generateKey(userId, message, assistantId);
        this.cache.set(key, response);
        
        logInfo('CACHE_SET', 'Respuesta guardada en cache', {
            userId,
            key: key.substring(0, 8),
            cacheSize: this.cache.size
        });
    }

    /**
     * Obtiene estadísticas del cache
     */
    getStats() {
        return {
            size: this.cache.size,
            hits: this.hitCount,
            misses: this.missCount,
            hitRate: this.getHitRate()
        };
    }

    private getHitRate(): number {
        const total = this.hitCount + this.missCount;
        return total > 0 ? (this.hitCount / total) * 100 : 0;
    }

    clear(): void {
        this.cache.clear();
        this.hitCount = 0;
        this.missCount = 0;
    }
}

/**
 * Connection Pool para manejar múltiples instancias de OpenAI
 */
export class OpenAIConnectionPool {
    private connections: any[] = [];
    private currentIndex: number = 0;
    private requestCounts: Map<number, number> = new Map();

    constructor(
        private readonly apiKeys: string[],
        private readonly createConnection: (apiKey: string) => any,
        private readonly maxRequestsPerConnection: number = 100
    ) {
        this.initializeConnections();
    }

    private initializeConnections(): void {
        this.connections = this.apiKeys.map(apiKey => this.createConnection(apiKey));
        this.apiKeys.forEach((_, index) => this.requestCounts.set(index, 0));
        
        logInfo('CONNECTION_POOL', 'Pool de conexiones inicializado', {
            connectionCount: this.connections.length
        });
    }

    /**
     * Obtiene la siguiente conexión disponible usando round-robin con límites
     */
    getConnection(): any {
        let attempts = 0;
        const maxAttempts = this.connections.length;

        while (attempts < maxAttempts) {
            const currentCount = this.requestCounts.get(this.currentIndex) || 0;
            
            if (currentCount < this.maxRequestsPerConnection) {
                const connection = this.connections[this.currentIndex];
                this.requestCounts.set(this.currentIndex, currentCount + 1);
                
                // Rotar al siguiente índice para la próxima llamada
                this.currentIndex = (this.currentIndex + 1) % this.connections.length;
                
                return connection;
            }
            
            // Si esta conexión está al límite, probar la siguiente
            this.currentIndex = (this.currentIndex + 1) % this.connections.length;
            attempts++;
        }

        // Si todas las conexiones están al límite, resetear contadores y devolver la primera
        this.resetCounters();
        return this.connections[0];
    }

    /**
     * Resetea los contadores de requests (útil para llamar periódicamente)
     */
    resetCounters(): void {
        this.requestCounts.clear();
        this.apiKeys.forEach((_, index) => this.requestCounts.set(index, 0));
        
        logInfo('CONNECTION_POOL', 'Contadores de conexiones reseteados', {});
    }

    getStats() {
        const stats: any = {};
        this.requestCounts.forEach((count, index) => {
            stats[`connection_${index}`] = count;
        });
        return stats;
    }
}

/**
 * Token Optimizer para manejar eficientemente el contexto
 */
export class TokenOptimizer {
    private readonly MAX_CONTEXT_TOKENS = 120000; // Límite para GPT-4
    private readonly SAFETY_MARGIN = 10000; // Margen de seguridad

    /**
     * Estima el número de tokens en un texto
     * Aproximación: ~4 caracteres = 1 token para español/inglés
     */
    estimateTokens(text: string): number {
        // Más preciso que solo dividir por 4
        // Cuenta palabras y caracteres especiales
        const words = text.split(/\s+/).length;
        const chars = text.length;
        
        // Promedio ponderado: palabras * 1.3 + chars/4
        return Math.ceil((words * 1.3 + chars / 4) / 2);
    }

    /**
     * Verifica si un thread necesita ser reseteado por límite de tokens
     */
    shouldResetThread(currentTokens: number, newMessageTokens: number): boolean {
        const totalTokens = currentTokens + newMessageTokens;
        const threshold = this.MAX_CONTEXT_TOKENS - this.SAFETY_MARGIN;
        
        if (totalTokens > threshold) {
            logWarning('TOKEN_LIMIT', 'Thread cerca del límite de tokens', {
                currentTokens,
                newMessageTokens,
                totalTokens,
                threshold,
                willReset: true
            });
            return true;
        }
        
        return false;
    }

    /**
     * Trunca mensajes largos manteniendo el contexto importante
     */
    truncateMessage(message: string, maxTokens: number = 4000): string {
        const estimatedTokens = this.estimateTokens(message);
        
        if (estimatedTokens <= maxTokens) {
            return message;
        }

        // Calcular cuántos caracteres aproximadamente necesitamos
        const targetChars = Math.floor((maxTokens * 4) * 0.9); // 90% para estar seguros
        
        // Si el mensaje tiene estructura (JSON, lista, etc), intentar preservarla
        if (message.includes('\n')) {
            const lines = message.split('\n');
            let result = '';
            let currentChars = 0;
            
            for (const line of lines) {
                if (currentChars + line.length > targetChars) {
                    result += '\n[... contenido truncado por límite de tokens ...]';
                    break;
                }
                result += (result ? '\n' : '') + line;
                currentChars += line.length;
            }
            
            return result;
        }
        
        // Para texto plano, truncar y agregar indicador
        return message.substring(0, targetChars) + '\n[... contenido truncado por límite de tokens ...]';
    }

    /**
     * Optimiza el historial de mensajes para mantenerlo dentro de límites
     */
    optimizeMessageHistory(messages: any[], maxTokens: number = 100000): any[] {
        let totalTokens = 0;
        const optimizedMessages = [];
        
        // Procesar mensajes de más reciente a más antiguo
        for (let i = messages.length - 1; i >= 0; i--) {
            const message = messages[i];
            const messageTokens = this.estimateTokens(JSON.stringify(message));
            
            if (totalTokens + messageTokens > maxTokens) {
                // Si agregando este mensaje excedemos el límite, parar
                break;
            }
            
            optimizedMessages.unshift(message);
            totalTokens += messageTokens;
        }
        
        if (optimizedMessages.length < messages.length) {
            logInfo('MESSAGE_HISTORY_OPTIMIZED', 'Historial de mensajes optimizado', {
                originalCount: messages.length,
                optimizedCount: optimizedMessages.length,
                droppedCount: messages.length - optimizedMessages.length,
                totalTokens
            });
        }
        
        return optimizedMessages;
    }
}

/**
 * Performance Monitor para tracking de métricas
 */
export class PerformanceMonitor {
    private metrics: Map<string, number[]> = new Map();
    private counters: Map<string, number> = new Map();

    /**
     * Registra una métrica de tiempo
     */
    recordTiming(name: string, duration: number): void {
        if (!this.metrics.has(name)) {
            this.metrics.set(name, []);
        }
        
        const timings = this.metrics.get(name)!;
        timings.push(duration);
        
        // Mantener solo las últimas 100 mediciones
        if (timings.length > 100) {
            timings.shift();
        }
    }

    /**
     * Incrementa un contador
     */
    incrementCounter(name: string, value: number = 1): void {
        const current = this.counters.get(name) || 0;
        this.counters.set(name, current + value);
    }

    /**
     * Obtiene estadísticas de una métrica
     */
    getStats(name: string): any {
        const timings = this.metrics.get(name);
        
        if (!timings || timings.length === 0) {
            return null;
        }

        const sorted = [...timings].sort((a, b) => a - b);
        const sum = sorted.reduce((a, b) => a + b, 0);
        
        return {
            count: sorted.length,
            min: sorted[0],
            max: sorted[sorted.length - 1],
            avg: sum / sorted.length,
            p50: sorted[Math.floor(sorted.length * 0.5)],
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)]
        };
    }

    /**
     * Obtiene todas las métricas
     */
    getAllMetrics(): any {
        const result: any = {
            timings: {},
            counters: {}
        };

        this.metrics.forEach((_, name) => {
            result.timings[name] = this.getStats(name);
        });

        this.counters.forEach((value, name) => {
            result.counters[name] = value;
        });

        return result;
    }

    /**
     * Resetea todas las métricas
     */
    reset(): void {
        this.metrics.clear();
        this.counters.clear();
    }
}

/**
 * Batch Processor para agrupar requests
 */
export class BatchProcessor {
    private queue: Map<string, any[]> = new Map();
    private timers: Map<string, NodeJS.Timeout> = new Map();

    constructor(
        private readonly batchSize: number = 10,
        private readonly batchTimeout: number = 1000,
        private readonly processBatch: (batch: any[]) => Promise<void>
    ) {}

    /**
     * Agrega un item al batch
     */
    async add(key: string, item: any): Promise<void> {
        if (!this.queue.has(key)) {
            this.queue.set(key, []);
        }

        const batch = this.queue.get(key)!;
        batch.push(item);

        // Si alcanzamos el tamaño del batch, procesar inmediatamente
        if (batch.length >= this.batchSize) {
            this.processBatchForKey(key);
        } else {
            // Configurar timer para procesar después del timeout
            this.setupTimer(key);
        }
    }

    private setupTimer(key: string): void {
        // Cancelar timer existente si hay uno
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key)!);
        }

        // Configurar nuevo timer
        const timer = setTimeout(() => {
            this.processBatchForKey(key);
        }, this.batchTimeout);

        this.timers.set(key, timer);
    }

    private async processBatchForKey(key: string): Promise<void> {
        const batch = this.queue.get(key);
        
        if (!batch || batch.length === 0) {
            return;
        }

        // Limpiar el queue y timer
        this.queue.delete(key);
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key)!);
            this.timers.delete(key);
        }

        // Procesar el batch
        try {
            await this.processBatch(batch);
            logInfo('BATCH_PROCESSED', 'Batch procesado exitosamente', {
                key,
                batchSize: batch.length
            });
        } catch (error) {
            logError('BATCH_ERROR', 'Error procesando batch', {
                key,
                batchSize: batch.length,
                error: error instanceof Error ? error.message : 'Unknown'
            });
        }
    }

    /**
     * Fuerza el procesamiento de todos los batches pendientes
     */
    async flush(): Promise<void> {
        const keys = Array.from(this.queue.keys());
        
        for (const key of keys) {
            await this.processBatchForKey(key);
        }
    }

    getStats(): any {
        const stats: any = {};
        this.queue.forEach((batch, key) => {
            stats[key] = batch.length;
        });
        return stats;
    }
}

export default {
    CircuitBreaker,
    ResponseCache,
    OpenAIConnectionPool,
    TokenOptimizer,
    PerformanceMonitor,
    BatchProcessor
};