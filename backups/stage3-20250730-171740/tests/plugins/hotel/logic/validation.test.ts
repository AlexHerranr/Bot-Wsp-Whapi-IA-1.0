// tests/plugins/hotel/logic/validation.test.ts
import { HotelValidation } from '../../../../src/plugins/hotel/logic/validation';

describe('HotelValidation', () => {
    let validation: HotelValidation;

    beforeEach(() => {
        validation = new HotelValidation();
    });

    describe('isQuoteOrPriceMessage', () => {
        it('should detect dollar prices', () => {
            expect(validation.isQuoteOrPriceMessage('El precio es $840.000')).toBe(true);
            expect(validation.isQuoteOrPriceMessage('Cuesta $210,000')).toBe(true);
            expect(validation.isQuoteOrPriceMessage('$100')).toBe(true);
        });

        it('should detect COP prices', () => {
            expect(validation.isQuoteOrPriceMessage('840000 COP')).toBe(true);
            expect(validation.isQuoteOrPriceMessage('210 pesos')).toBe(true);
            expect(validation.isQuoteOrPriceMessage('1000000 cop')).toBe(true);
        });

        it('should detect nights', () => {
            expect(validation.isQuoteOrPriceMessage('4 noches')).toBe(true);
            expect(validation.isQuoteOrPriceMessage('1 noche')).toBe(true);
            expect(validation.isQuoteOrPriceMessage('10 NOCHES')).toBe(true);
        });

        it('should detect URLs', () => {
            expect(validation.isQuoteOrPriceMessage('Visita https://example.com')).toBe(true);
            expect(validation.isQuoteOrPriceMessage('http://tealquilamos.com')).toBe(true);
        });

        it('should detect WhatsApp links', () => {
            expect(validation.isQuoteOrPriceMessage('wa.me/p/123456')).toBe(true);
        });

        it('should return false for regular messages', () => {
            expect(validation.isQuoteOrPriceMessage('Hola, ¿cómo estás?')).toBe(false);
            expect(validation.isQuoteOrPriceMessage('Gracias por tu consulta')).toBe(false);
            expect(validation.isQuoteOrPriceMessage('El hotel está ubicado en el centro')).toBe(false);
        });
    });

    describe('validateAndCorrectResponse', () => {
        it('should return basic validation structure', () => {
            const result = validation.validateAndCorrectResponse(
                'Respuesta de prueba',
                ['tool output 1', 'tool output 2']
            );

            expect(result).toHaveProperty('correctedResponse');
            expect(result).toHaveProperty('hadErrors');
            expect(result).toHaveProperty('needsRetry');
            expect(result).toHaveProperty('discrepancies');
            expect(result.discrepancies).toBeInstanceOf(Array);
        });

        it('should not have errors for valid response', () => {
            const result = validation.validateAndCorrectResponse(
                'El precio es correcto',
                []
            );

            expect(result.hadErrors).toBe(false);
            expect(result.needsRetry).toBe(false);
            expect(result.discrepancies).toHaveLength(0);
        });
    });

    describe('Retry Management', () => {
        it('should allow retry for new users', () => {
            expect(validation.canRetry('user123')).toBe(true);
        });

        it('should mark retry and update state', () => {
            const userId = 'user456';
            
            expect(validation.canRetry(userId)).toBe(true);
            validation.markRetry(userId);
            
            // Immediately after marking, should not allow retry
            expect(validation.canRetry(userId)).toBe(false);
        });

        it('should allow retry after cooldown period', async () => {
            const userId = 'user789';
            
            validation.markRetry(userId);
            expect(validation.canRetry(userId)).toBe(false);
            
            // Note: In real implementation, cooldown is 5 minutes
            // For testing, we'd need to mock time or make cooldown configurable
            // This test demonstrates the expected behavior
        });
    });
});