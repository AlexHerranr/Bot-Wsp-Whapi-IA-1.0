import { OpenAI } from 'openai';
import { injectable, inject } from 'tsyringe';
import { DatabaseService } from './database.service';

interface CRMAnalysisResult {
  profileStatus: string;
  proximaAccion: string;
  fechaProximaAccion: string;
  prioridad: number;
}

export class SimpleCRMService {
  private openai: OpenAI;

  constructor(private db: DatabaseService) {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async analyzeAndUpdate(phoneNumber: string): Promise<void> {
    try {
      // Obtener historial reciente (últimos 10 mensajes)
      const chatId = await this.getChatIdByPhone(phoneNumber);
      if (!chatId) {
        console.log(`❌ No se encontró chatId para ${phoneNumber}`);
        return;
      }

      const messages = await this.fetchRecentMessages(chatId);
      if (!messages || messages.length === 0) {
        console.log(`❌ No se encontraron mensajes para ${phoneNumber}`);
        return;
      }

      const conversationText = messages
        .map(msg => `${msg.from_name || 'Usuario'}: ${msg.text?.body || msg.body || 'mensaje multimedia'}`)
        .join('\n');

      // Crear thread y mensaje para el análisis CRM
      const thread = await this.openai.beta.threads.create();
      
      await this.openai.beta.threads.messages.create(thread.id, {
        role: 'user',
        content: conversationText
      });

      const run = await this.openai.beta.threads.runs.create(thread.id, {
        assistant_id: process.env.CRM_ASSISTANT_ID!
      });

      // Esperar a que termine el análisis
      let runStatus = await this.openai.beta.threads.runs.retrieve(thread.id, run.id);
      while (runStatus.status === 'queued' || runStatus.status === 'in_progress') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        runStatus = await this.openai.beta.threads.runs.retrieve(thread.id, run.id);
      }

      if (runStatus.status !== 'completed') {
        throw new Error(`Análisis CRM falló: ${runStatus.status}`);
      }

      // Obtener la respuesta
      const messages_response = await this.openai.beta.threads.messages.list(thread.id);
      const lastMessage = messages_response.data[0];
      
      if (!lastMessage || !lastMessage.content[0] || lastMessage.content[0].type !== 'text') {
        throw new Error('No se recibió respuesta del Assistant CRM');
      }

      const responseText = lastMessage.content[0].text.value;
      const result: CRMAnalysisResult = JSON.parse(responseText);

      // Validar JSON (manejo de errores básico)
      if (!result.profileStatus || !result.prioridad) {
        throw new Error('Invalid CRM analysis response');
      }

      // Actualizar BD con datos CRM y threadId
      await this.updateCRMFields(phoneNumber, result, thread.id);
      console.log(`✅ CRM actualizado para ${phoneNumber} con thread ${thread.id}`);
      
      // Limpiar thread después de guardar el ID
      await this.openai.beta.threads.del(thread.id);
      
    } catch (error) {
      console.error(`❌ Error en CRM analysis para ${phoneNumber}:`, error.message);
    }
  }

  private async getChatIdByPhone(phoneNumber: string): Promise<string | null> {
    try {
      const client = await this.db.getClientByPhone(phoneNumber);
      return client?.chatId || null;
    } catch (error) {
      console.error(`Error obteniendo chatId para ${phoneNumber}:`, error);
      return null;
    }
  }

  private async fetchRecentMessages(chatId: string): Promise<any[]> {
    try {
      const response = await fetch(
        `${process.env.WHAPI_API_URL}/messages/list?chat_id=${chatId}&count=10`, 
        {
          headers: { 'Authorization': `Bearer ${process.env.WHAPI_TOKEN}` }
        }
      );
      
      if (!response.ok) {
        throw new Error(`WHAPI error: ${response.status}`);
      }
      
      const data = await response.json();
      return (data as any).messages || [];
    } catch (error) {
      console.error(`Error fetching messages para chatId ${chatId}:`, error);
      return [];
    }
  }

  private async updateCRMFields(phoneNumber: string, result: CRMAnalysisResult, threadId?: string): Promise<void> {
    try {
      const updateData: any = {
        profileStatus: result.profileStatus,
        proximaAccion: result.proximaAccion,
        fechaProximaAccion: new Date(result.fechaProximaAccion),
        prioridad: result.prioridad
      };

      // Agregar threadId si se proporciona
      if (threadId) {
        updateData.threadId = threadId;
      }

      await this.db.updateClient(phoneNumber, updateData);
    } catch (error) {
      console.error(`Error actualizando CRM fields para ${phoneNumber}:`, error);
      throw error;
    }
  }

  async getClientsForToday(): Promise<any[]> {
    try {
      return await this.db.getClientsWithActionToday();
    } catch (error) {
      console.error('Error obteniendo clientes para hoy:', error);
      return [];
    }
  }

  async cleanupAction(phoneNumber: string): Promise<void> {
    try {
      await this.db.updateClient(phoneNumber, {
        proximaAccion: null,
        fechaProximaAccion: null
      });
    } catch (error) {
      console.error(`Error limpiando acción para ${phoneNumber}:`, error);
    }
  }
}