/**
 * Función de escalamiento a humano
 * Migrada desde src/handlers/function-handler.ts
 */

import { enhancedLog } from '../../utils/core/index.js';
import { EscalationServiceMinimal } from '../../services/escalation/escalation-minimal.service.js';
import type { FunctionDefinition, FunctionResponse, EscalationData } from '../types/function-types.js';

/**
 * Handler para escalamiento a humano
 */
export async function handleEscalateToHuman(args: EscalationData): Promise<FunctionResponse> {
  try {
    const { reason, context } = args;

    if (!reason) {
      return { 
        success: false, 
        error: 'reason es requerido' 
      };
    }

    enhancedLog('info', 'ESCALATION_HANDLER', 
      `Escalando a humano por razón: ${reason}`);

    // Preparar contexto simple
    const escalationContext = {
      userId: (context as any)?.userId || 'unknown',
      userName: (context as any)?.userName || 'Usuario',
      chatId: (context as any)?.chatId || 'unknown',
      reason: reason,
      context: context
    };

    // Ejecutar escalamiento
    const success = await EscalationServiceMinimal.escalateToHuman(reason, escalationContext);

    if (success) {
      enhancedLog('success', 'ESCALATION_HANDLER', 
        `Escalamiento exitoso para razón: ${reason}`);
      
      return {
        success: true,
        message: 'Escalamiento procesado exitosamente',
        data: {
          reason: reason,
          timestamp: new Date().toISOString()
        }
      };
    } else {
      throw new Error('Error procesando escalamiento');
    }

  } catch (error) {
    enhancedLog('error', 'ESCALATION_HANDLER', `Error en escalamiento: ${error.message}`);
    return { 
      success: false,
      error: `Error procesando escalamiento: ${error.message}`
    };
  }
}

/**
 * Definición de la función escalate_to_human para el registro central
 */
export const escalateToHumanFunction: FunctionDefinition = {
  name: 'escalate_to_human',
  description: 'Transfiere conversación a agente humano cuando se requiere intervención manual',
  handler: handleEscalateToHuman,
  parameters: {
    type: 'object',
    properties: {
      reason: {
        type: 'string',
        enum: [
          'payment_confirmation',
          'customer_complaint', 
          'damage_report',
          'arrival_notification',
          'departure_notification',
          'technical_issue',
          'special_request'
        ],
        description: 'Razón específica para la escalación'
      },
      context: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'Resumen de la consulta'
          },
          urgency: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            description: 'Nivel de urgencia'
          },
          customerInfo: {
            type: 'object',
            description: 'Información del cliente'
          }
        },
        required: ['summary'],
        description: 'Contexto adicional'
      }
    },
    required: ['reason', 'context'],
    additionalProperties: false
  },
  enabled: true,
  category: 'escalation',
  version: '1.0.0'
}; 