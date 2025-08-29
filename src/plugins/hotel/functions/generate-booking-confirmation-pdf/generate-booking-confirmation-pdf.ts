// src/plugins/hotel/functions/generate-booking-confirmation-pdf/generate-booking-confirmation-pdf.ts
import { InvoiceData } from '../../services/pdf-generator.service';
import { getPDFService } from '../../services/pdf-lifecycle.service';
import { logInfo, logError, logSuccess } from '../../../../utils/logging';
import type { FunctionDefinition } from '../../../../functions/types/function-types.js';
import { Beds24Client } from '../../services/beds24-client';
import { PrismaClient } from '@prisma/client';
import { fetchWithRetry } from '../../../../core/utils/retry-utils';

// Nueva interfaz simplificada para OpenAI
interface GenerateBookingConfirmationPDFParams {
  bookingId: string;
  distribucion?: string;
}

// Interfaz interna completa para datos transformados
interface InternalPDFParams {
  bookingId: string;
  guestName: string;
  guestCount: string;
  phone: string;
  email: string;
  checkInDate: string;
  checkOutDate: string;
  roomName: string;
  distribucion?: string;
  nights: number;
  totalCharges: string;
  totalPaid: string;
  paymentDescription: string;
  balance?: string;
  bookingStatus?: string;
  invoiceItems: Array<{
    description: string;
    quantity?: string;
    unitPrice?: string;
    totalAmount: string;
  }>;
  documentType?: string;
  triggerFunction?: string;
  saveToFile?: boolean;
  returnBuffer?: boolean;
}

/**
 * Función utilitaria para enviar PDF por WhatsApp
 */
async function sendPDFToWhatsApp(chatId: string, filePathOrBuffer: string | Buffer, fileName: string): Promise<{success: boolean, messageId?: string}> {
  try {
    let base64Data: string;
    
    // Manejar tanto buffer como filePath
    if (Buffer.isBuffer(filePathOrBuffer)) {
      base64Data = filePathOrBuffer.toString('base64');
    } else {
      const fs = await import('fs').then(m => m.promises);
      const fileBuffer = await fs.readFile(filePathOrBuffer);
      base64Data = fileBuffer.toString('base64');
    }
    const mimeType = 'application/pdf';
    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    
    const payload = {
      to: chatId,
      media: dataUrl,
      filename: fileName
    };
    
    const WHAPI_API_URL = process.env.WHAPI_API_URL;
    const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
    
    if (!WHAPI_API_URL || !WHAPI_TOKEN) {
      throw new Error('WHAPI_API_URL o WHAPI_TOKEN no están configurados');
    }
    
    const response = await fetchWithRetry(`${WHAPI_API_URL}/messages/document`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHAPI_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      // Log completo de error WHAPI para debugging
      logError('WHAPI_RESPONSE_ERROR', 'Error completo de WHAPI', {
        status: response.status,
        statusText: response.statusText,
        responseBody: errorText,
        chatId,
        fileName,
        apiUrl: WHAPI_API_URL,
        hasToken: !!WHAPI_TOKEN
      });
      throw new Error(`Error ${response.status}: ${errorText}`);
    }
    
    const responseData = await response.json() as any;
    const fileSize = Buffer.isBuffer(filePathOrBuffer) ? filePathOrBuffer.length : (await import('fs').then(m => m.promises.stat(filePathOrBuffer))).size;
    
    logInfo('WHATSAPP_PDF_SENT', 'PDF enviado exitosamente por WhatsApp', {
      chatId,
      fileName,
      fileSize: Math.round(fileSize / 1024) + 'KB',
      messageId: responseData?.id
    });
    
    return {
      success: true,
      messageId: responseData?.id
    };
    
  } catch (error) {
    logError('WHATSAPP_PDF_ERROR', 'Error enviando PDF por WhatsApp', {
      chatId,
      fileName,
      error: error instanceof Error ? error.message : String(error)
    });
    return {
      success: false
    };
  }
}

/**
 * Buscar reserva por bookingId directamente en Beds24 API
 * Función interna - no modifica check-booking-details
 */
