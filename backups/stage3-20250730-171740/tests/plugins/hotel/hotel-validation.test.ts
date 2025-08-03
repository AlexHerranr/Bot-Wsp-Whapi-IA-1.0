// tests/plugins/hotel/hotel-validation.test.ts
import { HotelValidation } from '../../../src/plugins/hotel/logic/validation';

describe('🏨 Hotel Validation', () => {
    let hotelValidation: HotelValidation;

    beforeEach(() => {
        hotelValidation = new HotelValidation();
    });

    describe('Price and Quote Message Detection', () => {
        test('should detect Colombian peso prices', () => {
            const messages = [
                '$840.000 por 3 noches',
                'El precio es $210,000 COP',
                'Cuesta 150000 pesos',
                '$1.250.000',
                '840000 COP'
            ];

            messages.forEach(message => {
                expect(hotelValidation.isQuoteOrPriceMessage(message)).toBe(true);
            });
        });

        test('should detect night references', () => {
            const messages = [
                'Disponible para 4 noches',
                'El apartamento por 2 noche',
                'Reserva de 7 noches'
            ];

            messages.forEach(message => {
                expect(hotelValidation.isQuoteOrPriceMessage(message)).toBe(true);
            });
        });

        test('should detect URLs and WhatsApp links', () => {
            const messages = [
                'Ver en https://example.com/apartment',
                'Enlace: http://tealquilamos.com',
                'WhatsApp: wa.me/p/123456'
            ];

            messages.forEach(message => {
                expect(hotelValidation.isQuoteOrPriceMessage(message)).toBe(true);
            });
        });

        test('should not detect regular messages as quotes', () => {
            const messages = [
                'Hola, ¿cómo está?',
                'Tengo una consulta',
                'Muchas gracias',
                'Perfecto, nos vemos'
            ];

            messages.forEach(message => {
                expect(hotelValidation.isQuoteOrPriceMessage(message)).toBe(false);
            });
        });
    });

    describe('Apartment Name Extraction', () => {
        test('should extract Colombian apartment names', () => {
            const text = 'Apartamento 715-A y Apartaestudio 814-B están disponibles';
            const apartments = hotelValidation.extractApartmentNames(text);
            
            expect(apartments).toEqual(['715-A', '814-B']);
        });

        test('should handle abbreviated formats', () => {
            const text = 'Apto. 1317-C y Apto 2005-A';
            const apartments = hotelValidation.extractApartmentNames(text);
            
            expect(apartments).toEqual(['1317-C', '2005-A']);
        });

        test('should return empty array for no matches', () => {
            const text = 'No hay apartamentos mencionados aquí';
            const apartments = hotelValidation.extractApartmentNames(text);
            
            expect(apartments).toEqual([]);
        });
    });

    describe('Price Extraction', () => {
        test('should extract Colombian peso prices', () => {
            const text = 'El precio es $840.000 por noche, total $2.520.000 COP';
            const prices = hotelValidation.extractPrices(text);
            
            expect(prices).toEqual(expect.arrayContaining(['$840.000']));
            expect(prices).toEqual(expect.arrayContaining(['$2.520.000 COP']));
        });

        test('should handle various price formats', () => {
            const text = '$210,000 y $1,250,000 son las opciones';
            const prices = hotelValidation.extractPrices(text);
            
            expect(prices).toEqual(['$210,000', '$1,250,000']);
        });

        test('should return empty array for no prices', () => {
            const text = 'No hay precios en este mensaje';
            const prices = hotelValidation.extractPrices(text);
            
            expect(prices).toEqual([]);
        });
    });

    describe('Response Validation and Correction', () => {
        test('should validate response without tool outputs', () => {
            const result = hotelValidation.validateAndCorrectResponse(
                'Respuesta simple del hotel',
                []
            );

            expect(result.correctedResponse).toBe('Respuesta simple del hotel');
            expect(result.hadErrors).toBe(false);
            expect(result.needsRetry).toBe(false);
            expect(result.discrepancies).toEqual([]);
        });

        test('should detect apartment name discrepancies', () => {
            const response = 'El Apartamento 715-X está disponible';
            const toolOutput = ['Apartamento 715-A está disponible por $840.000'];

            const result = hotelValidation.validateAndCorrectResponse(response, toolOutput);

            expect(result.hadErrors).toBe(true);
            expect(result.discrepancies.length).toBeGreaterThan(0);
            expect(result.discrepancies[0]).toContain('715-X');
        });

        test('should correct similar apartment names', () => {
            const response = 'El Apartamento 715-X está disponible';
            const toolOutput = ['Apartamento 715-A está disponible'];

            const result = hotelValidation.validateAndCorrectResponse(response, toolOutput);

            expect(result.correctedResponse).toContain('715-A');
        });

        test('should detect price count mismatches', () => {
            const response = 'Apartamento disponible';
            const toolOutput = ['Apartamento por $840.000 y $210.000 opciones'];

            const result = hotelValidation.validateAndCorrectResponse(response, toolOutput);

            expect(result.hadErrors).toBe(true);
            expect(result.needsRetry).toBe(true);
        });
    });

    describe('Retry Management', () => {
        test('should allow retry for new users', () => {
            expect(hotelValidation.canRetry('new_user')).toBe(true);
        });

        test('should prevent retry within cooldown period', () => {
            hotelValidation.markRetry('test_user');
            expect(hotelValidation.canRetry('test_user')).toBe(false);
        });

        test('should allow retry after cooldown period', () => {
            hotelValidation.markRetry('test_user');
            
            // Mock time passing (5+ minutes)
            const originalNow = Date.now;
            Date.now = jest.fn(() => originalNow() + (6 * 60 * 1000));
            
            expect(hotelValidation.canRetry('test_user')).toBe(true);
            
            // Restore original Date.now
            Date.now = originalNow;
        });
    });
});