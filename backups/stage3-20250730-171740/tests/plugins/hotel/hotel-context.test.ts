// tests/plugins/hotel/hotel-context.test.ts
import { HotelContext } from '../../../src/plugins/hotel/logic/context';

describe('🏨 Hotel Context Provider', () => {
    let hotelContext: HotelContext;

    beforeEach(() => {
        hotelContext = new HotelContext();
    });

    describe('Context Generation', () => {
        test('should generate basic hotel context', async () => {
            const context = await hotelContext.getRelevantContext(
                'user123',
                { name: 'Juan Pérez' },
                { name: 'Juan Pérez', labels: [] }
            );

            expect(context).toContain('Fecha:');
            expect(context).toContain('Cliente: Juan Pérez');
            expect(context).toContain('TeAlquilamos');
            expect(context).toContain('Hotel boutique en Cartagena, Colombia');
            expect(context).toContain('Mensaje del cliente:');
        });

        test('should include hotel labels in context when present', async () => {
            const context = await hotelContext.getRelevantContext(
                'user123',
                { name: 'Juan Pérez', whapiLabels: [{ name: 'VIP' }] },
                { name: 'Juan Pérez', labels: [{ name: 'Reservado' }] }
            );

            expect(context).toContain('Status: VIP, Reservado');
            expect(context).toContain('GESTIÓN DE ETIQUETAS');
        });

        test('should handle missing user names gracefully', async () => {
            const context = await hotelContext.getRelevantContext(
                'user123',
                {},
                {}
            );

            expect(context).toContain('Cliente: Cliente');
            expect(context).toContain('Contacto WhatsApp: Cliente');
        });

        test('should include business information', async () => {
            const context = await hotelContext.getRelevantContext(
                'user123',
                { name: 'Test User' },
                { name: 'Test User', labels: [] }
            );

            expect(context).toContain('=== INFORMACIÓN DEL NEGOCIO ===');
            expect(context).toContain('Nombre: TeAlquilamos');
            expect(context).toContain('Tipo: Hotel boutique en Cartagena, Colombia');
            expect(context).toContain('Especialidad: Alquiler temporal');
        });
    });

    describe('Context Refresh Logic', () => {
        test('should require refresh for new contexts', () => {
            const needsRefresh = hotelContext.needsRefresh(
                'user123',
                null,
                { name: 'Test User' },
                { name: 'Test User', labels: [] }
            );

            expect(needsRefresh).toBe(true);
        });

        test('should require refresh when context is old', () => {
            const oldContext = {
                timestamp: Date.now() - (6 * 60 * 1000), // 6 minutes ago
                labels: []
            };

            const needsRefresh = hotelContext.needsRefresh(
                'user123',
                oldContext,
                { name: 'Test User' },
                { name: 'Test User', labels: [] }
            );

            expect(needsRefresh).toBe(true);
        });

        test('should require refresh when labels change', () => {
            const oldContext = {
                timestamp: Date.now() - (2 * 60 * 1000), // 2 minutes ago
                labels: ['VIP']
            };

            const needsRefresh = hotelContext.needsRefresh(
                'user123',
                oldContext,
                { name: 'Test User', whapiLabels: [{ name: 'Reservado' }] },
                { name: 'Test User', labels: [] }
            );

            expect(needsRefresh).toBe(true);
        });

        test('should not require refresh for recent unchanged context', () => {
            const recentContext = {
                timestamp: Date.now() - (2 * 60 * 1000), // 2 minutes ago
                labels: []
            };

            const needsRefresh = hotelContext.needsRefresh(
                'user123',
                recentContext,
                { name: 'Test User' },
                { name: 'Test User', labels: [] }
            );

            expect(needsRefresh).toBe(false);
        });
    });

    describe('Date and Time Formatting', () => {
        test('should use Colombian timezone', async () => {
            const context = await hotelContext.getRelevantContext(
                'user123',
                { name: 'Test User' },
                { name: 'Test User', labels: [] }
            );

            expect(context).toMatch(/Fecha: \d{2}\/\d{2}\/\d{4}/);
            expect(context).toMatch(/Hora: \d{1,2}:\d{2} (AM|PM) \(Colombia\)/);
        });
    });
});