// src/core/services/prompt-variables.service.ts
// Servicio para gestionar las variables del prompt

import { DatabaseService } from './database.service';
import { logInfo, logWarning } from '../../utils/logging';

export class PromptVariablesService {
    constructor(private databaseService?: DatabaseService) {}
    
    /**
     * Extrae las variables necesarias para el prompt basándose en el contexto
     */
    async extractVariables(
        userId: string,
        chatId: string,
        message: string,
        metadata?: any
    ): Promise<Record<string, string>> {
        // Variables dinámicas basadas en el contexto
        const variables: Record<string, string> = {};
        
        try {
            // Solo las 3 variables esenciales que se envían con cada mensaje
            
            // 1. Fecha y hora actual (Colombia)
            const now = new Date();
            variables.fecha_hora = now.toLocaleString('es-CO', {
                timeZone: 'America/Bogota',
                dateStyle: 'full',
                timeStyle: 'short'
            });
            
            // 2. Nombre del usuario
            variables.nombre_usuario = metadata?.userName || metadata?.name || 'Cliente';
            
            // 3. Etiquetas del usuario (si existen)
            if (metadata?.labels && Array.isArray(metadata.labels)) {
                variables.etiquetas = metadata.labels.join(', ');
            } else if (metadata?.labels && typeof metadata.labels === 'string') {
                variables.etiquetas = metadata.labels;
            } else {
                variables.etiquetas = 'Sin etiquetas';
            }
            
            logInfo('PROMPT_VARIABLES_EXTRACTED', 'Variables esenciales extraídas', {
                userId,
                variableCount: Object.keys(variables).length,
                variables: variables
            });
            
        } catch (error) {
            logWarning('PROMPT_VARIABLES_ERROR', 'Error extrayendo variables del prompt', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown'
            });
        }
        
        return variables;
    }
    
    /**
     * Obtiene variables de una reserva específica
     */
    private async getBookingVariables(bookingId: string): Promise<Record<string, string>> {
        const vars: Record<string, string> = {};
        
        if (!this.databaseService) return vars;
        
        try {
            // Aquí se consultaría la base de datos para obtener los datos de la reserva
            // Por ahora retornamos variables vacías
            // TODO: Implementar consulta real a la BD
            
            vars.FECHA_ENTRADA = '';
            vars.FECHA_SALIDA = '';
            vars.ADULTOS = '';
            vars.NINOS = '';
            vars.PERSONAS = '';
            vars.APARTAMENTOS = '';
            vars.MONTO = '';
            vars.ANTICIPO = '';
            vars.SALDO_PENDIENTE = '';
            
        } catch (error) {
            logWarning('BOOKING_VARIABLES_ERROR', 'Error obteniendo variables de reserva', {
                bookingId,
                error: error instanceof Error ? error.message : 'Unknown'
            });
        }
        
        return vars;
    }
    
    /**
     * Establece valores por defecto para todas las variables esperadas
     */
    private setDefaultVariables(variables: Record<string, string>): void {
        const defaults: Record<string, string> = {
            FECHA_ENTRADA: variables.FECHA_ENTRADA || '',
            FECHA_SALIDA: variables.FECHA_SALIDA || '',
            NOMBRE: variables.NOMBRE || '',
            APELLIDO: variables.APELLIDO || '',
            EMAIL: variables.EMAIL || '',
            TELEFONO: variables.TELEFONO || '',
            ADULTOS: variables.ADULTOS || '2',
            NINOS: variables.NINOS || '0',
            PERSONAS: variables.PERSONAS || '2',
            APARTAMENTOS: variables.APARTAMENTOS || '',
            MONTO: variables.MONTO || '',
            TARIFA_API: variables.TARIFA_API || '',
            ANTICIPO: variables.ANTICIPO || '',
            DESCRIPCION_PAGO: variables.DESCRIPCION_PAGO || '',
            MONTO_CON_RECARGO: variables.MONTO_CON_RECARGO || '',
            ROOM_IDS_API: variables.ROOM_IDS_API || '',
            numero_personas: variables.numero_personas || '2',
            fecha_entrada: variables.fecha_entrada || '',
            fecha_salida: variables.fecha_salida || '',
            numero_noches: variables.numero_noches || '',
            numero_apto: variables.numero_apto || '',
            tipo_apto: variables.tipo_apto || '',
            precio_alojamiento: variables.precio_alojamiento || '',
            precio_extras: variables.precio_extras || '',
            precio_total: variables.precio_total || '',
            numero_apto2: variables.numero_apto2 || '',
            tipo_apto2: variables.tipo_apto2 || '',
            precio_alojamiento2: variables.precio_alojamiento2 || '',
            precio_extras2: variables.precio_extras2 || '',
            precio_total2: variables.precio_total2 || '',
            monto: variables.monto || '',
            fecha: variables.fecha || '',
            metodo: variables.metodo || '',
            MONTO_ANTICIPO: variables.MONTO_ANTICIPO || '',
            NOMBRE_COMPLETO: variables.NOMBRE_COMPLETO || '',
            SALDO_PENDIENTE: variables.SALDO_PENDIENTE || '',
            LISTA_APARTAMENTOS: variables.LISTA_APARTAMENTOS || '',
            PRECIO_ALOJAMIENTO: variables.PRECIO_ALOJAMIENTO || '',
            PRECIO_EXTRAS: variables.PRECIO_EXTRAS || '',
            PRECIO_TOTAL: variables.PRECIO_TOTAL || '',
            CAPACIDAD_ESTANDAR: variables.CAPACIDAD_ESTANDAR || '4'
        };
        
        // Aplicar defaults solo si no existen
        for (const [key, value] of Object.entries(defaults)) {
            if (!variables[key]) {
                variables[key] = value;
            }
        }
    }
}