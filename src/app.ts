import "dotenv/config";
import express from 'express';
import OpenAI from 'openai';
import fs from 'fs';
import { 
    detailedLog, 
    logInfo, 
    logSuccess, 
    logError, 
    logWarning,
    logDebug,
    logThreadPersist,
    logOpenAIRequest,
    logOpenAIResponse,
    logWhatsAppMessage,
    logBufferActivity
} from './utils/logger.js';
import { threadPersistence } from './utils/persistence/index.js';
import { isLikelyFinalMessage, getRecommendedTimeout, getBufferStats } from './utils/messageBuffering.js';
import { recordTypingEvent, recordMessage, hasTypingSupport, getTypingStats, getUserTypingInfo } from './utils/typingDetector.js';

// --- Configuración Inicial ---
const PORT = process.env.PORT ?? 3008;
const ASSISTANT_ID = process.env.ASSISTANT_ID ?? '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const WHAPI_TOKEN = process.env.WHAPI_TOKEN ?? '';
const WHAPI_API_URL = process.env.WHAPI_API_URL ?? 'https://gate.whapi.cloud/';

const DEBUG_LOG_PATH = './whatsapp-sync-debug.log';
const DEBUG_MODE = true;

// --- Colores para logs de consola ---
const LOG_COLORS = {
    USER: '\x1b[36m',    // Cyan
    BOT: '\x1b[32m',     // Green
    AGENT: '\x1b[33m',   // Yellow
    TIMESTAMP: '\x1b[94m', // Light Blue
    RESET: '\x1b[0m'     // Reset
};

// --- Función para timestamp compacto ---
const getCompactTimestamp = (): string => {
    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const month = months[now.getMonth()];
    const day = now.getDate();
    let hour = now.getHours();
    const minute = now.getMinutes().toString().padStart(2, '0');
    const ampm = hour >= 12 ? 'p' : 'a';
    
    hour = hour % 12;
    if (hour === 0) hour = 12;
    
    return `${month}${day} [${hour}:${minute}${ampm}]`;
};

// --- Constantes de Tiempo ---
const DEFAULT_TIMEOUT_MS = 3000; // Timeout máximo por defecto
const MIN_TIMEOUT_MS = 800;      // Timeout mínimo para mensajes finales

// --- Inicialización ---
const app = express();
app.use(express.json());

let openai;
if (OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    logSuccess('OPENAI_INIT', 'SDK de OpenAI inicializado correctamente');
} else {
    logError('OPENAI_INIT', 'OPENAI_API_KEY no está configurada en el archivo .env');
    process.exit(1);
}

// --- Funciones de Extracción de Información del Contacto ---
const cleanContactName = (rawName) => {
    if (!rawName || typeof rawName !== 'string') return 'Usuario';
    
    // Limpiar caracteres especiales y espacios extra
    let cleaned = rawName
        .trim()
        .replace(/\s*-\s*$/, '')  // Remover guión al final
        .replace(/\s+/g, ' ')     // Espacios múltiples a uno solo
        .replace(/[^\w\s\u00C0-\u017F]/g, '') // Solo letras, números y acentos
        .trim();
    
    // Si queda vacío después de limpiar, usar default
    if (!cleaned) return 'Usuario';
    
    // Capitalizar primera letra de cada palabra
    cleaned = cleaned.replace(/\b\w/g, l => l.toUpperCase());
    
    logDebug('NAME_EXTRACTION', 'Nombre limpiado', { 
        original: rawName, 
        cleaned: cleaned 
    });
    
    return cleaned;
};

// Función opcional para obtener información adicional del contacto desde Whapi
const getEnhancedContactInfo = async (userId, chatId) => {
    try {
        const endpoint = `${WHAPI_API_URL}/chats/${encodeURIComponent(chatId)}?token=${WHAPI_TOKEN}`;
        
        logDebug('CONTACT_API', `Obteniendo info adicional del contacto ${userId}`);
        
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            const chatData = await response.json();
            
            const enhancedInfo = {
                name: cleanContactName(chatData.name || chatData.first_name || 'Usuario'),
                labels: chatData.labels || [],
                lastSeen: chatData.last_message?.timestamp,
                isContact: !!chatData.name, // Si tiene nombre, está en contactos
                profilePic: chatData.profile_pic_url
            };
            
            logSuccess('CONTACT_API', `Info adicional obtenida para ${userId}`, {
                hasName: !!enhancedInfo.name,
                hasLabels: enhancedInfo.labels.length > 0,
                isContact: enhancedInfo.isContact
            });
            
            return enhancedInfo;
        } else {
            logWarning('CONTACT_API', `No se pudo obtener info adicional para ${userId}: ${response.status}`);
        }
    } catch (error) {
        logError('CONTACT_API', `Error obteniendo info del contacto ${userId}`, { 
            error: error.message 
        });
    }
    
    return { name: 'Usuario', labels: [], isContact: false };
};

