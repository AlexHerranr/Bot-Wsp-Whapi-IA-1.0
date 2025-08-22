// tests/plugins/hotel/beds24-migration.regression.test.ts
// 
// REGRESSION TESTS for Beds24 Migration
// Ensure no functional changes during Beds24Client unification
//
// CRITICAL: These tests must PASS BEFORE any migration
// Captures exact behavior of current direct API implementations

// Mock fetch for direct API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock axios for some functions
jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios;

// Mock PrismaClient
const mockPrismaClient = {
  apartamentos: {
    findUnique: jest.fn()
  }
};
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient)
}));

// Import functions after mocks
import { checkBookingDetails } from '../../../src/plugins/hotel/functions/check-booking-details';
import { informarMovimientoManana } from '../../../src/plugins/hotel/functions/informar-movimiento-manana';
import { createNewBooking } from '../../../src/plugins/hotel/functions/create-new-booking';
import { editBooking } from '../../../src/plugins/hotel/functions/edit-booking';

describe('🔄 Beds24 Migration Regression Tests', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
    mockedAxios.get.mockClear();
    mockedAxios.post.mockClear();
    
    // Setup environment variables
    process.env.BEDS24_TOKEN = 'test-token-123';
    process.env.BEDS24_API_URL = 'https://api.beds24.com/v2';
    process.env.BEDS24_WRITE_REFRESH_TOKEN = 'test-refresh-token';
  });

  // =========================================================================
  // CHECK BOOKING DETAILS REGRESSION
  // =========================================================================
  describe('📋 check-booking-details regression', () => {
    
    test('should return exact booking format for successful search', async () => {
      // Mock successful API response
      const mockBookingResponse = {
        data: [{
          id: 12345,
          firstName: 'Juan',
          lastName: 'Pérez',
          arrival: '2025-08-22',
          departure: '2025-08-25',
          numAdult: 2,
          numChild: 0,
          status: 'confirmed',
          referer: 'booking.com',
          price: 450000,
          roomId: 378110,
          email: 'juan@example.com',
          phone: '+573001234567',
          comments: 'Llegada tarde',
          notes: 'Huésped frecuente'
        }]
      };

      const mockInvoiceResponse = {
        data: [{
          invoiceItems: [
            {
              id: 1,
              type: 'charge',
              description: 'Alojamiento',
              qty: 3,
              amount: 150000,
              lineTotal: 450000,
              vatRate: 0,
              status: 'confirmed'
            },
            {
              id: 2,
              type: 'payment',
              description: 'Anticipo transferencia',
              qty: 1,
              amount: -200000,
              lineTotal: -200000,
              vatRate: 0,
              status: 'confirmed'
            }
          ]
        }]
      };

      // Mock apartment data
      mockPrismaClient.apartamentos.findUnique.mockResolvedValue({
        propertyId: 1,
        roomId: 378110,
        roomName: '2005A',
        extraCharge: {
          description: 'Cargo por limpieza',
          amount: 70000
        }
      });

      // Setup fetch calls (booking + invoice)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBookingResponse
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockInvoiceResponse
        });

      const result = await checkBookingDetails({
        firstName: 'Juan',
        lastName: 'Pérez',
        checkInDate: '2025-08-22'
      });

      // REGRESSION VALIDATION: Exact structure
      expect(result.success).toBe(true);
      expect(result.source).toBe('beds24');
      expect(result.booking).toBeDefined();
      
      // Check message format
      expect(result.message).toContain('📋 DETALLES DE RESERVA');
      expect(result.message).toContain('Juan Pérez');
      expect(result.message).toContain('22/08/2025');
      expect(result.message).toContain('25/08/2025');
      expect(result.message).toContain('2005A');
      expect(result.message).toContain('booking.com');
      expect(result.message).toContain('$450.000');
      expect(result.message).toContain('$200.000');
      expect(result.message).toContain('$250.000');

      // Verify API calls structure
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/bookings?arrival=2025-08-22'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'token': 'test-token-123'
          })
        })
      );
    });

    test('should return exact not found message format', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] })
      });

      const result = await checkBookingDetails({
        firstName: 'NoExiste',
        lastName: 'Apellido',
        checkInDate: '2025-08-22'
      });

      // REGRESSION VALIDATION: Exact not found format
      expect(result.success).toBe(false);
      expect(result.message).toBe('No encontramos ninguna reserva para NoExiste Apellido con fecha de entrada 22/08/2025. Por favor verifica los datos o contacta al hotel.');
      expect(result.booking).toBe(null);
      expect(result.source).toBe(null);
    });

    test('should handle validation errors exactly', async () => {
      const result = await checkBookingDetails({
        firstName: '',
        lastName: 'Test',
        checkInDate: '2025-08-22'
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Faltan datos requeridos: nombre, apellido y fecha de entrada');
    });
  });

  // =========================================================================
  // INFORMAR MOVIMIENTO MAÑANA REGRESSION
  // =========================================================================
  describe('📊 informar-movimiento-manana regression', () => {
    
    test('should return exact report format structure', async () => {
      const mockEntradasResponse = {
        data: [{
          firstName: 'Ana',
          lastName: 'García',
          arrival: '2025-08-23',
          roomId: 378316,
          phone: '+573007654321',
          numAdult: 2,
          numChild: 1,
          referer: 'direct',
          price: 300000,
          arrivalTime: '15:00'
        }]
      };

      const mockSalidasResponse = {
        data: [{
          firstName: 'Carlos',
          lastName: 'López',
          departure: '2025-08-23',
          roomId: 378110,
          phone: '+573009876543',
          numAdult: 1,
          numChild: 0,
          referer: 'booking.com',
          departureTime: '11:00'
        }]
      };

      const mockOcupadosResponse = { data: [] };
      const mockProximasResponse = { data: [] };

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockEntradasResponse })    // entradas
        .mockResolvedValueOnce({ data: mockSalidasResponse })     // salidas  
        .mockResolvedValueOnce({ data: mockOcupadosResponse })    // ocupados
        .mockResolvedValueOnce({ data: mockProximasResponse });   // próximas

      const result = await informarMovimientoManana({
        fecha: '2025-08-23',
        incluirSaldos: true
      });

      // REGRESSION VALIDATION: Exact report structure
      expect(result.success).toBe(true);
      expect(result.reporte).toBeDefined();
      expect(result.resumen).toBeDefined();
      
      // Check report format
      expect(result.reporte).toContain('El día 23 Sale y Entra:');
      expect(result.reporte).toContain('SALE:');
      expect(result.reporte).toContain('ENTRA:');
      expect(result.reporte).toContain('OCUPADOS:');
      expect(result.reporte).toContain('DESOCUPADOS:');
      expect(result.reporte).toContain('📊 Resumen:');
      
      // Check specific data in report
      expect(result.reporte).toContain('Carlos López');
      expect(result.reporte).toContain('Ana García');
      expect(result.reporte).toContain('15:00');
      expect(result.reporte).toContain('11:00');

      // Check API calls
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/bookings'),
        expect.objectContaining({
          params: expect.objectContaining({
            arrivalFrom: '2025-08-23',
            arrivalTo: '2025-08-23'
          })
        })
      );
    });

    test('should handle date validation exactly', async () => {
      const result = await informarMovimientoManana({
        fecha: 'invalid-date',
        incluirSaldos: true
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Formato de fecha inválido. Use YYYY-MM-DD');
      expect(result.error).toBe('invalid_date_format');
    });
  });

  // =========================================================================
  // CREATE NEW BOOKING REGRESSION
  // =========================================================================
  describe('🆕 create-new-booking regression', () => {
    
    test('should return exact success format with all financial details', async () => {
      // Mock auth response
      mockedAxios.get.mockResolvedValue({
        data: {
          token: 'access-token-123',
          expiresIn: 3600
        }
      });

      // Mock booking creation response
      mockedAxios.post.mockResolvedValue({
        data: [{
          new: {
            id: 67890,
            status: 'confirmed',
            price: 520000
          }
        }]
      });

      const result = await createNewBooking({
        roomId: 378110,
        arrival: '2025-08-25',
        departure: '2025-08-28',
        firstName: 'María',
        lastName: 'Rodríguez',
        email: 'maria@example.com',
        phone: '+573005555555',
        numAdult: 2,
        numChild: 1,
        arrivalTime: '14:00',
        accommodationRate: 150000,
        extraServices: [{
          description: 'Desayuno',
          amount: 25000,
          qty: 3
        }],
        parkingRequired: true,
        parkingRate: 30000,
        advancePayment: 200000,
        advanceDescription: 'Anticipo transferencia Bancolombia'
      });

      // REGRESSION VALIDATION: Exact success structure
      expect(result.success).toBe(true);
      expect(result.booking).toBeDefined();
      expect(result.booking.id).toBe(67890);
      
      // Check message format
      expect(result.message).toContain('✅ **RESERVA CREADA EXITOSAMENTE**');
      expect(result.message).toContain('67890');
      expect(result.message).toContain('María Rodríguez');
      expect(result.message).toContain('25/08/2025 al 28/08/2025');
      expect(result.message).toContain('3 noche');
      expect(result.message).toContain('$450.000'); // accommodation total
      expect(result.message).toContain('$75.000');  // extras total
      expect(result.message).toContain('$90.000');  // parking total
      expect(result.message).toContain('$615.000'); // grand total
      expect(result.message).toContain('$200.000'); // advance
      expect(result.message).toContain('$415.000'); // pending balance
    });

    test('should handle validation errors exactly', async () => {
      const result = await createNewBooking({
        roomId: 378110,
        arrival: '2025-08-25',
        departure: '2025-08-28',
        firstName: '',
        lastName: 'Test',
        email: 'invalid-email',
        phone: '+573001234567',
        numAdult: 2,
        accommodationRate: 150000,
        advancePayment: 100000,
        advanceDescription: 'Test payment'
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Faltan datos BÁSICOS requeridos');
      expect(result.error).toBe('missing_required_fields');
    });
  });

  // =========================================================================
  // EDIT BOOKING REGRESSION  
  // =========================================================================
  describe('✏️ edit-booking regression', () => {
    
    test('should return exact format for payment addition', async () => {
      // Mock auth response
      mockedAxios.get.mockResolvedValue({
        data: {
          token: 'access-token-123',
          expiresIn: 3600
        }
      });

      // Mock booking update response
      mockedAxios.post.mockResolvedValue({
        data: [{
          modified: {
            id: 12345,
            status: 'new' // Status unchanged for add_payment
          }
        }]
      });

      const result = await editBooking({
        bookingId: 12345,
        action: 'add_payment',
        paymentAmount: 150000,
        paymentDescription: 'Comprobante transferencia Nequi'
      });

      // REGRESSION VALIDATION: Exact payment format
      expect(result.success).toBe(true);
      expect(result.booking).toBeDefined();
      expect(result.booking.action).toBe('payment_added');
      
      // Check message format
      expect(result.message).toContain('✅ **PAGO AÑADIDO EXITOSAMENTE**');
      expect(result.message).toContain('12345');
      expect(result.message).toContain('SIN CAMBIOS');
      expect(result.message).toContain('$150.000');
      expect(result.message).toContain('Comprobante transferencia Nequi');
    });

    test('should return exact format for confirmation with payment', async () => {
      // Mock auth response
      mockedAxios.get.mockResolvedValue({
        data: {
          token: 'access-token-123',
          expiresIn: 3600
        }
      });

      // Mock booking update response
      mockedAxios.post.mockResolvedValue({
        data: [{
          modified: {
            id: 12345,
            status: 'confirmed'
          }
        }]
      });

      const result = await editBooking({
        bookingId: 12345,
        action: 'confirm_with_payment',
        paymentAmount: 250000,
        paymentDescription: 'Voucher Bancolombia'
      });

      // REGRESSION VALIDATION: Exact confirmation format
      expect(result.success).toBe(true);
      expect(result.booking.status).toBe('confirmed');
      expect(result.booking.action).toBe('confirmed_with_payment');
      
      expect(result.message).toContain('✅ **RESERVA CONFIRMADA CON PAGO**');
      expect(result.message).toContain('CONFIRMADA ✅');
      expect(result.message).toContain('$250.000');
      expect(result.message).toContain('Voucher Bancolombia');
    });

    test('should return exact format for cancellation', async () => {
      // Mock auth response
      mockedAxios.get.mockResolvedValue({
        data: {
          token: 'access-token-123',
          expiresIn: 3600
        }
      });

      // Mock booking update response
      mockedAxios.post.mockResolvedValue({
        data: [{
          modified: {
            id: 12345,
            status: 'cancelled',
            price: 400000
          }
        }]
      });

      const result = await editBooking({
        bookingId: 12345,
        action: 'cancel',
        cancellationReason: 'Precio muy alto para el cliente'
      });

      // REGRESSION VALIDATION: Exact cancellation format
      expect(result.success).toBe(true);
      expect(result.booking.status).toBe('cancelled');
      expect(result.booking.action).toBe('cancelled');
      expect(result.canOfferDiscount).toBe(true);
      expect(result.originalAmount).toBe(400000);
      
      expect(result.message).toContain('❌ **RESERVA CANCELADA**');
      expect(result.message).toContain('CANCELADA ❌');
      expect(result.message).toContain('Precio muy alto para el cliente');
      expect(result.message).toContain('propuesta con descuento');
    });

    test('should handle validation errors exactly', async () => {
      const result = await editBooking({
        bookingId: 12345,
        action: 'add_payment'
        // Missing required payment fields
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Para add_payment se requiere: paymentAmount');
      expect(result.error).toBe('missing_payment_data');
    });
  });

  // =========================================================================
  // CROSS-FUNCTION INTEGRATION TESTS
  // =========================================================================
  describe('🔗 Cross-function integration', () => {
    
    test('should maintain consistency between check and edit booking', async () => {
      // This test ensures that bookingId from check-booking-details
      // works correctly with edit-booking
      
      const bookingId = 99999;
      
      // Mock check-booking-details response
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{
            id: bookingId,
            firstName: 'Test',
            lastName: 'User',
            arrival: '2025-08-25',
            departure: '2025-08-27',
            status: 'new',
            price: 300000,
            roomId: 378110
          }]
        })
      });

      // Mock apartment lookup
      mockPrismaClient.apartamentos.findUnique.mockResolvedValue({
        roomId: 378110,
        roomName: '2005A',
        extraCharge: { description: 'Test', amount: 50000 }
      });

      const checkResult = await checkBookingDetails({
        firstName: 'Test',
        lastName: 'User', 
        checkInDate: '2025-08-25'
      });

      expect(checkResult.success).toBe(true);
      expect(checkResult.booking.bookingId).toBe(bookingId);

      // Now test edit with same bookingId
      mockedAxios.get.mockResolvedValue({
        data: { token: 'test-token' }
      });
      
      mockedAxios.post.mockResolvedValue({
        data: [{ modified: { id: bookingId, status: 'confirmed' } }]
      });

      const editResult = await editBooking({
        bookingId: bookingId,
        action: 'confirm_with_payment',
        paymentAmount: 100000,
        paymentDescription: 'Test payment'
      });

      expect(editResult.success).toBe(true);
      expect(editResult.booking.id).toBe(bookingId);
    });
  });
});