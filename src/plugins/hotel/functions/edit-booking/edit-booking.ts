/**
 * edit-booking: Función para registrar comprobantes de pago en reservas existentes
 * 
 * FUNCIÓN ÚNICA:
 * - Registra comprobante de pago con valor y descripción
 * - NO modifica el status de la reserva (se mantiene como está)
 * 
 * PREREQUISITO: check_booking_details debe ejecutarse PRIMERO para obtener booking ID
 * 
 * ARQUITECTURA:
 * Cliente → OpenAI → check_booking_details → edit_booking() → Beds24 API POST /bookings (con ID) → Pago Registrado
 */

import axios from 'axios';
import type { FunctionDefinition } from '../../../../functions/types/function-types.js';
import { logInfo, logError, logSuccess } from '../../../../utils/logging';
import { Beds24Client } from '../../services/beds24-client';
import { fetchWithRetry } from '../../../../core/utils/retry-utils';

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

// ============================================================================
// INTERFACES TYPESCRIPT PARA TYPE SAFETY
// ============================================================================

interface EditBookingParams {
  bookingId: number;
  paymentAmount: number;
  paymentDescription: string; // Ej: "Comprobante transferencia Bancolombia", "Voucher Nequi recibido"
  
  // Notas opcionales
  notes?: string;
}

