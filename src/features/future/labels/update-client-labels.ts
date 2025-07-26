/**
 * 🏷️ FUNCIÓN DE DESARROLLO FUTURO
 * Actualización de etiquetas de clientes en WhatsApp
 * 
 * Estado: DISABLED - Listo para desarrollo futuro
 * Prioridad: Baja
 * Complejidad: Media
 * 
 * Propósito: Actualizar etiquetas de un cliente específico en WhatsApp
 * - Agregar etiquetas nuevas
 * - Remover etiquetas existentes
 * - Sincronizar con sistema de persistencia
 */

import { whapiLabels } from '../../../utils/whapi/index.js';
import { enhancedLog } from '../../../utils/core/index.js';
import { threadPersistence } from '../../../utils/persistence/index.js';
import { invalidateUserCaches } from '../../../app-unified.js';

export interface UpdateLabelsArgs {
  userId: string;
  removeLabels?: string[];
  addLabels?: string[];
  reason?: string;
}

export interface UpdateLabelsResult {
  success: boolean;
  message?: string;
  error?: string;
  details?: {
    userId: string;
    removed: string[];
    added: string[];
    errors: string[];
    reason: string;
  };
}

/**
 * Actualizar etiquetas de un cliente
 * 
 * @param args - Argumentos para la actualización
 * @returns Resultado de la operación
 */
export async function updateClientLabels(args: UpdateLabelsArgs): Promise<UpdateLabelsResult> {
  try {
    const { userId, removeLabels = [], addLabels = [], reason } = args;

    if (!userId) {
      return { 
        success: false,
        error: 'userId es requerido' 
      };
    }

    enhancedLog('info', 'LABELS_UPDATE', 
      `Actualizando etiquetas para ${userId}. Razón: ${reason || 'No especificada'}`);

    // Convertir nombres de etiquetas a IDs si es necesario
    const removeIds = await resolveLabelsToIds(removeLabels);
    const addIds = await resolveLabelsToIds(addLabels);

    // Actualizar etiquetas en Whapi
    const result = await whapiLabels.updateChatLabels(userId, removeIds, addIds);
    
    // 🟡 OPTIMIZACIÓN: Invalidar cachés después de actualizar etiquetas
    invalidateUserCaches(userId);

    // Sincronizar etiquetas en el sistema de persistencia de threads
    try {
      const chatInfo = await whapiLabels.getChatInfo(userId);
      if (chatInfo && chatInfo.labels) {
        const shortUserId = userId.split('@')[0];
        const success = threadPersistence.updateThreadLabels(shortUserId, chatInfo.labels);
        
        enhancedLog('success', 'LABELS_UPDATE', 
          `Etiquetas sincronizadas en threadPersistence para ${userId}`, { 
            success,
            labelsCount: chatInfo.labels.length,
            labels: chatInfo.labels
          });
      }
    } catch (syncError) {
      enhancedLog('warning', 'LABELS_UPDATE', 
        `Error sincronizando etiquetas en threadPersistence: ${syncError.message}`);
    }

    enhancedLog('success', 'LABELS_UPDATE', 
      `Etiquetas actualizadas exitosamente para ${userId}`);

    return {
      success: true,
      message: 'Etiquetas actualizadas exitosamente',
      details: {
        userId,
        removed: result.removed,
        added: result.added,
        errors: result.errors,
        reason: reason || 'Actualización automática'
      }
    };

  } catch (error) {
    enhancedLog('error', 'LABELS_UPDATE', `Error actualizando etiquetas: ${error.message}`);
    return { 
      success: false,
      error: `Error actualizando etiquetas: ${error.message}`
    };
  }
}

/**
 * Convertir nombres de etiquetas a IDs
 * 
 * @param labels - Lista de nombres o IDs de etiquetas
 * @returns Lista de IDs de etiquetas
 */
async function resolveLabelsToIds(labels: string[]): Promise<string[]> {
  const ids: string[] = [];
  
  for (const label of labels) {
    // Si ya es un ID (número), usarlo directamente
    if (/^\d+$/.test(label)) {
      ids.push(label);
    } else {
      // Si es un nombre, buscar el ID
      const labelObj = await whapiLabels.findLabelByName(label);
      if (labelObj) {
        ids.push(labelObj.id);
      } else {
        enhancedLog('warning', 'LABELS_UPDATE', 
          `Etiqueta '${label}' no encontrada`);
      }
    }
  }
  
  return ids;
}

/**
 * Función para registro en OpenAI (cuando esté habilitada)
 */
export const updateClientLabelsFunction = {
  name: 'update_client_labels',
  description: 'Actualizar etiquetas de un cliente en WhatsApp',
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'ID del usuario de WhatsApp'
      },
      removeLabels: {
        type: 'array',
        items: { type: 'string' },
        description: 'Etiquetas a remover'
      },
      addLabels: {
        type: 'array',
        items: { type: 'string' },
        description: 'Etiquetas a agregar'
      },
      reason: {
        type: 'string',
        description: 'Razón de la actualización'
      }
    },
    required: ['userId']
  }
};

// Exportar para uso futuro
export default updateClientLabels; 