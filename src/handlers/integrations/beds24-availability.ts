import { getBeds24Service } from '../../services/beds24/beds24.service';
import { AvailabilityInfo, Beds24Error } from '../../services/beds24/beds24.types';
import { getBeds24Config } from '../../config/integrations/beds24.config';
import { logInfo, logError, logSuccess } from '../../utils/logger';
import axios from 'axios';

// Interfaces para la lógica optimizada
interface PropertyData {
    propertyId: number;
    propertyName: string;
    roomName: string;
    roomId: number;
    availability: Record<string, boolean>;
    prices: Record<string, number>;
}

interface SplitOption {
    type: string;
    transfers: number;
    totalPrice: number;
    totalNights: number;
    properties: {
        propertyName: string;
        roomName: string;
        nights: number;
        dates: string[];
        price: number;
    }[];
}

interface OptimizedResult {
    completeOptions: PropertyData[];
    splitOptions: SplitOption[];
    totalNights: number;
}

// Interfaz para las funciones de OpenAI
export interface AvailabilityFunction {
    name: 'check_availability';
    description: 'Consulta disponibilidad en tiempo real de propiedades en Beds24';
    parameters: {
        type: 'object';
        properties: {
            startDate: {
                type: 'string';
                description: 'Fecha de inicio en formato YYYY-MM-DD';
            };
            endDate: {
                type: 'string';
                description: 'Fecha de fin en formato YYYY-MM-DD';
            };
            propertyId?: {
                type: 'number';
                description: 'ID específico de la propiedad (opcional)';
            };
            roomId?: {
                type: 'number';
                description: 'ID específico de la habitación (opcional)';
            };
        };
        required: ['startDate', 'endDate'];
    };
}

/**
 * Obtiene datos combinados: disponibilidad + precios con lógica de splits
 */
async function getAvailabilityAndPricesOptimized(
    startDate: string,
    endDate: string,
    propertyId?: number,
    roomId?: number
): Promise<OptimizedResult> {
    const BEDS24_TOKEN = process.env.BEDS24_TOKEN || '';
    const BEDS24_API_URL = 'https://api.beds24.com/v2';
    
    const dateRange = generateDateRange(startDate, endDate);
    const totalNights = dateRange.length;
    
    // Obtener nombres de propiedades
    const propertyNames: Record<number, string> = {};
    try {
        const propsResponse = await axios.get(`${BEDS24_API_URL}/properties`, {
            headers: { 'Accept': 'application/json', 'token': BEDS24_TOKEN },
            timeout: 15000
        });
        
        if (propsResponse.data.success && propsResponse.data.data) {
            propsResponse.data.data.forEach((property: any) => {
                propertyNames[property.id] = property.name;
            });
        }
    } catch (error) {
        logError('AVAILABILITY_HANDLER', 'Error obteniendo propiedades:', error);
    }
    
    // Consultas paralelas: disponibilidad + precios
    const [availabilityResponse, calendarResponse] = await Promise.all([
        axios.get(`${BEDS24_API_URL}/inventory/rooms/availability`, {
            headers: { 'Accept': 'application/json', 'token': BEDS24_TOKEN },
            params: { startDate, endDate, ...(propertyId && { propertyId }) },
            timeout: 15000
        }),
        axios.get(`${BEDS24_API_URL}/inventory/rooms/calendar`, {
            headers: { 'Accept': 'application/json', 'token': BEDS24_TOKEN },
            params: { 
                startDate, 
                endDate,
                includePrices: true,
                includeNumAvail: true,
                ...(propertyId && { propertyId })
            },
            timeout: 15000
        })
    ]);
    
    // Procesar datos combinados
    const propertyData: Record<number, PropertyData> = {};
    
    // Procesar disponibilidad
    if (availabilityResponse.data.success && availabilityResponse.data.data) {
        availabilityResponse.data.data.forEach((room: any) => {
            propertyData[room.propertyId] = {
                propertyId: room.propertyId,
                propertyName: propertyNames[room.propertyId] || `Propiedad ${room.propertyId}`,
                roomName: room.name,
                roomId: room.roomId,
                availability: room.availability,
                prices: {}
            };
        });
    }
    
    // Procesar precios
    if (calendarResponse.data.success && calendarResponse.data.data) {
        calendarResponse.data.data.forEach((roomData: any) => {
            const propertyId = roomData.propertyId;
            if (propertyData[propertyId] && roomData.calendar) {
                roomData.calendar.forEach((calItem: any) => {
                    if (calItem.price1) {
                        const dates = generateDateRange(calItem.from, calItem.to || calItem.from);
                        dates.forEach(date => {
                            if (dateRange.includes(date)) {
                                propertyData[propertyId].prices[date] = calItem.price1;
                            }
                        });
                    }
                });
            }
        });
    }
    
    // Clasificar opciones
    const completeOptions: PropertyData[] = [];
    const partialOptions: PropertyData[] = [];
    
    Object.values(propertyData).forEach(property => {
        const availableDates = dateRange.filter(date => property.availability[date]);
        if (availableDates.length === totalNights) {
            completeOptions.push(property);
        } else if (availableDates.length > 0) {
            partialOptions.push(property);
        }
    });
    
    // Generar opciones de split solo si no hay opciones completas
    const splitOptions = completeOptions.length === 0 ? 
        findConsecutiveSplits(partialOptions, dateRange) : [];
    
    return {
        completeOptions,
        splitOptions,
        totalNights
    };
}

