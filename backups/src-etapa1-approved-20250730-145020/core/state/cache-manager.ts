// src/core/state/cache-manager.ts
import { LRUCache } from 'lru-cache';
import { ICacheManager } from '../../shared/interfaces';

export class CacheManager implements ICacheManager {
    private cache: LRUCache<string, any>;

    constructor(maxSize: number = 1000) {
        this.cache = new LRUCache({
            max: maxSize,
        });
    }

    get<T>(key: string): T | undefined {
        return this.cache.get(key) as T | undefined;
    }

    set<T>(key: string, value: T, ttl?: number): void {
        // lru-cache maneja el TTL en milisegundos
        this.cache.set(key, value, { ttl });
    }

    delete(key: string): void {
        this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    size(): number {
        return this.cache.size;
    }
}