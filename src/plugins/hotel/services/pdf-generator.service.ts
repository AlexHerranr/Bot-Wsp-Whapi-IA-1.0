// src/plugins/hotel/services/pdf-generator.service.ts
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
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
  paymentItems?: PaymentItem[];  // AÑADIDO: Soporte para items de pago separados
  documentType: string; // Ya no se usa, mantenido por compatibilidad
  triggerFunction: string;
}

export interface InvoiceItem {
  description: string;
  quantity: string;
  unitPrice: string;
  totalAmount: string;
}

export interface PaymentItem {
  description: string;
  amount: number;
  formattedAmount: string;
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
  private browser: any | null = null;

  constructor() {
    // SMART PATH: Detectar si estamos en build (dist/) o desarrollo (src/)
    const isBuilt = fs.existsSync(path.join(process.cwd(), 'dist'));
    const baseDir = isBuilt ? 'dist' : 'src';
    
    this.templatePath = path.join(process.cwd(), `${baseDir}/plugins/hotel/functions/generate-booking-confirmation-pdf/templates/invoice-template.html`);
    this.configPath = path.join(process.cwd(), `${baseDir}/plugins/hotel/functions/generate-booking-confirmation-pdf/config/invoice-config.json`);
    
    logInfo('PDF_GENERATOR', `📁 Base directory: ${baseDir}/ (built: ${isBuilt})`);
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
      
      // Detectar si estamos en Railway y agregar configuraciones específicas
      const isRailway = process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_ENVIRONMENT_NAME;
      
      const browserArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=medium'
      ];

      // Variable para path de Chrome en Railway
      let foundChromePath = null;
      
      // Configuraciones adicionales para Railway
      if (isRailway) {
        browserArgs.push(
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--disable-web-security',
          '--no-first-run',
          '--no-default-browser-check',
          '--single-process', // Crucial para Railway - evita problemas de memoria compartida
          '--disable-extensions',
          '--no-sandbox', // CRÍTICO para contenedores - Chrome/Chromium requiere este flag
          '--disable-setuid-sandbox', // Complementario para seguridad en contenedores
          '--disable-dev-shm-usage', // Evita issues de memoria compartida en Docker
          '--disable-background-networking',
          '--disable-default-apps',
          '--disable-sync',
          '--disable-translate',
          '--hide-scrollbars',
          '--metrics-recording-only',
          '--mute-audio',
          '--no-first-run',
          '--safebrowsing-disable-auto-update',
          '--ignore-certificate-errors',
          '--ignore-ssl-errors',
          '--ignore-certificate-errors-spki-list',
          '--disable-crash-reporter', // Deshabilita crashpad_handler
          '--disable-breakpad', // Deshabilita crash reporting  
          '--crash-dumps-dir=/tmp', // Directorio temporal para evitar error database
          '--enable-logging=stderr', // Redirige logs a stderr
          '--disable-logging-redirect',
          // FLAGS ESPECÍFICOS ANTI-CRASHPAD - SOLUCIÓN DEFINITIVA
          '--disable-crashpad', // Deshabilita sistema crashpad completamente
          '--no-crash-upload', // No subir crash reports
          '--disable-crash-uploads', // Bloquea uploads de crashes
          '--disable-ipc-flooding-protection', // Evita issues IPC relacionados con crashpad
          '--disable-client-side-phishing-detection',
          '--disable-component-update',
          '--disable-domain-reliability',
          // FLAGS ANTI-FONTCONFIG - Eliminar warnings en Railway
          '--font-render-hinting=none',
          '--disable-font-subpixel-positioning'
        );
        logInfo('PDF_GENERATOR', '🚀 Railway detectado - usando Puppeteer bundled Chromium (versión matching)');
      }
      
      // SPARTICUZ CHROMIUM FIX: Usar Chromium serverless optimizado para Railway
      let executablePath: string;
      let chromiumArgs: string[] = [];
      
