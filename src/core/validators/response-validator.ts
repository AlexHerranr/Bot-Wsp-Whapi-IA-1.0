// src/core/validators/response-validator.ts
import { injectable } from 'tsyringe';
import { logInfo, logWarning } from '../../utils/logger';
import { ApartmentCacheService } from '../../plugins/hotel/services/apartment-cache.service';

export interface ValidationResult {
    isValid: boolean;
    reason?: string;
    internalObservation?: string;
    suggestedAction?: 'retry' | 'modify' | 'block';
}

export interface ValidationFilter {
    name: string;
    priority: number; // 1-10, donde 10 es la más alta prioridad
    validate(message: string, context?: any): ValidationResult;
}

@injectable()
export class ResponseValidator {
    private filters: ValidationFilter[] = [];
    
    constructor(
        private apartmentCache: ApartmentCacheService
    ) {
        this.initializeFilters();
    }

    private initializeFilters(): void {
        // Filtro 1: Confirmación de reserva sin número
        this.addFilter({
            name: 'reservation-confirmation',
            priority: 10,
            validate: (message: string) => {
                // Patrones que indican confirmación
                const confirmationPatterns = [
                    /tu\s+reserva\s+(está|esta)\s+confirmada/i,
                    /ha\s+sido\s+confirmada/i,
                    /reserva\s+confirmada/i,
                    /confirmación\s+de\s+(tu\s+)?reserva/i,
                    /hemos\s+confirmado\s+(tu\s+)?reserva/i,
                    /reserva.*confirmada\s+exitosamente/i,
                    /confirmamos\s+(tu\s+)?reserva/i
                ];

                // Patrones que indican número de reserva
                const reservationNumberPatterns = [
                    /número\s+de\s+reserva[:：]\s*\w+/i,
                    /reservation\s+number[:：]\s*\w+/i,
                    /código\s+de\s+reserva[:：]\s*\w+/i,
                    /referencia[:：]\s*\w+/i,
                    /\b(RES|RESV|BK|BOOK|REF)[-_]?\d{4,}/i,
                    /\b\d{6,}\b/ // Números largos que podrían ser reservas
                ];

                // Verificar si hay confirmación
                const hasConfirmation = confirmationPatterns.some(pattern => pattern.test(message));
                
                if (!hasConfirmation) {
                    return { isValid: true };
                }

                // Si hay confirmación, verificar si tiene número de reserva
                const hasReservationNumber = reservationNumberPatterns.some(pattern => pattern.test(message));

                if (!hasReservationNumber) {
                    return {
                        isValid: false,
                        reason: 'Confirmación de reserva sin número de referencia',
                        internalObservation: 'Observación interna: Estás enviando palabras como "reserva confirmada" o "ha sido confirmada" sin incluir el número de reserva. Si aún no ha pagado anticipo o no es de Airbnb/Hotels/Expedia, reconsidera tu respuesta. Mejor indícale que está pendiente de confirmación, o en caso contrario envía junto con el número de reserva (siempre y cuando haya pagado anticipo o sea de plataformas verificadas).',
                        suggestedAction: 'retry'
                    };
                }

                return { isValid: true };
            }
        });

        // Filtro 2: Números de apartamento válidos
        this.addFilter({
            name: 'valid-apartment-numbers',
            priority: 8,
            validate: (message: string) => {
                // Buscar menciones de apartamentos
                const apartmentPatterns = [
                    /apto\.?\s*(\d{3,4}[A-Za-z]?)/gi,
                    /apartamento\s*(\d{3,4}[A-Za-z]?)/gi,
                    /apt\.?\s*(\d{3,4}[A-Za-z]?)/gi,
                    /unidad\s*(\d{3,4}[A-Za-z]?)/gi
                ];

                const mentionedApartments: string[] = [];
                
                apartmentPatterns.forEach(pattern => {
                    const matches = message.matchAll(pattern);
                    for (const match of matches) {
                        if (match[1]) {
                            mentionedApartments.push(match[1].toUpperCase());
                        }
                    }
                });

                if (mentionedApartments.length === 0) {
                    return { isValid: true };
                }

                // Verificar contra el cache
                const validApartments = this.apartmentCache.getAllApartments();
                const invalidApartments = mentionedApartments.filter(apt => 
                    !validApartments.some(valid => 
                        valid.roomName.includes(apt) || 
                        valid.roomName.replace(/\s+/g, '').includes(apt)
                    )
                );

                if (invalidApartments.length > 0) {
                    return {
                        isValid: false,
                        reason: `Números de apartamento inválidos: ${invalidApartments.join(', ')}`,
                        internalObservation: `Observación interna: Estás mencionando apartamentos que no existen en nuestro sistema: ${invalidApartments.join(', ')}. Por favor verifica los números de apartamento antes de enviar la respuesta.`,
                        suggestedAction: 'retry'
                    };
                }

                return { isValid: true };
            }
        });

        // Filtro 3: Precios sospechosos
        this.addFilter({
            name: 'suspicious-prices',
            priority: 7,
            validate: (message: string) => {
                // Buscar menciones de precios
                const pricePatterns = [
                    /\$\s*(\d{1,3}(?:[.,]\d{3})*)/g,
                    /(\d{1,3}(?:[.,]\d{3})*)\s*(?:pesos|COP)/gi,
                    /precio[^:]*[:：]\s*(\d{1,3}(?:[.,]\d{3})*)/gi,
                    /valor[^:]*[:：]\s*(\d{1,3}(?:[.,]\d{3})*)/gi,
                    /tarifa[^:]*[:：]\s*(\d{1,3}(?:[.,]\d{3})*)/gi
                ];

                const prices: number[] = [];
                
                pricePatterns.forEach(pattern => {
                    const matches = message.matchAll(pattern);
                    for (const match of matches) {
                        if (match[1]) {
                            const price = parseInt(match[1].replace(/[.,]/g, ''));
                            if (!isNaN(price)) {
                                prices.push(price);
                            }
                        }
                    }
                });

                // Verificar precios sospechosamente bajos o altos
                const suspiciouslyLow = prices.some(price => price < 50000); // Menos de 50k COP
                const suspiciouslyHigh = prices.some(price => price > 5000000); // Más de 5M COP por noche

                if (suspiciouslyLow || suspiciouslyHigh) {
                    return {
                        isValid: false,
                        reason: `Precios sospechosos detectados: ${prices.join(', ')}`,
                        internalObservation: `Observación interna: Los precios mencionados parecen ${suspiciouslyLow ? 'muy bajos' : 'muy altos'} para ser reales. Por favor verifica que los precios sean correctos antes de enviar la respuesta.`,
                        suggestedAction: 'retry'
                    };
                }

                return { isValid: true };
            }
        });

        logInfo('VALIDATOR_INITIALIZED', 'Validador de respuestas inicializado', {
            filtersCount: this.filters.length,
            filterNames: this.filters.map(f => f.name)
        });
    }

    private addFilter(filter: ValidationFilter): void {
        this.filters.push(filter);
        // Ordenar por prioridad descendente
        this.filters.sort((a, b) => b.priority - a.priority);
    }

    public async validateResponse(message: string, context?: any): Promise<ValidationResult> {
        // Ejecutar filtros en orden de prioridad
        for (const filter of this.filters) {
            const result = filter.validate(message, context);
            
            if (!result.isValid) {
                logWarning('VALIDATION_FAILED', `Validación falló: ${filter.name}`, {
                    filterName: filter.name,
                    reason: result.reason,
                    messagePreview: message.substring(0, 100)
                });
                return result;
            }
        }

        return { isValid: true };
    }

    // Método para agregar filtros personalizados en runtime
    public registerFilter(filter: ValidationFilter): void {
        this.addFilter(filter);
        logInfo('FILTER_REGISTERED', 'Nuevo filtro registrado', {
            name: filter.name,
            priority: filter.priority
        });
    }

    // Método para obtener estadísticas
    public getStats(): { totalFilters: number; filterNames: string[] } {
        return {
            totalFilters: this.filters.length,
            filterNames: this.filters.map(f => f.name)
        };
    }
}