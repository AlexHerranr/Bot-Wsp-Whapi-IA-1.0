// src/plugins/hotel/services/beds24-client.ts
import { fetchWithRetry } from '../../../core/utils/retry-utils';
import { ApartmentDataService, ApartmentDetails } from './apartment-data.service';
import { 
    logBeds24Request, 
    logBeds24ApiCall, 
    logBeds24ResponseDetail,
    logError,
    logSuccess,
    logInfo
} from '../../../utils/logging';
// 🔧 NUEVO: Importar logging compacto
import { logBeds24Response } from '../../../utils/logging/integrations';

// Respuesta real de la API de Beds24
// Interface para datos básicos de Beds24
interface Beds24Availability {
    name: string;
    totalPrice: number;
    pricePerNight: number;
    isSplit: boolean;
    roomId?: number;
    propertyId?: number;
    available?: boolean;
    unitsAvailable?: number;
    priceBreakdown?: {
        basePrice: number;
        taxes: number;
        fees: number;
    };
}

// Interface enriquecida con datos locales de BD
interface EnrichedApartment extends Beds24Availability {
    roomName: string; // Nombre real del apartamento desde BD
    extraCharge: {
        description: string; // Texto completo desde BD
        amount: number;      // Valor numérico para cálculos
    };
}

// Combinación de apartamentos para grupos grandes
interface ApartmentCombination {
    apartments: Beds24Availability[];
    totalPrice: number;
    totalCapacity: number;
    distribution: string; // ej: "6+6" o "8+4"
}

interface Beds24ApiResponse {
    success: boolean;
    data?: any;
    error?: string;
    rooms?: any[];
    availability?: any[];
}

export class Beds24Client {
    private apiToken: string;
    private baseUrl: string;
    private timeout: number;
    private apartmentDataService: ApartmentDataService;

    constructor(apiToken?: string) {
        this.apiToken = apiToken || process.env.BEDS24_TOKEN || '';
        this.baseUrl = process.env.BEDS24_API_URL || 'https://api.beds24.com/v2';
        this.timeout = parseInt(process.env.BEDS24_TIMEOUT || '15000');
        this.apartmentDataService = new ApartmentDataService();

        if (!this.apiToken) {
            logError('BEDS24_CLIENT', 'Token de Beds24 no configurado', {
                tokenExists: !!this.apiToken,
                baseUrl: this.baseUrl
            }, 'beds24-client.ts');
        }
    }

    public async searchAvailability(options: {
        arrival: string;
        departure: string;
        numAdults: number;
    }): Promise<string> {
        const startTime = Date.now();

        try {
            if (!this.apiToken) {
                logError('BEDS24_API', 'Token no configurado - no se puede consultar disponibilidad', {}, 'beds24-client.ts');
                throw new Error('Token de Beds24 no configurado. Configurar BEDS24_TOKEN en variables de entorno.');
            }

            // Usar offers endpoint que filtra por número de personas
            const offersUrl = `${this.baseUrl}/inventory/rooms/offers`;
            const params = new URLSearchParams({
                arrival: options.arrival,
                departure: options.departure,
                numAdults: options.numAdults.toString(),
                offerId: '0'
            });

            const fullUrl = `${offersUrl}?${params.toString()}`;

            // Log the request with the full URL and base endpoint
            const parsedUrl = new URL(fullUrl);
            logBeds24Request('Consultando disponibilidad en Beds24 API', {
                arrival: options.arrival,
                departure: options.departure,
                numAdults: options.numAdults,
                url: fullUrl,
                baseEndpoint: parsedUrl.pathname,
                hasToken: !!this.apiToken
            });

            logBeds24ApiCall(`GET ${fullUrl}`, {
                method: 'GET',
                url: fullUrl,
                params: Object.fromEntries(params.entries()),
                timeout: this.timeout
            });

            // Realizar llamada HTTP real con reintentos
            const response = await fetchWithRetry(fullUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'token': this.apiToken // Beds24 usa header 'token' según Google Apps Script funcionando
                },
                retryOptions: {
                    maxRetries: 3,
                    baseDelay: 1000,
                    maxDelay: 5000,
                    backoffFactor: 2
                }
            });

            const data: Beds24ApiResponse = await response.json() as Beds24ApiResponse;
            const duration = Date.now() - startTime;
            
            // 📋 AUDIT LOG: Raw API Response (compacto)
            logInfo('BEDS24_RAW_RESPONSE', JSON.stringify(data), {}, 'beds24-client.ts');

            logBeds24ResponseDetail(`Response: ${response.status}`, {
                status: response.status,
                success: data.success,
                hasData: !!data.data,
                roomsCount: data.rooms?.length || 0,
                availabilityCount: data.availability?.length || 0,
                duration: `${duration}ms`,
                responseSize: JSON.stringify(data).length,
                rawResponse: data
            });

