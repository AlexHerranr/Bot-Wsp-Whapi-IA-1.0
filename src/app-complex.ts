import express from 'express';
import bodyParser from 'body-parser';
import * as dotenv from 'dotenv';
import { toAsk } from './utils/ai/index.js';
import { threadPersistence } from './utils/persistence/index.js';
import fs from 'fs';

dotenv.config();

const PORT = process.env.PORT ?? 3008;
const WHAPI_TOKEN = process.env.WHAPI_TOKEN || '';
const WHAPI_API_URL = process.env.WHAPI_API_URL || 'https://gate.whapi.cloud';
const ASSISTANT_ID = process.env.ASSISTANT_ID ?? '';

// --- Constantes de Tiempo ---
const USER_INACTIVITY_TIMEOUT_MS = 6000; // 6 segundos para agrupar mensajes del usuario
const CHUNK_DELAY_MS = 150; // Delay entre chunks de respuesta
const DEBUG_MODE = true;
const DEBUG_LOG_PATH = './logs/bot-simple.log';

// --- Funciones de Logging Simples ---
const getFormattedTimestamp = () => {
    const now = new Date();
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    const time = now.toLocaleTimeString('es-CO', timeOptions);
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${time},${ms}`;
};

const log = (context: string, level: string, message: string, userId?: string) => {
    const timestamp = getFormattedTimestamp();
    const userPrefix = userId ? `[${userId.slice(-4)}] ` : '';
    const logLine = `[${timestamp}] ${userPrefix}${context}: ${message}`;
    
    console.log(logLine);
    
    if (DEBUG_MODE) {
        try {
            if (!fs.existsSync('./logs')) {
                fs.mkdirSync('./logs', { recursive: true });
            }
            fs.appendFileSync(DEBUG_LOG_PATH, logLine + '\n');
        } catch (e) {
            console.error(`Error escribiendo al log: ${e.message}`);
        }
    }
};

// --- Utilidades ---
const getShortUserId = (chatId: string) => {
    return chatId.replace('@s.whatsapp.net', '');
};

// --- Estado global simple ---
const userMessageBuffers = new Map<string, {
    messages: string[];
    chatId: string;
    name: string;
    lastActivity: number;
}>();

const userActivityTimers = new Map<string, NodeJS.Timeout>();

// --- Función para obtener contexto de WhatsApp (solo para nuevos clientes) ---
async function getWhatsAppContextForNewClient(userId: string): Promise<{name: string, isFirstTime: boolean}> {
    try {
        const endpoint = `${WHAPI_API_URL}/chats/${userId}@s.whatsapp.net?token=${WHAPI_TOKEN}`;
        const response = await fetch(endpoint);
        
        if (response.ok) {
            const chatData = await response.json();
            const name = chatData.name || 'Cliente';
            return { name, isFirstTime: true };
        }
    } catch (error) {
        log('WHAPI_CONTEXT', 'ERROR', `Error obteniendo contexto: ${error.message}`, userId);
    }
    
    return { name: 'Cliente', isFirstTime: true };
}

// --- Función para procesar mensajes agrupados ---
async function processUserMessage(userId: string) {
    const buffer = userMessageBuffers.get(userId);
    if (!buffer) return;

    const messageCount = buffer.messages.length;
    const combinedMessage = buffer.messages.join('\n');
    const shortUserId = userId.slice(-4);
    
    log('TIMEOUT', 'INFO', `Procesando ${messageCount} mensajes combinados: "${combinedMessage.substring(0,50)}..."`, shortUserId);
    
    // Limpiar buffer
    userMessageBuffers.delete(userId);
    userActivityTimers.delete(userId);

    try {
        // PASO 1: Buscar thread local
        const threadSearchStart = Date.now();
        const existingThread = threadPersistence.getThread(userId);
        const threadSearchTime = ((Date.now() - threadSearchStart) / 1000).toFixed(3);
        
        let clientContext = '';
        
        if (existingThread) {
            // Cliente existente - rápido
            log('THREAD_FOUND', 'INFO', 
                `Thread: ${existingThread.threadId.slice(-6)} (${existingThread.messageCount} msgs)`, shortUserId);
            clientContext = 'Cliente conocido';
        } else {
            // Cliente nuevo - obtener contexto
            log('THREAD_NEW', 'INFO', 'Creando nuevo thread...', shortUserId);
            const contextData = await getWhatsAppContextForNewClient(userId);
            log('CONTEXT_OK', 'INFO', `Cliente: ${contextData.name}, primera vez`, shortUserId);
            clientContext = `Cliente: ${contextData.name}, primera vez`;
        }

        // PASO 2: Procesar con OpenAI
        log('OPENAI_START', 'INFO', 
            `Enviando a OpenAI: Thread: ${existingThread ? existingThread.threadId.slice(-6) : 'nuevo'}`, shortUserId);
        
        const aiStart = Date.now();
        const response = await toAsk(ASSISTANT_ID, combinedMessage, userId);
        const aiTime = ((Date.now() - aiStart) / 1000).toFixed(2);
        
        log('OPENAI_OK', 'INFO', 
            `Respuesta obtenida en ${aiTime}s (${response.length} caracteres)`, shortUserId);
        
        // PASO 3: Enviar respuesta
        const sendStart = Date.now();
        await sendMessage(buffer.chatId, response);
        const sendTime = ((Date.now() - sendStart) / 1000).toFixed(2);
        
        log('SENT_OK', 'INFO', `Enviada WhatsApp: ${sendTime}s`, shortUserId);
        
    } catch (error) {
        log('ERROR', 'ERROR', `Error procesando: ${error.message}`, shortUserId);
        await sendMessage(buffer.chatId, 'Disculpa, hubo un error. Por favor intenta de nuevo.');
    }
}

// --- Función para enviar mensajes ---
async function sendMessage(to: string, text: string) {
    const endpoint = `${WHAPI_API_URL}/messages/text?token=${WHAPI_TOKEN}`;
    
    try {
        // Enviar respuesta en chunks si es muy larga
        const chunks = text.split(/\n\n+/);
        
        for (const chunk of chunks) {
            const cleanedChunk = chunk.trim();
            if (cleanedChunk) {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        to: to,
                        body: cleanedChunk,
                        typing_time: 2
                    })
                });
                
                const result = await response.json();
                if (!result.sent) {
                    log('SEND_ERROR', 'ERROR', `Error enviando chunk: ${result.error || 'Error desconocido'}`);
                }
                
                // Delay entre chunks
                if (chunks.length > 1) {
                    await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY_MS));
                }
            }
        }
        
        return { sent: true };
    } catch (error) {
        log('SEND_ERROR', 'ERROR', `Error enviando mensaje: ${error.message}`);
        throw error;
    }
}

// --- Crear servidor Express ---
const app = express();
app.use(bodyParser.json());

// Health check
app.get('/', (req, res) => {
    res.send('Bot TeAlquilamos - Versión Simplificada');
});

// Endpoint básico para estadísticas
app.get('/stats', (req, res) => {
    const stats = threadPersistence.getStats();
    res.json({
        success: true,
        data: {
            threads: stats,
            activeBuffers: userMessageBuffers.size,
            activeTimers: userActivityTimers.size,
            timestamp: new Date().toISOString()
        }
    });
});

// --- Webhook principal ---
app.post('/', async (req, res) => {
    try {
        const body = req.body;
        
        if (body.messages && body.messages.length > 0) {
            const message = body.messages[0];
            
            // Ignorar mensajes del propio bot
            if (message.from_me) {
                log('IGNORE', 'DEBUG', 'Mensaje del bot ignorado');
                return res.status(200).send('OK - Bot message ignored');
            }
            
            const chatId = message.chat_id;
            const text = message.text?.body || 'Mensaje sin texto';
            const userId = getShortUserId(chatId);
            const name = message.from_name || 'Cliente';
            const shortUserId = userId.slice(-4);
            
            // Log del mensaje recibido
            log('MSG_IN', 'INFO', `"${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`, shortUserId);
            
            // Gestionar buffer de mensajes
            if (!userMessageBuffers.has(userId)) {
                userMessageBuffers.set(userId, {
                    messages: [],
                    chatId: chatId,
                    name: name,
                    lastActivity: Date.now()
                });
                log('BUFFER_NEW', 'INFO', 'Nuevo buffer creado', shortUserId);
            }
            
            const buffer = userMessageBuffers.get(userId)!;
            buffer.messages.push(text);
            buffer.lastActivity = Date.now();
            
            log('BUFFER_ADD', 'INFO', `Mensaje añadido al buffer. Total: ${buffer.messages.length}`, shortUserId);
            
            // Reiniciar el temporizador de inactividad
            if (userActivityTimers.has(userId)) {
                clearTimeout(userActivityTimers.get(userId)!);
            }
            
            // Establecer nuevo temporizador
            const timerId = setTimeout(async () => {
                await processUserMessage(userId);
            }, USER_INACTIVITY_TIMEOUT_MS);
            
            userActivityTimers.set(userId, timerId);
            log('TIMER_SET', 'INFO', `Temporizador de inactividad (${USER_INACTIVITY_TIMEOUT_MS/1000}s) iniciado`, shortUserId);
        }
        
        res.status(200).send('OK');
    } catch (error) {
        log('WEBHOOK_ERROR', 'ERROR', `Error procesando webhook: ${error.message}`);
        res.status(500).send('Error');
    }
});