async function fetchBookingByIdFromBeds24(bookingId: string) {
  const startTime = Date.now();
  const context = { bookingId, function: 'fetchBookingByIdFromBeds24' };
  
  try {
    logInfo('FETCH_BOOKING_BY_ID', `🔍 Consultando reserva directamente: ${bookingId}`, context);
    
    const beds24Client = new Beds24Client();
    const prisma = new PrismaClient();

    // Buscar reserva por ID usando endpoint /bookings de Beds24
    const apiResponse = await beds24Client.searchBookings({
      bookingId: bookingId,
      includeInvoiceItems: true,
      includeInfoItems: true,
      includeGuests: true,
      includeBookingGroup: true
    });

    // Log response completo para debugging
    logInfo('FETCH_BOOKING_RAW_RESPONSE', `API Response structure: ${JSON.stringify({
      success: apiResponse.success,
      type: apiResponse.type,
      count: apiResponse.count,
      dataLength: apiResponse.data?.length || 0,
      firstBookingId: apiResponse.data?.[0]?.bookId || 'N/A'
    })}`, context);

    if (!apiResponse || !apiResponse.data || apiResponse.data.length === 0) {
      const duration = Date.now() - startTime;
      logError('FETCH_BOOKING_BY_ID', `❌ Reserva no encontrada: ${bookingId}`, { ...context, duration: `${duration}ms` });
      return { 
        success: false, 
        error: 'Reserva no encontrada',
        message: `❌ Hubo un problema técnico consultando la reserva ${bookingId}. Dile al cliente que vas a consultar con tu superior para verificar el ID de reserva.`
      };
    }

    // ARREGLO: Extraer booking específico por ID exacto (response puede tener múltiples bookings)
    const targetBooking = apiResponse.data.find((b: any) => 
      b.id == bookingId || b.bookId == bookingId || // Usar == para comparación flexible
      b.id === parseInt(bookingId) || b.bookId === parseInt(bookingId)
    ) || apiResponse.data[0]; // Fallback al primero si no encuentra exacto

    if (!targetBooking || (!targetBooking.bookId && !targetBooking.id)) {
      const duration = Date.now() - startTime;
      logError('FETCH_BOOKING_BY_ID', `❌ Booking específico no encontrado en respuesta`, { 
        ...context, 
        duration: `${duration}ms`,
        availableBookings: apiResponse.data.map((b: any) => b.bookId || b.id)
      });
      return { 
        success: false, 
        error: 'Booking específico no encontrado en respuesta de API',
        message: `La reserva ${bookingId} no se encontró en la respuesta de Beds24`
      };
    }

    // OPTIMIZACIÓN: Validación de status temprana (evita transformación innecesaria)
    const bookingStatus = targetBooking.status?.toLowerCase() || 'unknown';
    if (bookingStatus !== 'confirmed') {
      const duration = Date.now() - startTime;
      logError('FETCH_BOOKING_BY_ID', `❌ Status de reserva inválido: ${bookingStatus}`, { 
        ...context, 
        currentStatus: targetBooking.status,
        requiredStatus: 'confirmed',
        duration: `${duration}ms`
      });
      await prisma.$disconnect();
      return { 
        success: false, 
        error: `Status no confirmado: ${targetBooking.status}`,
        message: `❌ Hubo un problema técnico con el estado de la reserva ${bookingId}. Dile al cliente que vas a consultar con tu superior para revisar el status de su reserva.` 
      };
    }

    // Log del booking específico encontrado
    logInfo('FETCH_BOOKING_FOUND', `Booking específico encontrado: ${JSON.stringify({
      id: targetBooking.id,
      bookId: targetBooking.bookId,
      firstName: targetBooking.firstName,
      lastName: targetBooking.lastName,
      email: targetBooking.email || 'N/A',
      arrival: targetBooking.arrival,
      departure: targetBooking.departure,
      status: targetBooking.status
    })}`, context);

    // Procesar datos similar a check-booking-details
    const processedBooking = await processBookingData(targetBooking, prisma);
    
    const duration = Date.now() - startTime;
    logInfo('FETCH_BOOKING_BY_ID', `✅ Reserva encontrada exitosamente`, { 
      ...context, 
      duration: `${duration}ms`,
      guestName: `${processedBooking.firstName} ${processedBooking.lastName}`
    });

    await prisma.$disconnect();
    
    return { 
      success: true, 
      booking: processedBooking,
      message: `Reserva ${bookingId} encontrada exitosamente`
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    logError('FETCH_BOOKING_BY_ID', `💥 Error consultando reserva: ${error}`, { 
      ...context, 
      duration: `${duration}ms`,
      errorType: error instanceof Error ? error.constructor.name : 'UnknownError'
    });
    
    return { 
      success: false, 
      error: `Error consultando reserva: ${error instanceof Error ? error.message : error}`,
      message: '❌ Hubo un problema técnico accediendo a los datos de la reserva. Dile al cliente que vas a consultar con tu superior para resolver este inconveniente.'
    };
  }
}

/**
 * Función helper para procesar datos de reserva (reutilizada de check-booking-details)
 */
async function processBookingData(booking: any, prisma: PrismaClient) {
  // Reutilizar lógica de procesamiento de check-booking-details
  // Extraer room name real de base de datos
  let realRoomName = booking.roomName || 'Apartamento';
  
  try {
    const apartmentDetails = await prisma.apartamentos.findFirst({
      where: {
        propertyId: booking.propId,
        roomId: booking.roomId
      }
    });
    
    if (apartmentDetails) {
      realRoomName = apartmentDetails.roomName;
    }
  } catch (error) {
    logError('PROCESS_BOOKING_DATA', `Error obteniendo nombre real del apartamento: ${error}`, { bookingId: booking.id || booking.bookId });
    realRoomName = 'Apartamento'; // Fallback consistente en caso de error DB
  }

  const processedData = {
    id: booking.id || booking.bookId, // Priorizar booking.id sobre booking.bookId
    firstName: booking.firstName || '',
    lastName: booking.lastName || '', 
    email: booking.email || '', // Opcional según tu instrucción
    phone: booking.phone || '',
    arrival: booking.arrival,
    departure: booking.departure,
    roomName: realRoomName,
    numAdult: booking.numAdult || 1,
    numChild: booking.numChild || 0,
    price: booking.price || 0,  // Campo real de la API Beds24
    totalCharges: booking.totalCharges || booking.price || 0,  // Fallback compatibility
    totalPaid: booking.totalPaid || 0,
    balance: booking.balance || 0,
    status: booking.status || 'confirmed',
    invoiceItems: booking.invoiceItems || []
  };

  // Log processed data para debugging
  logInfo('PROCESS_BOOKING_DATA', `Datos procesados: ${JSON.stringify({
    id: processedData.id,
    name: `${processedData.firstName} ${processedData.lastName}`,
    email: processedData.email || 'N/A',
    roomName: processedData.roomName,
    totalCharges: processedData.totalCharges,
    invoiceItemsCount: processedData.invoiceItems.length
  })}`, { bookingId: booking.id || booking.bookId });

  return processedData;
}

/**
 * Transforma datos de API al formato requerido para PDF
 */
async function transformBookingDetailsToPDFData(bookingData: any, distribucion?: string): Promise<InternalPDFParams> {
  // 1. CALCULAR nights
  const checkInDate = new Date(bookingData.arrival);
  const checkOutDate = new Date(bookingData.departure);
  let nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Prevenir nights=0 para evitar problemas downstream
  if (nights < 1) nights = 1;

  // 2. COMBINAR nombres
  const guestName = `${bookingData.firstName || ''} ${bookingData.lastName || ''}`.trim();

  // 3. CALCULAR totales reales desde la API de Beds24
  // Total de cargos viene del campo 'price' de la API, pero si es 0, calculamos desde cargos
  let totalChargesAmount = bookingData.price || 0;
  
  // FALLBACK: Si price=0, calcular automáticamente sumando invoiceItems tipo 'charge'
  if (totalChargesAmount === 0) {
    totalChargesAmount = (bookingData.invoiceItems || [])
      .filter((item: any) => item.type === 'charge')
      .reduce((sum: number, item: any) => sum + (item.lineTotal || item.amount || 0), 0);
    
    logInfo('TRAN', `⚡ AUTO-CALC: price=0, calculado desde cargos: ${totalChargesAmount.toLocaleString('es-CO')}`);
  }
  
  // Calcular total de pagos desde invoiceItems
  const totalPaidAmount = (bookingData.invoiceItems || [])
    .filter((item: any) => item.type === 'payment')
    .reduce((sum: number, item: any) => sum + Math.abs(item.amount || 0), 0);
  
  // Calcular saldo pendiente (Outstanding Amount)
  const balanceAmount = totalChargesAmount - totalPaidAmount;
  
  // Formatear montos
  const totalCharges = `${totalChargesAmount.toLocaleString('es-CO')}`;
  const totalPaid = `${totalPaidAmount.toLocaleString('es-CO')}`;
  const balance = `${balanceAmount.toLocaleString('es-CO')}`;

  // 4. PROCESAR SOLO los cargos para la tabla principal
  const invoiceItems = (bookingData.invoiceItems || [])
    .filter((item: any) => item.type === 'charge')
    .map((item: any) => {
      let itemDescription = item.description || 'Servicio de alojamiento';
      // Cambiar patrones de API por "Alojamiento"
      if (itemDescription.match(/\[ROOMNAME\d*\]\s*\[FIRSTNIGHT\]\s*-\s*\[LEAVINGDAY\]/)) {
        itemDescription = 'Alojamiento';
      }
      return {
        description: itemDescription,
        quantity: item.qty?.toString() || '1',
        unitPrice: `${(item.amount || 0).toLocaleString('es-CO')}`,
        totalAmount: `${(item.lineTotal || item.amount || 0).toLocaleString('es-CO')}`
      };
    });

  // 5. PROCESAR pagos por separado (para mostrar después del total)
  const paymentItems = (bookingData.invoiceItems || [])
    .filter((item: any) => item.type === 'payment')
    .map((item: any) => ({
      description: item.description || 'Pago recibido',
      amount: Math.abs(item.amount || 0),
      formattedAmount: `${Math.abs(item.amount || 0).toLocaleString('es-CO')}`
    }));

  // DEBUG: Log paymentItems para verificar
  logInfo('TRAN', `💰 PAYMENTS PROCESADOS: ${paymentItems.length} pagos`, { paymentItems });

  // 5. DERIVAR guestCount
  const adults = bookingData.numAdult || bookingData.adults || 1;
  const children = bookingData.numChild || bookingData.children || 0;
  const guestCount = children > 0 ? `${adults} Adultos, ${children} Niños` : `${adults} Adultos`;

  // 6. DERIVAR guestCount (simplificado, paymentDescription eliminado)

  // ARREGLO: Validación previa y fallbacks para campos requeridos
  if (!bookingData.id) {
    logError('TRANSFORM_PDF_DATA', 'bookingId faltante en bookingData', { bookingData });
  }

  const finalPdfData = {
    bookingId: bookingData.id || 'UNKNOWN', // Fallback para evitar undefined
    guestName: guestName,
    guestCount: guestCount,
    phone: bookingData.phone || '',
    email: bookingData.email || '', // Opcional como indicaste
    checkInDate: bookingData.arrival,
    checkOutDate: bookingData.departure,
    roomName: bookingData.roomName || 'Apartamento',
    distribucion: distribucion || 'Información disponible al check-in',
    nights: nights,
    totalCharges: totalCharges,
    totalPaid: totalPaid,
    paymentDescription: '', // Campo requerido por InternalPDFParams
    balance: balance,
    bookingStatus: bookingData.status || 'confirmed',
    invoiceItems: invoiceItems,  // Solo cargos
    paymentItems: paymentItems,  // Pagos por separado
    triggerFunction: 'auto_from_booking_details'
  };

  // Log final transformation para debugging (solo en desarrollo)
  if (process.env.NODE_ENV !== 'production') {
    logInfo('TRANSFORM_PDF_DATA', `📊 DATOS DE LA API: price=${bookingData.price}, invoiceItems=${(bookingData.invoiceItems || []).length}`, { 
      originalBookingId: bookingData.id,
      apiPrice: bookingData.price,
      calculatedTotal: totalChargesAmount,
      calculatedPaid: totalPaidAmount,
      calculatedBalance: balanceAmount
    });
    
    logInfo('TRANSFORM_PDF_DATA', `PDF Data final: ${JSON.stringify({
      bookingId: finalPdfData.bookingId,
      guestName: finalPdfData.guestName,
      email: finalPdfData.email || 'OPCIONAL',
      nights: finalPdfData.nights,
      invoiceItemsCount: finalPdfData.invoiceItems.length,
      paymentItemsCount: finalPdfData.paymentItems.length,
      totalCharges: finalPdfData.totalCharges,
      totalPaid: finalPdfData.totalPaid,
      balance: finalPdfData.balance
    })}`, { originalBookingId: bookingData.id });
    
    // DEBUG: Log de paymentItems específico para plantilla
    if (finalPdfData.paymentItems.length > 0) {
      logInfo('TRAN', `🎯 PAYMENTITEMS ENVIADOS A TEMPLATE:`, finalPdfData.paymentItems);
    } else {
      logInfo('TRAN', `⚠️ NO hay paymentItems para enviar a template`);
    }
  }

  return finalPdfData;
}

/**
 * Nueva función principal simplificada - Solo requiere bookingId
 */
export async function generateBookingConfirmationPDF(params: GenerateBookingConfirmationPDFParams, userContext?: any) {
  const startTime = Date.now();
  const context = { bookingId: params.bookingId, function: 'generateBookingConfirmationPDF' };
  
  // DEBUG: Log crítico del userContext recibido
  logInfo('USER_CONTEXT_DEBUG', `🔍 UserContext recibido en función`, {
    bookingId: params.bookingId,
    hasUserContext: !!userContext,
    userContextType: typeof userContext,
    userContextValue: userContext,
    contextKeys: userContext ? Object.keys(userContext) : [],
    chatId: userContext?.chatId,
    userId: userContext?.userId,
    threadId: userContext?.threadId
  });
  
  logInfo('GENERATE_BOOKING_CONFIRMATION_PDF', `🚀 Iniciando generación PDF para reserva: ${params.bookingId}`);

  // ENVIAR MENSAJE INMEDIATO AL USUARIO durante el run activo
  if (userContext?.chatId) {
    try {
      await sendInterimMessage(
        userContext.chatId, 
        "📄 Voy a proceder a generar el documento de confirmación actualizado de tu reserva...",
        userContext.userId
      );
    } catch (error) {
      // Si falla el mensaje interino, continuar con la generación PDF
      logInfo('INTERIM_MESSAGE_ERROR', 'Error enviando mensaje durante run, continuando', {
        bookingId: params.bookingId,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  try {
    // 1. CONSULTAR DATOS REALES directamente desde Beds24 API
    logInfo('GENERATE_BOOKING_CONFIRMATION_PDF', `🔍 Consultando datos reales de la reserva: ${params.bookingId}`, context);
    
    const bookingDetails = await fetchBookingByIdFromBeds24(params.bookingId);
    
    if (!bookingDetails.success || !bookingDetails.booking) {
      logError('GENERATE_BOOKING_CONFIRMATION_PDF', `❌ No se pudo obtener datos de la reserva: ${params.bookingId}`, context);
      return { 
        success: false, 
        error: bookingDetails.error || 'Reserva no encontrada o no se pudo acceder a los datos',
        message: `❌ Hubo un problema técnico obteniendo los detalles de la reserva ${params.bookingId}. Dile al cliente que vas a consultar con tu superior para resolver este inconveniente.` 
      };
    }

    // 2. VALIDACIÓN adicional antes de transformar
    if (!bookingDetails.booking || !bookingDetails.booking.id) {
      logError('GENERATE_BOOKING_CONFIRMATION_PDF', `❌ Datos de reserva inválidos`, { 
        ...context, 
        hasBooking: !!bookingDetails.booking,
        bookingId: bookingDetails.booking?.id || 'N/A'
      });
      return { 
        success: false, 
        error: 'Datos API inválidos: falta ID de reserva',
        message: `Los datos obtenidos de la API están incompletos para la reserva ${params.bookingId}` 
      };
    }

    // 3. VALIDACIÓN DE CANAL - Solo canales permitidos pueden generar PDF
    const rawChannel = (bookingDetails.booking as any).referer || (bookingDetails.booking as any).source || 'Unknown';
    const allowedChannels = ['booking.com', 'direct', 'pacartagena', 'booking', 'directo'];
    const blockedChannels = ['airbnb', 'expedia', 'hoteles.com', 'hotels.com', 'agoda'];
    
    // Normalizar canal para comparación
    let normalizedChannel = rawChannel.toLowerCase();
    
    // Mapear variaciones comunes para evitar falsos negativos
    if (normalizedChannel.includes('booking')) normalizedChannel = 'booking.com';
    if (normalizedChannel.includes('directo') || normalizedChannel.includes('direct')) normalizedChannel = 'direct';
    if (normalizedChannel.includes('pacartagena') || normalizedChannel.includes('pa cartagena')) normalizedChannel = 'pacartagena';
    
    // Verificar si es un canal bloqueado
    const isBlocked = blockedChannels.some(blocked => normalizedChannel.includes(blocked));
    if (isBlocked) {
      logError('GENERATE_BOOKING_CONFIRMATION_PDF', `❌ Canal bloqueado para PDF: ${rawChannel}`, { 
        ...context, 
        rawChannel: rawChannel,
        normalizedChannel: normalizedChannel,
        reason: 'Canal no permitido para generación de PDF'
      });
      return { 
        success: false, 
        error: `No se puede generar pdf de confirmación, indícale al huésped que no es posible generar pdf de confirmación de ese canal de reserva, dile que consultarás con tu superior alguna solución`,
        message: `Canal "${rawChannel}" no permitido para generación de PDF. Solo Booking.com, Direct y PaCartagena están habilitados.` 
      };
    }

    // Verificar si es un canal permitido (opcional, para logging)
    const isAllowed = allowedChannels.some(allowed => normalizedChannel.includes(allowed));
    if (!isAllowed) {
      // Log warning pero permitir continuar (en caso de canales nuevos no clasificados)
      logInfo('GENERATE_BOOKING_CONFIRMATION_PDF', `⚠️ Canal no clasificado, permitiendo: ${rawChannel}`, { 
        ...context, 
        rawChannel: rawChannel,
        normalizedChannel: normalizedChannel
      });
    }

    // 4. TRANSFORMAR datos de API a formato PDF
    const pdfData = await transformBookingDetailsToPDFData(bookingDetails.booking, params.distribucion);
    pdfData.documentType = 'CONFIRMACIÓN DE RESERVA'; // Valor fijo desde config
    
    // 5. GENERAR PDF con datos 100% reales
    const isRailway = process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_ENVIRONMENT_NAME;
    const pdfParams = { 
      ...pdfData, 
      returnBuffer: isRailway ? true : false  // Fuerza buffer en Railway para attachment
    };
    const result = await generateInternalPDF(pdfParams);
    
    // 6. PREPARAR PDF PARA ENVÍO AUTOMÁTICO VIA SISTEMA EXISTENTE
    if (result.success && (result as any).pdfPath) {
      const pdfPath = (result as any).pdfPath;
      logInfo('PDF_ATTACHMENT_PREPARED', 'PDF preparado para envío automático via sistema existente', {
        bookingId: params.bookingId,
        filePath: pdfPath,
        fileSize: (result as any).size
      });
      
      // LIMPIEZA AUTOMÁTICA: COMENTADO TEMPORALMENTE
      // setTimeout(async () => {
      //   try {
      //     const fs = await import('fs').then(m => m.promises);
      //     await fs.unlink(pdfPath);
      //     logInfo('PDF_CLEANUP', 'PDF eliminado automáticamente después del envío', {
      //       bookingId: params.bookingId,
      //       filePath: pdfPath,
      //       cleanupAfter: '2min',
      //       optimizedForScalability: true
      //     });
      //   } catch (cleanupError) {
      //     // Ignorar errores de limpieza (archivo ya eliminado, etc.)
      //   }
      // }, 2 * 60 * 1000); // 2 minutos - optimizado para 100+ usuarios
    }
    
    // 7. LOG de duración total para escalabilidad
    const duration = Date.now() - startTime;
    logInfo('GENERATE_BOOKING_CONFIRMATION_PDF', `✅ PDF generado exitosamente`, {
      ...context,
      duration: `${duration}ms`,
      dataSource: 'check-booking-details',
      transformedFields: Object.keys(pdfData).length
    });
    
    // 8. RETORNAR RESPUESTA CON ATTACHMENT PARA SISTEMA EXISTENTE
    const response: any = {
      success: true,
      message: `Envío de PDF de confirmación de reserva ${params.bookingId} exitoso. Indícale al huésped que verifique si todo está en orden con la información de su reserva.`
    };
    
    // SOLUCIÓN RAILWAY: Usar buffer in-memory en lugar de archivo físico
    // DEBUG: Log completo del result object
    logInfo('RESULT_DEBUG', 'Result object completo del PDF service', {
      success: result.success,
      hasBuffer: !!(result as any).pdfBuffer,
      bufferLength: (result as any).pdfBuffer?.length || 0,
      hasPdfPath: !!(result as any).pdfPath,
      hasFilePath: !!(result as any).filePath,
      resultKeys: Object.keys(result as any),
      isRailway: !!(process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_ENVIRONMENT_NAME)
    });
    
    // Log preparación de attachment
    logInfo('ATTACHMENT_PREP', 'Preparando attachment para response', { 
      isRailway: !!(process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_ENVIRONMENT_NAME),
      hasBuffer: !!(result as any).pdfBuffer, 
      hasPath: !!(result as any).pdfPath,
      bufferSize: (result as any).pdfBuffer?.length || 0
    });
    
    // Log simplificado (solo en caso de error)
    if (!result.success) {
      logInfo('PDF_GENERATION_FAILED', 'Fallo en generación de PDF', {
        bookingId: params.bookingId,
        success: result.success
      });
    }

    // PREPARAR ATTACHMENT PARA OPENAI SERVICE (similar a como funcionan los audios)
    if (result.success && ((result as any).pdfPath || (result as any).pdfBuffer)) {
      // Agregar attachment al response para que OpenAI service lo envíe
      response.attachment = {
        type: 'pdf',
        fileName: `confirmacion-reserva-${params.bookingId}.pdf`,
        pdfBuffer: (result as any).pdfBuffer || undefined,
        pdfPath: (result as any).pdfPath || undefined,
        filePath: (result as any).pdfPath || undefined // Compatibilidad con ambos nombres
      };
      
      // Attachment preparado silenciosamente
    } else {
      // Log cuando NO se ejecuta envío directo
      console.log('❌ DIRECT_SEND_FAILED - Condiciones NO cumplidas:', JSON.stringify({
        resultSuccess: result.success,
        hasPdfPath: !!(result as any).pdfPath,
        hasPdfBuffer: !!(result as any).pdfBuffer,
        bufferLength: (result as any).pdfBuffer?.length,
        hasUserContext: !!userContext,
        userContextKeys: userContext ? Object.keys(userContext) : null,
        hasChatId: !!userContext?.chatId,
        chatId: userContext?.chatId,
        bookingId: params.bookingId,
        conditionCheck: {
          success: result.success,
          hasPdf: !!((result as any).pdfPath || (result as any).pdfBuffer),
          hasChatId: !!userContext?.chatId,
          fullCondition: result.success && ((result as any).pdfPath || (result as any).pdfBuffer) && userContext?.chatId
        }
      }, null, 2));
    }
    
    return response;

  } catch (error) {
    const duration = Date.now() - startTime;
    logError('GENERATE_BOOKING_CONFIRMATION_PDF', `💥 Error generando PDF: ${error}`, {
      ...context,
      duration: `${duration}ms`,
      errorType: error instanceof Error ? error.constructor.name : 'UnknownError'
    });
    return {
      success: false,
      message: `❌ Hubo un problema técnico generando el PDF de confirmación. Dile al cliente que vas a consultar con tu superior para resolver este inconveniente.`
    };
  }
}

/**
 * Función interna para generar PDF con datos completos
 */
export async function generateInternalPDF(params: InternalPDFParams) {
  const startTime = Date.now();
  const context = { bookingId: params.bookingId, function: 'generateBookingConfirmationPDF' };
  
  logInfo('GENERATE_INVOICE_PDF', `🚀 Iniciando generación PDF para reserva: ${params.bookingId}`);

  try {
    // 0. Verificar si ya existe un PDF reciente para evitar duplicados
    const existingPDF = await checkExistingPDF(params.bookingId);
    if (existingPDF.exists) {
      logInfo('GENERATE_INVOICE_PDF', `📄 PDF existente encontrado para reserva: ${params.bookingId}`, context);
      return {
        success: true,
        message: `✅ PDF existente disponible para reserva ${params.bookingId}`,
        data: {
          bookingId: params.bookingId,
          documentType: 'EXISTENTE',
          size: existingPDF.size,
          generationTime: '0ms',
          efficiency: '🚀 Instantáneo'
        },
        pdfPath: existingPDF.path
      };
    }

    // 1. Preparar datos para el servicio PDF
    const invoiceData: InvoiceData = transformParamsToInvoiceData(params);
    
    logInfo('GENERATE_INVOICE_PDF', `📋 Datos procesados - Tipo: ${invoiceData.documentType}, Items: ${invoiceData.invoiceItems.length}`, context);

    // 2. Generar PDF con validación centralizada y gestión de ciclo de vida - RAILWAY OPTIMIZADO
    const isRailway = process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_ENVIRONMENT_NAME;
    const pdfService = getPDFService(); // Singleton con Auto-Healing y Graceful Shutdown
    const result = await pdfService.generateInvoicePDF(invoiceData, {
      saveToFile: (params as any).saveToFile || !isRailway,  // Solo guardar archivo en local, no en Railway
      outputDir: (params as any).outputDir || './src/temp/pdfs'
    });

    // 4. Validar resultado
    if (!result.success) {
      logError('GENERATE_INVOICE_PDF', `❌ Falló generación PDF: ${result.error}`, context);
      return createErrorResponse('PDF_GENERATION_ERROR', `Error en servicio PDF: ${result.error}`, {
        originalError: result.error,
        ...context
      });
    }

    // 5. Calcular métricas y logs de éxito
    const duration = Date.now() - startTime;
    const sizeKB = (result.size! / 1024).toFixed(1);
    const metrics = {
      duration: `${duration}ms`,
      size: `${sizeKB} KB`,
      efficiency: duration < 2000 ? '🚀 Rápido' : duration < 5000 ? '⚡ Normal' : '🐌 Lento'
    };
    
    logSuccess('GENERATE_INVOICE_PDF', `✅ PDF generado exitosamente - ${metrics.efficiency}`, {
      ...context,
      ...metrics,
      pdfPath: result.pdfPath
    });

    // 6. Crear respuesta estandarizada exitosa
    return createSuccessResponse({
      bookingId: params.bookingId,
      documentType: invoiceData.documentType,
      size: `${sizeKB} KB`,
      generationTime: metrics.duration,
      efficiency: metrics.efficiency,
      pdfPath: result.pdfPath,
      pdfBuffer: params.returnBuffer ? result.pdfBuffer : undefined
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorInfo = extractErrorInfo(error);
    
    logError('GENERATE_INVOICE_PDF', `💥 Error inesperado: ${errorInfo.message}`, {
      ...context,
      duration: `${duration}ms`,
      errorType: errorInfo.type,
      stack: errorInfo.stack
    });

    return createErrorResponse('UNEXPECTED_ERROR', `Error inesperado en generación PDF: ${errorInfo.message}`, {
      ...context,
      duration: `${duration}ms`,
      errorType: errorInfo.type,
      originalError: errorInfo.message
    });
  }
}

/**
 * Verifica si ya existe un PDF reciente para la reserva
 */
async function checkExistingPDF(bookingId: string): Promise<{exists: boolean; path?: string; size?: string}> {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Buscar PDFs existentes en directorio temporal
    const tempDir = path.join(process.cwd(), 'src', 'temp', 'pdfs');
    if (!fs.existsSync(tempDir)) {
      return { exists: false };
    }
    
    const files = fs.readdirSync(tempDir);
    const pdfPattern = new RegExp(`invoice-${bookingId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d+\\.pdf$`);
    
    // Buscar PDF más reciente (último 60 minutos para mayor flexibilidad)
    const now = Date.now();
    const sixtyMinutesAgo = now - (60 * 60 * 1000);
    
    for (const file of files) {
      if (pdfPattern.test(file)) {
        const filePath = path.join(tempDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime.getTime() > sixtyMinutesAgo) {
          const sizeKB = (stats.size / 1024).toFixed(1);
          return { 
            exists: true, 
            path: filePath, 
            size: `${sizeKB} KB`
          };
        }
      }
    }
    
    return { exists: false };
  } catch (error) {
    // Si hay error verificando, continuar con generación normal
    return { exists: false };
  }
}

/**
 * Transforma parámetros de entrada a datos de factura
 */
function transformParamsToInvoiceData(params: InternalPDFParams): InvoiceData {
  return {
    bookingId: params.bookingId,
    guestName: params.guestName,
    guestCount: params.guestCount,
    phone: params.phone,
    email: params.email,
    checkInDate: params.checkInDate,
    checkOutDate: params.checkOutDate,
    roomName: params.roomName,
    distribucion: params.distribucion,
    nights: params.nights,
    bookingStatus: params.bookingStatus,
    statusClass: getStatusClass(params.bookingStatus),
    totalCharges: params.totalCharges,
    totalPaid: params.totalPaid,
    balance: params.balance,
    invoiceItems: params.invoiceItems.map(item => ({
      description: item.description,
      quantity: item.quantity || '1',
      unitPrice: item.unitPrice || item.totalAmount,
      totalAmount: item.totalAmount
    })),
    paymentItems: (params as any).paymentItems || [],  // AÑADIDO: Pasar paymentItems al InvoiceData
    documentType: params.documentType || getDocumentType(params.triggerFunction, params.totalPaid),
    triggerFunction: params.triggerFunction || 'generate_pdf'
  };
}

/**
 * Crea respuesta de éxito estandarizada
 */
function createSuccessResponse(data: any) {
  const baseMessage = `✅ PDF generado exitosamente para reserva ${data.bookingId}`;
  
  return {
    success: true,
    message: data.pdfPath ? `${baseMessage}\n📁 Archivo: ${data.pdfPath}` : baseMessage,
    data: {
      bookingId: data.bookingId,
      documentType: data.documentType,
      size: data.size,
      generationTime: data.generationTime,
      efficiency: data.efficiency,
      timestamp: new Date().toISOString()
    },
    ...(data.pdfPath && { pdfPath: data.pdfPath }),
    ...(data.pdfBuffer && { pdfBuffer: data.pdfBuffer })
  };
}

/**
 * Crea respuesta de error estandarizada
 */
function createErrorResponse(errorCode: string, message: string, context: any = {}) {
  return {
    success: false,
    error: {
      code: errorCode,
      message,
      timestamp: new Date().toISOString(),
      context: {
        bookingId: context.bookingId || 'unknown',
        function: context.function || 'generateBookingConfirmationPDF',
        ...context
      }
    },
    // MENSAJE ESTÁNDAR para OpenAI Assistant
    message: `❌ Hubo un problema técnico generando el PDF de confirmación. Dile al cliente que vas a consultar con tu superior para resolver este inconveniente.`,
    bookingId: context.bookingId
  };
}

/**
 * Extrae información detallada del error
 */
function extractErrorInfo(error: unknown): { message: string; type: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: error.message,
      type: error.constructor.name,
      stack: error.stack
    };
  }
  
  return {
    message: String(error),
    type: 'UnknownError'
  };
}

/**
 * Envía mensaje inmediato durante el run activo
 */
async function sendInterimMessage(chatId: string, message: string, userId?: string): Promise<void> {
  try {
    const WHAPI_API_URL = process.env.WHAPI_API_URL;
    const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
    
    if (!WHAPI_API_URL || !WHAPI_TOKEN) {
      throw new Error('WHAPI_API_URL o WHAPI_TOKEN no están configurados');
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

    logInfo('INTERIM_MESSAGE_SENT', 'Mensaje durante run enviado exitosamente', {
      chatId,
      userId,
      messagePreview: message.substring(0, 50)
    });

  } catch (error) {
    logError('INTERIM_MESSAGE_ERROR', 'Error enviando mensaje durante run', {
      chatId,
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Determina la clase CSS del status
 */
function getStatusClass(status?: string): string {
  if (!status) return 'pending';
  
  const statusLower = status.toLowerCase();
  if (statusLower.includes('confirm')) return 'confirmed';
  if (statusLower.includes('paid')) return 'confirmed';
  if (statusLower.includes('new')) return 'new';
  return 'pending';
}

/**
 * Determina el tipo de documento según la función
 */
function getDocumentType(triggerFunction?: string, totalPaid?: string): string {
  // Lógica automática: si no hay triggerFunction, inferir del estado de pago
  const actualTrigger = triggerFunction || (totalPaid ? 'confirm_booking' : 'create_new_booking');
  
  switch (actualTrigger) {
    case 'create_new_booking':
      return 'CONFIRMACIÓN DE RESERVA';
    case 'confirm_booking':
      return 'RESERVA CONFIRMADA';
    default:
      return 'CONFIRMACIÓN DE RESERVA';
  }
}

// ============================================================================
// SCHEMA EXPORT PARA OPENAI
// ============================================================================

export const generateBookingConfirmationPDFFunction: FunctionDefinition = {
  name: 'generate_booking_confirmation_pdf',
  description: 'Genera PDF elegante de confirmación de reserva con diseño optimizado. Consulta datos reales de Beds24 API y base de datos Railway. Solo para reservas confirmadas de canales permitidos.',
  category: 'invoice',
  version: '2.1.0',
  enabled: true,
  parameters: {
    type: 'object',
    properties: {
      bookingId: {
        type: 'string',
        description: 'ID único de la reserva en Beds24',
        minLength: 1
      },
      distribucion: {
        type: 'string',
        description: 'Distribución detallada de camas y sofá camas. Ejemplo: "Sala: dos sofá camas, Alcoba: 1 cama doble + 1 cama nido". Solo especificar si difiere de la configuración estándar.'
      }
    },
    required: ['bookingId'],
    additionalProperties: false
  },
  handler: generateBookingConfirmationPDF
};