// --- Funciones de Logging (Mantenidas para compatibilidad) ---
const getFormattedTimestamp = () => {
    const now = new Date();
    const time = now.toLocaleTimeString('es-CO', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: false 
    });
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${time},${ms}`;
};

const log = (context, level, message) => {
    // Mapear al nuevo sistema de logging
    const logLevel = level === 'ERROR' ? 'ERROR' : level === 'WARN' ? 'WARNING' : 'INFO';
    detailedLog(logLevel, context, message);
    
    // Mantener el archivo de debug original si está habilitado (solo archivos, no consola)
    if (DEBUG_MODE) {
        const timestamp = getFormattedTimestamp();
        const logLine = `[${timestamp}] [${context}] ${message}`;
        try {
            fs.appendFileSync(DEBUG_LOG_PATH, logLine + '\n');
        } catch (e) {
            logError('DEBUG_FILE', `Error escribiendo al log: ${e.message}`);
        }
    }
};

// --- Función para mostrar estadísticas en tiempo real ---
const showLiveStats = () => {
    const stats = threadPersistence.getStats();
    
    console.log(`\n┌─────────────────────────────────────────────┐`);
    console.log(`│ 📊 Estado del Sistema - En Vivo            │`);
    console.log(`├─────────────────────────────────────────────┤`);
    console.log(`│ 👥 Clientes activos: ${userMessageBuffers.size.toString().padEnd(17)} │`);
    console.log(`│ 🔧 Buffers manuales: ${manualMessageBuffers.size.toString().padEnd(17)} │`);
    console.log(`│ 🧠 Threads OpenAI: ${stats.totalThreads.toString().padEnd(19)} │`);
    console.log(`│ 🛡️  Mensajes bot tracked: ${botSentMessages.size.toString().padEnd(11)} │`);
    console.log(`└─────────────────────────────────────────────┘\n`);
};

// --- Utilidades ---
const getShortUserId = (jid) => {
    if (typeof jid === 'string') {
        // Extraer solo el número, sin @s.whatsapp.net o cualquier otro sufijo
        const cleaned = jid.split('@')[0] || jid;
        // Solo log técnico (sin spam en consola)
        logDebug('USER_ID_EXTRACTION', `Extrayendo ID de usuario`, { 
            original: jid, 
            cleaned: cleaned 
        });
        return cleaned;
    }
    return 'unknown';
};

// --- Estado Global ---
const userMessageBuffers = new Map();
const userActivityTimers = new Map();
const userTypingState = new Map(); // Nuevo: estado simple de typing

// --- Sistema de Tracking de Mensajes del Bot ---
const botSentMessages = new Set<string>(); // Trackear IDs de mensajes enviados por el bot

// --- Sistema de Agrupación de Mensajes Manuales ---
const manualMessageBuffers = new Map<string, {
    messages: string[],
    agentName: string,
    timestamp: number
}>();
const manualTimers = new Map<string, NodeJS.Timeout>();
const MANUAL_MESSAGE_TIMEOUT = 8000; // 8 segundos, igual que los clientes

// --- Funciones de Thread usando threadPersistence ---
const saveThreadId = (jid, threadId, chatId = null, userName = null) => {
    if (!jid || !threadId) {
        logWarning('THREAD_SAVE', `Intento de guardar thread inválido`, { jid, threadId });
        return false;
    }
    const clientPhone = getShortUserId(jid);
    
    // Usar threadPersistence con información completa
    const fullChatId = chatId || `${clientPhone}@s.whatsapp.net`;
    const name = userName || 'Usuario';
    
    threadPersistence.setThread(clientPhone, threadId, fullChatId, name);
    logThreadPersist(clientPhone, threadId, 'saved');
    
    // Log del estado actualizado
    const stats = threadPersistence.getStats();
    logInfo('THREAD_STATE', 'Estado de threads actualizado', stats);
    
    return true;
};

const getThreadId = (jid) => {
    if (!jid) {
        logWarning('THREAD_GET', 'Intento de obtener thread con jid nulo');
        return null;
    }
    const clientPhone = getShortUserId(jid);
    
    // Usar threadPersistence en lugar de clientThreadMap
    const threadInfo = threadPersistence.getThread(clientPhone);
    const threadId = threadInfo?.threadId || null;
    
    logDebug('THREAD_LOOKUP', `Búsqueda de thread`, {
        userJid: jid,
        cleanedId: clientPhone,
        found: !!threadId,
        threadId: threadId,
        threadInfo: threadInfo
    });
    
    if (threadId) {
        logInfo('THREAD_GET', `Thread encontrado para ${clientPhone} (${threadInfo.userName}): ${threadId}`, {
            chatId: threadInfo.chatId,
            userName: threadInfo.userName,
            lastActivity: new Date(threadInfo.lastActivity).toISOString()
        });
    } else {
        logInfo('THREAD_GET', `No existe thread para ${clientPhone}`, {
            searchedKey: clientPhone
        });
    }
    
    return threadId;
};

// --- Procesamiento OpenAI (Simple) ---
const processWithOpenAI = async (userMsg, userJid, chatId = null, userName = null) => {
    const shortUserId = getShortUserId(userJid);
    const startTime = Date.now();
    
    logInfo('USER_DEBUG', `UserJid para búsqueda: "${userJid}"`, { 
        originalFormat: userJid,
        cleanedFormat: shortUserId,
        chatId: chatId,
        userName: userName
    });
    
    try {
        // Verificar thread existente ANTES de crear
        let threadId = getThreadId(userJid);
        
        const stats = threadPersistence.getStats();
        logInfo('THREAD_CHECK', 
            threadId ? `Thread encontrado: ${threadId}` : 'No se encontró thread existente',
            { userJid, shortUserId, threadId, totalThreads: stats.totalThreads }
        );
        
        if (!threadId) {
            logOpenAIRequest(shortUserId, 'creating_new_thread');
            const thread = await openai.beta.threads.create();
            threadId = thread.id;
            
            // Guardar con información completa del cliente
            saveThreadId(userJid, threadId, chatId, userName);
            
            logOpenAIRequest(shortUserId, 'thread_created', threadId);
            logSuccess('THREAD_NEW', `Nuevo thread creado para ${shortUserId} (${userName})`, { 
                threadId,
                userJid: userJid,
                cleanedId: shortUserId,
                chatId: chatId,
                userName: userName
            });
        } else {
            logSuccess('THREAD_REUSE', `Reutilizando thread existente para ${shortUserId} (${userName || 'Usuario'})`, {
                threadId,
                userJid: userJid,
                cleanedId: shortUserId
            });
        }
        
        // Agregar mensaje del usuario
        logOpenAIRequest(shortUserId, 'adding_message', threadId);
        await openai.beta.threads.messages.create(threadId, {
            role: 'user',
            content: userMsg
        });
        
        // Actualizar actividad del thread
        const threadInfo = threadPersistence.getThread(shortUserId);
        if (threadInfo) {
            threadPersistence.setThread(shortUserId, threadId, threadInfo.chatId, threadInfo.userName);
        }
        
        logOpenAIRequest(shortUserId, 'message_added', threadId);
        logDebug('MESSAGE_DETAIL', `Mensaje agregado al thread`, {
            threadId,
            messageLength: userMsg.length,
            messagePreview: userMsg.substring(0, 100)
        });
        
        // Crear y ejecutar run
        logOpenAIRequest(shortUserId, 'creating_run', threadId);
        let run = await openai.beta.threads.runs.create(threadId, {
            assistant_id: ASSISTANT_ID
        });
        
        logOpenAIRequest(shortUserId, 'run_started', run.id);
        
        // Esperar respuesta
        let attempts = 0;
        const maxAttempts = 60;
        
        while (['queued', 'in_progress'].includes(run.status) && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 500));
            run = await openai.beta.threads.runs.retrieve(threadId, run.id);
            attempts++;
            
            if (attempts % 10 === 0) {
                logInfo('OPENAI_POLLING', `Esperando respuesta para ${shortUserId}, intento ${attempts}/${maxAttempts}, estado: ${run.status}`);
            }
        }
        
        const duration = Date.now() - startTime;
        
        if (run.status !== 'completed') {
            logError('OPENAI_RUN', `OpenAI no completó para ${shortUserId}. Estado: ${run.status}`, { 
                runId: run.id, 
                threadId, 
                attempts, 
                duration 
            });
            logOpenAIResponse(shortUserId, duration, false, userName);
            return 'Lo siento, hubo un problema procesando tu mensaje. Por favor intenta de nuevo.';
        }
        
        // Obtener respuesta
        logOpenAIRequest(shortUserId, 'retrieving_messages', threadId);
        const messages = await openai.beta.threads.messages.list(threadId);
        const assistantMessage = messages.data.find(m => m.role === 'assistant');
        
        if (!assistantMessage?.content[0]) {
            logError('OPENAI_RESPONSE', `No se encontró respuesta del asistente para ${shortUserId}`, { threadId });
            logOpenAIResponse(shortUserId, duration, false, userName);
            return 'No pude generar una respuesta. Por favor intenta de nuevo.';
        }
        
        const response = assistantMessage.content[0].text.value;
        logOpenAIResponse(shortUserId, duration, true, userName);
        logInfo('OPENAI_RESPONSE', `Respuesta obtenida para ${shortUserId}`, { 
            responseLength: response.length,
            preview: response.substring(0, 100) + '...',
            threadId,
            messageCount: messages.data.length,
            userName: userName
        });
        
        return response;
        
    } catch (error) {
        const duration = Date.now() - startTime;
        logError('OPENAI_ERROR', `Error procesando mensaje para ${shortUserId}`, { 
            error: error.message, 
            stack: error.stack,
            duration,
            userJid,
            shortUserId
        });
        logOpenAIResponse(shortUserId, duration, false, userName);
        return 'Lo siento, hubo un error procesando tu mensaje. Por favor intenta de nuevo.';
    }
};

// --- Envío de mensaje a WhatsApp ---
const sendToWhatsApp = async (chatId, message) => {
    const shortUserId = getShortUserId(chatId);
    
    try {
        logInfo('WHATSAPP_SEND', `Enviando mensaje a ${shortUserId}`, { 
            chatId,
            messageLength: message.length,
            preview: message.substring(0, 100) + '...'
        });
        
        const response = await fetch(`${WHAPI_API_URL}/messages/text?token=${WHAPI_TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: chatId,
                body: message,
                typing_time: 3
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            
            // 🔧 TRACKING: Registrar ID del mensaje enviado por el bot
            if (result.sent && result.message?.id) {
                botSentMessages.add(result.message.id);
                logDebug('BOT_MESSAGE_TRACKED', `Mensaje del bot registrado para tracking anti-duplicación`, {
                    shortUserId: shortUserId,
                    messageId: result.message.id,
                    messageLength: message.length,
                    timestamp: new Date().toISOString()
                });
                
                // Limpiar después de 10 minutos para evitar que crezca infinitamente
                setTimeout(() => {
                    botSentMessages.delete(result.message.id);
                    logDebug('BOT_MESSAGE_CLEANUP', `ID limpiado del tracking`, {
                        messageId: result.message.id,
                        cleanupAfterMinutes: 10
                    });
                }, 10 * 60 * 1000);
            }
            
            // Solo logs técnicos (sin log en consola, ya se muestra en processUserMessage)
            logWhatsAppMessage(shortUserId, 'OUT', message.substring(0, 50) + '...', 'Usuario');
            logSuccess('WHATSAPP_SEND', `Mensaje enviado exitosamente`, {
                shortUserId: shortUserId,
                messageLength: message.length,
                messageId: result.message?.id,
                responseTime: Date.now() - Date.now() // Esto se puede mejorar con un timestamp inicial
            });
            return true;
        } else {
            const errorText = await response.text();
            logError('WHATSAPP_SEND', `Error enviando mensaje a ${shortUserId}`, { 
                status: response.status,
                statusText: response.statusText,
                error: errorText
            });
            return false;
        }
    } catch (error) {
        logError('WHATSAPP_SEND', `Error de red enviando a ${shortUserId}`, { 
            error: error.message,
            stack: error.stack
        });
        return false;
    }
};

