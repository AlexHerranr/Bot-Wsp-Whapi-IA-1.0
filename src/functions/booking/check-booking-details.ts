/**
 * check-booking-details: Función completa para consultar reservas existentes
 * 
 * ARQUITECTURA:
 * Cliente → OpenAI → check_booking_details() → [Beds24 API + PostgreSQL] → Respuesta Filtrada
 * 
 * FUENTES DE DATOS:
 * 1. Beds24 API /bookings - Datos de reserva
 * 2. Beds24 API /invoices - Desglose financiero  
 * 3. PostgreSQL apartamentos - Nombres reales
 * 
 * FILTRADO POR CANAL:
 * - Booking.com/Direct: Respuesta completa con finanzas
 * - Airbnb/Expedia/OTAs: Solo datos básicos
 */

import { PrismaClient } from '@prisma/client';
import type { FunctionDefinition } from '../types/function-types.js';

// Logging simple para el sistema
const logInfo = (category: string, message: string, data: any = {}, file: string = '') => 
  console.log(`[INFO] ${category}: ${message}`, data);
const logError = (category: string, message: string, data: any = {}, file: string = '') => 
  console.error(`[ERROR] ${category}: ${message}`, data);
const logSuccess = (category: string, message: string, data: any = {}, file: string = '') => 
  console.log(`[SUCCESS] ${category}: ${message}`, data);

// Using imported FunctionDefinition from types/function-types.ts

// Interface para datos de apartamento desde BD
interface ApartmentDetails {
    propertyId: number;
    roomId: number;
    roomName: string;
    extraCharge: {
        description: string;
        amount: number;
    };
}

// Función auxiliar para calcular distancia de Levenshtein (similaridad de nombres)
function levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    const len1 = str1.length;
    const len2 = str2.length;

    for (let i = 0; i <= len2; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= len1; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= len2; i++) {
        for (let j = 1; j <= len1; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[len2][len1];
}

// Función auxiliar para calcular número de noches
function calculateNights(checkIn: string, checkOut: string): number {
    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Función para obtener invoice items detallados
async function getInvoiceDetails(token: string, apiUrl: string, bookingId: number) {
    try {
        const searchParams = new URLSearchParams({ 'bookingId': bookingId.toString() });
        const invoiceUrl = `${apiUrl}/bookings/invoices?${searchParams.toString()}`;

        const response = await fetch(invoiceUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'token': token
            }
        });

        if (!response.ok) {
            logError('INVOICE_API', `Error consultando invoices: ${response.status}`, { bookingId, status: response.status }, 'check-booking-details.ts');
            return { items: [], total: 0, raw: null };
        }

        const invoiceResponse = await response.json();
        const invoices = (invoiceResponse as any).data || [];
        
        if (!Array.isArray(invoices) || invoices.length === 0) {
            return { items: [], total: 0, raw: invoiceResponse };
        }

        // Procesar invoice items
        const allItems: any[] = [];
        let totalInvoice = 0;

        for (const invoice of invoices) {
            const items = invoice.invoiceItems || [];
            for (const item of items) {
                allItems.push({
                    id: item.id,
                    type: item.type,
                    description: item.description,
                    quantity: item.qty,
                    amount: item.amount,
                    lineTotal: item.lineTotal,
                    vatRate: item.vatRate,
                    status: item.status
                });
                totalInvoice += item.lineTotal || item.amount || 0;
            }
        }

        return {
            items: allItems,
            total: totalInvoice,
            raw: invoiceResponse
        };

    } catch (error) {
        logError('INVOICE_API', 'Error consultando invoices', { error: error instanceof Error ? error.message : error, bookingId }, 'check-booking-details.ts');
        return { items: [], total: 0, raw: null };
    }
}

// Función para extraer tipo de habitación del mensaje API
function extractRoomType(apiMessage: string): string {
    if (!apiMessage) return 'Habitación';
    
    // Buscar "Room: " seguido del tipo
    const match = apiMessage.match(/Room:\s*([^\n]+)/i);
    if (match && match[1]) {
        return match[1].trim();
    }
    
    return 'Habitación';
}