      if (isRailway) {
        // En Railway, usar @sparticuz/chromium optimizado para contenedores
        try {
          executablePath = await chromium.executablePath();
          chromiumArgs = chromium.args;
          logInfo('PDF_GENERATOR', `🎯 SPARTICUZ: Chromium path: ${executablePath}`);
          logInfo('PDF_GENERATOR', `🎯 SPARTICUZ: Extra args: ${chromiumArgs.length} args`);
        } catch (pathError) {
          logError('PDF_GENERATOR', `⚠️ Error obteniendo Sparticuz Chromium: ${pathError.message}`);
          throw new Error(`Sparticuz Chromium failed: ${pathError.message}`);
        }
      } else {
        // En local, usar Puppeteer normal
        executablePath = puppeteer.executablePath();
      }

      const launchOptions = {
        headless: 'shell' as const, // Optimizado para serverless
        args: [...browserArgs, ...chromiumArgs], // Combinar args propios + sparticuz
        executablePath: executablePath,
        ...(isRailway && {
          timeout: 60000,
          handleSIGINT: false,
          handleSIGTERM: false,
          handleSIGHUP: false,
          dumpio: true // Debug output para Railway
        })
      };

      if (isRailway) {
        logInfo('PDF_GENERATOR', `🚀 Lanzando Chromium con opciones: ${JSON.stringify(launchOptions)}`);
      }

