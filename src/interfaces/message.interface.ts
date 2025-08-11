/**
 * Interfaces para el manejo de mensajes en el bot
 */

export interface WhatsAppMessage {
  id: string;
  chatId: string;
  fromMe: boolean;
  timestamp: number;
  text?: {
    body: string;
  };
  from: string;
  chat_name?: string;  // Nombre del chat/contacto (reemplaza from_name)
  type: string;
}

export interface ProcessedMessage {
  id: string;
  userId: string;
  chatId: string;
  userName: string;
  content: string;
  timestamp: Date;
  isFromBot: boolean;
  isManual: boolean;
}

export interface MessageBuffer {
  messages: string[];
  chatId: string;
  name: string;
  lastActivity: number;
}

export interface ManualMessageBuffer {
  messages: string[];
  agentName: string;
  timestamp: number;
}

export interface MessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  responseTime?: number;
} 