// src/plugins/hotel/services/apartment-data.service.ts
import { PrismaClient } from '@prisma/client';
import { logError, logSuccess, logInfo, logWarning } from '../../../utils/logging';
import { CacheManager } from '../../../core/state/cache-manager';
import { fetchWithRetry } from '../../../core/utils/retry-utils';

const prisma = new PrismaClient();

export interface ApartmentDetails {
  propertyId: number;
  propertyName?: string; // Nombre de la propiedad
  roomId: number;
  roomName: string;
  extraCharge: {
    description: string; // "Aseo y Registro:"
    amount: number;      // 70000
  };
}

export class ApartmentDataService {
  private static cacheManager: CacheManager | null = null;
  private static apartmentsLoaded: boolean = false;
  private static loadAttempts: number = 0;
  private static readonly MAX_LOAD_ATTEMPTS = 5;
  private static readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas
  
  constructor() {
    // Inicializar cache si no existe
    if (!ApartmentDataService.cacheManager) {
      ApartmentDataService.cacheManager = new CacheManager({
        maxSize: 1000,
        defaultTtl: ApartmentDataService.CACHE_TTL
      });
    }
  }
  
  /**
   * Carga inicial de todos los apartamentos al cache con reintentos
   */
  static async loadAllApartmentsToCache(): Promise<boolean> {
    if (ApartmentDataService.apartmentsLoaded) {
      logInfo('APARTMENT_CACHE', 'Apartamentos ya cargados en cache', {}, 'apartment-data.service.ts');
      return true;
    }
    
    while (ApartmentDataService.loadAttempts < ApartmentDataService.MAX_LOAD_ATTEMPTS) {
      ApartmentDataService.loadAttempts++;
      
      try {
        logInfo('APARTMENT_CACHE', `Intento ${ApartmentDataService.loadAttempts}/${ApartmentDataService.MAX_LOAD_ATTEMPTS} de cargar apartamentos al cache`, {}, 'apartment-data.service.ts');
        
        const startTime = Date.now();
        
        // Cargar todos los apartamentos de la BD
        const apartments = await prisma.apartamentos.findMany({
          select: {
            propertyId: true,
            propertyName: true,
            roomId: true,
            roomName: true,
            extraCharge: true,
            capacity: true
          }
        });
        
        const duration = Date.now() - startTime;
        
        if (!apartments || apartments.length === 0) {
          logWarning('APARTMENT_CACHE', 'No se encontraron apartamentos en la BD', {
            attempt: ApartmentDataService.loadAttempts
          }, 'apartment-data.service.ts');
          
          // Esperar antes de reintentar
          if (ApartmentDataService.loadAttempts < ApartmentDataService.MAX_LOAD_ATTEMPTS) {
            await new Promise(resolve => setTimeout(resolve, 2000 * ApartmentDataService.loadAttempts));
            continue;
          }
        }
        
        // Inicializar cache si no existe
        if (!ApartmentDataService.cacheManager) {
          ApartmentDataService.cacheManager = new CacheManager({
            maxSize: 1000,
            defaultTtl: ApartmentDataService.CACHE_TTL
          });
        }
        
        // Guardar cada apartamento en cache
        let cachedCount = 0;
        apartments.forEach(apt => {
          const cacheKey = `apartment:${apt.roomId}`;
          const apartmentData: ApartmentDetails = {
            propertyId: apt.propertyId,
            propertyName: apt.propertyName,
            roomId: apt.roomId,
            roomName: apt.roomName,
            extraCharge: apt.extraCharge as { description: string; amount: number },
          };
          
          ApartmentDataService.cacheManager!.set(cacheKey, apartmentData, ApartmentDataService.CACHE_TTL);
          cachedCount++;
        });
        
        // Guardar también un mapa completo para búsquedas bulk
        const apartmentMap = new Map<number, ApartmentDetails>();
        apartments.forEach(apt => {
          apartmentMap.set(apt.roomId, {
            propertyId: apt.propertyId,
            propertyName: apt.propertyName,
            roomId: apt.roomId,
            roomName: apt.roomName,
            extraCharge: apt.extraCharge as { description: string; amount: number }
          });
        });
        
        ApartmentDataService.cacheManager!.set('apartments:all', apartmentMap, ApartmentDataService.CACHE_TTL);
        
        ApartmentDataService.apartmentsLoaded = true;
        
        logSuccess('APARTMENT_CACHE', 'Apartamentos cargados exitosamente al cache', {
          totalApartments: apartments.length,
          cachedCount,
          duration: `${duration}ms`,
          attempt: ApartmentDataService.loadAttempts
        }, 'apartment-data.service.ts');
        
        return true;
        
      } catch (error) {
        logError('APARTMENT_CACHE', `Error en intento ${ApartmentDataService.loadAttempts} de cargar apartamentos`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          attempt: ApartmentDataService.loadAttempts,
          maxAttempts: ApartmentDataService.MAX_LOAD_ATTEMPTS
        }, 'apartment-data.service.ts');
        
        // Si no es el último intento, esperar antes de reintentar
        if (ApartmentDataService.loadAttempts < ApartmentDataService.MAX_LOAD_ATTEMPTS) {
          const waitTime = Math.min(5000 * ApartmentDataService.loadAttempts, 15000); // Max 15 segundos
          logInfo('APARTMENT_CACHE', `Esperando ${waitTime}ms antes de reintentar...`, {}, 'apartment-data.service.ts');
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    // Si llegamos aquí, fallaron todos los intentos
    logError('APARTMENT_CACHE', 'Fallaron todos los intentos de cargar apartamentos al cache', {
      totalAttempts: ApartmentDataService.loadAttempts
    }, 'apartment-data.service.ts');
    
    return false;
  }
  
  // Optimizado: primero intenta cache, luego BD como fallback
  async getApartmentDetails(roomIds: number[]): Promise<Map<number, ApartmentDetails>> {
    const startTime = Date.now();
    
    // Primero intentar obtener del cache
    if (ApartmentDataService.cacheManager) {
      // Intentar obtener el mapa completo del cache
      const cachedMap = ApartmentDataService.cacheManager.get<Map<number, ApartmentDetails>>('apartments:all');
      
      if (cachedMap && cachedMap.size > 0) {
        // Filtrar solo los roomIds solicitados
        const resultMap = new Map<number, ApartmentDetails>();
        let foundCount = 0;
        
        roomIds.forEach(roomId => {
          const apt = cachedMap.get(roomId);
          if (apt) {
            resultMap.set(roomId, apt);
            foundCount++;
          }
        });
        
        const duration = Date.now() - startTime;
        
        logSuccess('APARTMENT_CACHE', 'Apartamentos obtenidos del cache', {
          requestedRoomIds: roomIds.length,
          foundInCache: foundCount,
          duration: `${duration}ms`,
          cacheHit: true
        }, 'apartment-data.service.ts');
        
        // Si encontramos al menos algunos, retornar lo que tenemos
        if (resultMap.size > 0) {
          return resultMap;
        }
      }
    }
    
    // Si no hay cache o no se encontraron los apartamentos, intentar BD
    logInfo('APARTMENT_DATA_SERVICE', 'Cache miss, consultando BD', {
      roomIds: roomIds.length,
      cacheAvailable: !!ApartmentDataService.cacheManager
    }, 'apartment-data.service.ts');
    
    try {
      // Consulta bulk optimizada a BD
      const apartments = await prisma.apartamentos.findMany({
        where: {
          roomId: {
            in: roomIds
          }
        },
        select: {
          propertyId: true,
          propertyName: true,
          roomId: true,
          roomName: true,
          extraCharge: true
        }
      });
      
      const duration = Date.now() - startTime;
      
      // Crear Map para lookup O(1)
      const apartmentMap = new Map<number, ApartmentDetails>();
      apartments.forEach(apt => {
        const details: ApartmentDetails = {
          propertyId: apt.propertyId,
          propertyName: apt.propertyName,
          roomId: apt.roomId,
          roomName: apt.roomName,
          extraCharge: apt.extraCharge as { description: string; amount: number }
        };
        apartmentMap.set(apt.roomId, details);
        
        // Actualizar cache con los datos frescos
        if (ApartmentDataService.cacheManager) {
          const cacheKey = `apartment:${apt.roomId}`;
          ApartmentDataService.cacheManager.set(cacheKey, details, ApartmentDataService.CACHE_TTL);
        }
      });
      
      logSuccess('APARTMENT_DATA_SERVICE', 'Apartment details loaded from DB', {
        requestedRoomIds: roomIds.length,
        foundApartments: apartments.length,
        duration: `${duration}ms`,
        cacheHit: false
      }, 'apartment-data.service.ts');
      
      return apartmentMap;
      
    } catch (error) {
      logError('APARTMENT_DATA_SERVICE', 'Error loading apartment details from DB', {
        error: error instanceof Error ? error.message : 'Unknown error',
        roomIds
      }, 'apartment-data.service.ts');
      
      // Último intento: buscar en cache individual si existe
      if (ApartmentDataService.cacheManager) {
        const fallbackMap = new Map<number, ApartmentDetails>();
        
        roomIds.forEach(roomId => {
          const cached = ApartmentDataService.cacheManager!.get<ApartmentDetails>(`apartment:${roomId}`);
          if (cached) {
            fallbackMap.set(roomId, cached);
          }
        });
        
        if (fallbackMap.size > 0) {
          logWarning('APARTMENT_DATA_SERVICE', 'Using partial cache after DB error', {
            requestedRoomIds: roomIds.length,
            foundInCache: fallbackMap.size
          }, 'apartment-data.service.ts');
          return fallbackMap;
        }
      }
      
      // Retornar Map vacío en caso de error total
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
          propertyName: data.propertyName || 'TeAlquilamos',
          roomId: data.roomId,
          roomName: data.roomName,
          extraCharge: data.extraCharge
        },
        update: {
          propertyId: data.propertyId,
          propertyName: data.propertyName || 'TeAlquilamos',
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
        propertyName: apartment.propertyName,
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
}