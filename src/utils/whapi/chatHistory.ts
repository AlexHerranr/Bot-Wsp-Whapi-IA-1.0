// @docs: features/CONTEXTO_HISTORIAL_CONVERSACION.md
// @docs: progress/PROGRESO-BOT.md
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { enhancedLog } from '../core/index.js';

const WHAPI_TOKEN = process.env.WHAPI_TOKEN || '';
const WHAPI_BASE_URL = process.env.WHAPI_API_URL || 'https://gate.whapi.cloud';

interface ChatMessage {
    timestamp: number;
    from_me: boolean;
    text?: {
        body: string;
    };
    type: string;
}

interface ChatHistoryResponse {
    messages: ChatMessage[];
    total: number;
}

/**
 * Limpia el contenido del mensaje
 */
function cleanMessageContent(text: string): string {
    if (!text) return '';
    
    // Limpiar caracteres extraños y normalizar espacios
    let cleaned = text
        .replace(/\n/g, ' ')           // Reemplazar saltos de línea con espacios
        .replace(/\r/g, ' ')           // Reemplazar retornos de carro
        .replace(/\t/g, ' ')           // Reemplazar tabs
        .replace(/\s+/g, ' ')          // Múltiples espacios a uno solo
        .trim();                       // Quitar espacios al inicio y final
    
    return cleaned;
}

/**
 * Trunca el texto de forma inteligente
 */
function smartTruncate(text: string, maxLength: number = 70): string {
    if (text.length <= maxLength) return text;
    
    // Truncar por palabras completas
    const words = text.split(' ');
    let result = '';
    
    for (let word of words) {
        if ((result + word + ' ').length > maxLength) {
            break;
        }
        result += word + ' ';
    }
    
    return result.trim() + '...';
}

/**
 * Obtiene el historial de mensajes de un chat
 */
export async function getChatHistory(chatId: string, messageCount: number = 200): Promise<string | null> {
    try {
        enhancedLog('info', 'CHAT_HISTORY', `Obteniendo historial de chat para ${chatId}`);
        
        const response = await axios.get(`${WHAPI_BASE_URL}/messages/list/${chatId}`, {
            headers: {
                'Authorization': `Bearer ${WHAPI_TOKEN}`,
                'Content-Type': 'application/json'
            },
            params: {
                count: messageCount
            }
        });
        
        const data: ChatHistoryResponse = response.data;
        
        if (!data.messages || data.messages.length === 0) {
            enhancedLog('info', 'CHAT_HISTORY', `No se encontraron mensajes para ${chatId}`);
            return null;
        }
        
        // Ordenar mensajes de más antiguo a más reciente
        const sortedMessages = data.messages.sort((a, b) => a.timestamp - b.timestamp);
        
        // Construir el contexto de historial
        let historyContext = '=== HISTORIAL DE CONVERSACIÓN ===\n';
        historyContext += `Total de mensajes en historial: ${data.total}\n`;
        historyContext += `Mostrando últimos ${sortedMessages.length} mensajes:\n\n`;
        
        let currentDay = '';
        
        sortedMessages.forEach((msg) => {
            const date = new Date(msg.timestamp * 1000);
            const dayStr = date.toLocaleDateString('es-ES', { 
                day: '2-digit', 
                month: '2-digit',
                year: '2-digit'
            });
            
            // Mostrar separador de día cuando cambia
            if (dayStr !== currentDay) {
                historyContext += `\n--- ${dayStr} ---\n`;
                currentDay = dayStr;
            }
            
            // Identificar remitente
            const sender = msg.from_me ? 'Asistente' : 'Cliente';
            
            // Contenido del mensaje
            let content = '';
            if (msg.text && msg.text.body) {
                content = cleanMessageContent(msg.text.body);
                content = smartTruncate(content, 100);
            } else if (msg.type !== 'text') {
                content = `[${msg.type.toUpperCase()}]`;
            } else {
                content = '[Sin contenido]';
            }
            
            // Hora
            const time = date.toLocaleTimeString('es-ES', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            historyContext += `${time} - ${sender}: ${content}\n`;
        });
        
        historyContext += '\n=== FIN HISTORIAL ===\n';
        
        enhancedLog('success', 'CHAT_HISTORY', 
            `Historial obtenido: ${sortedMessages.length} mensajes procesados`);
        
        return historyContext;
        
    } catch (error) {
        enhancedLog('error', 'CHAT_HISTORY', 
            `Error obteniendo historial: ${error.message}`);
        return null;
    }
} 