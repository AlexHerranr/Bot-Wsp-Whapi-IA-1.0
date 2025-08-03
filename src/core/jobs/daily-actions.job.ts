import cron from 'node-cron';
import { OpenAI } from 'openai';
import { injectable, inject } from 'tsyringe';
import { DatabaseService } from '../services/database.service';

export class DailyActionsJob {
  private openai: OpenAI;
  private isRunning: boolean = false;

  constructor(private db: DatabaseService) {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  start(): void {
    // Ejecutar diariamente a las 9:00 AM
    cron.schedule('0 9 * * *', async () => {
      if (this.isRunning) {
        console.log('⚠️ Daily actions job ya está ejecutándose, saltando...');
        return;
      }

      try {
        await this.executeDailyActions();
      } catch (error) {
        console.error('❌ Error en daily actions job:', error);
      }
    });

    console.log('📅 daily-actions scheduled for 9AM COT');
  }

  private async executeDailyActions(): Promise<void> {
    this.isRunning = true;
    console.log('🕘 Ejecutando acciones CRM internas...');

    try {
      const clients = await this.db.getClientsWithActionToday();
      
      if (clients.length === 0) {
        console.log('ℹ️ No hay clientes con acciones programadas para hoy');
        return;
      }

      console.log(`📋 Procesando ${clients.length} clientes con acciones programadas`);

      for (const client of clients) {
        try {
          await this.processClientAction(client);
          // Pequeña pausa entre clientes para no sobrecargar
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`❌ Error procesando cliente ${client.phoneNumber}:`, error);
        }
      }

      console.log('✅ Daily actions completadas');
    } finally {
      this.isRunning = false;
    }
  }

  private async processClientAction(client: any): Promise<void> {
    // ID del Assistant asesor de reservas (NO modificar su prompt)
    const RESERVAS_ASSISTANT_ID = 'asst_SRqZsLGTOwLCXxOADo7beQuM';
    const clientName = client.name || client.userName || 'Cliente';
    
    // Obtener etiquetas del cliente si están disponibles
    const clientLabels = [];
    if (client.label1) clientLabels.push(client.label1);
    if (client.label2) clientLabels.push(client.label2);
    if (client.label3) clientLabels.push(client.label3);
    
    const labelsText = clientLabels.length > 0 ? clientLabels.join(' y ') : 'sin etiquetas específicas';
    
    const prompt = `(Disparador Interno para Hacer Seguimiento)

El cliente ${clientName} con etiquetas "${labelsText}". 

Análisis del cliente: ${client.profileStatus}

Próxima acción requerida: ${client.proximaAccion}

Genera un mensaje de seguimiento natural para WhatsApp dirigido al cliente.`;

    try {
      console.log(`  🎯 Usando Assistant de reservas: ${RESERVAS_ASSISTANT_ID}`);
      
      // Crear thread
      const thread = await this.openai.beta.threads.create();
      
      // Agregar mensaje
      await this.openai.beta.threads.messages.create(thread.id, {
        role: 'user',
        content: prompt
      });
      
      // Ejecutar Assistant de reservas
      const run = await this.openai.beta.threads.runs.create(thread.id, {
        assistant_id: RESERVAS_ASSISTANT_ID
      });
      
      // Esperar respuesta
      let runStatus = await this.openai.beta.threads.runs.retrieve(thread.id, run.id);
      let attempts = 0;
      const maxAttempts = 15;
      
      while (runStatus.status === 'queued' || runStatus.status === 'in_progress') {
        if (attempts >= maxAttempts) {
          throw new Error('Timeout esperando respuesta del Assistant de reservas');
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        runStatus = await this.openai.beta.threads.runs.retrieve(thread.id, run.id);
        attempts++;
      }
      
      if (runStatus.status !== 'completed') {
        throw new Error(`Assistant run falló con estado: ${runStatus.status}`);
      }
      
      // Obtener respuesta
      const messages = await this.openai.beta.threads.messages.list(thread.id);
      const lastMessage = messages.data[0];
      
      if (!lastMessage || !lastMessage.content[0] || lastMessage.content[0].type !== 'text') {
        throw new Error('No se recibió respuesta de texto del Assistant');
      }
      
      const message = lastMessage.content[0].text.value;
      
      // Limpiar thread
      await this.openai.beta.threads.del(thread.id);
      
      console.log(`  ✅ Mensaje generado por Assistant de reservas`);
      
      if (!message) {
        throw new Error('No se generó mensaje de seguimiento');
      }

      // Enviar mensaje de WhatsApp
      await this.sendWhatsAppMessage(client.chatId, message);
      
      // Limpiar la acción completada
      await this.db.updateClient(client.phoneNumber, {
        proximaAccion: null,
        fechaProximaAccion: null
      });

      console.log(`✅ Seguimiento enviado a ${client.phoneNumber}`);
      
    } catch (error) {
      console.error(`❌ Error generando mensaje para ${client.phoneNumber}:`, error);
    }
  }

  private async sendWhatsAppMessage(chatId: string, message: string): Promise<void> {
    try {
      const response = await fetch(`${process.env.WHAPI_API_URL}/messages/text`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.WHAPI_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: chatId,
          body: message
        })
      });

      if (!response.ok) {
        throw new Error(`WHAPI error: ${response.status} - ${await response.text()}`);
      }

      console.log(`📤 Mensaje enviado a ${chatId}`);
    } catch (error) {
      console.error(`❌ Error enviando mensaje a ${chatId}:`, error);
      throw error;
    }
  }

  // Método manual para testing
  public async executeManual(): Promise<void> {
    console.log('🔧 Ejecutando daily actions manualmente...');
    await this.executeDailyActions();
  }

  public getStatus(): { running: boolean; nextExecution: string } {
    return {
      running: this.isRunning,
      nextExecution: 'Diariamente a las 9:00 AM'
    };
  }
}