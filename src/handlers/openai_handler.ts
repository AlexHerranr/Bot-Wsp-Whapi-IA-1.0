import { OpenAI } from 'openai';
import { AiHandler, AiResponse } from './ai_handler.interface';
import { logInfo } from '../utils/logging/index.js';

export class OpenAiHandler implements AiHandler {
  private openai: OpenAI;
  private assistantId: string;
  private userThreadMap: Map<string, string> = new Map();

  constructor(apiKey: string, assistantId: string) {
    this.openai = new OpenAI({ apiKey });
    this.assistantId = assistantId;
  }

  async initialize(): Promise<void> {
    try {
      await this.openai.models.list();
      console.log('✅ Conexión con OpenAI establecida');
    } catch (error) {
      console.error('❌ Error al conectar con OpenAI:', error);
      throw error;
    }
  }

  async processMessage(userId: string, message: string): Promise<AiResponse> {
    // Obtener o crear un thread para este usuario
    let threadId = this.userThreadMap.get(userId);
    
    if (!threadId) {
      const thread = await this.openai.beta.threads.create();
      threadId = thread.id;
      this.userThreadMap.set(userId, threadId);
    }

    // Añadir mensaje al thread
    logInfo('OPENAI_PAYLOAD', 'Enviando payload completo a OpenAI', {
      userId,
      threadId,
      content: message
    }, 'openai_handler.ts');
    await this.openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: message
    });

    // Ejecutar el asistente
    const run = await this.openai.beta.threads.runs.create(threadId, {
      assistant_id: this.assistantId
    });

    // Esperar a que termine
    let runStatus = await this.openai.beta.threads.runs.retrieve(threadId, run.id);
    
    while (runStatus.status !== 'completed' && runStatus.status !== 'failed') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await this.openai.beta.threads.runs.retrieve(threadId, run.id);
    }

    if (runStatus.status === 'failed') {
      // 🔧 ELIMINADO: Fallback automático - permitir que OpenAI maneje la respuesta
      logInfo('OPENAI_RUN_FAILED', 'Run falló, permitiendo flujo natural', {
        userId,
        threadId,
        runId: run.id
      }, 'openai_handler.ts');
      return { text: "" };
    }

    // Obtener los mensajes más recientes
    const messages = await this.openai.beta.threads.messages.list(threadId);
    const assistantMessages = messages.data.filter(m => m.role === 'assistant');
    
    if (assistantMessages.length === 0) {
      // 🔧 ELIMINADO: Fallback automático - permitir que OpenAI maneje la respuesta
      logInfo('OPENAI_NO_ASSISTANT_MESSAGES', 'No hay mensajes del assistant, permitiendo flujo natural', {
        userId,
        threadId
      }, 'openai_handler.ts');
      return { text: "" };
    }

    // Extraer el texto de la respuesta
    const responseContent = assistantMessages[0].content[0];
    
    if ('text' in responseContent) {
      logInfo('OPENAI_RESPONSE_RAW', 'Respuesta cruda recibida de OpenAI', {
        userId,
        threadId,
        content: responseContent.text.value
      }, 'openai_handler.ts');
      return { text: responseContent.text.value };
    } else {
      // 🔧 ELIMINADO: Fallback automático - permitir que OpenAI maneje la respuesta
      logInfo('OPENAI_UNSUPPORTED_FORMAT', 'Formato de respuesta no soportado, permitiendo flujo natural', {
        userId,
        threadId
      }, 'openai_handler.ts');
      return { text: "" };
    }
  }

  // Método para obtener mensajes de un thread específico
  async getThreadMessages(threadId: string, limit: number = 50): Promise<any[]> {
    try {
      const messages = await this.openai.beta.threads.messages.list(threadId, {
        limit: limit,
        order: 'asc' // Más antiguos primero
      });
      
      return messages.data;
    } catch (error) {
      console.error('Error obteniendo mensajes del thread:', error);
      throw error;
    }
  }
}