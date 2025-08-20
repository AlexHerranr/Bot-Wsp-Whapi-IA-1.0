/**
 * edit-booking: Función para modificar reservas existentes
 * 
 * CASOS DE USO:
 * 1. add_payment: Solo añadir pago (mantener status actual)
 * 2. confirm_with_payment: Añadir pago + cambiar status a "confirmed"  
 * 3. cancel: Cambiar status a "cancelled" (por negociación precio)
 * 
 * PREREQUISITO: check_booking_details debe ejecutarse PRIMERO para obtener booking ID
 * 
 * ARQUITECTURA:
 * Cliente → OpenAI → check_booking_details → edit_booking() → Beds24 API POST /bookings (con ID) → Reserva Modificada
 */

import axios from 'axios';
import type { FunctionDefinition } from '../../../functions/types/function-types.js';
import { logInfo, logError, logSuccess } from '../../../utils/logging';

// ============================================================================
// INTERFACES TYPESCRIPT PARA TYPE SAFETY
// ============================================================================

interface EditBookingParams {
  bookingId: number;
  action: 'add_payment' | 'confirm_with_payment' | 'cancel';
  
  // Para action: 'add_payment' y 'confirm_with_payment'
  paymentAmount?: number;
  paymentDescription?: string; // Ej: "Comprobante transferencia Bancolombia", "Voucher Nequi recibido"
  
  // Para action: 'cancel'
  cancellationReason?: string;
  
  // Notas opcionales
  notes?: string;
}

interface EditBookingResult {
  success: boolean;
  booking?: any;
  message: string;
  error?: any;
  
