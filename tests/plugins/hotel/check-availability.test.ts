// tests/plugins/hotel/check-availability.test.ts

// Mock the Beds24Client BEFORE importing anything else
const mockSearchAvailability = jest.fn();

jest.mock('../../../src/plugins/hotel/services/beds24-client', () => {
    return {
        Beds24Client: jest.fn().mockImplementation(() => {
            return {
                searchAvailability: mockSearchAvailability
            };
        })
    };
});

import { checkAvailability } from '../../../src/plugins/hotel/functions/check-availability';
import { Beds24Client } from '../../../src/plugins/hotel/services/beds24-client';

describe('🏨 Check Availability Function', () => {
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        mockSearchAvailability.mockClear();
    });

    describe('Basic Functionality', () => {
        test('should return formatted availability results', async () => {            
            // Test that the mock is being called
            mockSearchAvailability.mockResolvedValue('Test mock response');
            
            console.log('Mock setup complete');
            console.log('Mock function:', typeof mockSearchAvailability);
            console.log('Beds24Client mock:', typeof Beds24Client);

            try {
                const result = await checkAvailability({
                    startDate: '2025-11-10',
                    endDate: '2025-11-15',
                    guests: 2
                });
                console.log('Result received:', result);
                console.log('Mock was called:', mockSearchAvailability.mock.calls.length, 'times');

                expect(result).toBe('Test mock response');
            } catch (error) {
                console.error('Error in test:', error);
                throw error;
            }
        });

        test('should handle no availability', async () => {
            const noAvailabilityMessage = 'Desafortunadamente, no hay disponibilidad para las fechas solicitadas (10/11/2025 a 15/11/2025). Sugiere al cliente otras fechas o alternativas.';
            mockSearchAvailability.mockResolvedValue(noAvailabilityMessage);

            const result = await checkAvailability({
                startDate: '2025-11-10',
                endDate: '2025-11-15',
                guests: 2
            });

            expect(result).toContain('Desafortunadamente, no hay disponibilidad');
            expect(result).toContain('10/11/2025 a 15/11/2025');
        });

        test('should handle API errors', async () => {
            const errorMessage = 'Error al consultar la API de Beds24. Indica al cliente que hay un problema temporal en el sistema y que con gusto se le ayudará más tarde o por otro canal.';
            mockSearchAvailability.mockResolvedValue(errorMessage);

            const result = await checkAvailability({
                startDate: '2025-11-10',
                endDate: '2025-11-15',
                guests: 2
            });

            expect(result).toContain('Error al consultar la API de Beds24');
        });
    });

    describe('Date Validation', () => {
        test('should reject past dates', async () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const pastDate = yesterday.toISOString().split('T')[0];
            
            const result = await checkAvailability({
                startDate: pastDate,
                endDate: '2025-01-18',
                guests: 1
            });

            expect(result).toContain('Nota interna: Corrige las fechas antes de responder');
            expect(result).toContain('son pasadas');
        });

        test('should handle timezone errors from Beds24', async () => {
            const timezoneErrorMessage = 'Nota interna: Por la hora actual de la consulta (diferencia de zona horaria), el sistema no muestra disponibilidad para hoy. Dile al cliente que si necesita entrar hoy, puede llamar directamente al 3023371476 para asistencia manual.';
            mockSearchAvailability.mockResolvedValue(timezoneErrorMessage);

            const result = await checkAvailability({
                startDate: '2025-11-10',
                endDate: '2025-11-15',
                guests: 1
            });

            expect(result).toContain('diferencia de zona horaria');
            expect(result).toContain('3023371476');
        });

        test('should format dates in DD/MM/YYYY', async () => {
            const mockResponse = `📅 Disponibilidad: 10/11/2025 al 15/11/2025 (5 noches)

✅ APARTAMENTOS DISPONIBLES (1 Apto):
🏠 Habitación 123 - $500,000 total ($100,000/noche)`;
            
            mockSearchAvailability.mockResolvedValue(mockResponse);

            const result = await checkAvailability({
                startDate: '2025-11-10',
                endDate: '2025-11-15',
                guests: 1
            });

            expect(result).toContain('10/11/2025 al 15/11/2025');
            expect(result).toContain('(5 noches)');
        });
    });

    describe('Guest Handling', () => {
        test('should default to 1 guest when not specified', async () => {
            const mockResponse = `📅 Disponibilidad: 10/11/2025 al 15/11/2025 (5 noches)

✅ APARTAMENTOS DISPONIBLES (1 Apto):
🏠 Habitación 123 - $300,000 total ($60,000/noche)`;
            
            mockSearchAvailability.mockResolvedValue(mockResponse);

            await checkAvailability({
                startDate: '2025-11-10',
                endDate: '2025-11-15'
            });

            expect(mockSearchAvailability).toHaveBeenCalledWith({
                arrival: '2025-11-10',
                departure: '2025-11-15',
                numAdults: 1
            });
        });

        test('should use specified guest count', async () => {
            const mockResponse = `📅 Disponibilidad: 10/11/2025 al 15/11/2025 (5 noches)

✅ APARTAMENTOS DISPONIBLES (1 Apto):
🏠 Habitación 456 - $400,000 total ($80,000/noche)`;
            
            mockSearchAvailability.mockResolvedValue(mockResponse);

            await checkAvailability({
                startDate: '2025-11-10',
                endDate: '2025-11-15',
                guests: 4
            });

            expect(mockSearchAvailability).toHaveBeenCalledWith({
                arrival: '2025-11-10',
                departure: '2025-11-15',
                numAdults: 4
            });
        });
    });

    describe('Price Formatting', () => {
        test('should format Colombian peso prices correctly', async () => {
            const mockResponse = `📅 Disponibilidad: 10/11/2025 al 15/11/2025 (5 noches)

✅ APARTAMENTOS DISPONIBLES (2 Aptos):
🏠 Habitación 101 - $150,000 total ($30,000/noche)
🏠 Habitación 102 - $2,500,000 total ($500,000/noche)`;
            
            mockSearchAvailability.mockResolvedValue(mockResponse);

            const result = await checkAvailability({
                startDate: '2025-11-10',
                endDate: '2025-11-15',
                guests: 2
            });

            expect(result).toContain('$150,000 total');
            expect(result).toContain('$2,500,000 total');
        });

        test('should handle zero price', async () => {
            const mockResponse = `📅 Disponibilidad: 10/11/2025 al 15/11/2025 (5 noches)

✅ APARTAMENTOS DISPONIBLES (1 Apto):
🏠 Habitación 999 - $0 total ($0/noche)`;
            
            mockSearchAvailability.mockResolvedValue(mockResponse);

            const result = await checkAvailability({
                startDate: '2025-11-10',
                endDate: '2025-11-15',
                guests: 1
            });

            expect(result).toContain('Habitación 999 - $0 total');
        });
    });

    describe('Error Handling', () => {
        test('should handle unexpected errors gracefully', async () => {
            mockSearchAvailability.mockRejectedValue(new Error('Unexpected API Error'));

            const result = await checkAvailability({
                startDate: '2025-11-10',
                endDate: '2025-11-15',
                guests: 2
            });

            expect(result).toBe('Error inesperado al verificar disponibilidad. Intenta de nuevo.');
        });

        test('should handle network timeouts', async () => {
            mockSearchAvailability.mockRejectedValue(new Error('Network timeout'));

            const result = await checkAvailability({
                startDate: '2025-11-10',
                endDate: '2025-11-15',
                guests: 1
            });

            expect(result).toBe('Error inesperado al verificar disponibilidad. Intenta de nuevo.');
        });
    });

    describe('Integration with Beds24Client', () => {
        test('should initialize Beds24Client with environment variables', async () => {
            const originalEnv = process.env;
            process.env.BEDS24_TOKEN = 'test-token';

            const noAvailabilityMessage = 'Desafortunadamente, no hay disponibilidad para las fechas solicitadas (10/11/2025 a 15/11/2025). Sugiere al cliente otras fechas o alternativas.';
            mockSearchAvailability.mockResolvedValue(noAvailabilityMessage);

            await checkAvailability({
                startDate: '2025-11-10',
                endDate: '2025-11-15',
                guests: 1
            });

            expect(Beds24Client).toHaveBeenCalled();

            process.env = originalEnv;
        });

        test('should pass correct parameters to Beds24Client', async () => {
            const mockResponse = `📅 Disponibilidad: 10/11/2025 al 15/11/2025 (5 noches)

✅ APARTAMENTOS DISPONIBLES (1 Apto):
🏠 Habitación 789 - $400,000 total ($80,000/noche)`;
            
            mockSearchAvailability.mockResolvedValue(mockResponse);

            await checkAvailability({
                startDate: '2025-11-10',
                endDate: '2025-11-15',
                guests: 3
            });

            expect(mockSearchAvailability).toHaveBeenCalledWith({
                arrival: '2025-11-10',
                departure: '2025-11-15',
                numAdults: 3
            });
        });
    });
});