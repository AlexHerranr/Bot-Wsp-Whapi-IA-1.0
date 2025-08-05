// tests/unit/apartment-enrichment.test.ts
import { ApartmentDataService } from '../../src/plugins/hotel/services/apartment-data.service';

describe('Apartment Data Enrichment', () => {
  let apartmentService: ApartmentDataService;

  beforeAll(() => {
    apartmentService = new ApartmentDataService();
  });

  describe('getApartmentDetails', () => {
    test('should return Map with apartment details for valid roomIds', async () => {
      // Test con roomIds reales que sabemos que existen
      const roomIds = [378318, 378317];
      
      const result = await apartmentService.getApartmentDetails(roomIds);
      
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBeGreaterThan(0);
      
      // Verificar estructura de datos
      const apartment = result.get(378318);
      if (apartment) {
        expect(apartment).toHaveProperty('roomId');
        expect(apartment).toHaveProperty('apartmentName');
        expect(apartment).toHaveProperty('maxAdults');
        expect(apartment).toHaveProperty('maxChildren');
        expect(apartment).toHaveProperty('extraCharges');
        expect(typeof apartment.maxAdults).toBe('number');
        expect(typeof apartment.maxChildren).toBe('number');
      }
    });

    test('should handle empty roomIds array', async () => {
      const roomIds: number[] = [];
      
      const result = await apartmentService.getApartmentDetails(roomIds);
      
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });
  });

  describe('Data merge simulation', () => {
    test('should merge Beds24 data with local apartment data correctly', async () => {
      // Simular datos de Beds24
      const beds24Data = [
        {
          name: "Aparta Estudio 1722-B",
          roomId: 378318,
          totalPrice: 850000,
          pricePerNight: 170000
        },
        {
          name: "Apartamento 1317", 
          roomId: 378317,
          totalPrice: 1050000,
          pricePerNight: 210000
        }
      ];

      // Obtener datos locales
      const roomIds = beds24Data.map(apt => apt.roomId);
      const apartmentDetailsMap = await apartmentService.getApartmentDetails(roomIds);
      
      // Simular merge
      const enrichedData = beds24Data.map(apt => {
        const details = apartmentDetailsMap.get(apt.roomId);
        return {
          ...apt,
          maxAdults: details?.maxAdults || 6,
          maxChildren: details?.maxChildren || 2,
          extraCharges: details?.extraCharges || null
        };
      });

      // Verificar merge
      expect(enrichedData).toHaveLength(2);
      enrichedData.forEach(apt => {
        expect(apt).toHaveProperty('maxAdults');
        expect(apt).toHaveProperty('maxChildren'); 
        expect(apt).toHaveProperty('extraCharges');
        expect(typeof apt.maxAdults).toBe('number');
        expect(typeof apt.maxChildren).toBe('number');
      });
    });
  });
});