// @docs: features/BEDS24_INTEGRATION_COMPLETE.md
// @docs: features/OPTIMIZACION_FORMATO_BEDS24.md
// @docs: progress/PROGRESO-BOT.md
import { getBeds24Service } from '../../services/beds24/beds24.service';
import { AvailabilityInfo, Beds24Error } from '../../services/beds24/beds24.types';
import { getBeds24Config } from '../../config/integrations/beds24.config';
import { 
    logInfo, 
    logError, 
    logSuccess,
    logBeds24Request,
    logBeds24ApiCall,
    logBeds24ResponseDetail,
    logBeds24Processing,
    logWarning
} from '../../utils/logging/index.js';
import axios from 'axios';

// --- Caché de Disponibilidad ---
const availabilityCache = new Map<string, { data: OptimizedResult; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// 🔧 ETAPA 1.2: Función de validación de fechas con fuzzy parsing
/**
 * Valida y corrige fechas con fuzzy parsing para manejar typos comunes
 * Ejemplo: "agosot" → "agosto", "15 de agosot" → "2025-08-15"
 */
function validateAndFixDates(startDate: string, endDate: string): {
    startDate: string;
    endDate: string;
    corrections: string[];
    isValid: boolean;
} {
    const corrections: string[] = [];
    let isValid = true;
    
    // 🔧 ETAPA 3: Mapeo expandido de typos comunes en meses con fuzzy matching
    const monthTypos: Record<string, string> = {
        // Typos comunes de agosto
        'agosot': 'agosto', 'agosto': 'agosto', 'agost': 'agosto', 'agust': 'agosto',
        // Typos comunes de septiembre
        'septiembre': 'septiembre', 'septiempre': 'septiembre', 'septiem': 'septiembre',
        // Typos comunes de octubre
        'octubre': 'octubre', 'octubr': 'octubre', 'octub': 'octubre',
        // Typos comunes de noviembre
        'noviembre': 'noviembre', 'noviempre': 'noviembre', 'noviem': 'noviembre',
        // Typos comunes de diciembre
        'diciembre': 'diciembre', 'diciem': 'diciembre', 'diciembr': 'diciembre',
        // Typos comunes de enero
        'enero': 'enero', 'ener': 'enero', 'enro': 'enero',
        // Typos comunes de febrero
        'febrero': 'febrero', 'febrer': 'febrero', 'febre': 'febrero',
        // Typos comunes de marzo
        'marzo': 'marzo', 'marz': 'marzo', 'mar': 'marzo',
        // Typos comunes de abril
        'abril': 'abril', 'abri': 'abril', 'abr': 'abril',
        // Typos comunes de mayo
        'mayo': 'mayo', 'may': 'mayo',
        // Typos comunes de junio
        'junio': 'junio', 'juni': 'junio', 'jun': 'junio',
        // Typos comunes de julio
        'julio': 'julio', 'juli': 'julio', 'jul': 'julio'
    };
    
    // 🔧 ETAPA 3: Función mejorada para procesar una fecha con fuzzy matching
    function processDate(dateStr: string, isStartDate: boolean): string {
        let processedDate = dateStr;
        
        // Si ya es formato YYYY-MM-DD, validar
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (dateRegex.test(dateStr)) {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
                isValid = false;
                corrections.push(`Fecha inválida: ${dateStr}`);
                return dateStr;
            }
            return dateStr;
        }
        
        // Intentar parsear fechas en formato texto
        const lowerDate = dateStr.toLowerCase();
        
        // 🔧 ETAPA 3: Patrones expandidos para fechas
        const patterns = [
            /(\d{1,2})\s+(?:de\s+)?([a-z]+)/, // "15 de agosot" o "15 agosot"
            /(\d{1,2})\/(\d{1,2})/, // "15/8" o "15/08"
            /(\d{1,2})-(\d{1,2})/, // "15-8" o "15-08"
            /(\d{1,2})\.(\d{1,2})/ // "15.8" o "15.08"
        ];
        
        for (const pattern of patterns) {
            const match = lowerDate.match(pattern);
            if (match) {
                let day: number;
                let monthText: string;
                let monthNum: number;
                
                if (pattern.source.includes('[a-z]')) {
                    // Patrón de texto: "15 de agosot"
                    day = parseInt(match[1]);
                    monthText = match[2];
                    
                    // 🔧 ETAPA 3: Fuzzy matching para meses con typos
                    let correctedMonth = monthText;
                    if (monthTypos[monthText]) {
                        correctedMonth = monthTypos[monthText];
                        if (correctedMonth !== monthText) {
                            corrections.push(`Corregido typo en mes: "${monthText}" → "${correctedMonth}"`);
                        }
                    }
                    
                    // Mapear mes a número
                    const monthMap: Record<string, number> = {
                        'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
                        'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
                        'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
                    };
                    
                    monthNum = monthMap[correctedMonth];
                } else {
                    // Patrón numérico: "15/8"
                    day = parseInt(match[1]);
                    monthNum = parseInt(match[2]);
                }
                
                if (monthNum && day >= 1 && day <= 31 && monthNum >= 1 && monthNum <= 12) {
                    const currentYear = new Date().getFullYear();
                    const formattedMonth = monthNum.toString().padStart(2, '0');
                    const formattedDay = day.toString().padStart(2, '0');
                    processedDate = `${currentYear}-${formattedMonth}-${formattedDay}`;
                    
                    corrections.push(`Fecha parseada: "${dateStr}" → "${processedDate}"`);
                    return processedDate;
                }
            }
        }
        
        // Si no se pudo procesar, marcar como inválida
        isValid = false;
        corrections.push(`No se pudo procesar fecha: ${dateStr}`);
        return dateStr;
    }
    
    const processedStartDate = processDate(startDate, true);
    const processedEndDate = processDate(endDate, false);
    
    return {
        startDate: processedStartDate,
        endDate: processedEndDate,
        corrections,
        isValid
    };
}

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
 * 🚀 NUEVO: Wrapper de caché para la consulta de disponibilidad
 */
