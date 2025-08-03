// tests/integration/ensamblaje/di-container.test.ts
import 'reflect-metadata';
import { container } from 'tsyringe';
import { FunctionRegistryService } from '../../../src/core/services/function-registry.service';
import { HotelPlugin } from '../../../src/plugins/hotel/hotel.plugin';
import { IFunctionRegistry } from '../../../src/shared/interfaces';

describe('🔧 Dependency Injection Container Tests', () => {
    beforeEach(() => {
        container.clearInstances();
    });

    afterEach(() => {
        container.clearInstances();
    });

    describe('Container Registration', () => {
        test('should register and resolve FunctionRegistryService', () => {
            const registry = new FunctionRegistryService();
            container.registerInstance('FunctionRegistry', registry);

            const resolved = container.resolve('FunctionRegistry');
            expect(resolved).toBe(registry);
            expect(resolved).toBeInstanceOf(FunctionRegistryService);
        });

        test('should maintain singleton behavior', () => {
            const registry = new FunctionRegistryService();
            container.registerInstance('FunctionRegistry', registry);

            const resolved1 = container.resolve('FunctionRegistry');
            const resolved2 = container.resolve('FunctionRegistry');
            
            expect(resolved1).toBe(resolved2);
        });

        test('should handle multiple registrations', () => {
            const registry = new FunctionRegistryService();
            const hotelPlugin = new HotelPlugin();
            
            container.registerInstance('FunctionRegistry', registry);
            container.registerInstance('HotelPlugin', hotelPlugin);

            const resolvedRegistry = container.resolve('FunctionRegistry');
            const resolvedPlugin = container.resolve('HotelPlugin');

            expect(resolvedRegistry).toBe(registry);
            expect(resolvedPlugin).toBe(hotelPlugin);
        });
    });

    describe('Service Integration', () => {
        test('should integrate services through DI', () => {
            const registry = new FunctionRegistryService();
            const hotelPlugin = new HotelPlugin();
            
            container.registerInstance('FunctionRegistry', registry);
            
            // Register plugin functions
            hotelPlugin.register(registry, 'test-source');
            
            expect(registry.has('check_availability')).toBe(true);
            expect(registry.list()).toContain('check_availability');
        });

        test('should maintain service state across injections', () => {
            const registry = new FunctionRegistryService();
            container.registerInstance('FunctionRegistry', registry);
            
            // Register a test function
            registry.register('test_function', async () => 'test result', 'test');
            
            const resolved = container.resolve('FunctionRegistry') as FunctionRegistryService;
            expect(resolved.has('test_function')).toBe(true);
            expect(resolved.list()).toContain('test_function');
        });

        test('should execute functions through injected services', async () => {
            const registry = new FunctionRegistryService();
            const hotelPlugin = new HotelPlugin();
            
            container.registerInstance('FunctionRegistry', registry);
            hotelPlugin.register(registry, 'di-test');
            
            const resolved = container.resolve('FunctionRegistry') as IFunctionRegistry;
            const result = await resolved.execute('check_availability', {
                startDate: '2025-08-01',
                endDate: '2025-08-05',
                guests: 2
            });
            
            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
        });
    });

    describe('Container Lifecycle', () => {
        test('should clear instances correctly', () => {
            const registry = new FunctionRegistryService();
            container.registerInstance('FunctionRegistry', registry);
            
            expect(container.resolve('FunctionRegistry')).toBe(registry);
            
            container.clearInstances();
            
            // After clearing, should get a new instance
            const newRegistry = new FunctionRegistryService();
            container.registerInstance('FunctionRegistry', newRegistry);
            
            expect(container.resolve('FunctionRegistry')).toBe(newRegistry);
            expect(container.resolve('FunctionRegistry')).not.toBe(registry);
        });

        test('should handle container state isolation', () => {
            // Test 1: Register in one context
            const registry1 = new FunctionRegistryService();
            registry1.register('test1', async () => 'result1');
            container.registerInstance('FunctionRegistry', registry1);
            
            expect((container.resolve('FunctionRegistry') as IFunctionRegistry).has('test1')).toBe(true);
            
            // Clear and test isolation
            container.clearInstances();
            
            // Test 2: Register in new context
            const registry2 = new FunctionRegistryService();
            registry2.register('test2', async () => 'result2');
            container.registerInstance('FunctionRegistry', registry2);
            
            const resolved = container.resolve('FunctionRegistry') as IFunctionRegistry;
            expect(resolved.has('test2')).toBe(true);
            expect(resolved.has('test1')).toBe(false); // Should not have test1
        });
    });

    describe('Error Handling', () => {
        test('should handle unregistered dependencies gracefully', () => {
            expect(() => {
                container.resolve('NonExistentService');
            }).toThrow();
        });

        test('should handle registration errors', () => {
            // Try to register with invalid type
            expect(() => {
                container.registerInstance('TestInvalidService', null as any);
            }).not.toThrow(); // tsyringe allows null registration
            
            const resolved = container.resolve('TestInvalidService');
            expect(resolved).toBeNull();
        });

        test('should maintain container stability after errors', () => {
            // Register valid service
            const registry = new FunctionRegistryService();
            container.registerInstance('FunctionRegistry', registry);
            
            // Try to resolve invalid service (should throw)
            try {
                container.resolve('InvalidService');
            } catch (error) {
                // Expected error
            }
            
            // Original service should still be accessible
            const resolved = container.resolve('FunctionRegistry');
            expect(resolved).toBe(registry);
        });
    });

    describe('Performance and Memory', () => {
        test('should handle multiple registrations efficiently', () => {
            const startTime = Date.now();
            
            // Register multiple services
            for (let i = 0; i < 100; i++) {
                const registry = new FunctionRegistryService();
                container.registerInstance(`Service${i}`, registry);
            }
            
            const registrationTime = Date.now() - startTime;
            expect(registrationTime).toBeLessThan(1000); // Should complete within 1 second
            
            // Verify services are accessible
            const resolved = container.resolve('Service50');
            expect(resolved).toBeInstanceOf(FunctionRegistryService);
        });
    });
});