// Función para obtener detalles del apartamento desde BD
async function getApartmentDetails(roomId: number): Promise<ApartmentDetails | null> {
    let prisma: PrismaClient | null = null;
    
    try {
        prisma = new PrismaClient();
        
        logInfo('APARTMENT_DATA', `Consultando apartamento roomId: ${roomId}`, { roomId }, 'check-booking-details.ts');
        
        const apartment = await prisma.apartamentos.findUnique({
            where: { roomId: roomId },
            select: { 
                propertyId: true, 
                roomId: true, 
                roomName: true, 
                extraCharge: true 
            }
        });
        
        if (apartment) {
            logSuccess('APARTMENT_DATA', `Apartamento encontrado: ${apartment.roomName}`, { roomId, roomName: apartment.roomName }, 'check-booking-details.ts');
            return {
                propertyId: apartment.propertyId,
                roomId: apartment.roomId,
                roomName: apartment.roomName,
                extraCharge: apartment.extraCharge as { description: string; amount: number }
            };
        } else {
            logInfo('APARTMENT_DATA', `Apartamento roomId ${roomId} no encontrado en BD`, { roomId }, 'check-booking-details.ts');
            return null;
        }
        
    } catch (error) {
        logError('APARTMENT_DATA', 'Error consultando apartamento en BD', { 
            error: error instanceof Error ? error.message : String(error), 
            roomId 
        }, 'check-booking-details.ts');
        return null;
    } finally {
        if (prisma) {
            try {
                await prisma.$disconnect();
            } catch (disconnectError) {
                logError('APARTMENT_DATA', 'Error desconectando Prisma', {}, 'check-booking-details.ts');
            }
        }
    }
}

// Función para formatear respuesta según canal de reserva
function formatBookingResponse(
    booking: any,
    invoiceDetails: any,
    apartmentDetails: ApartmentDetails | null
): string {
    const apartmentName = apartmentDetails?.roomName || extractRoomType(booking.apiMessage);
    const channel = booking.referer?.toLowerCase() || 'direct';
    
    // Determinar si es canal completo o simplificado
    const isFullDetailsChannel = channel.includes('booking.com') || channel.includes('direct');
    
    if (isFullDetailsChannel) {
        return formatFullBookingDetails(booking, invoiceDetails, apartmentName);
    } else {
        return formatSimpleBookingDetails(booking, apartmentName);
    }
}

// Formato completo para Booking.com y Direct
function formatFullBookingDetails(booking: any, invoiceDetails: any, apartmentName: string): string {
    const checkIn = formatDateDisplay(booking.arrival);
    const checkOut = formatDateDisplay(booking.departure);
    const nights = calculateNights(booking.arrival, booking.departure);
    
    let response = `📋 DETALLES DE RESERVA\n\n`;
    
    // Datos básicos
    response += `👤 Nombre completo: ${booking.firstName} ${booking.lastName}\n`;
    response += `📅 Día de entrada: ${checkIn}\n`;
    response += `📅 Día de salida: ${checkOut}\n`;
    response += `👥 Adultos y niños: ${booking.numAdult} adultos, ${booking.numChild} niños\n`;
    response += `📊 Estado: ${getStatusDisplay(booking.status)}\n`;
    response += `📺 Canal: ${booking.referer}\n\n`;  // ← AÑADIDO: Canal
    
    // Apartamento
    response += `🏠 ${apartmentName}\n\n`;
    
    // Valores detallados
    response += `💰 VALORES:\n`;
    
    // Invoice items - solo los items reales, sin inventar "Valor por Alojamiento"
    if (invoiceDetails.items && invoiceDetails.items.length > 0) {
        invoiceDetails.items.forEach((item: any, index: number) => {
            if (item.type === 'charge') {
                // Simplificar el nombre del item principal
                let itemDescription = item.description;
                if (itemDescription === '[ROOMNAME1] [FIRSTNIGHT] - [LEAVINGDAY]') {
                    itemDescription = 'Alojamiento';
                }
                response += `${itemDescription}: ${formatCurrency(item.amount)} COP\n`;
            }
        });
    }
    
    response += `Valor total: ${formatCurrency(booking.price)} COP\n\n`;
    
    // Pagos realizados
    const payments = invoiceDetails.items?.filter((item: any) => item.type === 'payment') || [];
    if (payments.length > 0) {
        response += `💳 PAGOS REALIZADOS:\n`;
        payments.forEach((payment: any) => {
            response += `${payment.description}: ${formatCurrency(Math.abs(payment.amount))} COP\n`;
        });
        
        const totalPaid = payments.reduce((sum: number, p: any) => sum + Math.abs(p.amount || 0), 0);
        const balance = (booking.price || 0) - totalPaid;
        response += `\n💰 Saldo Pendiente: ${formatCurrency(balance)} COP\n`;
    } else {
        response += `💰 Saldo Pendiente: ${formatCurrency(booking.price)} COP\n`;
    }
    
    response += `\n${'─'.repeat(40)}\n`;
    
    return response;
}

