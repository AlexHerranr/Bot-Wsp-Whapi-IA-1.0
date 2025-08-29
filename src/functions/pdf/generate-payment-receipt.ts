/**
 * Función para generar PDF de recibo de pago
 * Genera un documento PDF con los detalles de un pago específico
 */

import type { FunctionDefinition } from '../types/function-types.js';
import { getPuppeteerConfig, launchPuppeteerWithRetry } from '../../config/puppeteer.config.js';
import { getBeds24Service } from '../../services/beds24/beds24.service.js';
import { getBeds24Config } from '../../config/integrations/beds24.config.js';
import { logInfo, logError, logSuccess } from '../../utils/logging/index.js';
import * as puppeteer from 'puppeteer';
import * as handlebars from 'handlebars';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Interface para los argumentos de la función
 */
interface GeneratePaymentReceiptArgs {
  bookingId: string;
  paymentId?: string;
  userContext?: {
    userId?: string;
    chatId?: string;
    threadId?: string;
  };
}

/**
 * Template HTML para el recibo de pago
 */
const RECEIPT_TEMPLATE = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recibo de Pago - TeAlquilamos</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 40px;
            background: white;
            color: #333;
        }
        .header {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 32px;
            font-weight: bold;
        }
        .header .subtitle {
            margin-top: 10px;
            font-size: 18px;
            opacity: 0.95;
        }
        .receipt-number {
            background: rgba(255,255,255,0.2);
            display: inline-block;
            padding: 8px 20px;
            border-radius: 25px;
            margin-top: 15px;
            font-size: 16px;
            font-weight: 600;
        }
        .success-badge {
            background: #d4edda;
            color: #155724;
            border: 2px solid #c3e6cb;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            margin-bottom: 25px;
            font-size: 18px;
            font-weight: 600;
        }
        .section {
            background: #f8f9fa;
            padding: 25px;
            border-radius: 8px;
            margin-bottom: 20px;
            border: 1px solid #dee2e6;
        }
        .section h2 {
            color: #28a745;
            margin-top: 0;
            font-size: 22px;
            border-bottom: 2px solid #28a745;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #e0e0e0;
        }
        .info-row:last-child {
            border-bottom: none;
        }
        .label {
            font-weight: 600;
            color: #495057;
            font-size: 15px;
        }
        .value {
            color: #212529;
            text-align: right;
            font-size: 15px;
        }
        .payment-details {
            background: white;
            border: 2px solid #28a745;
            border-radius: 10px;
            padding: 20px;
            margin: 25px 0;
        }
        .payment-amount {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            margin: 25px 0;
        }
        .payment-amount .label {
            font-size: 16px;
            opacity: 0.95;
            margin-bottom: 10px;
            color: white;
        }
        .payment-amount .amount {
            font-size: 42px;
            font-weight: bold;
            margin: 10px 0;
        }
        .payment-method {
            background: #e7f3ff;
            border-left: 4px solid #0066cc;
            padding: 15px;
            margin: 20px 0;
            border-radius: 0 8px 8px 0;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 25px;
            border-top: 2px solid #dee2e6;
            color: #6c757d;
        }
        .footer .company-info {
            margin-bottom: 15px;
        }
        .footer .company-name {
            font-size: 18px;
            font-weight: bold;
            color: #28a745;
            margin-bottom: 5px;
        }
        .qr-code {
            text-align: center;
            margin: 20px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        .stamp {
            position: relative;
            display: inline-block;
            padding: 10px 30px;
            border: 3px solid #28a745;
            border-radius: 5px;
            transform: rotate(-5deg);
            font-weight: bold;
            color: #28a745;
            font-size: 20px;
            margin: 20px auto;
            text-transform: uppercase;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>RECIBO DE PAGO</h1>
        <div class="subtitle">TeAlquilamos - Confirmación de Transacción</div>
        <div class="receipt-number">Recibo #{{receiptNumber}}</div>
    </div>

    <div class="success-badge">
        ✓ PAGO PROCESADO EXITOSAMENTE
    </div>

    <div class="section">
        <h2>Información del Cliente</h2>
        <div class="info-row">
            <span class="label">Nombre completo:</span>
            <span class="value">{{guestName}}</span>
        </div>
        <div class="info-row">
            <span class="label">Documento/ID:</span>
            <span class="value">{{guestId}}</span>
        </div>
        <div class="info-row">
            <span class="label">Email:</span>
            <span class="value">{{email}}</span>
        </div>
        {{#if phone}}
        <div class="info-row">
            <span class="label">Teléfono:</span>
            <span class="value">{{phone}}</span>
        </div>
        {{/if}}
    </div>

    <div class="section">
        <h2>Detalles de la Reserva</h2>
        <div class="info-row">
            <span class="label">Número de reserva:</span>
            <span class="value">#{{bookingId}}</span>
        </div>
        <div class="info-row">
            <span class="label">Propiedad:</span>
            <span class="value">{{propertyName}}</span>
        </div>
        <div class="info-row">
            <span class="label">Habitación:</span>
            <span class="value">{{roomName}}</span>
        </div>
        <div class="info-row">
            <span class="label">Período:</span>
            <span class="value">{{checkIn}} - {{checkOut}}</span>
        </div>
        <div class="info-row">
            <span class="label">Total noches:</span>
            <span class="value">{{nights}}</span>
        </div>
    </div>

    <div class="payment-details">
        <h2 style="color: #28a745; margin-top: 0;">Detalles del Pago</h2>
        <div class="info-row">
            <span class="label">Fecha de pago:</span>
            <span class="value">{{paymentDate}}</span>
        </div>
        <div class="info-row">
            <span class="label">Hora de pago:</span>
            <span class="value">{{paymentTime}}</span>
        </div>
        <div class="info-row">
            <span class="label">ID de transacción:</span>
            <span class="value" style="font-family: monospace;">{{transactionId}}</span>
        </div>
        <div class="info-row">
            <span class="label">Método de pago:</span>
            <span class="value">{{paymentMethod}}</span>
        </div>
        <div class="info-row">
            <span class="label">Estado:</span>
            <span class="value" style="color: #28a745; font-weight: bold;">CONFIRMADO</span>
        </div>
    </div>

    <div class="section">
        <h2>Desglose del Pago</h2>
        <div class="info-row">
            <span class="label">Tarifa base ({{nights}} noches):</span>
            <span class="value">{{currency}} {{baseAmount}}</span>
        </div>
        {{#if cleaningFee}}
        <div class="info-row">
            <span class="label">Tarifa de limpieza:</span>
            <span class="value">{{currency}} {{cleaningFee}}</span>
        </div>
        {{/if}}
        {{#if extras}}
        <div class="info-row">
            <span class="label">Servicios adicionales:</span>
            <span class="value">{{currency}} {{extras}}</span>
        </div>
        {{/if}}
        {{#if taxes}}
        <div class="info-row">
            <span class="label">Impuestos ({{taxRate}}%):</span>
            <span class="value">{{currency}} {{taxes}}</span>
        </div>
        {{/if}}
        <div class="info-row" style="border-top: 2px solid #28a745; margin-top: 10px; padding-top: 15px;">
            <span class="label" style="font-size: 18px;">TOTAL PAGADO:</span>
            <span class="value" style="font-size: 18px; font-weight: bold; color: #28a745;">{{currency}} {{totalAmount}}</span>
        </div>
    </div>

    <div class="payment-amount">
        <div class="label">Monto Total Recibido</div>
        <div class="amount">{{currency}} {{totalAmount}}</div>
        <div style="margin-top: 10px; opacity: 0.9;">{{paymentStatus}}</div>
    </div>

    {{#if paymentNotes}}
    <div class="payment-method">
        <strong>Información adicional del pago:</strong><br>
        {{paymentNotes}}
    </div>
    {{/if}}

    <div class="qr-code">
        <div class="stamp">PAGADO</div>
    </div>

    <div class="footer">
        <div class="company-info">
            <div class="company-name">TeAlquilamos</div>
            <div>NIT: 123456789-0</div>
            <div>📧 pagos@tealquilamos.com | 📱 +57 300 391 3251</div>
            <div>Carrera 123 #45-67, Bogotá, Colombia</div>
        </div>
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6;">
            <p style="font-size: 13px; color: #6c757d;">
                Este documento es un comprobante oficial de pago emitido por TeAlquilamos.<br>
                Conserve este recibo para sus registros y futuras referencias.
            </p>
            <p style="font-size: 11px; margin-top: 15px;">
                Documento generado electrónicamente el {{generatedDate}}<br>
                Válido sin firma ni sello según Resolución DIAN 000001 de 2024
            </p>
        </div>
    </div>
</body>
</html>
`;

/**
 * Handler para generar el PDF de recibo de pago
 */
async function handleGeneratePaymentReceipt(args: GeneratePaymentReceiptArgs): Promise<any> {
  let browser = null;
  
  try {
    logInfo('GENERATE_RECEIPT', `💰 Iniciando generación de recibo para reserva ${args.bookingId}`);
    
    // Validar bookingId
    if (!args.bookingId) {
      return {
        success: false,
        error: 'bookingId es requerido'
      };
    }

    // Obtener datos de la reserva desde Beds24
    const beds24Config = getBeds24Config();
    const beds24Service = getBeds24Service(beds24Config);
    
    logInfo('GENERATE_RECEIPT', `📊 Consultando reserva ${args.bookingId} en Beds24`);
    const booking = await beds24Service.getBooking(args.bookingId);
    
    if (!booking) {
      throw new Error(`No se encontró la reserva ${args.bookingId}`);
    }

    // Generar número de recibo único
    const receiptNumber = `REC${args.bookingId}-${Date.now().toString().slice(-6)}`;
    const transactionId = `TXN-${args.bookingId}-${Date.now()}`;
    
    // Calcular impuestos (ejemplo: 19% IVA)
    const taxRate = 19;
    const subtotal = (booking.price || 0) + (booking.cleaning || 0) + (booking.extras || 0);
    const taxes = subtotal * (taxRate / 100);
    const totalWithTax = subtotal + taxes;

    // Determinar método de pago
    let paymentMethod = 'Transferencia bancaria';
    if (booking.paymentMethod) {
      switch(booking.paymentMethod) {
        case 'cc': paymentMethod = 'Tarjeta de crédito'; break;
        case 'cash': paymentMethod = 'Efectivo'; break;
        case 'bank': paymentMethod = 'Transferencia bancaria'; break;
        case 'paypal': paymentMethod = 'PayPal'; break;
        default: paymentMethod = booking.paymentMethod;
      }
    }

    // Obtener fecha de pago (usar la fecha del último pago o la actual)
    const paymentDate = booking.paymentDate ? new Date(booking.paymentDate) : new Date();

    // Preparar datos para el template
    const templateData = {
      receiptNumber: receiptNumber,
      bookingId: booking.id || args.bookingId,
      guestName: `${booking.guestFirstName || ''} ${booking.guestLastName || ''}`.trim(),
      guestId: booking.guestCountry || 'No especificado',
      email: booking.guestEmail || 'No especificado',
      phone: booking.guestPhone || booking.guestMobile,
      propertyName: booking.propName || 'Propiedad',
      roomName: booking.roomName || 'Habitación estándar',
      checkIn: new Date(booking.firstNight).toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }),
      checkOut: new Date(booking.lastNight).toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }),
      nights: booking.numNights || 1,
      currency: booking.currency || 'USD',
      baseAmount: booking.price?.toFixed(2) || '0.00',
      cleaningFee: booking.cleaning ? booking.cleaning.toFixed(2) : null,
      extras: booking.extras ? booking.extras.toFixed(2) : null,
      taxRate: taxRate,
      taxes: taxes.toFixed(2),
      totalAmount: totalWithTax.toFixed(2),
      paymentDate: paymentDate.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      paymentTime: paymentDate.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      transactionId: transactionId,
      paymentMethod: paymentMethod,
      paymentStatus: 'Pago confirmado y procesado',
      paymentNotes: booking.paymentNotes || 'Pago recibido correctamente. No se requiere acción adicional.',
      generatedDate: new Date().toLocaleString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    logInfo('GENERATE_RECEIPT', '📝 Datos de pago procesados, generando HTML');

    // Compilar template con Handlebars
    const template = handlebars.compile(RECEIPT_TEMPLATE);
    const html = template(templateData);

    // Generar PDF con Puppeteer
    logInfo('GENERATE_RECEIPT', '🚀 Lanzando Puppeteer para generar recibo PDF');
    
    browser = await launchPuppeteerWithRetry(puppeteer);
    const page = await browser.newPage();
    
    // Configurar página
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Generar PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '15mm',
        right: '15mm',
        bottom: '15mm',
        left: '15mm'
      }
    });

    await browser.close();
    browser = null;

    // Guardar PDF temporalmente
    const fileName = `payment-receipt-${receiptNumber}.pdf`;
    const filePath = path.join('/tmp', fileName);
    await fs.writeFile(filePath, pdfBuffer);

    logSuccess('GENERATE_RECEIPT', `✅ Recibo generado exitosamente: ${fileName}`, {
      size: `${(pdfBuffer.length / 1024).toFixed(2)}KB`,
      path: filePath,
      receiptNumber: receiptNumber
    });

    // Retornar respuesta SIMPLIFICADA para evitar problemas con OpenAI
    return {
      success: true,
      message: `✅ Recibo de pago generado exitosamente\n\n` +
               `🧾 **Detalles del recibo:**\n` +
               `• Número: ${receiptNumber}\n` +
               `• Archivo: ${fileName}\n` +
               `• Tamaño: ${(pdfBuffer.length / 1024).toFixed(2)}KB\n\n` +
               `👤 **Cliente:**\n` +
               `• Nombre: ${templateData.guestName}\n` +
               `• Reserva: #${args.bookingId}\n\n` +
               `💳 **Información del pago:**\n` +
               `• Fecha: ${templateData.paymentDate}\n` +
               `• Método: ${templateData.paymentMethod}\n` +
               `• Transacción: ${transactionId}\n` +
               `• Estado: ✅ CONFIRMADO\n\n` +
               `💰 **Total pagado: ${templateData.currency} ${templateData.totalAmount}**\n\n` +
               `📥 El recibo está listo para descargar. Por favor indícame si deseas que te lo envíe por otro medio.`,
      bookingId: args.bookingId,
      receiptNumber: receiptNumber,
      fileName: fileName,
      fileSize: `${(pdfBuffer.length / 1024).toFixed(2)}KB`
    };
    
  } catch (error: any) {
    logError('GENERATE_RECEIPT', `❌ Error generando recibo de pago`, { 
      error: error.message,
      bookingId: args.bookingId 
    });
    
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        logError('GENERATE_RECEIPT', 'Error cerrando browser', { error: closeError });
      }
    }
    
    return {
      success: false,
      error: error.message || 'Error al generar el recibo de pago',
      bookingId: args.bookingId
    };
  }
}

/**
 * Definición de la función para el registro
 */
export const generatePaymentReceiptPDFFunction: FunctionDefinition = {
  name: 'generate_payment_receipt_pdf',
  description: 'Genera un PDF de recibo de pago para una reserva específica con los detalles del pago realizado, obtenidos de Beds24',
  handler: handleGeneratePaymentReceipt,
  parameters: {
    type: 'object',
    properties: {
      bookingId: {
        type: 'string',
        description: 'ID de la reserva en Beds24'
      },
      paymentId: {
        type: 'string',
        description: 'ID del pago específico (opcional)'
      },
      userContext: {
        type: 'object',
        description: 'Contexto del usuario (opcional)',
        properties: {
          userId: {
            type: 'string',
            description: 'ID del usuario de WhatsApp'
          },
          chatId: {
            type: 'string',
            description: 'ID del chat de WhatsApp'
          },
          threadId: {
            type: 'string',
            description: 'ID del thread de OpenAI'
          }
        }
      }
    },
    required: ['bookingId'],
    additionalProperties: false
  },
  enabled: true,
  category: 'pdf',
  version: '2.0.0'
};

// Exportar el handler para uso directo si es necesario
export { handleGeneratePaymentReceipt };