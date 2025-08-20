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
import type { FunctionDefinition } from '../../../functions/types/function-types.js';
import { logInfo, logError, logSuccess } from '../../../utils/logging';

// ============================================================================
// INTERFACES TYPESCRIPT PARA TYPE SAFETY
// ============================================================================

interface CreateBookingParams {
  roomId: number;
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
  parkingRequired?: boolean;
  parkingRate?: number;
  advancePayment: number;
  advanceDescription: string;
}

interface CreateBookingResult {
  success: boolean;
  booking?: any;
  message: string;
  error?: any;
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

export async function createNewBooking(params: CreateBookingParams): Promise<CreateBookingResult> {
  const { roomId, arrival, departure, firstName, lastName, email, phone, numAdult, accommodationRate, advancePayment, advanceDescription } = params;
  
  logInfo('CREATE_NEW_BOOKING', 'Iniciando creación de reserva completa', { 
    roomId, arrival, departure, firstName, lastName, phone, numAdult, accommodationRate, advancePayment 
  }, 'create-new-booking.ts');

  try {
    // 1. Validar SOLO parámetros básicos OBLIGATORIOS (alojamiento + pago + datos huésped)
    if (!roomId || !arrival || !departure || !firstName || !lastName || !email || !phone || !numAdult || !accommodationRate || !advancePayment || !advanceDescription) {
      return {
        success: false,
        message: "Faltan datos BÁSICOS requeridos: apartamento, fechas, nombres, email, teléfono, adultos, tarifa alojamiento y anticipo con descripción",
        error: "missing_required_fields"
      };
    }
    
    // Validar parquedero solo si se requiere
    if (params.parkingRequired && !params.parkingRate) {
      return {
        success: false,
        message: "Si parkingRequired es true, debe incluir parkingRate",
        error: "missing_parking_rate"
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

    // 4. Auth con refresh token para operaciones WRITE
    logInfo('CREATE_NEW_BOOKING', 'Preparando autenticación...', {}, 'create-new-booking.ts');
    
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
      
      logInfo('CREATE_NEW_BOOKING', 'Access token obtenido via refresh token', {
        expiresIn: authResponse.data.expiresIn
      }, 'create-new-booking.ts');
      
    } catch (authError) {
      // Si falla refresh token, intentar usar token directo
      logInfo('CREATE_NEW_BOOKING', 'Refresh token falló, intentando token directo...', {
        error: authError.message
      }, 'create-new-booking.ts');
      
      accessToken = process.env.BEDS24_WRITE_REFRESH_TOKEN;
      
      if (!accessToken) {
        throw new Error('No se pudo obtener access token y no hay token directo disponible');
      }
    }

    // 5. Calcular noches y preparar invoice items
    const nights = Math.ceil((new Date(departure).getTime() - new Date(arrival).getTime()) / (1000 * 60 * 60 * 24));
    
    // Preparar notas con hora de llegada
    const notesArray = [];
    if (params.arrivalTime) {
      notesArray.push(`Hora de llegada: ${params.arrivalTime}`);
    }
    const notes = notesArray.join(' | ');
    
    // 6. Preparar invoice items completos
    const invoiceItems = [];
    
    // Item 1: Alojamiento (OBLIGATORIO)
    invoiceItems.push({
      type: "charge",
      description: `Alojamiento ${nights} noche${nights > 1 ? 's' : ''}`,
      qty: nights,
      amount: accommodationRate
    });
    
    // Item 2: Extras (si existen)
    if (params.extraServices && params.extraServices.length > 0) {
      params.extraServices.forEach(extra => {
        invoiceItems.push({
          type: "charge",
          description: extra.description,
          qty: extra.qty || 1,
          amount: extra.amount
        });
      });
    }
    
    // Item 3: Parquedero (si se requiere)
    if (params.parkingRequired && params.parkingRate) {
      invoiceItems.push({
        type: "charge",
        description: `Parquedero ${nights} noche${nights > 1 ? 's' : ''}`,
        qty: nights,
        amount: params.parkingRate
      });
    }
    
    // Item 4: Pago del anticipo (OBLIGATORIO)
    invoiceItems.push({
      type: "payment",
      amount: advancePayment,
      description: advanceDescription
    });

    // 7. Preparar datos de la reserva completos
    const bookingData = [{
      roomId: roomId,
      arrival: arrival,
      departure: departure,
      firstName: firstName,
      lastName: lastName,
      email: email,
      phone: phone,
      numAdult: numAdult,
      numChild: params.numChild || 0,
      status: advancePayment >= 50000 ? "confirmed" : "new", // Confirmed si hay anticipo
      referer: "Direct", // Canal directo
      notes: notes,
      invoiceItems: invoiceItems
    }];

    logInfo('CREATE_NEW_BOOKING', 'Enviando request a Beds24', {
      roomId,
      arrival,
      departure,
      hasAdvancePayment: (params.advancePayment || 0) > 0,
      advanceAmount: params.advancePayment || 0
    }, 'create-new-booking.ts');

    // 6. POST crear reserva en Beds24
    const response = await axios.post(`${process.env.BEDS24_API_URL}/bookings`, bookingData, {
      headers: { 
        'token': accessToken,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    // 7. Procesar respuesta
    const responseData = response.data;
    const newBooking = responseData[0]?.new;

    if (!newBooking || !newBooking.id) {
      logError('CREATE_NEW_BOOKING', 'Respuesta inesperada de Beds24', {
        response: responseData
      }, 'create-new-booking.ts');
      
      return {
        success: false,
        message: "Error procesando respuesta de Beds24",
        error: "unexpected_response"
      };
    }

    logSuccess('CREATE_NEW_BOOKING', `Reserva creada exitosamente: ${newBooking.id}`, {
      bookingId: newBooking.id,
      roomId: roomId,
      arrival: arrival,
      departure: departure,
      status: newBooking.status,
      price: newBooking.price
    }, 'create-new-booking.ts');

    // 8. Calcular totales para la respuesta
    const accommodationTotal = accommodationRate * nights;
    const extrasTotal = params.extraServices?.reduce((sum, extra) => sum + (extra.amount * (extra.qty || 1)), 0) || 0;
    const parkingTotal = (params.parkingRequired && params.parkingRate) ? (params.parkingRate * nights) : 0;
    const grandTotal = accommodationTotal + extrasTotal + parkingTotal;
    const pendingBalance = grandTotal - advancePayment;
    
    // 9. Formatear respuesta detallada para OpenAI
    const formattedMessage = `✅ **RESERVA CREADA EXITOSAMENTE**

📋 **DETALLES DE LA RESERVA:**
• **Código:** ${newBooking.id}
• **Apartamento:** Room ID ${roomId}
• **Fechas:** ${arrival} al ${departure} (${nights} noche${nights > 1 ? 's' : ''})
• **Huéspedes:** ${numAdult} adulto${numAdult > 1 ? 's' : ''}${params.numChild ? ` + ${params.numChild} niño${params.numChild > 1 ? 's' : ''}` : ''}
• **Titular:** ${firstName} ${lastName}
• **Email:** ${email}
• **Teléfono:** ${phone}
• **Status:** ${newBooking.status}
${params.arrivalTime ? `• **Hora llegada:** ${params.arrivalTime}` : ''}

💰 **DESGLOSE FINANCIERO:**
• **Alojamiento:** $${accommodationTotal.toLocaleString()} COP (${nights} noches × $${accommodationRate.toLocaleString()})
${params.extraServices?.map(extra => `• **${extra.description}:** $${(extra.amount * (extra.qty || 1)).toLocaleString()} COP`).join('\n') || ''}
${params.parkingRequired ? `• **Parquedero:** $${parkingTotal.toLocaleString()} COP (${nights} noches × $${params.parkingRate?.toLocaleString()})` : ''}
• **TOTAL:** $${grandTotal.toLocaleString()} COP
• **Anticipo recibido:** $${advancePayment.toLocaleString()} COP (${advanceDescription})
• **SALDO PENDIENTE:** $${pendingBalance.toLocaleString()} COP

📧 Se enviará confirmación detallada por email a ${email}`;

    return {
      success: true,
      booking: {
        id: newBooking.id,
        roomId: roomId,
        arrival: arrival,
        departure: departure,
        firstName: firstName,
        lastName: lastName,
        email: email,
        phone: phone,
        numAdult: numAdult,
        numChild: params.numChild || 0,
        status: newBooking.status,
        nights: nights,
        arrivalTime: params.arrivalTime,
        accommodationRate: accommodationRate,
        accommodationTotal: accommodationTotal,
        extraServices: params.extraServices,
        extrasTotal: extrasTotal,
        parkingRequired: params.parkingRequired,
        parkingRate: params.parkingRate,
        parkingTotal: parkingTotal,
        grandTotal: grandTotal,
        advancePayment: advancePayment,
        advanceDescription: advanceDescription,
        pendingBalance: pendingBalance,
        invoiceItems: invoiceItems
      },
      message: formattedMessage
    };

  } catch (error) {
    logError('CREATE_NEW_BOOKING', `Error creando reserva: ${error.message}`, {
      error: error.response?.data || error.message,
      params: {
        roomId,
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
  description: 'Crea una nueva reserva completa en Beds24 con TODOS los datos requeridos: información del huésped, items de alojamiento, extras, parquedero y pago de anticipo.',
  category: 'booking',
  version: '2.0.0',
  enabled: true,
  parameters: {
    type: 'object',
    properties: {
      roomId: {
        type: 'integer',
        description: 'ID del apartamento en Beds24 (ej: 378110 para 2005A, 378316 para 1820)',
        minimum: 100000
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
        description: 'Servicios extras incluidos en la reserva',
        items: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'Descripción del servicio extra',
              maxLength: 100
            },
            amount: {
              type: 'integer',
              description: 'Precio del servicio en pesos colombianos',
              minimum: 1000
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
      parkingRequired: {
        type: 'boolean',
        description: 'Si se requiere parquedero'
      },
      parkingRate: {
        type: 'integer',
        description: 'Tarifa del parquedero por noche en pesos colombianos (requerido si parkingRequired es true)',
        minimum: 5000,
        maximum: 100000
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
    required: ['roomId', 'arrival', 'departure', 'firstName', 'lastName', 'email', 'phone', 'numAdult', 'accommodationRate', 'advancePayment', 'advanceDescription'],
    additionalProperties: false
  },
  handler: createNewBooking
};