// Formato simple para OTAs (Airbnb, Expedia, etc.)
function formatSimpleBookingDetails(booking: any, apartmentName: string): string {
    const checkIn = formatDateDisplay(booking.arrival);
    const checkOut = formatDateDisplay(booking.departure);
    
    let response = `📋 INFORMACIÓN DE RESERVA\n\n`;
    
    response += `👤 Nombre: ${booking.firstName} ${booking.lastName}\n`;
    response += `📅 Entrada: ${checkIn}\n`;
    response += `📅 Salida: ${checkOut}\n`;
    response += `👥 Huéspedes: ${booking.numAdult} adultos, ${booking.numChild} niños\n`;
    response += `📊 Estado: ${getStatusDisplay(booking.status)}\n`;
    response += `📺 Canal: ${booking.referer}\n`;  // ← AÑADIDO: Canal
    response += `🏠 ${apartmentName}\n`;
    
    return response;
}

// Función para formatear fechas legibles
function formatDateDisplay(dateStr: string): string {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
}

// Función para formatear moneda COP correctamente
function formatCurrency(amount: number | undefined | null): string {
    if (!amount && amount !== 0) return '0';
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount).replace('COP', '').trim();
}

// Función para formatear el estado de la reserva
function getStatusDisplay(status: string): string {
    const statusMap: { [key: string]: string } = {
        'confirmed': '✅ Confirmada',
        'new': '🆕 Nueva',
        'request': '⏳ Solicitud',
        'cancelled': '❌ Cancelada',
        'inquiry': '❓ Consulta',
        'pending': '⏳ Pendiente',
        'blocked': '🚫 Bloqueada',
        'tentative': '📝 Tentativa'
    };
    
    return statusMap[status?.toLowerCase()] || `📊 ${status}`;
}

// Función para filtrar datos según canal de reserva (CLAVE PARA OPENAI)
function filterBookingDataByChannel(
    booking: any,
    invoiceDetails: any,
    apartmentDetails: ApartmentDetails | null,
    formattedMessage: string
): any {
    const channel = booking.referer?.toLowerCase() || 'direct';
    
    // Datos básicos comunes (TODOS los canales)
    const basicData = {
        bookingId: booking.id,
        guestName: `${booking.firstName} ${booking.lastName}`.trim(),
        checkIn: formatDateDisplay(booking.arrival),
        checkOut: formatDateDisplay(booking.departure),
        nights: calculateNights(booking.arrival, booking.departure),
        adults: booking.numAdult,
        children: booking.numChild,
        apartmentName: apartmentDetails?.roomName || extractRoomType(booking.apiMessage),
        status: booking.status,  // ← AÑADIDO: Estado de la reserva
        channel: booking.referer
    };

    // Determinar tipo de canal - Solo Airbnb y Expedia son simples
    const isSimpleChannel = channel.includes('airbnb') || 
                           channel.includes('expedia');

    if (isSimpleChannel) {
        // SOLO AIRBNB / EXPEDIA: Datos básicos únicamente
        return {
            ...basicData,
            formattedMessage: formattedMessage
        };
    } else {
        // TODOS LOS DEMÁS CANALES: Datos completos
        // (Booking.com, Direct, Hoteles.com, y cualquier otro canal)
        const payments = invoiceDetails.items?.filter((item: any) => item.type === 'payment') || [];
        const totalPaid = payments.reduce((sum: number, p: any) => sum + Math.abs(p.amount || 0), 0);
        const balance = (booking.price || 0) - totalPaid;

        return {
            ...basicData,
            // Datos financieros detallados
            accommodationValue: booking.price,
            totalAmount: booking.price,
            invoiceItems: invoiceDetails.items || [],
            invoiceTotal: invoiceDetails.total || booking.price,
            paymentsReceived: payments,
            totalPaid: totalPaid,
            balancePending: balance,
            // Datos de contacto
            email: booking.email,
            phone: booking.phone,
            // Notas
            guestComments: booking.comments || '',
            internalNotes: booking.notes || '',
            specialRequests: booking.comments || booking.notes || '',
            // Respuesta formateada completa
            formattedMessage: formattedMessage
        };
    }
}

interface CheckBookingParams {
    firstName: string;
    lastName: string;
    checkInDate: string; // YYYY-MM-DD
}

interface BookingResult {
    success: boolean;
    message: string;
    booking?: any;
    source?: 'beds24' | 'local_db';
}

