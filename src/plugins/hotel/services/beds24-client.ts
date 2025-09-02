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
    capacity: number; // Capacidad máxima del apartamento
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

// Nuevas interfaces para métodos extendidos
interface BookingSearchFilters {
    arrival?: string;
    departure?: string;
    arrivalFrom?: string;
    arrivalTo?: string;
    departureFrom?: string;
    departureTo?: string;
    includeInvoiceItems?: boolean;
    includeInfoItems?: boolean;
    searchString?: string;
    status?: string | string[];
    bookingId?: string;
    includeGuests?: boolean;
    includeBookingGroup?: boolean;
}

interface CreateBookingData {
    roomId: number;
    arrival: string;
    departure: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    numAdult: number;
    numChild?: number;
    status?: string;
    referer?: string;
    notes?: string;
    invoiceItems?: any[];
}

interface UpdateBookingData {
    id: number;
    status?: string;
    invoiceItems?: any[];
    notes?: string;
}

interface AuthResponse {
    token: string;
    expiresIn?: number;
}

export class Beds24Client {
    private apiToken: string;
    private writeToken: string;
    private baseUrl: string;
    private timeout: number;
    private apartmentDataService: ApartmentDataService;

    constructor(apiToken?: string) {
        this.apiToken = apiToken || process.env.BEDS24_TOKEN || '';
        this.writeToken = process.env.BEDS24_WRITE_REFRESH_TOKEN || '';
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
            // Extraer roomIds y propertyIds
            const roomIds = apartments
                .map(apt => apt.roomId)
                .filter((id): id is number => id !== undefined);
            
            const propertyIds = apartments
                .map(apt => apt.propertyId)
                .filter((id): id is number => id !== undefined);

            // Primero intentar por roomIds si existen
            let apartmentDetailsMap = new Map<number, ApartmentDetails>();
            
            if (roomIds.length > 0) {
                apartmentDetailsMap = await this.apartmentDataService.getApartmentDetails(roomIds);
            }
            
            // Si no encontramos todos por roomId, intentar por propertyId
            if (apartmentDetailsMap.size < apartments.length && propertyIds.length > 0) {
                const apartmentDetailsByProperty = await this.apartmentDataService.getApartmentDetailsByPropertyIds(propertyIds);
                
                // Merge ambos mapas
                apartmentDetailsByProperty.forEach((details, propertyId) => {
                    // Solo agregar si no lo encontramos por roomId
                    const apartment = apartments.find(apt => apt.propertyId === propertyId);
                    if (apartment && apartment.roomId && !apartmentDetailsMap.has(apartment.roomId)) {
                        apartmentDetailsMap.set(apartment.roomId, details);
                    }
                });
            }
            
            // Merge optimizado O(1) lookup
            const enrichedApartments: EnrichedApartment[] = apartments.map(apt => {
                let details = null;
                
                // Primero buscar por roomId
                if (apt.roomId) {
                    details = apartmentDetailsMap.get(apt.roomId);
                }
                
                // Si no encontramos por roomId, buscar por propertyId en el mismo mapa
                if (!details && apt.propertyId) {
                    // Buscar en el mapa si hay algún apartment con este propertyId
                    for (const [_, aptDetails] of apartmentDetailsMap) {
                        if (aptDetails.propertyId === apt.propertyId) {
                            details = aptDetails;
                            break;
                        }
                    }
                }
                
                return {
                    ...apt,
                    roomName: details?.roomName || `Apartamento ${apt.propertyId || apt.roomId}`,
                    extraCharge: details?.extraCharge || {
                        description: "Aseo y Registro:",
                        amount: 70000
                    },
                    capacity: details?.capacity || 4 // Default capacity si no se encuentra
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
                },
                capacity: 4 // Default capacity
            }));
        }
    }

    // Formatear respuesta enriquecida para OpenAI usando datos de /offers
    private formatEnrichedResponse(apartments: EnrichedApartment[], options: any): string {
        const startDate = this.formatDate(options.arrival);
        const endDate = this.formatDate(options.departure);
        const totalNights = this.calculateNights(options.arrival, options.departure);
        const numAdults = options.numAdults;
        
        // Obtener fecha de entrada y salida sin año para formato más limpio
        const [yearStart, monthStart, dayStart] = options.arrival.split('-');
        const [yearEnd, monthEnd, dayEnd] = options.departure.split('-');
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                           'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        
        const entryMonth = monthNames[parseInt(monthStart) - 1];
        const exitMonth = monthNames[parseInt(monthEnd) - 1];
        
        // Hora actual Colombia para validación
        const colombiaTime = new Date().toLocaleString('es-CO', {
            timeZone: 'America/Bogota',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        let response = `Tenemos ${apartments.length} Apto${apartments.length === 1 ? '' : 's'} Disponible${apartments.length === 1 ? '' : 's'},\n`;
        response += `entrando el ${dayStart} y saliendo ${dayEnd} de ${entryMonth} de ${yearStart},\n`;
        response += `para (${totalNights} ${totalNights === 1 ? 'noche' : 'noches'}) para ${numAdults} ${numAdults === 1 ? 'persona' : 'personas'}.\n\n`;
        
        // Ordenar por precio total
        const sortedApartments = [...apartments]
            .sort((a, b) => a.totalPrice - b.totalPrice);
        
        sortedApartments.forEach((apt, index) => {
            // Calcular total final con cargo extra
            const totalFinal = apt.totalPrice + apt.extraCharge.amount;
            
            response += `*${apt.roomName}*\n`;
            // Mostrar capacidad si es relevante
            if (apt.capacity && (numAdults >= apt.capacity - 1 || numAdults > 2)) {
                response += `- Capacidad máxima: ${apt.capacity} personas\n`;
            }
            response += `- $${apt.pricePerNight.toLocaleString()}/noche × ${totalNights} = $${apt.totalPrice.toLocaleString()}\n`;
            response += `- ${apt.extraCharge.description} $${apt.extraCharge.amount.toLocaleString()}\n`;
            response += `- Total: $${totalFinal.toLocaleString()}\n`;
            
            // Solo agregar línea en blanco si no es el último apartamento
            if (index < sortedApartments.length - 1) {
                response += `\n`;
            }
        });

        // Nota final con hora de validación
        response += `\n\nDisponibilidad Validada a las ${colombiaTime}`;

        return response;
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

    // =========================================================================
    // NUEVOS MÉTODOS EXTENDIDOS PARA MIGRACIÓN
    // =========================================================================

    /**
     * Buscar reservas en Beds24 con filtros flexibles
     */
    public async searchBookings(filters: BookingSearchFilters): Promise<any> {
        const startTime = Date.now();

        try {
            if (!this.apiToken) {
                throw new Error('Token de Beds24 no configurado');
            }

            const params = new URLSearchParams();
            
            // Agregar filtros dinámicamente con manejo especial para arrays
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined) {
                    if (key === 'status' && Array.isArray(value)) {
                        // Para arrays de status, agregar cada valor por separado
                        value.forEach((status: string) => {
                            params.append('status', status);
                        });
                    } else {
                        params.append(key, value.toString());
                    }
                }
            });

            const fullUrl = `${this.baseUrl}/bookings?${params.toString()}`;

            logBeds24ApiCall(`GET ${fullUrl}`, {
                method: 'GET',
                filters,
                timeout: this.timeout
            });

            const response = await fetchWithRetry(fullUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'token': this.apiToken
                },
                retryOptions: {
                    maxRetries: 3,
                    baseDelay: 1000,
                    maxDelay: 5000,
                    backoffFactor: 2
                }
            });

            const data: any = await response.json();
            const duration = Date.now() - startTime;

            logBeds24ResponseDetail(`Search bookings response: ${response.status}`, {
                status: response.status,
                hasData: !!data.data,
                bookingsCount: data.data?.length || 0,
                duration: `${duration}ms`,
                filters
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} - ${data.error || 'Unknown error'}`);
            }

            logSuccess('BEDS24_CLIENT', 'Búsqueda de reservas exitosa', {
                bookingsFound: data.data?.length || 0,
                duration: `${duration}ms`,
                filters
            }, 'beds24-client.ts');

            return data; // Retorna respuesta raw para consistencia
        } catch (error: any) {
            const duration = Date.now() - startTime;
            
            logError('BEDS24_CLIENT', 'Error buscando reservas', {
                error: error.message,
                duration: `${duration}ms`,
                filters
            }, 'beds24-client.ts');

            throw error;
        }
    }

    /**
     * Búsqueda optimizada de reservas con parámetros completos
     * Incluye invoiceItems directamente para evitar segunda llamada API
     */
    public async searchBookingsOptimized(params: {
        firstName: string;
        lastName: string;
        arrival: string;
        status?: string[];
    }): Promise<any> {
        // SIN searchString - obtener todas las reservas para hacer validación estricta
        const filters: BookingSearchFilters = {
            arrival: params.arrival,
            status: params.status || ['confirmed', 'new'], 
            includeInvoiceItems: true,
            includeInfoItems: true,
            includeGuests: true,
            includeBookingGroup: true
        };

        logInfo('BEDS24_SECURE_SEARCH', 'Búsqueda segura sin searchString', {
            searchTerms: `${params.firstName} ${params.lastName}`,
            arrival: params.arrival,
            status: params.status || ['confirmed', 'new']
        }, 'beds24-client.ts');

        return await this.searchBookings(filters);
    }

    /**
     * Crear múltiples reservas en Beds24 (batch operation)
     */
    public async createMultipleBookings(bookingDataArray: any[]): Promise<any> {
        const startTime = Date.now();

        try {
            const accessToken = await this.getWriteToken();

            logBeds24ApiCall(`POST ${this.baseUrl}/bookings (batch)`, {
                method: 'POST',
                bookingCount: bookingDataArray.length,
                roomIds: bookingDataArray.map(b => b.roomId)
            });

            const response = await fetchWithRetry(`${this.baseUrl}/bookings`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'token': accessToken
                },
                body: JSON.stringify(bookingDataArray), // Array directo según documentación
                retryOptions: {
                    maxRetries: 2,
                    baseDelay: 1000,
                    maxDelay: 3000,
                    backoffFactor: 2
                }
            });

            const data = await response.json();
            const duration = Date.now() - startTime;

            logBeds24ResponseDetail(`Create multiple bookings response: ${response.status}`, {
                status: response.status,
                bookingCount: Array.isArray(data) ? data.length : 0,
                successCount: Array.isArray(data) ? data.filter((b: any) => b.new).length : 0,
                duration: `${duration}ms`
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} - ${JSON.stringify(data)}`);
            }

            logSuccess('BEDS24_CLIENT', 'Múltiples reservas creadas exitosamente', {
                bookingCount: Array.isArray(data) ? data.length : 0,
                bookingIds: Array.isArray(data) ? data.map((b: any) => b.new?.id).filter(Boolean) : [],
                duration: `${duration}ms`
            }, 'beds24-client.ts');

            return data;
        } catch (error: any) {
            const duration = Date.now() - startTime;
            
            logError('BEDS24_CLIENT', 'Error creando múltiples reservas', {
                error: error.message,
                duration: `${duration}ms`,
                bookingCount: bookingDataArray.length
            }, 'beds24-client.ts');

            throw error;
        }
    }

    /**
     * Crear nueva reserva en Beds24 (single booking)
     */
    public async createBooking(bookingData: CreateBookingData): Promise<any> {
        const startTime = Date.now();

        try {
            const accessToken = await this.getWriteToken();
            
            const bookingArray = [bookingData]; // Beds24 API espera array

            logBeds24ApiCall(`POST ${this.baseUrl}/bookings`, {
                method: 'POST',
                roomId: bookingData.roomId,
                arrival: bookingData.arrival,
                departure: bookingData.departure
            });

            const response = await fetchWithRetry(`${this.baseUrl}/bookings`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'token': accessToken
                },
                body: JSON.stringify(bookingArray),
                retryOptions: {
                    maxRetries: 2,
                    baseDelay: 1000,
                    maxDelay: 3000,
                    backoffFactor: 2
                }
            });

            const data = await response.json();
            const duration = Date.now() - startTime;

            logBeds24ResponseDetail(`Create booking response: ${response.status}`, {
                status: response.status,
                success: !!data[0]?.new,
                bookingId: data[0]?.new?.id,
                duration: `${duration}ms`
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} - ${JSON.stringify(data)}`);
            }

            logSuccess('BEDS24_CLIENT', 'Reserva creada exitosamente', {
                bookingId: data[0]?.new?.id,
                duration: `${duration}ms`
            }, 'beds24-client.ts');

            return data;
        } catch (error: any) {
            const duration = Date.now() - startTime;
            
            logError('BEDS24_CLIENT', 'Error creando reserva', {
                error: error.message,
                duration: `${duration}ms`,
                bookingData: {
                    roomId: bookingData.roomId,
                    arrival: bookingData.arrival,
                    departure: bookingData.departure
                }
            }, 'beds24-client.ts');

            throw error;
        }
    }

    /**
     * Actualizar reserva existente en Beds24
     */
    public async performChannelAction(action: 'reportCancel' | 'reportNoShow', bookingId: number): Promise<any> {
        const startTime = Date.now();

        try {
            const accessToken = await this.getWriteToken();

            logBeds24ApiCall(`POST ${this.baseUrl}/channels/booking (${action})`, {
                method: 'POST',
                action: action,
                bookingId: bookingId
            });

            const requestBody = [{
                action: action,
                bookingId: bookingId
            }];

            const response = await fetchWithRetry(`${this.baseUrl}/channels/booking`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'token': accessToken
                },
                body: JSON.stringify(requestBody),
                retryOptions: {
                    maxRetries: 2,
                    baseDelay: 1000,
                    maxDelay: 3000,
                    backoffFactor: 2
                }
            });

            const data = await response.json();
            const duration = Date.now() - startTime;

            logBeds24ResponseDetail(`Channel action ${action} response: ${response.status}`, {
                status: response.status,
                success: response.ok,
                bookingId: bookingId,
                action: action,
                duration: `${duration}ms`
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} - ${JSON.stringify(data)}`);
            }

            logSuccess('BEDS24_CLIENT', `Acción ${action} ejecutada exitosamente`, {
                bookingId: bookingId,
                action: action,
                duration: `${duration}ms`
            }, 'beds24-client.ts');

            return data;
        } catch (error) {
            const duration = Date.now() - startTime;
            logError('BEDS24_CLIENT', `Error ejecutando ${action}: ${error.message}`, {
                bookingId: bookingId,
                action: action,
                duration: `${duration}ms`,
                error: error
            }, 'beds24-client.ts');
            throw error;
        }
    }

    public async deleteBooking(bookingId: number): Promise<any> {
        const startTime = Date.now();

        try {
            const accessToken = await this.getWriteToken();

            logBeds24ApiCall(`DELETE ${this.baseUrl}/bookings?id=${bookingId}`, {
                method: 'DELETE',
                bookingId: bookingId
            });

            const response = await fetchWithRetry(`${this.baseUrl}/bookings?id=${bookingId}`, {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json',
                    'token': accessToken
                },
                retryOptions: {
                    maxRetries: 2,
                    baseDelay: 1000,
                    maxDelay: 3000,
                    backoffFactor: 2
                }
            });

            const data = await response.json();
            const duration = Date.now() - startTime;

            logBeds24ResponseDetail(`Delete booking response: ${response.status}`, {
                status: response.status,
                success: response.ok,
                bookingId: bookingId,
                duration: `${duration}ms`
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} - ${JSON.stringify(data)}`);
            }

            logSuccess('BEDS24_CLIENT', 'Reserva eliminada exitosamente', {
                bookingId: bookingId,
                duration: `${duration}ms`
            }, 'beds24-client.ts');

            return data;
        } catch (error) {
            const duration = Date.now() - startTime;
            logError('BEDS24_CLIENT', `Error eliminando reserva: ${error.message}`, {
                bookingId: bookingId,
                duration: `${duration}ms`,
                error: error
            }, 'beds24-client.ts');
            throw error;
        }
    }

    public async updateBooking(updateData: UpdateBookingData): Promise<any> {
        const startTime = Date.now();

        try {
            const accessToken = await this.getWriteToken();
            
            const updateArray = [updateData]; // Beds24 API espera array

            logBeds24ApiCall(`POST ${this.baseUrl}/bookings (update)`, {
                method: 'POST',
                bookingId: updateData.id,
                hasStatus: !!updateData.status,
                hasInvoiceItems: !!updateData.invoiceItems
            });

            const response = await fetchWithRetry(`${this.baseUrl}/bookings`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'token': accessToken
                },
                body: JSON.stringify(updateArray),
                retryOptions: {
                    maxRetries: 2,
                    baseDelay: 1000,
                    maxDelay: 3000,
                    backoffFactor: 2
                }
            });

            const data = await response.json();
            const duration = Date.now() - startTime;

            logBeds24ResponseDetail(`Update booking response: ${response.status}`, {
                status: response.status,
                success: !!data[0]?.modified,
                bookingId: updateData.id,
                duration: `${duration}ms`
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} - ${JSON.stringify(data)}`);
            }

            logSuccess('BEDS24_CLIENT', 'Reserva actualizada exitosamente', {
                bookingId: updateData.id,
                duration: `${duration}ms`
            }, 'beds24-client.ts');

            return data;
        } catch (error: any) {
            const duration = Date.now() - startTime;
            
            logError('BEDS24_CLIENT', 'Error actualizando reserva', {
                error: error.message,
                duration: `${duration}ms`,
                bookingId: updateData.id
            }, 'beds24-client.ts');

            throw error;
        }
    }

    /**
     * Obtener movimientos del día específico (wrapper optimizado)
     */
    public async getTomorrowMovements(date: string): Promise<{
        entradas: any,
        salidas: any,
        ocupados: any,
        proximas: any
    }> {
        const startTime = Date.now();

        try {
            logInfo('BEDS24_CLIENT', `Consultando movimientos para fecha: ${date}`, { date }, 'beds24-client.ts');

            // Calcular fecha límite (30 días después para próximas reservas)
            const fechaLimite = new Date(date);
            fechaLimite.setDate(fechaLimite.getDate() + 30);
            const fechaLimiteStr = fechaLimite.toISOString().split('T')[0];

            // Ejecutar todas las consultas en paralelo para mejor performance
            const [entradas, salidas, ocupados, proximas] = await Promise.all([
                // ENTRADAS del día
                this.searchBookings({
                    arrivalFrom: date,
                    arrivalTo: date,
                    includeInvoiceItems: true,
                    includeInfoItems: true
                }),
                // SALIDAS del día
                this.searchBookings({
                    departureFrom: date,
                    departureTo: date,
                    includeInvoiceItems: true,
                    includeInfoItems: true
                }),
                // OCUPADOS (llegaron antes, salen después)
                this.searchBookings({
                    arrivalTo: date,
                    departureFrom: date,
                    includeInvoiceItems: true,
                    includeInfoItems: true
                }),
                // PRÓXIMAS RESERVAS (30 días)
                this.searchBookings({
                    arrivalFrom: date,
                    arrivalTo: fechaLimiteStr,
                    includeInvoiceItems: false,
                    includeInfoItems: false
                })
            ]);

            const duration = Date.now() - startTime;

            logSuccess('BEDS24_CLIENT', 'Movimientos obtenidos exitosamente', {
                entradas: entradas.data?.length || 0,
                salidas: salidas.data?.length || 0,
                ocupados: ocupados.data?.length || 0,
                proximas: proximas.data?.length || 0,
                duration: `${duration}ms`,
                date
            }, 'beds24-client.ts');

            return { entradas, salidas, ocupados, proximas };
        } catch (error: any) {
            const duration = Date.now() - startTime;
            
            logError('BEDS24_CLIENT', 'Error obteniendo movimientos', {
                error: error.message,
                duration: `${duration}ms`,
                date
            }, 'beds24-client.ts');

            throw error;
        }
    }

    /**
     * Obtener detalles de invoice para una reserva
     */
    public async getInvoiceDetails(bookingId: number): Promise<any> {
        const startTime = Date.now();

        try {
            if (!this.apiToken) {
                throw new Error('Token de Beds24 no configurado');
            }

            const params = new URLSearchParams({ 'bookingId': bookingId.toString() });
            const fullUrl = `${this.baseUrl}/bookings/invoices?${params.toString()}`;

            logBeds24ApiCall(`GET ${fullUrl}`, {
                method: 'GET',
                bookingId,
                timeout: this.timeout
            });

            const response = await fetchWithRetry(fullUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'token': this.apiToken
                },
                retryOptions: {
                    maxRetries: 3,
                    baseDelay: 1000,
                    maxDelay: 5000,
                    backoffFactor: 2
                }
            });

            const data: any = await response.json();
            const duration = Date.now() - startTime;

            logBeds24ResponseDetail(`Get invoice response: ${response.status}`, {
                status: response.status,
                hasData: !!data.data,
                invoicesCount: data.data?.length || 0,
                duration: `${duration}ms`,
                bookingId
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} - ${data.error || 'Unknown error'}`);
            }

            logSuccess('BEDS24_CLIENT', 'Invoice obtenido exitosamente', {
                bookingId,
                invoicesCount: data.data?.length || 0,
                duration: `${duration}ms`
            }, 'beds24-client.ts');

            return data;
        } catch (error: any) {
            const duration = Date.now() - startTime;
            
            logError('BEDS24_CLIENT', 'Error obteniendo invoice', {
                error: error.message,
                duration: `${duration}ms`,
                bookingId
            }, 'beds24-client.ts');

            return { data: [], error: error.message }; // Graceful fallback
        }
    }

    /**
     * Método privado para obtener token de escritura
     */
    private async getWriteToken(): Promise<string> {
        try {
            // Intentar refresh token flow primero
            const authResponse = await fetchWithRetry(`${this.baseUrl}/authentication/token`, {
                method: 'GET',
                headers: {
                    'refreshToken': this.writeToken
                },
                retryOptions: {
                    maxRetries: 2,
                    baseDelay: 500,
                    maxDelay: 2000,
                    backoffFactor: 2
                }
            });

            const authData: any = await authResponse.json();

            if (!authResponse.ok || !authData.token) {
                throw new Error('Refresh token failed');
            }

            logInfo('BEDS24_CLIENT', 'Access token obtenido via refresh token', {
                expiresIn: authData.expiresIn
            }, 'beds24-client.ts');

            return authData.token;
        } catch (authError) {
            // Fallback: usar token directo
            logInfo('BEDS24_CLIENT', 'Refresh token falló, usando token directo', {
                error: authError instanceof Error ? authError.message : 'Unknown error'
            }, 'beds24-client.ts');

            if (!this.writeToken) {
                throw new Error('No se pudo obtener access token y no hay token directo disponible');
            }

            return this.writeToken;
        }
    }

}