// src/plugins/hotel/services/pdf-generator.service.ts
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { PDFDocument } from 'pdf-lib';
import Handlebars from 'handlebars';
import { logInfo, logError, logSuccess } from '../../../utils/logging';

export interface InvoiceData {
  bookingId: string;
  guestName: string;
  guestCount: string;
  phone?: string;
  email: string;
  checkInDate: string;
  checkOutDate: string;
  roomName: string;
  aptDescription?: string; // Nueva descripción del apartamento variable desde JSON
  distribucion?: string; // Distribución de camas enviada por OpenAI
  nights?: number; // OPCIONAL - se calcula automáticamente si no viene
  bookingStatus?: string; // Ya no se usa, mantenido por compatibilidad
  statusClass?: string; // Ya no se usa, mantenido por compatibilidad
  totalCharges: string;
  totalPaid?: string;
  balance?: string;
  invoiceItems: InvoiceItem[];
  documentType: string; // Ya no se usa, mantenido por compatibilidad
  triggerFunction: string;
}

export interface InvoiceItem {
  description: string;
  quantity: string;
  unitPrice: string;
  totalAmount: string;
}

export interface PDFResult {
  success: boolean;
  pdfPath?: string;
  pdfBuffer?: Buffer;
  error?: string;
  size?: number;
}

export class PDFGeneratorService {
  private templatePath: string;
  private configPath: string;
  private templateCache: string | null = null;
  private compiledTemplate: HandlebarsTemplateDelegate | null = null;
  private configCache: any | null = null;
  private browser: puppeteer.Browser | null = null;

  constructor() {
    this.templatePath = path.join(__dirname, '../functions/generate-invoice-pdf/templates/invoice-template.html');
    this.configPath = path.join(__dirname, '../functions/generate-invoice-pdf/config/invoice-config.json');
    this.initializeHandlebars();
  }

