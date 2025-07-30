// tests/unit/cache-manager.test.ts
import { CacheManager, CacheOptions } from '../../src/core/state/cache-manager';

describe('🧪 Cache Manager Unified', () => {
    let cacheManager: CacheManager;

    beforeEach(() => {
        cacheManager = new CacheManager({
            maxSize: 10,
            defaultTtl: 1000, // 1 segundo para tests
            cleanupInterval: 100, // 100ms para tests
            enableMetrics: true
        });
    });

    afterEach(() => {
        cacheManager.destroy();
    });

    describe('Basic Operations', () => {
        test('should store and retrieve values', () => {
            cacheManager.set('test-key', 'test-value');
            expect(cacheManager.get('test-key')).toBe('test-value');
        });

        test('should return undefined for non-existent keys', () => {
            expect(cacheManager.get('non-existent')).toBeUndefined();
        });

        test('should overwrite existing values', () => {
            cacheManager.set('key', 'value1');
            cacheManager.set('key', 'value2');
            expect(cacheManager.get('key')).toBe('value2');
        });

        test('should handle different data types', () => {
            const testData = {
                string: 'test',
                number: 42,
                object: { nested: true },
                array: [1, 2, 3],
                boolean: true,
                null: null
            };

            Object.entries(testData).forEach(([key, value]) => {
                cacheManager.set(key, value);
                expect(cacheManager.get(key)).toEqual(value);
            });
        });

        test('should check if keys exist', () => {
            cacheManager.set('existing-key', 'value');
            
            expect(cacheManager.has('existing-key')).toBe(true);
            expect(cacheManager.has('non-existing-key')).toBe(false);
        });

        test('should delete specific entries', () => {
            cacheManager.set('key1', 'value1');
            cacheManager.set('key2', 'value2');
            
            expect(cacheManager.delete('key1')).toBe(true);
            expect(cacheManager.get('key1')).toBeUndefined();
            expect(cacheManager.get('key2')).toBe('value2');
            expect(cacheManager.delete('non-existent')).toBe(false);
        });

        test('should clear all entries', () => {
            cacheManager.set('key1', 'value1');
            cacheManager.set('key2', 'value2');
            
            cacheManager.clear();
            
            expect(cacheManager.size()).toBe(0);
            expect(cacheManager.get('key1')).toBeUndefined();
            expect(cacheManager.get('key2')).toBeUndefined();
        });

        test('should report correct size', () => {
            expect(cacheManager.size()).toBe(0);
            
            cacheManager.set('key1', 'value1');
            expect(cacheManager.size()).toBe(1);
            
            cacheManager.set('key2', 'value2');
            expect(cacheManager.size()).toBe(2);
            
            cacheManager.delete('key1');
            expect(cacheManager.size()).toBe(1);
        });
    });

    describe('TTL (Time To Live)', () => {
        test('should expire entries after TTL', async () => {
            cacheManager.set('short-lived', 'value', 50); // 50ms TTL
            
            expect(cacheManager.get('short-lived')).toBe('value');
            
            // Wait for expiration
            await new Promise(resolve => setTimeout(resolve, 100));
            
            expect(cacheManager.get('short-lived')).toBeUndefined();
        }, 1000);

        test('should handle entries without TTL using default', async () => {
            cacheManager.set('default-ttl', 'value'); // Uses default TTL (1000ms)
            
            expect(cacheManager.get('default-ttl')).toBe('value');
            
            // Should still exist after short time
            await new Promise(resolve => setTimeout(resolve, 100));
            expect(cacheManager.get('default-ttl')).toBe('value');
        });

        test('should get remaining TTL', () => {
            cacheManager.set('ttl-test', 'value', 1000);
            
            const remainingTtl = cacheManager.getTtl('ttl-test');
            expect(remainingTtl).toBeGreaterThan(0);
            expect(remainingTtl).toBeLessThanOrEqual(1000);
        });
    });

    describe('LRU Eviction', () => {
        test('should respect max size limit', () => {
            // Fill cache to max (10 items)
            for (let i = 0; i < 12; i++) {
                cacheManager.set(`key${i}`, `value${i}`);
            }
            
            // Should not exceed max size
            expect(cacheManager.size()).toBe(10);
            
            // Oldest entries should be evicted (key0, key1)
            expect(cacheManager.get('key0')).toBeUndefined();
            expect(cacheManager.get('key1')).toBeUndefined();
            expect(cacheManager.get('key11')).toBe('value11');
        });

        test('should update access order on get', () => {
            // Fill cache
            for (let i = 0; i < 10; i++) {
                cacheManager.set(`key${i}`, `value${i}`);
            }
            
            // Access key0 to make it recently used
            cacheManager.get('key0');
            
            // Add one more item to trigger eviction
            cacheManager.set('new-key', 'new-value');
            
            // key0 should still exist (recently accessed)
            // key1 should be evicted (least recently used)
            expect(cacheManager.get('key0')).toBe('value0');
            expect(cacheManager.get('key1')).toBeUndefined();
        });
    });

    describe('Specific Cache Types', () => {
        test('should handle chat info cache with correct TTL', () => {
            const chatInfo = { name: 'Test User', phone: '123456789' };
            
            cacheManager.setChatInfo('user123', chatInfo);
            
            expect(cacheManager.getChatInfo('user123')).toEqual(chatInfo);
        });

        test('should handle context cache', () => {
            const context = 'This is a conversation context';
            
            cacheManager.setContext('user123', context);
            
            expect(cacheManager.getContext('user123')).toBe(context);
            expect(cacheManager.getContext('user456')).toBeUndefined();
        });

        test('should handle precomputed cache', () => {
            const precomputedData = { result: 'computed value', timestamp: Date.now() };
            
            cacheManager.setPrecomputed('system_prompt', precomputedData);
            
            expect(cacheManager.getPrecomputed('system_prompt')).toEqual(precomputedData);
        });
    });

    describe('Pattern Operations', () => {
        test('should find keys by pattern', () => {
            cacheManager.set('user:123:profile', 'profile1');
            cacheManager.set('user:456:profile', 'profile2');
            cacheManager.set('user:123:settings', 'settings1');
            cacheManager.set('system:config', 'config');
            
            const userKeys = cacheManager.findKeys('user:*:profile');
            expect(userKeys).toHaveLength(2);
            expect(userKeys).toContain('user:123:profile');
            expect(userKeys).toContain('user:456:profile');
            
            const user123Keys = cacheManager.findKeys('user:123:*');
            expect(user123Keys).toHaveLength(2);
            expect(user123Keys).toContain('user:123:profile');
            expect(user123Keys).toContain('user:123:settings');
        });

        test('should delete keys by pattern', () => {
            cacheManager.set('temp:file1', 'data1');
            cacheManager.set('temp:file2', 'data2');
            cacheManager.set('permanent:file', 'data3');
            
            const deleted = cacheManager.deletePattern('temp:*');
            
            expect(deleted).toBe(2);
            expect(cacheManager.get('temp:file1')).toBeUndefined();
            expect(cacheManager.get('temp:file2')).toBeUndefined();
            expect(cacheManager.get('permanent:file')).toBe('data3');
        });
    });

    describe('Metrics and Statistics', () => {
        test('should collect hit/miss statistics', () => {
            // Generate some cache operations
            cacheManager.set('key1', 'value1');
            cacheManager.set('key2', 'value2');
            
            // Hits
            cacheManager.get('key1');
            cacheManager.get('key2');
            cacheManager.get('key1'); // Another hit
            
            // Misses
            cacheManager.get('non-existent1');
            cacheManager.get('non-existent2');
            
            const stats = cacheManager.getStats();
            
            expect(stats.hits).toBe(3);
            expect(stats.misses).toBe(2);
            expect(stats.sets).toBe(2);
            expect(stats.size).toBe(2);
            expect(stats.maxSize).toBe(10);
            expect(stats.hitRate).toBe(60); // 3/5 * 100
            expect(stats.uptime).toBeGreaterThan(0);
        });

        test('should track delete operations', () => {
            cacheManager.set('key1', 'value1');
            cacheManager.set('key2', 'value2');
            
            cacheManager.delete('key1');
            cacheManager.delete('non-existent'); // Should not count
            
            const stats = cacheManager.getStats();
            expect(stats.deletes).toBe(1);
        });

        test('should reset stats on clear', () => {
            cacheManager.set('key1', 'value1');
            cacheManager.get('key1');
            cacheManager.get('non-existent');
            
            let stats = cacheManager.getStats();
            expect(stats.hits).toBe(1);
            expect(stats.misses).toBe(1);
            expect(stats.sets).toBe(1);
            
            cacheManager.clear();
            
            stats = cacheManager.getStats();
            expect(stats.hits).toBe(0);
            expect(stats.misses).toBe(0);
            expect(stats.sets).toBe(0);
            expect(stats.deletes).toBe(0);
        });
    });

    describe('Options and Configuration', () => {
        test('should work with default options', () => {
            const defaultCache = new CacheManager();
            
            defaultCache.set('test', 'value');
            expect(defaultCache.get('test')).toBe('value');
            expect(defaultCache.getStats().maxSize).toBe(1000); // DEFAULT_CACHE_SIZE
            
            defaultCache.destroy();
        });

        test('should disable metrics when configured', () => {
            const noMetricsCache = new CacheManager({ enableMetrics: false });
            
            noMetricsCache.set('key', 'value');
            noMetricsCache.get('key');
            noMetricsCache.get('non-existent');
            
            const stats = noMetricsCache.getStats();
            expect(stats.hits).toBe(0);
            expect(stats.misses).toBe(0);
            expect(stats.sets).toBe(0);
            
            noMetricsCache.destroy();
        });
    });

    describe('Cleanup and Destroy', () => {
        test('should auto-cleanup expired entries', async () => {
            const fastCleanupCache = new CacheManager({
                maxSize: 10,
                cleanupInterval: 50 // Very fast cleanup for testing
            });
            
            fastCleanupCache.set('short-lived', 'value', 25); // 25ms TTL
            
            expect(fastCleanupCache.get('short-lived')).toBe('value');
            
            // Wait for expiration and cleanup
            await new Promise(resolve => setTimeout(resolve, 100));
            
            expect(fastCleanupCache.size()).toBe(0);
            
            fastCleanupCache.destroy();
        }, 1000);

        test('should destroy properly', () => {
            cacheManager.set('key', 'value');
            expect(cacheManager.size()).toBe(1);
            
            cacheManager.destroy();
            expect(cacheManager.size()).toBe(0);
        });
    });
});