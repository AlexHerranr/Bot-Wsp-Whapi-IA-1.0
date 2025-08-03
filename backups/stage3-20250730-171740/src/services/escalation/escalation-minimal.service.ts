/**
 * Servicio de Escalamiento Mínimo
 * Solo 5 razones que REALMENTE requieren intervención humana
 */

import { ESCALATION_RULES, FALLBACK_DESTINATION } from './escalation-minimal.config';
import axios from 'axios';

export interface MinimalEscalationContext {
  userId: string;
  userName: string;
  chatId: string;
  reason: string;
  context?: any;
}

export class EscalationServiceMinimal {
  
  /**
   * Escalar a humano - Solo casos que realmente lo requieren
   */
  static async escalateToHuman(reason: string, context: MinimalEscalationContext): Promise<boolean> {
    try {
      console.log(`🚀 [ESCALATION] Escalando por razón: ${reason}`);
      
      // 1. Obtener regla de escalamiento
      const rule = ESCALATION_RULES[reason] || {
        reason: 'unknown',
        destination: FALLBACK_DESTINATION,
        requiresImmediate: false,
        includeContext: true,
        template: 'DEFAULT'
      };

      // 2. Generar mensaje específico
      const message = this.generateSpecificMessage(reason, context);

      // 3. Enviar mensaje
      console.log(`📤 [ESCALATION] Enviando a: ${rule.destination.name} (${rule.destination.id})`);
      console.log(`📝 [ESCALATION] Mensaje:`);
      console.log(message);
      console.log(`⏰ [ESCALATION] Prioridad: ${rule.destination.priority}`);

      await this.sendToWhatsApp(rule.destination.id, message);

      return true;
    } catch (error) {
      console.error(`❌ [ESCALATION] Error:`, error);
      return false;
    }
  }

  /**
   * Generar mensaje específico para cada razón
   */
  private static generateSpecificMessage(reason: string, context: MinimalEscalationContext): string {
    const timestamp = new Date().toLocaleString('es-CO', { 
      timeZone: 'America/Bogota',
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Templates específicos para cada razón esencial
    const templates: Record<string, string> = {
      'payment_confirmation': `💰 *CONFIRMAR PAGO*

👤 Cliente: ${context.userName} (${context.userId})
📱 Chat: ${context.chatId}

🤖 Cliente envió comprobante de pago que requiere verificación manual.

📞 *Acción:* Verificar pago en cuenta bancaria
⏰ ${timestamp}`,

      'customer_complaint': `⚠️ *QUEJA CLIENTE*

👤 Cliente: ${context.userName} (${context.userId})
📱 Chat: ${context.chatId}

🤖 Cliente tiene una queja o problema que requiere atención personal.

📞 *Acción:* CONTACTAR INMEDIATAMENTE
⏰ ${timestamp}`,

      'damage_report': `🔧 *REPORTE DAÑOS*

👤 Cliente: ${context.userName} (${context.userId})
📱 Chat: ${context.chatId}

🤖 Cliente reporta daños o problemas en el apartamento.

📞 *Acción:* Inspeccionar y tomar medidas
⏰ ${timestamp}`,

      'arrival_notification': `📍 *LLEGADA PROGRAMADA*

👤 Cliente: ${context.userName} (${context.userId})
📱 Chat: ${context.chatId}

🤖 Cliente notifica hora de llegada para coordinación.

📞 *Acción:* Coordinar con equipo de recepción
⏰ ${timestamp}`,

      'departure_notification': `🚪 *SALIDA PROGRAMADA*

👤 Cliente: ${context.userName} (${context.userId})
📱 Chat: ${context.chatId}

🤖 Cliente notifica hora de salida para coordinación.

📞 *Acción:* Coordinar checkout con equipo
⏰ ${timestamp}`
    };

    // Usar template específico o genérico
    return templates[reason] || `🤖 *ESCALAMIENTO*

👤 Cliente: ${context.userName} (${context.userId})
📱 Chat: ${context.chatId}
⚡ Razón: ${reason}

📞 *Acción:* Revisar caso
⏰ ${timestamp}`;
  }

  /**
   * Enviar mensaje a WhatsApp usando WHAPI
   */
  private static async sendToWhatsApp(chatId: string, message: string): Promise<boolean> {
    try {
      const whapiUrl = process.env.WHAPI_URL || 'https://gate.whapi.cloud';
      const whapiToken = process.env.WHAPI_TOKEN;

      if (!whapiToken) {
        console.error('❌ [ESCALATION] WHAPI_TOKEN no configurado');
        return false;
      }

      const response = await axios.post(`${whapiUrl}/messages/text`, {
        to: chatId,
        body: message
      }, {
        headers: {
          'Authorization': `Bearer ${whapiToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 200) {
        console.log(`✅ [ESCALATION] Mensaje enviado exitosamente a ${chatId}`);
        return true;
      } else {
        console.error(`❌ [ESCALATION] Error enviando mensaje: ${response.status}`);
        return false;
      }

    } catch (error) {
      console.error(`❌ [ESCALATION] Error en envío WHAPI:`, error.message);
      return false;
    }
  }
} 