// @docs: features/BEDS24_INTEGRATION_COMPLETE.md
// @docs: features/OPTIMIZACION_FORMATO_BEDS24.md
// @docs: progress/PROGRESO-BOT.md
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
    
    // Usar las fechas originales directamente - sin ajustes de timezone
    const dateRange = generateDateRange(startDate, endDate);
    const totalNights = dateRange.length;
    
    logInfo('BEDS24_NIGHTS_CALCULATION', 'Calculando noches de estadía', {
        startDate,
        endDate,
        nightsRange: dateRange,
        totalNights
    });
    
    // Obtener nombres de propiedades
    const propertiesResponse = await fetch(`${BEDS24_API_URL}/properties`, {
        headers: { 'Accept': 'application/json', 'token': BEDS24_TOKEN }
    });
    const propertiesData = await propertiesResponse.json() as any;
    
    if (!propertiesData.success) {
        throw new Error(`Error obteniendo propiedades: ${propertiesData.error}`);
    }
    
    // Usar fechas originales para la consulta a Beds24
    const calendarResponse = await fetch(`${BEDS24_API_URL}/inventory/rooms/calendar?startDate=${startDate}&endDate=${endDate}&includeNumAvail=true&includePrices=true`, {
        headers: { 'Accept': 'application/json', 'token': BEDS24_TOKEN }
    });
    const calendarData = await calendarResponse.json() as any;
    
    if (!calendarData.success) {
        throw new Error(`Error obteniendo calendario: ${calendarData.error}`);
    }

    // Logging básico de conexión
    logInfo('BEDS24_API_CALL', 'Consulta exitosa a Beds24', {
        success: calendarData.success,
        totalProperties: calendarData.data?.length || 0,
        dateRange: `${startDate} - ${endDate}`,
        nightsCalculated: totalNights
    });

    // Mapear los datos de Beds24 a las noches reales de estadía
    const mappedCalendarData = mapBeds24DataToStayNights(calendarData.data || [], startDate, endDate);

    // Procesar datos de disponibilidad y precios
    const propertyData: Record<number, PropertyData> = {};
    
    if (calendarData.success && mappedCalendarData) {
        mappedCalendarData.forEach((roomData: any) => {
            const propertyId = roomData.propertyId;
            const roomId = roomData.roomId;
            
            // Inicializar datos de la propiedad
            if (!propertyData[propertyId]) {
                propertyData[propertyId] = {
                    propertyId: propertyId,
                    propertyName: propertiesData.data.find(p => p.id === propertyId)?.name || `Propiedad ${propertyId}`,
                    roomName: `Habitación ${roomId}`,
                    roomId: roomId,
                    availability: {},
                    prices: {}
                };
            }
            
            // Procesar calendario para disponibilidad y precios
            if (roomData.calendar) {
                roomData.calendar.forEach((calItem: any) => {
                    // Usar la fecha directamente de Beds24
                    const dateToProcess = calItem.from;
                    
                    if (dateRange.includes(dateToProcess)) {
                        // Disponibilidad basada en numAvail (0 = ocupado, 1+ = disponible)
                        propertyData[propertyId].availability[dateToProcess] = (calItem.numAvail || 0) > 0;
                        
                        // Precios
                        if (calItem.price1) {
                            propertyData[propertyId].prices[dateToProcess] = calItem.price1;
                        }
                    }
                });
            }
        });
    }
    
    // Logging básico de procesamiento
    logInfo('BEDS24_PROCESSING', 'Datos procesados correctamente', {
        totalProperties: Object.keys(propertyData).length,
        nightsRange: dateRange,
        totalNights
    });

    // Clasificar opciones - CORRECCIÓN: Solo considerar noches reales
    const completeOptions: PropertyData[] = [];
    const partialOptions: PropertyData[] = [];
    
    Object.values(propertyData).forEach(property => {
        // CORRECCIÓN: Verificar disponibilidad solo para noches de estadía
        const isFullyAvailableAndPriced = dateRange.every(date => property.availability[date] && property.prices[date] > 0);
        
        if (isFullyAvailableAndPriced) {
            completeOptions.push(property);
        } else {
            // CORRECCIÓN: Verificar disponibilidad parcial solo para noches reales
            const isPartiallyAvailable = dateRange.some(date => property.availability[date] && property.prices[date] > 0);
            if (isPartiallyAvailable) {
                partialOptions.push(property);
            }
        }
    });
    
    // Logging básico de clasificación
    logInfo('BEDS24_CLASSIFICATION', 'Propiedades clasificadas', {
        completeOptions: completeOptions.length,
        partialOptions: partialOptions.length,
        willGenerateSplits: completeOptions.length === 0 ? true : completeOptions.length <= 2,
        nightsAnalyzed: totalNights
    });

    // Generar opciones de split según nueva lógica:
    // - 0 completas: hasta 3 splits (cualquier cantidad de traslados)
    // - 1 completa: 2 splits (máximo 1 traslado)
    // - 2+ completas: 1 split (máximo 1 traslado)
    let splitOptions: SplitOption[] = [];
    if (completeOptions.length === 0) {
        // Sin opciones completas: buscar cualquier combinación viable
        splitOptions = findConsecutiveSplits(partialOptions, dateRange, 3, 3);
    } else if (completeOptions.length === 1) {
        // 1 opción completa: mostrar 2 alternativas con máximo 1 traslado
        splitOptions = findConsecutiveSplits(partialOptions, dateRange, 2, 1);
    } else if (completeOptions.length >= 2) {
        // 2+ opciones completas: mostrar 1 alternativa con máximo 1 traslado
        splitOptions = findConsecutiveSplits(partialOptions, dateRange, 1, 1);
    }
    
    // Logging básico de splits
    if (splitOptions.length > 0) {
        logInfo('BEDS24_SPLITS', 'Splits generados exitosamente', {
            splitCount: splitOptions.length,
            averageTransfers: splitOptions.reduce((sum, split) => sum + split.transfers, 0) / splitOptions.length
        });
    }
    
    return {
        completeOptions,
        splitOptions,
        totalNights
    };
}

