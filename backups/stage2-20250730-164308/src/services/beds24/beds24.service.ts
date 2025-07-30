import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { 
    Beds24ApiResponse, 
    RoomAvailability, 
    Room, 
    Property,
    AvailabilityQuery,
    AvailabilityInfo,
    Beds24Config,
    Beds24Error 
} from './beds24.types';
import { 
    logInfo, 
    logError, 
    logDebug, 
    logSuccess,
    logBeds24Request,
    logBeds24ApiCall,
    logBeds24ResponseDetail,
    logBeds24Processing
} from '../../utils/logging/index.js';

export class Beds24Service {
    private apiClient: AxiosInstance;
    private config: Beds24Config;

    constructor(config: Beds24Config) {
        this.config = config;
        
        // Configurar cliente HTTP
        this.apiClient = axios.create({
            baseURL: config.apiUrl,
            timeout: 15000, // 15 segundos timeout
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'token': config.apiToken // Long life token
            }
        });

        // Interceptor para logs de requests
        this.apiClient.interceptors.request.use(
            (config) => {
                logBeds24ApiCall(`${config.method?.toUpperCase()} ${config.url}`, {
                    method: config.method?.toUpperCase(),
                    url: config.url,
                    params: config.params,
                    endpoint: config.url?.split('?')[0]
                });
                return config;
            },
            (error) => {
                logError('BEDS24_API', 'Error en request', { error: error.message });
                return Promise.reject(error);
            }
        );

        // Interceptor para logs de responses
        this.apiClient.interceptors.response.use(
            (response) => {
                try {
                    logBeds24ResponseDetail(`Response: ${response.status}`, {
                        status: response.status,
                        url: response.config.url,
                        dataCount: response.data?.data?.length || 0,
                        success: response.data?.success,
                        responseLength: JSON.stringify(response.data).length
                    });
                } catch (logError) {
                    // 🔧 ETAPA 1: Capturar errores en logging para evitar crash
                    console.error('[ERROR] BEDS24_LOG_ERROR:', logError.message);
                }
                return response;
            },
            (error) => {
                try {
                    logError('BEDS24_API', 'Error en response', {
                        status: error.response?.status,
                        message: error.response?.data?.error || error.message,
                        url: error.config?.url
                    });
                } catch (logError) {
                    // 🔧 ETAPA 1: Capturar errores en logging para evitar crash
                    console.error('[ERROR] BEDS24_LOG_ERROR:', logError.message);
                }
                return Promise.reject(error);
            }
        );

