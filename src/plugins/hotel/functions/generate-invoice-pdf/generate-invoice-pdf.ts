// src/plugins/hotel/functions/generate-invoice-pdf/generate-invoice-pdf.ts
import { InvoiceData } from '../../services/pdf-generator.service';
import { getPDFService } from '../../services/pdf-lifecycle.service';
import { logInfo, logError, logSuccess } from '../../../../utils/logging';
import type { FunctionDefinition } from '../../../../functions/types/function-types.js';
import { checkBookingDetails } from '../check-booking-details/check-booking-details';

// Nueva interfaz simplificada para OpenAI
interface GenerateBookingConfirmationPDFParams {
  bookingId: string;
  distribucion?: string;
  documentType?: string;
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
 * Transforma datos de check-booking-details al formato requerido para PDF
 */
async function transformBookingDetailsToPDFData(bookingData: any, distribucion?: string): Promise<InternalPDFParams> {
  // 1. CALCULAR nights
  const checkInDate = new Date(bookingData.arrival);
  const checkOutDate = new Date(bookingData.departure);
  const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

  // 2. COMBINAR nombres
  const guestName = `${bookingData.firstName || ''} ${bookingData.lastName || ''}`.trim();

  // 3. FORMATEAR montos (convertir números a strings formateados)
  const totalCharges = `$${(bookingData.totalCharges || 0).toLocaleString('es-CO')}`;
  const totalPaid = `$${(bookingData.totalPaid || 0).toLocaleString('es-CO')}`;
  const balance = `$${(bookingData.balance || 0).toLocaleString('es-CO')}`;

  // 4. PROCESAR invoiceItems (solo cargos, no pagos)
  const invoiceItems = (bookingData.invoiceItems || [])
    .filter((item: any) => item.type === 'charge')
    .map((item: any) => ({
      description: item.description || 'Servicio de alojamiento',
      quantity: item.qty?.toString() || '1',
      unitPrice: `$${(item.amount || 0).toLocaleString('es-CO')}`,
      totalAmount: `$${(item.lineTotal || item.amount || 0).toLocaleString('es-CO')}`
    }));

  // 5. DERIVAR guestCount
  const adults = bookingData.numAdult || bookingData.adults || 1;
  const children = bookingData.numChild || bookingData.children || 0;
  const guestCount = children > 0 ? `${adults} Adultos, ${children} Niños` : `${adults} Adultos`;

  // 6. DERIVAR paymentDescription
  const payments = (bookingData.invoiceItems || []).filter((item: any) => item.type === 'payment');
  let paymentDescription = 'Pago pendiente de registro';
  if (payments.length > 0) {
    const latestPayment = payments[payments.length - 1];
    paymentDescription = `Pago registrado: ${latestPayment.description || 'Anticipo recibido'}`;
  }

  return {
    bookingId: bookingData.id,
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
    paymentDescription: paymentDescription,
    balance: balance,
    bookingStatus: bookingData.status || 'confirmed',
    invoiceItems: invoiceItems,
    triggerFunction: 'auto_from_booking_details'
  };
}

/**
 * Nueva función principal simplificada - Solo requiere bookingId
 */
export async function generateBookingConfirmationPDF(params: GenerateBookingConfirmationPDFParams) {
  const startTime = Date.now();
  const context = { bookingId: params.bookingId, function: 'generateBookingConfirmationPDF' };
  
  logInfo('GENERATE_BOOKING_CONFIRMATION_PDF', `🚀 Iniciando generación PDF para reserva: ${params.bookingId}`);

  try {
    // 1. CONSULTAR DATOS REALES desde check-booking-details
    logInfo('GENERATE_BOOKING_CONFIRMATION_PDF', `🔍 Consultando datos reales de la reserva: ${params.bookingId}`, context);
    
    const bookingDetails = await checkBookingDetails({ bookingId: params.bookingId });
    
    if (!bookingDetails.success || !bookingDetails.booking) {
      logError('GENERATE_BOOKING_CONFIRMATION_PDF', `❌ No se pudo obtener datos de la reserva: ${params.bookingId}`, context);
      return { 
        success: false, 
        error: 'Reserva no encontrada o no se pudo acceder a los datos',
        message: `No se pudieron obtener los detalles de la reserva ${params.bookingId}` 
      };
    }

    // 2. TRANSFORMAR datos de API a formato PDF
    const pdfData = await transformBookingDetailsToPDFData(bookingDetails.booking, params.distribucion);
    pdfData.documentType = params.documentType || 'confirmation';
    
    // 3. GENERAR PDF con datos 100% reales
    return await generateInternalPDF(pdfData);

  } catch (error) {
    logError('GENERATE_BOOKING_CONFIRMATION_PDF', `💥 Error generando PDF: ${error}`, context);
    return {
      success: false,
      error: `Error generando PDF: ${error instanceof Error ? error.message : error}`,
      message: 'Error interno al generar el PDF de confirmación'
    };
  }
}

/**
 * Función interna para generar PDF con datos completos
 */
export async function generateInternalPDF(params: InternalPDFParams) {
  const startTime = Date.now();
  const context = { bookingId: params.bookingId, function: 'generateInvoicePDF' };
  
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

    // 2. Generar PDF con validación centralizada y gestión de ciclo de vida
    const pdfService = getPDFService(); // Singleton con Auto-Healing y Graceful Shutdown
    const result = await pdfService.generateInvoicePDF(invoiceData, {
      saveToFile: params.saveToFile || false,
      outputDir: undefined
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
    paymentDescription: params.paymentDescription,
    balance: params.balance,
    invoiceItems: params.invoiceItems.map(item => ({
      description: item.description,
      quantity: item.quantity || '1',
      unitPrice: item.unitPrice || item.totalAmount,
      totalAmount: item.totalAmount
    })),
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
        function: context.function || 'generateInvoicePDF',
        ...context
      }
    },
    // Mantener compatibilidad con código existente
    message,
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
  description: 'Genera PDF de confirmación de reserva consultando datos reales de Beds24 - Solo requiere bookingId',
  category: 'invoice',
  version: '2.0.0',
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
        description: 'Distribución específica de camas y espacios si difiere de la estándar'
      },
      documentType: {
        type: 'string',
        description: 'Tipo de documento PDF a generar',
        enum: ['confirmation', 'updated_confirmation'],
        default: 'confirmation'
      }
    },
    required: ['bookingId'],
    additionalProperties: false
  },
  handler: generateBookingConfirmationPDF
};