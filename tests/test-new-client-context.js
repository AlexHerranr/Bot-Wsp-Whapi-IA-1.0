import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Leer threads.json directamente
function getThread(userId) {
    try {
        const threadsPath = path.join(__dirname, '..', 'tmp', 'threads.json');
        if (!fs.existsSync(threadsPath)) {
            return null;
        }
        
        const content = fs.readFileSync(threadsPath, 'utf8');
        const threads = JSON.parse(content);
        
        // Buscar el thread del usuario
        const threadEntry = threads.find(([id]) => id === userId);
        return threadEntry ? threadEntry[1] : null;
    } catch (error) {
        console.error('Error leyendo threads:', error);
        return null;
    }
}

// Simulación de las funciones del app.ts
const getCurrentTimeContext = () => {
    const now = new Date();
    
    // Ajustar a zona horaria de Colombia (UTC-5)
    const colombiaTime = new Date(now.getTime() - (5 * 60 * 60 * 1000));
    
    // Calcular mañana correctamente
    const tomorrow = new Date(colombiaTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const year = colombiaTime.getFullYear();
    const month = String(colombiaTime.getMonth() + 1).padStart(2, '0');
    const day = String(colombiaTime.getDate()).padStart(2, '0');
    const hours = String(colombiaTime.getHours()).padStart(2, '0');
    const minutes = String(colombiaTime.getMinutes()).padStart(2, '0');
    
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                       'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    
    const dayName = dayNames[colombiaTime.getDay()];
    const monthName = monthNames[colombiaTime.getMonth()];
    
    return `=== CONTEXTO TEMPORAL ACTUAL ===
FECHA: ${dayName}, ${day} de ${monthName} de ${year} (${year}-${month}-${day})
HORA: ${hours}:${minutes} - Zona horaria Colombia (UTC-5)
=== FIN CONTEXTO ===`;
};

const getConversationalContext = (threadInfo) => {
    if (!threadInfo) {
        return '';
    }
    
    const { name, userName, labels } = threadInfo;
    let context = '=== CONTEXTO CONVERSACIONAL ===\n';
    
    // Información del cliente
    if (name && userName) {
        context += `CLIENTE: ${name} (${userName})\n`;
    } else if (name) {
        context += `CLIENTE: ${name}\n`;
    } else if (userName) {
        context += `CLIENTE: ${userName}\n`;
    } else {
        context += `CLIENTE: Usuario\n`;
    }
    
    // Etiquetas/metadatos si existen
    if (labels && labels.length > 0) {
        context += `ETIQUETAS: ${labels.join(', ')}\n`;
    }
    
    context += `=== FIN CONTEXTO ===`;
    
    return context;
};

async function testNewClientContext() {
    console.log('🧪 SIMULACIÓN: Contexto para Cliente Nuevo\n');
    console.log('═'.repeat(70));
    
    // Simular datos del cliente NUEVO (número diferente)
    const userJid = '573001234567@s.whatsapp.net';
    const shortUserId = '573001234567';
    const userName = 'Cliente Nuevo';
    const userMessage = 'Hola, necesito información sobre habitaciones disponibles';
    
    console.log(`📱 Cliente: ${userName} (${shortUserId})`);
    console.log(`💬 Mensaje: "${userMessage}"\n`);
    
    // Verificar si tiene thread
    const existingThread = getThread(shortUserId);
    console.log(`🔍 Thread existente: ${existingThread ? 'SÍ' : 'NO'}`);
    
    if (!existingThread) {
        console.log('✨ Cliente NUEVO - Se incluirá historial de conversación\n');
        
        // Construir contexto completo
        const timeContext = getCurrentTimeContext();
        const conversationalContext = '=== CONTEXTO CONVERSACIONAL ===\nCLIENTE: Alexander\nETIQUETAS: Colega Jefe, cotización\n=== FIN CONTEXTO ===';
        
        // Simular historial (versión simplificada para demo)
        const chatHistoryContext = `=== HISTORIAL DE CONVERSACIÓN ===
Total de mensajes en historial: 2300
Mostrando últimos 50 mensajes:

--- 03/01/25 ---
15:49 - Asistente: Si alguna de estas opciones te interesa...
15:55 - Cliente: Hola qué tal
15:55 - Asistente: ¡Hola! 😊 Todo va muy bien...
16:04 - Cliente: Hola
16:04 - Cliente: Q hay
16:04 - Asistente: ¡Hola! 😊 Estoy aquí para ayudarte...
[... más mensajes ...]

=== FIN HISTORIAL ===`;
        
        // Construir mensaje completo
        let messageWithContexts = timeContext + '\n\n' + conversationalContext;
        messageWithContexts += '\n\n' + chatHistoryContext;
        messageWithContexts += '\n\n' + userMessage;
        
        console.log('📄 CONTENIDO COMPLETO ENVIADO A OPENAI:');
        console.log('─'.repeat(70));
        console.log(messageWithContexts);
        console.log('─'.repeat(70));
        
        console.log(`\n📊 Estadísticas:`);
        console.log(`- Contexto temporal: ${timeContext.length} caracteres`);
        console.log(`- Contexto conversacional: ${conversationalContext.length} caracteres`);
        console.log(`- Historial de chat: ${chatHistoryContext.length} caracteres`);
        console.log(`- Mensaje del usuario: ${userMessage.length} caracteres`);
        console.log(`- TOTAL: ${messageWithContexts.length} caracteres`);
        
    } else {
        console.log('♻️ Cliente CONOCIDO - Usando thread existente\n');
        console.log(`Thread ID: ${existingThread.threadId}`);
        console.log(`Creado: ${existingThread.createdAt}`);
        console.log(`Última actividad: ${existingThread.lastActivity}`);
    }
}

// Ejecutar la prueba
testNewClientContext(); 