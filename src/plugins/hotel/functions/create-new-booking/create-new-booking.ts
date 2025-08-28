/**
 * create-new-booking: Función para crear nuevas reservas básicas
 * 
 * ARQUITECTURA:
 * Cliente → OpenAI → create_new_booking() → Beds24 API POST /bookings → Nueva Reserva
 * 
 * FUNCIONALIDAD:
 * - Crear reservas con datos básicos: nombres, fechas, adultos/niños
 * - Incluir alojamiento (roomId) y extras básicos (notes)
 * - Registrar payment según anticipo pagado
 * - Usar refreshToken para auth de escritura
 */

import axios from 'axios';
import type { FunctionDefinition } from '../../../../functions/types/function-types.js';
import { logInfo, logError, logSuccess } from '../../../../utils/logging';
import { Beds24Client } from '../../services/beds24-client';

// ============================================================================
// INTERFACES TYPESCRIPT PARA TYPE SAFETY
// ============================================================================

interface CreateBookingParams {
  roomIds: number[]; // CAMBIADO: Ahora acepta múltiples apartamentos
  arrival: string;
  departure: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  numAdult: number;
  numChild?: number;
  arrivalTime?: string;
  accommodationRate: number;
  extraServices?: Array<{
    description: string;
    amount: number;
    qty?: number;
  }>;
  advancePayment: number;
  advanceDescription: string;
}