            // 🔧 NUEVO: Log compacto con datos raw completos
            const userId = (options as any).userId || 'system';
            logBeds24Response(
                userId,
                data, // Raw response completa
                `${duration}ms`, // Duration
                data.success || false // Success status
            );

            if (!data.success) {
                const errorMsg = data.error || 'Error desconocido';
                if (errorMsg.includes('past dates') || errorMsg.includes('invalid date') || errorMsg.includes('date is in the past')) {
                    return `Nota interna: Por la hora actual de la consulta (diferencia de zona horaria), el sistema no muestra disponibilidad para hoy. Dile al cliente que si necesita entrar hoy, puede llamar directamente al 3023371476 para asistencia manual.`;
                }
                throw new Error(errorMsg);
            }

            // Filtrar apartamentos realmente disponibles para las fechas solicitadas
            const availableApartments = this.filterAvailableRooms(data, options);
            
            // Si no hay apartamentos disponibles, retornar mensaje
            if (availableApartments.length === 0) {
                return `Desafortunadamente, no hay disponibilidad para las fechas solicitadas (${this.formatDate(options.arrival)} a ${this.formatDate(options.departure)}). Sugiere al cliente otras fechas o alternativas.`;
            }

            // Enriquecer con datos locales de BD
            const enrichedApartments = await this.enrichWithLocalData(availableApartments);

            // Formatear respuesta enriquecida para OpenAI
            const formattedResponse = this.formatEnrichedResponse(enrichedApartments, options);
            
            // 📋 AUDIT LOG: Data sent to OpenAI (compacto)
            logInfo('TO_OPENAI_DATA', formattedResponse, {}, 'beds24-client.ts');

            logSuccess('BEDS24_CLIENT', 'Disponibilidad obtenida exitosamente', {
                apartmentsFound: availableApartments.length,
                duration: `${duration}ms`,
                dateRange: `${options.arrival} - ${options.departure}`,
                numAdults: options.numAdults
            }, 'beds24-client.ts');

            // Log técnico: texto completo con caracteres especiales visibles
            const escapedText = formattedResponse
                .replace(/\n/g, '\\n')
                .replace(/\t/g, '\\t')
                .replace(/\r/g, '\\r');
            
            logInfo('HOTEL_AVAILABILITY_RESULT', `Texto enviado a OpenAI: ${escapedText}`, {}, 'beds24-client.ts');

            // 🔧 NUEVO: Log compacto específico con resumen técnico
            logInfo('HOTEL_AVAILABILITY', `${options.arrival}_${options.departure}_${options.numAdults}adl | ${availableApartments.length}apts | ${duration}ms | BD:OK | Ages:MISS | ${formattedResponse.length}chars`, {}, 'beds24-client.ts');

