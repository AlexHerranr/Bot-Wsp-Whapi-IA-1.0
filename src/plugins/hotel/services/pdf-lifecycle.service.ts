// src/plugins/hotel/services/pdf-lifecycle.service.ts
import { PDFGeneratorService } from './pdf-generator.service';
import { logInfo, logSuccess, logError } from '../../../utils/logging';

/**
 * Servicio Singleton de gestión de ciclo de vida del PDF con Graceful Shutdown
 */
class PDFLifecycleService {
  private static instance: PDFLifecycleService | null = null;
  private pdfService: PDFGeneratorService | null = null;
  private shutdownHandlersRegistered = false;

  private constructor() {
    // Constructor privado para patrón Singleton
  }

  /**
   * Obtiene la instancia singleton
   */
  public static getInstance(): PDFLifecycleService {
    if (!PDFLifecycleService.instance) {
      PDFLifecycleService.instance = new PDFLifecycleService();
    }
    return PDFLifecycleService.instance;
  }

  /**
   * Obtiene el servicio PDF (lazy initialization)
   */
  public getPDFService(): PDFGeneratorService {
    if (!this.pdfService) {
      this.pdfService = new PDFGeneratorService();
      this.registerShutdownHandlers();
      logInfo('PDF_LIFECYCLE', '🚀 PDFGeneratorService inicializado con gestión de ciclo de vida');
    }
    return this.pdfService;
  }

  /**
   * Registra handlers de cierre controlado (Graceful Shutdown)
   */
  private registerShutdownHandlers(): void {
    if (this.shutdownHandlersRegistered) {
      return; // Ya registrados
    }

    const handleShutdown = async (signal: string) => {
      logInfo('PDF_LIFECYCLE', `📡 Señal de cierre recibida (${signal}), liberando recursos...`);
      
      try {
        if (this.pdfService) {
          await this.pdfService.closeBrowser();
          logSuccess('PDF_LIFECYCLE', '✅ Navegador PDF cerrado correctamente');
        }
        
        logSuccess('PDF_LIFECYCLE', '🎯 Graceful shutdown completado exitosamente');
        process.exit(0);
      } catch (error) {
        logError('PDF_LIFECYCLE', `❌ Error durante graceful shutdown: ${error}`);
        process.exit(1);
      }
    };

    // Registrar handlers para diferentes señales de terminación
    process.on('SIGINT', () => handleShutdown('SIGINT'));   // Ctrl+C
    process.on('SIGTERM', () => handleShutdown('SIGTERM')); // Docker/Kubernetes stop
    process.on('SIGQUIT', () => handleShutdown('SIGQUIT')); // Quit signal
    
    // Handler para errores no capturados (opcional, para limpieza)
    process.on('uncaughtException', async (error) => {
      logError('PDF_LIFECYCLE', `💥 Excepción no capturada: ${error.message}`);
      try {
        if (this.pdfService) {
          await this.pdfService.closeBrowser();
        }
      } catch (cleanupError) {
        logError('PDF_LIFECYCLE', `Error en limpieza de emergencia: ${cleanupError}`);
      }
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason) => {
      logError('PDF_LIFECYCLE', `💥 Promise rejection no manejada: ${reason}`);
      try {
        if (this.pdfService) {
          await this.pdfService.closeBrowser();
        }
      } catch (cleanupError) {
        logError('PDF_LIFECYCLE', `Error en limpieza de emergencia: ${cleanupError}`);
      }
      process.exit(1);
    });

    this.shutdownHandlersRegistered = true;
    logInfo('PDF_LIFECYCLE', '🛡️ Handlers de Graceful Shutdown registrados');
  }

  /**
   * Fuerza el cierre de recursos (para testing o casos especiales)
   */
  public async forceShutdown(): Promise<void> {
    if (this.pdfService) {
      await this.pdfService.closeBrowser();
      logInfo('PDF_LIFECYCLE', '🔧 Recursos PDF liberados manualmente');
    }
  }

  /**
   * Limpia cache y opcionalmente cierra navegador
   */
  public async clearCache(closeBrowser: boolean = false): Promise<void> {
    if (this.pdfService) {
      await this.pdfService.clearCache(closeBrowser);
    }
  }
}

// Exportar la instancia singleton
export const pdfLifecycle = PDFLifecycleService.getInstance();

// Función de conveniencia para obtener el servicio PDF
export function getPDFService(): PDFGeneratorService {
  return pdfLifecycle.getPDFService();
}