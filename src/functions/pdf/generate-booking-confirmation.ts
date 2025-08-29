/**
 * Función para generar PDF de confirmación de reserva
 * Genera un documento PDF con los detalles de una reserva específica
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
interface GenerateBookingConfirmationArgs {
  bookingId: string;
  userContext?: {
    userId?: string;
    chatId?: string;
    threadId?: string;
  };
}

/**
 * Template HTML para el PDF de confirmación
 */
const CONFIRMATION_TEMPLATE = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirmación de Reserva - TeAlquilamos</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 40px;
            background: white;
            color: #333;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
        }
        .header p {
            margin: 5px 0 0 0;
            opacity: 0.9;
        }
        .booking-id {
            background: rgba(255,255,255,0.2);
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            margin-top: 10px;
        }
        .section {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .section h2 {
            color: #667eea;
            margin-top: 0;
            font-size: 20px;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e0e0e0;
        }
        .info-row:last-child {
            border-bottom: none;
        }
        .label {
            font-weight: 600;
            color: #555;
        }
        .value {
            color: #333;
            text-align: right;
        }
        .total-amount {
            background: #667eea;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            text-align: center;
            margin-top: 20px;
        }
        .total-amount .amount {
            font-size: 32px;
            font-weight: bold;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #e0e0e0;
            color: #666;
        }
        .important-note {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Confirmación de Reserva</h1>
        <p>TeAlquilamos - Tu hogar lejos de casa</p>
        <div class="booking-id">Reserva #{{bookingId}}</div>
    </div>

    <div class="section">
        <h2>Información del Huésped</h2>
        <div class="info-row">
            <span class="label">Nombre:</span>
            <span class="value">{{guestName}}</span>
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
        <div class="info-row">
            <span class="label">Huéspedes:</span>
            <span class="value">{{numAdults}} adultos{{#if numChildren}}, {{numChildren}} niños{{/if}}</span>
        </div>
    </div>

    <div class="section">
        <h2>Detalles de la Estancia</h2>
        <div class="info-row">
            <span class="label">Propiedad:</span>
            <span class="value">{{propertyName}}</span>
        </div>
        <div class="info-row">
            <span class="label">Habitación:</span>
            <span class="value">{{roomName}}</span>
        </div>
        <div class="info-row">
            <span class="label">Check-in:</span>
            <span class="value">{{checkIn}}</span>
        </div>
        <div class="info-row">
            <span class="label">Check-out:</span>
            <span class="value">{{checkOut}}</span>
        </div>
        <div class="info-row">
            <span class="label">Noches:</span>
            <span class="value">{{nights}}</span>
        </div>
    </div>

    <div class="section">
        <h2>Resumen de Pago</h2>
        <div class="info-row">
            <span class="label">Precio por noche:</span>
            <span class="value">{{currency}} {{pricePerNight}}</span>
        </div>
        <div class="info-row">
            <span class="label">Total noches:</span>
            <span class="value">{{currency}} {{totalNights}}</span>
        </div>
        {{#if cleaningFee}}
        <div class="info-row">
            <span class="label">Limpieza:</span>
            <span class="value">{{currency}} {{cleaningFee}}</span>
        </div>
        {{/if}}
        {{#if extras}}
        <div class="info-row">
            <span class="label">Extras:</span>
            <span class="value">{{currency}} {{extras}}</span>
        </div>
        {{/if}}
    </div>

    <div class="total-amount">
        <div>Total a Pagar</div>
        <div class="amount">{{currency}} {{totalAmount}}</div>
    </div>

    {{#if notes}}
    <div class="important-note">
        <strong>Notas importantes:</strong><br>
        {{notes}}
    </div>
    {{/if}}

    <div class="footer">
        <p><strong>TeAlquilamos</strong></p>
        <p>📧 info@tealquilamos.com | 📱 +57 300 391 3251</p>
        <p>Gracias por elegir TeAlquilamos. ¡Te esperamos!</p>
        <p style="font-size: 12px; margin-top: 20px;">
            Documento generado el {{generatedDate}}
        </p>
    </div>
</body>
</html>
`;

/**
 * Handler para generar el PDF de confirmación
 */
async function handleGenerateBookingConfirmation(args: GenerateBookingConfirmationArgs): Promise<any> {
  let browser = null;
  
  try {
    logInfo('GENERATE_PDF', `🚀 Iniciando generación PDF para reserva ${args.bookingId}`);
    
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
    
    logInfo('GENERATE_PDF', `📊 Consultando reserva ${args.bookingId} en Beds24`);
    const booking = await beds24Service.getBooking(args.bookingId);
    
    if (!booking) {
      throw new Error(`No se encontró la reserva ${args.bookingId}`);
    }

    // Preparar datos para el template
    const templateData = {
      bookingId: booking.id || args.bookingId,
      guestName: `${booking.guestFirstName || ''} ${booking.guestLastName || ''}`.trim(),
      email: booking.guestEmail || 'No especificado',
      phone: booking.guestPhone || booking.guestMobile,
      numAdults: booking.numAdult || 1,
      numChildren: booking.numChild || 0,
      propertyName: booking.propName || 'Propiedad',
      roomName: booking.roomName || 'Habitación estándar',
      checkIn: new Date(booking.firstNight).toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      checkOut: new Date(booking.lastNight).toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      nights: booking.numNights || 1,
      currency: booking.currency || 'USD',
      pricePerNight: (booking.price / (booking.numNights || 1)).toFixed(2),
      totalNights: booking.price?.toFixed(2) || '0.00',
      cleaningFee: booking.cleaning || 0,
      extras: booking.extras || 0,
      totalAmount: (
        (booking.price || 0) + 
        (booking.cleaning || 0) + 
        (booking.extras || 0)
      ).toFixed(2),
      notes: booking.notes || '',
      generatedDate: new Date().toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    logInfo('GENERATE_PDF', '📝 Datos de reserva procesados, generando HTML');

    // Compilar template con Handlebars
    const template = handlebars.compile(CONFIRMATION_TEMPLATE);
    const html = template(templateData);

    // Generar PDF con Puppeteer
    logInfo('GENERATE_PDF', '🚀 Lanzando Puppeteer para generar PDF');
    
    browser = await launchPuppeteerWithRetry(puppeteer);
    const page = await browser.newPage();
    
    // Configurar página
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Generar PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      }
    });

    await browser.close();
    browser = null;

    // Guardar PDF temporalmente
    const fileName = `booking-confirmation-${args.bookingId}.pdf`;
    const filePath = path.join('/tmp', fileName);
    await fs.writeFile(filePath, pdfBuffer);

    logSuccess('GENERATE_PDF', `✅ PDF generado exitosamente: ${fileName}`, {
      size: `${(pdfBuffer.length / 1024).toFixed(2)}KB`,
      path: filePath
    });

    return {
      success: true,
      message: `PDF de confirmación generado exitosamente para la reserva ${args.bookingId}`,
      bookingId: args.bookingId,
      guestName: templateData.guestName,
      fileName: fileName,
      filePath: filePath,
      fileSize: `${(pdfBuffer.length / 1024).toFixed(2)}KB`,
      pdfBuffer: pdfBuffer.toString('base64'), // Para enviar por WhatsApp
      details: {
        checkIn: templateData.checkIn,
        checkOut: templateData.checkOut,
        nights: templateData.nights,
        totalAmount: `${templateData.currency} ${templateData.totalAmount}`,
        property: templateData.propertyName,
        room: templateData.roomName
      }
    };
    
  } catch (error: any) {
    logError('GENERATE_PDF', `❌ Error generando PDF de confirmación`, { 
      error: error.message,
      bookingId: args.bookingId 
    });
    
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        logError('GENERATE_PDF', 'Error cerrando browser', { error: closeError });
      }
    }
    
    return {
      success: false,
      error: error.message || 'Error al generar el PDF de confirmación',
      bookingId: args.bookingId
    };
  }
}

/**
 * Definición de la función para el registro
 */
export const generateBookingConfirmationPDFFunction: FunctionDefinition = {
  name: 'generate_booking_confirmation_pdf',
  description: 'Genera un PDF de confirmación para una reserva específica con todos los detalles del booking obtenidos de Beds24',
  handler: handleGenerateBookingConfirmation,
  parameters: {
    type: 'object',
    properties: {
      bookingId: {
        type: 'string',
        description: 'ID de la reserva en Beds24'
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
export { handleGenerateBookingConfirmation };