import axios from 'axios';
import { whapiLabels } from '../utils/whapi/index.js';
import { enhancedLog } from '../utils/core/index.js';
import { threadPersistence } from '../utils/persistence/index.js';
import { handleAvailabilityCheck } from './integrations/beds24-availability.js';
import { EscalationServiceMinimal } from '../services/escalation/escalation-minimal.service.js';

export class FunctionHandler {
  private n8nWebhook = process.env.N8N_WEBHOOK_URL;

  async handleFunction(name: string, args: any): Promise<any> {
    enhancedLog('info', 'FUNCTION_HANDLER', `Ejecutando función: ${name}`);
    enhancedLog('info', 'FUNCTION_HANDLER', `Argumentos: ${JSON.stringify(args)}`);

    try {
      switch (name) {
        case 'check_availability':
          return await this.handleCheckAvailability(args);
        
        case 'escalate_to_human':
          return await this.handleEscalateToHuman(args);
        
        // FUNCIONES DE ETIQUETAS ELIMINADAS - Sistema optimizado a solo 2 funciones esenciales
        // case 'update_client_labels': - REMOVIDA (no se usa en RAG)
        // case 'get_available_labels': - REMOVIDA (no se usa en RAG)
        
        default:
          enhancedLog('error', 'FUNCTION_HANDLER', `Función '${name}' no encontrada`);
          return { error: `Función '${name}' no encontrada.` };
      }
    } catch (error) {
      enhancedLog('error', 'FUNCTION_HANDLER', `Error ejecutando función ${name}: ${error.message}`);
      return { error: `Error ejecutando función: ${error.message}` };
    }
  }

  /**
   * Manejar escalamiento a humano
   */
  private async handleEscalateToHuman(args: any): Promise<any> {
    try {
      const { reason, context } = args;

      if (!reason) {
        return { error: 'reason es requerido' };
      }

      enhancedLog('info', 'FUNCTION_HANDLER', 
        `Escalando a humano por razón: ${reason}`);

      // Preparar contexto simple
      const escalationContext = {
        userId: context?.userId || 'unknown',
        userName: context?.userName || 'Usuario',
        chatId: context?.chatId || 'unknown',
        reason: reason,
        context: context
      };

      // Ejecutar escalamiento
      const success = await EscalationServiceMinimal.escalateToHuman(reason, escalationContext);

      if (success) {
        enhancedLog('success', 'FUNCTION_HANDLER', 
          `Escalamiento exitoso para razón: ${reason}`);
        
        return {
          success: true,
          message: 'Escalamiento procesado exitosamente',
          reason: reason,
          timestamp: new Date().toISOString()
        };
      } else {
        throw new Error('Error procesando escalamiento');
      }

    } catch (error) {
      enhancedLog('error', 'FUNCTION_HANDLER', `Error en escalamiento: ${error.message}`);
      return { 
        error: `Error procesando escalamiento: ${error.message}`,
        success: false 
      };
    }
  }

  /**
   * Manejar consulta de disponibilidad (directa con Beds24)
   */
  private async handleCheckAvailability(args: any): Promise<any> {
    try {
      // Usar el handler directo de Beds24
      const result = await handleAvailabilityCheck(args);
      
      enhancedLog('success', 'FUNCTION_HANDLER', `Consulta de disponibilidad Beds24 completada`);
      
      // Log detallado del contenido exacto enviado a OpenAI
      enhancedLog('info', 'OPENAI_FUNCTION_OUTPUT', `Contenido exacto enviado a OpenAI después de check_availability`, {
        functionName: 'check_availability',
        args: args,
        resultType: typeof result,
        resultLength: Array.isArray(result) ? result.length : 'N/A',
        fullContent: result, // Contenido completo que recibe OpenAI
        timestamp: new Date().toISOString()
      });
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      enhancedLog('error', 'FUNCTION_HANDLER', `Error en disponibilidad Beds24: ${error.message}`);
      return { 
        success: false,
        error: 'Hubo un error al consultar la disponibilidad en tiempo real.' 
      };
    }
  }

  /**
   * FUNCIÓN DESHABILITADA - Actualizar etiquetas de un cliente
   * NOTA: Función no se usa en RAG, mantenida para futuro uso si es necesario
   */
  private async handleUpdateClientLabels_DISABLED(args: any): Promise<any> {
    try {
      const { userId, removeLabels = [], addLabels = [], reason } = args;

      if (!userId) {
        return { error: 'userId es requerido' };
      }

      enhancedLog('info', 'FUNCTION_HANDLER', 
        `Actualizando etiquetas para ${userId}. Razón: ${reason || 'No especificada'}`);

      // Convertir nombres de etiquetas a IDs si es necesario
      const removeIds = await this.resolveLabelsToIds(removeLabels);
      const addIds = await this.resolveLabelsToIds(addLabels);

      // Actualizar etiquetas en Whapi
      const result = await whapiLabels.updateChatLabels(userId, removeIds, addIds);

      // 🆕 Sincronizar etiquetas en el sistema de persistencia de threads
      try {
        // Obtener las etiquetas actualizadas del chat
        const chatInfo = await whapiLabels.getChatInfo(userId);
        if (chatInfo && chatInfo.labels) {
          const shortUserId = userId.split('@')[0];
          const success = threadPersistence.updateThreadLabels(shortUserId, chatInfo.labels);
          
          enhancedLog('success', 'FUNCTION_HANDLER', 
            `Etiquetas sincronizadas en threadPersistence para ${userId}`, { 
              success,
              labelsCount: chatInfo.labels.length,
              labels: chatInfo.labels
            });
        }
      } catch (syncError) {
        enhancedLog('warning', 'FUNCTION_HANDLER', 
          `Error sincronizando etiquetas en threadPersistence: ${syncError.message}`);
      }

      enhancedLog('success', 'FUNCTION_HANDLER', 
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
      enhancedLog('error', 'FUNCTION_HANDLER', `Error actualizando etiquetas: ${error.message}`);
      return { 
        error: `Error actualizando etiquetas: ${error.message}`,
        success: false 
      };
    }
  }

  /**
   * FUNCIÓN DESHABILITADA - Obtener etiquetas disponibles
   * NOTA: Función no se usa en RAG, mantenida para futuro uso si es necesario
   */
  private async handleGetAvailableLabels_DISABLED(args: any): Promise<any> {
    try {
      const labels = await whapiLabels.getAvailableLabels();
      
      enhancedLog('success', 'FUNCTION_HANDLER', `Obtenidas ${labels.length} etiquetas disponibles`);

      return {
        success: true,
        labels: labels.map(label => ({
          id: label.id,
          name: label.name,
          color: label.color,
          count: label.count || 0
        }))
      };

    } catch (error) {
      enhancedLog('error', 'FUNCTION_HANDLER', `Error obteniendo etiquetas: ${error.message}`);
      return { 
        error: `Error obteniendo etiquetas: ${error.message}`,
        success: false 
      };
    }
  }

  /**
   * Convertir nombres de etiquetas a IDs
   */
  private async resolveLabelsToIds(labels: string[]): Promise<string[]> {
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
          enhancedLog('warning', 'FUNCTION_HANDLER', 
            `Etiqueta '${label}' no encontrada`);
        }
      }
    }
    
    return ids;
  }
}