/**
 * Genera splits consecutivos optimizados con diferentes estrategias
 */
function findConsecutiveSplits(partialOptions: PropertyData[], dateRange: string[], maxResults: number = 3, maxTransfers: number = 3): SplitOption[] {
    const splits: SplitOption[] = [];
    const uniqueSplits = new Map<string, SplitOption>();
    
    // ESTRATEGIA 1: Maximizar noches consecutivas (greedy por duración)
    const split1 = buildConsecutiveSplitMaxNights(partialOptions, dateRange);
    if (split1 && split1.totalNights === dateRange.length && split1.transfers <= maxTransfers) {
        const key = split1.properties.map(p => p.propertyName).join('-');
        uniqueSplits.set(key, split1);
    }
    
    // ESTRATEGIA 2: Minimizar precio total (greedy por precio)
    const split2 = buildConsecutiveSplitMinPrice(partialOptions, dateRange);
    if (split2 && split2.totalNights === dateRange.length && split2.transfers <= maxTransfers) {
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
        if (split3 && split3.totalNights === dateRange.length && split3.transfers <= maxTransfers) {
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
    
    // Filtrar opciones según límites especificados
    const viableOptions = allSplits.filter(split => split.transfers <= maxTransfers);
    return viableOptions.slice(0, maxResults);
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
    
    if (totalNights !== dateRange.length) {
        return null; // Devolver null si no se cubren todas las noches
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
                    if (option.availability[checkDate] && option.prices[checkDate] > 0) {
                        consecutiveDays++;
                        tempPrice += option.prices[checkDate];
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
    
    if (totalNights !== dateRange.length) {
        return null; // Devolver null si no se cubren todas las noches
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
        if (startProperty.availability[checkDate] && startProperty.prices[checkDate] > 0) {
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
                    if (option.availability[checkDate] && option.prices[checkDate] > 0) {
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
    
    if (totalNights !== dateRange.length) {
        return null; // Devolver null si no se cubren todas las noches
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
    
    // Usar las fechas originales de entrada y salida (no las noches)
    let response = `📅 **${formatDateRange(startDate, endDate)} (${totalNights} ${totalNights === 1 ? 'noche' : 'noches'})**\n\n`;
    
    // 1. Mostrar siempre las opciones de estancia completa si existen
    if (completeOptions.length > 0) {
        response += `🥇 **Apartamentos Disponibles (${completeOptions.length} opciones)**\n`;
        
        const sortedComplete = completeOptions
            .map(option => {
                const totalPrice = Object.values(option.prices).reduce((sum, price) => sum + price, 0);
                return { ...option, totalPrice };
            })
            .sort((a, b) => a.totalPrice - b.totalPrice)
            .slice(0, 3); // Máximo 3 opciones principales
        
        sortedComplete.forEach((option, index) => {
            response += `✅ **${option.propertyName}** - $${option.totalPrice.toLocaleString()}\n`;
            response += `   📊 $${Math.round(option.totalPrice / totalNights).toLocaleString()}/noche\n\n`;
        });
    }
    
    // 2. Mostrar opciones alternas con cambio de apartamento (siempre que estén disponibles)
    if (splitOptions.length > 0) {
        // Contextualizar según disponibilidad completa
        if (completeOptions.length === 0) {
            response += `\n❌ **No hay Disponibilidad Completa - Solo Parcial con Opción de Traslado**\n`;
            response += `💡 *Alternativas con cambio de apartamento (ofrecer solo como opción adicional al huésped)*\n\n`;
        } else {
            response += `\n🔄 **Opciones Adicionales con Traslado**\n`;
            response += `💡 *Alternativas económicas con cambio de apartamento (opcional para el huésped)*\n\n`;
        }
        
        splitOptions.slice(0, 3).forEach((split, index) => { // Máximo 3 opciones alternas
            const transferText = split.transfers === 1 ? '1 traslado' : `${split.transfers} traslados`;
            response += `🔄 **Alternativa ${index + 1}**: ${transferText} - $${split.totalPrice.toLocaleString()}\n`;
            
            split.properties.forEach((prop, propIndex) => {
                const dates = prop.dates.length > 1 ? 
                    `${prop.dates[0]} a ${prop.dates[prop.dates.length - 1]}` : 
                    prop.dates[0];
                response += `   ${propIndex === 0 ? '🏠' : '🔄'} ${prop.propertyName}: ${dates} - $${prop.price.toLocaleString()}\n`;
            });
            response += '\n';
        });
    }
    
    // 3. Mensaje final si no se encontró absolutamente nada
    if (completeOptions.length === 0 && splitOptions.length === 0) {
        response += `❌ **Sin disponibilidad para ${totalNights} ${totalNights === 1 ? 'noche' : 'noches'}**\n`;
        response += `💡 Considera fechas alternativas\n`;
    }
    
    // Agregar fecha y hora de la consulta (más conciso)
    const now = new Date();
    const consultaDateTime = now.toLocaleString('es-ES', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Bogota'
    });
    
    response += `\n🔄 *Beds24 - ${consultaDateTime}*`;
    
    // Log para análisis (solo en logs, no en consola)
    logInfo('BEDS24_DEBUG_OUTPUT', 'Respuesta formateada para OpenAI', {
        responsePreview: response.substring(0, 200),
        responseLength: response.length,
        hasCompleteOptions: result.completeOptions.length > 0,
        hasSplitOptions: result.splitOptions.length > 0
    });

    // Log detallado para análisis
    logInfo('BEDS24_RESPONSE_DETAIL', 'Respuesta completa de Beds24 enviada a OpenAI', {
        responseLength: response.length,
        estimatedTokens: Math.ceil(response.length / 4),
        hasCompleteOptions: result.completeOptions.length > 0,
        hasSplitOptions: result.splitOptions.length > 0,
        completeOptionsCount: result.completeOptions.length,
        splitOptionsCount: result.splitOptions.length,
        totalNights: result.totalNights,
        responsePreview: response.substring(0, 200) + (response.length > 200 ? '...' : ''),
        fullResponse: response // Contenido completo para análisis
    });

    return response;
}

/**
 * Procesa los datos de Beds24 para las noches de estadía
 * Simplificado: usar los datos tal como vienen de Beds24
 */
function mapBeds24DataToStayNights(calendarData: any[], originalStartDate: string, originalEndDate: string): any[] {
    logInfo('BEDS24_DATA_MAPPING', 'Procesando datos de Beds24', {
        originalStartDate,
        originalEndDate,
        beds24DataCount: calendarData.length
    });
    
    // Retornar los datos tal como vienen de Beds24
    // El procesamiento posterior se encargará de usar las fechas correctas
    return calendarData;
}

/**
 * Genera rango de fechas para calendarios (inclusivo)
 * Usado para procesar datos del calendario de Beds24 donde ambas fechas son inclusivas
 */
function generateDateRangeInclusive(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Para calendarios, incluir fecha de fin
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        dates.push(date.toISOString().split('T')[0]);
    }
    
    return dates;
}

/**
 * Genera rango de fechas
 */
function generateDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // IMPORTANTE: No incluir la fecha de fin (día de checkout)
    // Del 15 al 18 = 3 noches (15, 16, 17), el 18 es checkout
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
 * Formatea el rango de fechas para mostrar (entrada y salida)
 */
function formatDateRange(startDate: string, endDate: string): string {
    // Usar parsing manual para evitar problemas de zona horaria
    const formatDate = (dateStr: string): string => {
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };
    
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

/**
 * Función helper para verificar estado de Beds24 y mostrar información de créditos
 */
export async function checkBeds24Health(): Promise<string> {
    try {
        const BEDS24_TOKEN = process.env.BEDS24_TOKEN || '';
        const BEDS24_API_URL = 'https://api.beds24.com/v2';
        
        // Hacer una consulta simple para obtener headers de créditos
        const response = await axios.get(`${BEDS24_API_URL}/properties`, {
            headers: { 'Accept': 'application/json', 'token': BEDS24_TOKEN },
            timeout: 10000
        });
        
        // Extraer headers de créditos
        const headers = response.headers;
        const creditLimit = headers['x-fivemincreditlimit'] || 'N/A';
        const creditResetsIn = headers['x-fivemincreditlimit-resetsin'] || 'N/A';
        const creditRemaining = headers['x-fivemincreditlimit-remaining'] || 'N/A';
        const requestCost = headers['x-requestcost'] || 'N/A';
        
        // Formatear respuesta con información de créditos
        let healthResponse = '✅ Conexión con Beds24 funcionando correctamente\n\n';
        healthResponse += '💳 **INFORMACIÓN DE CRÉDITOS:**\n';
        healthResponse += `   • Límite por 5 min: ${creditLimit} créditos\n`;
        healthResponse += `   • Créditos restantes: ${creditRemaining}\n`;
        healthResponse += `   • Reset en: ${creditResetsIn} segundos\n`;
        healthResponse += `   • Costo de esta consulta: ${requestCost} créditos\n\n`;
        
        // Calcular porcentaje de uso
        if (creditLimit !== 'N/A' && creditRemaining !== 'N/A') {
            const used = parseInt(creditLimit) - parseInt(creditRemaining);
            const usagePercent = ((used / parseInt(creditLimit)) * 100).toFixed(1);
            healthResponse += `📊 **USO DE CRÉDITOS:**\n`;
            healthResponse += `   • Usados: ${used}/${creditLimit} (${usagePercent}%)\n`;
            
            if (parseInt(creditRemaining) < 100) {
                healthResponse += `   ⚠️ ADVERTENCIA: Pocos créditos restantes!\n`;
            }
        }
        
        // Log detallado para análisis
        logInfo('BEDS24_CREDITS', 'Información de créditos capturada', {
            creditLimit,
            creditRemaining,
            creditResetsIn,
            requestCost,
            timestamp: new Date().toISOString()
        });
        
        return healthResponse;
        
    } catch (error) {
        logError('BEDS24_HEALTH', 'Error en health check', error);
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
}