async function getCachedAvailabilityAndPrices(
    startDate: string,
    endDate: string,
    propertyId?: number,
    roomId?: number
): Promise<OptimizedResult> {
    const cacheKey = `availability_${startDate}_${endDate}_${propertyId || 'any'}_${roomId || 'any'}`;
    const cached = availabilityCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        logInfo('BEDS24_CACHE_HIT', 'Cache de disponibilidad utilizado', {
            cacheKey,
            age_seconds: Math.round((Date.now() - cached.timestamp) / 1000)
        });
        return cached.data;
    }

    logInfo('BEDS24_CACHE_MISS', 'Cache de disponibilidad no encontrado o expirado', { cacheKey });

    const result = await getAvailabilityAndPricesOptimized(startDate, endDate, propertyId, roomId);
    
    availabilityCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
    });

    // Limpieza periódica de caché para evitar memory leaks
    if (availabilityCache.size > 100) {
        const now = Date.now();
        for (const [key, value] of availabilityCache.entries()) {
            if (now - value.timestamp > CACHE_TTL * 2) { // Eliminar entradas muy viejas
                availabilityCache.delete(key);
            }
        }
    }

    return result;
}


/**
 * Obtiene datos combinados: disponibilidad + precios con lógica de splits
 * 🔧 ETAPA 1.1: Try-catch exhaustivo y timeout configurado
 */