      try {
        logInfo('PDF_GENERATOR', '🔍 DEBUGGING: Iniciando puppeteer.launch() con options:', launchOptions);
        this.browser = await puppeteer.launch(launchOptions);
        logSuccess('PDF_GENERATOR', '✅ Puppeteer bundled browser launched successfully');
      } catch (launchError) {
        // Log específico con stack trace completo para debugging
        logError('PDF_GENERATOR', `⚠️ Launch FAILED - ERROR COMPLETO:`, {
          isRailway,
          errorMessage: launchError.message,
          errorType: launchError.constructor.name,
          errorStack: launchError.stack,
          launchOptionsUsed: JSON.stringify(launchOptions)
        });
        
        // DEBUGGING: Log directo a console para evitar truncado
        console.error('🔴 PUPPETEER ERROR COMPLETO:');
        console.error('Message:', launchError.message);
        console.error('Stack:', launchError.stack);
        console.error('Type:', launchError.constructor.name);
        console.error('Options used:', JSON.stringify(launchOptions, null, 2));
        
        // Re-try más simple sin opciones extra si es Railway
        if (isRailway) {
          logInfo('PDF_GENERATOR', '🔄 DEBUGGING: Iniciando retry con opciones ultra-básicas...');
          
          const retryOptions = {
            headless: 'shell' as const,
            executablePath: executablePath, // Usar mismo path de sparticuz
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox', 
              '--disable-dev-shm-usage'
            ]
          };
          
          logInfo('PDF_GENERATOR', '🔍 RETRY OPTIONS:', retryOptions);
          
          try {
            this.browser = await puppeteer.launch(retryOptions);
            logSuccess('PDF_GENERATOR', '✅ RETRY EXITOSO - Browser lanzado con opciones básicas');
          } catch (retryError) {
            logError('PDF_GENERATOR', `❌ RETRY TAMBIÉN FALLÓ:`, {
              retryErrorMessage: retryError.message,
              retryErrorStack: retryError.stack,
              retryOptionsUsed: JSON.stringify(retryOptions)
            });
            
            // DEBUGGING: Log directo del retry error
            console.error('🔴 RETRY ERROR COMPLETO:');
            console.error('Retry Message:', retryError.message);
            console.error('Retry Stack:', retryError.stack);
            console.error('Retry Options:', JSON.stringify(retryOptions, null, 2));
            
            throw retryError; // Re-throw el error del retry
          }
        } else {
          throw launchError; // Re-throw en local
        }
      }
      
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
      // SOLUCIÓN DEFINITIVA: No usar isConnected() que puede causar connect()
      // Test directo con pages() - si falla, el browser está roto
      const pages = await this.browser.pages();
      logInfo('PDF_GENERATOR', `✅ Browser healthy - ${pages.length} pages activas`);
    } catch (error) {
      // Si pages() falla, el browser está roto - relanzar con launch()
      logInfo('PDF_GENERATOR', `⚠️ Browser no healthy - relanzando: ${error.message}`);
      try {
        if (this.browser) await this.browser.close().catch(() => {});
      } catch (closeError) {
        logError('PDF_GENERATOR', `Error cerrando browser: ${closeError.message}`);
      }
      
      this.browser = null;
      await this.initializeBrowser();  // Relanza con launch, NUNCA connect
      logSuccess('PDF_GENERATOR', '🔄 Browser relanzado exitosamente');
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

      // 2. Cargar template HTML según el tipo de documento
      const htmlTemplate = await this.loadTemplate(data.documentType);
      
      // 2. Procesar datos y reemplazar placeholders
      const processedHtml = await this.processTemplate(htmlTemplate, data);
      
      // 3. Generar PDF con Puppeteer - RAILWAY OPTIMIZADO
      const isRailway = process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_ENVIRONMENT_NAME;
      
      // En Railway, evitar guardar archivo por defecto (FS efímero)
      const railwayOptions = isRailway ? {
        ...options,
        saveToFile: process.env.SAVE_PDFS !== 'false' ? options.saveToFile : false // Opcional en Railway
      } : options;
      
      const pdfResult = await this.generatePDFFromHTML(processedHtml, data.bookingId, railwayOptions);
      
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
  public async loadTemplate(documentType?: string): Promise<string> {
    try {
      // RAILWAY FIX: Determinar el path del template con rutas absolutas
      let templatePath = this.templatePath;
      
      if (documentType === 'RECIBO DE PAGO') {
        const isBuilt = fs.existsSync(path.join(process.cwd(), 'dist'));
        const baseDir = isBuilt ? 'dist' : 'src';
        templatePath = path.join(process.cwd(), `${baseDir}/plugins/hotel/functions/generate-payment-receipt-pdf/templates/receipt-template.html`);
        logInfo('PDF_GENERATOR', `📄 Usando template de recibo: ${templatePath} (baseDir: ${baseDir})`);
      }
      
      // RAILWAY DEBUG: Log path absoluto para debugging
      const isRailway = process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_ENVIRONMENT_NAME;
      if (isRailway) {
        logInfo('TEMPLATE_PATH_RAILWAY', 'Verificando template path en Railway', {
          templatePath,
          documentType,
          processDir: process.cwd(),
          exists: fs.existsSync(templatePath)
        });
      }
      
      // No usar cache para recibos, ya que son diferentes templates
      if (documentType === 'RECIBO DE PAGO' || !this.templateCache) {
        if (!fs.existsSync(templatePath)) {
          const error = `Template no encontrado: ${templatePath}`;
          logError('TEMPLATE_NOT_FOUND', error, {
            templatePath,
            documentType,
            processDir: process.cwd(),
            dirExists: fs.existsSync(path.dirname(templatePath)),
            isRailway
          });
          throw new Error(error);
        }
        
        const template = fs.readFileSync(templatePath, 'utf-8');
        logInfo('TEMPLATE_LOADED', `Template cargado exitosamente (${template.length} chars)`, {
          templatePath,
          documentType,
          isRailway
        });
        
        // Solo cachear el template de confirmación
        if (documentType !== 'RECIBO DE PAGO') {
          this.templateCache = template;
        }
        
        return template;
      }
      
      return this.templateCache;
    } catch (error) {
      const errorMsg = `Error cargando template: ${error instanceof Error ? error.message : 'Unknown'}`;
      logError('TEMPLATE_LOAD_ERROR', errorMsg, {
        documentType,
        error: error instanceof Error ? error.stack : error,
        isRailway: !!(process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_ENVIRONMENT_NAME)
      });
      throw new Error(errorMsg);
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
        currentDate: new Date().toLocaleDateString('es-CO', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),

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
        documentType: templateTitle,  // AGREGAR: Para que coincida con {{documentType}} en template

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

      // DEBUG: Log de paymentItems en contexto del template
      if (context.paymentItems && context.paymentItems.length > 0) {
        logInfo('PDF_', `🔍 CONTEXT PAYMENTITEMS: ${context.paymentItems.length} items`, { paymentItems: context.paymentItems });
      } else {
        logInfo('PDF_', `⚠️ CONTEXT SIN PAYMENTITEMS o vacío`, { hasPaymentItems: !!context.paymentItems, length: context.paymentItems?.length });
      }

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
      // Detectar Railway una sola vez
      const isRailway = process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_ENVIRONMENT_NAME;
      
      // 🔍 AUTO-HEALING: Verificar salud del navegador
      await this.ensureBrowserHealth();
      
      const page = await this.browser!.newPage();
      
      // MONITOREO: Páginas activas para concurrencia (Railway debugging)
      if (isRailway) {
        const pages = await this.browser!.pages();
        logInfo('PDF_CONCURRENCY', 'Estado del navegador singleton', {
          bookingId,
          activePagesCount: pages.length,
          browserHealthy: 'checked via pages()',
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024 + 'MB'
        });
      }
      
      // Configurar viewport optimizado para PDF compacto
      await page.setViewport({
        width: 794,  // A4 width en pixels (210mm)
        height: 1123, // A4 height en pixels (297mm)
        deviceScaleFactor: 1 // Reducido para mejor fit
      });

      // Activar modo print para mejores estilos CSS @media print
      await page.emulateMediaType('print');

      // Ajustar timeouts según entorno
      const timeout = isRailway ? 60000 : 30000; // Más tiempo en Railway

      // Cargar HTML
      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: timeout
      });

      if (isRailway) {
        // Esperar extra en Railway - usar setTimeout (waitForTimeout removido en Puppeteer v22+)
        await new Promise(resolve => setTimeout(resolve, 2000));
        logInfo('PDF_GENERATOR', '⏰ Railway: Tiempo extra de espera aplicado');
      }

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
        const isRailway = process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_ENVIRONMENT_NAME;
        const outputDir = options.outputDir || path.join(__dirname, '../../../temp/pdfs');
        
        // Crear directorio si no existe - con verificación especial para Railway
        if (!fs.existsSync(outputDir)) {
          try {
            fs.mkdirSync(outputDir, { recursive: true });
            if (isRailway) {
              logInfo('PDF_GENERATOR', '📁 Railway: Directorio PDF creado exitosamente', { outputDir });
            }
          } catch (dirError) {
            logError('PDF_GENERATOR', `❌ Error creando directorio PDF: ${dirError}`, { 
              outputDir, 
              isRailway,
              error: dirError instanceof Error ? dirError.message : 'Unknown'
            });
            throw new Error(`No se pudo crear directorio PDF: ${dirError}`);
          }
        }

        const filename = `invoice-${bookingId}-${Date.now()}.pdf`;
        const filepath = path.join(outputDir, filename);
        
        try {
          fs.writeFileSync(filepath, pdfBuffer);
          result.pdfPath = filepath;
          
          if (isRailway) {
            logInfo('PDF_GENERATOR', `📄 Railway: PDF guardado exitosamente`, {
              filepath,
              size: `${(pdfBuffer.length / 1024).toFixed(1)}KB`,
              bookingId
            });
          } else {
            logInfo('PDF_GENERATOR', `PDF guardado en: ${filepath}`);
          }
          
        } catch (writeError) {
          logError('PDF_GENERATOR', `❌ Error escribiendo archivo PDF: ${writeError}`, {
            filepath,
            isRailway,
            bufferSize: pdfBuffer.length,
            error: writeError instanceof Error ? writeError.message : 'Unknown'
          });
          throw new Error(`No se pudo escribir archivo PDF: ${writeError}`);
        }
      }

      return result;

    } catch (error) {
      // Mejor logging de errores específicos para Railway
      const isRailway = process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_ENVIRONMENT_NAME;
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      if (isRailway) {
        logError('PDF_GENERATOR_RAILWAY', `❌ Error específico en Railway generando PDF: ${errorMessage}`, {
          bookingId,
          isRailway: true,
          errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
          railwayEnv: process.env.RAILWAY_ENVIRONMENT_NAME
        });
      } else {
        logError('PDF_GENERATOR_LOCAL', `❌ Error en entorno local generando PDF: ${errorMessage}`, {
          bookingId,
          isRailway: false,
          errorType: error instanceof Error ? error.constructor.name : 'UnknownError'
        });
      }
      
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
    // Email es opcional - puede estar vacío en algunas reservas
    // if (!data.email) errors.push('email es requerido');
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