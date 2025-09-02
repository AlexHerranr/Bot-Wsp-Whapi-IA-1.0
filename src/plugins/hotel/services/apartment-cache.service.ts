// src/plugins/hotel/services/apartment-cache.service.ts
import { PrismaClient } from '@prisma/client';
import { logError, logSuccess, logInfo } from '../../../utils/logging';

const prisma = new PrismaClient();

export interface ApartmentInfo {
    roomId: number;
    roomName: string;
    propertyId: number;
    extraCharge: {
        description: string;
        amount: number;
    };
    capacity: number;
}

export class ApartmentCacheService {
    private static instance: ApartmentCacheService;
    private apartmentCache: Map<number, ApartmentInfo> = new Map();
    private apartmentCacheByPropertyId: Map<number, ApartmentInfo> = new Map();
    private initialized: boolean = false;

    private constructor() {}

    public static getInstance(): ApartmentCacheService {
        if (!ApartmentCacheService.instance) {
            ApartmentCacheService.instance = new ApartmentCacheService();
        }
        return ApartmentCacheService.instance;
    }

    /**
     * Inicializa el caché cargando todos los apartamentos de la BD
     * Se debe llamar al arrancar el bot
     */
    public async initialize(): Promise<void> {
        try {
            const startTime = Date.now();
            
            logInfo('APARTMENT_CACHE', 'Iniciando carga de apartamentos en caché...', {}, 'apartment-cache.service.ts');

            const apartments = await prisma.apartamentos.findMany({
                select: {
                    roomId: true,
                    roomName: true,
                    propertyId: true,
                    extraCharge: true,
                    capacity: true
                }
            });

            // Limpiar caché existente
            this.apartmentCache.clear();
            this.apartmentCacheByPropertyId.clear();

            // Cargar apartamentos en el Map
            apartments.forEach(apt => {
                const apartmentInfo = {
                    roomId: apt.roomId,
                    roomName: apt.roomName,
                    propertyId: apt.propertyId,
                    extraCharge: apt.extraCharge as { description: string; amount: number },
                    capacity: apt.capacity
                };
                this.apartmentCache.set(apt.roomId, apartmentInfo);
                this.apartmentCacheByPropertyId.set(apt.propertyId, apartmentInfo);
            });

            const duration = Date.now() - startTime;
            this.initialized = true;

            logSuccess('APARTMENT_CACHE', `✅ ${apartments.length} apartamentos cargados en caché`, {
                count: apartments.length,
                duration: `${duration}ms`,
                roomIds: Array.from(this.apartmentCache.keys())
            }, 'apartment-cache.service.ts');

            // Log detallado de apartamentos cargados
            apartments.forEach(apt => {
                logInfo('APARTMENT_LOADED', `${apt.roomId}: ${apt.roomName}`, {
                    roomId: apt.roomId,
                    roomName: apt.roomName,
                    propertyId: apt.propertyId
                }, 'apartment-cache.service.ts');
            });

        } catch (error) {
            logError('APARTMENT_CACHE', 'Error inicializando caché de apartamentos', {
                error: error instanceof Error ? error.message : 'Unknown error'
            }, 'apartment-cache.service.ts');
            
            // Inicializar con valores por defecto en caso de error
            this.initializeDefaults();
        }
    }

