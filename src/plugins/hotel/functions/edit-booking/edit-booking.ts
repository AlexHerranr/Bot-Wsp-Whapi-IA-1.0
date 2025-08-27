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

export async function editBooking(params: EditBookingParams): Promise<EditBookingResult> {
  const { bookingId } = params;
  
  logInfo('EDIT_BOOKING', 'Iniciando registro de pago', { 
    bookingId, paymentAmount: params.paymentAmount 
  }, 'edit-booking.ts');

  try {
    // 1. Validar parámetros básicos OBLIGATORIOS
    if (!bookingId) {
      return {
        success: false,
        message: "Falta dato requerido: bookingId",
        error: "missing_required_fields"
      };
    }

    // 2. Validar parámetros de pago (siempre requeridos)
    if (!params.paymentAmount || !params.paymentDescription) {
      return {
        success: false,
        message: "Se requiere: paymentAmount (del comprobante) y paymentDescription (descripción del comprobante recibido)",
        error: "missing_payment_data"
      };
    }
    
    if (params.paymentAmount < 1000) {
      return {
        success: false,
        message: "El monto del comprobante debe ser mínimo $1.000 COP",
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
        message: `❌ No se encontró la reserva con ID ${bookingId}. Verifica el código de reserva.`,
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
        message: `❌ Los pagos solo se pueden registrar para reservas de Booking.com y Directas. Esta reserva es de: ${rawChannel}`,
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

    // 7. Formatear respuesta
    const formattedMessage = `✅ **PAGO REGISTRADO EXITOSAMENTE**

📋 **DETALLES DEL PAGO:**
• **Código reserva:** ${bookingId}
• **Status actual:** ${modifiedBooking.status} (sin cambios)
• **Pago registrado:** $${params.paymentAmount?.toLocaleString()} COP
• **Comprobante:** ${params.paymentDescription}
• **Fecha registro:** ${new Date().toLocaleDateString('es-CO')}

💰 ¡Pago registrado en el sistema!

📧 Se enviará confirmación actualizada por email

🔔 **Sugerencia para OpenAI:** Se ha agregado el pago y actualizado el status de la reserva. Procede a llamar a la función \`generate_invoice_pdf\` para generar y enviar el documento PDF de confirmación actualizada al huésped.`;

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
        message: "❌ Error de autenticación. Token de escritura inválido o expirado.",
        error: "auth_error"
      };
    }

    if (error.response?.status === 404) {
      return {
        success: false,
        message: `❌ No se encontró la reserva con ID ${bookingId}. Verifica el código de reserva.`,
        error: "booking_not_found"
      };
    }

    if (error.response?.status === 400) {
      return {
        success: false,
        message: "❌ Datos de pago inválidos. Verifica la información enviada.",
        error: "validation_error"
      };
    }

    if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND') {
      return {
        success: false,
        message: "❌ Error de conexión con Beds24. Intente nuevamente en unos minutos.",
        error: "connection_error"
      };
    }

    return {
      success: false,
      message: "❌ Error interno registrando el pago. Contacte soporte técnico.",
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
