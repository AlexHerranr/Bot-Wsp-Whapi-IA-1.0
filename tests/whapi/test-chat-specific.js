function cleanMessageContent(text) {
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

function smartTruncate(text, maxLength = 70) {
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
}import axios from 'axios';

const WHAPI_TOKEN = 'hXoVA1qcPcFPQ0uh8AZckGzbPxquj7dZ';
const WHAPI_BASE_URL = 'https://gate.whapi.cloud';

// Obtener Chat ID desde argumentos de línea de comandos
const CHAT_ID = process.argv[2];
const MESSAGE_COUNT = parseInt(process.argv[3]) || 200; // Por defecto 200 mensajes

if (!CHAT_ID) {
    console.error('❌ Error: Debes proporcionar un Chat ID como argumento');
    console.log('📝 Uso: node test-chat-context.js <CHAT_ID> [cantidad_mensajes]');
    console.log('📝 Ejemplo: node test-chat-context.js 573003913251@s.whatsapp.net');
    console.log('📝 Ejemplo: node test-chat-context.js 573003913251@s.whatsapp.net 100');
    process.exit(1);
}

async function getChatLabels() {
    try {
        const response = await axios.get(`${WHAPI_BASE_URL}/chats/${CHAT_ID}`, {
            headers: {
                'Authorization': `Bearer ${WHAPI_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        return response.data;
    } catch (error) {
        console.error('❌ Error obteniendo etiquetas:', error.message);
        return null;
    }
}

async function getChatMessages(count = 200) {
    try {
        const response = await axios.get(`${WHAPI_BASE_URL}/messages/list/${CHAT_ID}`, {
            headers: {
                'Authorization': `Bearer ${WHAPI_TOKEN}`,
                'Content-Type': 'application/json'
            },
            params: {
                count: count
            }
        });
        
        return response.data;
    } catch (error) {
        console.error('❌ Error obteniendo mensajes:', error.message);
        return null;
    }
}



function displayInfo(chatInfo, messagesData) {
    // Información básica
    console.log(`👤 Contacto: ${chatInfo.name || 'Sin nombre'}`);
    
    // Etiquetas en una línea
    if (chatInfo.labels && chatInfo.labels.length > 0) {
        const labelNames = chatInfo.labels.map(label => label.name).join(', ');
        console.log(`🏷️  Etiquetas: ${labelNames}`);
    } else {
        console.log('🏷️  Etiquetas: Sin etiquetas');
    }
    
    // Resumen de mensajes
    const totalMsgs = messagesData.total.toLocaleString();
    const obtainedMsgs = messagesData.messages.length;
    console.log(`📊 Mensajes: ${obtainedMsgs} de ${totalMsgs} totales`);
    
    console.log(''); // Línea en blanco
}

function displayConversations(messagesData) {
    console.log('📱 CONVERSACIÓN (más recientes primero):');
    console.log('─'.repeat(70));
    
    // Ordenar mensajes de más reciente a más antiguo
    const sortedMessages = messagesData.messages.sort((a, b) => b.timestamp - a.timestamp);
    
    let currentDay = '';
    let messageCounter = 1;
    
    sortedMessages.forEach((msg) => {
        const date = new Date(msg.timestamp * 1000);
        const dayStr = date.toLocaleDateString('es-ES', { 
            day: '2-digit', 
            month: '2-digit',
            year: '2-digit'
        });
        
        // Mostrar separador de día cuando cambia
        if (dayStr !== currentDay) {
            if (currentDay !== '') console.log(''); // Línea en blanco entre días
            console.log(`📅 ${dayStr}`);
            console.log('─'.repeat(30));
            currentDay = dayStr;
        }
        
        // Identificar remitente con emoji simple
        const senderIcon = msg.from_me ? '🤖' : '👤';
        const senderName = msg.from_me ? 'Yo' : 'Cliente';
        
        // Contenido del mensaje
        let content = '';
        if (msg.text && msg.text.body) {
            content = cleanMessageContent(msg.text.body);
            content = smartTruncate(content, 70);
        } else if (msg.type !== 'text') {
            content = `[${msg.type.toUpperCase()}]`;
        } else {
            content = '[Sin contenido]';
        }
        
        // Número de mensaje para referencia
        const msgNum = messageCounter.toString().padStart(3, '0');
        messageCounter++;
        
        // Hora sin fecha (ya está agrupado por día)
        const justTime = date.toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        console.log(`${msgNum}. ${justTime} ${senderIcon} ${senderName}: ${content}`);
    });
}

function displaySummary(messagesData) {
    console.log('\n' + '─'.repeat(70));
    
    // Estadísticas simples
    const myMessages = messagesData.messages.filter(msg => msg.from_me).length;
    const clientMessages = messagesData.messages.filter(msg => !msg.from_me).length;
    
    console.log(`📈 Resumen: ${myMessages} míos, ${clientMessages} del cliente`);
    
    // Rango de fechas (del más antiguo al más nuevo)
    const sortedByTime = [...messagesData.messages].sort((a, b) => a.timestamp - b.timestamp);
    if (sortedByTime.length > 0) {
        const oldest = new Date(sortedByTime[0].timestamp * 1000);
        const newest = new Date(sortedByTime[sortedByTime.length - 1].timestamp * 1000);
        
        const oldestStr = oldest.toLocaleDateString('es-ES', { 
            day: '2-digit', 
            month: '2-digit', 
            year: '2-digit' 
        });
        const newestStr = newest.toLocaleDateString('es-ES', { 
            day: '2-digit', 
            month: '2-digit', 
            year: '2-digit' 
        });
        
        console.log(`📅 Período: ${oldestStr} a ${newestStr}`);
        
        // Mostrar cuántos días abarca la conversación
        const daysDiff = Math.ceil((newest - oldest) / (1000 * 60 * 60 * 24)) + 1;
        console.log(`📊 Conversación abarca: ${daysDiff} día(s)`);
    }
}

async function runContextAnalysis() {
    try {
        console.log('🔍 Analizando chat...\n');
        
        // Obtener datos
        const chatInfo = await getChatLabels();
        const messagesData = await getChatMessages(MESSAGE_COUNT);
        
        if (!chatInfo || !messagesData) {
            console.error('❌ No se pudieron obtener los datos del chat');
            return;
        }
        
        // Mostrar información
        displayInfo(chatInfo, messagesData);
        displayConversations(messagesData);
        displaySummary(messagesData);
        
    } catch (error) {
        console.error('❌ Error en el análisis:', error.message);
        process.exit(1);
    }
}

// Mostrar ayuda si se solicita
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('\n📋 AYUDA - Contexto Simple de Conversación');
    console.log('═══════════════════════════════════════');
    console.log('Muestra conversaciones y etiquetas de forma simple y organizada');
    console.log('\nUso: node test-chat-context.js <CHAT_ID> [cantidad_mensajes]');
    console.log('\nParámetros:');
    console.log('  CHAT_ID: ID del chat a analizar (requerido)');
    console.log('  cantidad_mensajes: Número de mensajes (opcional, default: 200)');
    console.log('\nEjemplos:');
    console.log('  node test-chat-context.js 573003913251@s.whatsapp.net');
    console.log('  node test-chat-context.js 573003913251@s.whatsapp.net 100');
    process.exit(0);
}

// Ejecutar el análisis
runContextAnalysis();