// --- Procesamiento de mensajes del usuario (como Baileys) ---
const processUserMessage = async (userId) => {
    const buffer = userMessageBuffers.get(userId);
    if (!buffer || buffer.messages.length === 0) {
        logWarning('MESSAGE_PROCESS', `Buffer vacío o inexistente para ${getShortUserId(userId)}`);
        return;
    }
    
    const shortUserId = getShortUserId(userId);
    const combinedMessage = buffer.messages.join('\n\n');
    
    // Solo logs técnicos
    logBufferActivity(shortUserId, 'processing_combined_messages', buffer.messages.length);
    logInfo('MESSAGE_PROCESS', `Procesando mensajes agrupados`, {
        userId,
        shortUserId: shortUserId,
        chatId: buffer.chatId,
        messageCount: buffer.messages.length,
        totalLength: combinedMessage.length,
        preview: combinedMessage.substring(0, 100) + '...'
    });
    
    // 🎯 Log compacto - Inicio con colores
    const timestamp1 = getCompactTimestamp();
    console.log(`${LOG_COLORS.TIMESTAMP}${timestamp1}${LOG_COLORS.RESET} ${LOG_COLORS.BOT}[BOT]${LOG_COLORS.RESET} 🤖 ${buffer.messages.length} msgs → OpenAI`);
    
    // Enviar a OpenAI con el userId original y la información completa del cliente
    const startTime = Date.now();
    const response = await processWithOpenAI(combinedMessage, userId, buffer.chatId, buffer.name);
    const aiDuration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    // 🎯 Log compacto - Resultado con preview
    const preview = response.length > 50 ? response.substring(0, 50) + '...' : response;
    const timestamp2 = getCompactTimestamp();
    console.log(`${LOG_COLORS.TIMESTAMP}${timestamp2}${LOG_COLORS.RESET} ${LOG_COLORS.BOT}[BOT]${LOG_COLORS.RESET} ✅ Completado (${aiDuration}s) → 💬 "${preview}"`);
    
    // Enviar respuesta a WhatsApp
    await sendToWhatsApp(buffer.chatId, response);
    
    // Limpiar buffer
    userMessageBuffers.delete(userId);
    userActivityTimers.delete(userId);
    logBufferActivity(shortUserId, 'buffer_cleared');
};

