import { Beds24Client } from '../../services/beds24-client';
import { logInfo, logError, logSuccess } from '../../../../utils/logging';
import { FunctionDefinition } from '../../../../functions/types/function-types';
import { fetchWithRetry } from '../../../../core/utils/retry-utils';

/**
 * CANCEL BOOKING - Cancelación de reservas
 * 
 * Cancela reservas cambiando su status a "cancelled". 
 * Incluye validación de pagos y promoción automática.
 * 
 * Funcionalidades:
 * - Cancelar reserva cambiando status
 * - Validar si tiene pagos registrados
 * - Promoción automática según motivo
 * - Registro de motivo de cancelación
 */

// Función helper para enviar mensaje durante el run
async function sendInterimMessage(chatId: string, message: string, userId?: string): Promise<void> {
  try {
    const WHAPI_API_URL = process.env.WHAPI_API_URL;
    const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
    
    if (!WHAPI_API_URL || !WHAPI_TOKEN) {
      return;
    }

    const payload = {
      to: chatId,
      body: message
    };

    const response = await fetchWithRetry(`${WHAPI_API_URL}/messages/text`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHAPI_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    logInfo('INTERIM_MESSAGE_SENT', 'Mensaje durante run enviado', {
      chatId,
      userId,
      messagePreview: message.substring(0, 50)
    });

  } catch (error) {
    logError('INTERIM_MESSAGE_ERROR', 'Error enviando mensaje', {
      chatId,
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

interface CancelBookingParams {
  bookingId: number;
  reason: string;
  notes?: string;
}

interface CancelBookingResult {
  success: boolean;
  booking?: any;
  message: string;
  error?: any;
  requiresEscalation?: boolean;
  details?: any;
}

export async function cancelBooking(params: CancelBookingParams, context?: any): Promise<CancelBookingResult> {
  try {
    // ENVIAR MENSAJE INMEDIATO AL USUARIO
    if (context?.chatId) {
      try {
        await sendInterimMessage(
          context.chatId, 
          "🔓 Ok, voy a cancelar y liberar esas fechas...",
          context.userId
        );
      } catch (error) {
        // Continuar sin interrumpir
      }
    }
    
    logInfo('CANCEL_BOOKING', 'Iniciando cancelación de reserva', {
      bookingId: params.bookingId,
      reason: params.reason
    }, 'cancel-booking.ts');

    // 1. Validar parámetros obligatorios
    if (!params.bookingId || !params.reason) {
      return {
        success: false,
        message: `ERROR_PARAMETROS: Faltan datos requeridos para la cancelación.

INSTRUCCION: Dile al huésped que necesitas el código de reserva y el motivo de cancelación 
para proceder, que vas a consultar con tu superior si hay dudas.`,
        error: "missing_required_parameters"
      };
    }

    const { bookingId, reason, notes } = params;

    // 2. Validar reason no vacío
    if (!reason.trim() || reason.trim().length < 5) {
      return {
        success: false,
        message: `ERROR_MOTIVO_INVALIDO: El motivo de cancelación es muy corto.

INSTRUCCION: Dile al huésped que necesitas un motivo más detallado para la cancelación, 
que vas a ayudarle con el proceso.`,
        error: "invalid_reason"
      };
    }

    // 3. Validar formato de bookingId
    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return {
        success: false,
        message: `ERROR_ID_INVALIDO: El código de reserva no es válido.

INSTRUCCION: Dile al huésped que el código de reserva parece incorrecto, 
que verifique el número o vas a consultar con tu superior.`,
        error: "invalid_booking_id"
      };
    }

    // 4. Inicializar Beds24Client y validar reserva
    const beds24Client = new Beds24Client();
    
    logInfo('CANCEL_BOOKING', 'Obteniendo datos de reserva para cancelar', { bookingId }, 'cancel-booking.ts');
    
    // 4.1 Obtener reserva actual para validar que existe y verificar pagos
    const bookingSearchResult = await beds24Client.searchBookings({
      bookingId: bookingId.toString(),
      includeInvoiceItems: true  // ✅ Incluir items para verificar pagos
    } as any);
    
    if (!bookingSearchResult.success || !bookingSearchResult.data || bookingSearchResult.data.length === 0) {
      return {
        success: false,
        message: `ERROR_RESERVA_NO_ENCONTRADA: No se encontró la reserva ${bookingId}.

INSTRUCCION: Dile al huésped que no pudiste encontrar esa reserva para cancelar, 
que vas a consultar con tu superior para verificar el código.`,
        error: "booking_not_found"
      };
    }
    
    const existingBooking = bookingSearchResult.data[0];
    const currentStatus = existingBooking.status || 'unknown';
    const rawChannel = existingBooking.referer || 'Unknown';
    
    // 4.2 Validar canal - canales bloqueados no pueden cancelarse automáticamente
    const blockedChannels = ['airbnb', 'expedia', 'hotels', 'hoteles'];
    const normalizedChannel = rawChannel.toLowerCase();
    const isBlockedChannel = blockedChannels.some(blocked => 
      normalizedChannel.includes(blocked)
    );
    
    if (isBlockedChannel) {
      logInfo('CANCEL_BOOKING', 'Cancelación rechazada - canal bloqueado para cancelación automática', {
        bookingId,
        channel: rawChannel,
        normalizedChannel,
        blockedChannels
      }, 'cancel-booking.ts');
      
      return {
        success: false,
        message: `No se puede cancelar reservas de ${rawChannel}. Indícale al huésped que no puedes cancelar reservas de ${rawChannel} y que te vas a contactar con tu superior para resolver el problema.`,
        error: "blocked_channel",
        requiresEscalation: true
      };
    }
    
    // 4.3 Verificar si hay pagos registrados
    const invoiceItems = existingBooking.invoiceItems || [];
    const hasPayments = invoiceItems.some(item => 
      item.type === 'payment' && item.amount && parseFloat(item.amount) > 0
    );
    
    if (hasPayments) {
      logInfo('CANCEL_BOOKING', 'Cancelación rechazada - reserva con pagos registrados', {
        bookingId,
        paymentsFound: invoiceItems.filter(item => item.type === 'payment').length
      }, 'cancel-booking.ts');
      
      return {
        success: false,
        message: "Hay un pago registrado. Indícale al cliente que como su reserva tiene un pago registrado no es posible anular. Te contactarás con tu superior para realizar el proceso.",
        error: "booking_has_payments",
        requiresEscalation: true
      };
    }
    
    logInfo('CANCEL_BOOKING', 'Reserva encontrada para cancelar - sin pagos registrados', { 
      bookingId, 
      currentStatus,
      channel: rawChannel,
      hasPayments: false
    }, 'cancel-booking.ts');

    // 5. Preparar datos para cancelación
    const cancelNotes = notes ? `${reason}. Notas: ${notes}` : reason;
    
    const updateData = {
      id: bookingId,
      status: "cancelled",
      notes: `Cancelado por: ${cancelNotes}`
    };
    
    logInfo('CANCEL_BOOKING', 'Cambiando status a cancelled', {
      bookingId,
      previousStatus: currentStatus,
      newStatus: 'cancelled',
      reason
    }, 'cancel-booking.ts');

    // 6. Actualizar reserva en Beds24
    const updateResult = await beds24Client.updateBooking(updateData);

    // 7. Procesar respuesta
    const modifiedBooking = updateResult[0]?.modified;

    if (!modifiedBooking) {
      logError('CANCEL_BOOKING', 'Respuesta inesperada de Beds24', {
        response: updateResult
      }, 'cancel-booking.ts');
      
      return {
        success: false,
        message: `ERROR_CANCELACION: No se pudo procesar la cancelación en el sistema.

INSTRUCCION: Dile al huésped que hubo un problema técnico al procesar la cancelación, 
que vas a notificar a tu superior para resolverlo de inmediato.`,
        error: "unexpected_response"
      };
    }

    logSuccess('CANCEL_BOOKING', `Reserva cancelada exitosamente: ${bookingId}`, {
      bookingId: bookingId,
      previousStatus: currentStatus,
      newStatus: modifiedBooking.status,
      reason
    }, 'cancel-booking.ts');

    // 8. Formatear respuesta según motivo
    const cancelDate = new Date().toLocaleDateString('es-CO');

    // Generar mensaje específico según el motivo
    let nextStepMessage = '';
    const reasonLower = reason.toLowerCase();
    
    if (reasonLower.includes('precio') || reasonLower.includes('caro') || 
        reasonLower.includes('no responde') || reasonLower.includes('no le gust')) {
      nextStepMessage = `

🎯 **¡TENEMOS UNA PROMOCIÓN VIGENTE!**
Indica al huésped que se liberó el espacio por ${reason}.

Tenemos ofertas especiales para nuevas cotizaciones que podrían resultar en un precio más favorable.

**¿Te gustaría cotizar nuevamente desde cero a ver si encuentras una opción mejor?**`;
    }
    
    const formattedMessage = `EXITO_CANCELACION: Reserva ${bookingId} cancelada correctamente.

DATOS_CONFIRMADOS:
• Código reserva: ${bookingId}
• Status anterior: ${currentStatus}
• Nuevo status: CANCELADA
• Motivo: ${reason}
• Fecha cancelación: ${cancelDate}
• Espacio liberado: Sí

${notes ? `NOTAS: ${notes}` : ''}

${nextStepMessage ? `PROMOCION_DISPONIBLE: ${nextStepMessage}` : ''}

INSTRUCCION: Confirma al huésped que la reserva fue cancelada exitosamente. 
El espacio ya está liberado. ${nextStepMessage ? 'Menciona la promoción disponible y ofrece ayuda para una nueva cotización.' : 'Si necesita algo más, estás disponible para ayudar.'}`;

    return {
      success: true,
      booking: {
        id: bookingId,
        previousStatus: currentStatus,
        newStatus: 'cancelled',
        reason: reason,
        cancelDate: cancelDate,
        channel: rawChannel
      },
      message: formattedMessage
    };

  } catch (error) {
    logError('CANCEL_BOOKING', `Error cancelando reserva: ${error.message}`, {
      error: error.response?.data || error.message,
      params: {
        bookingId: params.bookingId,
        reason: params.reason
      }
    }, 'cancel-booking.ts');

    // Manejar errores específicos
    if (error.response?.status === 401) {
      return {
        success: false,
        message: "Hay problemas para consultar la API. Menciónale al cliente que hay errores al consultar la API y que vas a consultar con tu superior.",
        error: "authentication_error"
      };
    }

    if (error.response?.status === 404) {
      return {
        success: false,
        message: "Hay problemas para consultar la API. Menciónale al cliente que hay errores al consultar la API y que vas a consultar con tu superior.",
        error: "booking_not_found"
      };
    }

    if (error.response?.status === 400) {
      return {
        success: false,
        message: "Hay problemas para consultar la API. Menciónale al cliente que hay errores al consultar la API y que vas a consultar con tu superior.",
        error: "validation_error"
      };
    }

    return {
      success: false,
      message: "Hay problemas para consultar la API. Menciónale al cliente que hay errores al consultar la API y que vas a consultar con tu superior.",
      error: "technical_error",
      details: error.message
    };
  }
}

// ============================================================================
// DEFINICIÓN PARA OPENAI ASSISTANT  
// ============================================================================

export const cancelBookingFunction: FunctionDefinition = {
  name: 'cancel_booking',
  description: 'Cancela una reserva cambiando su status a "cancelled". Usar cuando el cliente no toma la reserva por precio alto, cambio de planes, no responde seguimiento, o no le gustó el apartamento. NO funciona con Airbnb, Expedia, Hotels.com - requiere escalación.',
  category: 'booking',
  version: '2.0.0',
  enabled: true,
  parameters: {
    type: 'object',
    properties: {
      bookingId: {
        type: 'integer',
        description: 'ID de la reserva existente en Beds24 (OBLIGATORIO)',
        minimum: 1000000
      },
      reason: {
        type: 'string', 
        description: 'Motivo de cancelación (OBLIGATORIO - ej: "precio muy alto", "cambio de planes", "no responde seguimiento", "no le gustó apartamento")',
        minLength: 5,
        maxLength: 200
      },
      notes: {
        type: 'string',
        description: 'Notas adicionales sobre la cancelación (opcional)',
        maxLength: 500
      }
    },
    required: ['bookingId', 'reason'],
    additionalProperties: false
  },
  handler: cancelBooking
};
