// tests/core/state/cache-manager.test.ts
import { CacheManager } from '../../../src/core/state/cache-manager';

describe('CacheManager', () => {
    let cacheManager: CacheManager;

    beforeEach(() => {
        cacheManager = new CacheManager({ maxSize: 10 }); // Small cache for testing
    });

    describe('Basic Operations', () => {
        it('should store and retrieve values', () => {
            cacheManager.set('key1', 'value1');
            expect(cacheManager.get('key1')).toBe('value1');
        });

        it('should return undefined for non-existent keys', () => {
            expect(cacheManager.get('nonexistent')).toBeUndefined();
        });

        it('should overwrite existing values', () => {
            cacheManager.set('key1', 'value1');
            cacheManager.set('key1', 'value2');
            expect(cacheManager.get('key1')).toBe('value2');
        });

        it('should handle different data types', () => {
            const obj = { name: 'test', value: 123 };
            const arr = [1, 2, 3];
            
            cacheManager.set('obj', obj);
            cacheManager.set('arr', arr);
            cacheManager.set('num', 42);
            cacheManager.set('bool', true);
            
            expect(cacheManager.get('obj')).toEqual(obj);
            expect(cacheManager.get('arr')).toEqual(arr);
            expect(cacheManager.get('num')).toBe(42);
            expect(cacheManager.get('bool')).toBe(true);
        });
    });

    describe('TTL (Time To Live)', () => {
        it('should expire entries after TTL', async () => {
            cacheManager.set('temp', 'value', 100); // 100ms TTL
            
            expect(cacheManager.get('temp')).toBe('value');
            
            // Wait for expiration
            await new Promise(resolve => setTimeout(resolve, 150));
            
            expect(cacheManager.get('temp')).toBeUndefined();
        });

        it('should handle entries without TTL', () => {
            cacheManager.set('permanent', 'value');
            expect(cacheManager.get('permanent')).toBe('value');
        });
    });

    describe('Cache Management', () => {
        it('should delete specific entries', () => {
            cacheManager.set('key1', 'value1');
            cacheManager.set('key2', 'value2');
            
            cacheManager.delete('key1');
            
            expect(cacheManager.get('key1')).toBeUndefined();
            expect(cacheManager.get('key2')).toBe('value2');
        });

        it('should clear all entries', () => {
            cacheManager.set('key1', 'value1');
            cacheManager.set('key2', 'value2');
            cacheManager.set('key3', 'value3');
            
            cacheManager.clear();
            
            expect(cacheManager.get('key1')).toBeUndefined();
            expect(cacheManager.get('key2')).toBeUndefined();
            expect(cacheManager.get('key3')).toBeUndefined();
            expect(cacheManager.size()).toBe(0);
        });

        it('should report correct size', () => {
            expect(cacheManager.size()).toBe(0);
            
            cacheManager.set('key1', 'value1');
            expect(cacheManager.size()).toBe(1);
            
            cacheManager.set('key2', 'value2');
            expect(cacheManager.size()).toBe(2);
            
            cacheManager.delete('key1');
            expect(cacheManager.size()).toBe(1);
        });

        it('should respect max size limit', () => {
            // Cache was initialized with max size of 10
            for (let i = 0; i < 15; i++) {
                cacheManager.set(`key${i}`, `value${i}`);
            }
            
            // Should not exceed max size
            expect(cacheManager.size()).toBeLessThanOrEqual(10);
            
            // Oldest entries should be evicted
            expect(cacheManager.get('key0')).toBeUndefined();
            expect(cacheManager.get('key14')).toBeDefined();
        });
    });
});