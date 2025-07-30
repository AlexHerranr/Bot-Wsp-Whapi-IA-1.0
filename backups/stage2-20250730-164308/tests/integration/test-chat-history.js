import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const WHAPI_TOKEN = process.env.WHAPI_TOKEN || '';
const WHAPI_BASE_URL = process.env.WHAPI_API_URL || 'https://gate.whapi.cloud';

// Obtener Chat ID desde argumentos de línea de comandos
const CHAT_ID = process.argv[2];

if (!CHAT_ID) {
    console.error('❌ Error: Debes proporcionar un Chat ID como argumento');
    console.log('📝 Uso: node test-chat-history.js <CHAT_ID>');
    console.log('📝 Ejemplo: node test-chat-history.js 573003913251@s.whatsapp.net');
    process.exit(1);
}

// Funciones auxiliares
function cleanMessageContent(text) {
    if (!text) return '';
    
    let cleaned = text
        .replace(/\n/g, ' ')
        .replace(/\r/g, ' ')
        .replace(/\t/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    
    return cleaned;
}

function smartTruncate(text, maxLength = 70) {
    if (text.length <= maxLength) return text;
    
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

// Función principal getChatHistory
async function getChatHistory(chatId, messageCount = 200) {
    try {
        console.log(`[CHAT_HISTORY] Obteniendo historial de chat para ${chatId}`);
        
        const response = await axios.get(`${WHAPI_BASE_URL}/messages/list/${chatId}`, {
            headers: {
                'Authorization': `Bearer ${WHAPI_TOKEN}`,
                'Content-Type': 'application/json'
            },
            params: {
                count: messageCount
            }
        });
        
        const data = response.data;
        
        if (!data.messages || data.messages.length === 0) {
            console.log(`[CHAT_HISTORY] No se encontraron mensajes para ${chatId}`);
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
        
        console.log(`[CHAT_HISTORY] Historial obtenido: ${sortedMessages.length} mensajes procesados`);
        
        return historyContext;
        
    } catch (error) {
        console.error(`[CHAT_HISTORY] Error obteniendo historial: ${error.message}`);
        return null;
    }
}

// Función de prueba
async function testChatHistory() {
    try {
        console.log('🔍 Probando función getChatHistory...\n');
        console.log(`📱 Chat ID: ${CHAT_ID}`);
        console.log('⏳ Obteniendo historial...\n');
        
        const history = await getChatHistory(CHAT_ID, 200);
        
        if (history) {
            console.log('✅ Historial obtenido exitosamente!\n');
            console.log('📄 CONTENIDO DEL HISTORIAL:');
            console.log('═'.repeat(70));
            console.log(history);
            console.log('═'.repeat(70));
            console.log(`\n📊 Longitud total del contexto: ${history.length} caracteres`);
        } else {
            console.log('⚠️ No se pudo obtener el historial o no hay mensajes');
        }
        
    } catch (error) {
        console.error('❌ Error en la prueba:', error.message);
        console.error(error.stack);
    }
}

// Ejecutar la prueba
testChatHistory(); 