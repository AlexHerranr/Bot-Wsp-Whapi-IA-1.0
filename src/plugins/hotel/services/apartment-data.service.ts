// src/plugins/hotel/services/apartment-data.service.ts
import { PrismaClient } from '@prisma/client';
import { logError, logSuccess, logInfo } from '../../../utils/logging';
import { apartmentCache } from './apartment-cache.service';

const prisma = new PrismaClient();

export interface ApartmentDetails {
  propertyId: number;
  roomId: number;
  roomName: string;
  extraCharge: {
    description: string; // "Aseo y Registro:"
    amount: number;      // 70000
  };
}

export class ApartmentDataService {
  
  // Optimizado: usa caché en memoria en lugar de consulta a BD
  async getApartmentDetails(roomIds: number[]): Promise<Map<number, ApartmentDetails>> {
    try {
      const startTime = Date.now();
      
      // Primero intentar obtener del caché
      const cachedApartments = apartmentCache.getApartments(roomIds);
      
      if (cachedApartments.size === roomIds.length) {
        // Todos los apartamentos encontrados en caché
        const duration = Date.now() - startTime;
        
        logInfo('APARTMENT_DATA_SERVICE', 'Apartamentos obtenidos del caché', {
          requestedRoomIds: roomIds.length,
          foundApartments: cachedApartments.size,
          duration: `${duration}ms`,
          source: 'cache'
        }, 'apartment-data.service.ts');
        
        return cachedApartments;
      }
      
      // Si no están todos en caché, consultar BD (fallback)
      logInfo('APARTMENT_DATA_SERVICE', 'Caché incompleto, consultando BD', {
        requestedCount: roomIds.length,
        cachedCount: cachedApartments.size,
        missingRoomIds: roomIds.filter(id => !cachedApartments.has(id))
      }, 'apartment-data.service.ts');
      
      // Consulta bulk optimizada
      const apartments = await prisma.apartamentos.findMany({
        where: {
          roomId: {
            in: roomIds
          }
        },
        select: {
          propertyId: true,
          roomId: true,
          roomName: true,
          extraCharge: true
        }
      });
      
      const duration = Date.now() - startTime;
      
      // Crear Map para lookup O(1)
      const apartmentMap = new Map<number, ApartmentDetails>();
      apartments.forEach(apt => {
        apartmentMap.set(apt.roomId, {
          propertyId: apt.propertyId,
          roomId: apt.roomId,
          roomName: apt.roomName,
          extraCharge: apt.extraCharge as { description: string; amount: number }
        });
      });
      
      logSuccess('APARTMENT_DATA_SERVICE', 'Apartment details loaded from DB', {
        requestedRoomIds: roomIds.length,
        foundApartments: apartments.length,
        duration: `${duration}ms`,
        source: 'database'
      }, 'apartment-data.service.ts');
      
      return apartmentMap;
      
    } catch (error) {
      logError('APARTMENT_DATA_SERVICE', 'Error loading apartment details', {
        error: error instanceof Error ? error.message : 'Unknown error',
        roomIds
      }, 'apartment-data.service.ts');
      
      // Retornar Map vacío en caso de error
      return new Map();
    }
  }
  
  // Método para crear/actualizar apartamento (para administración)
  async upsertApartment(data: ApartmentDetails): Promise<ApartmentDetails | null> {
    try {
      const apartment = await prisma.apartamentos.upsert({
        where: { roomId: data.roomId },
        create: {
          propertyId: data.propertyId,
          roomId: data.roomId,
          roomName: data.roomName,
          extraCharge: data.extraCharge
        },
        update: {
          propertyId: data.propertyId,
          roomName: data.roomName,
          extraCharge: data.extraCharge
        }
      });
      
      logSuccess('APARTMENT_DATA_SERVICE', 'Apartment upserted', {
        roomId: data.roomId,
        roomName: data.roomName
      }, 'apartment-data.service.ts');
      
      return {
        propertyId: apartment.propertyId,
        roomId: apartment.roomId,
        roomName: apartment.roomName,
        extraCharge: apartment.extraCharge as { description: string; amount: number }
      };
      
    } catch (error) {
      logError('APARTMENT_DATA_SERVICE', 'Error upserting apartment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        roomId: data.roomId
      }, 'apartment-data.service.ts');
      
      return null;
    }
  }
  
  // Método para obtener apartamentos por propertyIds
  async getApartmentDetailsByPropertyIds(propertyIds: number[]): Promise<Map<number, ApartmentDetails>> {
    try {
      const startTime = Date.now();
      
      // Primero intentar obtener del caché
      const cachedApartments = apartmentCache.getApartmentsByPropertyIds(propertyIds);
      
      if (cachedApartments.size === propertyIds.length) {
        // Todos los apartamentos encontrados en caché
        const duration = Date.now() - startTime;
        
        logInfo('APARTMENT_DATA_SERVICE', 'Apartamentos obtenidos del caché por propertyId', {
          requestedPropertyIds: propertyIds.length,
          foundApartments: cachedApartments.size,
          duration: `${duration}ms`,
          source: 'cache'
        }, 'apartment-data.service.ts');
        
        return cachedApartments;
      }
      
      // Si no están todos en caché, consultar BD (fallback)
      logInfo('APARTMENT_DATA_SERVICE', 'Caché incompleto, consultando BD por propertyId', {
        requestedCount: propertyIds.length,
        cachedCount: cachedApartments.size,
        missingPropertyIds: propertyIds.filter(id => !cachedApartments.has(id))
      }, 'apartment-data.service.ts');
      
      // Consulta bulk optimizada
      const apartments = await prisma.apartamentos.findMany({
        where: {
          propertyId: {
            in: propertyIds
          }
        },
        select: {
          propertyId: true,
          roomId: true,
          roomName: true,
          extraCharge: true
        }
      });
      
      const duration = Date.now() - startTime;
      
      // Crear Map para lookup O(1)
      const apartmentMap = new Map<number, ApartmentDetails>();
      apartments.forEach(apt => {
        apartmentMap.set(apt.propertyId, {
          propertyId: apt.propertyId,
          roomId: apt.roomId,
          roomName: apt.roomName,
          extraCharge: apt.extraCharge as { description: string; amount: number }
        });
      });
      
      logSuccess('APARTMENT_DATA_SERVICE', 'Apartment details loaded from DB by propertyId', {
        requestedPropertyIds: propertyIds.length,
        foundApartments: apartments.length,
        duration: `${duration}ms`,
        source: 'database'
      }, 'apartment-data.service.ts');
      
      return apartmentMap;
      
    } catch (error) {
      logError('APARTMENT_DATA_SERVICE', 'Error loading apartment details by propertyId', {
        error: error instanceof Error ? error.message : 'Unknown error',
        propertyIds
      }, 'apartment-data.service.ts');
      
      // Retornar Map vacío en caso de error
      return new Map();
    }
  }
}