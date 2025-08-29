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
import type { FunctionDefinition } from '../../../../functions/types/function-types.js';
import { logInfo, logError, logSuccess } from '../../../../utils/logging';
import { Beds24Client } from '../../services/beds24-client';

// ============================================================================
// PRISMA CONNECTION SINGLETON PARA MEJOR PERFORMANCE
// ============================================================================
const globalPrisma = new PrismaClient();

// Using imported FunctionDefinition from types/function-types.ts

// ============================================================================
// INTERFACES TYPESCRIPT PARA TYPE SAFETY
// ============================================================================

// Interface para respuesta de API Beds24 /bookings
interface Beds24BookingResponse {
    data: Beds24Booking[];
}

// Interface para booking individual de Beds24 - COMPLETADA
interface Beds24Booking {
    id: number;
    masterId?: number | null;
    bookingGroup?: { master: number; ids: number[] } | null;
    title: string;
    firstName: string;
    lastName: string;
    arrival: string;
    departure: string;
    numAdult: number;
    numChild: number;
    status: string;
    subStatus?: string;
    referer: string;
    refererEditable?: string;
    price: number;
    deposit?: number;
    tax?: number;
    commission?: number;
    roomId: number;
    unitId?: number;
    roomQty?: number;
    offerId?: number;
    email?: string;
    phone?: string;
    mobile?: string;
    comments?: string;
    notes?: string;
    message?: string;
    groupNote?: string;
    apiMessage?: string;
    apiSource?: string;
    apiReference?: string;
    bookingTime?: string;
    modifiedTime?: string;
    guests?: any[];
    infoItems?: any[];
    invoiceItems: any[]; // Array de invoice items incluidos
}

// Interface para respuesta de API Beds24 /invoices
interface InvoiceResponse {
    data: Invoice[];
}

// Interface para invoice individual
interface Invoice {
    invoiceItems: InvoiceItem[];
}

// Interface para items de invoice
interface InvoiceItem {
    id: number;
    type: 'charge' | 'payment';
    description: string;
    qty: number;
    amount: number;
    lineTotal: number;
    vatRate: number;
    status: string;
}

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

// Función para normalizar texto (sin tildes, sin mayúsculas)
function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .normalize('NFD')                    // Descomponer caracteres con tildes
        .replace(/[\u0300-\u036f]/g, '')     // Remover tildes y diacríticos
        .replace(/[^\w\s]/g, '')             // Remover símbolos especiales
        .replace(/\s+/g, ' ');               // Normalizar espacios
}

// Función para dividir nombres completos en tokens individuales
function extractNameTokens(fullName: string): string[] {
    return normalizeText(fullName)
        .split(/\s+/)
        .filter(token => token.length >= 2); // Solo tokens de 2+ caracteres
}

// Función para validar coincidencia de nombres - MÍNIMO 2 PALABRAS COMPLETAS
function validateNameMatch(searchFirst: string, searchLast: string, guestTitle: string, guestFirst: string, guestLast: string): {match: boolean, details: string} {
    // Extraer palabras de la búsqueda
    const searchTokens = [
        ...extractNameTokens(searchFirst),
        ...extractNameTokens(searchLast)
    ];
    
    // Concatenar TODOS los campos de la reserva: title + firstName + lastName
    const guestFullName = `${guestTitle || ''} ${guestFirst || ''} ${guestLast || ''}`.trim();
    const guestTokens = extractNameTokens(guestFullName);
    
    if (searchTokens.length < 2) {
        return {
            match: false,
            details: `Insuficientes nombres en búsqueda: ${searchTokens.length} (mínimo 2)`
        };
    }
    
    if (guestTokens.length < 2) {
        return {
            match: false,
            details: `Insuficientes nombres en reserva: "${guestFullName}" → ${guestTokens.length} palabras`
        };
    }
    
    // Contar coincidencias EXACTAS de palabras completas (sin orden)
    let matchCount = 0;
    const matchDetails: string[] = [];
    const usedGuestTokens = new Set();
    
    for (const searchToken of searchTokens) {
        for (const guestToken of guestTokens) {
            // Solo coincidencias exactas de palabras completas
            if (searchToken === guestToken && !usedGuestTokens.has(guestToken)) {
                matchCount++;
                matchDetails.push(`"${searchToken}"`);
                usedGuestTokens.add(guestToken);
                break; // Solo contar una vez por token de búsqueda
            }
        }
    }
    
    const isValidMatch = matchCount >= 2;
    
    return {
        match: isValidMatch,
        details: `${matchCount}/2 palabras coinciden: [${matchDetails.join(', ')}] en "${guestFullName}"`
    };
}

