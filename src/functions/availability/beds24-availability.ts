/**
 * Función de disponibilidad para Beds24
 * Migrada desde src/handlers/integrations/beds24-availability.ts
 */

// Re-exportar toda la funcionalidad existente
export * from '../../handlers/integrations/beds24-availability.js';

// Importar la función principal
import { handleAvailabilityCheck } from '../../handlers/integrations/beds24-availability.js';
import type { FunctionDefinition } from '../types/function-types.js';

/**
 * Definición de la función check_availability para el registro central
 */
export const checkAvailabilityFunction: FunctionDefinition = {
  name: 'check_availability',
  description: 'Consulta disponibilidad en tiempo real de propiedades en Beds24',
  handler: handleAvailabilityCheck,
  parameters: {
    type: 'object',
    properties: {
      startDate: {
        type: 'string',
        pattern: '^\\d{4}-\\d{2}-\\d{2}$',
        description: 'Fecha de inicio en formato YYYY-MM-DD'
      },
      endDate: {
        type: 'string',
        pattern: '^\\d{4}-\\d{2}-\\d{2}$',
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
    required: ['startDate', 'endDate'],
    additionalProperties: false
  },
  enabled: true,
  category: 'availability',
  version: '1.0.0'
}; 