// tests/plugins/hotel/beds24-client-simple.test.ts
// Test básico para validar formato de respuesta del Beds24Client

describe('🏨 Beds24Client Simple Format Test', () => {
  let mockFetch: jest.Mock;
  
  beforeEach(() => {
    // Mock global fetch
    mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: 12345,
            firstName: 'Test',
            lastName: 'User',
            arrival: '2025-08-22',
            departure: '2025-08-24'
          }
        ]
      })
    });
    global.fetch = mockFetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('searchBookings returns expected format', async () => {
    // Dynamic import to avoid module resolution issues
    const { Beds24Client } = require('../../../src/plugins/hotel/services/beds24-client');
    const beds24Client = new Beds24Client('test-token');

    const result = await beds24Client.searchBookings({ arrival: '2025-08-22' });
    
    // Validate basic structure
    expect(result).toBeDefined();
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('data');
    expect(result.success).toBe(true);
    expect(result.data).toBeInstanceOf(Array);
    expect(result.data.length).toBeGreaterThan(0);
    
    // Validate booking structure
    const booking = result.data[0];
    expect(booking).toHaveProperty('id');
    expect(booking).toHaveProperty('firstName');
    expect(booking).toHaveProperty('lastName');
    expect(booking.id).toBe(12345);
  });

  test('getTomorrowMovements returns correct structure', async () => {
    const { Beds24Client } = require('../../../src/plugins/hotel/services/beds24-client');
    const beds24Client = new Beds24Client('test-token');

    const result = await beds24Client.getTomorrowMovements('2025-08-22');
    
    // Validate wrapper structure
    expect(result).toBeDefined();
    expect(result).toHaveProperty('entradas');
    expect(result).toHaveProperty('salidas');
    expect(result).toHaveProperty('ocupados');
    expect(result).toHaveProperty('proximas');
    
    // Each property should have data array
    expect(result.entradas.data).toBeInstanceOf(Array);
    expect(result.salidas.data).toBeInstanceOf(Array);
    expect(result.ocupados.data).toBeInstanceOf(Array);
    expect(result.proximas.data).toBeInstanceOf(Array);
  });
});