export async function checkBookingDetails(params: CheckBookingParams): Promise<BookingResult> {
    const { firstName, lastName, checkInDate } = params;
    
    logInfo('CHECK_BOOKING', 'Iniciando consulta reserva', { firstName, lastName, checkInDate }, 'check-booking-details.ts');

    try {
        // 1. Validar parámetros
        if (!firstName || !lastName || !checkInDate) {
            return {
                success: false,
                message: "Faltan datos requeridos: nombre, apellido y fecha de entrada",
                booking: null,
                source: null
            };
        }

        // Validar formato de fecha
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(checkInDate)) {
            return {
                success: false,
                message: "Formato de fecha inválido. Use YYYY-MM-DD",
                booking: null,
                source: null
            };
        }

        // 2. Buscar en Beds24 API
        const beds24Result = await searchInBeds24(firstName, lastName, checkInDate);
        
        if (beds24Result.found && beds24Result.data) {
            const bookingsData = Array.isArray(beds24Result.data) ? beds24Result.data : [beds24Result.data];
            
            logSuccess('CHECK_BOOKING', `${bookingsData.length} reserva(s) encontrada(s)`, { 
                count: bookingsData.length,
                bookingIds: bookingsData.map(b => b.id) 
            }, 'check-booking-details.ts');
            
            // Procesar todas las reservas encontradas
            const processedBookings = [];
            let combinedMessage = '';
            
            for (let i = 0; i < bookingsData.length; i++) {
                const booking = bookingsData[i];
                
                // Obtener datos adicionales para cada reserva
                const invoiceDetails = await getInvoiceDetails(process.env.BEDS24_TOKEN!, process.env.BEDS24_API_URL!, booking.id);
                const apartmentDetails = await getApartmentDetails(booking.roomId);
                
                // Formatear respuesta según canal
                const formattedResponse = formatBookingResponse(
                    booking,
                    invoiceDetails,
                    apartmentDetails
                );
                
                // Filtrar datos según canal para OpenAI
                const filteredBookingData = filterBookingDataByChannel(
                    booking,
                    invoiceDetails,
                    apartmentDetails,
                    formattedResponse
                );
                
                processedBookings.push(filteredBookingData);
                
                // Si hay múltiples reservas, numerarlas
                if (bookingsData.length > 1) {
                    combinedMessage += `🔹 RESERVA ${i + 1}:\n\n${formattedResponse}\n`;
                } else {
                    combinedMessage = formattedResponse;
                }
            }
            
            return {
                success: true,
                message: combinedMessage, // Mensaje formateado con todas las reservas
                booking: processedBookings.length === 1 ? processedBookings[0] : processedBookings,
                source: 'beds24'
            };
        }

        // No encontrada
        logInfo('CHECK_BOOKING', 'Reserva no encontrada', { firstName, lastName, checkInDate }, 'check-booking-details.ts');
        return {
            success: false,
            message: `No encontramos ninguna reserva para ${firstName} ${lastName} con fecha de entrada ${formatDateDisplay(checkInDate)}. Por favor verifica los datos o contacta al hotel.`,
            booking: null,
            source: null
        };

    } catch (error) {
        logError('CHECK_BOOKING', 'Error consultando reserva', { error: error instanceof Error ? error.message : error, firstName, lastName, checkInDate }, 'check-booking-details.ts');
        return {
            success: false,
            message: "Error interno al consultar la reserva. Por favor intenta nuevamente.",
            booking: null,
            source: null
        };
    }
}