/**
 * Genera splits consecutivos optimizados con diferentes estrategias
 */
function findConsecutiveSplits(partialOptions: PropertyData[], dateRange: string[]): SplitOption[] {
    const splits: SplitOption[] = [];
    const uniqueSplits = new Map<string, SplitOption>();
    
    // ESTRATEGIA 1: Maximizar noches consecutivas (greedy por duración)
    const split1 = buildConsecutiveSplitMaxNights(partialOptions, dateRange);
    if (split1 && split1.totalNights === dateRange.length) {
        const key = split1.properties.map(p => p.propertyName).join('-');
        uniqueSplits.set(key, split1);
    }
    
    // ESTRATEGIA 2: Minimizar precio total (greedy por precio)
    const split2 = buildConsecutiveSplitMinPrice(partialOptions, dateRange);
    if (split2 && split2.totalNights === dateRange.length) {
        const key = split2.properties.map(p => p.propertyName).join('-');
        if (!uniqueSplits.has(key)) {
            uniqueSplits.set(key, split2);
        }
    }
    
    // ESTRATEGIA 3: Empezar con propiedades diferentes
    const usedStartProperties = new Set<string>();
    for (const option of partialOptions) {
        if (usedStartProperties.size >= 2) break;
        
        const split3 = buildConsecutiveSplitStartWith(partialOptions, dateRange, option.propertyId);
        if (split3 && split3.totalNights === dateRange.length) {
            const key = split3.properties.map(p => p.propertyName).join('-');
            if (!uniqueSplits.has(key)) {
                uniqueSplits.set(key, split3);
                usedStartProperties.add(option.propertyName);
            }
        }
    }
    
    // Convertir a array y ordenar
    const allSplits = Array.from(uniqueSplits.values());
    allSplits.sort((a, b) => {
        if (a.transfers !== b.transfers) return a.transfers - b.transfers;
        return a.totalPrice - b.totalPrice;
    });
    
    // Filtrar solo opciones viables (máximo 3 traslados)
    const viableOptions = allSplits.filter(split => split.transfers <= 3);
    return viableOptions.slice(0, 3); // Top 3 opciones viables
}

/**
 * ESTRATEGIA 1: Construye split maximizando noches consecutivas
 */
