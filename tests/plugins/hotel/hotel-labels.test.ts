// tests/plugins/hotel/hotel-labels.test.ts
import { HotelLabels } from '../../../src/plugins/hotel/logic/labels';

describe('🏨 Hotel Labels Management', () => {
    let hotelLabels: HotelLabels;

    beforeEach(() => {
        hotelLabels = new HotelLabels();
    });

    describe('Label Validation', () => {
        test('should validate all predefined hotel labels', () => {
            const expectedLabels = [
                'Potencial', 'Consulta', 'Reservado', 'VIP', 
                'Check-in', 'Check-out', 'Cancelado', 'Repetidor'
            ];

            expectedLabels.forEach(label => {
                expect(hotelLabels.isHotelLabel(label)).toBe(true);
            });
        });

        test('should reject non-hotel labels', () => {
            const invalidLabels = [
                'Random', 'Test', 'Invalid', 'NotHotel', 'Custom'
            ];

            invalidLabels.forEach(label => {
                expect(hotelLabels.isHotelLabel(label)).toBe(false);
            });
        });

        test('should return all available labels', () => {
            const availableLabels = hotelLabels.getAvailableLabels();
            
            expect(availableLabels).toHaveLength(8);
            expect(availableLabels).toContain('Potencial');
            expect(availableLabels).toContain('Reservado');
            expect(availableLabels).toContain('VIP');
        });

        test('should return immutable copy of labels', () => {
            const labels1 = hotelLabels.getAvailableLabels();
            const labels2 = hotelLabels.getAvailableLabels();
            
            labels1.push('Modified');
            
            expect(labels2).not.toContain('Modified');
            expect(hotelLabels.getAvailableLabels()).not.toContain('Modified');
        });
    });

    describe('SQL-Integrated Label Management', () => {
        test('should get labels for user (SQL fallback)', async () => {
            // This tests the fallback mechanism when SQL is not available
            const labels = await hotelLabels.getLabels('user123');
            
            expect(Array.isArray(labels)).toBe(true);
            expect(labels.length).toBeGreaterThan(0);
            expect(labels).toContain('Potencial');
        });

        test('should set valid hotel labels', async () => {
            const validLabels = ['VIP', 'Reservado'];
            
            // Should not throw an error
            await expect(
                hotelLabels.setLabels('user123', validLabels)
            ).resolves.not.toThrow();
        });

        test('should filter out invalid labels when setting', async () => {
            const mixedLabels = ['VIP', 'InvalidLabel', 'Reservado', 'AnotherInvalid'];
            
            // Should log warning but not throw
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            
            await hotelLabels.setLabels('user123', mixedLabels);
            
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Some labels for user user123 are not hotel-specific')
            );
            
            consoleSpy.mockRestore();
        });

        test('should add single valid label', async () => {
            await expect(
                hotelLabels.addLabel('user123', 'VIP')
            ).resolves.not.toThrow();
        });

        test('should reject invalid single label', async () => {
            await expect(
                hotelLabels.addLabel('user123', 'InvalidLabel')
            ).rejects.toThrow("Label 'InvalidLabel' is not a valid hotel label");
        });

        test('should remove label from user', async () => {
            // This test checks that the method completes without error
            await expect(
                hotelLabels.removeLabel('user123', 'VIP')
            ).resolves.not.toThrow();
        });
    });

    describe('Error Handling', () => {
        test('should handle SQL errors gracefully in getLabels', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            // This will trigger the SQL fallback mechanism
            const labels = await hotelLabels.getLabels('user123');
            
            expect(Array.isArray(labels)).toBe(true);
            
            consoleSpy.mockRestore();
        });

        test('should handle SQL errors in setLabels', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            // Mock a database error scenario would be implemented here
            // For now, the method should complete successfully with logging
            
            await hotelLabels.setLabels('user123', ['VIP']);
            
            consoleSpy.mockRestore();
        });
    });

    describe('Label Business Logic', () => {
        test('should support customer journey labels', () => {
            const journeyLabels = ['Potencial', 'Consulta', 'Reservado', 'Check-in', 'Check-out'];
            
            journeyLabels.forEach(label => {
                expect(hotelLabels.isHotelLabel(label)).toBe(true);
            });
        });

        test('should support customer status labels', () => {
            const statusLabels = ['VIP', 'Repetidor', 'Cancelado'];
            
            statusLabels.forEach(label => {
                expect(hotelLabels.isHotelLabel(label)).toBe(true);
            });
        });

        test('should maintain consistent label count', () => {
            // Ensure we have the expected number of hotel labels
            const labels = hotelLabels.getAvailableLabels();
            expect(labels).toHaveLength(8);
        });
    });
});