        logSuccess('BEDS24_SERVICE', 'Servicio Beds24 inicializado', {
            apiUrl: config.apiUrl,
            hasToken: !!config.apiToken
        });
    }

    /**
     * Obtiene disponibilidad en tiempo real para fechas específicas
     */
    async getAvailability(query: AvailabilityQuery): Promise<AvailabilityInfo[]> {
        const startTime = Date.now();
        
        try {
            logBeds24Request('Consultando disponibilidad en tiempo real', {
                startDate: query.startDate,
                endDate: query.endDate,
                propertyId: query.propertyId,
                roomId: query.roomId,
                dateRange: `${query.startDate} to ${query.endDate}`
            });

            const response: AxiosResponse<Beds24ApiResponse<RoomAvailability>> = 
                await this.apiClient.get('/inventory/rooms/availability', {
                    params: {
                        ...(query.roomId && { roomId: query.roomId }),
                        ...(query.propertyId && { propertyId: query.propertyId }),
                        startDate: query.startDate,
                        endDate: query.endDate
                    }
                });

            if (!response.data.success) {
                throw new Beds24Error(
                    response.data.error || 'Error en API Beds24',
                    response.data.code
                );
            }

            const availability = response.data.data || [];
            
            logBeds24Processing('Procesando datos de disponibilidad', {
                rawDataCount: availability.length,
                startDate: query.startDate,
                endDate: query.endDate,
                processingStarted: true
            });
            
            const transformedData = this.transformAvailabilityData(availability, query);

            const duration = Date.now() - startTime;
            logBeds24Processing('Disponibilidad procesada exitosamente', {
                roomsCount: availability.length,
                transformedCount: transformedData.length,
                duration: `${duration}ms`,
                dateRange: `${query.startDate} a ${query.endDate}`,
                success: true
            });

            return transformedData;

        } catch (error) {
            const duration = Date.now() - startTime;
            
            try {
                logError('BEDS24_AVAILABILITY', 'Error obteniendo disponibilidad', {
                    error: error instanceof Error ? error.message : error,
                    duration: `${duration}ms`,
                    query
                });
            } catch (logError) {
                // 🔧 ETAPA 1: Capturar errores en logging para evitar crash
                console.error('[ERROR] BEDS24_LOG_ERROR:', logError.message);
            }

            // 🔧 ETAPA 1: Fallback simple en lugar de crash
            console.error('[ERROR] BEDS24_API_ERROR:', error instanceof Error ? error.message : error);
            
            // Retornar fallback simple para que OpenAI decida cómo responder
            return [{
                propertyName: 'Error en consulta',
                roomName: 'No disponible',
                available: false,
                dateRange: {
                    from: query.startDate,
                    to: query.endDate
                },
                availableDates: [],
                unavailableDates: [],
                totalDays: 0,
                availableDays: 0
            }];
        }
    }

    /**
     * Obtiene información de propiedades y habitaciones
     */
    async getProperties(propertyIds?: number[]): Promise<Property[]> {
        try {
            logBeds24Request('Obteniendo información de propiedades', {
                propertyIds: propertyIds || 'todas',
                requestType: 'properties',
                hasFilters: !!propertyIds
            });

            const response: AxiosResponse<Beds24ApiResponse<Property>> = 
                await this.apiClient.get('/properties', {
                    params: {
                        ...(propertyIds && { id: propertyIds })
                    }
                });

            if (!response.data.success) {
                throw new Beds24Error(
                    response.data.error || 'Error obteniendo propiedades',
                    response.data.code
                );
            }

            return response.data.data || [];

        } catch (error) {
            logError('BEDS24_PROPERTIES', 'Error obteniendo propiedades', {
                error: error instanceof Error ? error.message : error
            });
            throw error;
        }
    }

    /**
     * Obtiene información de habitaciones específicas
     */
    async getRooms(roomIds?: number[], propertyIds?: number[]): Promise<Room[]> {
        try {
            logBeds24Request('Obteniendo información de habitaciones', {
                roomIds: roomIds || 'todas',
                propertyIds: propertyIds || 'todas',
                requestType: 'rooms',
                hasRoomFilters: !!roomIds,
                hasPropertyFilters: !!propertyIds
            });

            const response: AxiosResponse<Beds24ApiResponse<Room>> = 
                await this.apiClient.get('/properties/rooms', {
                    params: {
                        ...(roomIds && { id: roomIds }),
                        ...(propertyIds && { propertyId: propertyIds })
                    }
                });

            if (!response.data.success) {
                throw new Beds24Error(
                    response.data.error || 'Error obteniendo habitaciones',
                    response.data.code
                );
            }

            return response.data.data || [];

        } catch (error) {
            logError('BEDS24_ROOMS', 'Error obteniendo habitaciones', {
                error: error instanceof Error ? error.message : error
            });
            throw error;
        }
    }

    /**
     * Transforma los datos de disponibilidad para el bot
     */
    private transformAvailabilityData(
        availability: RoomAvailability[], 
        query: AvailabilityQuery
    ): AvailabilityInfo[] {
        return availability.map(room => {
            const dates = Object.keys(room.availability);
            const availableDates = dates.filter(date => room.availability[date]);
            const unavailableDates = dates.filter(date => !room.availability[date]);
            
            const totalDays = dates.length;
            const availableDays = availableDates.length;
            const isAvailable = availableDays > 0;

            return {
                propertyName: `Propiedad ${room.propertyId}`,
                roomName: room.name,
                available: isAvailable,
                dateRange: {
                    from: query.startDate,
                    to: query.endDate
                },
                availableDates,
                unavailableDates,
                totalDays,
                availableDays
            };
        });
    }

    /**
     * Helper para consultas rápidas por fechas
     */
    async checkAvailabilityForDates(
        startDate: string,
        endDate: string,
        propertyId?: number,
        roomId?: number
    ): Promise<AvailabilityInfo[]> {
        const query: AvailabilityQuery = {
            startDate,
            endDate,
            ...(propertyId && { propertyId: [propertyId] }),
            ...(roomId && { roomId: [roomId] })
        };

        return this.getAvailability(query);
    }

    /**
     * Valida que el token sea válido usando el endpoint de autenticación
     */
    async validateToken(): Promise<boolean> {
        try {
            logDebug('BEDS24_AUTH', 'Validando token de autenticación');
            
            const response = await this.apiClient.get('/authentication/details');
            
            if (response.status === 200 && response.data.validToken === true) {
                logSuccess('BEDS24_AUTH', 'Token válido confirmado', {
                    scopes: response.data.scopes || 'No especificados'
                });
                return true;
            } else {
                logError('BEDS24_AUTH', 'Token inválido según endpoint details');
                return false;
            }

        } catch (error) {
            logError('BEDS24_AUTH', 'Error validando token', {
                error: error instanceof Error ? error.message : error
            });
            return false;
        }
    }

    /**
     * Método para verificar estado de la API
     */
    async healthCheck(): Promise<boolean> {
        try {
            logDebug('BEDS24_HEALTH', 'Verificando estado de API Beds24');
            
            // Primero validar el token
            const tokenValid = await this.validateToken();
            if (!tokenValid) {
                return false;
            }
            
            const response = await this.apiClient.get('/properties', {
                params: { page: 1 }
            });

            const isHealthy = response.status === 200 && response.data.success;
            
            if (isHealthy) {
                logSuccess('BEDS24_HEALTH', 'API Beds24 funcionando correctamente');
            } else {
                logError('BEDS24_HEALTH', 'API Beds24 no responde correctamente');
            }

            return isHealthy;

        } catch (error) {
            logError('BEDS24_HEALTH', 'Error en health check', {
                error: error instanceof Error ? error.message : error
            });
            return false;
        }
    }
}

// Instancia singleton del servicio
let serviceInstance: Beds24Service | null = null;

export function getBeds24Service(config?: Beds24Config): Beds24Service {
    if (!serviceInstance) {
        if (!config) {
            throw new Error('Configuración de Beds24 requerida para inicializar el servicio');
        }
        serviceInstance = new Beds24Service(config);
    }
    return serviceInstance;
} 