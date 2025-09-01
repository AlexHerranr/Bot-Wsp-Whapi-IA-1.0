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
  // Log completo de parámetros recibidos para debugging
  logInfo('CREATE_NEW_BOOKING_PARAMS', 'Parámetros recibidos completos', { 
    params,
    paramsType: typeof params,
    hasRoomIds: params && 'roomIds' in params,
    roomIdsType: params?.roomIds ? typeof params.roomIds : 'undefined',
    roomIdsValue: params?.roomIds,
    allKeys: params ? Object.keys(params) : []
  }, 'create-new-booking.ts');

  // Validación temprana de params
  if (!params || typeof params !== 'object') {
    logError('CREATE_NEW_BOOKING_INVALID_PARAMS', 'Parámetros inválidos o vacíos', {
      params,
      type: typeof params
    }, 'create-new-booking.ts');
    return {
      success: false,
      message: "ERROR_INTERNO: No se recibieron parámetros válidos. Indícale al huésped que necesitas recopilar nuevamente los datos de la reserva (fechas, apartamento, datos personales y pago).",
      error: "invalid_params"
    };
  }

  const { roomIds, arrival, departure, firstName, lastName, email, phone, numAdult, accommodationRate, advancePayment, advanceDescription } = params;
  
  // Log después de destructuring
  logInfo('CREATE_NEW_BOOKING', 'Iniciando creación de reservas múltiples', { 
    roomIds, 
    roomCount: roomIds ? (Array.isArray(roomIds) ? roomIds.length : 'not_array') : 'undefined', 
    arrival, 
    departure, 
    firstName, 
    lastName, 
    phone, 
    numAdult, 
    accommodationRate, 
    advancePayment 
  }, 'create-new-booking.ts');

  try {
    // 1. Validar SOLO parámetros básicos OBLIGATORIOS (apartamentos + pago + datos huésped)
    const missingFields = [];
    if (!roomIds) missingFields.push('roomIds');
    if (!Array.isArray(roomIds)) missingFields.push('roomIds debe ser array');
    if (roomIds && Array.isArray(roomIds) && roomIds.length === 0) missingFields.push('roomIds está vacío');
    if (!arrival) missingFields.push('arrival');
    if (!departure) missingFields.push('departure');
    if (!firstName) missingFields.push('firstName');
    if (!lastName) missingFields.push('lastName');
    if (!email) missingFields.push('email');
    if (!phone) missingFields.push('phone');
    if (!numAdult) missingFields.push('numAdult');
    if (!accommodationRate) missingFields.push('accommodationRate');
    if (!advancePayment) missingFields.push('advancePayment');
    if (!advanceDescription) missingFields.push('advanceDescription');

    if (missingFields.length > 0) {
      logError('CREATE_NEW_BOOKING_MISSING_FIELDS', 'Campos requeridos faltantes', {
        missingFields,
        hasRoomIds: !!roomIds,
        isRoomIdsArray: Array.isArray(roomIds),
        roomIdsLength: roomIds?.length,
        hasArrival: !!arrival,
        hasDeparture: !!departure,
        hasFirstName: !!firstName,
        hasLastName: !!lastName,
        hasEmail: !!email,
        hasPhone: !!phone,
        hasNumAdult: !!numAdult,
        hasAccommodationRate: !!accommodationRate,
        hasAdvancePayment: !!advancePayment,
        hasAdvanceDescription: !!advanceDescription
      }, 'create-new-booking.ts');
      return {
        success: false,
        message: `ERROR_DATOS_INCOMPLETOS: Faltan campos requeridos [${missingFields.join(', ')}]. Indícale al huésped que necesitas confirmar todos los datos de la reserva antes de proceder. Solicita amablemente la información faltante.`,
        error: "missing_required_fields"
      };
    }

    // 1.1 Validar que todos los roomIds sean números válidos
    const invalidRoomIds = roomIds.filter(id => !Number.isInteger(id) || id < 100000);
    if (invalidRoomIds.length > 0) {
      return {
        success: false,
        message: `ERROR_APARTAMENTO_INVALIDO: Los IDs de apartamento [${invalidRoomIds.join(', ')}] no son válidos. Indícale al huésped que hubo un problema técnico al identificar el apartamento y que estás consultando con tu superior para resolverlo de inmediato.`,
        error: "invalid_room_ids"
      };
    }
    

    // 2. Validar formato de fechas
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(arrival) || !dateRegex.test(departure)) {
      return {
        success: false,
        message: "ERROR_FORMATO_FECHA: Las fechas tienen formato incorrecto. Indícale al huésped que necesitas confirmar las fechas exactas de entrada y salida en formato correcto.",
        error: "invalid_date_format"
      };
    }

    // 3. Validar fechas lógicas
    if (new Date(arrival) >= new Date(departure)) {
      return {
        success: false,
        message: "ERROR_RANGO_FECHAS: La fecha de salida debe ser posterior a la de entrada. Indícale al huésped que parece haber un error con las fechas y solicita que las confirme nuevamente.",
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
        message: "ERROR_CREACION_RESERVA: No se pudo crear la reserva en el sistema. Indícale al huésped que estás experimentando un problema técnico con la plataforma de reservas y que vas a consultar con tu superior para resolverlo lo más pronto posible. Pídele disculpas por el inconveniente.",
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
    
    // 10. Formatear respuesta como instrucción interna para OpenAI
    const bookingIds = newBookings.map(b => b.id).join(', ');
    const apartmentsList = roomIds.map(id => `Room ID ${id}`).join(', ');
    
    // Construir mensaje interno con todos los datos para que OpenAI pueda responder apropiadamente
    const internalMessage = `EXITO_RESERVA: La reserva se creó correctamente en Beds24.

DATOS_CONFIRMADOS:
- Códigos de reserva: ${bookingIds}
- Apartamentos: ${apartmentsList}
- Fechas: ${arrival} al ${departure} (${nights} noches)
- Titular: ${firstName} ${lastName}
- Email: ${email}
- Teléfono: ${phone}
- Huéspedes: ${numAdult} adultos${params.numChild ? ` + ${params.numChild} niños` : ''}
${params.arrivalTime ? `- Hora de llegada: ${params.arrivalTime}` : ''}

DATOS_FINANCIEROS:
- Alojamiento: $${accommodationGrandTotal.toLocaleString()} COP
${params.extraServices?.map(extra => `- ${extra.description}: $${(extra.amount * (extra.qty || 1)).toLocaleString()} COP`).join('\n') || ''}
- Total: $${grandTotal.toLocaleString()} COP
- Anticipo pagado: $${advancePayment.toLocaleString()} COP
- Saldo pendiente: $${pendingBalance.toLocaleString()} COP

INSTRUCCIONES_PARA_ASISTENTE:
1. Confirma al huésped que la reserva fue creada exitosamente
2. Proporciona el código de reserva: ${bookingIds}
3. Resume los detalles principales (fechas, apartamento, total, saldo)
4. Menciona que se enviará confirmación por email a ${email}
5. Si el huésped lo solicita, puedes generar el PDF de confirmación usando la función generate_booking_confirmation_pdf
6. Agradece al huésped por su reserva y ofrece asistencia adicional

${failedBookings.length > 0 ? `NOTA: ${failedBookings.length} apartamentos no pudieron ser reservados. Menciona esto si es relevante.` : ''}

SIGUIENTE_PASO_SUGERIDO: Puedes llamar a generate_booking_confirmation_pdf para enviar el documento de confirmación.`;

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
      message: internalMessage
    };

  } catch (error: any) {
    const errorMessage = error?.message || 'Error desconocido';
    const errorDetails = error?.response?.data || error;
    
    logError('CREATE_NEW_BOOKING_ERROR', `Error creando reserva: ${errorMessage}`, {
      error: errorDetails,
      errorType: error?.constructor?.name,
      errorCode: error?.code,
      errorStatus: error?.response?.status,
      params: {
        roomIds,
        arrival,
        departure,
        firstName,
        lastName,
        email
      }
    }, 'create-new-booking.ts');

    // Manejar errores específicos con instrucciones para OpenAI
    if (error.response?.status === 401) {
      return {
        success: false,
        message: "ERROR_AUTENTICACION: Hay un problema de autenticación con la plataforma Beds24. Indícale al huésped que estás presentando problemas técnicos con el sistema de reservas y que hablarás con tu superior para resolverlo lo más pronto posible. Discúlpate por el inconveniente y asegúrale que su reserva será procesada en breve.",
        error: "auth_error"
      };
    }

    if (error.response?.status === 400) {
      const errorMsg = error.response?.data?.message || 'Datos inválidos';
      return {
        success: false,
        message: `ERROR_VALIDACION: El sistema rechazó la reserva (${errorMsg}). Indícale al huésped que puede haber un problema con la disponibilidad o los datos ingresados. Verifica con el huésped si las fechas y el apartamento son correctos, y menciona que si el problema persiste, consultarás con tu superior.`,
        error: "validation_error"
      };
    }

    if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return {
        success: false,
        message: "ERROR_CONEXION: No se pudo conectar con el sistema de reservas. Indícale al huésped que hay un problema temporal de conexión con la plataforma. Menciona que intentarás nuevamente en unos momentos y que si el problema persiste, escalarás el caso con tu superior para garantizar que su reserva se procese.",
        error: "connection_error"
      };
    }

    // Error genérico con instrucción para OpenAI
    return {
      success: false,
      message: `ERROR_SISTEMA: Ocurrió un error inesperado (${errorMessage}). Indícale al huésped que encontraste un problema técnico al procesar la reserva. Discúlpate sinceramente y asegúrale que consultarás inmediatamente con tu superior para resolver la situación y procesar su reserva lo antes posible.`,
      error: errorDetails
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
