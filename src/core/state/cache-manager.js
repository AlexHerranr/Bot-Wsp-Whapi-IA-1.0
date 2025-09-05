"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheManager = void 0;
// src/core/state/cache-manager.ts
const lru_cache_1 = require("lru-cache");
const constants_1 = require("../utils/constants");
class CacheManager {
    constructor(options = {}) {
        this.options = {
            maxSize: options.maxSize ?? constants_1.DEFAULT_CACHE_SIZE,
            defaultTtl: options.defaultTtl ?? constants_1.CHAT_INFO_CACHE_TTL, // 5 minutos por defecto
            cleanupInterval: options.cleanupInterval ?? constants_1.CLEANUP_INTERVAL,
            enableMetrics: options.enableMetrics ?? true
        };
        this.cache = new lru_cache_1.LRUCache({
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
    get(key) {
        const value = this.cache.get(key);
        if (this.options.enableMetrics) {
            if (value !== undefined) {
                this.stats.hits++;
            }
            else {
                this.stats.misses++;
            }
        }
        return value;
    }
    set(key, value, ttl) {
        // TTL en milisegundos, usa default si no se especifica
        const finalTtl = ttl ?? this.options.defaultTtl;
        this.cache.set(key, value, { ttl: finalTtl });
        if (this.options.enableMetrics) {
            this.stats.sets++;
        }
    }
    delete(key) {
        const deleted = this.cache.delete(key);
        if (this.options.enableMetrics && deleted) {
            this.stats.deletes++;
        }
        return deleted;
    }
    clear() {
        this.cache.clear();
        if (this.options.enableMetrics) {
            // Reset stats except start time
            this.stats.hits = 0;
            this.stats.misses = 0;
            this.stats.sets = 0;
            this.stats.deletes = 0;
        }
    }
    size() {
        return this.cache.size;
    }
    /**
     * Métodos específicos para diferentes tipos de cache
     */
    // Chat Info Cache (5 minutos TTL)
    setChatInfo(userId, chatInfo) {
        this.set(`chat_info:${userId}`, chatInfo, constants_1.CHAT_INFO_CACHE_TTL);
    }
    getChatInfo(userId) {
        return this.get(`chat_info:${userId}`);
    }
    // ELIMINADO: Context Cache - moved to external N8N flows
    // setContext/getContext methods removed - context injection handled externally
    // Precomputed Cache (1 minuto TTL)
    setPrecomputed(key, data) {
        this.set(`precomputed:${key}`, data, constants_1.PRECOMPUTED_CACHE_TTL);
    }
    getPrecomputed(key) {
        return this.get(`precomputed:${key}`);
    }
    /**
     * Métodos de gestión y estadísticas
     */
    getStats() {
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
    findKeys(pattern) {
        const keys = Array.from(this.cache.keys());
        const regex = new RegExp(pattern.replace('*', '.*'));
        return keys.filter(key => regex.test(key));
    }
    /**
     * Elimina múltiples claves por patrón
     */
    deletePattern(pattern) {
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
    has(key) {
        return this.cache.has(key);
    }
    /**
     * Obtiene información sobre el TTL restante de una clave
     */
    getTtl(key) {
        return this.cache.getRemainingTTL(key);
    }
    /**
     * Cleanup automático
     */
    startCleanup() {
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
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = undefined;
        }
        this.cache.clear();
    }
}
exports.CacheManager = CacheManager;