function buildConsecutiveSplitMaxNights(partialOptions: PropertyData[], dateRange: string[]): SplitOption | null {
    const usedProperties = new Set<number>();
    const properties: any[] = [];
    let currentDateIndex = 0;
    let totalPrice = 0;
    let totalNights = 0;
    
    while (currentDateIndex < dateRange.length) {
        const currentDate = dateRange[currentDateIndex];
        let bestOption: PropertyData | null = null;
        let bestConsecutiveDays = 0;
        
        for (const option of partialOptions) {
            if (usedProperties.has(option.propertyId)) continue;
            
            let consecutiveDays = 0;
            if (option.availability[currentDate]) {
                for (let j = currentDateIndex; j < dateRange.length; j++) {
                    const checkDate = dateRange[j];
                    if (option.availability[checkDate]) {
                        consecutiveDays++;
                    } else {
                        break;
                    }
                }
            }
            
            if (consecutiveDays > bestConsecutiveDays) {
                bestConsecutiveDays = consecutiveDays;
                bestOption = option;
            }
        }
        
        if (!bestOption || bestConsecutiveDays === 0) {
            return null;
        }
        
        const stayDates = dateRange.slice(currentDateIndex, currentDateIndex + bestConsecutiveDays);
        const stayPrice = stayDates.reduce((sum, date) => sum + (bestOption!.prices[date] || 0), 0);
        
        properties.push({
            propertyName: bestOption.propertyName,
            roomName: bestOption.roomName,
            nights: bestConsecutiveDays,
            dates: stayDates,
            price: stayPrice
        });
        
        usedProperties.add(bestOption.propertyId);
        currentDateIndex += bestConsecutiveDays;
        totalPrice += stayPrice;
        totalNights += bestConsecutiveDays;
    }
    
    return {
        type: properties.length === 2 ? 'double-split' : 'triple-split',
        transfers: properties.length - 1,
        totalPrice,
        totalNights,
        properties
    };
}

/**
 * ESTRATEGIA 2: Construye split minimizando precio total
 */
function buildConsecutiveSplitMinPrice(partialOptions: PropertyData[], dateRange: string[]): SplitOption | null {
    const usedProperties = new Set<number>();
    const properties: any[] = [];
    let currentDateIndex = 0;
    let totalPrice = 0;
    let totalNights = 0;
    
    while (currentDateIndex < dateRange.length) {
        const currentDate = dateRange[currentDateIndex];
        let bestOption: PropertyData | null = null;
        let bestScore = Infinity; // Mejor score = menor precio por noche
        let bestConsecutiveDays = 0;
        
        for (const option of partialOptions) {
            if (usedProperties.has(option.propertyId)) continue;
            
            let consecutiveDays = 0;
            let tempPrice = 0;
            
            if (option.availability[currentDate]) {
                for (let j = currentDateIndex; j < dateRange.length; j++) {
                    const checkDate = dateRange[j];
                    if (option.availability[checkDate]) {
                        consecutiveDays++;
                        tempPrice += option.prices[checkDate] || 0;
                    } else {
                        break;
                    }
                }
            }
            
            if (consecutiveDays > 0) {
                const pricePerNight = tempPrice / consecutiveDays;
                if (pricePerNight < bestScore || (pricePerNight === bestScore && consecutiveDays > bestConsecutiveDays)) {
                    bestScore = pricePerNight;
                    bestConsecutiveDays = consecutiveDays;
                    bestOption = option;
                }
            }
        }
        
        if (!bestOption || bestConsecutiveDays === 0) {
            return null;
        }
        
        const stayDates = dateRange.slice(currentDateIndex, currentDateIndex + bestConsecutiveDays);
        const stayPrice = stayDates.reduce((sum, date) => sum + (bestOption!.prices[date] || 0), 0);
        
        properties.push({
            propertyName: bestOption.propertyName,
            roomName: bestOption.roomName,
            nights: bestConsecutiveDays,
            dates: stayDates,
            price: stayPrice
        });
        
        usedProperties.add(bestOption.propertyId);
        currentDateIndex += bestConsecutiveDays;
        totalPrice += stayPrice;
        totalNights += bestConsecutiveDays;
    }
    
    return {
        type: properties.length === 2 ? 'double-split' : 'triple-split',
        transfers: properties.length - 1,
        totalPrice,
        totalNights,
        properties
    };
}

/**
 * ESTRATEGIA 3: Construye split empezando con propiedad específica
 */
