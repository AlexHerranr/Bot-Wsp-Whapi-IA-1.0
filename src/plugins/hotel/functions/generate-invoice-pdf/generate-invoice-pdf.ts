// src/plugins/hotel/functions/generate-invoice-pdf/generate-invoice-pdf.ts
import { InvoiceData } from '../../services/pdf-generator.service';
import { getPDFService } from '../../services/pdf-lifecycle.service';
import { logInfo, logError, logSuccess } from '../../../../utils/logging';
import type { FunctionDefinition } from '../../../../functions/types/function-types.js';

interface GenerateInvoicePDFParams {
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
  totalPaid: string;              // AHORA OBLIGATORIO
  paymentDescription: string;     // AHORA OBLIGATORIO
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
 * Genera PDF de factura usando template interno
 */
export async function generateInvoicePDF(params: GenerateInvoicePDFParams) {
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
    
    // Buscar PDF más reciente (último 30 minutos)
    const now = Date.now();
    const thirtyMinutesAgo = now - (30 * 60 * 1000);
    
    for (const file of files) {
      if (pdfPattern.test(file)) {
        const filePath = path.join(tempDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime.getTime() > thirtyMinutesAgo) {
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
function transformParamsToInvoiceData(params: GenerateInvoicePDFParams): InvoiceData {
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

export const generateInvoicePDFFunction: FunctionDefinition = {
  name: 'generate_invoice_pdf',
  description: 'Genera un PDF de factura/confirmación de reserva usando template interno con datos de la reserva',
  category: 'invoice',
  version: '1.0.0',
  enabled: true,
  parameters: {
    type: 'object',
    properties: {
      bookingId: {
        type: 'string',
        description: 'ID único de la reserva',
        minLength: 1
      },
      guestName: {
        type: 'string',
        description: 'Nombre completo del huésped principal',
        minLength: 1
      },
      guestCount: {
        type: 'string',
        description: 'Número de huéspedes (ej: "2 Adultos, 1 Niño")',
        minLength: 1
      },
      phone: {
        type: 'string',
        description: 'Teléfono del huésped',
        minLength: 1
      },
      email: {
        type: 'string',
        description: 'Email del huésped',
        format: 'email'
      },
      checkInDate: {
        type: 'string',
        description: 'Fecha de check-in (YYYY-MM-DD)',
        pattern: '^\\d{4}-\\d{2}-\\d{2}$'
      },
      checkOutDate: {
        type: 'string',
        description: 'Fecha de check-out (YYYY-MM-DD)',
        pattern: '^\\d{4}-\\d{2}-\\d{2}$'
      },
      roomName: {
        type: 'string',
        description: 'Nombre del apartamento/habitación'
      },
      distribucion: {
        type: 'string',
        description: 'Distribución de camas y espacios (ej: "2 camas dobles, 1 sofá cama")'
      },
      nights: {
        type: 'number',
        description: 'Número de noches',
        minimum: 1
      },
      totalCharges: {
        type: 'string',
        description: 'Total de la reserva (ej: "$300.000")'
      },
      totalPaid: {
        type: 'string',
        description: 'Total pagado (opcional, ej: "$100.000")'
      },
      paymentDescription: {
        type: 'string',
        description: 'Descripción del pago realizado (ej: "Anticipo del 60% vía transferencia bancaria")'
      },
      balance: {
        type: 'string',
        description: 'Saldo pendiente (opcional, ej: "$200.000")'
      },
      bookingStatus: {
        type: 'string',
        description: 'Estado de la reserva (ej: "Confirmada", "Pendiente")'
      },
      invoiceItems: {
        type: 'array',
        description: 'Items de la factura',
        minItems: 1,
        items: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'Descripción del item'
            },
            quantity: {
              type: 'string',
              description: 'Cantidad'
            },
            unitPrice: {
              type: 'string',
              description: 'Precio unitario'
            },
            totalAmount: {
              type: 'string',
              description: 'Total del item'
            }
          },
          required: ['description', 'totalAmount'],
          additionalProperties: false
        }
      },
      documentType: {
        type: 'string',
        description: 'Tipo de documento (opcional, se auto-detecta)'
      },
      triggerFunction: {
        type: 'string',
        description: 'Función que origina el PDF (opcional)',
        enum: ['create_new_booking', 'confirm_booking']
      },
      saveToFile: {
        type: 'boolean',
        description: 'Si guardar PDF como archivo',
        default: false
      },
      returnBuffer: {
        type: 'boolean',
        description: 'Si retornar el buffer del PDF',
        default: false
      }
    },
    required: [
      'bookingId',
      'guestName',
      'guestCount', 
      'phone',
      'email',
      'checkInDate',
      'checkOutDate',
      'roomName',
      'nights',
      'totalCharges',
      'totalPaid',
      'paymentDescription',
      'invoiceItems'
    ],
    additionalProperties: false
  },
  handler: generateInvoicePDF
};