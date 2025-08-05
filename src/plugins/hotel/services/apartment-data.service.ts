// src/plugins/hotel/services/apartment-data.service.ts
import { PrismaClient } from '@prisma/client';
import { logError, logSuccess } from '../../../utils/logging';

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
  
  // Optimizado: consulta bulk con Map lookup (O(1) en lugar de O(n))
  async getApartmentDetails(roomIds: number[]): Promise<Map<number, ApartmentDetails>> {
    try {
      const startTime = Date.now();
      
      // Consulta bulk optimizada
      const apartments = await prisma.hotelApartment.findMany({
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
      
      logSuccess('APARTMENT_DATA_SERVICE', 'Apartment details loaded', {
        requestedRoomIds: roomIds.length,
        foundApartments: apartments.length,
        duration: `${duration}ms`
      });
      
      return apartmentMap;
      
    } catch (error) {
      logError('APARTMENT_DATA_SERVICE', 'Error loading apartment details', {
        error: error instanceof Error ? error.message : 'Unknown error',
        roomIds
      });
      
      // Retornar Map vacío en caso de error
      return new Map();
    }
  }
  
  // Método para crear/actualizar apartamento (para administración)
  async upsertApartment(data: ApartmentDetails): Promise<ApartmentDetails | null> {
    try {
      const apartment = await prisma.hotelApartment.upsert({
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
      });
      
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
      });
      
      return null;
    }
  }
}