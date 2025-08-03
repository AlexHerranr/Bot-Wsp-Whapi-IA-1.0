// tests/regression/cache-ttl.test.ts
import { CacheManager } from '../../src/core/state/cache-manager';

describe('Cache TTL Regression Tests', () => {
    let cacheManager: CacheManager;

    beforeEach(() => {
        // Usar timers reales porque lru-cache no funciona bien con fake timers
        cacheManager = new CacheManager({ maxSize: 100 }); // 100 items max
    });

    test('should expire cache entries after specified TTL', async () => {
        const SHORT_TTL = 100; // 100ms para test rápido
        
        // Guardar en cache con TTL corto
        cacheManager.set('test_key', { data: 'test_value' }, SHORT_TTL);
        
        // Debe estar disponible inmediatamente
        expect(cacheManager.get('test_key')).toEqual({ data: 'test_value' });
        
        // Esperar un poco menos del TTL - debe seguir disponible
        await new Promise(resolve => setTimeout(resolve, SHORT_TTL - 20));
        expect(cacheManager.get('test_key')).toEqual({ data: 'test_value' });
        
        // Esperar hasta que expire (tiempo adicional para LRU-cache)
        await new Promise(resolve => setTimeout(resolve, 80));
        expect(cacheManager.get('test_key')).toBeUndefined();
    }, 500);

    test('should handle different TTL values correctly', async () => {
        const SHORT_TTL = 50;   // 50ms
        const MEDIUM_TTL = 150; // 150ms
        
        // Guardar con diferentes TTLs
        cacheManager.set('short_lived', 'data1', SHORT_TTL);
        cacheManager.set('medium_lived', 'data2', MEDIUM_TTL);
        
        // Ambos deben estar disponibles inicialmente
        expect(cacheManager.get('short_lived')).toBe('data1');
        expect(cacheManager.get('medium_lived')).toBe('data2');
        
        // Esperar hasta que el primero expire
        await new Promise(resolve => setTimeout(resolve, SHORT_TTL + 10));
        expect(cacheManager.get('short_lived')).toBeUndefined();
        expect(cacheManager.get('medium_lived')).toBe('data2');
        
        // Esperar hasta que el segundo expire (tiempo adicional para LRU-cache)
        await new Promise(resolve => setTimeout(resolve, MEDIUM_TTL - SHORT_TTL + 50));
        expect(cacheManager.get('medium_lived')).toBeUndefined();
    }, 1000);

    test('should store items without TTL (permanent until evicted)', () => {
        // Guardar sin TTL
        cacheManager.set('permanent_key', 'permanent_value');
        
        // Debe estar disponible
        expect(cacheManager.get('permanent_key')).toBe('permanent_value');
        
        // No debe expirar por tiempo
        expect(cacheManager.get('permanent_key')).toBe('permanent_value');
    });
});