    /**
     * Inicializa valores por defecto en caso de error con BD
     */
    private initializeDefaults(): void {
        const defaultApartments = [
            { roomId: 378110, roomName: 'Apartamento 1 Alcoba 2005 A', propertyId: 173207, capacity: 6 },
            { roomId: 378316, roomName: 'Apartamento 1 Alcoba 1820', propertyId: 173307, capacity: 6 },
            { roomId: 378317, roomName: 'Apartamento 1 Alcoba 1317', propertyId: 173308, capacity: 6 },
            { roomId: 378318, roomName: 'Aparta Estudio 1722B', propertyId: 173309, capacity: 4 },
            { roomId: 378320, roomName: 'Aparta Estudio 2005 B', propertyId: 173311, capacity: 3 },
            { roomId: 378321, roomName: 'Apartamento 1 Alcoba 1722 A', propertyId: 173312, capacity: 6 },
            { roomId: 506591, roomName: 'Apartamento 1 Alcoba 0715', propertyId: 240061, capacity: 5 }
        ];

        this.apartmentCache.clear();
        this.apartmentCacheByPropertyId.clear();
        
        defaultApartments.forEach(apt => {
            // Usar el monto correcto según el tipo de apartamento
            const amount = apt.propertyId === 173309 || apt.propertyId === 173311 ? 60000 : 70000;
            const apartmentInfo = {
                ...apt,
                extraCharge: {
                    description: "Registro y Limpieza",
                    amount: amount
                }
            };
            this.apartmentCache.set(apt.roomId, apartmentInfo);
            this.apartmentCacheByPropertyId.set(apt.propertyId, apartmentInfo);
        });

        this.initialized = true;
        
        logInfo('APARTMENT_CACHE', 'Caché inicializado con valores por defecto', {
            count: defaultApartments.length
        }, 'apartment-cache.service.ts');
    }

    /**
     * Obtiene la información de un apartamento por roomId
     */
    public getApartment(roomId: number): ApartmentInfo | null {
        if (!this.initialized) {
            logError('APARTMENT_CACHE', 'Caché no inicializado', { roomId }, 'apartment-cache.service.ts');
            return null;
        }

        return this.apartmentCache.get(roomId) || null;
    }

    /**
     * Obtiene la información de un apartamento por propertyId
     */
    public getApartmentByPropertyId(propertyId: number): ApartmentInfo | null {
        if (!this.initialized) {
            logError('APARTMENT_CACHE', 'Caché no inicializado', { propertyId }, 'apartment-cache.service.ts');
            return null;
        }

        return this.apartmentCacheByPropertyId.get(propertyId) || null;
    }

    /**
     * Obtiene información de múltiples apartamentos
     */
    public getApartments(roomIds: number[]): Map<number, ApartmentInfo> {
        const result = new Map<number, ApartmentInfo>();
        
        roomIds.forEach(roomId => {
            const apt = this.getApartment(roomId);
            if (apt) {
                result.set(roomId, apt);
            }
        });

        return result;
    }

    /**
     * Obtiene información de múltiples apartamentos por propertyIds
     */
    public getApartmentsByPropertyIds(propertyIds: number[]): Map<number, ApartmentInfo> {
        const result = new Map<number, ApartmentInfo>();
        
        propertyIds.forEach(propertyId => {
            const apt = this.getApartmentByPropertyId(propertyId);
            if (apt) {
                result.set(propertyId, apt);
            }
        });

        return result;
    }

    /**
     * Actualiza o agrega un apartamento al caché
     */
    public updateApartment(apartment: ApartmentInfo): void {
        this.apartmentCache.set(apartment.roomId, apartment);
        this.apartmentCacheByPropertyId.set(apartment.propertyId, apartment);
        
        logInfo('APARTMENT_CACHE', 'Apartamento actualizado en caché', {
            roomId: apartment.roomId,
            roomName: apartment.roomName,
            propertyId: apartment.propertyId
        }, 'apartment-cache.service.ts');
    }

    /**
     * Obtiene estadísticas del caché
     */
    public getStats() {
        return {
            initialized: this.initialized,
            count: this.apartmentCache.size,
            roomIds: Array.from(this.apartmentCache.keys()),
            apartments: Array.from(this.apartmentCache.values()).map(apt => ({
                roomId: apt.roomId,
                roomName: apt.roomName
            }))
        };
    }

    /**
     * Recarga el caché desde la BD
     */
    public async reload(): Promise<void> {
        logInfo('APARTMENT_CACHE', 'Recargando caché de apartamentos...', {}, 'apartment-cache.service.ts');
        await this.initialize();
    }
}

// Exportar instancia singleton
export const apartmentCache = ApartmentCacheService.getInstance();