function buildConsecutiveSplitStartWith(partialOptions: PropertyData[], dateRange: string[], startPropertyId: number): SplitOption | null {
    const startProperty = partialOptions.find(p => p.propertyId === startPropertyId);
    if (!startProperty || !startProperty.availability[dateRange[0]]) {
        return null; // No puede empezar con esta propiedad
    }
    
    const usedProperties = new Set<number>();
    const properties: any[] = [];
    let currentDateIndex = 0;
    let totalPrice = 0;
    let totalNights = 0;
    
    // Primer paso: FORZAR usar la propiedad especificada
    let consecutiveDays = 0;
    for (let j = 0; j < dateRange.length; j++) {
        const checkDate = dateRange[j];
        if (startProperty.availability[checkDate]) {
            consecutiveDays++;
        } else {
            break;
        }
    }
    
    if (consecutiveDays > 0) {
        const stayDates = dateRange.slice(0, consecutiveDays);
        const stayPrice = stayDates.reduce((sum, date) => sum + (startProperty.prices[date] || 0), 0);
        
        properties.push({
            propertyName: startProperty.propertyName,
            roomName: startProperty.roomName,
            nights: consecutiveDays,
            dates: stayDates,
            price: stayPrice
        });
        
        usedProperties.add(startProperty.propertyId);
        currentDateIndex = consecutiveDays;
        totalPrice += stayPrice;
        totalNights += consecutiveDays;
    }
    
    // Pasos siguientes: usar lógica greedy normal
    while (currentDateIndex < dateRange.length) {
        const currentDate = dateRange[currentDateIndex];
        let bestOption: PropertyData | null = null;
        let bestConsecutiveDays = 0;
        
        for (const option of partialOptions) {
            if (usedProperties.has(option.propertyId)) continue;
            
            let consecutiveDays = 0;
            if (option.availability[currentDate]) {
                for (let j = currentDateIndex; j < dateRange.length; j++) {
                    const checkDate = dateRange[j];
                    if (option.availability[checkDate]) {
                        consecutiveDays++;
                    } else {
                        break;
                    }
                }
            }
            
            if (consecutiveDays > bestConsecutiveDays) {
                bestConsecutiveDays = consecutiveDays;
                bestOption = option;
            }
        }
        
        if (!bestOption || bestConsecutiveDays === 0) {
            return null;
        }
        
        const stayDates = dateRange.slice(currentDateIndex, currentDateIndex + bestConsecutiveDays);
        const stayPrice = stayDates.reduce((sum, date) => sum + (bestOption!.prices[date] || 0), 0);
        
        properties.push({
            propertyName: bestOption.propertyName,
            roomName: bestOption.roomName,
            nights: bestConsecutiveDays,
            dates: stayDates,
            price: stayPrice
        });
        
        usedProperties.add(bestOption.propertyId);
        currentDateIndex += bestConsecutiveDays;
        totalPrice += stayPrice;
        totalNights += bestConsecutiveDays;
    }
    
    return {
        type: properties.length === 2 ? 'double-split' : 'triple-split',
        transfers: properties.length - 1,
        totalPrice,
        totalNights,
        properties
    };
}

/**
 * Formatea respuesta optimizada para OpenAI
 */
function formatOptimizedResponse(result: OptimizedResult, startDate: string, endDate: string): string {
    const { completeOptions, splitOptions, totalNights } = result;
    
    let response = `📅 **Consulta: ${formatDateRange(startDate, endDate)} (${totalNights} noches)**\n\n`;
    
    // PRIORIDAD 1: Opciones completas
    if (completeOptions.length > 0) {
        response += `🥇 **DISPONIBILIDAD COMPLETA (${completeOptions.length} opciones)**\n`;
        
        // Ordenar por precio y mostrar top 3
        const sortedComplete = completeOptions
            .map(option => {
                const totalPrice = Object.values(option.prices).reduce((sum, price) => sum + price, 0);
                return { ...option, totalPrice };
            })
            .sort((a, b) => a.totalPrice - b.totalPrice)
            .slice(0, 3);
        
        sortedComplete.forEach((option, index) => {
            response += `✅ **Opción ${index + 1}**: ${option.propertyName} - ${totalNights} noches\n`;
            response += `   💰 Total: $${option.totalPrice.toLocaleString()}\n`;
            response += `   📊 Promedio: $${Math.round(option.totalPrice / totalNights).toLocaleString()}/noche\n\n`;
        });
    }
    
    // PRIORIDAD 2: Opciones con traslado (solo si no hay completas)
    if (splitOptions.length > 0) {
        if (completeOptions.length === 0) {
            response += `🥈 **ALTERNATIVAS CON TRASLADO** (por disponibilidad limitada - posible descuento)\n`;
        } else {
            response += `🥈 **ALTERNATIVAS CON TRASLADO** (por preferencias de precio, comodidad o disponibilidad)\n`;
        }
        
        splitOptions.forEach((split, index) => {
            const transferText = split.transfers === 1 ? '1 traslado' : `${split.transfers} traslados`;
            response += `🔄 **Opción ${index + 1}**: ${transferText} - $${split.totalPrice.toLocaleString()}\n`;
            
            split.properties.forEach((prop, propIndex) => {
                const dates = prop.dates.length > 1 ? 
                    `${prop.dates[0]} a ${prop.dates[prop.dates.length - 1]}` : 
                    prop.dates[0];
                response += `   ${propIndex === 0 ? '🏠' : '🔄'} ${prop.propertyName}: ${dates} (${prop.nights} noches) - $${prop.price.toLocaleString()}\n`;
            });
            response += '\n';
        });
    }
    
    // Si no hay opciones
    if (completeOptions.length === 0 && splitOptions.length === 0) {
        response += `❌ **Sin disponibilidad para ${totalNights} noches**\n`;
        response += `💡 Considera fechas alternativas o menos noches\n`;
    }
    
    response += `🔄 *Datos en tiempo real desde Beds24*`;
    
    return response;
}