  // Para flujo de cancelación
  canOfferDiscount?: boolean;
  originalAmount?: number;
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

export async function editBooking(params: EditBookingParams): Promise<EditBookingResult> {
  const { bookingId, action } = params;
  
  logInfo('EDIT_BOOKING', 'Iniciando modificación de reserva', { 
    bookingId, action, paymentAmount: params.paymentAmount 
  }, 'edit-booking.ts');

  try {
    // 1. Validar parámetros básicos OBLIGATORIOS
    if (!bookingId || !action) {
      return {
        success: false,
        message: "Faltan datos requeridos: bookingId y action (confirm/cancel)",
        error: "missing_required_fields"
      };
    }

    // 2. Validar parámetros según acción
    if (action === 'add_payment' || action === 'confirm_with_payment') {
      if (!params.paymentAmount || !params.paymentDescription) {
        return {
          success: false,
          message: `Para ${action} se requiere: paymentAmount (del comprobante) y paymentDescription (descripción del comprobante recibido)`,
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
    }

    if (action === 'cancel' && !params.cancellationReason) {
      return {
        success: false,
        message: "Para cancelar reserva se requiere: cancellationReason",
        error: "missing_cancellation_reason"
      };
    }

    // 3. Auth con refresh token para operaciones WRITE
    logInfo('EDIT_BOOKING', 'Preparando autenticación...', {}, 'edit-booking.ts');
    
    let accessToken: string;
    
    try {
      // Intentar refresh token flow primero
      const authResponse = await axios.get(`${process.env.BEDS24_API_URL}/authentication/token`, {
        headers: { 
          'refreshToken': process.env.BEDS24_WRITE_REFRESH_TOKEN 
        },
        timeout: 10000
      });

      accessToken = authResponse.data.token;
      
      logInfo('EDIT_BOOKING', 'Access token obtenido via refresh token', {
        expiresIn: authResponse.data.expiresIn
      }, 'edit-booking.ts');
      
    } catch (authError) {
      // Si falla refresh token, intentar usar token directo
      logInfo('EDIT_BOOKING', 'Refresh token falló, intentando token directo...', {
        error: authError.message
      }, 'edit-booking.ts');
      
      accessToken = process.env.BEDS24_WRITE_REFRESH_TOKEN;
      
      if (!accessToken) {
        throw new Error('No se pudo obtener access token y no hay token directo disponible');
      }
    }

    // 4. Preparar datos según acción
    let bookingUpdateData;
    
    if (action === 'add_payment') {
      // AÑADIR PAGO: Solo registrar pago, NO cambiar status
      bookingUpdateData = [{
        id: bookingId,
        // NO incluir status - mantener el actual
        invoiceItems: [{
          type: "payment",
          amount: params.paymentAmount,
          description: `Anticipo pagado: ${params.paymentDescription}`
        }],
        ...(params.notes && { notes: params.notes })
      }];
      
      logInfo('EDIT_BOOKING', 'Añadiendo pago sin cambiar status', {
        bookingId,
        paymentAmount: params.paymentAmount,
        paymentDescription: params.paymentDescription
      }, 'edit-booking.ts');
      
    } else if (action === 'confirm_with_payment') {
      // CONFIRMAR CON PAGO: Registrar pago + cambiar status a confirmed
      bookingUpdateData = [{
        id: bookingId,
        status: "confirmed", // Forzar confirmed
        invoiceItems: [{
          type: "payment",
          amount: params.paymentAmount,
          description: `Anticipo pagado: ${params.paymentDescription}`
        }],
        ...(params.notes && { notes: params.notes })
      }];
      
      logInfo('EDIT_BOOKING', 'Confirmando reserva con pago', {
        bookingId,
        paymentAmount: params.paymentAmount,
        paymentDescription: params.paymentDescription
      }, 'edit-booking.ts');
      
    } else if (action === 'cancel') {
      // CANCELAR: Solo cambiar status + razón
      bookingUpdateData = [{
        id: bookingId,
        status: "cancelled",
        notes: `Cancelado: ${params.cancellationReason}${params.notes ? ` | ${params.notes}` : ''}`
      }];
      
      logInfo('EDIT_BOOKING', 'Cancelando reserva', {
        bookingId,
        cancellationReason: params.cancellationReason
      }, 'edit-booking.ts');
    }

    // 5. POST modificar reserva en Beds24
    const response = await axios.post(`${process.env.BEDS24_API_URL}/bookings`, bookingUpdateData, {
      headers: { 
        'token': accessToken,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    // 6. Procesar respuesta
    const responseData = response.data;
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

    const actionText = action === 'add_payment' ? 'pago añadido' : 
                      action === 'confirm_with_payment' ? 'confirmada con pago' : 'cancelada';
    
    logSuccess('EDIT_BOOKING', `Reserva ${actionText} exitosamente: ${bookingId}`, {
      bookingId: bookingId,
      action: action,
      newStatus: modifiedBooking.status
    }, 'edit-booking.ts');

    // 7. Formatear respuesta según acción
    if (action === 'add_payment') {
      const formattedMessage = `✅ **PAGO AÑADIDO EXITOSAMENTE**

📋 **DETALLES DEL PAGO:**
• **Código reserva:** ${bookingId}
• **Status:** SIN CAMBIOS (mantiene el actual)
• **Nuevo pago registrado:** $${params.paymentAmount?.toLocaleString()} COP
• **Anticipo pagado:** ${params.paymentDescription}
• **Fecha registro:** ${new Date().toLocaleDateString('es-CO')}

💰 ¡Pago adicional registrado en el sistema!

📧 Se enviará confirmación actualizada por email`;

      return {
        success: true,
        booking: {
          id: bookingId,
          status: modifiedBooking.status, // Status actual sin cambios
          paymentAmount: params.paymentAmount,
          paymentDescription: params.paymentDescription,
          action: 'payment_added'
        },
        message: formattedMessage
      };
      
    } else if (action === 'confirm_with_payment') {
      const formattedMessage = `✅ **RESERVA CONFIRMADA CON PAGO**

📋 **DETALLES DE LA CONFIRMACIÓN:**
• **Código reserva:** ${bookingId}
• **Nuevo status:** CONFIRMADA ✅
• **Comprobante registrado:** $${params.paymentAmount?.toLocaleString()} COP
• **Anticipo pagado:** ${params.paymentDescription}
• **Fecha confirmación:** ${new Date().toLocaleDateString('es-CO')}

🎉 ¡Reserva confirmada y pago registrado!

📧 Se enviará confirmación actualizada por email`;

      return {
        success: true,
        booking: {
          id: bookingId,
          status: 'confirmed',
          paymentAmount: params.paymentAmount,
          paymentDescription: params.paymentDescription,
          action: 'confirmed_with_payment'
        },
        message: formattedMessage
      };

    } else { // action === 'cancel'
      const formattedMessage = `❌ **RESERVA CANCELADA**

📋 **DETALLES DE LA CANCELACIÓN:**
• **Código reserva:** ${bookingId}
• **Nuevo status:** CANCELADA ❌
• **Motivo:** ${params.cancellationReason}
• **Fecha cancelación:** ${new Date().toLocaleDateString('es-CO')}

💡 **¿Te interesa una propuesta con descuento?**
Puedo ofrecerte un precio especial para las mismas fechas.

🔄 Si decides reservar nuevamente, te ayudo a crear una nueva reserva con mejor tarifa.`;

      return {
        success: true,
        booking: {
          id: bookingId,
          status: 'cancelled',
          cancellationReason: params.cancellationReason,
          action: 'cancelled'
        },
        message: formattedMessage,
        canOfferDiscount: true, // Flag para flujo de descuento
        originalAmount: modifiedBooking.price || 0
      };
    }

  } catch (error) {
    logError('EDIT_BOOKING', `Error modificando reserva: ${error.message}`, {
      error: error.response?.data || error.message,
      params: {
        bookingId,
        action
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
        message: "❌ Datos de modificación inválidos. Verifica la información enviada.",
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
      message: "❌ Error interno modificando la reserva. Contacte soporte técnico.",
      error: error.response?.data || error.message
    };
  }
}

// ============================================================================
// DEFINICIÓN PARA OPENAI ASSISTANT
// ============================================================================

export const editBookingFunction: FunctionDefinition = {
  name: 'edit_booking',
  description: 'Modifica reservas existentes con 3 acciones: add_payment (solo añadir pago), confirm_with_payment (añadir pago Y confirmar), cancel (cancelar para negociar descuento).',
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
      action: {
        type: 'string',
        description: 'Acción: "add_payment" (solo añadir pago), "confirm_with_payment" (añadir pago Y confirmar), "cancel" (cancelar por precio)',
        enum: ['add_payment', 'confirm_with_payment', 'cancel']
      },
      paymentAmount: {
        type: 'integer',
        description: 'Monto del comprobante recibido en pesos colombianos (OBLIGATORIO para add_payment y confirm_with_payment)',
        minimum: 1000
      },
      paymentDescription: {
        type: 'string',
        description: 'Descripción del comprobante recibido (OBLIGATORIO para add_payment y confirm_with_payment - ej: "Comprobante transferencia Bancolombia", "Voucher Nequi")',
        minLength: 5,
        maxLength: 200
      },
      cancellationReason: {
        type: 'string',
        description: 'Motivo de cancelación (OBLIGATORIO para action: cancel - ej: "Precio muy alto", "Solicita descuento")',
        minLength: 5,
        maxLength: 200
      },
      notes: {
        type: 'string',
        description: 'Notas adicionales sobre la modificación (opcional)',
        maxLength: 500
      }
    },
    required: ['bookingId', 'action'],
    additionalProperties: false
  },
  handler: editBooking
};