// Función auxiliar para calcular número de noches
function calculateNights(checkIn: string, checkOut: string): number {
    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// ELIMINADA: getInvoiceDetails - Ya no necesaria, invoice items vienen incluidos en searchBookingsOptimized

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

// Función para obtener detalles del apartamento desde BD - OPTIMIZADO: Usando singleton
async function getApartmentDetails(roomId: number): Promise<ApartmentDetails | null> {
    try {
        logInfo('APARTMENT_DATA', `Consultando apartamento roomId: ${roomId}`, { roomId }, 'check-booking-details.ts');
        
        const apartment = await globalPrisma.apartamentos.findUnique({
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
    }
}

// Función para formatear respuesta según canal de reserva
function formatBookingResponse(
    booking: Beds24Booking,
    invoiceDetails: ProcessedInvoiceDetails,
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

// Interface para invoice details con campos calculados
interface ProcessedInvoiceDetails {
    items: any[];
    totalCharges: number;
    totalPaid: number;
    balance: number;
    total: number;
    raw: any;
}

// Formato completo para Booking.com y Direct - NUEVO FORMATO LIMPIO
function formatFullBookingDetails(booking: Beds24Booking, invoiceDetails: ProcessedInvoiceDetails, apartmentName: string): string {
    const checkIn = formatDateDisplay(booking.arrival);
    const checkOut = formatDateDisplay(booking.departure);
    
    let response = `*${booking.firstName} ${booking.lastName}*\n`;
    response += `- Día de entrada: ${checkIn}\n`;
    response += `- Día de salida: ${checkOut}\n`;
    response += `- Adultos y niños: ${booking.numAdult} adultos, ${booking.numChild} niños\n`;
    response += `- Estado: ${getStatusDisplayClean(booking.status)}\n`;
    response += `- Canal: ${booking.referer}\n\n`;
    
    // Apartamento y valores
    response += `${apartmentName}\n`;
    
    // Invoice items
    if (invoiceDetails.items && invoiceDetails.items.length > 0) {
        invoiceDetails.items.forEach((item: any) => {
            if (item.type === 'charge') {
                let itemDescription = item.description;
                if (itemDescription === '[ROOMNAME1] [FIRSTNIGHT] - [LEAVINGDAY]') {
                    itemDescription = 'Alojamiento';
                }
                response += `- ${itemDescription}: $${formatCurrencyClean(item.amount)}\n`;
            }
        });
    }
    
    response += `- Valor total: $${formatCurrencyClean(invoiceDetails.totalCharges)}\n\n`;
    
    // Pagos y saldo
    response += `Total Pagado: $${formatCurrencyClean(invoiceDetails.totalPaid)}!\n`;
    response += `*Saldo Pendiente:* $${formatCurrencyClean(invoiceDetails.balance)}`;
    
    return response;
}

// Formato simple para OTAs (Airbnb, Expedia, etc.)
function formatSimpleBookingDetails(booking: Beds24Booking, apartmentName: string): string {
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

// Función para formatear moneda limpia (solo números con separadores)
function formatCurrencyClean(amount: number | undefined | null): string {
    if (!amount && amount !== 0) return '0';
    return new Intl.NumberFormat('es-CO').format(amount);
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

// Función para formatear el estado limpio
function getStatusDisplayClean(status: string): string {
    const statusMap: { [key: string]: string } = {
        'confirmed': 'Confirmada',
        'new': 'Nueva Reserva - Falta ---> llevar a Confirmada!',
        'request': 'Solicitud Pendiente',
        'cancelled': 'Cancelada',
        'inquiry': 'Consulta',
        'pending': 'Pendiente',
        'blocked': 'Bloqueada',
        'tentative': 'Tentativa'
    };
    
    return statusMap[status?.toLowerCase()] || status;
}

// Función para filtrar datos según canal de reserva (CLAVE PARA OPENAI)
function filterBookingDataByChannel(
    booking: Beds24Booking,
    invoiceDetails: ProcessedInvoiceDetails,
    apartmentDetails: ApartmentDetails | null,
    formattedMessage: string
): any {
    const channel = booking.referer?.toLowerCase() || 'direct';
    
    // Datos básicos comunes (TODOS los canales)
    const basicData = {
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

        return {
            ...basicData,
            // Datos financieros detallados - CORREGIDO
            accommodationValue: invoiceDetails.totalCharges,
            totalAmount: invoiceDetails.totalCharges,
            invoiceItems: invoiceDetails.items || [],
            invoiceTotal: invoiceDetails.totalCharges,
            paymentsReceived: payments,
            totalPaid: invoiceDetails.totalPaid,
            balancePending: invoiceDetails.balance,
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

        // 2. Buscar en Beds24 API - MIGRADO A BEDS24CLIENT
        const beds24Client = new Beds24Client();
        const beds24Result = await searchInBeds24(beds24Client, firstName, lastName, checkInDate);
        
        if (beds24Result.found && beds24Result.data) {
            const bookingsData = Array.isArray(beds24Result.data) ? beds24Result.data : [beds24Result.data];
            
            logSuccess('CHECK_BOOKING', `${bookingsData.length} reserva(s) encontrada(s)`, { 
                count: bookingsData.length,
                bookingIds: bookingsData.map(b => b.id) 
            }, 'check-booking-details.ts');
            
            // Procesar todas las reservas encontradas - SIMPLIFICADO: Una sola llamada API
            const processedBookings = [];
            let combinedMessage = '';
            
            // Si hay múltiples reservas, agregar encabezado informativo
            if (bookingsData.length > 1) {
                combinedMessage += `Se encontraron ${bookingsData.length} reservas para ${firstName} ${lastName}:\n\n`;
            }
            
            // Solo necesitamos apartment details de BD (invoiceItems ya vienen de la API)
            const apartmentDetailsArray = await Promise.all(
                bookingsData.map(booking => getApartmentDetails(booking.roomId))
            );
            
            // Procesar resultados - invoice items ya incluidos en booking.invoiceItems
            for (let i = 0; i < bookingsData.length; i++) {
                const booking = bookingsData[i];
                const apartmentDetails = apartmentDetailsArray[i];
                
                // Crear invoice details desde los datos incluidos en booking - CORREGIDO: Cálculos financieros
                const charges = (booking.invoiceItems || []).filter((item: any) => item.type === 'charge');
                const payments = (booking.invoiceItems || []).filter((item: any) => item.type === 'payment');
                
                const totalCharges = charges.reduce((sum: number, item: any) => 
                    sum + (item.lineTotal || item.amount || 0), 0);
                const totalPaid = payments.reduce((sum: number, item: any) => 
                    sum + Math.abs(item.lineTotal || item.amount || 0), 0);
                const balance = totalCharges - totalPaid;
                
                const invoiceDetails: ProcessedInvoiceDetails = {
                    items: booking.invoiceItems || [],
                    totalCharges,
                    totalPaid,
                    balance,
                    total: totalCharges, // Para compatibilidad con código existente
                    raw: { invoiceItems: booking.invoiceItems }
                };
                
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
                
                // Si hay múltiples reservas, numerarlas y mostrar relación
                if (bookingsData.length > 1) {
                    const groupInfo = booking.bookingGroup ? ` (Grupo: ${booking.bookingGroup})` : '';
                    combinedMessage += `--- RESERVA ${i + 1}/${bookingsData.length}${groupInfo} ---\n\n${formattedResponse}\n\n`;
                } else {
                    combinedMessage = formattedResponse;
                }
            }
            
            // Agregar nota interna contextual para el asistente (breve y directa)
            let assistantNote = '';
            
            // Analizar el contexto de la(s) reserva(s)
            for (const booking of processedBookings) {
                const channel = (booking.channel || '').toLowerCase();
                const hasPendingBalance = booking.balancePending > 0;
                const hasPayments = booking.totalPaid > 0;
                
                // Analizar notas internas para casos especiales
                const internalNotes = (booking.internalNotes || '').toLowerCase();
                const guestComments = (booking.guestComments || '').toLowerCase();
                const specialRequests = (booking.specialRequests || '').toLowerCase();
                const allNotes = internalNotes + ' ' + guestComments + ' ' + specialRequests;
                
                // Detectar si está confirmada sin anticipo (caso especial)
                const isConfirmedWithoutDeposit = 
                    (allNotes.includes('confirmada sin anticipo') ||
                     allNotes.includes('confirmado sin anticipo') ||
                     allNotes.includes('sin anticipo confirmada') ||
                     allNotes.includes('sin anticipo confirmado') ||
                     allNotes.includes('excepcional sin anticipo') ||
                     allNotes.includes('paga al llegar') ||
                     allNotes.includes('pago al llegar') ||
                     allNotes.includes('pago en el hotel') ||
                     allNotes.includes('paga en el hotel'));
                
                // Determinar si es OTA que no requiere pagos directos
                const isOTAWithoutDirectPayment = 
                    channel.includes('airbnb') || 
                    channel.includes('expedia') || 
                    channel.includes('hotels.com') ||
                    channel.includes('hoteles.com');
                
                if (isOTAWithoutDirectPayment) {
                    assistantNote = '\n\n✅ Reserva encontrada! ' +
                        'Recuerda: viene de ' + booking.channel + ', no tiene saldo pendiente y está confirmada. ' +
                        'Coordina su llegada o resuelve sus dudas si lo pide.';
                } else if (channel.includes('booking.com') || channel.includes('direct')) {
                    if (!hasPayments && hasPendingBalance) {
                        // Verificar si es un caso especial confirmado sin anticipo
                        if (isConfirmedWithoutDeposit) {
                            assistantNote = '\n\n✅ Reserva encontrada! Sin pagos registrados. ' +
                                'Recuerda: esta reserva se confirmó excepcionalmente SIN anticipo, ' +
                                'el cliente pagará todo al llegar. Coordina su llegada o resuelve sus dudas si lo pide.';
                        } else {
                            assistantNote = '\n\n✅ Reserva encontrada! Sin pagos registrados aún. ' +
                                'Recuerda: se requiere anticipo correspondiente para confirmar al 100%.';
                        }
                    } else if (hasPayments && hasPendingBalance) {
                        assistantNote = '\n\n✅ Reserva encontrada! Anticipo recibido. ' +
                            'Saldo pendiente: $' + formatCurrencyClean(booking.balancePending) + '. ' +
                            'Coordina su llegada o resuelve sus dudas si lo pide.';
                    } else if (hasPayments && !hasPendingBalance) {
                        assistantNote = '\n\n✅ Reserva encontrada! Totalmente pagada. ' +
                            'Coordina su llegada o resuelve sus dudas si lo pide.';
                    }
                }
            }
            
            // Si no se agregó nota específica, agregar una genérica
            if (!assistantNote) {
                assistantNote = '\n\n✅ Reserva encontrada! Responde según corresponda.';
            }
            
            // 📋 AUDIT LOG: Final response sent to OpenAI
            const finalResponse: BookingResult = {
                success: true,
                message: combinedMessage + assistantNote,
                booking: processedBookings.length === 1 ? processedBookings[0] : processedBookings,
                source: 'beds24'
            };
            
            logInfo('BOOKING_TO_OPENAI', JSON.stringify(finalResponse), {}, 'check-booking-details.ts');
            
            return finalResponse;
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

// Función auxiliar para buscar en Beds24 - OPTIMIZADA: Una sola llamada API
async function searchInBeds24(beds24Client: Beds24Client, firstName: string, lastName: string, checkInDate: string) {
    try {
        // OPTIMIZACIÓN: Usar searchBookingsOptimized con searchString + includeInvoiceItems
        const apiResponse = await beds24Client.searchBookingsOptimized({
            firstName,
            lastName,
            arrival: checkInDate,
            status: ['confirmed', 'new'] // Solo reservas activas
        });
        
        // 📋 AUDIT LOG: Raw API Response from Beds24 /bookings optimizado
        logInfo('BEDS24_BOOKINGS_OPTIMIZED_RAW', JSON.stringify(apiResponse), {}, 'check-booking-details.ts');
        
        // MANEJO DE ERRORES API - CRÍTICO
        if (!apiResponse.success) {
            throw new Error(`Beds24 API Error: ${apiResponse.error || 'Unknown error'}`);
        }
        
        const bookings = apiResponse.data || [];
        const bookingsArray = Array.isArray(bookings) ? bookings : [];

        if (bookingsArray.length === 0) {
            return { found: false, data: null };
        }

        // VALIDACIÓN ESTRICTA: Mínimo 2 palabras completas deben coincidir en title+firstName+lastName
        const validBookings = bookingsArray.filter((booking: any) => {
            const guestTitle = (booking.title || '').trim();
            const guestFirstName = (booking.firstName || '').trim();
            const guestLastName = (booking.lastName || '').trim();
            
            // VALIDACIÓN: Debe tener al menos algún nombre
            if (!guestFirstName && !guestLastName && !guestTitle) {
                return false;
            }
            
            // NUEVA VALIDACIÓN: title + firstName + lastName concatenados
            const nameValidation = validateNameMatch(firstName, lastName, guestTitle, guestFirstName, guestLastName);
            
            logInfo('NAME_VALIDATION_COMPLETE', 
                `Validando: "${firstName} ${lastName}" vs title:"${guestTitle}" firstName:"${guestFirstName}" lastName:"${guestLastName}"`, 
                {
                    match: nameValidation.match,
                    details: nameValidation.details,
                    bookingId: booking.id
                }, 
                'check-booking-details.ts'
            );
            
            return nameValidation.match;
        });

        if (validBookings.length > 0) {
            logInfo('BOOKING_OPTIMIZED_RESULTS', 
                `Búsqueda optimizada: ${validBookings.length} reservas encontradas`, 
                { 
                    searchString: `${firstName} ${lastName}`,
                    arrival: checkInDate,
                    foundCount: validBookings.length,
                    bookingIds: validBookings.map((b: any) => b.id)
                }, 
                'check-booking-details.ts'
            );
            
            return { found: true, data: validBookings };
        }

        return { found: false, data: null };

    } catch (error) {
        logError('BEDS24_API_OPTIMIZED', 'Error en búsqueda optimizada Beds24', { 
            error: error instanceof Error ? error.message : error, 
            searchString: `${firstName} ${lastName}`,
            arrival: checkInDate 
        }, 'check-booking-details.ts');
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