async function getAvailabilityAndPricesOptimized(
    startDate: string,
    endDate: string,
    propertyId?: number,
    roomId?: number
): Promise<OptimizedResult> {
    const BEDS24_TOKEN = process.env.BEDS24_TOKEN || '';
    const BEDS24_API_URL = 'https://api.beds24.com/v2';
    const API_TIMEOUT = parseInt(process.env.BEDS24_TIMEOUT || '15000'); // 15 segundos por defecto
    
    try {
        // 🔧 ETAPA 1: Try-catch específico para el punto exacto del crash
        let dateRange: string[];
        let totalNights: number;
        
        try {
            // Usar las fechas originales directamente - sin ajustes de timezone
            dateRange = generateDateRange(startDate, endDate);
            totalNights = dateRange.length;
            
        } catch (dateCalcError) {
            logError('BEDS24_CALC_ERROR', 'Error calculando noches de estadía', { 
                error: dateCalcError instanceof Error ? dateCalcError.message : String(dateCalcError),
                stack: dateCalcError instanceof Error ? dateCalcError.stack : undefined,
                startDate,
                endDate,
                startDateType: typeof startDate,
                endDateType: typeof endDate
            });
            
            // 🔧 ETAPA 2: Fallback simple para evitar crash
            return { 
                error: true, 
                message: 'Error procesando fechas de estadía',
                completeOptions: [],
                splitOptions: [],
                totalNights: 0
            } as any;
        }
        
        // 🔧 ETAPA 3: Límite de procesamiento para arrays grandes
        const MAX_NIGHTS = 30;
        if (totalNights > MAX_NIGHTS) {
            logWarning('BEDS24_NIGHTS_LIMIT', 'Búsqueda limitada por número de noches', {
                requestedNights: totalNights,
                maxAllowed: MAX_NIGHTS,
                startDate,
                endDate
            });
            
            return { 
                error: true, 
                message: `Búsquedas limitadas a ${MAX_NIGHTS} noches máximo`,
                completeOptions: [],
                splitOptions: [],
                totalNights: 0
            } as any;
        }
        
        logBeds24Processing('Calculando noches de estadía', {
            startDate,
            endDate,
            nightsRange: dateRange,
            totalNights,
            dateCalculation: 'stay_nights_only'
        });
        
        // 🔧 ETAPA 1.3: Timeout configurado para APIs externas
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
        
        try {
            // ✨ OPTIMIZACIÓN: Usar SOLO el endpoint calendar (ya incluye nombres reales)
            const calendarResponse = await fetch(`${BEDS24_API_URL}/inventory/rooms/calendar?startDate=${startDate}&endDate=${endDate}&includeNumAvail=true&includePrices=true&includeMinStay=true&includeMaxStay=true&includeMultiplier=true&includeOverride=true`, {
                headers: { 'Accept': 'application/json', 'token': BEDS24_TOKEN },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!calendarResponse.ok) {
                throw new Error(`HTTP ${calendarResponse.status}: ${calendarResponse.statusText}`);
            }
            
            const calendarData = await calendarResponse.json() as any;
            
            if (!calendarData.success) {
                throw new Error(`Error obteniendo calendario: ${calendarData.error}`);
            }

            // Logging optimizado de conexión
            logBeds24ApiCall('Consulta optimizada a Beds24 (solo calendar)', {
                success: calendarData.success,
                totalProperties: calendarData.data?.length || 0,
                dateRange: `${startDate} - ${endDate}`,
                nightsCalculated: totalNights,
                optimization: 'single-endpoint',
                endpoint: 'inventory/rooms/calendar',
                method: 'GET',
                parameters: {
                    startDate,
                    endDate,
                    includeNumAvail: true,
                    includePrices: true,
                    includeMinStay: true,
                    includeMaxStay: true,
                    includeMultiplier: true,
                    includeOverride: true
                }
            });

            // Log detallado de la respuesta cruda para análisis
            logBeds24ResponseDetail('Respuesta cruda de Beds24 API', {
                firstRoom: calendarData.data?.[0] ? {
                    propertyId: calendarData.data[0].propertyId,
                    roomId: calendarData.data[0].roomId,
                    name: calendarData.data[0].name,
                    calendarEntries: calendarData.data[0].calendar?.length || 0,
                    sampleEntry: calendarData.data[0].calendar?.[0]
                } : null,
                totalRooms: calendarData.data?.length || 0,
                responseStructure: calendarData.data?.length ? Object.keys(calendarData.data[0]) : [],
                success: calendarData.success,
                responseSize: JSON.stringify(calendarData).length
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
                            propertyName: roomData.name || `Propiedad ${propertyId}`, // ✨ OPTIMIZACIÓN: Usar nombre directo del calendar
                            roomName: roomData.name || `Habitación ${roomId}`, // ✨ Usar nombre real de la habitación
                            roomId: roomId,
                            availability: {},
                            prices: {}
                        };
                    }
                    
                    // Procesar calendario para disponibilidad y precios
                    if (roomData.calendar) {
                        roomData.calendar.forEach((calItem: any) => {
                            // 🔧 CORRECCIÓN: Procesar rango de fechas from-to de Beds24
                            const fromDate = new Date(calItem.from);
                            const toDate = new Date(calItem.to || calItem.from);
                            
                            // Generar todas las fechas cubiertas por esta entrada
                            for (let date = new Date(fromDate); date <= toDate; date.setDate(date.getDate() + 1)) {
                                const dateStr = date.toISOString().split('T')[0];
                                
                                // Solo procesar fechas que están en nuestro rango de noches
                                if (dateRange.includes(dateStr)) {
                                    // Disponibilidad basada en numAvail (0 = ocupado, 1+ = disponible)
                                    propertyData[propertyId].availability[dateStr] = (calItem.numAvail || 0) > 0;
                                    
                                    // Precios
                                    if (calItem.price1) {
                                        propertyData[propertyId].prices[dateStr] = calItem.price1;
                                    }
                                }
                            }
                        });
                    }
                });
            }
            
            // Clasificar propiedades según disponibilidad
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
            
            // Log resumen final de la respuesta
            logInfo('BEDS24_RESPONSE_SUMMARY', `Encontradas ${completeOptions.length} opciones completas y ${splitOptions.length} opciones con traslado`, {
                dateRange: `${startDate} al ${endDate}`,
                totalNights,
                completeOptionsDetail: completeOptions.slice(0, 3).map(opt => ({
                    propertyName: opt.propertyName,
                    totalPrice: Object.values(opt.prices).reduce((sum, price) => sum + price, 0),
                    pricePerNight: Math.round(Object.values(opt.prices).reduce((sum, price) => sum + price, 0) / totalNights)
                })),
                splitOptionsDetail: splitOptions.slice(0, 2).map(split => ({
                    type: split.type,
                    transfers: split.transfers,
                    totalPrice: split.totalPrice,
                    properties: split.properties.map(p => p.propertyName).join(' → ')
                }))
            });
            
            return {
                completeOptions,
                splitOptions,
                totalNights
            };
            
        } catch (error) {
            clearTimeout(timeoutId);
            
            // 🔧 ETAPA 1.1: Try-catch exhaustivo para manejar errores específicos
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    logError('BEDS24_TIMEOUT', 'Timeout en consulta a Beds24 API', {
                        timeout: API_TIMEOUT,
                        startDate,
                        endDate,
                        error: error.message
                    });
                    throw new Error(`Timeout: La consulta a Beds24 tardó más de ${API_TIMEOUT/1000} segundos`);
                }
                
                if (error.message.includes('HTTP')) {
                    logError('BEDS24_HTTP_ERROR', 'Error HTTP en consulta a Beds24', {
                        error: error.message,
                        startDate,
                        endDate
                    });
                    throw new Error(`Error de conexión con Beds24: ${error.message}`);
                }
            }
            
            logError('BEDS24_UNKNOWN_ERROR', 'Error desconocido en consulta a Beds24', {
                error: error instanceof Error ? error.message : String(error),
                startDate,
                endDate
            });
            throw new Error('Error interno al consultar disponibilidad en Beds24');
        }

    } catch (error) {
        // 🔧 ETAPA 1.1: Try-catch exhaustivo para manejar errores específicos
        if (error instanceof Error) {
            if (error.name === 'AbortError') {
                logError('BEDS24_TIMEOUT', 'Timeout en consulta a Beds24 API', {
                    timeout: API_TIMEOUT,
                    startDate,
                    endDate,
                    error: error.message
                });
                throw new Error(`Timeout: La consulta a Beds24 tardó más de ${API_TIMEOUT/1000} segundos`);
            }
            
            if (error.message.includes('HTTP')) {
                logError('BEDS24_HTTP_ERROR', 'Error HTTP en consulta a Beds24', {
                    error: error.message,
                    startDate,
                    endDate
                });
                throw new Error(`Error de conexión con Beds24: ${error.message}`);
            }
        }
        
        logError('BEDS24_UNKNOWN_ERROR', 'Error desconocido en consulta a Beds24', {
            error: error instanceof Error ? error.message : String(error),
            startDate,
            endDate
        });
        
        // Devolver respuesta de fallback
        return {
            completeOptions: [],
            splitOptions: [],
            totalNights: generateDateRange(startDate, endDate).length
        };
    }
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
    
    // 🔧 MEJORADO: Formato JSON plano para facilitar interpretación por OpenAI
    const response = {
        dateRange: `${startDate} al ${endDate}`,
        totalNights,
        completeOptions: completeOptions.slice(0, 3).map(option => ({
            propertyName: option.propertyName,
            totalPrice: Object.values(option.prices).reduce((sum, price) => sum + price, 0),
            pricePerNight: Math.round(Object.values(option.prices).reduce((sum, price) => sum + price, 0) / totalNights)
        })),
        splitOptions: splitOptions.slice(0, 3).map(split => ({
            transfers: split.transfers,
            totalPrice: split.totalPrice,
            properties: split.properties.map(prop => ({
                propertyName: prop.propertyName,
                dates: prop.dates,
                price: prop.price
            }))
        })),
        hasCompleteOptions: completeOptions.length > 0,
        hasSplitOptions: splitOptions.length > 0,
        timestamp: new Date().toISOString()
    };

    // Log para análisis (solo en logs, no en consola)
    logInfo('BEDS24_DEBUG_OUTPUT', 'Respuesta formateada para OpenAI', {
        responsePreview: JSON.stringify(response).substring(0, 200),
        responseLength: JSON.stringify(response).length,
        hasCompleteOptions: result.completeOptions.length > 0,
        hasSplitOptions: result.splitOptions.length > 0
    });

    // Log detallado para análisis
    logInfo('BEDS24_RESPONSE_DETAIL', 'Respuesta completa de Beds24 enviada a OpenAI', {
        responseLength: JSON.stringify(response).length,
        estimatedTokens: Math.ceil(JSON.stringify(response).length / 4),
        hasCompleteOptions: result.completeOptions.length > 0,
        hasSplitOptions: result.splitOptions.length > 0,
        completeOptionsCount: result.completeOptions.length,
        splitOptionsCount: result.splitOptions.length,
        totalNights: result.totalNights,
        responsePreview: JSON.stringify(response).substring(0, 200) + (JSON.stringify(response).length > 200 ? '...' : ''),
        fullResponse: JSON.stringify(response) // Contenido completo para análisis
    });

    return JSON.stringify(response);
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
export async function handleAvailabilityCheck(args: any, requestId?: string): Promise<string> {
    // 🔧 ETAPA 3: Tracking de performance para Beds24
    const startTime = Date.now();
    
    // 🔧 MEJORADO: Validación robusta de parámetros según OpenAI best practices
    let { startDate, endDate, propertyId = null, roomId = null, maxTransfers = null } = args;
    
    // 🔧 ETAPA 1.2: Validación de fechas con fuzzy parsing
    const dateValidation = validateAndFixDates(startDate, endDate);
    
    if (!dateValidation.isValid) {
        logError('BEDS24_VALIDATION', 'Fechas inválidas después de fuzzy parsing', { 
            originalStartDate: startDate,
            originalEndDate: endDate,
            corrections: dateValidation.corrections
        });
        return `Error: No se pudieron procesar las fechas. ${dateValidation.corrections.join(', ')}`;
    }
    
    // Usar las fechas corregidas
    startDate = dateValidation.startDate;
    endDate = dateValidation.endDate;
    
    // Log de correcciones si las hubo
    if (dateValidation.corrections.length > 0) {
        logInfo('BEDS24_DATE_CORRECTIONS', 'Fechas corregidas con fuzzy parsing', {
            originalStartDate: args.startDate,
            originalEndDate: args.endDate,
            correctedStartDate: startDate,
            correctedEndDate: endDate,
            corrections: dateValidation.corrections
        });
    }
    
    // 🔧 ETAPA 8: Fix Function Date Hallucination
    // Ajustar fechas si la IA alucina el año (e.g., 2024 en lugar de 2025)
    let adjustedStartDate = startDate;
    let adjustedEndDate = endDate;
    let dateAdjusted = false;
    
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-12
    
    let start = new Date(startDate);
    let end = new Date(endDate);
    const startMonth = start.getMonth() + 1; // 1-12
    const endMonth = end.getMonth() + 1; // 1-12
    
    // Si la fecha es del pasado pero el mes es futuro, ajustar al año actual o siguiente
    if (start < today && startMonth > currentMonth) {
        const newYear = currentYear;
        adjustedStartDate = `${newYear}-${startDate.substring(5, 7)}-${startDate.substring(8, 10)}`;
        dateAdjusted = true;
        logWarning('BEDS24_DATE_ADJUSTMENT', 'Año ajustado para fecha de inicio', {
            original: startDate,
            adjusted: adjustedStartDate,
            reason: 'past_date_future_month'
        });
    }
    
    if (end < today && endMonth > currentMonth) {
        const newYear = currentYear;
        adjustedEndDate = `${newYear}-${endDate.substring(5, 7)}-${endDate.substring(8, 10)}`;
        dateAdjusted = true;
        logWarning('BEDS24_DATE_ADJUSTMENT', 'Año ajustado para fecha de fin', {
            original: endDate,
            adjusted: adjustedEndDate,
            reason: 'past_date_future_month'
        });
    }
    
    // Si se ajustaron las fechas, actualizar las variables
    if (dateAdjusted) {
        startDate = adjustedStartDate;
        endDate = adjustedEndDate;
        start = new Date(startDate);
        end = new Date(endDate);
    }
    
    // Validación de lógica de fechas
    if (start >= end) {
        logError('BEDS24_VALIDATION', 'Fecha de fin debe ser posterior a fecha de inicio', { startDate, endDate });
        return 'Error: La fecha de fin debe ser posterior a la fecha de inicio.';
    }
    
    // ✅ CORREGIDO: Permitir "hoy" y futuro, rechazar solo el pasado
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (start <= yesterday) {
        logError('BEDS24_VALIDATION', 'Fecha de inicio no puede ser del pasado', { 
            startDate, 
            currentDate: today.toISOString().split('T')[0],
            dateAdjusted,
            originalStartDate: args.startDate
        });
        return 'Error: La fecha de inicio no puede ser del pasado. Por favor especifica fechas futuras.';
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
    
    logBeds24Request('Procesando consulta de disponibilidad', {
        startDate,
        endDate,
        nights,
        propertyId,
        roomId,
        maxTransfers: maxTransfersLimit,
        hasSpecificProperty: propertyId !== null,
        hasSpecificRoom: roomId !== null,
        requestType: 'availability_check',
        dateAdjusted,
        originalStartDate: args.startDate,
        originalEndDate: args.endDate,
        requestId
    });
    
    try {
        logInfo('AVAILABILITY_HANDLER', 'Procesando consulta de disponibilidad', {
            startDate,
            endDate,
            propertyId,
            roomId,
            dateAdjusted,
            requestId
        });

        // 🔧 ETAPA 1: Try-catch específico para getCachedAvailabilityAndPrices
        let result: OptimizedResult;
        try {
            // Obtener datos combinados: disponibilidad + precios (USANDO CACHÉ)
            result = await getCachedAvailabilityAndPrices(startDate, endDate, propertyId, roomId);
        } catch (cacheError) {
            logError('BEDS24_CACHE_ERROR', 'Error en consulta cacheada', {
                error: cacheError instanceof Error ? cacheError.message : String(cacheError),
                stack: cacheError instanceof Error ? cacheError.stack : undefined,
                startDate,
                endDate,
                propertyId,
                roomId
            });
            
            // 🔧 Fallback: intentar consulta directa sin cache
            try {
                logInfo('BEDS24_FALLBACK', 'Intentando consulta directa sin cache', {
                    startDate,
                    endDate
                });
                result = await getAvailabilityAndPricesOptimized(startDate, endDate, propertyId, roomId);
            } catch (directError) {
                logError('BEDS24_DIRECT_ERROR', 'Error en consulta directa', {
                    error: directError instanceof Error ? directError.message : String(directError),
                    startDate,
                    endDate
                });
                
                return 'Error: No se pudo obtener información de disponibilidad. Por favor intenta más tarde.';
            }
        }

        // 🔧 ETAPA 2: Verificar si el resultado tiene error
        if (result && 'error' in result && (result as any).error) {
            return `Error: ${(result as any).message || 'Error procesando disponibilidad'}`;
        }

        // Formatear respuesta optimizada para OpenAI
        const response = formatOptimizedResponse(result, startDate, endDate);
        
        // 🔧 ETAPA 3: Loggear métricas de performance de Beds24
        const processingMs = Date.now() - startTime;
        const responseSize = JSON.stringify(result).length;
        
        logSuccess('AVAILABILITY_HANDLER', 'Consulta completada exitosamente', {
            completeOptions: result.completeOptions.length,
            splitOptions: result.splitOptions.length,
            dateRange: `${startDate} a ${endDate}`,
            dateAdjusted,
            processingMs,
            responseSize,
            apiResponseSize: responseSize,
            isEfficient: processingMs < 5000, // <5s es eficiente
            requestId
        });

        return response;

    } catch (error) {
        logError('AVAILABILITY_HANDLER', 'Error en consulta de disponibilidad', {
            error: error instanceof Error ? error.message : error,
            args,
            dateAdjusted,
            requestId
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