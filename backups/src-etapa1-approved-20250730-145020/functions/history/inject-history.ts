/**
 * Función de inyección de historial para OpenAI
 * Permite al asistente inyectar historial de conversación de manera inteligente
 */

import type { FunctionDefinition } from '../types/function-types.js';

/**
 * Definición de la función de inyección de historial
 */
export const injectHistoryFunction: FunctionDefinition = {
  name: 'inject_history',
  description: 'Inyecta historial de conversación de manera inteligente para mantener contexto. Solo se ejecuta cuando es necesario para evitar duplicados y optimizar tokens.',
  category: 'context',
  version: '1.0.0',
  enabled: true,
  parameters: {
    type: 'object',
    properties: {
      thread_id: {
        type: 'string',
        description: 'ID del thread de OpenAI donde inyectar el historial'
      },
      user_id: {
        type: 'string',
        description: 'ID del usuario de WhatsApp (formato: 1234567890@s.whatsapp.net)'
      },
      chat_id: {
        type: 'string',
        description: 'ID del chat de WhatsApp'
      },
      is_new_thread: {
        type: 'boolean',
        description: 'Indica si es un thread nuevo (true) o existente (false)'
      },
      context_analysis: {
        type: 'object',
        description: 'Análisis de contexto para determinar si necesita inyección',
        properties: {
          needs_injection: {
            type: 'boolean',
            description: 'Indica si necesita inyección de contexto'
          },
          match_percentage: {
            type: 'number',
            description: 'Porcentaje de coincidencia con contexto relevante (0-100)'
          },
          reason: {
            type: 'string',
            description: 'Razón por la que necesita o no inyección'
          }
        },
        required: ['needs_injection', 'match_percentage', 'reason']
      },
      request_id: {
        type: 'string',
        description: 'ID de la solicitud para tracking (opcional)'
      }
    },
    required: ['thread_id', 'user_id', 'chat_id', 'is_new_thread']
  },
  handler: async (args: any, requestId?: string) => {
    try {
      // Importar la función real de inyección
      const { injectHistory } = await import('../../utils/context/historyInjection.js');
      
      const {
        thread_id,
        user_id,
        chat_id,
        is_new_thread,
        context_analysis,
        request_id
      } = args;
      
      // Validar parámetros requeridos
      if (!thread_id || !user_id || !chat_id) {
        throw new Error('Parámetros requeridos faltantes: thread_id, user_id, chat_id');
      }
      
      // Ejecutar inyección de historial
      const result = await injectHistory(
        thread_id,
        user_id,
        chat_id,
        is_new_thread,
        context_analysis,
        request_id || requestId
      );
      
      return {
        success: result.success,
        message: result.success ? 'Inyección de historial completada exitosamente' : 'Error en inyección de historial',
        data: {
          tokens_used: result.tokensUsed,
          context_length: result.contextLength,
          history_lines: result.historyLines,
          labels_count: result.labelsCount,
          reason: result.reason
        },
        metadata: {
          thread_id,
          user_id: user_id.split('@')[0],
          is_new_thread,
          request_id: request_id || requestId
        }
      };
      
    } catch (error) {
      return {
        success: false,
        message: `Error en inyección de historial: ${error.message}`,
        data: {
          tokens_used: 0,
          context_length: 0,
          history_lines: 0,
          labels_count: 0,
          reason: `error: ${error.message}`
        },
        metadata: {
          thread_id: args.thread_id,
          user_id: args.user_id?.split('@')[0],
          is_new_thread: args.is_new_thread,
          request_id: args.request_id || requestId
        }
      };
    }
  }
}; 