// --- Health Check ---
app.get('/', (req, res) => {
    const stats = threadPersistence.getStats();
    const typingStats = getTypingStats();
    const status = { 
        status: 'Bot funcionando', 
        timestamp: new Date().toISOString(),
        version: 'bot-with-manual-sync-v2',
        activeThreads: stats.totalThreads,
        activeBuffers: userMessageBuffers.size,
        activeManualBuffers: manualMessageBuffers.size,
        activeTyping: userTypingState.size,
        botTrackedMessages: botSentMessages.size,
        threadStats: stats,
        typingSystem: typingStats,
        systemHealth: {
            clientBuffers: userMessageBuffers.size,
            manualBuffers: manualMessageBuffers.size,
            trackedBotMessages: botSentMessages.size,
            activeTimers: userActivityTimers.size + manualTimers.size
        }
    };
    
    logInfo('HEALTH_CHECK', 'Health check solicitado', status);
    res.json(status);
});

// --- Webhook de Whapi ---
app.post('/hook', async (req, res) => {
    try {
        const { messages, presences } = req.body;
        
        // Log de eventos de typing (si llegaran)
        if (presences && Array.isArray(presences)) {
            presences.forEach(presence => {
                const userId = presence.participant;
                const presenceType = presence.type;
                const shortUserId = getShortUserId(userId);
                
                logInfo('PRESENCE', `🔤 ${shortUserId}: ${presenceType}`);
                
                // Registrar evento de typing (aunque no lleguen con el mismo número)
                if (presenceType === 'composing') {
                    recordTypingEvent(userId);
                    userTypingState.set(userId, { isTyping: true, timestamp: Date.now() });
                    logSuccess('TYPING_ACTIVE', `✍️ Cliente escribiendo...`);
                } else if (presenceType === 'paused') {
                    userTypingState.delete(userId);
                    logInfo('TYPING_PAUSED', `⏸️ Cliente pausó escritura`);
                }
            });
        }
        
        if (!messages || !Array.isArray(messages)) {
            logWarning('WEBHOOK', 'Webhook recibido sin mensajes válidos', { body: req.body });
            res.status(200).send('OK');
            return;
        }
        
        logInfo('WEBHOOK', `Procesando ${messages.length} mensajes del webhook`);
        
        for (const message of messages) {
            // 🔧 PROCESAR MENSAJES MANUALES DEL AGENTE (from_me: true)
            if (message.from_me && message.type === 'text' && message.text?.body) {
                
                // 🚫 FILTRAR: Verificar si es un mensaje del bot (no manual)
                if (botSentMessages.has(message.id)) {
                    logDebug('BOT_MESSAGE_FILTERED', `Mensaje del bot ignorado: ${message.id}`);
                    continue; // Saltar, no es un mensaje manual real
                }
                
                // ✅ Es un mensaje manual real del agente
                const chatId = message.chat_id;
                const text = message.text.body.trim();
                const fromName = message.from_name || 'Agente';
                const shortClientId = getShortUserId(chatId);
                
                // Verificar si hay thread activo
                const threadId = getThreadId(chatId);
                if (!threadId) {
                    const timestamp3 = getCompactTimestamp();
                    console.log(`${LOG_COLORS.TIMESTAMP}${timestamp3}${LOG_COLORS.RESET} ${LOG_COLORS.AGENT}[AGENT]${LOG_COLORS.RESET} ⚠️  Sin conversación activa con ${shortClientId}`);
                    // Solo log técnico
                    logWarning('MANUAL_NO_THREAD', `No hay conversación activa`, { 
                        shortClientId: shortClientId,
                        agentName: fromName,
                        reason: 'cliente_debe_escribir_primero'
                    });
                    continue;
                }
                
                // 🎯 Log compacto - Solo primer mensaje del grupo
                if (!manualMessageBuffers.has(chatId)) {
                    // Obtener nombre del cliente en lugar del número
                    const threadInfo = threadPersistence.getThread(shortClientId);
                    const clientName = threadInfo?.userName || 'Cliente';
                    const timestamp4 = getCompactTimestamp();
                    console.log(`${LOG_COLORS.TIMESTAMP}${timestamp4}${LOG_COLORS.RESET} ${LOG_COLORS.AGENT}[AGENT]${LOG_COLORS.RESET} 🔧 ${fromName} → ${clientName}: "${text.substring(0, 25)}${text.length > 25 ? '...' : ''}"`);
                }
                
                // Solo log técnico detallado
                logInfo('MANUAL_DETECTED', `Mensaje manual del agente detectado`, {
                    shortClientId: shortClientId,
                    agentName: fromName,
                    messageText: text.substring(0, 100),
                    messageLength: text.length,
                    timestamp: new Date().toISOString(),
                    chatId: chatId
                });
                
                // 📦 AGRUPAR MENSAJES MANUALES (igual que clientes)
                if (!manualMessageBuffers.has(chatId)) {
                    manualMessageBuffers.set(chatId, {
                        messages: [],
                        agentName: fromName,
                        timestamp: Date.now()
                    });
                    logInfo('MANUAL_BUFFER_CREATE', `Buffer manual creado`, { 
                        shortClientId: shortClientId, 
                        agentName: fromName 
                    });
                }
                
                const buffer = manualMessageBuffers.get(chatId)!;
                buffer.messages.push(text);
                
                // Solo log técnico
                logInfo('MANUAL_BUFFERING', `Mensaje manual agregado al buffer`, {
                    shortClientId: shortClientId,
                    bufferCount: buffer.messages.length,
                    agentName: fromName,
                    timeoutSeconds: 8
                });
                
                // Cancelar timer anterior si existe
                if (manualTimers.has(chatId)) {
                    clearTimeout(manualTimers.get(chatId)!);
                }
                
                // Establecer nuevo timer de 8 segundos
                const timerId = setTimeout(async () => {
                    const finalBuffer = manualMessageBuffers.get(chatId);
                    if (finalBuffer && finalBuffer.messages.length > 0) {
                        const combinedMessage = finalBuffer.messages.join(' ');
                        
                        try {
                            // Solo logs técnicos
                            logInfo('MANUAL_PROCESSING', `Procesando mensajes manuales agrupados`, {
                                shortClientId: shortClientId,
                                messageCount: finalBuffer.messages.length,
                                agentName: finalBuffer.agentName,
                                combinedLength: combinedMessage.length,
                                preview: combinedMessage.substring(0, 100),
                                threadId: threadId
                            });
                            
                            logInfo('MANUAL_SYNC_START', `Iniciando sincronización con OpenAI`, {
                                shortClientId: shortClientId,
                                threadId: threadId,
                                messagePreview: combinedMessage.substring(0, 50),
                                agentName: finalBuffer.agentName
                            });
                            
                            // 1. Agregar contexto del sistema
                            await openai.beta.threads.messages.create(threadId, {
                                role: 'user',
                                content: `[NOTA DEL SISTEMA: Un agente humano (${finalBuffer.agentName}) ha respondido directamente al cliente]`
                            });
                            
                            // 2. Agregar el mensaje manual agrupado
                            await openai.beta.threads.messages.create(threadId, {
                                role: 'assistant',
                                content: combinedMessage
                            });
                            
                            // 3. Actualizar thread
                            const threadInfo = threadPersistence.getThread(shortClientId);
                            if (threadInfo) {
                                threadPersistence.setThread(shortClientId, threadId, threadInfo.chatId, threadInfo.userName);
                            }
                            
                            // 🎯 Log compacto final
                            const msgCount = finalBuffer.messages.length > 1 ? `${finalBuffer.messages.length} msgs` : '1 msg';
                            const timestamp5 = getCompactTimestamp();
                            console.log(`${LOG_COLORS.TIMESTAMP}${timestamp5}${LOG_COLORS.RESET} ${LOG_COLORS.BOT}[BOT]${LOG_COLORS.RESET} ✅ Enviado a 🤖 OpenAI → Contexto actualizado (${msgCount})`);
                            
                            // Solo log técnico
                            logSuccess('MANUAL_SYNC_SUCCESS', `Mensajes manuales sincronizados exitosamente`, {
                                shortClientId: shortClientId,
                                agentName: finalBuffer.agentName,
                                messageCount: finalBuffer.messages.length,
                                totalLength: combinedMessage.length,
                                preview: combinedMessage.substring(0, 100),
                                threadId: threadId,
                                timestamp: new Date().toISOString()
                            });
                            
                        } catch (error) {
                            const timestamp6 = getCompactTimestamp();
                            console.log(`${LOG_COLORS.TIMESTAMP}${timestamp6}${LOG_COLORS.RESET} ${LOG_COLORS.AGENT}[AGENT]${LOG_COLORS.RESET} ❌ Error sincronizando con OpenAI: ${error.message}`);
                            logError('MANUAL_SYNC_ERROR', `Error sincronizando mensajes manuales`, {
                                error: error.message,
                                threadId: threadId,
                                chatId: shortClientId,
                                messageCount: finalBuffer.messages.length
                            });
                        }
                    }
                    
                    // Limpiar buffers
                    manualMessageBuffers.delete(chatId);
                    manualTimers.delete(chatId);
                }, MANUAL_MESSAGE_TIMEOUT);
                
                manualTimers.set(chatId, timerId);
                continue; // Procesar siguiente mensaje
            }
            
            // Solo procesar mensajes de texto entrantes del cliente
            if (message.from_me || message.type !== 'text' || !message.text?.body) {
                logInfo('WEBHOOK_SKIP', 'Mensaje omitido', { 
                    from_me: message.from_me, 
                    type: message.type, 
                    hasText: !!message.text?.body 
                });
                continue;
            }
            
            const userId = message.from;
            const chatId = message.chat_id;
            const text = message.text.body.trim();
            
            // Mejorar extracción del nombre
            const rawName = message.from_name || message.contact_name || 'Usuario';
            const cleanName = cleanContactName(rawName);
            
            // Asegurar formato consistente de userId
            const shortUserId = getShortUserId(userId);
            
            logInfo('WEBHOOK_USER', `Usuario detectado: ${userId}`, { 
                originalChatId: chatId,
                userId: userId,
                shortUserId: shortUserId,
                rawName: rawName,
                cleanName: cleanName
            });
            
            // Solo log técnico (evitar spam en consola)
            logWhatsAppMessage(shortUserId, 'IN', text.length > 50 ? text.substring(0, 50) + '...' : text, cleanName);
            
            // Registrar mensaje en el detector de typing
            recordMessage(userId);
            
            // Gestionar buffer de mensajes (igual que Baileys)
            if (!userMessageBuffers.has(userId)) {
                userMessageBuffers.set(userId, {
                    messages: [],
                    chatId: chatId,
                    name: cleanName,
                    lastActivity: Date.now()
                });
                logBufferActivity(shortUserId, 'buffer_created');
                
                // Opcionalmente, obtener información adicional del contacto para nuevos usuarios
                // Solo si no tenemos thread guardado (usuario nuevo)
                const existingThread = threadPersistence.getThread(shortUserId);
                if (!existingThread) {
                    logDebug('NEW_USER', `Usuario nuevo detectado: ${shortUserId}, obteniendo info adicional`);
                    // No await aquí para no bloquear el procesamiento
                    getEnhancedContactInfo(shortUserId, chatId).then(enhancedInfo => {
                        if (enhancedInfo.name !== cleanName) {
                            logInfo('CONTACT_ENHANCED', `Nombre mejorado para ${shortUserId}`, {
                                webhook: cleanName,
                                enhanced: enhancedInfo.name,
                                labels: enhancedInfo.labels
                            });
                        }
                    });
                }
            }
            
            const buffer = userMessageBuffers.get(userId);
            buffer.messages.push(text);
            buffer.lastActivity = Date.now();
            
            logBufferActivity(shortUserId, 'message_added', buffer.messages.length);
            
            // Sistema simple
            if (userActivityTimers.has(userId)) {
                clearTimeout(userActivityTimers.get(userId));
            }
            
            // 🎯 SOLO Log de consola SIMPLE con timestamp y colores
            const timestamp = getCompactTimestamp();
            console.log(`${LOG_COLORS.TIMESTAMP}${timestamp}${LOG_COLORS.RESET} ${LOG_COLORS.USER}[USER]${LOG_COLORS.RESET} 👤 ${cleanName}: "${text.substring(0, 20)}${text.length > 20 ? '...' : ''}" → ⏳ 8 seg..`);
            
            // 📋 Solo log técnico sin spam en consola
            logInfo('CONVERSATION_FLOW', `Cliente escribiendo`, {
                shortUserId: shortUserId,
                clientMessage: text.substring(0, 50),
                bufferCount: buffer.messages.length,
                timeoutSeconds: 8,
                hasActiveThread: !!getThreadId(userId),
                chatId: chatId,
                userName: cleanName,
                timestamp: new Date().toISOString()
            });
            
            const timerId = setTimeout(async () => {
                // Solo log técnico
                logInfo('TIMER', `Timeout completado, procesando mensajes`, {
                    shortUserId: shortUserId,
                    messageCount: buffer.messages.length,
                    timeoutCompletedAt: new Date().toISOString()
                });
                
                await processUserMessage(userId);
            }, 8000);
            
            userActivityTimers.set(userId, timerId);
        }
        
        res.status(200).send('OK');
    } catch (error) {
        logError('WEBHOOK_ERROR', 'Error procesando webhook', { 
            error: error.message, 
            stack: error.stack,
            body: req.body
        });
        // IMPORTANTE: Siempre devolver 200 a Whapi para evitar reintentos infinitos
        res.status(200).send('OK');
    }
});