  /**
   * Inicializa helpers de Handlebars
   */
  private initializeHandlebars() {
    // Helper para condicionales
    Handlebars.registerHelper('if', function(conditional, options) {
      if (conditional) {
        return options.fn(this);
      } else {
        return options.inverse(this);
      }
    });

    // Helper para loops
    Handlebars.registerHelper('each', function(context, options) {
      if (Array.isArray(context)) {
        return context.map(item => options.fn(item)).join('');
      }
      return '';
    });

    // Helper para formateo de moneda
    Handlebars.registerHelper('currency', function(amount) {
      return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
      }).format(Number(amount.replace(/[^\d.-]/g, '')) || 0);
    });

    // Helper para formateo de fechas
    Handlebars.registerHelper('formatDate', function(dateStr, format) {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      switch (format) {
        case 'short':
          return date.toLocaleDateString('es-CO', { month: 'short', day: 'numeric' });
        case 'long':
          return date.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
        default:
          return date.toLocaleDateString('es-CO');
      }
    });
  }

  /**
   * Inicializa navegador Puppeteer para reutilización (mejora rendimiento 5x)
   */
  private async initializeBrowser(): Promise<void> {
    if (!this.browser) {
      logInfo('PDF_GENERATOR', 'Inicializando navegador Puppeteer...');
      
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          // 🎯 Mejorar nitidez de fuentes para PDF de alta calidad
          '--font-render-hinting=medium'
        ]
      });
      
      logSuccess('PDF_GENERATOR', '🚀 Navegador Puppeteer inicializado y reutilizable');
    }
  }

  /**
   * Verifica salud del navegador y lo reinicia si es necesario (Auto-Healing)
   */
  private async ensureBrowserHealth(): Promise<void> {
    // Si no hay navegador, inicializar
    if (!this.browser) {
      await this.initializeBrowser();
      return;
    }

    try {
      // Verificar si el navegador sigue conectado
      if (!this.browser.isConnected()) {
        logInfo('PDF_GENERATOR', '⚠️ Navegador desconectado, reiniciando...');
        await this.browser.close();
        this.browser = null;
        await this.initializeBrowser();
        logSuccess('PDF_GENERATOR', '🔄 Navegador reiniciado exitosamente');
      }
    } catch (error) {
      logError('PDF_GENERATOR', `⚠️ Error verificando navegador, reiniciando: ${error}`);
      try {
        if (this.browser) {
          await this.browser.close();
        }
      } catch (closeError) {
        logError('PDF_GENERATOR', `Error cerrando navegador dañado: ${closeError}`);
      }
      this.browser = null;
      await this.initializeBrowser();
      logSuccess('PDF_GENERATOR', '🔄 Navegador recuperado exitosamente');
    }
  }

  /**
   * Cierra navegador Puppeteer (llamar al terminar aplicación)
   */
  public async closeBrowser(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
        logInfo('PDF_GENERATOR', 'Navegador Puppeteer cerrado correctamente');
      } catch (error) {
        logError('PDF_GENERATOR', `Error cerrando navegador: ${error}`);
      } finally {
        this.browser = null;
      }
    }
  }

  /**
   * Genera PDF a partir de datos de factura (con validación centralizada)
   */
  async generateInvoicePDF(data: InvoiceData, options: {
    saveToFile?: boolean;
    outputDir?: string;
  } = {}): Promise<PDFResult> {
    
    logInfo('PDF_GENERATOR', `Generando PDF para reserva: ${data.bookingId}`);

    try {
      // 1. VALIDACIÓN CENTRALIZADA (elimina duplicación)
      const validationErrors = this.validateInvoiceData(data);
      if (validationErrors.length > 0) {
        logError('PDF_GENERATOR', `❌ Validación centralizada fallida: ${validationErrors.join(', ')}`);
        return {
          success: false,
          error: `Parámetros inválidos: ${validationErrors.join(', ')}`
        };
      }

      // 2. Cargar template HTML
      const htmlTemplate = await this.loadTemplate();
      
      // 2. Procesar datos y reemplazar placeholders
      const processedHtml = await this.processTemplate(htmlTemplate, data);
      
      // 3. Generar PDF con Puppeteer
      const pdfResult = await this.generatePDFFromHTML(processedHtml, data.bookingId, options);
      
      logSuccess('PDF_GENERATOR', `PDF generado exitosamente: ${pdfResult.size} bytes`);
      
      return pdfResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      logError('PDF_GENERATOR', `Error generando PDF: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Carga el template HTML desde archivo (con cache)
   */
  public async loadTemplate(): Promise<string> {
    try {
      // Usar cache si está disponible
      if (this.templateCache) {
        return this.templateCache;
      }

      if (!fs.existsSync(this.templatePath)) {
        throw new Error(`Template no encontrado: ${this.templatePath}`);
      }

      // Cargar y cachear template
      this.templateCache = fs.readFileSync(this.templatePath, 'utf-8');
      return this.templateCache;
    } catch (error) {
      throw new Error(`Error cargando template: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  /**
   * Carga configuración JSON desde archivo (con cache)
   */
  private async loadConfig(): Promise<any> {
    try {
      // Usar cache si está disponible
      if (this.configCache) {
        return this.configCache;
      }

      if (!fs.existsSync(this.configPath)) {
        throw new Error(`Configuración no encontrada: ${this.configPath}`);
      }

      // Cargar y cachear configuración
      const configContent = fs.readFileSync(this.configPath, 'utf-8');
      this.configCache = JSON.parse(configContent);
      
      logInfo('PDF_GENERATOR', `Configuración cargada desde: ${this.configPath}`);
      return this.configCache;
    } catch (error) {
      throw new Error(`Error cargando configuración: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  /**
   * Procesa template usando Handlebars con datos de configuración JSON
   */
  public async processTemplate(template: string, data: InvoiceData): Promise<string> {
    try {
      // Pre-compilar template si no está en cache
      if (!this.compiledTemplate) {
        this.compiledTemplate = Handlebars.compile(template);
      }

      // Cargar configuración JSON
      const config = await this.loadConfig();

      // Calcular noches automáticamente si no vienen en el JSON
      const calculatedNights = data.nights || this.calculateNights(data.checkInDate, data.checkOutDate);

      // Determinar tipo de documento
      const templateTitle = config.template.documentTypes[data.triggerFunction] || config.template.documentTypes.default;

      // Preparar contexto combinando datos de OpenAI + configuración JSON
      const context = {
        // DATOS DE OPENAI (variables)
        ...data,
        nights: calculatedNights,
        checkInDateFormatted: this.formatDateShort(data.checkInDate),
        checkOutDateFormatted: this.formatDateShort(data.checkOutDate),
        multipleNights: calculatedNights > 1,
        paymentNote: this.getPaymentNote(data, config),

        // DATOS DE EMPRESA (desde JSON)
        companyName: config.company.name,
        companyNit: config.company.nit,
        companyAddress: config.company.address,
        companyPhone: config.company.phone,
        companyEmail: config.company.email,
        companyWebsite: config.company.website,
        companyLogo: config.company.logo,

        // TEMPLATE CONFIG
        templateTitle,

        // POLÍTICAS (desde JSON)
        checkInTime: config.policies.checkIn.time,
        checkInNote: config.policies.checkIn.note,
        checkOutTime: config.policies.checkOut.time,
        checkOutNote: config.policies.checkOut.note,
        cancellationPolicy: config.policies.cancellation,
        servicesNote: config.policies.services,

        // ÍCONOS (SVGs desde configuración)
        calendarIcon: config.icons.sections.dates,
        guestIcon: config.icons.sections.guest,
        paymentIcon: config.icons.sections.payment,
        policiesIcon: config.icons.sections.policies,
        infoIcon: config.icons.sections.info,
        phoneIcon: config.icons.contact.phone,
        emailIcon: config.icons.contact.email,
        websiteIcon: config.icons.contact.website,

        // FECHA ACTUAL - Removido porque no se usa en el template
        // currentDate: new Intl.DateTimeFormat(...)
      };

      return this.compiledTemplate(context);
    } catch (error) {
      logError('PDF_GENERATOR', `Error procesando template: ${error}`);
      throw error;
    }
  }

  // generateLocalQR removido - ya no se usa QR en el template

  /**
   * Calcula número de noches entre fechas automáticamente
   */
  private calculateNights(checkInDate: string, checkOutDate: string): number {
    try {
      const checkIn = new Date(checkInDate);
      const checkOut = new Date(checkOutDate);
      
      // Calcular diferencia en milisegundos y convertir a días
      const timeDiff = checkOut.getTime() - checkIn.getTime();
      const nights = Math.ceil(timeDiff / (1000 * 3600 * 24));
      
      logInfo('PDF_GENERATOR', `Noches calculadas automáticamente: ${nights} (${checkInDate} → ${checkOutDate})`);
      return nights > 0 ? nights : 1; // Mínimo 1 noche
    } catch (error) {
      logError('PDF_GENERATOR', `Error calculando noches: ${error}`);
      return 1; // Fallback a 1 noche
    }
  }

  /**
   * Genera PDF usando Puppeteer (OPTIMIZADO con Auto-Healing)
   */
  private async generatePDFFromHTML(html: string, bookingId: string, options: {
    saveToFile?: boolean;
    outputDir?: string;
  }): Promise<PDFResult> {
    
    try {
      // 🔍 AUTO-HEALING: Verificar salud del navegador
      await this.ensureBrowserHealth();
      
      const page = await this.browser!.newPage();
      
      // Configurar viewport optimizado para PDF compacto
      await page.setViewport({
        width: 794,  // A4 width en pixels (210mm)
        height: 1123, // A4 height en pixels (297mm)
        deviceScaleFactor: 1 // Reducido para mejor fit
      });

      // Activar modo print para mejores estilos CSS @media print
      await page.emulateMediaType('print');

      // Cargar HTML
      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      // Generar PDF con configuración optimizada para una página oficio
      const pdfBuffer = await page.pdf({
        format: 'Legal', // Formato oficio (8.5" x 14") - más espacio que A4
        printBackground: true,
        margin: {
          top: '0.6cm',    // Margen superior reducido
          right: '0.8cm',
          bottom: '0.6cm', // Margen inferior reducido
          left: '0.8cm'
        },
        preferCSSPageSize: true, // Usar configuración CSS @page
        scale: 1, // 🎯 Resolución nativa para máxima nitidez
        // HABILITADO: Generar todas las páginas necesarias (sin limitación)
        displayHeaderFooter: false // No mostrar headers/footers del browser
      });

      // HABILITADO: Validación de múltiples páginas (máximo 3)
      await this.validatePageCount(pdfBuffer, bookingId, 3);
      logInfo('PDF_GENERATOR', `PDF generado con múltiples páginas permitidas (máximo 3)`, { bookingId });

      const result: PDFResult = {
        success: true,
        pdfBuffer,
        size: pdfBuffer.length
      };

      // Guardar archivo si se solicita
      if (options.saveToFile) {
        const outputDir = options.outputDir || path.join(__dirname, '../../../temp/pdfs');
        
        // Crear directorio si no existe
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const filename = `invoice-${bookingId}-${Date.now()}.pdf`;
        const filepath = path.join(outputDir, filename);
        
        fs.writeFileSync(filepath, pdfBuffer);
        result.pdfPath = filepath;
        
        logInfo('PDF_GENERATOR', `PDF guardado en: ${filepath}`);
      }

      return result;

    } catch (error) {
      throw error;
    } finally {
      // 🚀 SOLO cerrar página, mantener navegador vivo para próximas solicitudes
      if (this.browser) {
        const pages = await this.browser.pages();
        // Cerrar todas las páginas que no sean la primera (about:blank)
        for (let i = 1; i < pages.length; i++) {
          await pages[i].close();
        }
      }
    }
  }

  /**
   * Formatea fecha para mostrar
   */
  private formatDate(dateStr: string): string {
    if (!dateStr) return '';
    
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }

  /**
   * Determina la nota de pago según el estado
   */
  private getPaymentNote(data: InvoiceData, config: any): string {
    if (data.totalPaid && data.balance && data.balance !== '$0 COP') {
      return config.policies.paymentNotes.balance_pending;
    }
    if (data.totalPaid && (!data.balance || data.balance === '$0 COP')) {
      return config.policies.paymentNotes.full_payment;
    }
    if (data.totalPaid && data.balance) {
      return config.policies.paymentNotes.partial_payment;
    }
    return '';
  }

  /**
   * Formatea fecha corta para el nuevo template
   */
  private formatDateShort(dateStr: string): string {
    if (!dateStr) return '';
    
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-CO', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }

  /**
   * Valida que el PDF generado no excede el límite de páginas
   */
  private async validatePageCount(pdfBuffer: Buffer, bookingId: string, maxPages: number = 3): Promise<void> {
    try {
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const pageCount = pdfDoc.getPageCount();
      
      if (pageCount > maxPages) {
        logError('PDF_GENERATOR', `⚠️ PDF excede límite: ${pageCount} páginas (máximo: ${maxPages}) para reserva ${bookingId}`);
        // No fallar, solo alertar - permitir múltiples páginas hasta el límite
      } else {
        logSuccess('PDF_GENERATOR', `✅ PDF generado con ${pageCount} página${pageCount > 1 ? 's' : ''} (límite: ${maxPages}) para reserva ${bookingId}`);
      }
    } catch (error) {
      logError('PDF_GENERATOR', `Error validando páginas PDF: ${error}`);
    }
  }

  /**
   * Valida datos de entrada
   */
  public validateInvoiceData(data: Partial<InvoiceData>): string[] {
    const errors: string[] = [];

    if (!data.bookingId) errors.push('bookingId es requerido');
    if (!data.guestName) errors.push('guestName es requerido');
    if (!data.email) errors.push('email es requerido');
    if (!data.checkInDate) errors.push('checkInDate es requerido');
    if (!data.checkOutDate) errors.push('checkOutDate es requerido');
    if (!data.roomName) errors.push('roomName es requerido');
    if (!data.totalCharges) errors.push('totalCharges es requerido');
    if (!Array.isArray(data.invoiceItems) || data.invoiceItems.length === 0) {
      errors.push('invoiceItems debe ser un array no vacío');
    }
    // aptDescription es opcional, no se valida

    return errors;
  }

  /**
   * Limpia cache y opcionalmente cierra navegador (útil para desarrollo)
   */
  public async clearCache(closeBrowser: boolean = false): Promise<void> {
    this.templateCache = null;
    this.compiledTemplate = null;
    this.configCache = null;
    
    if (closeBrowser) {
      await this.closeBrowser();
    }
    
    logInfo('PDF_GENERATOR', `Cache limpiado (template + configuración${closeBrowser ? ' + navegador' : ''})`);
  }
}