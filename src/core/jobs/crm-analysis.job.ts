import cron from 'node-cron';
import { injectable } from 'tsyringe';
import { DatabaseService } from '../services/database.service';
import { SimpleCRMService } from '../services/simple-crm.service';

export class CRMAnalysisJob {
  private isRunning: boolean = false;

  constructor(
    private db: DatabaseService,
    private crmService: SimpleCRMService
  ) {}

  start(): void {
    // Ejecutar cada 15 minutos para verificar clientes que necesitan análisis
    cron.schedule('*/15 * * * *', async () => {
      if (this.isRunning) {
        console.log('⚠️ CRM Analysis job ya está ejecutándose, saltando...');
        return;
      }

      try {
        await this.checkClientsForAnalysis();
      } catch (error) {
        console.error('❌ Error en CRM analysis job:', error);
      }
    });

    console.log('📊 crm-analysis scheduled every 15min');
  }

  private async checkClientsForAnalysis(): Promise<void> {
    this.isRunning = true;

    try {
      // Obtener clientes que tuvieron actividad hace 1+ horas y no tienen análisis CRM reciente
      const clients = await this.getClientsNeedingAnalysis();
      
      if (clients.length === 0) {
        return;
      }

      console.log(`📊 Analizando ${clients.length} clientes para CRM...`);

      for (const client of clients) {
        try {
          console.log(`  🔍 Analizando cliente: ${client.phoneNumber}`);
          await this.crmService.analyzeAndUpdate(client.phoneNumber);
          
          // Pausa entre análisis para no sobrecargar
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          console.error(`❌ Error analizando cliente ${client.phoneNumber}:`, error);
        }
      }

      console.log('✅ Análisis CRM completado');
    } finally {
      this.isRunning = false;
    }
  }

  private async getClientsNeedingAnalysis(): Promise<any[]> {
    try {
      // Buscar clientes que:
      // 1. Tuvieron actividad hace más de 1 hora
      // 2. No tienen análisis CRM reciente (profileStatus es null o muy antiguo)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const query = `
        SELECT phoneNumber, chatId, userName, lastActivity
        FROM "ClientView" 
        WHERE lastActivity < $1 
        AND (profileStatus IS NULL OR profileStatus = '' OR 
             (updatedAt IS NULL OR updatedAt < $2))
        ORDER BY lastActivity ASC
        LIMIT 10
      `;
      
      // También verificar que no se haya actualizado en las últimas 2 horas
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      
      if (this.db.connected && this.db.database) {
        const result = await this.db.database.$queryRaw`
          SELECT "phoneNumber", "chatId", "userName", "lastActivity"
          FROM "ClientView" 
          WHERE "lastActivity" < ${oneHourAgo}
          AND ("profileStatus" IS NULL OR "profileStatus" = '')
          ORDER BY "lastActivity" ASC
          LIMIT 10
        `;
        return result as any[];
      }
      
      return [];
    } catch (error) {
      console.error('Error obteniendo clientes para análisis CRM:', error);
      return [];
    }
  }

  // Método manual para testing
  public async executeManual(): Promise<void> {
    console.log('🔧 Ejecutando análisis CRM manualmente...');
    await this.checkClientsForAnalysis();
  }

  public getStatus(): { running: boolean; schedule: string } {
    return {
      running: this.isRunning,
      schedule: 'Cada 15 minutos - analiza clientes con 1+ horas de inactividad'
    };
  }
}