// --- Inicialización ---
const main = async () => {
    try {
        // Solo logs técnicos detallados (sin spam en consola)
        logInfo('APP_INIT', 'Iniciando servidor bot TeAlquilamos', {
            port: PORT,
            timestamp: new Date().toISOString()
        });
        
        // Cargar threads persistidos
        try {
            const stats = threadPersistence.getStats();
            logSuccess('THREADS_LOADED', `Threads cargados desde archivo`, {
                ...stats,
                timestamp: new Date().toISOString()
            });
            
            // Debug: mostrar información de threads cargados (solo archivos técnicos)
            if (stats.totalThreads > 0) {
                logInfo('THREADS_INFO', `${stats.totalThreads} threads activos en el sistema`, {
                    activeThreads: stats.activeThreads,
                    totalThreads: stats.totalThreads
                });
                
                // Mostrar todos los threads cargados (solo en logs técnicos)
                const allThreads = threadPersistence.getAllThreadsInfo();
                logDebug('THREADS_DETAIL', 'Threads cargados detalladamente', { threads: allThreads });
            }
        } catch (error) {
            logError('THREADS_LOAD', `Error cargando threads`, { 
                error: error.message, 
                stack: error.stack 
            });
        }
        
        // Inicializar archivo de log (mantener compatibilidad)
        if (DEBUG_MODE) {
            fs.writeFileSync(DEBUG_LOG_PATH, `--- Bot iniciado ${new Date().toISOString()} ---\n`);
            logInfo('DEBUG_FILE', `Archivo de debug legacy inicializado`, { 
                path: DEBUG_LOG_PATH,
                debugMode: DEBUG_MODE 
            });
        }
        
        // Validación de configuración
        if (!ASSISTANT_ID) {
            console.log('❌ ERROR: Variable ASSISTANT_ID no configurada');
            logError('CONFIG', 'Variable ASSISTANT_ID no configurada');
            process.exit(1);
        }
        
        if (!WHAPI_TOKEN) {
            console.log('❌ ERROR: Variable WHAPI_TOKEN no configurada');
            logError('CONFIG', 'Variable WHAPI_TOKEN no configurada');
            process.exit(1);
        }
        
        logSuccess('CONFIG', 'Configuración validada correctamente', {
            port: PORT,
            hasAssistantId: !!ASSISTANT_ID,
            hasWhapiToken: !!WHAPI_TOKEN,
            whapiUrl: WHAPI_API_URL,
            debugMode: DEBUG_MODE
        });
        
        // Iniciar servidor
        app.listen(PORT, () => {
            const stats = threadPersistence.getStats();
            
            // 🎯 DASHBOARD SIMPLE Y LIMPIO (sin prefijos [BOT])
            console.clear();
            console.log('\n┌──────────────────────────────────────────────────────────┐');
            console.log('│ 🚀 TeAlquilamos Bot - Dashboard en Tiempo Real          │');
            console.log('├──────────────────────────────────────────────────────────┤');
            console.log(`│ 🌐 Puerto: ${PORT.toString().padEnd(46)} │`);
            console.log(`│ 👥 Threads activos: ${stats.totalThreads.toString().padEnd(38)} │`);
            console.log(`│ ⏱️  Timeout: 8s (clientes y agentes)${''.padEnd(18)} │`);
            console.log(`│ 🛡️  Anti-duplicación: Activo${''.padEnd(26)} │`);
            console.log(`│ 📋 Logs detallados: /logs/${''.padEnd(27)} │`);
            console.log('└──────────────────────────────────────────────────────────┘');
            console.log('\n📱 Esperando mensajes...');
            console.log('💡 Presiona Ctrl+C para cerrar el bot\n');
            
            logSuccess('SERVER_START', 'Bot con sincronización manual iniciado exitosamente', {
                port: PORT,
                clientTimeout: '8000ms',
                manualTimeout: '8000ms',
                features: ['client_grouping', 'manual_sync', 'bot_message_filtering'],
                debugMode: DEBUG_MODE,
                loadedThreads: stats,
                botTracking: true,
                manualBuffering: true
            });
        });
        
    } catch (error) {
        logError('STARTUP_ERROR', 'Error fatal al iniciar', { 
            error: error.message, 
            stack: error.stack 
        });
        process.exit(1);
    }
};

