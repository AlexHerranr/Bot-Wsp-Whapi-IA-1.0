// tests/plugins/hotel/check-availability.test.ts
import { checkAvailability } from '../../../src/plugins/hotel/functions/check-availability';

// Mock the Beds24Client
const mockSearchAvailability = jest.fn();
jest.mock('../../../src/plugins/hotel/services/beds24-client', () => ({
    Beds24Client: jest.fn().mockImplementation(() => ({
        searchAvailability: mockSearchAvailability
    }))
}));

import { Beds24Client } from '../../../src/plugins/hotel/services/beds24-client';

describe('🏨 Check Availability Function', () => {
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        mockSearchAvailability.mockClear();
    });

    describe('Basic Functionality', () => {
        test('should return availability results', async () => {
            mockSearchAvailability.mockResolvedValue([
                { name: 'Apartamento Deluxe', totalPrice: 840000, isSplit: false },
                { name: 'Suite Presidencial', totalPrice: 1250000, isSplit: false }
            ]);

            const result = await checkAvailability({
                startDate: '2025-01-15',
                endDate: '2025-01-18',
                guests: 2
            });

            expect(result).toContain('Apartamentos disponibles:');
            expect(result).toContain('Apartamento Deluxe: 840.000 por 3 noches');
            expect(result).toContain('Suite Presidencial: 1.250.000 por 3 noches');
        });

        test('should handle no availability', async () => {
            mockSearchAvailability.mockResolvedValue([]);

            const result = await checkAvailability({
                startDate: '2025-01-15',
                endDate: '2025-01-18',
                guests: 2
            });

            expect(result).toBe('No hay disponibilidad para las fechas solicitadas.');
        });

        test('should handle null availability response', async () => {
            mockSearchAvailability.mockResolvedValue(null);

            const result = await checkAvailability({
                startDate: '2025-01-15',
                endDate: '2025-01-18',
                guests: 2
            });

            expect(result).toBe('No hay disponibilidad para las fechas solicitadas.');
        });
    });

    describe('Date Calculations', () => {
        test('should calculate nights correctly for multi-day stays', async () => {
            mockSearchAvailability.mockResolvedValue([
                { name: 'Test Apartment', totalPrice: 500000, isSplit: false }
            ]);

            const result = await checkAvailability({
                startDate: '2025-01-15',
                endDate: '2025-01-20', // 5 nights
                guests: 1
            });

            expect(result).toContain('por 5 noches');
        });

        test('should handle single night stays', async () => {
            mockSearchAvailability.mockResolvedValue([
                { name: 'Test Apartment', totalPrice: 200000, isSplit: false }
            ]);

            const result = await checkAvailability({
                startDate: '2025-01-15',
                endDate: '2025-01-16', // 1 night
                guests: 1
            });

            expect(result).toContain('por 1 noches');
        });
    });

    describe('Guest Handling', () => {
        test('should default to 1 guest when not specified', async () => {
            mockSearchAvailability.mockResolvedValue([
                { name: 'Test Apartment', totalPrice: 300000, isSplit: false }
            ]);

            await checkAvailability({
                startDate: '2025-01-15',
                endDate: '2025-01-18'
            });

            expect(mockSearchAvailability).toHaveBeenCalledWith({
                arrival: '2025-01-15',
                departure: '2025-01-18',
                numAdults: 1
            });
        });

        test('should use specified guest count', async () => {
            mockSearchAvailability.mockResolvedValue([
                { name: 'Test Apartment', totalPrice: 400000, isSplit: false }
            ]);

            await checkAvailability({
                startDate: '2025-01-15',
                endDate: '2025-01-18',
                guests: 4
            });

            expect(mockSearchAvailability).toHaveBeenCalledWith({
                arrival: '2025-01-15',
                departure: '2025-01-18',
                numAdults: 4
            });
        });
    });

    describe('Price Formatting', () => {
        test('should format Colombian peso prices correctly', async () => {
            mockSearchAvailability.mockResolvedValue([
                { name: 'Economic Room', totalPrice: 150000, isSplit: false },
                { name: 'Luxury Suite', totalPrice: 2500000, isSplit: false }
            ]);

            const result = await checkAvailability({
                startDate: '2025-01-15',
                endDate: '2025-01-18',
                guests: 2
            });

            expect(result).toContain('150.000');
            expect(result).toContain('2.500.000');
        });

        test('should handle zero price', async () => {
            mockSearchAvailability.mockResolvedValue([
                { name: 'Free Apartment', totalPrice: 0, isSplit: false }
            ]);

            const result = await checkAvailability({
                startDate: '2025-01-15',
                endDate: '2025-01-18',
                guests: 1
            });

            expect(result).toContain('Free Apartment: 0 por 3 noches');
        });
    });

    describe('Error Handling', () => {
        test('should handle Beds24 API errors gracefully', async () => {
            mockSearchAvailability.mockRejectedValue(new Error('API Error'));

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            const result = await checkAvailability({
                startDate: '2025-01-15',
                endDate: '2025-01-18',
                guests: 2
            });

            expect(result).toBe('Hubo un error al verificar la disponibilidad. Por favor, intenta de nuevo.');
            expect(consoleSpy).toHaveBeenCalledWith('Error en check_availability:', expect.any(Error));

            consoleSpy.mockRestore();
        });

        test('should handle network timeouts', async () => {
            mockSearchAvailability.mockRejectedValue(new Error('Network timeout'));

            const result = await checkAvailability({
                startDate: '2025-01-15',
                endDate: '2025-01-18',
                guests: 1
            });

            expect(result).toBe('Hubo un error al verificar la disponibilidad. Por favor, intenta de nuevo.');
        });
    });

    describe('Integration with Beds24Client', () => {
        test('should initialize Beds24Client with environment variables', async () => {
            const originalEnv = process.env;
            process.env.BEDS24_API_KEY = 'test-api-key';
            process.env.BEDS24_PROP_KEY = 'test-prop-key';

            mockSearchAvailability.mockResolvedValue([]);

            await checkAvailability({
                startDate: '2025-01-15',
                endDate: '2025-01-18',
                guests: 1
            });

            expect(Beds24Client).toHaveBeenCalledWith('test-api-key', 'test-prop-key');

            process.env = originalEnv;
        });

        test('should pass correct parameters to Beds24Client', async () => {
            mockSearchAvailability.mockResolvedValue([]);

            await checkAvailability({
                startDate: '2025-02-01',
                endDate: '2025-02-05',
                guests: 3
            });

            expect(mockSearchAvailability).toHaveBeenCalledWith({
                arrival: '2025-02-01',
                departure: '2025-02-05',
                numAdults: 3
            });
        });
    });
});