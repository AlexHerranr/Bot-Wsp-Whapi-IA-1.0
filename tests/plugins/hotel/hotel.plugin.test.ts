// tests/plugins/hotel/hotel.plugin.test.ts
import { HotelPlugin } from '../../../src/plugins/hotel/hotel.plugin';
import { TempFunctionRegistry } from '../../../src/functions/registry/temp-function-registry';

describe('🏨 Hotel Plugin', () => {
    let hotelPlugin: HotelPlugin;
    let functionRegistry: TempFunctionRegistry;

    beforeEach(() => {
        hotelPlugin = new HotelPlugin();
        functionRegistry = new TempFunctionRegistry();
    });

    describe('Plugin Initialization', () => {
        test('should initialize all components correctly', () => {
            expect(hotelPlugin.context).toBeDefined();
            expect(hotelPlugin.validation).toBeDefined();
            expect(hotelPlugin.labels).toBeDefined();
        });

        test('should register functions in registry', () => {
            hotelPlugin.register(functionRegistry);
            
            expect(functionRegistry.has('check_availability')).toBe(true);
            expect(functionRegistry.list()).toContain('check_availability');
        });
    });

    describe('Function Registration', () => {
        beforeEach(() => {
            hotelPlugin.register(functionRegistry);
        });

        test('should execute check_availability function', async () => {
            const result = await functionRegistry.execute('check_availability', {
                startDate: '2025-01-15',
                endDate: '2025-01-18',
                guests: 2
            });
            
            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
        });

        test('should handle function execution errors gracefully', async () => {
            await expect(
                functionRegistry.execute('non_existent_function', {})
            ).rejects.toThrow('Function non_existent_function not found');
        });
    });

    describe('Integration Points', () => {
        test('should provide all required interfaces', () => {
            expect(typeof hotelPlugin.context.getRelevantContext).toBe('function');
            expect(typeof hotelPlugin.context.needsRefresh).toBe('function');
            expect(typeof hotelPlugin.validation.isQuoteOrPriceMessage).toBe('function');
            expect(typeof hotelPlugin.validation.validateAndCorrectResponse).toBe('function');
            expect(typeof hotelPlugin.labels.getAvailableLabels).toBe('function');
            expect(typeof hotelPlugin.labels.isHotelLabel).toBe('function');
        });

        test('should maintain consistent hotel labels', () => {
            const expectedLabels = [
                'Potencial', 'Consulta', 'Reservado', 'VIP', 
                'Check-in', 'Check-out', 'Cancelado', 'Repetidor'
            ];
            
            const availableLabels = hotelPlugin.labels.getAvailableLabels();
            expect(availableLabels).toEqual(expectedLabels);
            
            expectedLabels.forEach(label => {
                expect(hotelPlugin.labels.isHotelLabel(label)).toBe(true);
            });
        });
    });
});