// --- Inicializar sistema ---
const main = async () => {
    try {
        // Inicializar archivo de log
        if (DEBUG_MODE) {
            if (!fs.existsSync('./logs')) {
                fs.mkdirSync('./logs', { recursive: true });
            }
            fs.writeFileSync(DEBUG_LOG_PATH, `--- Bot Simple iniciado ${new Date().toISOString()} ---\n`);
        }
        
        log('MAIN', 'INFO', `Iniciando bot en puerto ${PORT}`);
        
        if (!ASSISTANT_ID) {
            log('MAIN', 'ERROR', 'Variable ASSISTANT_ID no configurada. Saliendo.');
            process.exit(1);
        }
        
        if (!WHAPI_TOKEN) {
            log('MAIN', 'ERROR', 'Variable WHAPI_TOKEN no configurada. Saliendo.');
            process.exit(1);
        }
        
        // Iniciar servidor
        app.listen(PORT, () => {
            console.log('\n' + '='.repeat(50));
            console.log('🚀 BOT TEALQUILAMOS - VERSIÓN SIMPLE');
            console.log('='.repeat(50));
            console.log(`✅ Puerto: ${PORT}`);
            console.log(`✅ WhatsApp Business: Conectado (Whapi)`);
            console.log(`✅ OpenAI Assistant: Activo`);
            console.log(`✅ Tiempo de espera: ${USER_INACTIVITY_TIMEOUT_MS/1000} segundos para agrupar mensajes`);
            console.log('='.repeat(50));
            console.log('📱 Esperando mensajes...\n');
        });
        
    } catch (error) {
        log('MAIN', 'ERROR', `Error fatal al iniciar: ${error.message}`);
        process.exit(1);
    }
};

// --- Manejo de errores y cierre ---
process.on('unhandledRejection', (reason) => {
    log('SYSTEM', 'ERROR', `Unhandled Rejection: ${reason}`);
});

process.on('SIGINT', () => {
    console.log('\n⏹️  Cerrando bot...');
    
    // Guardar threads
    threadPersistence.saveThreads();
    console.log('✅ Conversaciones guardadas');
    
    console.log('👋 Bot cerrado correctamente\n');
    process.exit(0);
});

// Iniciar el bot
main();
