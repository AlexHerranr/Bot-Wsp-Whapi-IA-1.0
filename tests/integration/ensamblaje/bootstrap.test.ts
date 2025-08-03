// tests/integration/ensamblaje/bootstrap.test.ts
import 'reflect-metadata';
import { container } from 'tsyringe';
import { loadConfig, setupDependencyInjection } from '../../../src/main';
import { FunctionRegistryService } from '../../../src/core/services/function-registry.service';
import { HotelPlugin } from '../../../src/plugins/hotel/hotel.plugin';

describe('🚀 Bootstrap Integration Tests', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        // Backup original environment
        originalEnv = { ...process.env };
        
        // Set required environment variables
        process.env.OPENAI_API_KEY = 'test-openai-key';
        process.env.WHAPI_TOKEN = 'test-whapi-token';
        process.env.PORT = '3008';
        process.env.HOST = '127.0.0.1';
        
        // Clear container
        container.clearInstances();
    });

    afterEach(() => {
        // Restore original environment
        process.env = originalEnv;
        
        // Clear container
        container.clearInstances();
    });

    describe('Configuration Loading', () => {
        test('should load configuration successfully with valid environment', () => {
            const config = loadConfig();

            expect(config).toBeDefined();
            expect(config.port).toBe(3008);
            expect(config.host).toBe('127.0.0.1');
            expect(config.secrets.OPENAI_API_KEY).toBe('test-openai-key');
            expect(config.secrets.WHAPI_TOKEN).toBe('test-whapi-token');
        });

        test('should use default values for optional environment variables', () => {
            delete process.env.PORT;
            delete process.env.HOST;
            
            const config = loadConfig();

            expect(config.port).toBe(3008); // Default PORT
            expect(config.host).toBe('0.0.0.0'); // Default HOST
        });

        test('should throw error when critical environment variables are missing', () => {
            delete process.env.OPENAI_API_KEY;
            
            const exitSpy = jest.spyOn(process, 'exit').mockImplementation();
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            loadConfig();

            expect(exitSpy).toHaveBeenCalledWith(1);
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Missing critical environment variables: OPENAI_API_KEY')
            );

            exitSpy.mockRestore();
            consoleSpy.mockRestore();
        });
    });

    describe('Dependency Injection Setup', () => {
        test('should setup DI container correctly', () => {
            const result = setupDependencyInjection();

            expect(result).toBeDefined();
            expect(result.functionRegistry).toBeInstanceOf(FunctionRegistryService);
            expect(result.hotelPlugin).toBeInstanceOf(HotelPlugin);
        });

        test('should register function registry in container', () => {
            setupDependencyInjection();

            const registry = container.resolve('FunctionRegistry');
            expect(registry).toBeInstanceOf(FunctionRegistryService);
        });

        test('should register hotel plugin functions', () => {
            const { functionRegistry } = setupDependencyInjection();

            expect(functionRegistry.has('check_availability')).toBe(true);
            expect(functionRegistry.list()).toContain('check_availability');
        });

        test('should track function registration history', () => {
            const { functionRegistry } = setupDependencyInjection();

            const history = functionRegistry.getRegistrationHistory();
            expect(history.length).toBeGreaterThan(0);
            
            const hotelRegistration = history.find(h => h.source === 'hotel-plugin');
            expect(hotelRegistration).toBeDefined();
            expect(hotelRegistration?.name).toBe('check_availability');
        });
    });

    describe('Function Registry Integration', () => {
        test('should execute hotel plugin functions correctly', async () => {
            const { functionRegistry } = setupDependencyInjection();

            const result = await functionRegistry.execute('check_availability', {
                startDate: '2025-08-01',
                endDate: '2025-08-05',
                guests: 2
            });

            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
            expect(result).toContain('Apartamentos disponibles');
        });

        test('should provide function registry stats', () => {
            const { functionRegistry } = setupDependencyInjection();

            const stats = functionRegistry.getStats();
            expect(stats.totalFunctions).toBeGreaterThan(0);
            expect(stats.availableFunctions).toContain('check_availability');
            expect(stats.registrationHistory).toBeGreaterThan(0);
        });

        test('should handle function execution errors gracefully', async () => {
            const { functionRegistry } = setupDependencyInjection();

            await expect(
                functionRegistry.execute('non_existent_function', {})
            ).rejects.toThrow('Function \'non_existent_function\' not found');
        });
    });

    describe('Plugin Integration', () => {
        test('should integrate hotel plugin with all components', () => {
            const { hotelPlugin } = setupDependencyInjection();

            expect(hotelPlugin.context).toBeDefined();
            expect(hotelPlugin.validation).toBeDefined();
            expect(hotelPlugin.labels).toBeDefined();
        });

        test('should validate hotel-specific functionality', async () => {
            const { hotelPlugin } = setupDependencyInjection();

            // Test context generation
            const context = await hotelPlugin.context.getRelevantContext(
                'test-user',
                { name: 'Test User' },
                { name: 'Test User', labels: [] }
            );

            expect(context).toContain('TeAlquilamos');
            expect(context).toContain('Hotel boutique en Cartagena');

            // Test validation
            const isQuote = hotelPlugin.validation.isQuoteOrPriceMessage('$840.000 por 3 noches');
            expect(isQuote).toBe(true);

            // Test labels
            const availableLabels = hotelPlugin.labels.getAvailableLabels();
            expect(availableLabels).toContain('Potencial');
            expect(availableLabels).toContain('Reservado');
        });
    });
});