interface CreateBookingResult {
  success: boolean;
  bookings?: any[]; // CAMBIADO: Ahora retorna array de reservas
  message: string;
  error?: any;
  summary?: string;
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

export async function createNewBooking(params: CreateBookingParams): Promise<CreateBookingResult> {
  const { roomIds, arrival, departure, firstName, lastName, email, phone, numAdult, accommodationRate, advancePayment, advanceDescription } = params;
  
  logInfo('CREATE_NEW_BOOKING', 'Iniciando creación de reservas múltiples', { 
    roomIds, roomCount: roomIds.length, arrival, departure, firstName, lastName, phone, numAdult, accommodationRate, advancePayment 
  }, 'create-new-booking.ts');

  try {
    // 1. Validar SOLO parámetros básicos OBLIGATORIOS (apartamentos + pago + datos huésped)
    if (!roomIds || !Array.isArray(roomIds) || roomIds.length === 0 || !arrival || !departure || !firstName || !lastName || !email || !phone || !numAdult || !accommodationRate || !advancePayment || !advanceDescription) {
      return {
        success: false,
        message: "Faltan datos BÁSICOS requeridos: apartamentos (array), fechas, nombres, email, teléfono, adultos, tarifa alojamiento y anticipo con descripción",
        error: "missing_required_fields"
      };
    }

    // 1.1 Validar que todos los roomIds sean números válidos
    const invalidRoomIds = roomIds.filter(id => !Number.isInteger(id) || id < 100000);
    if (invalidRoomIds.length > 0) {
      return {
        success: false,
        message: `IDs de apartamentos inválidos: ${invalidRoomIds.join(', ')}. Deben ser números enteros >= 100000`,
        error: "invalid_room_ids"
      };
    }
    

    // 2. Validar formato de fechas
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(arrival) || !dateRegex.test(departure)) {
      return {
        success: false,
        message: "Formato de fechas inválido. Use YYYY-MM-DD",
        error: "invalid_date_format"
      };
    }

    // 3. Validar fechas lógicas
    if (new Date(arrival) >= new Date(departure)) {
      return {
        success: false,
        message: "La fecha de salida debe ser posterior a la fecha de entrada",
        error: "invalid_date_range"
      };
    }

    // 4. Inicializar Beds24Client - MIGRADO
    const beds24Client = new Beds24Client();
    
    logInfo('CREATE_NEW_BOOKING', 'Usando Beds24Client para crear reserva', {}, 'create-new-booking.ts');

    // 5. Calcular noches y preparar datos comunes
    const nights = Math.ceil((new Date(departure).getTime() - new Date(arrival).getTime()) / (1000 * 60 * 60 * 24));
    const roomCount = roomIds.length;
    
    // Preparar notas con hora de llegada
    const notesArray = [];
    if (params.arrivalTime) {
      notesArray.push(`Hora de llegada: ${params.arrivalTime}`);
    }
    // Agregar nota sobre múltiples apartamentos si aplica
    if (roomCount > 1) {
      notesArray.push(`Reserva grupal: ${roomCount} apartamentos para ${firstName} ${lastName}`);
    }
    const notes = notesArray.join(' | ');

    // 5.1 Calcular distribución de pagos
    const paymentPerRoom = Math.floor(advancePayment / roomCount);
    const remainderPayment = advancePayment % roomCount;
    
    // 6. Preparar múltiples reservas con distribución de pagos
    const bookingDataArray = [];
    
    for (let i = 0; i < roomIds.length; i++) {
      const roomId = roomIds[i];
      const invoiceItems = [];
      
      // Item 1: Alojamiento (OBLIGATORIO para cada apartamento)
      invoiceItems.push({
        type: "charge",
        description: `Alojamiento ${nights} noche${nights > 1 ? 's' : ''}`,
        qty: nights,
        amount: accommodationRate
      });
      
      // Item 2: Extras (si existen, divididos proporcionalmente)
      if (params.extraServices && params.extraServices.length > 0) {
        params.extraServices.forEach(extra => {
          // Dividir extras entre apartamentos
          const extraAmountPerRoom = Math.floor(extra.amount / roomCount);
          const extraRemainder = extra.amount % roomCount;
          const finalExtraAmount = extraAmountPerRoom + (i < extraRemainder ? 1 : 0);
          
          invoiceItems.push({
            type: "charge",
            description: `${extra.description} (${i + 1}/${roomCount})`,
            qty: extra.qty || 1,
            amount: finalExtraAmount
          });
        });
      }
      
      // Item 3: Pago del anticipo distribuido
      const roomPayment = paymentPerRoom + (i < remainderPayment ? 1 : 0);
      invoiceItems.push({
        type: "payment",
        amount: roomPayment,
        description: `${advanceDescription} (${i + 1}/${roomCount})`
      });

      // Crear objeto de reserva para este apartamento
      bookingDataArray.push({
        roomId: roomId,
        arrival: arrival,
        departure: departure,
        firstName: firstName,
        lastName: lastName,
        email: email,
        phone: phone,
        numAdult: numAdult,
        numChild: params.numChild || 0,
        status: advancePayment >= 50000 ? "confirmed" : "new", // Confirmed si hay anticipo suficiente
        referer: "Direct", // Canal directo
        notes: notes,
        invoiceItems: invoiceItems
      });
    }

    logInfo('CREATE_NEW_BOOKING', 'Enviando request múltiple a Beds24', {
      roomIds,
      roomCount,
      arrival,
      departure,
      extrasCount: params.extraServices?.length || 0,
      advanceAmount: params.advancePayment || 0,
      paymentPerRoom
    }, 'create-new-booking.ts');

    // 7. Crear múltiples reservas usando endpoint batch de Beds24
    const responseData = await beds24Client.createMultipleBookings(bookingDataArray);

    // 8. Procesar respuestas múltiples
    const newBookings = responseData.map((response: any) => response.new).filter(Boolean);
    const failedBookings = responseData.filter((response: any) => !response.new);

    if (newBookings.length === 0) {
      logError('CREATE_NEW_BOOKING', 'Ninguna reserva fue creada', {
        response: responseData,
        failures: failedBookings
      }, 'create-new-booking.ts');
      
      return {
        success: false,
        message: "Error: ninguna reserva fue creada en Beds24",
        error: "no_bookings_created"
      };
    }

    if (failedBookings.length > 0) {
      logError('CREATE_NEW_BOOKING', `${failedBookings.length} reservas fallaron`, {
        successful: newBookings.length,
        failed: failedBookings.length,
        failures: failedBookings
      }, 'create-new-booking.ts');
    }

    logSuccess('CREATE_NEW_BOOKING', `${newBookings.length} reservas creadas exitosamente`, {
      bookingIds: newBookings.map(b => b.id),
      roomIds: roomIds,
      arrival: arrival,
      departure: departure,
      successfulCount: newBookings.length,
      failedCount: failedBookings.length
    }, 'create-new-booking.ts');

    // 9. Calcular totales para múltiples apartamentos
    const accommodationTotalPerRoom = accommodationRate * nights;
    const accommodationGrandTotal = accommodationTotalPerRoom * roomCount;
    const extrasTotal = params.extraServices?.reduce((sum, extra) => sum + (extra.amount * (extra.qty || 1)), 0) || 0;
    const grandTotal = accommodationGrandTotal + extrasTotal;
    const pendingBalance = grandTotal - advancePayment;
    
    // 10. Formatear respuesta detallada para múltiples reservas
    const bookingIds = newBookings.map(b => b.id).join(', ');
    const apartmentsList = roomIds.map(id => `Room ID ${id}`).join(', ');
    
    const formattedMessage = `✅ **${roomCount > 1 ? 'RESERVAS MÚLTIPLES' : 'RESERVA'} CREADA${roomCount > 1 ? 'S' : ''} EXITOSAMENTE**

📋 **DETALLES DE LA${roomCount > 1 ? 'S' : ''} RESERVA${roomCount > 1 ? 'S' : ''}:**
• **Código${roomCount > 1 ? 's' : ''}:** ${bookingIds}
• **Apartamento${roomCount > 1 ? 's' : ''}:** ${apartmentsList}
• **Fechas:** ${arrival} al ${departure} (${nights} noche${nights > 1 ? 's' : ''})
• **Huéspedes:** ${numAdult} adulto${numAdult > 1 ? 's' : ''}${params.numChild ? ` + ${params.numChild} niño${params.numChild > 1 ? 's' : ''}` : ''}
• **Titular:** ${firstName} ${lastName}
• **Email:** ${email}
• **Teléfono:** ${phone}
• **Status:** ${newBookings[0].status}
${params.arrivalTime ? `• **Hora llegada:** ${params.arrivalTime}` : ''}
${roomCount > 1 ? `• **Apartamentos reservados:** ${roomCount}` : ''}
${failedBookings.length > 0 ? `• **⚠️ Advertencia:** ${failedBookings.length} apartamento(s) no pudieron ser reservados` : ''}

💰 **DESGLOSE FINANCIERO:**
• **Alojamiento:** $${accommodationGrandTotal.toLocaleString()} COP (${roomCount} apt${roomCount > 1 ? 's' : ''} × ${nights} noches × $${accommodationRate.toLocaleString()})
${params.extraServices?.map(extra => `• **${extra.description}:** $${(extra.amount * (extra.qty || 1)).toLocaleString()} COP`).join('\n') || ''}
• **TOTAL:** $${grandTotal.toLocaleString()} COP
• **Anticipo recibido:** $${advancePayment.toLocaleString()} COP (${advanceDescription})
${roomCount > 1 ? `• **Anticipo distribuido:** $${paymentPerRoom.toLocaleString()} COP por apartamento` : ''}
• **SALDO PENDIENTE:** $${pendingBalance.toLocaleString()} COP

📧 Se enviará confirmación detallada por email a ${email}

🔔 **Sugerencia para OpenAI:** Procede a llamar a la función \`generate_booking_confirmation_pdf\` con los datos de esta reserva para generar y enviar el documento PDF de confirmación al huésped.`;

    return {
      success: true,
      bookings: newBookings.map((booking, index) => ({
        id: booking.id,
        roomId: roomIds[index],
        arrival: arrival,
        departure: departure,
        firstName: firstName,
        lastName: lastName,
        email: email,
        phone: phone,
        numAdult: numAdult,
        numChild: params.numChild || 0,
        status: booking.status,
        nights: nights,
        arrivalTime: params.arrivalTime,
        accommodationRate: accommodationRate,
        accommodationTotal: accommodationTotalPerRoom,
        extraServices: params.extraServices,
        extrasTotal: extrasTotal,
        paymentReceived: paymentPerRoom + (index < remainderPayment ? 1 : 0),
        invoiceItems: bookingDataArray[index].invoiceItems
      })),
      summary: JSON.stringify({
        totalBookings: newBookings.length,
        failedBookings: failedBookings.length,
        roomIds: roomIds,
        accommodationGrandTotal: accommodationGrandTotal,
        extrasTotal: extrasTotal,
        grandTotal: grandTotal,
        advancePayment: advancePayment,
        advanceDescription: advanceDescription,
        pendingBalance: pendingBalance,
        paymentPerRoom: paymentPerRoom
      }),
      message: formattedMessage
    };

  } catch (error) {
    logError('CREATE_NEW_BOOKING', `Error creando reserva: ${error.message}`, {
      error: error.response?.data || error.message,
      params: {
        roomIds,
        arrival,
        departure,
        firstName,
        lastName,
        email
      }
    }, 'create-new-booking.ts');

    // Manejar errores específicos
    if (error.response?.status === 401) {
      return {
        success: false,
        message: "❌ Error de autenticación. Token de escritura inválido o expirado.",
        error: "auth_error"
      };
    }

    if (error.response?.status === 400) {
      return {
        success: false,
        message: "❌ Datos de reserva inválidos. Verifique las fechas y disponibilidad del apartamento.",
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
      message: "❌ Error interno creando la reserva. Contacte soporte técnico.",
      error: error.response?.data || error.message
    };
  }
}

// ============================================================================
// DEFINICIÓN PARA OPENAI ASSISTANT
// ============================================================================

export const createNewBookingFunction: FunctionDefinition = {
  name: 'create_new_booking',
  description: 'Crea una o múltiples reservas en Beds24 para la misma persona con distribución automática de pagos entre apartamentos.',
  category: 'booking',
  version: '3.0.0',
  enabled: true,
  parameters: {
    type: 'object',
    properties: {
      roomIds: {
        type: 'array',
        description: 'Array de IDs de apartamentos en Beds24 para reserva múltiple (ej: [378110, 378316])',
        items: {
          type: 'integer',
          minimum: 100000
        },
        minItems: 1,
        maxItems: 5
      },
      arrival: {
        type: 'string',
        description: 'Fecha de entrada en formato YYYY-MM-DD',
        pattern: '^\\d{4}-\\d{2}-\\d{2}$'
      },
      departure: {
        type: 'string',
        description: 'Fecha de salida en formato YYYY-MM-DD',
        pattern: '^\\d{4}-\\d{2}-\\d{2}$'
      },
      firstName: {
        type: 'string',
        description: 'Nombre del huésped principal',
        minLength: 2,
        maxLength: 50
      },
      lastName: {
        type: 'string',
        description: 'Apellido del huésped principal',
        minLength: 2,
        maxLength: 50
      },
      email: {
        type: 'string',
        description: 'Email del huésped para confirmaciones',
        format: 'email'
      },
      phone: {
        type: 'string',
        description: 'Teléfono de contacto (OBLIGATORIO)',
        minLength: 10,
        maxLength: 20
      },
      numAdult: {
        type: 'integer',
        description: 'Número de adultos',
        minimum: 1,
        maximum: 8
      },
      numChild: {
        type: 'integer',
        description: 'Número de niños',
        minimum: 0,
        maximum: 4
      },
      arrivalTime: {
        type: 'string',
        description: 'Hora de llegada esperada (ej: "3:00 PM", "15:00", "After 6 PM")',
        maxLength: 50
      },
      accommodationRate: {
        type: 'integer',
        description: 'Tarifa del alojamiento por noche en pesos colombianos',
        minimum: 50000,
        maximum: 2000000
      },
      extraServices: {
        type: 'array',
        description: 'Cargos extras incluidos en la reserva (limpieza, servicios adicionales, etc.)',
        items: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'Descripción del cargo extra (puede ser cualquier nombre)',
              minLength: 3,
              maxLength: 100
            },
            amount: {
              type: 'integer',
              description: 'Valor del cargo en pesos colombianos',
              minimum: 1000,
              maximum: 500000
            },
            qty: {
              type: 'integer',
              description: 'Cantidad (opcional, default 1)',
              minimum: 1,
              maximum: 10
            }
          },
          required: ['description', 'amount'],
          additionalProperties: false
        }
      },
      advancePayment: {
        type: 'integer',
        description: 'Monto del anticipo pagado en pesos colombianos (OBLIGATORIO)',
        minimum: 50000
      },
      advanceDescription: {
        type: 'string',
        description: 'Descripción del anticipo (ej: "Anticipo vía transferencia", "Pago inicial efectivo")',
        minLength: 5,
        maxLength: 200
      }
    },
    required: ['roomIds', 'arrival', 'departure', 'firstName', 'lastName', 'email', 'phone', 'numAdult', 'accommodationRate', 'advancePayment', 'advanceDescription'],
    additionalProperties: false
  },
  handler: createNewBooking
};
