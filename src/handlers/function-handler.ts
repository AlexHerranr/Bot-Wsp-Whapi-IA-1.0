import axios from 'axios';
import { whapiLabels } from '../utils/whapi/index.js';
import { enhancedLog } from '../utils/core/index.js';

export class FunctionHandler {
  private n8nWebhook = process.env.N8N_WEBHOOK_URL;

  async handleFunction(name: string, args: any): Promise<any> {
    enhancedLog('info', 'FUNCTION_HANDLER', `Ejecutando función: ${name}`);
    enhancedLog('info', 'FUNCTION_HANDLER', `Argumentos: ${JSON.stringify(args)}`);

    try {
      switch (name) {
        case 'check_availability':
          return await this.handleCheckAvailability(args);
        
        case 'update_client_labels':
          return await this.handleUpdateClientLabels(args);
        
        case 'get_available_labels':
          return await this.handleGetAvailableLabels(args);
        
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
   * Manejar consulta de disponibilidad (conexión con n8n)
   */
  private async handleCheckAvailability(args: any): Promise<any> {
    if (!this.n8nWebhook) {
      enhancedLog('error', 'FUNCTION_HANDLER', 'N8N_WEBHOOK_URL no está definida');
      return { error: 'La URL del webhook de n8n no está configurada.' };
    }

    try {
      const response = await axios.post(this.n8nWebhook, {
        action: 'check_availability',
        ...args
      });
      
      enhancedLog('success', 'FUNCTION_HANDLER', `Respuesta de n8n para disponibilidad: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      enhancedLog('error', 'FUNCTION_HANDLER', `Error llamando a n8n: ${error.response?.data || error.message}`);
      return { error: 'Hubo un error al consultar la disponibilidad.' };
    }
  }

  /**
   * Actualizar etiquetas de un cliente
   */
  private async handleUpdateClientLabels(args: any): Promise<any> {
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
   * Obtener etiquetas disponibles
   */
  private async handleGetAvailableLabels(args: any): Promise<any> {
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