/**
 * Genera rango de fechas
 */
function generateDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let date = new Date(start); date < end; date.setDate(date.getDate() + 1)) {
        dates.push(date.toISOString().split('T')[0]);
    }
    
    return dates;
}

/**
 * Handler principal para consultas de disponibilidad desde OpenAI
 */
export async function handleAvailabilityCheck(args: any): Promise<string> {
    // 🔧 MEJORADO: Validación robusta de parámetros según OpenAI best practices
    const { startDate, endDate, propertyId = null, roomId = null, maxTransfers = null } = args;
    
    // Validación de fechas requeridas
    if (!startDate || !endDate) {
        logError('BEDS24_VALIDATION', 'Fechas requeridas faltantes', { args });
        return 'Error: Se requieren fechas de inicio y fin para la consulta.';
    }
    
    // Validación de formato de fechas
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        logError('BEDS24_VALIDATION', 'Formato de fecha inválido', { startDate, endDate });
        return 'Error: Las fechas deben estar en formato YYYY-MM-DD.';
    }
    
    // Validación de lógica de fechas
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (start >= end) {
        logError('BEDS24_VALIDATION', 'Fecha de fin debe ser posterior a fecha de inicio', { startDate, endDate });
        return 'Error: La fecha de fin debe ser posterior a la fecha de inicio.';
    }
    
    // ✅ CORREGIDO: Permitir "hoy" y futuro, rechazar solo el pasado
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (start <= yesterday) {
        logError('BEDS24_VALIDATION', 'Fecha de inicio no puede ser del pasado', { startDate, currentDate: today.toISOString().split('T')[0] });
        return 'Error: La fecha de inicio no puede ser del pasado. Hoy y fechas futuras son válidas.';
    }
    
    // Validación de parámetros opcionales
    const maxTransfersLimit = maxTransfers !== null ? Math.max(1, Math.min(maxTransfers, 5)) : 3; // Entre 1 y 5, default 3
    
    if (propertyId !== null && (typeof propertyId !== 'number' || propertyId <= 0)) {
        logError('BEDS24_VALIDATION', 'PropertyId inválido', { propertyId });
        return 'Error: El ID de propiedad debe ser un número positivo.';
    }
    
    if (roomId !== null && (typeof roomId !== 'number' || roomId <= 0)) {
        logError('BEDS24_VALIDATION', 'RoomId inválido', { roomId });
        return 'Error: El ID de habitación debe ser un número positivo.';
    }
    
    const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    logInfo('BEDS24_REQUEST', 'Procesando consulta de disponibilidad', {
        startDate,
        endDate,
        nights,
        propertyId,
        roomId,
        maxTransfers: maxTransfersLimit,
        hasSpecificProperty: propertyId !== null,
        hasSpecificRoom: roomId !== null
    });

    try {
        logInfo('AVAILABILITY_HANDLER', 'Procesando consulta de disponibilidad', {
            startDate,
            endDate,
            propertyId,
            roomId
        });

        // Obtener datos combinados: disponibilidad + precios
        const result = await getAvailabilityAndPricesOptimized(startDate, endDate, propertyId, roomId);
        
        // Formatear respuesta optimizada para OpenAI
        const response = formatOptimizedResponse(result, startDate, endDate);
        
        logSuccess('AVAILABILITY_HANDLER', 'Consulta completada exitosamente', {
            completeOptions: result.completeOptions.length,
            splitOptions: result.splitOptions.length,
            dateRange: `${startDate} a ${endDate}`
        });

        return response;

    } catch (error) {
        logError('AVAILABILITY_HANDLER', 'Error en consulta de disponibilidad', {
            error: error instanceof Error ? error.message : error,
            args
        });

        if (error instanceof Beds24Error) {
            return `❌ Error de Beds24: ${error.message}`;
        }

        return `❌ Error al consultar disponibilidad. Por favor intenta nuevamente.`;
    }
}

