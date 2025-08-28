// src/plugins/hotel/functions/generate-payment-receipt-pdf/generate-payment-receipt-pdf.ts

import { InvoiceData } from '../../services/pdf-generator.service';
import { getPDFService } from '../../services/pdf-lifecycle.service';
import { logInfo, logError, logSuccess } from '../../../../utils/logging';
import type { FunctionDefinition } from '../../../../functions/types/function-types.js';
import { Beds24Client } from '../../services/beds24-client';
import { PrismaClient } from '@prisma/client';
import { fetchWithRetry } from '../../../../core/utils/retry-utils';

// Nueva interfaz simplificada para OpenAI
interface GeneratePaymentReceiptPDFParams {
  bookingId: string;
  distribucion?: string;
}

// Interfaz interna completa para datos transformados
interface InternalReceiptPDFParams {
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
  paymentItems: Array<{
    description: string;
    amount: number;
    formattedAmount: string;
  }>;
}

/**
 * Buscar reserva por bookingId directamente en Beds24 API
 * Reutilizada de generate-booking-confirmation-pdf
 */
async function fetchBookingByIdFromBeds24(bookingId: string) {
  const startTime = Date.now();
  const context = { bookingId, function: 'fetchBookingByIdFromBeds24' };
  
  try {
    logInfo('FETCH_BOOKING_BY_ID_RECEIPT', `🔍 Consultando reserva directamente: ${bookingId}`, context);
    
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

    if (!apiResponse || !apiResponse.data || apiResponse.data.length === 0) {
      const duration = Date.now() - startTime;
      logError('FETCH_BOOKING_BY_ID_RECEIPT', `❌ Reserva no encontrada: ${bookingId}`, { ...context, duration: `${duration}ms` });
      return { 
        success: false, 
        error: 'Reserva no encontrada',
        message: `❌ Hubo un problema técnico consultando la reserva ${bookingId}. Dile al cliente que vas a consultar con tu superior para verificar el ID de reserva.`
      };
    }

    // Extraer booking específico por ID exacto
    const targetBooking = apiResponse.data.find((b: any) => 
      b.id == bookingId || b.bookId == bookingId || 
      b.id === parseInt(bookingId) || b.bookId === parseInt(bookingId)
    ) || apiResponse.data[0];

    if (!targetBooking || (!targetBooking.bookId && !targetBooking.id)) {
      const duration = Date.now() - startTime;
      logError('FETCH_BOOKING_BY_ID_RECEIPT', `❌ Booking específico no encontrado en respuesta`, { 
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

    // Validación de status temprana
    const bookingStatus = targetBooking.status?.toLowerCase() || 'unknown';
    if (bookingStatus !== 'confirmed') {
      const duration = Date.now() - startTime;
      logError('FETCH_BOOKING_BY_ID_RECEIPT', `❌ Status de reserva inválido: ${bookingStatus}`, { 
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

    // Procesar datos similar a check-booking-details
    const processedBooking = await processBookingData(targetBooking, prisma);
    
    const duration = Date.now() - startTime;
    logInfo('FETCH_BOOKING_BY_ID_RECEIPT', `✅ Reserva encontrada exitosamente`, { 
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
    logError('FETCH_BOOKING_BY_ID_RECEIPT', `💥 Error consultando reserva: ${error}`, { 
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
 * Función helper para procesar datos de reserva
 */
async function processBookingData(booking: any, prisma: PrismaClient) {
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
    logError('PROCESS_BOOKING_DATA_RECEIPT', `Error obteniendo nombre real del apartamento: ${error}`, { bookingId: booking.id || booking.bookId });
    realRoomName = 'Apartamento';
  }

  const processedData = {
    id: booking.id || booking.bookId,
    firstName: booking.firstName || '',
    lastName: booking.lastName || '', 
    email: booking.email || '',
    phone: booking.phone || '',
    arrival: booking.arrival,
    departure: booking.departure,
    roomName: realRoomName,
    numAdult: booking.numAdult || 1,
    numChild: booking.numChild || 0,
    price: booking.price || 0,
    totalCharges: booking.totalCharges || booking.price || 0,
    totalPaid: booking.totalPaid || 0,
    balance: booking.balance || 0,
    status: booking.status || 'confirmed',
    invoiceItems: booking.invoiceItems || []
  };

  return processedData;
}

/**
 * Transforma datos de API al formato requerido para recibo de pago
 */
async function transformBookingDetailsToReceiptData(bookingData: any, distribucion?: string): Promise<InternalReceiptPDFParams> {
  // 1. CALCULAR nights
  const checkInDate = new Date(bookingData.arrival);
  const checkOutDate = new Date(bookingData.departure);
  let nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (nights < 1) nights = 1;

  // 2. COMBINAR nombres
  const guestName = `${bookingData.firstName || ''} ${bookingData.lastName || ''}`.trim();

  // 3. CALCULAR totales reales desde la API de Beds24
  let totalChargesAmount = bookingData.price || 0;
  
  if (totalChargesAmount === 0) {
    totalChargesAmount = (bookingData.invoiceItems || [])
      .filter((item: any) => item.type === 'charge')
      .reduce((sum: number, item: any) => sum + (item.lineTotal || item.amount || 0), 0);
  }
  
  // Calcular total de pagos
  const totalPaidAmount = (bookingData.invoiceItems || [])
    .filter((item: any) => item.type === 'payment')
    .reduce((sum: number, item: any) => sum + Math.abs(item.amount || 0), 0);
  
  // Calcular saldo pendiente
  const balanceAmount = totalChargesAmount - totalPaidAmount;
  
  // Formatear montos
  const totalCharges = `${totalChargesAmount.toLocaleString('es-CO')}`;
  const totalPaid = `${totalPaidAmount.toLocaleString('es-CO')}`;
  const balance = `${balanceAmount.toLocaleString('es-CO')}`;

  // 4. PROCESAR SOLO el último pago (diferencia clave con confirmación completa)
  const allPayments = (bookingData.invoiceItems || [])
    .filter((item: any) => item.type === 'payment')
    .map((item: any) => ({
      description: item.description || 'Pago recibido',
      amount: Math.abs(item.amount || 0),
      formattedAmount: `${Math.abs(item.amount || 0).toLocaleString('es-CO')}`
    }));

  // Solo último pago para el recibo
  const paymentItems = allPayments.slice(-1);

  // Log para verificar
  logInfo('TRANSFORM_RECEIPT_DATA', `💰 PAYMENT RECIBO: ${paymentItems.length} pago (último)`, { 
    totalPayments: allPayments.length,
    lastPayment: paymentItems[0] 
  });

  // 5. PROCESAR cargos básicos (reutilizar lógica)
  const invoiceItems = (bookingData.invoiceItems || [])
    .filter((item: any) => item.type === 'charge')
    .map((item: any) => {
      let itemDescription = item.description || 'Servicio de alojamiento';
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

  // 6. DERIVAR guestCount
  const adults = bookingData.numAdult || bookingData.adults || 1;
  const children = bookingData.numChild || bookingData.children || 0;
  const guestCount = children > 0 ? `${adults} Adultos, ${children} Niños` : `${adults} Adultos`;

  const finalReceiptData = {
    bookingId: bookingData.id || 'UNKNOWN',
    guestName: guestName,
    guestCount: guestCount,
    phone: bookingData.phone || '',
    email: bookingData.email || '',
    checkInDate: bookingData.arrival,
    checkOutDate: bookingData.departure,
    roomName: bookingData.roomName || 'Apartamento',
    distribucion: distribucion || 'Información disponible al check-in',
    nights: nights,
    totalCharges: totalCharges,
    totalPaid: totalPaid,
    paymentDescription: paymentItems[0]?.description || 'Pago recibido',
    balance: balance,
    bookingStatus: bookingData.status || 'confirmed',
    invoiceItems: invoiceItems,
    paymentItems: paymentItems, // Solo último pago
    triggerFunction: 'auto_from_receipt',
    documentType: 'RECIBO DE PAGO' // Diferencia clave
  };

  return finalReceiptData;
}

/**
 * Función principal para generar recibo de pago específico
 */
export async function generatePaymentReceiptPDF(params: GeneratePaymentReceiptPDFParams, userContext?: any) {
  const startTime = Date.now();
  const context = { bookingId: params.bookingId, function: 'generatePaymentReceiptPDF' };
  
  logInfo('GENERATE_PAYMENT_RECEIPT_PDF', `🚀 Iniciando generación recibo de pago: ${params.bookingId}`, context);

  // ENVIAR MENSAJE INMEDIATO AL USUARIO
  if (userContext?.chatId) {
    try {
      await sendInterimMessage(
        userContext.chatId, 
        "🧾 Voy a proceder a generar el recibo de pago específico para tu reserva...",
        userContext.userId
      );
    } catch (error) {
      logInfo('INTERIM_MESSAGE_ERROR_RECEIPT', 'Error enviando mensaje durante run, continuando', {
        bookingId: params.bookingId,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  try {
    // 1. CONSULTAR DATOS REALES directamente desde Beds24 API
    logInfo('GENERATE_PAYMENT_RECEIPT_PDF', `🔍 Consultando datos reales de la reserva: ${params.bookingId}`, context);
    
    const bookingDetails = await fetchBookingByIdFromBeds24(params.bookingId);
    
    if (!bookingDetails.success || !bookingDetails.booking) {
      logError('GENERATE_PAYMENT_RECEIPT_PDF', `❌ No se pudo obtener datos de la reserva: ${params.bookingId}`, context);
      return { 
        success: false, 
        error: bookingDetails.error || 'Reserva no encontrada o no se pudo acceder a los datos',
        message: `❌ Hubo un problema técnico obteniendo los detalles de la reserva ${params.bookingId}. Dile al cliente que vas a consultar con tu superior para resolver este inconveniente.` 
      };
    }

    // 2. VALIDACIÓN de múltiples pagos - requiere al menos 2 pagos
    const allPayments = (bookingDetails.booking.invoiceItems || [])
      .filter((item: any) => item.type === 'payment');
    
    if (allPayments.length < 2) {
      logError('GENERATE_PAYMENT_RECEIPT_PDF', `❌ Insuficientes pagos para recibo: ${allPayments.length}`, { 
        ...context, 
        paymentsFound: allPayments.length,
        requiredPayments: 2
      });
      return { 
        success: false, 
        error: `Solo ${allPayments.length} pago(s) registrado(s), se requieren al menos 2 para generar recibo`,
        message: `No se puede generar recibo de pago ya que solo hay ${allPayments.length} pago registrado. Los recibos específicos requieren múltiples pagos. Usa generate_booking_confirmation_pdf para confirmaciones completas.` 
      };
    }

    // 3. TRANSFORMAR datos de API a formato recibo
    const receiptData = await transformBookingDetailsToReceiptData(bookingDetails.booking, params.distribucion);
    
    // 4. GENERAR PDF con datos específicos del recibo
    const result = await generateInternalReceiptPDF(receiptData);
    
    // 5. PREPARAR PDF PARA ENVÍO AUTOMÁTICO
    if (result.success && (result as any).pdfPath) {
      const pdfPath = (result as any).pdfPath;
      logInfo('PDF_RECEIPT_ATTACHMENT_PREPARED', 'Recibo PDF preparado para envío automático', {
        bookingId: params.bookingId,
        filePath: pdfPath,
        fileSize: (result as any).size
      });
    }
    
    // 6. LOG de duración total
    const duration = Date.now() - startTime;
    logInfo('GENERATE_PAYMENT_RECEIPT_PDF', `✅ Recibo PDF generado exitosamente`, {
      ...context,
      duration: `${duration}ms`,
      paymentsProcessed: receiptData.paymentItems.length
    });
    
    // 7. RETORNAR RESPUESTA CON ATTACHMENT
    const response: any = {
      success: true,
      message: `Envío de recibo de pago para reserva ${params.bookingId} exitoso. Indícale al huésped que verifique el pago registrado en el documento.`
    };
    
    // Añadir attachment para envío automático
    if (result.success && (result as any).pdfPath) {
      const pdfPath = (result as any).pdfPath;
      response.attachment = {
        type: 'pdf',
        filePath: pdfPath,
        fileName: `recibo-pago-${params.bookingId}.pdf`
      };
      
      logInfo('PDF_RECEIPT_ATTACHMENT_ADDED', 'Recibo PDF attachment añadido a respuesta', {
        bookingId: params.bookingId,
        filePath: pdfPath,
        fileName: `recibo-pago-${params.bookingId}.pdf`
      });
    }
    
    return response;

  } catch (error) {
    const duration = Date.now() - startTime;
    logError('GENERATE_PAYMENT_RECEIPT_PDF', `💥 Error generando recibo: ${error}`, {
      ...context,
      duration: `${duration}ms`,
      errorType: error instanceof Error ? error.constructor.name : 'UnknownError'
    });
    return {
      success: false,
      message: `❌ Hubo un problema técnico generando el recibo de pago. Dile al cliente que vas a consultar con tu superior para resolver este inconveniente.`
    };
  }
}

/**
 * Función interna para generar recibo PDF con datos completos
 */
export async function generateInternalReceiptPDF(params: InternalReceiptPDFParams) {
  const startTime = Date.now();
  const context = { bookingId: params.bookingId, function: 'generateInternalReceiptPDF' };
  
  logInfo('GENERATE_RECEIPT_PDF_INTERNAL', `🚀 Iniciando generación recibo PDF interno: ${params.bookingId}`);

  try {
    // 1. Verificar si ya existe un recibo reciente para evitar duplicados
    const existingPDF = await checkExistingReceiptPDF(params.bookingId);
    if (existingPDF.exists) {
      logInfo('GENERATE_RECEIPT_PDF_INTERNAL', `📄 Recibo existente encontrado: ${params.bookingId}`, context);
      return {
        success: true,
        message: `✅ Recibo existente disponible para reserva ${params.bookingId}`,
        data: {
          bookingId: params.bookingId,
          documentType: 'RECIBO EXISTENTE',
          size: existingPDF.size,
          generationTime: '0ms',
          efficiency: '🚀 Instantáneo'
        },
        pdfPath: existingPDF.path
      };
    }

    // 2. Preparar datos para el servicio PDF
    const invoiceData: InvoiceData = transformReceiptParamsToInvoiceData(params);
    
    logInfo('GENERATE_RECEIPT_PDF_INTERNAL', `📋 Datos recibo procesados - Tipo: ${invoiceData.documentType}, Pagos: ${invoiceData.paymentItems?.length || 0}`, context);

    // 3. Generar PDF con servicio centralizado
    const pdfService = getPDFService();
    const result = await pdfService.generateInvoicePDF(invoiceData, {
      saveToFile: true,
      outputDir: './src/temp/pdfs'
    });

    // 4. Validar resultado
    if (!result.success) {
      logError('GENERATE_RECEIPT_PDF_INTERNAL', `❌ Falló generación recibo PDF: ${result.error}`, context);
      return {
        success: false,
        error: `Error en servicio PDF: ${result.error}`,
        message: '❌ Hubo un problema técnico generando el recibo de pago.'
      };
    }

    // 5. Calcular métricas
    const duration = Date.now() - startTime;
    const sizeKB = (result.size! / 1024).toFixed(1);
    const metrics = {
      duration: `${duration}ms`,
      size: `${sizeKB} KB`,
      efficiency: duration < 2000 ? '🚀 Rápido' : duration < 5000 ? '⚡ Normal' : '🐌 Lento'
    };
    
    logSuccess('GENERATE_RECEIPT_PDF_INTERNAL', `✅ Recibo PDF generado exitosamente - ${metrics.efficiency}`, {
      ...context,
      ...metrics,
      pdfPath: result.pdfPath
    });

    // 6. Respuesta exitosa
    return {
      success: true,
      message: `✅ Recibo PDF generado exitosamente para reserva ${params.bookingId}`,
      data: {
        bookingId: params.bookingId,
        documentType: invoiceData.documentType,
        size: `${sizeKB} KB`,
        generationTime: metrics.duration,
        efficiency: metrics.efficiency
      },
      pdfPath: result.pdfPath
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    logError('GENERATE_RECEIPT_PDF_INTERNAL', `💥 Error inesperado: ${error}`, {
      ...context,
      duration: `${duration}ms`,
      errorType: error instanceof Error ? error.constructor.name : 'UnknownError'
    });

    return {
      success: false,
      error: `Error inesperado en generación recibo: ${error instanceof Error ? error.message : error}`,
      message: `❌ Hubo un problema técnico generando el recibo de pago.`
    };
  }
}

/**
 * Verifica si ya existe un recibo reciente para la reserva
 */
async function checkExistingReceiptPDF(bookingId: string): Promise<{exists: boolean; path?: string; size?: string}> {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const tempDir = path.join(process.cwd(), 'src', 'temp', 'pdfs');
    if (!fs.existsSync(tempDir)) {
      return { exists: false };
    }
    
    const files = fs.readdirSync(tempDir);
    const pdfPattern = new RegExp(`receipt-${bookingId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d+\\.pdf$`);
    
    // Buscar recibo más reciente (último 60 minutos)
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
    return { exists: false };
  }
}

/**
 * Transforma parámetros de recibo a datos de factura
 */
function transformReceiptParamsToInvoiceData(params: InternalReceiptPDFParams): InvoiceData {
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
    statusClass: 'confirmed', // Recibos siempre de reservas confirmadas
    totalCharges: params.totalCharges,
    totalPaid: params.totalPaid,
    balance: params.balance,
    invoiceItems: params.invoiceItems.map(item => ({
      description: item.description,
      quantity: item.quantity || '1',
      unitPrice: item.unitPrice || item.totalAmount,
      totalAmount: item.totalAmount
    })),
    paymentItems: params.paymentItems, // Solo último pago
    documentType: params.documentType || 'RECIBO DE PAGO',
    triggerFunction: params.triggerFunction || 'generate_payment_receipt_pdf'
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

    logInfo('INTERIM_MESSAGE_SENT_RECEIPT', 'Mensaje durante run enviado exitosamente', {
      chatId,
      userId,
      messagePreview: message.substring(0, 50)
    });

  } catch (error) {
    logError('INTERIM_MESSAGE_ERROR_RECEIPT', 'Error enviando mensaje durante run', {
      chatId,
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

// Definición para OpenAI Assistant
export const generatePaymentReceiptPDFFunction: FunctionDefinition = {
  name: 'generate_payment_receipt_pdf',
  description: 'Genera recibo específico de pago individual para reserva existente. Solo para reservas con múltiples pagos (2+). Muestra únicamente el último pago registrado.',
  category: 'invoice',
  version: '1.0.0',
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
        description: 'Distribución detallada de camas y sofá camas. Solo especificar si difiere de la configuración estándar.'
      }
    },
    required: ['bookingId'],
    additionalProperties: false
  },
  handler: generatePaymentReceiptPDF
};