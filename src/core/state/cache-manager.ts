// src/core/state/cache-manager.ts
import { LRUCache } from 'lru-cache';
import { ICacheManager } from '../../shared/interfaces';
import { CacheEntry } from '../../shared/types';
import { 
    CHAT_INFO_CACHE_TTL, 
    // ELIMINADO: CONTEXT_CACHE_TTL - context moved to external N8N flows
    PRECOMPUTED_CACHE_TTL,
    DEFAULT_CACHE_SIZE,
    CLEANUP_INTERVAL 
} from '../utils/constants';

export interface CacheStats {
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
    hitRate: number;
    uptime: number;
}

export interface CacheOptions {
    maxSize?: number;
    defaultTtl?: number;
    cleanupInterval?: number;
    enableMetrics?: boolean;
}

export class CacheManager implements ICacheManager {
    private cache: LRUCache<string, any>;
    private stats: {
        hits: number;
        misses: number;
        sets: number;
        deletes: number;
        startTime: number;
    };
    private cleanupInterval?: NodeJS.Timeout;
    private options: Required<CacheOptions>;

    constructor(options: CacheOptions = {}) {
        this.options = {
            maxSize: options.maxSize ?? DEFAULT_CACHE_SIZE,
            defaultTtl: options.defaultTtl ?? CHAT_INFO_CACHE_TTL, // 5 minutos por defecto
            cleanupInterval: options.cleanupInterval ?? CLEANUP_INTERVAL,
            enableMetrics: options.enableMetrics ?? true
        };

        this.cache = new LRUCache({
            max: this.options.maxSize,
            ttl: this.options.defaultTtl,
            updateAgeOnGet: true, // Actualizar age en GET (LRU puro)
            allowStale: false,
        });

        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            startTime: Date.now()
        };

        // Iniciar cleanup automático
        this.startCleanup();
    }

    get<T>(key: string): T | undefined {
        const value = this.cache.get(key) as T | undefined;
        
        if (this.options.enableMetrics) {
            if (value !== undefined) {
                this.stats.hits++;
            } else {
                this.stats.misses++;
            }
        }
        
        return value;
    }

    set<T>(key: string, value: T, ttl?: number): void {
        // TTL en milisegundos, usa default si no se especifica
        const finalTtl = ttl ?? this.options.defaultTtl;
        this.cache.set(key, value, { ttl: finalTtl });
        
        if (this.options.enableMetrics) {
            this.stats.sets++;
        }
    }

    delete(key: string): boolean {
        const deleted = this.cache.delete(key);
        
        if (this.options.enableMetrics && deleted) {
            this.stats.deletes++;
        }
        
        return deleted;
    }

    clear(): void {
        this.cache.clear();
        if (this.options.enableMetrics) {
            // Reset stats except start time
            this.stats.hits = 0;
            this.stats.misses = 0;
            this.stats.sets = 0;
            this.stats.deletes = 0;
        }
    }

    size(): number {
        return this.cache.size;
    }

    /**
     * Métodos específicos para diferentes tipos de cache
     */

    // Chat Info Cache (5 minutos TTL)
    setChatInfo(userId: string, chatInfo: any): void {
        this.set(`chat_info:${userId}`, chatInfo, CHAT_INFO_CACHE_TTL);
    }

    getChatInfo(userId: string): any {
        return this.get(`chat_info:${userId}`);
    }

    // ELIMINADO: Context Cache - moved to external N8N flows
    // setContext/getContext methods removed - context injection handled externally

    // Precomputed Cache (1 minuto TTL)
    setPrecomputed(key: string, data: any): void {
        this.set(`precomputed:${key}`, data, PRECOMPUTED_CACHE_TTL);
    }

    getPrecomputed(key: string): any {
        return this.get(`precomputed:${key}`);
    }

    /**
     * Métodos de gestión y estadísticas
     */

    getStats(): CacheStats {
        const totalOperations = this.stats.hits + this.stats.misses;
        const hitRate = totalOperations > 0 ? (this.stats.hits / totalOperations) * 100 : 0;
        const uptime = Math.max(1, Date.now() - this.stats.startTime); // Ensure at least 1ms

        return {
            size: this.cache.size,
            maxSize: this.options.maxSize,
            hits: this.stats.hits,
            misses: this.stats.misses,
            sets: this.stats.sets,
            deletes: this.stats.deletes,
            hitRate: Math.round(hitRate * 100) / 100, // 2 decimales
            uptime
        };
    }

    /**
     * Busca claves que coincidan con un patrón
     */
    findKeys(pattern: string): string[] {
        const keys = Array.from(this.cache.keys());
        const regex = new RegExp(pattern.replace('*', '.*'));
        return keys.filter(key => regex.test(key));
    }

    /**
     * Elimina múltiples claves por patrón
     */
    deletePattern(pattern: string): number {
        const keys = this.findKeys(pattern);
        let deleted = 0;
        
        keys.forEach(key => {
            if (this.delete(key)) {
                deleted++;
            }
        });
        
        return deleted;
    }

    /**
     * Verifica si una clave existe
     */
    has(key: string): boolean {
        return this.cache.has(key);
    }

    /**
     * Obtiene información sobre el TTL restante de una clave
     */
    getTtl(key: string): number | undefined {
        return this.cache.getRemainingTTL(key);
    }

    /**
     * Cleanup automático
     */
    private startCleanup(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        this.cleanupInterval = setInterval(() => {
            // lru-cache maneja el cleanup automáticamente
            // Pero podemos hacer limpieza adicional aquí si es necesario
            const sizeBefore = this.cache.size;
            
            // Forzar limpieza de entradas expiradas
            this.cache.purgeStale();
            
            const sizeAfter = this.cache.size;
            const cleaned = sizeBefore - sizeAfter;
            
            if (cleaned > 0) {
                // Solo log si hay limpieza significativa
                console.debug(`Cache cleanup: removed ${cleaned} expired entries`);
            }
        }, this.options.cleanupInterval);
    }

    /**
     * Detener cleanup automático
     */
    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = undefined;
        }
        this.cache.clear();
    }
}