interface EditBookingResult {
  success: boolean;
  booking?: any;
  message: string;
  error?: any;
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

export async function editBooking(params: EditBookingParams, context?: any): Promise<EditBookingResult> {
  const { bookingId } = params;
  
  // ENVIAR MENSAJE INMEDIATO AL USUARIO
  if (context?.chatId) {
    try {
      await sendInterimMessage(
        context.chatId, 
        "✅ Perfecto, voy a confirmar tu reserva al 100%...",
        context.userId
      );
    } catch (error) {
      // Continuar sin interrumpir
    }
  }
  
  logInfo('EDIT_BOOKING', 'Iniciando registro de pago', { 
    bookingId, paymentAmount: params.paymentAmount 
  }, 'edit-booking.ts');

  try {
    // 1. Validar parámetros básicos OBLIGATORIOS
    if (!bookingId) {
      return {
        success: false,
        message: `ERROR_DATOS_FALTANTES: Falta el ID de la reserva.

INSTRUCCION: Dile al huésped que necesitas el código de reserva para poder registrar el pago, 
que lo busque en su confirmación o vas a consultar con tu superior.`,
        error: "missing_required_fields"
      };
    }

    // 2. Validar parámetros de pago (siempre requeridos)
    if (!params.paymentAmount || !params.paymentDescription) {
      return {
        success: false,
        message: `ERROR_DATOS_PAGO: Faltan datos del pago.

INSTRUCCION: Dile al huésped que necesitas el monto exacto del comprobante y una descripción 
para poder registrarlo, que vas a consultar con tu superior si hay dudas.`,
        error: "missing_payment_data"
      };
    }
    
    if (params.paymentAmount < 1000) {
      return {
        success: false,
        message: `ERROR_MONTO_INVALIDO: El monto debe ser mínimo $1.000 COP.

INSTRUCCION: Dile al huésped que el monto del comprobante parece estar incorrecto, 
que verifique el valor o vas a consultar con tu superior.`,
        error: "invalid_payment_amount"
      };
    }

    // 3. Inicializar Beds24Client y obtener datos de reserva
    const beds24Client = new Beds24Client();
    
    logInfo('EDIT_BOOKING', 'Obteniendo datos de reserva para validar canal', { bookingId }, 'edit-booking.ts');
    
    // 3.1 Obtener reserva actual para validar canal
    const bookingSearchResult = await beds24Client.searchBookings({ 
      bookingId: bookingId.toString(),
      includeInvoiceItems: false 
    });
    
    if (!bookingSearchResult.success || !bookingSearchResult.data || bookingSearchResult.data.length === 0) {
      return {
        success: false,
        message: `ERROR_RESERVA_NO_ENCONTRADA: No se encontró la reserva ${bookingId}.

INSTRUCCION: Dile al huésped que no pudiste encontrar esa reserva en el sistema, 
que vas a consultar con tu superior para verificar el código.`,
        error: "booking_not_found"
      };
    }
    
    const existingBooking = bookingSearchResult.data[0];
    const rawChannel = existingBooking.referer || 'Unknown';
    
    // Normalizar canal siguiendo la lógica existente del sistema
    let bookingChannel = rawChannel;
    if (rawChannel.toLowerCase().includes('booking.com')) {
      bookingChannel = 'Booking.com';
    } else if (rawChannel.toLowerCase().includes('direct') || rawChannel.toLowerCase().includes('pacartagena')) {
      bookingChannel = 'Direct';
    }
    
    logInfo('EDIT_BOOKING', 'Canal de reserva detectado', { 
      bookingId, 
      rawChannel,
      normalizedChannel: bookingChannel
    }, 'edit-booking.ts');
    
    // 3.2 Validar restricciones por canal para pagos
    const isBookingCom = bookingChannel === 'Booking.com';
    const isDirect = bookingChannel === 'Direct';
    
    if (!isBookingCom && !isDirect) {
      return {
        success: false,
        message: `ERROR_CANAL_NO_PERMITIDO: Los pagos solo se registran para Booking.com y reservas directas.

INSTRUCCION: Dile al huésped que para reservas de ${rawChannel} el pago se gestiona 
directamente en la plataforma, que vas a consultar con tu superior si tiene dudas.`,
        error: "channel_not_allowed_for_payments"
      };
    }
    
    logInfo('EDIT_BOOKING', 'Canal válido para registrar pagos', { 
      bookingId, 
      channel: bookingChannel 
    }, 'edit-booking.ts');

    // 4. Preparar datos para registro de pago
    const bookingUpdateData = {
      id: bookingId,
      // NO incluir status - mantener el actual
      invoiceItems: [{
        type: "payment",
        amount: params.paymentAmount,
        description: `Pago registrado: ${params.paymentDescription}`
      }],
      ...(params.notes && { notes: params.notes })
    };
    
    logInfo('EDIT_BOOKING', 'Registrando pago sin modificar status', {
      bookingId,
      paymentAmount: params.paymentAmount,
      paymentDescription: params.paymentDescription
    }, 'edit-booking.ts');

    // 4.5 DETECTAR PAGOS EXISTENTES para sugerencia condicional
    const existingPayments = (existingBooking.invoiceItems || [])
      .filter((item: any) => item.type === 'payment')
      .length;
    const isSecondPaymentOrMore = existingPayments >= 1; // Ya hay 1+ pagos, el nuevo será el 2do+
    
    logInfo('PAYMENT_DETECTION', 'Analizando pagos existentes para sugerencia', {
      bookingId,
      existingPayments,
      isSecondPaymentOrMore,
      newPaymentAmount: params.paymentAmount
    }, 'edit-booking.ts');

    // 5. Actualizar reserva usando Beds24Client
    const responseData = await beds24Client.updateBooking(bookingUpdateData);

    // 6. Procesar respuesta
    const modifiedBooking = responseData[0]?.modified;

    if (!modifiedBooking) {
      logError('EDIT_BOOKING', 'Respuesta inesperada de Beds24', {
        response: responseData
      }, 'edit-booking.ts');
      
      return {
        success: false,
        message: "Error procesando respuesta de Beds24",
        error: "unexpected_response"
      };
    }

    logSuccess('EDIT_BOOKING', `Pago registrado exitosamente: ${bookingId}`, {
      bookingId: bookingId,
      paymentAmount: params.paymentAmount,
      status: modifiedBooking.status
    }, 'edit-booking.ts');

    // 7. Formatear respuesta con formato estándar para OpenAI
    const nextStep = isSecondPaymentOrMore 
      ? 'Procede a ejecutar generate_payment_receipt_pdf para generar el recibo de este pago.'
      : 'Procede a ejecutar generate_booking_confirmation_pdf para generar el documento actualizado.';
    
    const formattedMessage = `EXITO_PAGO_REGISTRADO: Comprobante registrado correctamente en la reserva ${bookingId}.

DATOS_CONFIRMADOS:
• Código reserva: ${bookingId}
• Status: ${modifiedBooking.status}
• Monto registrado: $${params.paymentAmount?.toLocaleString()} COP
• Comprobante: ${params.paymentDescription}
• Número de pago: #${existingPayments + 1}
• Fecha: ${new Date().toLocaleDateString('es-CO')}

SIGUIENTE_PASO: ${nextStep}`;

    return {
      success: true,
      booking: {
        id: bookingId,
        status: modifiedBooking.status, // Status actual sin cambios
        paymentAmount: params.paymentAmount,
        paymentDescription: params.paymentDescription
      },
      message: formattedMessage
    };

  } catch (error) {
    logError('EDIT_BOOKING', `Error registrando pago: ${error.message}`, {
      error: error.response?.data || error.message,
      params: {
        bookingId,
        paymentAmount: params.paymentAmount
      }
    }, 'edit-booking.ts');

    // Manejar errores específicos
    if (error.response?.status === 401) {
      return {
        success: false,
        message: `ERROR_AUTENTICACION: Token de escritura inválido o expirado.

INSTRUCCION: Dile al huésped que hubo un problema técnico al registrar el pago, 
que vas a notificar a tu superior para resolverlo de inmediato.`,
        error: "auth_error"
      };
    }

    if (error.response?.status === 404) {
      return {
        success: false,
        message: `ERROR_RESERVA_NO_ENCONTRADA: No se encontró la reserva ${bookingId}.

INSTRUCCION: Dile al huésped que no pudiste encontrar esa reserva, 
que vas a consultar con tu superior para verificar el código.`,
        error: "booking_not_found"
      };
    }

    if (error.response?.status === 400) {
      return {
        success: false,
        message: `ERROR_VALIDACION: Datos de pago inválidos.

INSTRUCCION: Dile al huésped que hay un problema con los datos del comprobante, 
que necesitas verificar la información con tu superior.`,
        error: "validation_error"
      };
    }

    if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND') {
      return {
        success: false,
        message: `ERROR_CONEXION: No se pudo conectar con el sistema de reservas.

INSTRUCCION: Dile al huésped que hay un problema de conexión con el sistema, 
que vas a notificar a tu superior y reintentar en unos minutos.`,
        error: "connection_error"
      };
    }

    return {
      success: false,
      message: `ERROR_INTERNO: Error al registrar el pago en el sistema.

INSTRUCCION: Dile al huésped que hubo un problema técnico al registrar el comprobante, 
que vas a notificar inmediatamente a tu superior para solucionarlo.`,
      error: error.response?.data || error.message
    };
  }
}

// ============================================================================
// DEFINICIÓN PARA OPENAI ASSISTANT
// ============================================================================

export const editBookingFunction: FunctionDefinition = {
  name: 'edit_booking',
  description: 'Registra comprobantes de pago en reservas existentes. Solo añade pagos sin modificar el status de la reserva.',
  category: 'booking',
  version: '3.0.0',
  enabled: true,
  parameters: {
    type: 'object',
    properties: {
      bookingId: {
        type: 'integer',
        description: 'ID de la reserva existente en Beds24 (OBLIGATORIO)',
        minimum: 1000000
      },
      paymentAmount: {
        type: 'integer',
        description: 'Monto del comprobante recibido en pesos colombianos',
        minimum: 1000
      },
      paymentDescription: {
        type: 'string',
        description: 'Descripción del comprobante recibido (ej: "Comprobante transferencia Bancolombia", "Voucher Nequi")',
        minLength: 5,
        maxLength: 200
      },
      notes: {
        type: 'string',
        description: 'Notas adicionales sobre el pago (opcional)',
        maxLength: 500
      }
    },
    required: ['bookingId', 'paymentAmount', 'paymentDescription'],
    additionalProperties: false
  },
  handler: editBooking
};