// --- Estadísticas en tiempo real cada 30 segundos (opcional) ---
// Descomenta las siguientes líneas si quieres ver estadísticas automáticas
// setInterval(() => {
//     if (userMessageBuffers.size > 0 || manualMessageBuffers.size > 0) {
//         showLiveStats();
//     }
// }, 30000);

// --- Manejo de errores y cierre ---
process.on('unhandledRejection', (reason) => {
    console.log('⚠️  Error no manejado detectado');
    logError('SYSTEM', 'Unhandled Rejection detectado', { 
        reason: reason.toString(),
        timestamp: new Date().toISOString() 
    });
});

process.on('SIGINT', () => {
    console.log('\n⏹️  Cerrando TeAlquilamos Bot...');
    const stats = threadPersistence.getStats();
    
    // Log técnico detallado
    logInfo('SHUTDOWN', 'Cierre del bot iniciado por SIGINT', {
        activeThreads: stats.totalThreads,
        activeBuffers: userMessageBuffers.size,
        activeManualBuffers: manualMessageBuffers.size,
        trackedBotMessages: botSentMessages.size,
        shutdownTime: new Date().toISOString(),
        threadStats: stats
    });
    
    console.log('👋 Bot cerrado correctamente\n');
    logSuccess('SHUTDOWN', 'Bot cerrado exitosamente', { 
        finalStats: stats,
        shutdownTime: new Date().toISOString() 
    });
    process.exit(0);
});

// Iniciar el bot
main();