// Función auxiliar para buscar en Beds24
async function searchInBeds24(firstName: string, lastName: string, checkInDate: string) {
    try {
        const token = process.env.BEDS24_TOKEN;
        const apiUrl = process.env.BEDS24_API_URL || 'https://api.beds24.com/v2';
        
        if (!token) {
            logError('BEDS24_API', 'BEDS24_TOKEN no configurado', {}, 'check-booking-details.ts');
            return { found: false, data: null };
        }

        // Construir URL con parámetros de búsqueda por fecha de llegada
        const searchParams = new URLSearchParams({ 'arrival': checkInDate });
        const fullUrl = `${apiUrl}/bookings?${searchParams.toString()}`;

        const response = await fetch(fullUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'token': token
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            logError('BEDS24_API', `Error en API Beds24: ${response.status}`, { status: response.status, error: errorText }, 'check-booking-details.ts');
            return { found: false, data: null };
        }

        const apiResponse = await response.json();
        const bookings = (apiResponse as any).data || [];
        const bookingsArray = Array.isArray(bookings) ? bookings : [];

        if (bookingsArray.length === 0) {
            return { found: false, data: null };
        }

        // Buscar TODAS las reservas que coincidan con los nombres (búsqueda flexible)
        const matchingBookings = bookingsArray.filter((booking: any) => {
            const guestFirstName = (booking.firstName || '').toLowerCase().trim();
            const guestLastName = (booking.lastName || '').toLowerCase().trim();
            
            // VALIDACIÓN: No procesar reservas con nombres vacíos
            if (!guestFirstName || !guestLastName) {
                return false;
            }
            
            const searchFirstName = firstName.toLowerCase();
            const searchLastName = lastName.toLowerCase();
            
            // Búsqueda flexible: nombre similar o coincidencia parcial + Levenshtein en ambos nombres
            const firstNameMatch = guestFirstName.includes(searchFirstName) || 
                                 searchFirstName.includes(guestFirstName) ||
                                 levenshteinDistance(guestFirstName, searchFirstName) <= 2;
            
            const lastNameMatch = guestLastName.includes(searchLastName) || 
                                searchLastName.includes(guestLastName) ||
                                levenshteinDistance(guestLastName, searchLastName) <= 2;  // ← AÑADIDO: Levenshtein para lastName
            
            // Coincidencia invertida: firstName del usuario coincide con lastName de la reserva y viceversa
            const swappedFirstMatch = guestFirstName.includes(searchLastName) ||
                                    searchLastName.includes(guestFirstName) ||
                                    levenshteinDistance(guestFirstName, searchLastName) <= 2;
            
            const swappedLastMatch = guestLastName.includes(searchFirstName) ||
                                   searchFirstName.includes(guestLastName) ||
                                   levenshteinDistance(guestLastName, searchFirstName) <= 2;
            
            // Retornar verdadero si coincide orden normal O invertido
            return (firstNameMatch && lastNameMatch) || (swappedFirstMatch && swappedLastMatch);
        });

        if (matchingBookings.length > 0) {
            // Filtrar por status: priorizar confirmed/new sobre cancelled
            const activeBookings = matchingBookings.filter((booking: any) => 
                booking.status !== 'cancelled'
            );
            
            // Si hay reservas activas, usar esas. Si no, usar todas (incluyendo cancelled)
            const finalBookings = activeBookings.length > 0 ? activeBookings : matchingBookings;
            
            logInfo('BOOKING_STATUS_FILTER', 
                `Filtrado por status: ${matchingBookings.length} total → ${finalBookings.length} finales`, 
                { 
                    totalFound: matchingBookings.length,
                    activeFound: activeBookings.length,
                    finalCount: finalBookings.length 
                }, 
                'check-booking-details.ts'
            );
            
            // Retornar reservas filtradas para procesamiento múltiple
            return { found: true, data: finalBookings };
        }

        return { found: false, data: null };

    } catch (error) {
        logError('BEDS24_API', 'Error consultando Beds24', { error: error instanceof Error ? error.message : error, firstName, lastName, checkInDate }, 'check-booking-details.ts');
        return { found: false, data: null };
    }
}

// Función auxiliar para buscar en BD local (no implementada - Beds24 es fuente principal)
async function searchInLocalDB(firstName: string, lastName: string, checkInDate: string) {
    return { found: false, data: null };
}

// ============================================================================
// DEFINICIÓN PARA OPENAI ASSISTANT
// ============================================================================

export const checkBookingDetailsFunction: FunctionDefinition = {
  name: 'check_booking_details',
  description: 'Consulta detalles de una reserva existente. Requiere nombre + apellido + fecha de entrada para validación.',
  category: 'booking',
  version: '1.0.0',
  enabled: true,
  parameters: {
    type: 'object',
    properties: {
      firstName: {
        type: 'string',
        description: 'Nombre del huésped (ej: Juan)',
        minLength: 2,
        maxLength: 50
      },
      lastName: {
        type: 'string',
        description: 'Apellido del huésped (ej: Pérez)', 
        minLength: 2,
        maxLength: 50
      },
      checkInDate: {
        type: 'string',
        description: 'Fecha de entrada en formato YYYY-MM-DD',
        pattern: '^\\d{4}-\\d{2}-\\d{2}$'
      }
    },
    required: ['firstName', 'lastName', 'checkInDate'],
    additionalProperties: false
  },
  handler: checkBookingDetails
};

// Los exports ya están definidos arriba en las líneas 415 y 629