            return formattedResponse;

        } catch (error: any) {
            const duration = Date.now() - startTime;
            
            logError('BEDS24_CLIENT', 'Error consultando disponibilidad', {
                error: error.message,
                duration: `${duration}ms`,
                options,
                apiUrl: this.baseUrl,
                hasToken: !!this.apiToken
            }, 'beds24-client.ts');

            // 🔧 NUEVO: Log error compacto
            const userId = (options as any).userId || 'system';
            logBeds24Response(
                userId,
                { error: error.message, success: false },
                `${duration}ms`,
                false // Error occurred
            );

            // Retornar mensaje de error específico para OpenAI
            return `Error al consultar la API de Beds24. Indica al cliente que hay un problema temporal en el sistema y que con gusto se le ayudará más tarde o por otro canal.`;
        }
    }

    // Filtrar apartamentos disponibles usando datos del endpoint /offers
    private filterAvailableRooms(data: Beds24ApiResponse, options: any): Beds24Availability[] {
        const rooms = data.data || [];
        const totalNights = this.calculateNights(options.arrival, options.departure);
        
        return rooms
            .filter((room: any) => {
                // Verificar que tenga offers disponibles
                return room.offers && room.offers.length > 0;
            })
            .map((room: any) => {
                // Obtener la primera oferta disponible
                const offer = room.offers[0];
                const totalPrice = offer.price || 0;
                const pricePerNight = totalNights > 0 ? Math.round(totalPrice / totalNights) : 0;
                
                return {
                    name: `Room ${room.roomId}`, // Nombre temporal, se enriquecerá con BD
                    totalPrice: totalPrice,
                    pricePerNight: pricePerNight,
                    isSplit: false,
                    roomId: room.roomId,
                    propertyId: room.propertyId,
                    available: true,
                    unitsAvailable: offer.unitsAvailable || 1,
                    priceBreakdown: {
                        basePrice: totalPrice,
                        taxes: 0,
                        fees: 0
                    }
                };
            });
    }

    // Generar rango de fechas entre arrival y departure
    private getDateRange(startDate: string, endDate: string): string[] {
        const dates: string[] = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // No incluir la fecha de salida (checkout)
        while (start < end) {
            dates.push(start.toISOString().split('T')[0]);
            start.setDate(start.getDate() + 1);
        }
        
        return dates;
    }

    // Formatear respuesta simple para OpenAI
    private formatSimpleResponse(apartments: Beds24Availability[], options: any): string {
        const startDate = this.formatDate(options.arrival);
        const endDate = this.formatDate(options.departure);
        const totalNights = this.calculateNights(options.arrival, options.departure);

        let response = `Apartamentos Disponibles del ${startDate} al ${endDate} (${totalNights} ${totalNights === 1 ? 'noche' : 'noches'})\n\n`;
        
        // Ordenar por nombre
        const sortedApartments = [...apartments]
            .sort((a, b) => a.name.localeCompare(b.name));
        
        sortedApartments.forEach((apt, index) => {
            response += `${index + 1}. ${apt.name}\n`;
            response += `$${apt.pricePerNight.toLocaleString()}/noche\n`;
            response += `$${apt.totalPrice.toLocaleString()} total\n\n`;
        });

        return response.trim();
    }

    // Enriquecer apartamentos con datos locales de BD (optimizado con Map)
    private async enrichWithLocalData(apartments: Beds24Availability[]): Promise<EnrichedApartment[]> {
        try {
            // Extraer roomIds
            const roomIds = apartments
                .map(apt => apt.roomId)
                .filter((id): id is number => id !== undefined);

            if (roomIds.length === 0) {
                // Fallback: retornar con defaults si no hay roomIds
                return apartments.map(apt => ({
                    ...apt,
                    roomName: `Apartamento ${apt.roomId}`,
                    extraCharge: {
                        description: "Cargo adicional:",
                        amount: 70000
                    }
                }));
            }

            // Consulta optimizada con Map lookup
            const apartmentDetailsMap = await this.apartmentDataService.getApartmentDetails(roomIds);
            
            // Merge optimizado O(1) lookup
            const enrichedApartments: EnrichedApartment[] = apartments.map(apt => {
                const details = apt.roomId ? apartmentDetailsMap.get(apt.roomId) : null;
                
                return {
                    ...apt,
                    roomName: details?.roomName || `Apartamento ${apt.roomId}`,
                    extraCharge: details?.extraCharge || {
                        description: "Cargo adicional:",
                        amount: 70000
                    }
                };
            });

            return enrichedApartments;

        } catch (error) {
            logError('BEDS24_CLIENT', 'Error enriching with local data', {
                error: error instanceof Error ? error.message : 'Unknown error',
                apartmentCount: apartments.length
            }, 'beds24-client.ts');

            // Fallback: retornar con defaults en caso de error BD
            return apartments.map(apt => ({
                ...apt,
                roomName: `Apartamento ${apt.roomId}`,
                extraCharge: {
                    description: "Cargo adicional:",
                    amount: 70000
                }
            }));
        }
    }

    // Formatear respuesta enriquecida para OpenAI usando datos de /offers
    private formatEnrichedResponse(apartments: EnrichedApartment[], options: any): string {
        const startDate = this.formatDate(options.arrival);
        const endDate = this.formatDate(options.departure);
        const totalNights = this.calculateNights(options.arrival, options.departure);
        const numAdults = options.numAdults;

        let response = `${apartments.length} Apartamentos Disponibles del ${startDate} al ${endDate} (${totalNights} ${totalNights === 1 ? 'noche' : 'noches'}) para ${numAdults} ${numAdults === 1 ? 'persona' : 'personas'}\n\n`;
        
        // Ordenar por precio total
        const sortedApartments = [...apartments]
            .sort((a, b) => a.totalPrice - b.totalPrice);
        
        sortedApartments.forEach((apt, index) => {
            // Calcular total final con cargo extra
            const totalFinal = apt.totalPrice + apt.extraCharge.amount;
            
            response += `${index + 1}. 🏠 ${apt.roomName}\n`;
            response += `$${apt.pricePerNight.toLocaleString()}/noche × ${totalNights} noches = $${apt.totalPrice.toLocaleString()}\n`;
            response += `${apt.extraCharge.description} $${apt.extraCharge.amount.toLocaleString()}\n`;
            response += `Total: $${totalFinal.toLocaleString()}\n`;
            
            // Mostrar disponibilidad si es relevante
            if (apt.unitsAvailable && apt.unitsAvailable > 1) {
                response += `Disponibilidad: ${apt.unitsAvailable} unidades\n`;
            }
            
            response += `\n`;
        });

        // Nota importante sobre validación de capacidad
        response += `✓ Todos los apartamentos mostrados han sido validados para ${numAdults} ${numAdults === 1 ? 'persona' : 'personas'}`;

        return response.trim();
    }

    private formatDate(dateStr: string): string {
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    }

    private calculateNights(start: string, end: string): number {
        const startDate = new Date(start);
        const endDate = new Date(end);
        return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
    }

}