/**
 * Formatea la respuesta de disponibilidad para el usuario
 */
function formatAvailabilityResponse(
    availability: AvailabilityInfo[], 
    startDate: string, 
    endDate: string
): string {
    if (availability.length === 0) {
        return `📅 No se encontraron habitaciones para las fechas ${formatDateRange(startDate, endDate)}`;
    }

    let response = `📅 **Disponibilidad para ${formatDateRange(startDate, endDate)}**\n\n`;

    // Agrupar por disponibilidad
    const available = availability.filter(room => room.available);
    const unavailable = availability.filter(room => !room.available);

    if (available.length > 0) {
        response += `✅ **HABITACIONES DISPONIBLES (${available.length})**\n`;
        available.forEach(room => {
            response += `🏠 **${room.roomName}** - ${room.propertyName}\n`;
            response += `   📊 ${room.availableDays} de ${room.totalDays} días disponibles\n`;
            
            if (room.availableDates.length <= 5) {
                response += `   📅 Fechas: ${room.availableDates.join(', ')}\n`;
            } else {
                response += `   📅 Fechas: ${room.availableDates.slice(0, 3).join(', ')} ... y ${room.availableDates.length - 3} más\n`;
            }
            
            if (room.priceInfo) {
                if (room.priceInfo.minPrice) {
                    response += `   💰 Desde $${room.priceInfo.minPrice}\n`;
                }
            }
            response += '\n';
        });
    }

    if (unavailable.length > 0) {
        response += `❌ **NO DISPONIBLES (${unavailable.length})**\n`;
        unavailable.forEach(room => {
            response += `🏠 ${room.roomName} - ${room.propertyName}\n`;
        });
    }

    response += `\n🔄 *Información actualizada en tiempo real desde Beds24*`;

    return response;
}

/**
 * Formatea el rango de fechas para mostrar
 */
function formatDateRange(startDate: string, endDate: string): string {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const startFormatted = start.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    
    const endFormatted = end.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    
    return `${startFormatted} - ${endFormatted}`;
}

/**
 * Función helper para verificar estado de Beds24
 */
export async function checkBeds24Health(): Promise<string> {
    try {
        const beds24Service = getBeds24Service(getBeds24Config());
        const isHealthy = await beds24Service.healthCheck();
        
        if (isHealthy) {
            return '✅ Conexión con Beds24 funcionando correctamente';
        } else {
            return '⚠️ Problemas de conexión con Beds24';
        }
    } catch (error) {
        return `❌ Error verificando Beds24: ${error instanceof Error ? error.message : error}`;
    }
}

// Definición de la función para OpenAI
export const availabilityFunction: AvailabilityFunction = {
    name: 'check_availability',
    description: 'Consulta disponibilidad en tiempo real de propiedades en Beds24',
    parameters: {
        type: 'object',
        properties: {
            startDate: {
                type: 'string',
                description: 'Fecha de inicio en formato YYYY-MM-DD'
            },
            endDate: {
                type: 'string',
                description: 'Fecha de fin en formato YYYY-MM-DD'
            },
            propertyId: {
                type: 'number',
                description: 'ID específico de la propiedad (opcional)'
            },
            roomId: {
                type: 'number',
                description: 'ID específico de la habitación (opcional)'
            }
        },
        required: ['startDate', 'endDate']
    }
}; 