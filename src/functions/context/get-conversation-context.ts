/**
 * Función para obtener contexto histórico de conversaciones
 * Permite al assistant solicitar diferentes niveles de contexto según necesite
 */

import type { FunctionDefinition } from '../types/function-types.js';
import { getChatHistory } from '../../utils/whapi/chatHistory.js';
import { logInfo } from '../../utils/logging/index';

/**
 * Formatear mensajes recientes para contexto
 */
function formatRecentMessages(historyText: string, messageCount: number): string {
  if (!historyText) {
    return "No hay mensajes recientes disponibles.";
  }

  // Parsear el historial de texto a estructura
  const lines = historyText.split('\n');
  const messages: Array<{timestamp: string, body: string, from: string}> = [];
  
  for (const line of lines) {
    if (line.includes(' - ') && (line.includes('Cliente:') || line.includes('Asistente:'))) {
      const parts = line.split(' - ');
      if (parts.length >= 3) {
        const timestamp = parts[0];
        const sender = line.includes('Cliente:') ? 'user' : 'bot';
        const content = parts.slice(2).join(' - ').replace(/^(Cliente|Asistente): /, '');
        messages.push({ timestamp, body: content, from: sender });
      }
    }
  }

  if (messages.length === 0) {
    return "No hay mensajes recientes disponibles.";
  }

  const recentMessages = messages
    .slice(-messageCount) // Últimos N mensajes según el nivel
    .map(msg => `[${msg.timestamp}] ${msg.from === 'bot' ? 'Bot' : 'Cliente'}: ${msg.body}`)
    .join('\n');

  return `Últimos ${messageCount} mensajes:\n${recentMessages}`;
}

/**
 * Handler principal de la función
 */
async function handleGetConversationContext(args: any, requestId?: string): Promise<any> {
  const { context_level } = args;
  let userId = requestId; // El requestId contiene el userId
  
  // Asegurar formato correcto para Whapi (agregar @s.whatsapp.net si no lo tiene)
  if (userId && !userId.includes('@')) {
    userId = userId + '@s.whatsapp.net';
  }
  
  logInfo('CONTEXT_FUNCTION', 'Solicitando contexto de conversación', {
    userId,
    contextLevel: context_level,
    requestId
  });

  try {
    let context = "";
    let messageCount = 30; // Por defecto
    
    // Determinar cuántos mensajes obtener según el nivel
    switch (context_level) {
      case "recent_50":
        messageCount = 50;
        break;
      case "recent_100":
        messageCount = 100;
        break;
      case "recent_200":
        messageCount = 200;
        break;
      case "recent_400":
        messageCount = 400;
        break;
      case "recent_600":
        messageCount = 600;
        break;
      default:
        throw new Error(`Nivel de contexto no válido: ${context_level}`);
    }
    
    const historyText = await getChatHistory(userId, messageCount);
    if (historyText) {
      context = formatRecentMessages(historyText, messageCount);
    } else {
      context = `No hay mensajes disponibles para el nivel ${context_level}.`;
    }
    
    logInfo('CONTEXT_FUNCTION', 'Contexto obtenido exitosamente', {
      userId,
      contextLevel: context_level,
      messageCount,
      contextLength: context.length
    });

    return {
      success: true,
      context: context,
      context_level: context_level,
      message_count: messageCount,
      timestamp: new Date().toISOString(),
      context_length: context.length
    };
    
  } catch (error) {
    logInfo('CONTEXT_FUNCTION', 'Error obteniendo contexto de conversación', error);
    return {
      success: false,
      error: error.message,
      context_level: context_level,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Definición de la función para OpenAI
 */
export const getConversationContextFunction: FunctionDefinition = {
  name: 'get_conversation_context',
  description: 'Obtiene contexto histórico de conversaciones anteriores con diferentes niveles de profundidad según lo necesite el assistant',
  category: 'context',
  version: '1.0.0',
  enabled: true,
  parameters: {
    type: 'object',
    properties: {
      context_level: {
        type: 'string',
        enum: ['recent_50', 'recent_100', 'recent_200', 'recent_400', 'recent_600'],
        description: 'Nivel de contexto: 50 (consulta básica), 100 (contexto moderado), 200 (conversación completa), 400 (historial extenso), 600 (contexto máximo)'
      }
    },
    required: ['context_level']
  },
  handler: handleGetConversationContext
}; 